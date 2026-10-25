import { addDays, dayKey, formatDay, formatShortDate, parseDate, roundMoney, startOfDay } from './util.js';
import { PAYMENT_LABELS } from './constants.js';

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
