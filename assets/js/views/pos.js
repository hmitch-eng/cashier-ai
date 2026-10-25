import { PAYMENT_METHODS } from '../constants.js';
import { calculateCart } from '../commerce.js';
import { ean13Svg } from '../ean.js';
import { icon } from '../icons.js';
import { invoicesInLastDays } from '../analytics.js';
import {
  currencyLabel,
  formatPrice,
  miniQtyBadge,
  productVisual,
  renderPageLead,
  stockNote,
  stockPill
} from '../components.js';
import {
  escapeAttr,
  escapeHtml,
  formatDate,
  formatMoney,
  formatNumber,
  normalizeSearch,
  roundMoney
} from '../util.js';

function greetingForHour(hour) {
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء النور';
  return 'مساء الخير';
}

function matchesSearch(product, query) {
  if (!query) return true;
  const text = normalizeSearch(query);
  const digits = String(query).replace(/\D/g, '');
  return [product.name, product.category, product.barcode].some((value) =>
    normalizeSearch(value).includes(text)
  ) || (digits.length > 1 && product.barcode.includes(digits));
}

function renderProductCard(product, cartQuantity, settings) {
  const soldOut = product.stock <= 0;
  const low = product.stock > 0 && product.stock <= product.lowStock;
  return `
    <article
      class="product-card ${soldOut ? 'is-sold-out' : ''}"
      ${soldOut ? '' : 'data-action="add-to-cart"'}
      data-id="${escapeAttr(product.id)}"
      role="button"
      tabindex="${soldOut ? '-1' : '0'}"
      aria-label="${escapeAttr(`${product.name}، ${formatPrice(product.price, settings)}، ${soldOut ? 'غير متوفر' : 'أضف إلى السلة'}`)}"
      aria-disabled="${soldOut ? 'true' : 'false'}"
    >
      <div class="product-card-art">
        ${productVisual(product)}
        <span class="category-tab">${escapeHtml(product.category)}</span>
        ${soldOut || low ? stockPill(product) : ''}
        ${miniQtyBadge(cartQuantity)}
        ${soldOut ? '<span class="sold-out-veil">نفد</span>' : ''}
      </div>
      <div class="shelf-label">
        <div class="shelf-copy">
          <h3>${escapeHtml(product.name)}</h3>
          <div class="shelf-meta">
            <span class="${low ? 'shelf-stock shelf-stock--low' : 'shelf-stock'}">${stockNote(product)}</span>
            <span class="shelf-code">
              ${ean13Svg(product.barcode, { height: 16, className: 'shelf-ean', label: `باركود ${product.name}` })}
              <span class="mono">${escapeHtml(product.barcode.slice(-4))}</span>
            </span>
          </div>
        </div>
        <div class="shelf-price">
          <strong>${escapeHtml(formatNumber(product.price))}</strong>
          <span>${escapeHtml(currencyLabel(settings))}</span>
        </div>
        <span class="shelf-add" aria-hidden="true">${icon('plus', { size: 17 })}</span>
      </div>
    </article>
  `;
}

function renderAiTile() {
  return `
    <article class="ai-tile" data-action="open-ai" role="button" tabindex="0" aria-label="تعرّف على منتج مجهول بالكاميرا">
      <div class="ai-tile-glow" aria-hidden="true"></div>
      <div class="ai-tile-top">
        <span class="ai-mark">AI</span>
        <span class="ai-spark">${icon('sparkles', { size: 18 })}</span>
      </div>
      <div class="ai-aperture" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
        ${icon('camera', { size: 25 })}
      </div>
      <div class="ai-tile-copy">
        <span class="ai-kicker">كاميرا + ذكاء</span>
        <h3>منتج مجهول؟</h3>
        <p>صوّره، ونسعّره ونضيفه للمخزون.</p>
      </div>
      <span class="ai-tile-link">افتح المساعد ${icon('arrowLeft', { size: 16 })}</span>
    </article>
  `;
}

function renderCartItem(item, settings) {
  const product = item.product;
  return `
    <div class="cart-item" data-cart-item="${escapeAttr(product.id)}">
      ${productVisual(product, { className: 'cart-item-art', eager: false })}
      <div class="cart-item-main">
        <div class="cart-item-top">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <span class="cart-item-unit">${escapeHtml(formatPrice(product.price, settings))} للوحدة</span>
          </div>
          <button type="button" class="cart-remove" data-action="cart-remove" data-id="${escapeAttr(product.id)}" aria-label="أزل ${escapeAttr(product.name)} من السلة">${icon('trash', { size: 15 })}</button>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-stepper" aria-label="كمية ${escapeAttr(product.name)}">
            <button type="button" data-action="cart-minus" data-id="${escapeAttr(product.id)}" aria-label="أنقص الكمية">${icon('minus', { size: 14 })}</button>
            <span class="mono">${escapeHtml(String(item.quantity))}</span>
            <button type="button" data-action="cart-plus" data-id="${escapeAttr(product.id)}" aria-label="أزد الكمية" ${item.quantity >= product.stock ? 'disabled' : ''}>${icon('plus', { size: 14 })}</button>
          </div>
          <strong class="cart-line-total">${escapeHtml(formatPrice(item.lineTotal, settings))}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderCartTotals(cart, settings) {
  return `
    <div class="cart-summary-row">
      <span>المجموع</span>
      <strong>${escapeHtml(formatMoney(cart.subtotal, settings.currency))}</strong>
    </div>
    ${
      cart.discountAmount > 0
        ? `<div class="cart-summary-row cart-summary-row--discount"><span>الخصم ${cart.discountType === 'percent' ? `(${escapeHtml(formatNumber(cart.discountValue))}٪)` : ''}</span><strong>− ${escapeHtml(formatMoney(cart.discountAmount, settings.currency))}</strong></div>`
        : ''
    }
    <div class="cart-summary-row ${settings.pricesIncludeVat ? 'cart-summary-row--muted' : ''}">
      <span>${settings.pricesIncludeVat ? 'منها ضريبة القيمة المضافة' : 'ضريبة القيمة المضافة'} (${escapeHtml(formatNumber(settings.vatRate))}٪)</span>
      <strong>${escapeHtml(formatMoney(cart.tax, settings.currency))}</strong>
    </div>
    <div class="cart-summary-row cart-summary-row--total">
      <span>الإجمالي</span>
      <strong>${escapeHtml(formatMoney(cart.total, settings.currency))}</strong>
    </div>
  `;
}

function renderDiscountEditor(cart, settings, open) {
  const active = cart.discountValue > 0;
  return `
    <div class="cart-discount">
      <div class="cart-discount-line">
        <span>${active ? `خصم مطبّق · ${cart.discountType === 'percent' ? `${escapeHtml(formatNumber(cart.discountValue))}٪` : escapeHtml(formatMoney(cart.discountValue, settings.currency))}` : 'خصم على الفاتورة'}</span>
        <button type="button" class="text-btn" data-action="toggle-discount">${active ? 'تعديل' : open ? 'إغلاق' : 'إضافة خصم'}</button>
      </div>
      ${
        open
          ? `<form class="discount-form" data-form="discount">
              <div class="discount-fields">
                <input class="input input--compact" type="number" name="value" min="0" step="0.5" inputmode="decimal" value="${escapeAttr(String(cart.discountValue || ''))}" placeholder="0" aria-label="قيمة الخصم">
                <select class="select input--compact" name="type" aria-label="نوع الخصم">
                  <option value="amount" ${cart.discountType === 'amount' ? 'selected' : ''}>${escapeHtml(settings.currency)}</option>
                  <option value="percent" ${cart.discountType === 'percent' ? 'selected' : ''}>٪</option>
                </select>
                <button type="submit" class="btn btn--dark btn--small">تطبيق</button>
                ${active ? `<button type="button" class="icon-btn icon-btn--subtle" data-action="clear-discount" aria-label="إزالة الخصم">${icon('close', { size: 15 })}</button>` : ''}
              </div>
              <p>اختر مبلغاً ثابتاً أو نسبة من المجموع.</p>
            </form>`
          : ''
      }
    </div>
  `;
}

function renderCart({ state, ui, cart }) {
  const settings = state.settings;
  const hasItems = cart.lineCount > 0;
  const itemLabel = cart.quantityCount === 1 ? 'قطعة واحدة' : `${formatNumber(cart.quantityCount)} قطع`;
  return `
    <div class="cart-backdrop ${ui.cartOpen ? 'is-visible' : ''}" data-action="close-cart" aria-hidden="true"></div>
    <aside class="cart-panel ${ui.cartOpen ? 'is-open' : ''}" id="cart-panel" aria-label="سلة الفاتورة الحالية">
      <header class="cart-head">
        <div>
          <span class="eyebrow">الفاتورة الحالية</span>
          <h2>السلة ${hasItems ? `<span class="cart-count">${escapeHtml(itemLabel)}</span>` : ''}</h2>
        </div>
        <div class="cart-head-actions">
          ${hasItems ? `<button type="button" class="text-btn text-btn--danger" data-action="clear-cart">إفراغ</button>` : ''}
          <button type="button" class="icon-btn cart-close-mobile" data-action="close-cart" aria-label="إغلاق السلة">${icon('close', { size: 19 })}</button>
        </div>
      </header>

      <div class="cart-body">
        ${
          hasItems
            ? `<div class="cart-items">${cart.items.map((item) => renderCartItem(item, settings)).join('')}</div>`
            : `<div class="cart-empty">
                <div class="cart-empty-art" aria-hidden="true">
                  <span class="cart-empty-bag">${icon('bag', { size: 34 })}</span>
                  <span class="cart-empty-tag">${icon('sparkles', { size: 15 })}</span>
                </div>
                <h3>السلة تنتظر أول صنف</h3>
                <p>اختر منتجاً من الرفوف، أو امسح باركوده من الشريط العلوي.</p>
                <button type="button" class="btn btn--dark btn--small" data-action="focus-search">إلى الرفوف ${icon('arrowLeft', { size: 15 })}</button>
              </div>`
        }
      </div>

      <div class="cart-checkout">
        ${renderDiscountEditor(cart, settings, ui.discountOpen)}
        <div class="cart-totals">${renderCartTotals(cart, settings)}</div>
        <button type="button" class="checkout-btn" data-action="open-checkout" ${hasItems ? '' : 'disabled'}>
          <span class="checkout-btn-copy">${icon('banknote', { size: 20 })}<span>إتمام البيع</span></span>
          <span class="checkout-btn-total">${escapeHtml(formatMoney(cart.total, settings.currency))}</span>
        </button>
        <div class="cart-reassurance">
          <span>${icon('qr', { size: 14 })} فاتورة QR جاهزة</span>
          <span>${icon('database', { size: 14 })} محفوظة محلياً</span>
          <span>${PAYMENT_METHODS.length} طرق دفع</span>
        </div>
      </div>
    </aside>
  `;
}

export function renderPos(state, ui = {}) {
  const settings = state.settings;
  const cart = calculateCart(state.cart, state.products, settings);
  const query = ui.posSearch || '';
  const activeCategory = ui.category || 'all';
  const categories = ['all', ...new Set(state.products.map((product) => product.category))];
  const filtered = state.products.filter(
    (product) => (activeCategory === 'all' || product.category === activeCategory) && matchesSearch(product, query)
  );
  const quantities = new Map(cart.items.map((item) => [item.productId, item.quantity]));
  const todayInvoices = invoicesInLastDays(state.invoices, 1);
  const todayTotal = roundMoney(todayInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0));
  const todayCount = todayInvoices.length;
  const showAiTile = !query && activeCategory === 'all';
  const firstName = settings.cashierName?.split(/\s+/)[0] || '';
  const dateLine = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  const greeting = greetingForHour(new Date().getHours());

  const lead = renderPageLead({
    eyebrow: `نقطة البيع · ${dateLine}`,
    title: `${greeting}، ${firstName}`,
    description: 'امسح باركود أو اختر من الرفوف. الفاتورة تُبنى هنا، وكل شيء يُحفظ في متصفحك.',
    extra: `
      <div class="today-glance">
        <span class="today-glance-label">مبيعات اليوم</span>
        <strong class="num">${escapeHtml(formatMoney(todayTotal, settings.currency))}</strong>
        <span>${escapeHtml(formatNumber(todayCount))} ${todayCount === 1 ? 'فاتورة' : 'فواتير'}</span>
      </div>
    `
  });

  const productCountLabel = `${formatNumber(filtered.length)} ${filtered.length === 1 ? 'صنف' : 'أصناف'}`;
  const allProductCount = `${formatNumber(state.products.length)} ${state.products.length === 1 ? 'منتج' : 'منتجاً'}`;

  return `
    <section class="page page--pos" data-page="pos">
      <div class="pos-layout">
        <div class="pos-main">
          ${lead}

          <div class="pos-toolbar">
            <div class="search-field">
              ${icon('search', { size: 19 })}
              <input
                id="pos-search"
                data-focus="pos-search"
                type="search"
                value="${escapeAttr(query)}"
                placeholder="ابحث بالاسم أو الباركود…"
                autocomplete="off"
                aria-label="ابحث عن منتج بالاسم أو الباركود"
              >
              ${query ? `<button type="button" class="search-clear" data-action="clear-pos-search" aria-label="مسح البحث">${icon('close', { size: 15 })}</button>` : '<kbd class="search-kbd">/</kbd>'}
            </div>
            <div class="pos-toolbar-meta">
              <span class="result-count">${escapeHtml(productCountLabel)}</span>
              <span class="toolbar-divider" aria-hidden="true"></span>
              <span class="shelf-total">${escapeHtml(allProductCount)} على الرف</span>
            </div>
          </div>

          <div class="category-strip" role="group" aria-label="تصفية حسب الفئة">
            ${categories
              .map(
                (category) => `
                  <button type="button" class="category-chip ${category === activeCategory ? 'is-active' : ''}" data-action="set-category" data-category="${escapeAttr(category)}" aria-pressed="${category === activeCategory}">
                    ${category === 'all' ? 'كل الرفوف' : escapeHtml(category)}
                  </button>
                `
              )
              .join('')}
          </div>

          <div class="products-head">
            <div class="products-head-copy">
              <h2>${query ? 'نتائج البحث' : activeCategory === 'all' ? 'الرفوف القريبة' : escapeHtml(activeCategory)}</h2>
              <span class="products-head-line" aria-hidden="true"></span>
              <span class="products-head-meta">${escapeHtml(productCountLabel)}</span>
            </div>
            ${query ? `<button type="button" class="text-btn" data-action="clear-pos-search">عرض الكل</button>` : '<span class="products-hint">اضغط أي منتج لإضافته</span>'}
          </div>

          <div class="product-grid" id="product-grid">
            ${showAiTile ? renderAiTile() : ''}
            ${filtered.map((product) => renderProductCard(product, quantities.get(product.id), settings)).join('')}
            ${
              !filtered.length
                ? `<div class="product-grid-empty">
                    ${icon('search', { size: 26 })}
                    <h3>لا شيء على هذا الرف</h3>
                    <p>لم أجد منتجاً يطابق «${escapeHtml(query || activeCategory)}». جرّب اسماً آخر أو امسح الباركود.</p>
                    <button type="button" class="btn btn--dark btn--small" data-action="clear-filters">اعرض كل المنتجات</button>
                  </div>`
                : ''
            }
          </div>
        </div>

        ${renderCart({ state, ui, cart })}
      </div>

      ${
        cart.lineCount > 0
          ? `<button type="button" class="mobile-cart-bar" data-action="open-cart">
              <span class="mobile-cart-count">${icon('bag', { size: 18 })} ${escapeHtml(String(cart.quantityCount))}</span>
              <span class="mobile-cart-total">${escapeHtml(formatMoney(cart.total, settings.currency))}</span>
              <span class="mobile-cart-open">عرض السلة ${icon('arrowLeft', { size: 16 })}</span>
            </button>`
          : ''
      }
    </section>
  `;
}
