import test from 'node:test';
import assert from 'node:assert/strict';
import { CashierStore } from '../assets/js/store.js';
import { STORAGE_KEY } from '../assets/js/constants.js';
import { CommerceError } from '../assets/js/commerce.js';

function memoryStorage(initial = new Map()) {
  return {
    map: initial,
    getItem(key) {
      return this.map.get(key) ?? null;
    },
    setItem(key, value) {
      this.map.set(key, String(value));
    },
    removeItem(key) {
      this.map.delete(key);
    }
  };
}

test('إنشاء بيانات تجريبية متكاملة', () => {
  const store = new CashierStore({ storage: memoryStorage(), now: new Date('2026-10-25T18:00:00+03:00') });
  assert.equal(store.state.products.length, 15);
  assert.ok(store.state.invoices.length >= 28);
  assert.equal(store.state.cart.items.length, 0);
  assert.ok(store.state.settings.storeName);
  assert.ok(store.storage.getItem(STORAGE_KEY));
});

test('إضافة منتج للسلة ثم إتمام الفاتورة وتحديث المخزون', () => {
  const storage = memoryStorage();
  const store = new CashierStore({ storage, now: new Date('2026-10-25T18:00:00+03:00') });
  const product = store.state.products.find((entry) => entry.id === 'p_coffee_cardamom');
  const beforeStock = product.stock;
  store.addToCart(product.id, 2);
  assert.equal(store.getCart().quantityCount, 2);
  const beforeInvoices = store.state.invoices.length;
  const invoice = store.checkout({ paymentMethod: 'card' });
  assert.equal(invoice.items[0].quantity, 2);
  assert.equal(store.getProduct(product.id).stock, beforeStock - 2);
  assert.equal(store.state.invoices.length, beforeInvoices + 1);
  assert.equal(store.state.cart.items.length, 0);
  assert.equal(invoice.number, String(1000 + beforeInvoices + 1));
});

test('منع الكمية الأكبر من المخزون', () => {
  const store = new CashierStore({ storage: memoryStorage() });
  assert.throws(() => store.addToCart('p_tahini', 99), /المتاح/);
});

test('إضافة منتج جديد والتحقق من الباركود المكرر', () => {
  const store = new CashierStore({ storage: memoryStorage() });
  const barcode = store.suggestBarcode();
  const product = store.addProduct({
    name: 'منتج اختبار',
    category: 'أساسيات',
    barcode,
    price: 12,
    cost: 7,
    stock: 8,
    lowStock: 3
  });
  assert.ok(product.id);
  assert.throws(
    () => store.addProduct({
      name: 'منتج آخر',
      category: 'أساسيات',
      barcode,
      price: 10,
      cost: 5,
      stock: 2,
      lowStock: 1
    }),
    (error) => error instanceof CommerceError && error.field === 'barcode'
  );
});

test('استعادة الحالة بعد إعادة التحميل', () => {
  const storage = memoryStorage();
  const first = new CashierStore({ storage });
  const product = first.state.products.find((entry) => entry.stock > 2);
  first.adjustStock(product.id, 3);
  const updated = first.getProduct(product.id).stock;

  const second = new CashierStore({ storage });
  assert.equal(second.getProduct(product.id).stock, updated);
  assert.equal(second.state.products.length, first.state.products.length);
});

test('إعادة تعيين البيانات التجريبية تُبقي مفتاح AI', () => {
  const store = new CashierStore({ storage: memoryStorage() });
  store.updateSettings({ storeName: 'متجر مؤقت', geminiKey: 'test-key' });
  store.restoreDemo();
  assert.equal(store.state.settings.storeName, 'بقالة رواق');
  assert.equal(store.state.settings.geminiKey, 'test-key');
});

test('التصدير لا يكشف مفتاح AI والاستيراد يتحقق من البنية', () => {
  const store = new CashierStore({ storage: memoryStorage() });
  store.updateSettings({ geminiKey: 'secret' });
  const backup = store.exportSnapshot();
  assert.equal(backup.data.settings.geminiKey, '');
  assert.ok(Array.isArray(backup.data.products));
  assert.throws(() => store.importSnapshot({ hello: 'world' }), /نسخة صالحة/);
});

test('تعديل الكميات لا ينزل تحت الصفر', () => {
  const store = new CashierStore({ storage: memoryStorage() });
  store.adjustStock('p_water_600', -999);
  assert.equal(store.getProduct('p_water_600').stock, 0);
});
