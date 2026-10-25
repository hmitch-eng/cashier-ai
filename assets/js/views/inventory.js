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

function renderRow(product, settings) {
  const margin = marginOf(product);
  const state = stockState(product);
  const soldOut = product.stock <= 0;
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
        <span class="stock-status-note">${state.key === 'out' ? 'يحتاج تزويداً' : state.key === 'low' ? `الحد ${formatNumber(product.lowStock)}` : 'فوق الحد'}</span>
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

      ${
        lowCount
          ? `<div class="attention-note">
              ${icon('alert', { size: 18 })}
              <p><strong>${escapeHtml(formatNumber(lowCount))} ${lowCount === 1 ? 'صنف يحتاج' : 'أصناف تحتاج'} تزويداً.</strong> راجعها قبل أن تنفد من الرف.</p>
              <button type="button" class="text-btn" data-action="set-stock-filter" data-filter="low">اعرضها فقط ${icon('arrowLeft', { size: 14 })}</button>
            </div>`
          : ''
      }

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
                ${visible.map((product) => renderRow(product, settings)).join('')}
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
