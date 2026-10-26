import { addDays, dayKey, formatDay, formatShortDate, parseDate, roundMoney, startOfDay } from './util.js';
import { PAYMENT_LABELS } from './constants.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const URGENCY_ORDER = { out: 0, critical: 1, watch: 2 };
const MIN_HISTORY_INVOICES = 3;

function activityWindow(invoices, days, now) {
  const windowInvoices = invoicesInLastDays(invoices, days, now);
  if (!windowInvoices.length) return { invoices: [], windowDays: 0 };
  const today = startOfDay(now);
  let earliest = today;
  for (const invoice of windowInvoices) {
    const date = startOfDay(parseDate(invoice.date));
    if (date < earliest) earliest = date;
  }
  const elapsed = Math.max(1, Math.round((today.getTime() - earliest.getTime()) / DAY_MS) + 1);
  return { invoices: windowInvoices, windowDays: Math.min(days, elapsed) };
}

function lineKey(item) {
  return String(item?.productId || item?.barcode || item?.name || '').trim();
}

function lineMeta(item, fallbackKey) {
  return {
    productId: String(item?.productId || fallbackKey),
    name: String(item?.name || 'منتج'),
    category: String(item?.category || 'غير مصنف'),
    art: String(item?.art || 'pantry'),
    image: typeof item?.image === 'string' ? item.image : null
  };
}

export function stockPulse(invoices = [], products = [], {
  days = 14,
  targetDays = 14,
  now = new Date(),
  minInvoices = MIN_HISTORY_INVOICES,
  minUnits = 2
} = {}) {
  const { invoices: windowInvoices, windowDays } = activityWindow(invoices, days, now);
  const units = new Map();
  const orders = new Map();

  for (const invoice of windowInvoices) {
    const seen = new Set();
    for (const item of invoice.items || []) {
      const key = String(item?.productId || '');
      if (!key) continue;
      const quantity = Math.max(0, Number(item.quantity) || 0);
      units.set(key, (units.get(key) || 0) + quantity);
      if (!seen.has(key)) {
        orders.set(key, (orders.get(key) || 0) + 1);
        seen.add(key);
      }
    }
  }

  const historyEnough = windowInvoices.length >= minInvoices;
  const items = products.map((product) => {
    const key = String(product.id);
    const stock = Math.max(0, Number(product.stock) || 0);
    const sold = roundMoney(units.get(key) || 0);
    const orderCount = orders.get(key) || 0;
    const hasSignal = historyEnough && sold >= minUnits;
    const dailyVelocity = hasSignal && windowDays > 0 ? roundMoney(sold / windowDays) : 0;
    const coverageDays = !hasSignal
      ? null
      : stock <= 0
        ? 0
        : dailyVelocity > 0
          ? Math.round((stock / dailyVelocity) * 10) / 10
          : null;
    const targetStock = hasSignal ? Math.ceil(dailyVelocity * targetDays) : 0;
    const suggestedRestock = hasSignal ? Math.max(0, Math.ceil(targetStock - stock)) : 0;
    let urgency = 'quiet';
    if (stock <= 0) urgency = 'out';
    else if (hasSignal && coverageDays <= 3) urgency = 'critical';
    else if (hasSignal && coverageDays <= 7) urgency = 'watch';
    else if (hasSignal) urgency = 'stable';

    return {
      product,
      productId: key,
      stock,
      sold,
      orders: orderCount,
      hasSignal,
      confidence: hasSignal ? 'good' : sold > 0 ? 'thin' : 'none',
      dailyVelocity,
      coverageDays,
      targetStock,
      targetDays,
      suggestedRestock,
      urgency
    };
  });

  const urgent = items
    .filter((item) => item.urgency in URGENCY_ORDER)
    .sort(
      (a, b) =>
        URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
        a.coverageDays - b.coverageDays ||
        b.sold - a.sold ||
        a.product.name.localeCompare(b.product.name, 'ar')
    );

  const tracked = items.filter((item) => item.hasSignal && item.coverageDays !== null);
  const fastest =
    urgent[0] ||
    tracked
      .slice()
      .sort(
        (a, b) =>
          a.coverageDays - b.coverageDays ||
          b.sold - a.sold ||
          a.product.name.localeCompare(b.product.name, 'ar')
      )[0] ||
    null;

  const categories = new Map();
  for (const item of urgent) {
    const name = item.product.category || 'غير مصنف';
    const entry = categories.get(name) || { name, count: 0, suggestedUnits: 0 };
    entry.count += 1;
    entry.suggestedUnits += item.suggestedRestock;
    categories.set(name, entry);
  }
  const focusCategory =
    [...categories.values()].sort(
      (a, b) =>
        b.count - a.count ||
        b.suggestedUnits - a.suggestedUnits ||
        a.name.localeCompare(b.name, 'ar')
    )[0] || null;

  return {
    windowDays,
    targetDays,
    invoiceCount: windowInvoices.length,
    historyEnough,
    minInvoices,
    items,
    urgent,
    tracked: tracked.length,
    fastest,
    focusCategory,
    suggestedUnits: items.reduce((sum, item) => sum + item.suggestedRestock, 0)
  };
}

export function purchasePairInsights(invoices = [], {
  days = 30,
  now = new Date(),
  limit = 5,
  minSupport = 2
} = {}) {
  const { invoices: windowInvoices, windowDays } = activityWindow(invoices, days, now);
  const pairs = new Map();

  for (const invoice of windowInvoices) {
    const unique = new Map();
    for (const item of invoice.items || []) {
      const key = lineKey(item);
      if (!key || unique.has(key)) continue;
      unique.set(key, lineMeta(item, key));
    }
    const entries = [...unique.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (let first = 0; first < entries.length; first += 1) {
      for (let second = first + 1; second < entries.length; second += 1) {
        const [firstKey, firstMeta] = entries[first];
        const [secondKey, secondMeta] = entries[second];
        const key = `${firstKey}::${secondKey}`;
        const entry = pairs.get(key) || {
          key,
          productIds: [firstKey, secondKey],
          products: [firstMeta, secondMeta],
          count: 0
        };
        entry.count += 1;
        pairs.set(key, entry);
      }
    }
  }

  const result = [...pairs.values()]
    .filter((pair) => pair.count >= minSupport)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);

  return {
    windowDays,
    invoiceCount: windowInvoices.length,
    pairs: result
  };
}

export function cartCompanions(invoices = [], products = [], cartProductIds = [], {
  days = 30,
  now = new Date(),
  limit = 3,
  minSupport = 2,
  minInvoices = MIN_HISTORY_INVOICES
} = {}) {
  const cartIds = new Set((cartProductIds || []).map((id) => String(id)).filter(Boolean));
  if (!cartIds.size || !products.length) {
    return { mode: 'none', suggestions: [], windowDays: 0, invoiceCount: 0, historyEnough: false };
  }

  const productMap = new Map(products.map((product) => [String(product.id), product]));
  const { invoices: windowInvoices, windowDays } = activityWindow(invoices, days, now);
  const invoiceCount = windowInvoices.length;
  const historyEnough = invoiceCount >= minInvoices;
  const coPurchases = new Map();

  for (const invoice of windowInvoices) {
    const unique = new Map();
    for (const item of invoice.items || []) {
      const key = lineKey(item);
      if (!key || unique.has(key)) continue;
      unique.set(key, item);
    }
    const ids = [...unique.keys()];
    if (!ids.some((id) => cartIds.has(id))) continue;
    for (const id of ids) {
      if (cartIds.has(id)) continue;
      coPurchases.set(id, (coPurchases.get(id) || 0) + 1);
    }
  }

  const paired = [];
  for (const [id, support] of coPurchases) {
    const product = productMap.get(id);
    if (!product || Number(product.stock) <= 0 || support < minSupport) continue;
    paired.push({ product, support, source: 'pair', categoryMatch: false });
  }
  paired.sort(
    (a, b) =>
      b.support - a.support ||
      a.product.name.localeCompare(b.product.name, 'ar')
  );

  if (paired.length) {
    return {
      mode: 'pair',
      suggestions: paired.slice(0, limit),
      windowDays,
      invoiceCount,
      historyEnough
    };
  }

  if (!historyEnough) {
    return { mode: 'none', suggestions: [], windowDays, invoiceCount, historyEnough };
  }

  const units = new Map();
  for (const invoice of windowInvoices) {
    for (const item of invoice.items || []) {
      const key = lineKey(item);
      if (!key) continue;
      units.set(key, (units.get(key) || 0) + Math.max(0, Number(item.quantity) || 0));
    }
  }

  const cartCategories = new Set(
    [...cartIds]
      .map((id) => productMap.get(id)?.category)
      .filter(Boolean)
  );
  const candidates = products
    .map((product) => ({
      product,
      units: units.get(String(product.id)) || 0,
      categoryMatch: cartCategories.has(product.category)
    }))
    .filter(
      (entry) =>
        !cartIds.has(String(entry.product.id)) &&
        Number(entry.product.stock) > 0 &&
        entry.units > 0
    );
  const preferred = candidates.filter((entry) => entry.categoryMatch);
  const pool = (preferred.length ? preferred : candidates)
    .sort(
      (a, b) =>
        b.units - a.units ||
        a.product.name.localeCompare(b.product.name, 'ar')
    )
    .slice(0, limit);

  return {
    mode: pool.length ? 'bestseller' : 'none',
    suggestions: pool.map((entry) => ({
      product: entry.product,
      support: entry.units,
      source: 'bestseller',
      categoryMatch: entry.categoryMatch
    })),
    windowDays,
    invoiceCount,
    historyEnough
  };
}

export function invoicesInLastDays(invoices, days, now = new Date(), offsetPeriods = 0) {
  const today = startOfDay(now);
  const end = addDays(today, 1 - offsetPeriods * days);
  const start = addDays(today, 1 - days - offsetPeriods * days);
  return invoices.filter((invoice) => {
    const date = parseDate(invoice.date);
    return date >= start && date < end;
  });
}

export function summarize(invoices, products = []) {
  const total = roundMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0));
  const count = invoices.length;
  const units = invoices.reduce(
    (sum, invoice) =>
      sum +
      (invoice.items || []).reduce((lineSum, item) => lineSum + Number(item.quantity || 0), 0),
    0
  );
  const estimatedProfit = roundMoney(
    invoices.reduce(
      (sum, invoice) =>
        sum +
        (invoice.items || []).reduce(
          (lineSum, item) =>
            lineSum + Math.max(0, Number(item.unitPrice || 0) - Number(item.unitCost || 0)) * Number(item.quantity || 0),
          0
        ),
      0
    )
  );
  return {
    total,
    count,
    units,
    average: count ? roundMoney(total / count) : 0,
    estimatedProfit,
    lowStock: products.filter((product) => product.stock > 0 && product.stock <= product.lowStock).length,
    outOfStock: products.filter((product) => product.stock <= 0).length
  };
}

export function rangeSummary(invoices, products, days, now = new Date()) {
  const currentInvoices = invoicesInLastDays(invoices, days, now);
  const previousInvoices = invoicesInLastDays(invoices, days, now, 1);
  const current = summarize(currentInvoices, products);
  const previous = summarize(previousInvoices, products);
  const delta = (key) => {
    if (!previous[key]) return null;
    return roundMoney(((current[key] - previous[key]) / previous[key]) * 100);
  };
  return {
    current,
    previous,
    delta: {
      total: delta('total'),
      count: delta('count'),
      average: delta('average'),
      units: delta('units')
    },
    invoices: currentInvoices
  };
}

export function salesByDay(invoices, days, now = new Date()) {
  const today = startOfDay(now);
  const buckets = new Map();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    buckets.set(dayKey(date), {
      date,
      key: dayKey(date),
      label: formatDay(date),
      short: formatShortDate(date),
      total: 0,
      count: 0
    });
  }
  for (const invoice of invoices) {
    const date = parseDate(invoice.date);
    const bucket = buckets.get(dayKey(date));
    if (!bucket) continue;
    bucket.total = roundMoney(bucket.total + Number(invoice.total || 0));
    bucket.count += 1;
  }
  return [...buckets.values()];
}

export function topProducts(invoices, limit = 5) {
  const grouped = new Map();
  for (const invoice of invoices) {
    for (const item of invoice.items || []) {
      const key = item.productId || item.barcode || item.name;
      const previous = grouped.get(key) || {
        productId: item.productId,
        name: item.name,
        category: item.category,
        art: item.art,
        image: item.image,
        quantity: 0,
        revenue: 0
      };
      previous.quantity += Number(item.quantity || 0);
      previous.revenue = roundMoney(previous.revenue + Number(item.lineTotal || 0));
      grouped.set(key, previous);
    }
  }
  return [...grouped.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function categoryBreakdown(invoices, limit = 5) {
  const grouped = new Map();
  for (const invoice of invoices) {
    for (const item of invoice.items || []) {
      const key = item.category || 'أخرى';
      grouped.set(key, roundMoney((grouped.get(key) || 0) + Number(item.lineTotal || 0)));
    }
  }
  const sorted = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  const leading = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((sum, [, value]) => sum + value, 0);
  if (rest > 0) leading.push(['فئات أخرى', roundMoney(rest)]);
  const total = leading.reduce((sum, [, value]) => sum + value, 0);
  return leading.map(([name, value]) => ({
    name,
    value,
    share: total ? roundMoney((value / total) * 100) : 0
  }));
}

export function paymentBreakdown(invoices) {
  const output = { cash: { count: 0, total: 0 }, card: { count: 0, total: 0 }, wallet: { count: 0, total: 0 } };
  for (const invoice of invoices) {
    const key = invoice.paymentMethod in output ? invoice.paymentMethod : 'card';
    output[key].count += 1;
    output[key].total = roundMoney(output[key].total + Number(invoice.total || 0));
  }
  const total = roundMoney(Object.values(output).reduce((sum, entry) => sum + entry.total, 0));
  return Object.entries(output).map(([id, entry]) => ({
    id,
    label: PAYMENT_LABELS[id],
    ...entry,
    share: total ? roundMoney((entry.total / total) * 100) : 0
  }));
}

export function bestSalesDay(invoices, days, now = new Date()) {
  const series = salesByDay(invoices, days, now);
  return series.reduce((best, item) => (item.total > (best?.total || 0) ? item : best), null);
}

export function profitMargin(invoices) {
  const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const cost = invoices.reduce(
    (sum, invoice) =>
      sum +
      (invoice.items || []).reduce(
        (inner, item) => inner + Number(item.unitCost || 0) * Number(item.quantity || 0),
        0
      ),
    0
  );
  if (!revenue) return 0;
  return roundMoney(((revenue - cost) / revenue) * 100);
}
