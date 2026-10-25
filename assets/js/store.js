import {
  APP_VERSION,
  DEFAULT_SETTINGS,
  PRESET_CATEGORIES,
  STORAGE_KEY
} from './constants.js';
import {
  CommerceError,
  assertStock,
  buildInvoice,
  calculateCart,
  nextInvoiceNumber,
  normalizeProductInput,
  validateProductInput
} from './commerce.js';
import { createSeedState } from './seed.js';
import { generateEan13 } from './ean.js';
import { inferArtKind } from './art.js';
import { clamp, parseDate, roundMoney, uid } from './util.js';

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function safeStorage() {
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // Private mode or a blocked storage context.
  }
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    get length() {
      return map.size;
    }
  };
}

function normalizeSettings(settings = {}, fallback = DEFAULT_SETTINGS) {
  const next = { ...fallback, ...settings };
  return {
    ...next,
    storeName: String(next.storeName || fallback.storeName).trim().slice(0, 60),
    branch: String(next.branch || fallback.branch).trim().slice(0, 60),
    cashierName: String(next.cashierName || fallback.cashierName).trim().slice(0, 40),
    phone: String(next.phone || '').trim().slice(0, 30),
    currency: String(next.currency || fallback.currency).trim().slice(0, 8),
    currencyCode: String(next.currencyCode || fallback.currencyCode).trim().toUpperCase().slice(0, 4),
    vatRate: clamp(Number(next.vatRate) || 0, 0, 100),
    pricesIncludeVat: next.pricesIncludeVat !== false,
    geminiKey: String(next.geminiKey || '').trim(),
    geminiModel: String(next.geminiModel || fallback.geminiModel).trim().slice(0, 80),
    sounds: next.sounds !== false
  };
}

function normalizeLoadedProduct(product) {
  if (!product || typeof product !== 'object') return null;
  const barcode = String(product.barcode || '').replace(/\D/g, '');
  const price = Number(product.price);
  const cost = Number(product.cost);
  const stock = Number(product.stock);
  if (!product.id || !product.name || barcode.length !== 13) return null;
  if (!Number.isFinite(price) || !Number.isFinite(stock)) return null;
  return {
    id: String(product.id),
    name: String(product.name).slice(0, 100),
    category: String(product.category || 'أساسيات').slice(0, 60),
    barcode,
    price: roundMoney(Math.max(0, price)),
    cost: roundMoney(Math.max(0, Number.isFinite(cost) ? cost : 0)),
    stock: Math.max(0, Math.floor(stock)),
    lowStock: Math.max(0, Math.floor(Number(product.lowStock) || 3)),
    art: String(product.art || inferArtKind(product.name, product.category)),
    image: typeof product.image === 'string' && product.image.startsWith('data:image/') ? product.image : null,
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: product.updatedAt || new Date().toISOString()
  };
}

function normalizeLoadedInvoice(invoice) {
  if (!invoice || typeof invoice !== 'object') return null;
  const date = parseDate(invoice.date);
  if (!invoice.number || !Array.isArray(invoice.items) || !invoice.items.length) return null;
  const items = invoice.items
    .map((item) => ({
      productId: String(item.productId || ''),
      name: String(item.name || 'منتج'),
      category: String(item.category || 'أساسيات'),
      barcode: String(item.barcode || ''),
      art: String(item.art || 'pantry'),
      image: typeof item.image === 'string' && item.image.startsWith('data:image/') ? item.image : null,
      unitPrice: roundMoney(Number(item.unitPrice) || 0),
      unitCost: roundMoney(Number(item.unitCost) || 0),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      lineTotal: roundMoney(Number(item.lineTotal) || 0)
    }))
    .filter(Boolean);
  if (!items.length) return null;
  const total = roundMoney(Number(invoice.total) || 0);
  return {
    ...invoice,
    id: String(invoice.id || uid('inv')),
    number: String(invoice.number),
    date: date.toISOString(),
    items,
    subtotal: roundMoney(Number(invoice.subtotal) || total),
    discountAmount: roundMoney(Number(invoice.discountAmount) || 0),
    tax: roundMoney(Number(invoice.tax) || 0),
    total,
    itemCount: Math.floor(Number(invoice.itemCount) || items.reduce((sum, item) => sum + item.quantity, 0)),
    paymentMethod: invoice.paymentMethod || 'cash',
    cashReceived: invoice.cashReceived == null ? null : roundMoney(Number(invoice.cashReceived) || 0),
    change: roundMoney(Number(invoice.change) || 0),
    currency: String(invoice.currency || 'ر.س'),
    currencyCode: String(invoice.currencyCode || 'SAR'),
    cashierName: String(invoice.cashierName || ''),
    store: invoice.store && typeof invoice.store === 'object' ? invoice.store : {}
  };
}

function normalizeLoadedState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.products) || !Array.isArray(state.invoices)) {
    throw new Error('بنية البيانات غير معروفة.');
  }
  const products = state.products.map(normalizeLoadedProduct).filter(Boolean);
  const invoices = state.invoices.map(normalizeLoadedInvoice).filter(Boolean);
  const settings = normalizeSettings(state.settings);
  const items = Array.isArray(state.cart?.items)
    ? state.cart.items
        .map((item) => ({
          productId: String(item.productId || ''),
          quantity: Math.max(0, Math.floor(Number(item.quantity) || 0))
        }))
        .filter((item) => item.productId && item.quantity > 0 && products.some((product) => product.id === item.productId))
    : [];
  const discountType = state.cart?.discount?.type === 'percent' ? 'percent' : 'amount';
  const highestInvoice = invoices.reduce(
    (max, invoice) => Math.max(max, Number(invoice.number) || 0),
    1000
  );
  return {
    version: 1,
    createdAt: state.createdAt || new Date().toISOString(),
    updatedAt: state.updatedAt || new Date().toISOString(),
    settings,
    products,
    invoices,
    cart: {
      items,
      discount: {
        type: discountType,
        value: Math.max(0, Number(state.cart?.discount?.value) || 0)
      }
    },
    counters: {
      invoice: Math.max(Number(state.counters?.invoice) || 0, highestInvoice)
    },
    meta: {
      isDemo: state.meta?.isDemo !== false,
      lastSaleAt: state.meta?.lastSaleAt || invoices[0]?.date || null
    }
  };
}

export class CashierStore {
  constructor({ storage = safeStorage(), now = new Date(), seed = true } = {}) {
    this.storage = storage;
    this.listeners = new Set();
    this.lastPersistError = null;
    this.lastSavedAt = null;
    this.state = this.load(now, seed);
  }

  load(now, seed) {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1) return normalizeLoadedState(parsed);
      }
    } catch (error) {
      console.warn('تعذّرت قراءة البيانات المحلية، سأبدأ بنسخة جديدة.', error);
    }
    const initial = seed ? createSeedState({ now }) : normalizeLoadedState({
      products: [],
      invoices: [],
      settings: DEFAULT_SETTINGS,
      cart: { items: [], discount: { type: 'amount', value: 0 } },
      counters: { invoice: 1000 }
    });
    this.state = initial;
    this.persist();
    return initial;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(reason = 'change') {
    for (const listener of this.listeners) listener(this.state, reason);
  }

  persist() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.lastPersistError = null;
      this.lastSavedAt = new Date();
      return true;
    } catch (error) {
      this.lastPersistError = error;
      console.warn('تعذّر حفظ البيانات محلياً.', error);
      return false;
    }
  }

  commit(reason = 'change') {
    this.state.updatedAt = new Date().toISOString();
    const ok = this.persist();
    this.emit(reason);
    return ok;
  }

  categories() {
    const extra = [...new Set(this.state.products.map((product) => product.category))]
      .filter((category) => category && !PRESET_CATEGORIES.includes(category))
      .sort((a, b) => a.localeCompare(b, 'ar'));
    return [...PRESET_CATEGORIES, ...extra];
  }

  getProduct(id) {
    return this.state.products.find((product) => product.id === id) || null;
  }

  getProductByBarcode(barcode) {
    const digits = String(barcode || '').replace(/\D/g, '');
    return this.state.products.find((product) => product.barcode === digits) || null;
  }

  getCart() {
    return calculateCart(this.state.cart, this.state.products, this.state.settings);
  }

  addToCart(productId, quantity = 1) {
    const product = this.getProduct(productId);
    if (!product) throw new CommerceError('المنتج غير موجود.', 'NOT_FOUND');
    if (product.stock <= 0) throw new CommerceError(`«${product.name}» نفد من المخزون.`, 'STOCK');
    const step = Math.max(1, Math.floor(Number(quantity) || 1));
    const current = this.state.cart.items.find((item) => item.productId === productId);
    const nextQuantity = (current?.quantity || 0) + step;
    if (nextQuantity > product.stock) {
      throw new CommerceError(`المتاح من «${product.name}» ${product.stock} فقط.`, 'STOCK');
    }
    if (current) current.quantity = nextQuantity;
    else this.state.cart.items.push({ productId, quantity: step });
    this.commit('cart');
    return product;
  }

  setCartQuantity(productId, quantity) {
    const nextQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
    const item = this.state.cart.items.find((entry) => entry.productId === productId);
    if (!item) return;
    const product = this.getProduct(productId);
    if (nextQuantity > (product?.stock || 0)) {
      throw new CommerceError(`المتاح من «${product?.name || 'المنتج'}» ${product?.stock || 0} فقط.`, 'STOCK');
    }
    if (nextQuantity === 0) {
      this.state.cart.items = this.state.cart.items.filter((entry) => entry.productId !== productId);
    } else {
      item.quantity = nextQuantity;
    }
    this.commit('cart');
  }

  adjustCartQuantity(productId, delta) {
    const item = this.state.cart.items.find((entry) => entry.productId === productId);
    this.setCartQuantity(productId, (item?.quantity || 0) + Number(delta));
  }

  removeFromCart(productId) {
    this.state.cart.items = this.state.cart.items.filter((item) => item.productId !== productId);
    this.commit('cart');
  }

  clearCart() {
    this.state.cart = { items: [], discount: { type: 'amount', value: 0 } };
    this.commit('cart');
  }

  setDiscount(type = 'amount', value = 0) {
    this.state.cart.discount = {
      type: type === 'percent' ? 'percent' : 'amount',
      value: Math.max(0, Number(value) || 0)
    };
    this.commit('discount');
  }

  checkout({ paymentMethod = 'cash', cashReceived = null } = {}) {
    const cart = this.getCart();
    if (!cart.items.length) throw new CommerceError('السلة فارغة.', 'EMPTY_CART');
    assertStock(this.state.products, cart.items);
    const number = nextInvoiceNumber(this.state);
    const invoice = buildInvoice({
      number,
      cartItems: cart.items,
      discount: this.state.cart.discount,
      settings: this.state.settings,
      paymentMethod,
      cashReceived,
      cashierName: this.state.settings.cashierName,
      date: new Date()
    });
    for (const item of cart.items) {
      const product = this.getProduct(item.productId);
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity);
        product.updatedAt = new Date().toISOString();
      }
    }
    this.state.invoices.unshift(invoice);
    this.state.counters.invoice = Number(number);
    this.state.cart = { items: [], discount: { type: 'amount', value: 0 } };
    this.state.meta.lastSaleAt = invoice.date;
    this.state.meta.isDemo = false;
    this.commit('checkout');
    return invoice;
  }

  suggestBarcode() {
    return generateEan13(this.state.products.map((product) => product.barcode));
  }

  validateProduct(input, editingId = null) {
    const candidate = {
      ...input,
      barcode: input.barcode || this.suggestBarcode()
    };
    const errors = validateProductInput(candidate, this.state.products, editingId);
    return { candidate, errors, valid: Object.keys(errors).length === 0 };
  }

  addProduct(input, { image = null } = {}) {
    const candidateInput = {
      ...input,
      barcode: String(input.barcode || this.suggestBarcode()).replace(/\D/g, '')
    };
    const errors = validateProductInput(candidateInput, this.state.products);
    if (Object.keys(errors).length) {
      const firstField = Object.keys(errors)[0];
      throw new CommerceError(errors[firstField], 'VALIDATION', firstField);
    }
    const normalized = normalizeProductInput(candidateInput);
    const now = new Date().toISOString();
    const product = {
      id: uid('p'),
      ...normalized,
      art: input.art || inferArtKind(normalized.name, normalized.category),
      image: typeof image === 'string' && image.startsWith('data:image/') ? image : null,
      createdAt: now,
      updatedAt: now
    };
    this.state.products.unshift(product);
    this.state.meta.isDemo = false;
    this.commit('product-add');
    return product;
  }

  updateProduct(id, input, { image, removeImage = false } = {}) {
    const product = this.getProduct(id);
    if (!product) throw new CommerceError('المنتج غير موجود.', 'NOT_FOUND');
    const candidateInput = {
      ...input,
      barcode: String(input.barcode || product.barcode).replace(/\D/g, '')
    };
    const errors = validateProductInput(candidateInput, this.state.products, id);
    if (Object.keys(errors).length) {
      const firstField = Object.keys(errors)[0];
      throw new CommerceError(errors[firstField], 'VALIDATION', firstField);
    }
    const normalized = normalizeProductInput(candidateInput);
    Object.assign(product, normalized, {
      art: input.art || product.art || inferArtKind(normalized.name, normalized.category),
      updatedAt: new Date().toISOString()
    });
    if (removeImage) product.image = null;
    if (typeof image === 'string' && image.startsWith('data:image/')) product.image = image;
    this.commit('product-update');
    return product;
  }

  deleteProduct(id) {
    const product = this.getProduct(id);
    if (!product) return;
    this.state.products = this.state.products.filter((item) => item.id !== id);
    this.state.cart.items = this.state.cart.items.filter((item) => item.productId !== id);
    this.commit('product-delete');
  }

  adjustStock(id, delta) {
    const product = this.getProduct(id);
    if (!product) throw new CommerceError('المنتج غير موجود.', 'NOT_FOUND');
    const next = Math.max(0, product.stock + Math.floor(Number(delta) || 0));
    product.stock = next;
    product.updatedAt = new Date().toISOString();
    this.commit('stock');
    return next;
  }

  updateSettings(patch) {
    this.state.settings = normalizeSettings({ ...this.state.settings, ...patch }, this.state.settings);
    this.commit('settings');
    return this.state.settings;
  }

  saveGeminiSettings({ geminiKey, geminiModel }) {
    this.updateSettings({ geminiKey, geminiModel });
  }

  restoreDemo({ keepAiSettings = true } = {}) {
    const previousSettings = this.state.settings;
    const seeded = createSeedState();
    if (keepAiSettings) {
      seeded.settings.geminiKey = previousSettings.geminiKey;
      seeded.settings.geminiModel = previousSettings.geminiModel;
    }
    this.state = seeded;
    this.commit('restore-demo');
  }

  exportSnapshot() {
    const data = clone(this.state);
    data.settings = { ...data.settings, geminiKey: '' };
    return {
      app: 'cashier-ai',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  importSnapshot(raw) {
    const payload = raw?.data && raw?.app === 'cashier-ai' ? raw.data : raw;
    if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.invoices)) {
      throw new CommerceError('الملف لا يحتوي نسخة صالحة من بيانات كاشير AI.', 'IMPORT');
    }
    if (payload.products.length > 4000 || payload.invoices.length > 20000) {
      throw new CommerceError('الملف أكبر من الحد الذي يمكن استيراده.', 'IMPORT');
    }
    const currentKey = this.state.settings.geminiKey;
    const currentModel = this.state.settings.geminiModel;
    const next = normalizeLoadedState({
      ...payload,
      settings: { ...DEFAULT_SETTINGS, ...payload.settings, geminiKey: currentKey, geminiModel: currentModel }
    });
    if (!next.products.length && !next.invoices.length) {
      throw new CommerceError('لا توجد منتجات أو فواتير في الملف.', 'IMPORT');
    }
    this.state = next;
    this.commit('import');
    return {
      products: next.products.length,
      invoices: next.invoices.length
    };
  }

  storageBytes() {
    try {
      return new Blob([JSON.stringify(this.state)]).size;
    } catch {
      return JSON.stringify(this.state).length;
    }
  }
}

export { STORAGE_KEY, normalizeSettings, normalizeLoadedState };
