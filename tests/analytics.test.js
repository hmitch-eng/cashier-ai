import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cartCompanions,
  purchasePairInsights,
  stockPulse
} from '../assets/js/analytics.js';

const NOW = new Date(2026, 9, 25, 18, 0, 0);

function day(offset, hour = 10) {
  const date = new Date(2026, 9, 25, hour, 0, 0);
  date.setDate(date.getDate() - offset);
  return date;
}

function invoice(id, date, lines) {
  return {
    id: `inv_${id}`,
    number: String(1000 + id),
    date: new Date(date).toISOString(),
    items: lines.map(([productId, quantity, extra = {}]) => ({
      productId,
      quantity,
      name: extra.name || productId,
      category: extra.category || 'عام',
      art: 'pantry',
      unitPrice: 10,
      lineTotal: 10 * quantity,
      ...extra
    }))
  };
}

function product(id, overrides = {}) {
  return {
    id,
    name: id,
    category: 'عام',
    barcode: '',
    stock: 10,
    lowStock: 3,
    price: 10,
    cost: 6,
    art: 'pantry',
    ...overrides
  };
}

function dailyInvoices(productId, count, quantity = 1, startOffset = 0) {
  return Array.from({ length: count }, (_, index) =>
    invoice(startOffset + index, day(index), [[productId, quantity]])
  );
}

test('stockPulse يحسب السرعة والتغطية والكمية المقترحة', () => {
  const invoices = dailyInvoices('coffee', 14);
  const pulse = stockPulse(invoices, [product('coffee', { name: 'قهوة', stock: 5 })], { now: NOW });
  const item = pulse.items[0];

  assert.equal(pulse.historyEnough, true);
  assert.equal(pulse.windowDays, 14);
  assert.equal(pulse.invoiceCount, 14);
  assert.equal(item.sold, 14);
  assert.equal(item.dailyVelocity, 1);
  assert.equal(item.coverageDays, 5);
  assert.equal(item.suggestedRestock, 9);
  assert.equal(item.urgency, 'watch');
  assert.equal(item.confidence, 'good');
  assert.equal(pulse.fastest.productId, 'coffee');
});

test('stockPulse يرفع النفاد إلى أولوية قصوى ويقترح تغطية الهدف', () => {
  const invoices = dailyInvoices('coffee', 14);
  const pulse = stockPulse(invoices, [product('coffee', { stock: 0 })], {
    now: NOW,
    targetDays: 7
  });
  const item = pulse.items[0];

  assert.equal(item.urgency, 'out');
  assert.equal(item.coverageDays, 0);
  assert.equal(item.suggestedRestock, 7);
  assert.equal(pulse.urgent.length, 1);
  assert.equal(pulse.suggestedUnits, 7);
});

test('stockPulse لا يخترع إشارة من فاتورتين فقط', () => {
  const invoices = [
    invoice(1, day(1), [['coffee', 2]]),
    invoice(2, day(0), [['coffee', 1]])
  ];
  const pulse = stockPulse(invoices, [product('coffee', { stock: 4 })], { now: NOW });
  const item = pulse.items[0];

  assert.equal(pulse.historyEnough, false);
  assert.equal(item.hasSignal, false);
  assert.equal(item.confidence, 'thin');
  assert.equal(item.coverageDays, null);
  assert.equal(item.suggestedRestock, 0);
  assert.equal(item.urgency, 'quiet');
  assert.equal(pulse.fastest, null);
  assert.equal(pulse.focusCategory, null);
});

test('stockPulse يتجاهل المبيعات القديمة خارج النافذة', () => {
  const invoices = [
    invoice(90, day(20), [['coffee', 100]]),
    ...dailyInvoices('coffee', 3)
  ];
  const pulse = stockPulse(invoices, [product('coffee', { stock: 8 })], { now: NOW });
  const item = pulse.items[0];

  assert.equal(pulse.invoiceCount, 3);
  assert.equal(pulse.windowDays, 3);
  assert.equal(item.sold, 3);
  assert.equal(item.dailyVelocity, 1);
  assert.equal(item.coverageDays, 8);
});

test('stockPulse يجمع الفئة الأكثر إلحاحاً للتزويد', () => {
  const invoices = dailyInvoices('coffee', 10);
  const products = [
    product('coffee', { name: 'قهوة', category: 'قهوة وشاي', stock: 1 }),
    product('tea', { name: 'شاي', category: 'قهوة وشاي', stock: 1 }),
    product('milk', { name: 'حليب', category: 'ألبان وأجبان', stock: 1 })
  ];
  const allInvoices = invoices.map((entry, index) => ({
    ...entry,
    items: [
      ...entry.items,
      ...(index < 10
        ? [{ productId: 'tea', quantity: 1, name: 'شاي', category: 'قهوة وشاي', art: 'tea' }]
        : []),
      ...(index < 4
        ? [{ productId: 'milk', quantity: 1, name: 'حليب', category: 'ألبان وأجبان', art: 'milk' }]
        : [])
    ]
  }));
  const pulse = stockPulse(allInvoices, products, { now: NOW });

  assert.equal(pulse.urgent.length, 3);
  assert.equal(pulse.focusCategory.name, 'قهوة وشاي');
  assert.equal(pulse.focusCategory.count, 2);
});

test('purchasePairInsights يعد الثنائيات مرة لكل فاتورة', () => {
  const invoices = [
    invoice(1, day(1), [['coffee', 1], ['tea', 1], ['coffee', 2]]),
    invoice(2, day(2), [['coffee', 1], ['tea', 1]]),
    invoice(3, day(3), [['coffee', 1], ['tea', 1]]),
    invoice(4, day(4), [['coffee', 1], ['bread', 1]]),
    invoice(5, day(5), [['coffee', 1], ['bread', 1]]),
    invoice(6, day(6), [['tea', 1], ['bread', 1]]),
    invoice(7, day(40), [['coffee', 20], ['bread', 20]])
  ];
  const result = purchasePairInsights(invoices, { now: NOW, minSupport: 2 });

  assert.equal(result.invoiceCount, 6);
  assert.equal(result.pairs.length, 2);
  assert.deepEqual(result.pairs[0].productIds, ['coffee', 'tea']);
  assert.equal(result.pairs[0].count, 3);
  assert.deepEqual(result.pairs[1].productIds, ['bread', 'coffee']);
  assert.equal(result.pairs[1].count, 2);
});

test('cartCompanions يرشح رفقاء السلة بالأدلة ويستبعد النافد', () => {
  const products = [
    product('coffee', { category: 'قهوة وشاي', stock: 10 }),
    product('tea', { category: 'قهوة وشاي', stock: 10 }),
    product('bread', { category: 'مخبوزات', stock: 10 })
  ];
  const invoices = [
    ...Array.from({ length: 3 }, (_, index) =>
      invoice(index + 1, day(index), [['coffee', 1], ['tea', 1]])
    ),
    ...Array.from({ length: 2 }, (_, index) =>
      invoice(index + 10, day(index), [['coffee', 1], ['bread', 1]])
    )
  ];

  const result = cartCompanions(invoices, products, ['coffee'], { now: NOW });
  assert.equal(result.mode, 'pair');
  assert.equal(result.historyEnough, true);
  assert.equal(result.suggestions.length, 2);
  assert.equal(result.suggestions[0].product.id, 'tea');
  assert.equal(result.suggestions[0].support, 3);
  assert.equal(result.suggestions[0].source, 'pair');
  assert.equal(result.suggestions[1].product.id, 'bread');

  products[1].stock = 0;
  const filtered = cartCompanions(invoices, products, ['coffee'], { now: NOW });
  assert.equal(filtered.suggestions.length, 1);
  assert.equal(filtered.suggestions[0].product.id, 'bread');
});

test('cartCompanions يعود لأفضل مبيعات الفئة عند غياب ثنائي واضح', () => {
  const products = [
    product('milk', { category: 'ألبان وأجبان', stock: 10 }),
    product('yogurt', { category: 'ألبان وأجبان', stock: 10 }),
    product('coffee', { category: 'قهوة وشاي', stock: 10 })
  ];
  const invoices = [
    ...Array.from({ length: 5 }, (_, index) => invoice(index + 1, day(index), [['milk', 1]])),
    ...Array.from({ length: 3 }, (_, index) =>
      invoice(index + 10, day(index), [['yogurt', 2]])
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      invoice(index + 20, day(index), [['coffee', 4]])
    )
  ];

  const result = cartCompanions(invoices, products, ['milk'], { now: NOW });
  assert.equal(result.mode, 'bestseller');
  assert.equal(result.suggestions[0].product.id, 'yogurt');
  assert.equal(result.suggestions[0].support, 6);
  assert.equal(result.suggestions[0].source, 'bestseller');
  assert.equal(result.suggestions[0].categoryMatch, true);
  assert.ok(result.suggestions.every((entry) => entry.product.category === 'ألبان وأجبان'));
});

test('cartCompanions لا يقترح شيئاً لسلة فارغة أو متجر بلا فواتير', () => {
  const products = [product('coffee'), product('tea')];
  assert.equal(cartCompanions([], products, ['coffee'], { now: NOW }).mode, 'none');
  assert.equal(cartCompanions([], products, [], { now: NOW }).suggestions.length, 0);
});
