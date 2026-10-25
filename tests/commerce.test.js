import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CommerceError,
  assertStock,
  buildInvoice,
  calculateTotals,
  joinCart
} from '../assets/js/commerce.js';

const settings = {
  storeName: 'بقالة اختبار',
  branch: 'فرع',
  phone: '',
  currency: 'ر.س',
  currencyCode: 'SAR',
  vatRate: 15,
  pricesIncludeVat: true
};

const product = {
  id: 'p1',
  name: 'منتج',
  category: 'أساسيات',
  barcode: '6281000000010',
  art: 'pantry',
  image: null,
  price: 10,
  cost: 6,
  stock: 5
};

test('احتساب الضريبة المشمولة والخصم بالنسبة', () => {
  const items = joinCart({ items: [{ productId: 'p1', quantity: 2 }], discount: { type: 'percent', value: 10 } }, [product]);
  assert.equal(items[0].lineTotal, 20);
  const totals = calculateTotals(items, { type: 'percent', value: 10 }, settings);
  assert.equal(totals.subtotal, 20);
  assert.equal(totals.discountAmount, 2);
  assert.equal(totals.total, 18);
  assert.equal(totals.taxable, 15.65);
  assert.equal(totals.tax, 2.35);
  assert.equal(totals.quantityCount, 2);
});

test('احتساب الضريبة غير المشمولة', () => {
  const items = joinCart({ items: [{ productId: 'p1', quantity: 1 }] }, [product]);
  const totals = calculateTotals(items, { type: 'amount', value: 0 }, { ...settings, pricesIncludeVat: false });
  assert.equal(totals.tax, 1.5);
  assert.equal(totals.total, 11.5);
});

test('الخصم الثابت لا يتجاوز الإجمالي', () => {
  const items = joinCart({ items: [{ productId: 'p1', quantity: 1 }] }, [product]);
  const totals = calculateTotals(items, { type: 'amount', value: 500 }, settings);
  assert.equal(totals.discountAmount, 10);
  assert.equal(totals.total, 0);
});

test('بناء فاتورة نقدية وحساب الباقي', () => {
  const items = joinCart({ items: [{ productId: 'p1', quantity: 2 }] }, [product]);
  const invoice = buildInvoice({
    number: 1050,
    cartItems: items,
    discount: { type: 'amount', value: 0 },
    settings,
    paymentMethod: 'cash',
    cashReceived: 50,
    cashierName: 'سالم'
  });
  assert.equal(invoice.number, '1050');
  assert.equal(invoice.total, 20);
  assert.equal(invoice.change, 30);
  assert.equal(invoice.items[0].name, 'منتج');
  assert.equal(invoice.itemCount, 2);
});

test('رفض الدفع النقدي الناقص', () => {
  const items = joinCart({ items: [{ productId: 'p1', quantity: 2 }] }, [product]);
  assert.throws(
    () => buildInvoice({
      number: 1051,
      cartItems: items,
      discount: { type: 'amount', value: 0 },
      settings,
      paymentMethod: 'cash',
      cashReceived: 5,
      cashierName: 'سالم'
    }),
    (error) => error instanceof CommerceError && error.code === 'PAYMENT'
  );
});

test('منع تجاوز المخزون', () => {
  const items = joinCart({ items: [{ productId: 'p1', quantity: 6 }] }, [product]);
  assert.throws(() => assertStock([product], items), /المتاح/);
});
