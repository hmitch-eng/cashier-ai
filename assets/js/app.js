import { invoicesInLastDays } from './analytics.js';
import { testGeminiConnection } from './ai.js';
import { avatar, paymentLabel } from './components.js';
import { APP_NAME, ROUTES } from './constants.js';
import { icon } from './icons.js';
import {
  openAiModal,
  openCheckoutModal,
  openInvoiceModal,
  openLabelsModal,
  openProductFormModal,
  openScannerModal
} from './modals.js';
import { printInvoice } from './print.js';
import { CashierStore } from './store.js';
import {
  confirmDialog,
  playSound,
  setButtonBusy,
  toast
} from './ui.js';
import {
  downloadBlob,
  downloadJson,
  escapeAttr,
  escapeHtml,
  formatBytes,
  formatMoney,
  formatNumber,
  formatTime,
  normalizeDigits,
  readFileAsText
} from './util.js';
import { renderInventory } from './views/inventory.js';
import { renderInvoices } from './views/invoices.js';
import { renderPos } from './views/pos.js';
import { renderReports } from './views/reports.js';
import { renderSettings } from './views/settings.js';

const SETTINGS_ROUTE = {
  id: 'settings',
  label: 'الإعدادات',
  icon: 'settings',
  title: 'الإعدادات',
  hint: 'الهوية، الضريبة، والنسخة المحلية'
};
const ALL_ROUTES = [...ROUTES, SETTINGS_ROUTE];
const ROUTE_MAP = new Map(ALL_ROUTES.map((route) => [route.id, route]));
const CART_DRAWER_QUERY = '(max-width: 1120px)';

const store = new CashierStore();
const ui = {
  route: readRoute(),
  posSearch: '',
  category: 'all',
  cartOpen: false,
  discountOpen: false,
  inventorySearch: '',
  inventoryCategory: 'all',
  inventoryFilter: 'all',
  invoiceSearch: '',
  invoicePayment: 'all',
  invoicesLimit: 60,
  reportDays: 7
};

const railNav = document.getElementById('rail-nav');
const railFoot = document.getElementById('rail-foot');
const topbar = document.getElementById('topbar');
const view = document.getElementById('view');

let renderTimer = 0;
let storageWarningShown = false;

function isValidRoute(route) {
  return ROUTE_MAP.has(route);
}

function readRoute() {
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
  try {
    return ROUTE_MAP.has(decodeURIComponent(raw)) ? decodeURIComponent(raw) : 'pos';
  } catch {
    return 'pos';
  }
}

function currentRoute() {
  return ROUTE_MAP.get(ui.route) || ROUTE_MAP.get('pos');
}

function isMobileCart() {
  return window.matchMedia(CART_DRAWER_QUERY).matches;
}

function feedback(kind = 'success') {
  if (store.state.settings.sounds === false) return;
  playSound(kind);
}

function reportError(error) {
  console.error(error);
  toast(error?.message || 'حدث خطأ غير متوقع. أعد المحاولة.', {
    tone: 'error',
    duration: 5200
  });
  feedback('error');
}

function formatClock(iso) {
  return formatTime(iso || new Date());
}

/* ------------------------------------------------------------------ */
/* Shell rendering                                                     */
/* ------------------------------------------------------------------ */

function renderRail() {
  const cart = store.getCart();
  const settings = store.state.settings;
  const activeSettings = ui.route === 'settings';
  railNav.innerHTML = ALL_ROUTES.map((route) => {
    const active = ui.route === route.id;
    const showCart = route.id === 'pos' && cart.quantityCount > 0;
    return `
      <a class="rail-link ${route.id === 'settings' ? 'rail-link--utility' : ''} ${active ? 'is-active' : ''}"
        href="#${escapeAttr(route.id)}" ${active ? 'aria-current="page"' : ''}>
        <span class="rail-link-icon">${icon(route.icon, { size: 20 })}</span>
        <span class="rail-link-copy">
          <span>${escapeHtml(route.label)}</span>
          <small>${escapeHtml(route.hint)}</small>
        </span>
        ${showCart ? `<span class="rail-link-count num" aria-label="${escapeAttr(`${cart.quantityCount} في السلة`)}">${escapeHtml(formatNumber(cart.quantityCount))}</span>` : ''}
      </a>
    `;
  }).join('');

  const storageError = Boolean(store.lastPersistError);
  const bytes = formatBytes(store.storageBytes());
  railFoot.innerHTML = `
    <div class="rail-ledger-line" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
    <div class="rail-status ${storageError ? 'is-warning' : ''}">
      <span class="rail-status-dot" aria-hidden="true"></span>
      <div>
        <strong>${storageError ? 'تعذّر الحفظ محلياً' : store.state.meta.isDemo ? 'نسخة تجريبية' : 'محفوظ على الجهاز'}</strong>
        <small>${escapeHtml(bytes)} · ${escapeHtml(formatClock(store.lastSavedAt))}</small>
      </div>
    </div>
    <div class="rail-user">
      ${avatar(settings.cashierName, { size: 'sm' })}
      <div>
        <strong>${escapeHtml(settings.cashierName || 'الكاشير')}</strong>
        <small>${escapeHtml(settings.storeName)}</small>
      </div>
    </div>
    ${activeSettings ? '<span class="rail-active-note">أنت في الإعدادات</span>' : ''}
  `;
}

function renderTopbar() {
  const settings = store.state.settings;
  const cart = store.getCart();
  const route = currentRoute();
  const storageError = Boolean(store.lastPersistError);
  topbar.innerHTML = `
    <div class="topbar-context">
      <span class="topbar-kicker">${escapeHtml(settings.storeName)}${settings.branch ? ` · ${escapeHtml(settings.branch)}` : ''}</span>
      <strong>${escapeHtml(route.title)}</strong>
    </div>

    <form class="quick-scan" id="quick-scan-form" novalidate>
      <span class="quick-scan-icon" aria-hidden="true">${icon('barcode', { size: 18 })}</span>
      <input
        class="quick-scan-input mono"
        id="quick-scan-input"
        name="code"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="40"
        placeholder="باركود سريع لإضافته للسلة…"
        aria-label="اكتب باركود منتج لإضافته إلى السلة"
      >
      <button type="submit" class="quick-scan-submit" aria-label="أضف المنتج بالباركود">
        ${icon('plus', { size: 15 })}<span>أضف</span>
      </button>
    </form>

    <div class="topbar-actions">
      <span class="local-chip ${storageError ? 'is-warning' : ''}" title="${storageError ? 'المساحة المحلية قد تكون ممتلئة. صدّر نسخة من الإعدادات.' : 'كل التغييرات تُحفظ في هذا المتصفح فقط'}">
        <i aria-hidden="true"></i>
        <span>${storageError ? 'الحفظ متعذّر' : store.state.meta.isDemo ? 'نسخة تجريبية' : 'محفوظ محلياً'}</span>
      </span>
      <button type="button" class="topbar-btn" data-action="open-scanner" aria-label="افتح كاميرا مسح الباركود" title="مسح باركود (F2)">
        ${icon('scan', { size: 19 })}
        <span>مسح</span>
      </button>
      <button type="button" class="topbar-btn topbar-btn--ai" data-action="open-ai" aria-label="افتح المساعد البصري للمنتجات" title="المساعد البصري (F3)">
        ${icon('sparkles', { size: 18 })}
        <span>AI</span>
      </button>
      <button type="button" class="cart-pill ${cart.lineCount ? 'has-items' : ''}" data-action="open-cart" aria-label="${escapeAttr(`افتح السلة، ${cart.quantityCount} قطعة، الإجمالي ${formatMoney(cart.total, settings.currency)}`)}">
        ${icon('bag', { size: 19 })}
        <span class="cart-pill-label">السلة</span>
        <strong class="cart-pill-count num">${escapeHtml(formatNumber(cart.quantityCount))}</strong>
        <span class="cart-pill-total num">${escapeHtml(formatMoney(cart.total, settings.currency))}</span>
      </button>
    </div>
  `;
}

function renderCurrentView() {
  const state = store.state;
  switch (ui.route) {
    case 'inventory':
      return renderInventory(state, ui);
    case 'invoices':
      return renderInvoices(state, ui);
    case 'reports':
      return renderReports(state, ui);
    case 'settings':
      return renderSettings(state, ui, {
        storageBytes: store.storageBytes(),
        lastSavedAt: store.lastSavedAt
      });
    case 'pos':
    default:
      return renderPos(state, ui);
  }
}

function captureFocus() {
  const element = document.activeElement;
  if (!element || !element.id || !view.contains(element)) return null;
  if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return null;
  return {
    id: element.id,
    start: element.selectionStart,
    end: element.selectionEnd
  };
}

function restoreFocus(snapshot) {
  if (!snapshot) return;
  const element = document.getElementById(snapshot.id);
  if (!element || !view.contains(element)) return;
  element.focus({ preventScroll: true });
  if (Number.isInteger(snapshot.start) && typeof element.setSelectionRange === 'function') {
    try {
      element.setSelectionRange(snapshot.start, snapshot.end);
    } catch {
      // Some input types reject selection ranges.
    }
  }
}

function focusView() {
  requestAnimationFrame(() => view.focus({ preventScroll: true }));
}

function renderAll({ preserveFocus = true, scroll = 'preserve', animate = false } = {}) {
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = 0;
  }
  const focusSnapshot = preserveFocus ? captureFocus() : null;
  const scrollY = window.scrollY;
  const route = currentRoute();

  document.documentElement.dataset.route = ui.route;
  document.title = `${route.title} — ${store.state.settings.storeName} · ${APP_NAME}`;

  renderRail();
  renderTopbar();
  view.innerHTML = renderCurrentView();
  restoreFocus(focusSnapshot);

  if (scroll === 'top') {
    window.scrollTo(0, 0);
  } else if (Math.abs(window.scrollY - scrollY) > 1) {
    window.scrollTo(0, scrollY);
  }

  if (animate) {
    view.classList.remove('view-enter');
    void view.offsetWidth;
    view.classList.add('view-enter');
    window.setTimeout(() => view.classList.remove('view-enter'), 460);
  }
}

function queueRender(delay = 28) {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderTimer = 0;
    renderAll({ preserveFocus: true });
  }, delay);
}

function syncRouteFromHash({ initial = false } = {}) {
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
  const next = readRoute();
  if (raw !== next) {
    history.replaceState({ route: next }, '', `#${next}`);
  }
  if (!initial && ui.route === next) return;
  ui.route = next;
  ui.cartOpen = false;
  ui.discountOpen = false;
  renderAll({ preserveFocus: false, scroll: 'top', animate: !initial });
  if (!initial) focusView();
}

function navigateTo(route, { cartOpen = false, replace = false } = {}) {
  const next = isValidRoute(route) ? route : 'pos';
  if (ui.route === next) {
    ui.cartOpen = cartOpen;
    ui.discountOpen = false;
    renderAll({ preserveFocus: false });
    return;
  }
  ui.route = next;
  ui.discountOpen = false;
  ui.cartOpen = cartOpen;
  const url = `#${next}`;
  if (replace) history.replaceState({ route: next }, '', url);
  else history.pushState({ route: next }, '', url);
  renderAll({ preserveFocus: false, scroll: 'top', animate: true });
  focusView();
}

/* ------------------------------------------------------------------ */
/* Shopping actions                                                    */
/* ------------------------------------------------------------------ */

function openCartDrawer() {
  if (ui.route !== 'pos') {
    navigateTo('pos', { cartOpen: true });
    return;
  }
  if (isMobileCart()) {
    ui.cartOpen = true;
    renderAll({ preserveFocus: false });
    return;
  }
  document.getElementById('cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeCartDrawer() {
  if (!ui.cartOpen) return;
  ui.cartOpen = false;
  renderAll({ preserveFocus: false });
}

function addProductToCart(productId, { announce = true } = {}) {
  const product = store.addToCart(productId);
  feedback();
  if (announce) {
    toast(`أُضيف ${product.name}`, {
      tone: 'success',
      detail: formatMoney(product.price, store.state.settings.currency),
      duration: 2100,
      actionLabel: 'عرض السلة',
      onAction: openCartDrawer
    });
  }
  return product;
}

function handleBarcode(rawCode, { origin = 'scanner' } = {}) {
  let code = normalizeDigits(rawCode);
  if (!code) {
    toast('لم أجد أرقاماً في هذا الباركود. جرّب قراءة أخرى أو أدخله يدوياً.', { tone: 'warning' });
    return;
  }
  if (code.length === 12) code = `0${code}`;

  const product = store.getProductByBarcode(code);
  if (product) {
    try {
      addProductToCart(product.id);
      if (ui.route !== 'pos') navigateTo('pos');
    } catch (error) {
      reportError(error);
    }
    return;
  }

  if (code.length !== 13) {
    toast('ملصقات هذا التطبيق تستخدم EAN-13. راجع الرقم أو أضف المنتج يدوياً.', {
      tone: 'warning',
      duration: 4800
    });
  }
  feedback('scan');
  openProductFormModal(store, {
    initial: {
      barcode: code,
      name: '',
      category: '',
      price: '',
      cost: '',
      stock: 0,
      lowStock: 3
    },
    scanned: true,
    onSaved: (saved, info) => {
      if (info?.addedToCart || origin === 'scanner') {
        if (ui.route === 'pos') return;
        navigateTo('pos');
      }
    }
  });
}

function openScanner() {
  if (document.querySelector('dialog[open]')) return;
  openScannerModal({
    sounds: store.state.settings.sounds !== false,
    onCode: (code) => handleBarcode(code, { origin: 'scanner' })
  });
}

function openAiAssistant() {
  if (document.querySelector('dialog[open]')) return;
  openAiModal(store, {
    onSaved: (product, info) => {
      if (info?.addedToCart && ui.route !== 'pos') navigateTo('pos');
    }
  });
}

function focusSearch() {
  const targetId = ui.route === 'pos' ? 'pos-search' : ui.route === 'inventory' ? 'inventory-search' : 'invoice-search';
  if (ui.route === 'pos') {
    ui.cartOpen = false;
    renderAll({ preserveFocus: false });
    requestAnimationFrame(() => document.getElementById(targetId)?.focus());
    return;
  }
  if (ui.route === 'inventory' || ui.route === 'invoices') {
    document.getElementById(targetId)?.focus();
    return;
  }
  navigateTo('pos');
  setTimeout(() => document.getElementById('pos-search')?.focus(), 60);
}

async function submitDiscount(form) {
  const formData = new FormData(form);
  const rawValue = String(formData.get('value') || '').trim();
  const value = Number(rawValue || 0);
  const type = formData.get('type') === 'percent' ? 'percent' : 'amount';
  if (!Number.isFinite(value) || value < 0) {
    toast('أدخل قيمة خصم صحيحة.', { tone: 'warning' });
    form.querySelector('[name="value"]')?.focus();
    return;
  }
  if (type === 'percent' && value > 100) {
    toast('نسبة الخصم لا تتجاوز ١٠٠٪.', { tone: 'warning' });
    form.querySelector('[name="value"]')?.focus();
    return;
  }
  ui.discountOpen = false;
  store.setDiscount(type, value);
  toast(value > 0 ? 'طُبّق الخصم على الفاتورة' : 'أُزيل الخصم', {
    tone: value > 0 ? 'success' : 'info',
    detail: value > 0 ? (type === 'percent' ? `${formatNumber(value)}٪ من المجموع` : formatMoney(value, store.state.settings.currency)) : '',
    duration: 2600
  });
}

async function clearCartWithConfirm() {
  const cart = store.getCart();
  if (!cart.lineCount) return;
  const confirmed = await confirmDialog({
    title: 'إفراغ السلة؟',
    message: 'ستُزال كل الأصناف والخصم من الفاتورة الحالية. المخزون لن يتأثر.',
    details: `<span class="num">${escapeHtml(formatNumber(cart.quantityCount))} قطعة</span><span class="num">${escapeHtml(formatMoney(cart.total, store.state.settings.currency))}</span>`,
    confirmLabel: 'أفرغ السلة',
    tone: 'danger'
  });
  if (!confirmed) return;
  store.clearCart();
  ui.discountOpen = false;
  toast('أُفرغت السلة. الرفوف كما هي.', { tone: 'info' });
}

/* ------------------------------------------------------------------ */
/* Inventory, invoices, reports                                        */
/* ------------------------------------------------------------------ */

async function deleteProductWithConfirm(productId) {
  const product = store.getProduct(productId);
  if (!product) return;
  const confirmed = await confirmDialog({
    title: 'حذف المنتج من الرف؟',
    message: `سيُحذف «${product.name}» من المخزون والسلة الحالية. الفواتير السابقة تحتفظ بنسختها.`,
    details: `<span class="mono" dir="ltr">${escapeHtml(product.barcode)}</span><span>${escapeHtml(formatMoney(product.price, store.state.settings.currency))} · ${escapeHtml(formatNumber(product.stock))} قطعة</span>`,
    confirmLabel: 'احذف المنتج',
    tone: 'danger'
  });
  if (!confirmed) return;
  store.deleteProduct(productId);
  toast('حُذف المنتج من المخزون', { tone: 'info', detail: product.name });
}

function printInvoiceById(invoiceId) {
  const invoice = store.state.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) {
    toast('لم أجد هذه الفاتورة.', { tone: 'warning' });
    return;
  }
  const printed = printInvoice(invoice);
  if (!printed) toast('تعذّرت تهيئة الطباعة في هذا المتصفح.', { tone: 'warning' });
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportReportCsv(days) {
  const invoices = invoicesInLastDays(store.state.invoices, days);
  if (!invoices.length) {
    toast('لا مبيعات في هذه الفترة لتصديرها.', { tone: 'warning' });
    return;
  }
  const rows = [
    ['رقم الفاتورة', 'التاريخ', 'الوقت', 'الكاشير', 'طريقة الدفع', 'القطع', 'الخصم', 'الضريبة', 'الإجمالي', 'العملة']
  ];
  const ordered = [...invoices].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const invoice of ordered) {
    rows.push([
      invoice.number,
      invoice.date.slice(0, 10),
      formatTime(invoice.date),
      invoice.cashierName || '',
      paymentLabel(invoice.paymentMethod),
      invoice.itemCount || 0,
      Number(invoice.discountAmount || 0).toFixed(2),
      Number(invoice.tax || 0).toFixed(2),
      Number(invoice.total || 0).toFixed(2),
      invoice.currencyCode || 'SAR'
    ]);
  }
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `cashier-ai-report-${days}d-${dateStamp}.csv`
  );
  toast(`صُدّر تقرير ${days} ${days === 7 ? 'أيام' : 'يوماً'} بصيغة CSV`, {
    detail: `${formatNumber(invoices.length)} فاتورة · يفتح في Excel`,
    duration: 3600
  });
}

/* ------------------------------------------------------------------ */
/* Settings, backup, and import                                        */
/* ------------------------------------------------------------------ */

function resetTransientUi() {
  ui.posSearch = '';
  ui.category = 'all';
  ui.cartOpen = false;
  ui.discountOpen = false;
  ui.inventorySearch = '';
  ui.inventoryCategory = 'all';
  ui.inventoryFilter = 'all';
  ui.invoiceSearch = '';
  ui.invoicePayment = 'all';
  ui.invoicesLimit = 60;
}

function exportBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(store.exportSnapshot(), `cashier-ai-backup-${stamp}.json`);
  toast('صُدّرت نسخة من بياناتك', {
    detail: 'ملف JSON منفصل عن المتصفح — مفتاح Gemini غير مضمّن.',
    duration: 4200
  });
}

async function importBackup(file) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    toast('ملف النسخة أكبر من 8 م.ب ولا يمكن استيراده.', { tone: 'warning' });
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(await readFileAsText(file));
  } catch {
    toast('تعذّر قراءة ملف JSON. تأكد أن الملف نسخة تصدير صالحة.', { tone: 'error' });
    return;
  }
  const confirmed = await confirmDialog({
    title: 'استيراد نسخة؟',
    message: 'ستحل بيانات الملف محل المنتجات والفواتير والسلة الحالية على هذا الجهاز.',
    details: `<span class="mono">${escapeHtml(file.name)}</span>`,
    confirmLabel: 'استورد واستبدل',
    tone: 'danger'
  });
  if (!confirmed) return;
  try {
    const result = store.importSnapshot(parsed);
    resetTransientUi();
    toast('استُعيدت النسخة بنجاح', {
      detail: `${formatNumber(result.products)} منتج · ${formatNumber(result.invoices)} فاتورة`,
      duration: 4500
    });
  } catch (error) {
    reportError(error);
  }
}

async function restoreDemoWithConfirm() {
  const confirmed = await confirmDialog({
    title: 'استعادة البيانات التجريبية؟',
    message: 'ستُستبدل المنتجات والفواتير الحالية ببيانات العرض الأولى. الإعدادات المخصصة والمساعد الذكي تبقى محفوظة.',
    details: '<span>الخطوة لا يمكن التراجع عنها إلا من نسخة صدّرتها.</span>',
    confirmLabel: 'استعد نسخة العرض',
    tone: 'danger'
  });
  if (!confirmed) return;
  store.restoreDemo({ keepAiSettings: true });
  resetTransientUi();
  toast('عادت بقالة رواق التجريبية', {
    detail: 'منتجات وفواتير العرض جاهزة من جديد.',
    duration: 3800
  });
}

async function testGeminiFromForm(button) {
  const form = document.querySelector('[data-form="settings"]');
  if (!form) return;
  const result = document.querySelector('[data-gemini-result]');
  const apiKey = String(form.elements.geminiKey?.value || '').trim();
  const model = String(form.elements.geminiModel?.value || 'gemini-2.5-flash');
  if (!apiKey) {
    toast('أدخل مفتاح Gemini أولاً، أو اتركه فارغاً لاستخدام الوضع التجريبي.', { tone: 'warning' });
    form.elements.geminiKey?.focus();
    return;
  }
  if (result) {
    result.textContent = 'أجرّب الاتصال بـ Gemini…';
    result.dataset.tone = 'pending';
  }
  setButtonBusy(button, true, 'أختبر الاتصال…');
  try {
    await testGeminiConnection({ apiKey, model });
    if (result) {
      result.textContent = 'الاتصال ناجح — المفتاح والطراز جاهزان.';
      result.dataset.tone = 'success';
    }
    feedback();
  } catch (error) {
    if (result) {
      result.textContent = error?.message || 'تعذّر اختبار الاتصال.';
      result.dataset.tone = 'error';
    }
    feedback('error');
  } finally {
    setButtonBusy(button, false);
  }
}

function saveSettings(form) {
  const formData = new FormData(form);
  const storeName = String(formData.get('storeName') || '').trim();
  if (!storeName) {
    toast('اسم المتجر مطلوب ليظهر على الفواتير.', { tone: 'warning' });
    form.elements.storeName?.focus();
    return;
  }
  const vatRate = Number(formData.get('vatRate'));
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    toast('نسبة الضريبة يجب أن تكون بين ٠ و١٠٠.', { tone: 'warning' });
    form.elements.vatRate?.focus();
    return;
  }
  store.updateSettings({
    storeName,
    branch: String(formData.get('branch') || '').trim(),
    cashierName: String(formData.get('cashierName') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    currency: String(formData.get('currency') || 'ر.س').trim(),
    currencyCode: String(formData.get('currencyCode') || 'SAR').trim(),
    vatRate,
    pricesIncludeVat: formData.get('pricesIncludeVat') === 'on',
    sounds: formData.get('sounds') === 'on',
    geminiKey: String(formData.get('geminiKey') || '').trim(),
    geminiModel: String(formData.get('geminiModel') || 'gemini-2.5-flash')
  });
  toast('حُفظت إعدادات المتجر', {
    detail: 'ستظهر على الفواتير وملصقات المنتجات الجديدة.',
    duration: 3000
  });
}

function toggleKeyVisibility(button) {
  const input = document.getElementById('gemini-key');
  if (!input) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.innerHTML = icon(reveal ? 'eyeOff' : 'eye', { size: 17 });
  button.setAttribute('aria-label', reveal ? 'إخفاء مفتاح Gemini' : 'إظهار مفتاح Gemini');
  button.setAttribute('title', reveal ? 'إخفاء المفتاح' : 'إظهار المفتاح');
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

async function runAction(action, element) {
  const productId = element.dataset.id;
  switch (action) {
    case 'add-to-cart':
      try {
        addProductToCart(productId);
      } catch (error) {
        reportError(error);
      }
      break;
    case 'open-ai':
      openAiAssistant();
      break;
    case 'open-scanner':
      openScanner();
      break;
    case 'set-category':
      ui.category = element.dataset.category || 'all';
      renderAll({ preserveFocus: false });
      break;
    case 'clear-pos-search':
      ui.posSearch = '';
      renderAll({ preserveFocus: false });
      document.getElementById('pos-search')?.focus();
      break;
    case 'clear-filters':
      ui.posSearch = '';
      ui.category = 'all';
      renderAll({ preserveFocus: false });
      document.getElementById('pos-search')?.focus();
      break;
    case 'focus-search':
      focusSearch();
      break;
    case 'cart-minus':
    case 'cart-plus':
      try {
        store.adjustCartQuantity(productId, action === 'cart-plus' ? 1 : -1);
      } catch (error) {
        reportError(error);
      }
      break;
    case 'cart-remove':
      store.removeFromCart(productId);
      toast('أُزيل الصنف من الفاتورة', { tone: 'info', duration: 2000 });
      break;
    case 'clear-cart':
      await clearCartWithConfirm();
      break;
    case 'toggle-discount':
      ui.discountOpen = !ui.discountOpen;
      renderAll({ preserveFocus: false });
      if (ui.discountOpen) {
        setTimeout(() => document.querySelector('.discount-form [name="value"]')?.focus(), 30);
      }
      break;
    case 'clear-discount':
      ui.discountOpen = false;
      store.setDiscount('amount', 0);
      toast('أُزيل الخصم', { tone: 'info', duration: 2200 });
      break;
    case 'open-checkout':
      openCheckoutModal(store, { onViewInvoices: () => navigateTo('invoices') });
      break;
    case 'open-cart':
      openCartDrawer();
      break;
    case 'close-cart':
      closeCartDrawer();
      break;
    case 'open-labels':
      openLabelsModal(store);
      break;
    case 'create-product':
      openProductFormModal(store);
      break;
    case 'edit-product':
      openProductFormModal(store, { product: store.getProduct(productId) });
      break;
    case 'print-product-label':
      openLabelsModal(store, { initialIds: [productId] });
      break;
    case 'delete-product':
      await deleteProductWithConfirm(productId);
      break;
    case 'adjust-stock':
      try {
        store.adjustStock(productId, Number(element.dataset.delta) || 0);
      } catch (error) {
        reportError(error);
      }
      break;
    case 'set-stock-filter':
      ui.inventoryFilter = element.dataset.filter || 'all';
      renderAll({ preserveFocus: false });
      break;
    case 'clear-inventory-search':
      ui.inventorySearch = '';
      renderAll({ preserveFocus: false });
      document.getElementById('inventory-search')?.focus();
      break;
    case 'clear-inventory-filters':
      ui.inventorySearch = '';
      ui.inventoryCategory = 'all';
      ui.inventoryFilter = 'all';
      renderAll({ preserveFocus: false });
      break;
    case 'open-invoice':
      openInvoiceModal(store, productId);
      break;
    case 'print-invoice':
      printInvoiceById(productId);
      break;
    case 'set-invoice-payment':
      ui.invoicePayment = element.dataset.payment || 'all';
      ui.invoicesLimit = 60;
      renderAll({ preserveFocus: false });
      break;
    case 'clear-invoice-search':
      ui.invoiceSearch = '';
      renderAll({ preserveFocus: false });
      document.getElementById('invoice-search')?.focus();
      break;
    case 'more-invoices':
      ui.invoicesLimit += 60;
      renderAll({ preserveFocus: false });
      break;
    case 'clear-invoice-filters':
      ui.invoiceSearch = '';
      ui.invoicePayment = 'all';
      ui.invoicesLimit = 60;
      renderAll({ preserveFocus: false });
      break;
    case 'set-report-range':
      ui.reportDays = Number(element.dataset.days) === 30 ? 30 : 7;
      renderAll({ preserveFocus: false });
      break;
    case 'export-report':
      exportReportCsv(ui.reportDays);
      break;
    case 'toggle-key-visibility':
      toggleKeyVisibility(element);
      break;
    case 'test-gemini':
      await testGeminiFromForm(element);
      break;
    case 'export-data':
      exportBackup();
      break;
    case 'trigger-import':
      document.getElementById('import-file')?.click();
      break;
    case 'restore-demo':
      await restoreDemoWithConfirm();
      break;
    default:
      break;
  }
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!target || target.closest('dialog')) return;
  if (target.tagName === 'BUTTON') event.preventDefault();
  runAction(target.dataset.action, target).catch(reportError);
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === 'quick-scan-form') {
    event.preventDefault();
    const input = form.querySelector('#quick-scan-input');
    const raw = input?.value?.trim() || '';
    if (!raw) {
      input?.focus();
      return;
    }
    form.reset();
    input?.focus();
    handleBarcode(raw, { origin: 'quick' });
    return;
  }
  if (form.matches('[data-form="discount"]')) {
    event.preventDefault();
    submitDiscount(form).catch(reportError);
    return;
  }
  if (form.matches('[data-form="settings"]')) {
    event.preventDefault();
    saveSettings(form);
  }
});

document.addEventListener('input', (event) => {
  if (event.isComposing) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.id === 'pos-search') {
    ui.posSearch = input.value;
    queueRender();
    return;
  }
  if (input.id === 'inventory-search') {
    ui.inventorySearch = input.value;
    queueRender();
    return;
  }
  if (input.id === 'invoice-search') {
    ui.invoiceSearch = input.value;
    ui.invoicesLimit = 60;
    queueRender();
    return;
  }
  if (input.matches('[data-form="settings"] input[name="storeName"], [data-form="settings"] input[name="branch"], [data-form="settings"] input[name="cashierName"]')) {
    const preview = document.querySelector(`[data-preview="${input.name}"]`);
    if (preview) preview.textContent = input.value.trim() || '—';
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.matches('[data-select="inventory-category"]')) {
    ui.inventoryCategory = target.value || 'all';
    renderAll({ preserveFocus: false });
    return;
  }
  if (target.id === 'import-file') {
    const file = target.files?.[0];
    target.value = '';
    if (file) {
      importBackup(file).catch(reportError);
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const dialogOpen = Boolean(document.querySelector('dialog[open]'));
  const element = event.target;
  const isField = element instanceof Element && (
    element.matches('input, textarea, select') ||
    element.isContentEditable
  );

  if (event.key === 'F2') {
    if (dialogOpen) return;
    event.preventDefault();
    openScanner();
    return;
  }
  if (event.key === 'F3') {
    if (dialogOpen) return;
    event.preventDefault();
    openAiAssistant();
    return;
  }
  if (event.key === '/' && !isField && !dialogOpen) {
    event.preventDefault();
    focusSearch();
    return;
  }
  if (event.key === 'Escape') {
    if (dialogOpen) return;
    if (ui.cartOpen) {
      event.preventDefault();
      closeCartDrawer();
      return;
    }
  }
  if ((event.key === 'Enter' || event.key === ' ') && !isField) {
    const card = element instanceof Element ? element.closest('[data-action][role="button"]') : null;
    if (card) {
      event.preventDefault();
      card.click();
    }
  }
});

window.addEventListener('hashchange', () => syncRouteFromHash());
window.addEventListener('popstate', () => syncRouteFromHash());

store.subscribe((state, reason) => {
  if (reason === 'checkout') {
    ui.cartOpen = false;
    ui.discountOpen = false;
  }
  if (reason === 'import') {
    resetTransientUi();
  }
  if (store.lastPersistError && !storageWarningShown) {
    storageWarningShown = true;
    toast('تعذّر حفظ آخر تغيير في المتصفح', {
      tone: 'error',
      duration: 9000,
      detail: 'قد تكون المساحة ممتلئة. صدّر نسخة، ثم احذف صور منتجات كبيرة أو أفرغ بيانات قديمة.',
      actionLabel: 'افتح الإعدادات',
      onAction: () => navigateTo('settings')
    });
  }
  if (!store.lastPersistError) storageWarningShown = false;
  queueRender();
});

if (!isValidRoute(location.hash.replace(/^#\/?/, '').split('?')[0]) || !location.hash) {
  history.replaceState({ route: ui.route }, '', `#${ui.route}`);
}
renderAll({ preserveFocus: false, scroll: 'top', animate: false });
