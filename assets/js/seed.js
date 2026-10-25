import { DEFAULT_SETTINGS } from './constants.js';
import { makeEan13 } from './ean.js';
import { buildInvoice } from './commerce.js';
import { addDays, roundMoney, startOfDay } from './util.js';

const productBlueprint = [
  {
    id: 'p_dates_sukari',
    name: 'تمر سكري فاخر 500غ',
    category: 'تمور وحلويات',
    base: '628100000001',
    price: 34,
    cost: 22,
    stock: 18,
    lowStock: 6,
    art: 'dates'
  },
  {
    id: 'p_coffee_cardamom',
    name: 'قهوة عربية بالهيل 250غ',
    category: 'قهوة وشاي',
    base: '628100000002',
    price: 28.5,
    cost: 17,
    stock: 9,
    lowStock: 5,
    art: 'coffee'
  },
  {
    id: 'p_olive_oil',
    name: 'زيت زيتون بكر ممتاز 750مل',
    category: 'زيوت وصلصات',
    base: '628100000003',
    price: 46,
    cost: 32,
    stock: 6,
    lowStock: 5,
    art: 'oil'
  },
  {
    id: 'p_milk_full',
    name: 'حليب طازج كامل الدسم 1ل',
    category: 'ألبان وأجبان',
    base: '628100000004',
    price: 7.5,
    cost: 5.2,
    stock: 24,
    lowStock: 8,
    art: 'milk'
  },
  {
    id: 'p_bread_tannour',
    name: 'خبز تنور طازج',
    category: 'مخبوزات',
    base: '628100000005',
    price: 4,
    cost: 2,
    stock: 12,
    lowStock: 4,
    art: 'bread'
  },
  {
    id: 'p_water_600',
    name: 'ماء معدني 600مل',
    category: 'مشروبات',
    base: '628100000006',
    price: 1.5,
    cost: 0.7,
    stock: 60,
    lowStock: 12,
    art: 'water'
  },
  {
    id: 'p_yogurt_plain',
    name: 'زبادي طبيعي 170غ',
    category: 'ألبان وأجبان',
    base: '628100000007',
    price: 5.75,
    cost: 3.5,
    stock: 3,
    lowStock: 6,
    art: 'yogurt'
  },
  {
    id: 'p_tea_mint',
    name: 'شاي أسود بالنعناع 200غ',
    category: 'قهوة وشاي',
    base: '628100000008',
    price: 18,
    cost: 11,
    stock: 15,
    lowStock: 5,
    art: 'tea'
  },
  {
    id: 'p_tahini',
    name: 'طحينة بلدية 400غ',
    category: 'أساسيات',
    base: '628100000009',
    price: 16.5,
    cost: 10,
    stock: 2,
    lowStock: 5,
    art: 'tahini'
  },
  {
    id: 'p_pomegranate_juice',
    name: 'عصير رمان طبيعي 1ل',
    category: 'مشروبات',
    base: '628100000010',
    price: 12,
    cost: 7,
    stock: 20,
    lowStock: 6,
    art: 'juice'
  },
  {
    id: 'p_eggs_30',
    name: 'بيض بلدي 30 حبة',
    category: 'أساسيات',
    base: '628100000011',
    price: 21,
    cost: 15.5,
    stock: 8,
    lowStock: 4,
    art: 'eggs'
  },
  {
    id: 'p_honey_mountain',
    name: 'عسل جبلي 500غ',
    category: 'تمور وحلويات',
    base: '628100000012',
    price: 89,
    cost: 62,
    stock: 4,
    lowStock: 5,
    art: 'honey'
  },
  {
    id: 'p_haloumi',
    name: 'جبن حلوم 250غ',
    category: 'ألبان وأجبان',
    base: '628100000013',
    price: 26,
    cost: 18,
    stock: 10,
    lowStock: 4,
    art: 'cheese'
  },
  {
    id: 'p_maamoul',
    name: 'معمول بالتمر',
    category: 'تمور وحلويات',
    base: '628100000014',
    price: 32,
    cost: 20,
    stock: 0,
    lowStock: 5,
    art: 'cookie'
  },
  {
    id: 'p_detergent_jasmine',
    name: 'منظف أرضيات بالياسمين 1.5ل',
    category: 'منظفات',
    base: '628100000015',
    price: 22,
    cost: 13.5,
    stock: 7,
    lowStock: 4,
    art: 'detergent'
  }
];

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function weightedPick(random, list) {
  const roll = random();
  let cursor = 0;
  for (const [value, weight] of list) {
    cursor += weight;
    if (roll <= cursor) return value;
  }
  return list[0][0];
}

export function createSeedState({ now = new Date() } = {}) {
  const seededAt = new Date(now).toISOString();
  const products = productBlueprint.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    barcode: makeEan13(item.base),
    price: item.price,
    cost: item.cost,
    stock: item.stock,
    lowStock: item.lowStock,
    art: item.art,
    image: null,
    createdAt: seededAt,
    updatedAt: seededAt
  }));

  const random = seededRandom(0x51a7c0de);
  const invoices = [];
  const cashiers = ['سالم', 'نورة', 'فهد'];
  const popularPool = [
    products[1],
    products[3],
    products[4],
    products[5],
    products[0],
    products[10],
    products[7],
    products[2],
    products[9],
    products[12],
    products[6],
    products[14],
    products[8],
    products[11],
    products[13]
  ];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = addDays(startOfDay(now), -offset);
    const invoiceCount = 2 + Math.floor(random() * 4);
    for (let invoiceIndex = 0; invoiceIndex < invoiceCount; invoiceIndex += 1) {
      let invoiceDate;
      if (offset === 0) {
        const minutesAgo = 18 + (invoiceIndex + 1) * (35 + Math.floor(random() * 55));
        invoiceDate = new Date(now.getTime() - minutesAgo * 60000);
        if (day.getTime() !== startOfDay(invoiceDate).getTime()) {
          invoiceDate = new Date(now.getTime() - (invoiceIndex + 1) * 8 * 60000);
        }
      } else {
        invoiceDate = new Date(day);
        invoiceDate.setHours(9 + Math.floor(random() * 11), Math.floor(random() * 60), 0, 0);
      }

      const lineCount = 1 + Math.floor(random() * 4);
      const chosen = new Set();
      const cartItems = [];
      while (cartItems.length < lineCount) {
        const product = pick(random, [...popularPool, ...popularPool.slice(0, 5)]);
        if (chosen.has(product.id)) continue;
        chosen.add(product.id);
        const quantity = 1 + Math.floor(random() * (product.price > 40 ? 2 : 3));
        cartItems.push({
          product,
          quantity,
          lineTotal: roundMoney(product.price * quantity)
        });
      }

      const useDiscount = random() > 0.82;
      const discount = useDiscount
        ? random() > 0.5
          ? { type: 'percent', value: 5 }
          : { type: 'amount', value: 2 }
        : { type: 'amount', value: 0 };
      const method = weightedPick(random, [
        ['cash', 0.47],
        ['card', 0.39],
        ['wallet', 0.14]
      ]);
      const provisional = buildInvoice({
        number: '1000',
        cartItems,
        discount,
        settings: DEFAULT_SETTINGS,
        paymentMethod: method,
        cashReceived: method === 'cash' ? 1000 : null,
        cashierName: pick(random, cashiers),
        date: invoiceDate
      });

      if (method === 'cash') {
        provisional.cashReceived = Math.ceil(provisional.total / 5) * 5;
        provisional.change = roundMoney(provisional.cashReceived - provisional.total);
      }
      invoices.push(provisional);
    }
  }

  invoices.sort((a, b) => new Date(a.date) - new Date(b.date));
  invoices.forEach((invoice, index) => {
    invoice.number = String(1001 + index);
    invoice.id = `seed_inv_${invoice.number}`;
  });

  const sortedInvoices = invoices.slice().reverse();
  const latestNumber = 1000 + invoices.length;

  return {
    version: 1,
    createdAt: seededAt,
    updatedAt: seededAt,
    settings: { ...DEFAULT_SETTINGS },
    products,
    invoices: sortedInvoices,
    cart: { items: [], discount: { type: 'amount', value: 0 } },
    counters: { invoice: latestNumber },
    meta: {
      isDemo: true,
      lastSaleAt: sortedInvoices[0]?.date || null
    }
  };
}

export { productBlueprint };
