import { stockPulse } from '../analytics.js';
import { ean13Svg } from '../ean.js';
import { icon } from '../icons.js';
import {
  formatPrice,
  productVisual,
  renderPageLead,
  stockPill,
  stockState
} from '../components.js';
import {
  escapeAttr,
  escapeHtml,
  formatDaySpan,
  formatInvoiceCount,
  formatMoney,
  formatNumber,
  normalizeSearch,
  roundMoney
} from '../util.js';

const FILTERS = [
  { id: 'all', label: 'كل الأصناف' },
  { id: 'low', label: 'مخزون منخفض' },
  { id: 'out', label: 'نفد' }
];

function matchesSearch(product, query) {
  if (!query) return true;
  const text = normalizeSearch(query);
  const digits = String(query).replace(/\D/g, '');
  return (
    [product.name, product.category, product.barcode].some((value) =>
      normalizeSearch(value).includes(text)
    ) || (digits.length > 1 && product.barcode.includes(digits))
  );
}

function matchesFilter(product, filter) {
  if (filter === 'low') return product.stock > 0 && product.stock <= product.lowStock;
  if (filter === 'out') return product.stock <= 0;
  return true;
}

function marginOf(product) {
  if (!product.price) return null;
  return roundMoney(((product.price - product.cost) / product.price) * 100);
}

function stockMeter(product) {
  const reference = Math.max(20, product.lowStock * 5, product.stock);
  const ratio = Math.min(1, product.stock / reference);
  const state = stockState(product);
  return `
    <span class="stock-meter stock-meter--${state.tone}" aria-hidden="true">
      <span style="inline-size:${Math.max(4, ratio * 100)}%"></span>
    </span>
  `;
}

function coverageLabel(item) {
  if (item.urgency === 'out') return 'نفد من الرف';
  if (item.coverageDays === null) return 'حركة بطيئة';
  if (item.coverageDays < 1) return 'أقل من يوم';
  if (item.coverageDays > 60) return 'أكثر من شهرين';
  return `يكفي ${formatDaySpan(item.coverageDays)}`;
}

function renderCoverage(item, windowDays) {
  if (!item) return '';
  if (!item.hasSignal) {
    if (item.stock <= 0) return '';
    return `<span class="stock-status-note">${item.sold > 0 ? 'بيانات قليلة' : 'بلا حركة حديثة'}</span>`;
  }
  const tone =
    item.urgency === 'out' || item.urgency === 'critical'
      ? 'danger'
      : item.urgency === 'watch'
        ? 'warning'
        : 'calm';
  const tooltip = `محسوب من ${formatNumber(item.sold)} قطعة في ${formatInvoiceCount(item.orders)} خلال ${formatDaySpan(windowDays)}`;
  return `
    <span class="stock-cover stock-cover--${tone}" title="${escapeAttr(tooltip)}">
      ${icon('clock', { size: 11 })}
      <span>${escapeHtml(coverageLabel(item))}</span>
    </span>
    ${
      item.suggestedRestock > 0
        ? `<button type="button" class="stock-order" data-action="restock-product" data-id="${escapeAttr(item.productId)}" data-qty="${escapeAttr(String(item.suggestedRestock))}" title="أعد طلب ${escapeAttr(formatNumber(item.suggestedRestock))} قطعة" aria-label="أعد طلب ${escapeAttr(formatNumber(item.suggestedRestock))} من ${escapeAttr(item.product.name)}">${icon('cartPlus', { size: 12 })}<span>أعد ${escapeHtml(formatNumber(item.suggestedRestock))}</span></button>`
        : ''
    }
  `;
}

function renderShelfPulse(pulse, lowCount, outCount) {
  if (!pulse.items.length) return '';

  if (!pulse.historyEnough) {
    return `
      <aside class="shelf-pulse shelf-pulse--learning" aria-label="نبض الرف — يتعلّم من فواتيرك">
        <span class="shelf-pulse-icon">${icon('clock', { size: 22 })}</span>
        <div class="shelf-pulse-lead">
          <span class="eyebrow">نبض الرف · يتعلّم</span>
          <h2>أحتاج بضع فواتير لأقرأ الرف</h2>
          <p>بعد ${formatNumber(pulse.minInvoices)} فواتير سأقيس سرعة البيع وأيام التغطية لكل صنف. لديك ${formatNumber(pulse.invoiceCount)} حتى الآن.</p>
          <div class="shelf-pulse-meta">
            <span>${icon('alert', { size: 12 })} ${formatNumber(outCount)} نافد</span>
            <span>${icon('package', { size: 12 })} ${formatNumber(lowCount)} منخفض</span>
          </div>
        </div>
        <div class="shelf-pulse-actions">
          ${outCount ? `<button type="button" class="btn btn--ghost btn--small" data-action="set-stock-filter" data-filter="out">اعرض النافد</button>` : ''}
          ${lowCount ? `<button type="button" class="btn btn--ghost btn--small" data-action="set-stock-filter" data-filter="low">اعرض المنخفض</button>` : ''}
        </div>
      </aside>
    `;
  }

  const urgent = pulse.urgent.slice(0, 3);
  const remaining = pulse.urgent.length - urgent.length;
  const hasUrgent = pulse.urgent.length > 0;
  const title = hasUrgent
    ? pulse.urgent.length === 1
      ? 'صنف واحد يحتاج قراراً'
      : pulse.urgent.length === 2
        ? 'صنفان يحتاجان قراراً'
        : `${formatNumber(pulse.urgent.length)} أصناف تحتاج قراراً`
    : 'لا صنف على وشك النفاد';
  const description = hasUrgent
    ? 'التغطية محسوبة من فواتيرك، والكمية المقترحة تكفي أسبوعين.'
    : pulse.fastest
      ? `أقرب صنف هو «${escapeHtml(pulse.fastest.product.name)}» ويكفي ${pulse.fastest.coverageDays > 60 ? 'أكثر من شهرين' : formatDaySpan(pulse.fastest.coverageDays)}.`
      : 'لا إشارات نفاد عاجلة، وأتابع الرف تلقائياً مع كل فاتورة.';

  return `
    <aside class="shelf-pulse ${hasUrgent ? '' : 'shelf-pulse--clear'}" aria-label="نبض الرف — قراءة محلية من الفواتير">
      <div class="shelf-pulse-lead">
        <span class="eyebrow">نبض الرف · قراءة محلية</span>
        <h2>${escapeHtml(title)}</h2>
        <p>${description}</p>
        <div class="shelf-pulse-meta">
          <span>${icon('receipt', { size: 12 })} ${formatInvoiceCount(pulse.invoiceCount)}</span>
          <span>${icon('calendar', { size: 12 })} ${formatDaySpan(pulse.windowDays)}</span>
          ${pulse.suggestedUnits > 0 ? `<span>${icon('package', { size: 12 })} ${formatNumber(pulse.suggestedUnits)} قطعة مقترحة</span>` : ''}
        </div>
      </div>

      ${
        hasUrgent
          ? `<div class="shelf-pulse-board">
              <div class="shelf-pulse-list">
                ${urgent
                  .map((item) => {
                    const meta = `${formatNumber(item.sold)} قطعة في ${formatInvoiceCount(item.orders)}`;
                    return `
                      <article class="shelf-pulse-item shelf-pulse-item--${escapeAttr(item.urgency)}">
                        ${productVisual(item.product, { className: 'pulse-art' })}
                        <div class="pulse-copy">
                          <span class="pulse-cat">${escapeHtml(item.product.category)}</span>
                          <strong>${escapeHtml(item.product.name)}</strong>
                          <span class="pulse-line">
                            ${icon('clock', { size: 11 })}
                            ${escapeHtml(coverageLabel(item))}
                            <span class="pulse-sep" aria-hidden="true"></span>
                            ${escapeHtml(meta)}
                          </span>
                        </div>
                        ${
                          item.suggestedRestock > 0
                            ? `<button type="button" class="pulse-order" data-action="restock-product" data-id="${escapeAttr(item.productId)}" data-qty="${escapeAttr(String(item.suggestedRestock))}" aria-label="أعد طلب ${escapeAttr(formatNumber(item.suggestedRestock))} من ${escapeAttr(item.product.name)}"><span>أعد طلب</span><strong class="mono">${escapeHtml(formatNumber(item.suggestedRestock))}</strong></button>`
                            : `<button type="button" class="pulse-edit" data-action="edit-product" data-id="${escapeAttr(item.productId)}" aria-label="راجع ${escapeAttr(item.product.name)}">${icon('edit', { size: 14 })}<span>راجع</span></button>`
                        }
                      </article>
                    `;
                  })
                  .join('')}
              </div>
              ${
                remaining > 0
                  ? `<span class="shelf-pulse-more">${icon('more', { size: 14 })} ${formatNumber(remaining)} ${remaining === 1 ? 'صنف آخر' : 'أصناف أخرى'} تحتاج مراجعة في الدفتر</span>`
                  : ''
              }
            </div>`
          : `<div class="shelf-pulse-board shelf-pulse-board--calm">
              <span class="shelf-pulse-clear-icon">${icon('checkCircle', { size: 22 })}</span>
              <div>
                <strong>كل الأصناف المتتبعة فوق أسبوع من التغطية</strong>
                <p>سأعيد الحساب تلقائياً بعد كل فاتورة جديدة.</p>
              </div>
            </div>`
      }
    </aside>
  `;
}

function renderStats(products, settings) {
  const units = products.reduce((sum, product) => sum + product.stock, 0);
  const costValue = roundMoney(products.reduce((sum, product) => sum + product.cost * product.stock, 0));
  const retailValue = roundMoney(products.reduce((sum, product) => sum + product.price * product.stock, 0));
  const low = products.filter((product) => product.stock > 0 && product.stock <= product.lowStock).length;
  const out = products.filter((product) => product.stock <= 0).length;
  return `
    <div class="ledger-stats" role="list">
      <article class="stat-stub" role="listitem">
        <span class="stat-label">أصناف مسجّلة</span>
        <strong class="stat-value num">${escapeHtml(formatNumber(products.length))}</strong>
        <span class="stat-foot">على الرفوف الآن</span>
        <span class="stat-index mono" aria-hidden="true">01</span>
      </article>
      <article class="stat-stub" role="listitem">
        <span class="stat-label">قطع في المخزن</span>
        <strong class="stat-value num">${escapeHtml(formatNumber(units))}</strong>
        <span class="stat-foot">مجموع كل الكميات</span>
        <span class="stat-index mono" aria-hidden="true">02</span>
      </article>
      <article class="stat-stub" role="listitem">
        <span class="stat-label">رأس المال في البضاعة</span>
        <strong class="stat-value num">${escapeHtml(formatMoney(costValue, settings.currency))}</strong>
        <span class="stat-foot">قيمة البيع ${escapeHtml(formatMoney(retailValue, settings.currency))}</span>
        <span class="stat-index mono" aria-hidden="true">03</span>
      </article>
      <article class="stat-stub stat-stub--alert ${low + out > 0 ? 'has-alert' : ''}" role="listitem">
        <span class="stat-label">تحتاج انتباهاً</span>
        <strong class="stat-value num">${escapeHtml(formatNumber(low + out))}</strong>
        <span class="stat-foot">${escapeHtml(formatNumber(low))} منخفض · ${escapeHtml(formatNumber(out))} نافد</span>
        <span class="stat-index mono" aria-hidden="true">04</span>
      </article>
    </div>
  `;
}

function renderRow(product, settings, coverage, windowDays) {
  const margin = marginOf(product);
  const state = stockState(product);
  const soldOut = product.stock <= 0;
  const coverageNote = renderCoverage(coverage, windowDays);
  return `
    <div class="stock-row" role="row" data-product-row="${escapeAttr(product.id)}">
      <div class="stock-product" role="cell">
        ${productVisual(product, { className: 'stock-thumb' })}
        <div class="stock-identity">
          <h3>${escapeHtml(product.name)}</h3>
          <div class="stock-sub">
            <span class="stock-cat">${escapeHtml(product.category)}</span>
            <span class="stock-sep" aria-hidden="true"></span>
            <span class="mono stock-barcode" dir="ltr">${escapeHtml(product.barcode)}</span>
          </div>
          <span class="stock-ean" aria-hidden="true">${ean13Svg(product.barcode, { height: 12 })}</span>
        </div>
      </div>

      <div class="stock-price" role="cell">
        <span class="cell-label">البيع</span>
        <strong class="num">${escapeHtml(formatPrice(product.price, settings))}</strong>
        <span class="stock-cost">التكلفة ${escapeHtml(formatMoney(product.cost, settings.currency))}</span>
      </div>

      <div class="stock-margin" role="cell">
        <span class="cell-label">الهامش</span>
        <strong class="num ${margin !== null && margin < 15 ? 'is-thin' : ''}">${margin === null ? '—' : `${escapeHtml(formatNumber(margin))}٪`}</strong>
      </div>

      <div class="stock-quantity" role="cell">
        <div class="stock-stepper" aria-label="تعديل مخزون ${escapeAttr(product.name)}">
          <button type="button" class="icon-btn icon-btn--square" data-action="adjust-stock" data-id="${escapeAttr(product.id)}" data-delta="-1" aria-label="أنقص من مخزون ${escapeAttr(product.name)}" ${soldOut ? 'disabled' : ''}>${icon('minus', { size: 14 })}</button>
          <span class="stock-number num">${escapeHtml(formatNumber(product.stock))}</span>
          <button type="button" class="icon-btn icon-btn--square" data-action="adjust-stock" data-id="${escapeAttr(product.id)}" data-delta="1" aria-label="أزد مخزون ${escapeAttr(product.name)}">${icon('plus', { size: 14 })}</button>
        </div>
        ${stockMeter(product)}
      </div>

      <div class="stock-status" role="cell">
        ${stockPill(product)}
        ${
          coverageNote
            ? coverageNote
            : `<span class="stock-status-note">${state.key === 'out' ? 'يحتاج تزويداً' : state.key === 'low' ? `الحد ${formatNumber(product.lowStock)}` : 'فوق الحد'}</span>`
        }
      </div>

      <div class="stock-actions" role="cell">
        <button type="button" class="icon-btn" data-action="edit-product" data-id="${escapeAttr(product.id)}" aria-label="تعديل ${escapeAttr(product.name)}" title="تعديل">${icon('edit', { size: 17 })}</button>
        <button type="button" class="icon-btn" data-action="print-product-label" data-id="${escapeAttr(product.id)}" aria-label="ملصقات ${escapeAttr(product.name)}" title="ملصقات">${icon('qr', { size: 17 })}</button>
        <button type="button" class="icon-btn icon-btn--danger" data-action="delete-product" data-id="${escapeAttr(product.id)}" aria-label="حذف ${escapeAttr(product.name)}" title="حذف">${icon('trash', { size: 16 })}</button>
      </div>
    </div>
  `;
}

export function renderInventory(state, ui = {}) {
  const settings = state.settings;
  const query = ui.inventorySearch || '';
  const category = ui.inventoryCategory || 'all';
  const filter = ui.inventoryFilter || 'all';
  const categories = ['all', ...new Set(state.products.map((product) => product.category))];
  const visible = state.products.filter(
    (product) =>
      (category === 'all' || product.category === category) &&
      matchesFilter(product, filter) &&
      matchesSearch(product, query)
  );
  const lowCount = state.products.filter(
    (product) => product.stock > 0 && product.stock <= product.lowStock
  ).length;
  const outCount = state.products.filter((product) => product.stock <= 0).length;
  const pulse = stockPulse(state.invoices, state.products);
  const coverageById = new Map(pulse.items.map((entry) => [entry.productId, entry]));
  const resultLabel = `${formatNumber(visible.length)} ${visible.length === 1 ? 'صنف' : 'أصناف'}`;
  const lead = renderPageLead({
    eyebrow: 'دفتر المخزون · نظرة سريعة',
    title: 'ما على الرف، وما ينقصه',
    description: 'عدّل الكميات مباشرة، تابع الهامش، واطبع ملصقات QR والباركود لكل صنف.',
    action: `
      <div class="page-actions">
        <button type="button" class="btn btn--ghost" data-action="open-labels">${icon('qr', { size: 17 })} ملصقات المنتجات</button>
        <button type="button" class="btn btn--primary" data-action="create-product">${icon('plus', { size: 18 })} منتج جديد</button>
      </div>
    `
  });

  return `
    <section class="page page--inventory" data-page="inventory">
      ${lead}
      ${renderStats(state.products, settings)}
      ${renderShelfPulse(pulse, lowCount, outCount)}

      <div class="ledger-panel">
        <div class="ledger-toolbar">
          <div class="search-field search-field--soft">
            ${icon('search', { size: 18 })}
            <input
              id="inventory-search"
              type="search"
              value="${escapeAttr(query)}"
              placeholder="ابحث بالاسم أو الباركود…"
              autocomplete="off"
              aria-label="ابحث في المخزون"
            >
            ${query ? `<button type="button" class="search-clear" data-action="clear-inventory-search" aria-label="مسح البحث">${icon('close', { size: 14 })}</button>` : ''}
          </div>
          <div class="ledger-toolbar-right">
            <span class="result-count">${escapeHtml(resultLabel)}</span>
            <select class="select select--compact" id="inventory-category" data-select="inventory-category" aria-label="تصفية حسب الفئة">
              ${categories
                .map(
                  (entry) =>
                    `<option value="${escapeAttr(entry)}" ${entry === category ? 'selected' : ''}>${entry === 'all' ? 'كل الفئات' : escapeHtml(entry)}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="ledger-filterbar">
          <div class="segmented segmented--quiet" role="group" aria-label="تصفية حسب حالة المخزون">
            ${FILTERS.map(
              (entry) => `
                <button type="button" class="segmented-btn ${filter === entry.id ? 'is-active' : ''}" data-action="set-stock-filter" data-filter="${entry.id}" aria-pressed="${filter === entry.id}">
                  ${escapeHtml(entry.label)}
                  ${entry.id === 'low' && lowCount ? `<span class="segmented-count">${formatNumber(lowCount)}</span>` : ''}
                </button>
              `
            ).join('')}
          </div>
          <span class="ledger-hint">${icon('info', { size: 14 })} انقر +/− لتعديل سريع، أو افتح الصنف للتفاصيل.</span>
        </div>

        ${
          visible.length
            ? `<div class="stock-list" role="table" aria-label="قائمة المخزون">
                <div class="stock-list-head" role="row">
                  <span role="columnheader">الصنف</span>
                  <span role="columnheader">السعر</span>
                  <span role="columnheader">الهامش</span>
                  <span role="columnheader">المخزون</span>
                  <span role="columnheader">الحالة</span>
                  <span role="columnheader" class="sr-only">إجراءات</span>
                </div>
                ${visible.map((product) => renderRow(product, settings, coverageById.get(product.id), pulse.windowDays)).join('')}
              </div>`
            : `<div class="ledger-empty">
                ${icon('package', { size: 28 })}
                <h3>${state.products.length ? 'لا صنف يطابق هذا العرض' : 'الرف فارغ'}</h3>
                <p>${state.products.length ? 'غيّر الفئة أو البحث، أو أضف صنفاً جديداً لتبدأ.' : 'أضف أول منتج، وولّد له باركوداً وملصق QR في ثانية.'}</p>
                <div class="ledger-empty-actions">
                  ${state.products.length ? `<button type="button" class="btn btn--ghost" data-action="clear-inventory-filters">اعرض كل الأصناف</button>` : ''}
                  <button type="button" class="btn btn--primary" data-action="create-product">${icon('plus', { size: 17 })} منتج جديد</button>
                </div>
              </div>`
        }

        <footer class="ledger-foot">
          <span>${icon('database', { size: 14 })} محفوظ في هذا المتصفح</span>
          <span class="ledger-foot-sep" aria-hidden="true"></span>
          <span>الأسعار ${settings.pricesIncludeVat ? 'تشمل' : 'لا تشمل'} ضريبة ${escapeHtml(formatNumber(settings.vatRate))}٪</span>
        </footer>
      </div>
    </section>
  `;
}
