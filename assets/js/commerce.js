import { clamp, parseDate, roundMoney, uid } from './util.js';

export class CommerceError extends Error {
  constructor(message, code = 'COMMERCE', field = '') {
    super(message);
    this.name = 'CommerceError';
    this.code = code;
    this.field = field;
  }
}

export function validateProductInput(input, products = [], editingId = null) {
  const errors = {};
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim();
  const barcode = String(input.barcode || '').trim();
  const price = Number(input.price);
  const cost = Number(input.cost);
  const stock = Number(input.stock);
  const lowStock = Number(input.lowStock);

  if (name.length < 2) errors.name = 'اكتب اسماً واضحاً للمنتج.';
  if (name.length > 80) errors.name = 'اسم المنتج طويل جداً.';
  if (!category) errors.category = 'اختر فئة أو اكتب فئة جديدة.';
  if (!/^\d{13}$/.test(barcode)) {
    errors.barcode = 'الباركود يجب أن يتكون من 13 رقماً.';
  } else if (products.some((product) => product.barcode === barcode && product.id !== editingId)) {
    errors.barcode = 'هذا الباركود مستخدم لمنتج آخر.';
  }
  if (!Number.isFinite(price) || price < 0) errors.price = 'أدخل سعر بيع صالحاً.';
  if (!Number.isFinite(cost) || cost < 0) errors.cost = 'أدخل تكلفة صالحة.';
  if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) errors.stock = 'أدخل كمية صحيحة.';
  if (!Number.isFinite(lowStock) || lowStock < 0 || !Number.isInteger(lowStock)) {
    errors.lowStock = 'أدخل حداً صحيحاً للتنبيه.';
  }
  return errors;
}

export function normalizeProductInput(input) {
  return {
    name: String(input.name || '').trim(),
    category: String(input.category || '').trim(),
    barcode: String(input.barcode || '').trim(),
    price: roundMoney(clamp(Number(input.price) || 0, 0, 999999)),
    cost: roundMoney(clamp(Number(input.cost) || 0, 0, 999999)),
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    lowStock: Math.max(0, Math.floor(Number(input.lowStock) || 0))
  };
}

export function joinCart(cart, products) {
  const items = [];
  for (const entry of cart?.items || []) {
    const product = products.find((candidate) => candidate.id === entry.productId);
    if (!product) continue;
    const quantity = Math.max(0, Math.floor(Number(entry.quantity) || 0));
    if (!quantity) continue;
    items.push({
      product,
      productId: product.id,
      quantity,
      lineTotal: roundMoney(product.price * quantity)
    });
  }
  return items;
}

export function calculateTotals(lineItems, discount = { type: 'amount', value: 0 }, settings = {}) {
  const subtotal = roundMoney(lineItems.reduce((total, item) => total + Number(item.lineTotal || 0), 0));
  let discountAmount = 0;
  const discountValue = Math.max(0, Number(discount?.value) || 0);
  if (discount?.type === 'percent') {
    discountAmount = roundMoney(subtotal * (clamp(discountValue, 0, 100) / 100));
  } else {
    discountAmount = roundMoney(clamp(discountValue, 0, subtotal));
  }
  discountAmount = clamp(discountAmount, 0, subtotal);
  const net = roundMoney(subtotal - discountAmount);
  const vatRate = clamp(Number(settings.vatRate) || 0, 0, 100);
  const included = settings.pricesIncludeVat !== false;
  const taxable = included ? roundMoney(net / (1 + vatRate / 100)) : net;
  const tax = included ? roundMoney(net - taxable) : roundMoney(net * (vatRate / 100));
  const total = included ? net : roundMoney(net + tax);
  const quantityCount = lineItems.reduce((totalItems, item) => totalItems + Number(item.quantity || 0), 0);

  return {
    subtotal,
    discountAmount,
    discountType: discount?.type === 'percent' ? 'percent' : 'amount',
    discountValue,
    net,
    taxable,
    tax,
    taxRate: vatRate,
    taxIncluded: included,
    total,
    quantityCount,
    lineCount: lineItems.length
  };
}

export function calculateCart(cart, products, settings) {
  return {
    items: joinCart(cart, products),
    ...calculateTotals(joinCart(cart, products), cart?.discount, settings)
  };
}

export function assertStock(products, cartItems) {
  for (const item of cartItems) {
    if (item.quantity > item.product.stock) {
      throw new CommerceError(
        item.product.stock === 0
          ? `«${item.product.name}» غير متوفر في المخزون.`
          : `المتاح من «${item.product.name}» ${item.product.stock} فقط.`,
        'STOCK',
        item.productId
      );
    }
  }
}

export function buildInvoice({
  number,
  cartItems,
  discount,
  settings,
  paymentMethod = 'cash',
  cashReceived = null,
  cashierName = '',
  date = new Date()
}) {
  const totals = calculateTotals(cartItems, discount, settings);
  if (!cartItems.length) throw new CommerceError('أضف منتجاً واحداً على الأقل.', 'EMPTY_CART');
  const total = totals.total;
  const received = paymentMethod === 'cash' ? roundMoney(Number(cashReceived) || 0) : null;
  if (paymentMethod === 'cash' && received < total) {
    throw new CommerceError('المبلغ المستلم أقل من الإجمالي.', 'PAYMENT', 'cashReceived');
  }
  const change = paymentMethod === 'cash' ? roundMoney(received - total) : 0;

  return {
    id: uid('inv'),
    number: String(number),
    date: parseDate(date).toISOString(),
    cashierName,
    store: {
      name: settings.storeName,
      branch: settings.branch,
      phone: settings.phone
    },
    currency: settings.currency,
    currencyCode: settings.currencyCode || 'SAR',
    items: cartItems.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      category: item.product.category,
      barcode: item.product.barcode,
      art: item.product.art,
      image: item.product.image || null,
      unitPrice: item.product.price,
      unitCost: item.product.cost,
      quantity: item.quantity,
      lineTotal: item.lineTotal
    })),
    ...totals,
    paymentMethod,
    cashReceived: received,
    change,
    itemCount: totals.quantityCount
  };
}

export function nextInvoiceNumber(state) {
  const current = Math.max(1000, Number(state.counters?.invoice) || 1000);
  return current + 1;
}

export function generateSku(existing = []) {
  const set = new Set(existing);
  let value;
  do {
    value = `P${Math.floor(1000 + Math.random() * 9000)}`;
  } while (set.has(value));
  return value;
}
