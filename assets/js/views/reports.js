import {
  bestSalesDay,
  categoryBreakdown,
  paymentBreakdown,
  profitMargin,
  purchasePairInsights,
  rangeSummary,
  salesByDay,
  stockPulse,
  topProducts
} from '../analytics.js';
import {
  deltaBadge,
  productVisual,
  renderPageLead,
  stockState
} from '../components.js';
import { REPORT_RANGES } from '../constants.js';
import { icon } from '../icons.js';
import {
  escapeAttr,
  escapeHtml,
  formatDate,
  formatDaySpan,
  formatInvoiceCount,
  formatMoney,
  formatNumber
} from '../util.js';

function renderMetric({ label, value, foot, delta = undefined, featured = false, extra = '' }) {
  return `
    <article class="metric-card ${featured ? 'metric-card--featured' : ''}">
      <div class="metric-top">
        <span class="metric-label">${escapeHtml(label)}</span>
        ${delta !== undefined ? deltaBadge(delta) : ''}
      </div>
      <strong class="metric-value num">${escapeHtml(value)}</strong>
      <span class="metric-foot">${foot}${extra}</span>
    </article>
  `;
}

function renderChart(series, settings, days) {
  const max = Math.max(...series.map((day) => day.total), 1);
  const total = series.reduce((sum, day) => sum + day.total, 0);
  const count = series.reduce((sum, day) => sum + day.count, 0);
  const best = series.reduce((top, day) => (day.total > (top?.total || 0) ? day : top), null);
  const todayKey = series[series.length - 1]?.key;
  return `
    <article class="report-card report-card--chart">
      <header class="report-card-head">
        <div>
          <span class="eyebrow">إيقاع الأيام</span>
          <h2>المبيعات يوماً بيوم</h2>
          <p>آخر ${escapeHtml(formatNumber(days))} ${days === 7 ? 'أيام' : 'يوماً'} · ${escapeHtml(formatNumber(count))} فاتورة</p>
        </div>
        <div class="chart-peak">
          <span>أعلى يوم</span>
          <strong class="num">${best ? escapeHtml(formatMoney(best.total, settings.currency)) : '—'}</strong>
          <small>${best ? escapeHtml(`${best.label} ${best.short}`) : 'لا مبيعات بعد'}</small>
        </div>
      </header>

      <div class="sales-chart-scroll">
        <div class="sales-chart" style="--bars:${series.length}" role="img" aria-label="رسم أعمدة لمبيعات آخر ${escapeAttr(formatNumber(days))} يوم">
          ${series
            .map((day, index) => {
              const height = day.total > 0 ? Math.max(4, Math.round((day.total / max) * 100)) : 1.5;
              const showLabel = days <= 7 || index === 0 || index === series.length - 1 || index % 5 === 0;
              return `
                <div class="chart-column ${day.key === todayKey ? 'is-today' : ''}" title="${escapeAttr(`${day.label} ${day.short} — ${formatMoney(day.total, settings.currency)} — ${day.count} فاتورة`)}">
                  <div class="chart-bar-space">
                    <span class="chart-hover-value num">${escapeHtml(formatNumber(day.total))}</span>
                    <div class="chart-bar" style="--h:${height}%"></div>
                  </div>
                  <span class="chart-day ${showLabel ? '' : 'is-hidden'}">${escapeHtml(days <= 7 ? day.label : day.short.split(' ')[0])}</span>
                  <span class="chart-date ${showLabel ? '' : 'is-hidden'}">${escapeHtml(day.short)}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <figcaption class="chart-foot">
        <span class="chart-total"><strong class="num">${escapeHtml(formatMoney(total, settings.currency))}</strong> إجمالي الفترة</span>
        <span class="chart-legend"><i aria-hidden="true"></i> مبيعات اليوم <i class="is-past" aria-hidden="true"></i> أيام سابقة</span>
      </figcaption>

      <details class="chart-data">
        <summary>الأرقام كاملة</summary>
        <div class="chart-table-wrap">
          <table class="chart-table">
            <thead><tr><th>اليوم</th><th>الفواتير</th><th>المبيعات</th></tr></thead>
            <tbody>
              ${series
                .map(
                  (day) => `<tr><td>${escapeHtml(`${day.label} ${day.short}`)}</td><td class="num">${escapeHtml(formatNumber(day.count))}</td><td class="num">${escapeHtml(formatMoney(day.total, settings.currency))}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  `;
}

function renderBestDay(best, settings, days) {
  if (!best) {
    return `
      <article class="best-day best-day--empty">
        <span class="eyebrow">أفضل يوم</span>
        <p>لم تُسجّل مبيعات في هذه الفترة بعد. أول فاتورة سترسم أول عمود.</p>
        <a href="#pos" class="text-btn">ابدأ بيعاً ${icon('arrowLeft', { size: 14 })}</a>
      </article>
    `;
  }
  return `
    <article class="best-day">
      <span class="eyebrow">أفضل يوم</span>
      <div class="best-day-main">
        <strong class="num">${escapeHtml(formatMoney(best.total, settings.currency))}</strong>
        <span>${escapeHtml(`${best.label} ${best.short}`)}</span>
      </div>
      <div class="best-day-foot">
        <span>${icon('receipt', { size: 15 })} ${escapeHtml(formatNumber(best.count))} فاتورة</span>
        <span>من أصل ${escapeHtml(formatNumber(days))} ${days === 7 ? 'أيام' : 'يوماً'}</span>
      </div>
      <span class="best-day-stamp" aria-hidden="true">ذروة<br>الفترة</span>
    </article>
  `;
}

function renderPayments(payments, settings) {
  const total = payments.reduce((sum, entry) => sum + entry.total, 0);
  return `
    <article class="report-card report-card--payments">
      <header class="report-card-head report-card-head--compact">
        <div>
          <span class="eyebrow">الصندوق</span>
          <h2>أين ذهبت الفلوس؟</h2>
        </div>
        <span class="payment-total num">${escapeHtml(formatMoney(total, settings.currency))}</span>
      </header>
      <div class="payment-stack" aria-hidden="true">
        ${payments
          .map(
            (entry) =>
              `<span class="payment-stack-seg payment-stack-seg--${escapeAttr(entry.id)}" style="inline-size:${Math.max(0, entry.share)}%"></span>`
          )
          .join('')}
      </div>
      <ul class="payment-legend">
        ${payments
          .map(
            (entry) => `
              <li>
                <i class="payment-dot payment-dot--${escapeAttr(entry.id)}" aria-hidden="true"></i>
                <span class="payment-name">${escapeHtml(entry.label)}</span>
                <span class="payment-share num">${escapeHtml(formatNumber(entry.share))}٪</span>
                <strong class="num">${escapeHtml(formatMoney(entry.total, settings.currency))}</strong>
              </li>
            `
          )
          .join('')}
      </ul>
      <p class="report-note">النقدي والمدى والمحفظة موزّعة على ${escapeHtml(formatNumber(payments.reduce((sum, entry) => sum + entry.count, 0)))} فاتورة.</p>
    </article>
  `;
}

function renderTopProducts(products, settings) {
  const max = Math.max(...products.map((product) => product.revenue), 1);
  return `
    <article class="report-card">
      <header class="report-card-head report-card-head--compact">
        <div>
          <span class="eyebrow">أكثر ما خرج من الرف</span>
          <h2>أبطال الفترة</h2>
        </div>
      </header>
      ${
        products.length
          ? `<ol class="top-products">
              ${products
                .map(
                  (product, index) => `
                    <li class="top-product">
                      <span class="top-rank mono">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
                      ${productVisual({ art: product.art, image: product.image, name: product.name }, { className: 'top-art' })}
                      <div class="top-copy">
                        <strong>${escapeHtml(product.name)}</strong>
                        <span>${escapeHtml(product.category)} · ${escapeHtml(formatNumber(product.quantity))} قطعة</span>
                        <span class="top-track" aria-hidden="true"><span style="inline-size:${Math.round((product.revenue / max) * 100)}%"></span></span>
                      </div>
                      <span class="top-revenue num">${escapeHtml(formatMoney(product.revenue, settings.currency))}</span>
                    </li>
                  `
                )
                .join('')}
            </ol>`
          : `<div class="mini-empty">${icon('bag', { size: 22 })}<p>لا أصناف مباعة في هذه الفترة بعد.</p></div>`
      }
    </article>
  `;
}

function renderCategories(categories, settings) {
  return `
    <article class="report-card">
      <header class="report-card-head report-card-head--compact">
        <div>
          <span class="eyebrow">توزيع الرف</span>
          <h2>الفئات الأكثر مبيعاً</h2>
        </div>
      </header>
      ${
        categories.length
          ? `<div class="category-breakdown">
              ${categories
                .map(
                  (category, index) => `
                    <div class="category-line">
                      <div class="category-line-head">
                        <span class="category-name"><i aria-hidden="true"></i>${escapeHtml(category.name)}</span>
                        <span class="category-value num">${escapeHtml(formatNumber(category.share))}٪ <small>· ${escapeHtml(formatMoney(category.value, settings.currency))}</small></span>
                      </div>
                      <span class="category-bar" aria-hidden="true"><span style="inline-size:${Math.max(2, category.share)}%;--delay:${index * 60}ms"></span></span>
                    </div>
                  `
                )
                .join('')}
            </div>`
          : `<div class="mini-empty">${icon('chart', { size: 22 })}<p>لا توزيع فئات حتى الآن.</p></div>`
      }
    </article>
  `;
}

function renderStorePulse(stock, pairInsights) {
  if (!stock.invoiceCount) return '';

  if (!stock.historyEnough) {
    return `
      <aside class="store-pulse store-pulse--learning" aria-label="نبض المتجر — يتشكل من فواتيرك">
        <span class="store-pulse-icon">${icon('clock', { size: 21 })}</span>
        <div class="store-pulse-learning-copy">
          <span class="eyebrow">نبض المتجر · يتشكل</span>
          <h2>القراءة تحتاج ${formatNumber(stock.minInvoices)} فواتير</h2>
          <p>لديك ${formatNumber(stock.invoiceCount)} حتى الآن. بعدها سأربط نفاد الرف بسرعة البيع وأكشف الأصناف التي تُشترى معاً.</p>
        </div>
      </aside>
    `;
  }

  const fastest = stock.fastest;
  const pair = pairInsights.pairs[0] || null;
  const focus = stock.focusCategory;
  const fastestValue = fastest ? fastest.product.name : 'لا صنف متتبع';
  const fastestNote = !fastest
    ? 'أحتاج حركة بيع أوضح'
    : fastest.urgency === 'out'
      ? fastest.suggestedRestock > 0
        ? `نفد · اقترحنا ${formatNumber(fastest.suggestedRestock)} قطعة`
        : 'نفد ويحتاج كمية يدوية'
      : `يكفي ${fastest.coverageDays > 60 ? 'أكثر من شهرين' : formatDaySpan(fastest.coverageDays)}${fastest.suggestedRestock > 0 ? ` · اقتراح ${formatNumber(fastest.suggestedRestock)}` : ''}`;
  const pairValue = pair
    ? `${pair.products[0].name} + ${pair.products[1].name}`
    : 'لا ثنائي واضح بعد';
  const pairNote = pair
    ? `ظهرا معاً في ${formatInvoiceCount(pair.count)}`
    : 'تحتاج فواتير أكثر';
  const focusNote = focus
    ? `${focus.count === 1 ? 'صنف واحد' : `${formatNumber(focus.count)} أصناف`} · ${formatNumber(focus.suggestedUnits)} قطعة مقترحة`
    : 'كل الفئات تحت السيطرة';

  return `
    <aside class="store-pulse" aria-label="نبض المتجر — قراءة محلية من الفواتير">
      <div class="store-pulse-lead">
        <span class="eyebrow">نبض المتجر · من دفترك</span>
        <h2>ما تقوله فواتيرك الآن</h2>
        <p>قراءة محلية من ${formatInvoiceCount(stock.invoiceCount)} خلال ${formatDaySpan(stock.windowDays)}. لا خدمات خارجية.</p>
        <a class="text-btn" href="#inventory">إلى دفتر المخزون ${icon('arrowLeft', { size: 14 })}</a>
      </div>
      <div class="store-pulse-facts">
        <div class="pulse-fact">
          <span class="pulse-fact-label">${icon('clock', { size: 13 })} الأقرب للنفاد</span>
          <strong>${escapeHtml(fastestValue)}</strong>
          <span class="pulse-fact-note">${escapeHtml(fastestNote)}</span>
        </div>
        <div class="pulse-fact">
          <span class="pulse-fact-label">${icon('bag', { size: 13 })} الأكثر شراءً معاً</span>
          <strong>${escapeHtml(pairValue)}</strong>
          <span class="pulse-fact-note">${escapeHtml(pairNote)}</span>
        </div>
        <div class="pulse-fact">
          <span class="pulse-fact-label">${icon('package', { size: 13 })} الفئة الأولى بالتزويد</span>
          <strong>${escapeHtml(focus ? focus.name : 'لا تزويد عاجل')}</strong>
          <span class="pulse-fact-note">${escapeHtml(focusNote)}</span>
        </div>
      </div>
    </aside>
  `;
}

function renderStockWatch(products) {
  const attention = products
    .filter((product) => product.stock <= product.lowStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 4);
  if (!attention.length) {
    return `
      <div class="stock-watch stock-watch--clear">
        <span class="stock-watch-icon">${icon('checkCircle', { size: 22 })}</span>
        <div><strong>كل الرفوف فوق حد التنبيه</strong><p>لا حاجة لتزويد عاجل اليوم.</p></div>
        <a class="text-btn" href="#inventory">إلى المخزون ${icon('arrowLeft', { size: 14 })}</a>
      </div>
    `;
  }
  return `
    <div class="stock-watch">
      <div class="stock-watch-copy">
        <span class="eyebrow">قبل أن ينفد</span>
        <h2>${escapeHtml(formatNumber(attention.length))} ${attention.length === 1 ? 'صنف يحتاج' : 'أصناف تحتاج'} تزويداً</h2>
        <a class="text-btn" href="#inventory">راجع المخزون ${icon('arrowLeft', { size: 14 })}</a>
      </div>
      <div class="stock-watch-items">
        ${attention
          .map((product) => {
            const state = stockState(product);
            return `
              <span class="stock-watch-chip ${state.tone === 'danger' ? 'is-danger' : ''}">
                ${productVisual(product, { className: 'stock-watch-art' })}
                <span><strong>${escapeHtml(product.name)}</strong><small>${state.key === 'out' ? 'نفد' : `بقي ${formatNumber(product.stock)}`}</small></span>
              </span>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

export function renderReports(state, ui = {}) {
  const settings = state.settings;
  const days = Number(ui.reportDays) === 30 ? 30 : 7;
  const summary = rangeSummary(state.invoices, state.products, days);
  const invoices = summary.invoices;
  const series = salesByDay(state.invoices, days);
  const products = topProducts(invoices, 5);
  const categories = categoryBreakdown(invoices, 5);
  const payments = paymentBreakdown(invoices);
  const best = bestSalesDay(state.invoices, days);
  const margin = profitMargin(invoices);
  const stock = stockPulse(state.invoices, state.products);
  const pairInsights = purchasePairInsights(state.invoices, { limit: 3 });
  const rangeLabel = days === 7 ? '7 أيام' : '30 يوماً';
  const lead = renderPageLead({
    eyebrow: `دفتر الأرقام · آخر ${formatNumber(days)} ${days === 7 ? 'أيام' : 'يوماً'}`,
    title: 'اقرأ يومك من الأرقام',
    description: 'مبيعات، هوامش، وحركة أصناف خلال الفترة المختارة — كلها من بيانات هذا المتصفح.',
    action: `
      <div class="page-actions">
        <div class="segmented" role="group" aria-label="مدة التقرير">
          ${REPORT_RANGES.map(
            (range) => `
              <button type="button" class="segmented-btn ${days === range.days ? 'is-active' : ''}" data-action="set-report-range" data-days="${range.days}" aria-pressed="${days === range.days}">${escapeHtml(range.label)}</button>
            `
          ).join('')}
        </div>
        <button type="button" class="btn btn--ghost" data-action="export-report">${icon('download', { size: 17 })} تصدير CSV</button>
      </div>
    `
  });

  return `
    <section class="page page--reports" data-page="reports">
      ${lead}

      <div class="report-metrics">
        ${renderMetric({
          label: 'إجمالي المبيعات',
          value: formatMoney(summary.current.total, settings.currency),
          foot: `<span class="metric-note">مقارنة بالفترة السابقة</span>`,
          delta: summary.delta.total,
          featured: true
        })}
        ${renderMetric({
          label: 'عدد الفواتير',
          value: `${formatNumber(summary.current.count)} فاتورة`,
          foot: `<span class="metric-note">آخر ${escapeHtml(rangeLabel)}</span>`,
          delta: summary.delta.count
        })}
        ${renderMetric({
          label: 'متوسط الفاتورة',
          value: formatMoney(summary.current.average, settings.currency),
          foot: `<span class="metric-note">${escapeHtml(formatNumber(summary.current.units))} قطعة خرجت</span>`,
          delta: summary.delta.average
        })}
        ${renderMetric({
          label: 'ربح تقديري',
          value: formatMoney(summary.current.estimatedProfit, settings.currency),
          foot: `<span class="metric-note">هامش ${escapeHtml(formatNumber(margin))}٪ على المبيعات</span>`
        })}
      </div>

      ${renderStorePulse(stock, pairInsights)}

      ${
        !invoices.length
          ? `<div class="report-empty">
              ${icon('chart', { size: 26 })}
              <div><strong>لا مبيعات في آخر ${escapeHtml(rangeLabel)}.</strong><p>وسّع الفترة أو أنشئ أول فاتورة لتبدأ الأرقام بالتحرك.</p></div>
              <div class="report-empty-actions">
                <button type="button" class="btn btn--ghost btn--small" data-action="set-report-range" data-days="${days === 7 ? 30 : 7}">غيّر الفترة</button>
                <a class="btn btn--primary btn--small" href="#pos">بيع جديد</a>
              </div>
            </div>`
          : ''
      }

      <div class="report-layout">
        ${renderChart(series, settings, days)}
        <div class="report-aside">
          ${renderBestDay(best, settings, days)}
          ${renderPayments(payments, settings)}
        </div>
        ${renderTopProducts(products, settings)}
        ${renderCategories(categories, settings)}
      </div>

      ${renderStockWatch(state.products)}

      <footer class="report-foot-note">
        <span>${icon('info', { size: 14 })} الهامش تقديري اعتماداً على تكلفة الشراء المسجلة، ولا يشمل المصاريف التشغيلية.</span>
        <span>تُحدَّث الأرقام تلقائياً بعد كل فاتورة · ${escapeHtml(formatDate(new Date()))}</span>
      </footer>
    </section>
  `;
}
