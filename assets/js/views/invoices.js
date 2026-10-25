import { icon } from '../icons.js';
import { PAYMENT_METHODS } from '../constants.js';
import {
  currencyLabel,
  invoicePaymentIcon,
  paymentLabel,
  renderPageLead
} from '../components.js';
import {
  addDays,
  dayKey,
  escapeAttr,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
  normalizeSearch,
  roundMoney
} from '../util.js';

const PAYMENT_FILTERS = [{ id: 'all', label: 'كل الطرق' }, ...PAYMENT_METHODS.map((method) => ({ id: method.id, label: method.label }))];

function invoiceText(invoice) {
  return normalizeSearch(
    [
      invoice.number,
      invoice.cashierName,
      ...(invoice.items || []).map((item) => `${item.name} ${item.barcode}`)
    ].join(' ')
  );
}

function dayLabel(date) {
  const target = new Date(date);
  if (dayKey(target) === dayKey(new Date())) return 'اليوم';
  if (dayKey(target) === dayKey(addDays(new Date(), -1))) return 'أمس';
  return formatDate(target, { weekday: 'long' });
}

function renderStats(invoices, settings) {
  const total = roundMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0));
  const average = invoices.length ? roundMoney(total / invoices.length) : 0;
  const items = invoices.reduce((sum, invoice) => sum + Number(invoice.itemCount || 0), 0);
  const latest = invoices[0];
  return `
    <div class="ledger-stats ledger-stats--four" role="list">
      <article class="stat-stub" role="listitem">
        <span class="stat-label">فواتير محفوظة</span>
        <strong class="stat-value num">${escapeHtml(formatNumber(invoices.length))}</strong>
        <span class="stat-foot">كل السجل المحلي</span>
        <span class="stat-index mono" aria-hidden="true">01</span>
      </article>
      <article class="stat-stub" role="listitem">
        <span class="stat-label">قيمة المبيعات</span>
        <strong class="stat-value num">${escapeHtml(formatMoney(total, settings.currency))}</strong>
        <span class="stat-foot">${escapeHtml(formatNumber(items))} قطعة مباعة</span>
        <span class="stat-index mono" aria-hidden="true">02</span>
      </article>
      <article class="stat-stub" role="listitem">
        <span class="stat-label">متوسط الفاتورة</span>
        <strong class="stat-value num">${escapeHtml(formatMoney(average, settings.currency))}</strong>
        <span class="stat-foot">عبر كل الفواتير</span>
        <span class="stat-index mono" aria-hidden="true">03</span>
      </article>
      <article class="stat-stub" role="listitem">
        <span class="stat-label">آخر عملية بيع</span>
        <strong class="stat-value stat-value--date">${latest ? escapeHtml(formatDateTime(latest.date)) : '—'}</strong>
        <span class="stat-foot">${latest ? `فاتورة #${escapeHtml(latest.number)}` : 'لا مبيعات بعد'}</span>
        <span class="stat-index mono" aria-hidden="true">04</span>
      </article>
    </div>
  `;
}

function renderInvoiceRow(invoice) {
  const items = invoice.items || [];
  const first = items[0]?.name || 'فاتورة بيع';
  const rest = items.length - 1;
  return `
    <article class="invoice-row">
      <button type="button" class="invoice-row-main" data-action="open-invoice" data-id="${escapeAttr(invoice.id)}" aria-label="افتح الفاتورة ${escapeAttr(invoice.number)}">
        <span class="invoice-number"><span aria-hidden="true">#</span><span class="mono">${escapeHtml(invoice.number)}</span></span>
        <span class="invoice-when">
          <span class="mono">${escapeHtml(formatTime(invoice.date))}</span>
          <small>${escapeHtml(formatNumber(invoice.itemCount || 0))} قطعة</small>
        </span>
        <span class="invoice-summary">
          <strong>${escapeHtml(first)}${rest > 0 ? ` <span class="invoice-more">+${formatNumber(rest)}</span>` : ''}</strong>
          <small>${escapeHtml(items.length === 1 ? 'صنف واحد' : `${formatNumber(items.length)} أصناف`)} · ${escapeHtml(invoice.cashierName || 'الكاشير')}</small>
        </span>
        <span class="payment-chip payment-chip--${escapeAttr(invoice.paymentMethod)}">
          ${icon(invoicePaymentIcon(invoice.paymentMethod), { size: 14 })}
          ${escapeHtml(paymentLabel(invoice.paymentMethod))}
        </span>
        <span class="invoice-total num">${escapeHtml(formatMoney(invoice.total, invoice.currency || 'ر.س'))}</span>
        <span class="invoice-open-icon" aria-hidden="true">${icon('chevronDown', { size: 16, className: 'icon--rotate-90' })}</span>
      </button>
      <div class="invoice-row-actions">
        <button type="button" class="icon-btn" data-action="print-invoice" data-id="${escapeAttr(invoice.id)}" aria-label="طباعة الفاتورة ${escapeAttr(invoice.number)}" title="طباعة">${icon('print', { size: 16 })}</button>
        <button type="button" class="icon-btn" data-action="open-invoice" data-id="${escapeAttr(invoice.id)}" aria-label="تفاصيل الفاتورة ${escapeAttr(invoice.number)}" title="التفاصيل">${icon('receipt', { size: 16 })}</button>
      </div>
    </article>
  `;
}

function renderGroups(invoices, settings) {
  const grouped = new Map();
  for (const invoice of invoices) {
    const key = dayKey(invoice.date);
    if (!grouped.has(key)) {
      grouped.set(key, { date: invoice.date, items: [], total: 0, count: 0 });
    }
    const bucket = grouped.get(key);
    bucket.items.push(invoice);
    bucket.total = roundMoney(bucket.total + Number(invoice.total || 0));
    bucket.count += 1;
  }
  return [...grouped.values()]
    .map(
      (group) => `
        <section class="invoice-day" aria-label="${escapeAttr(dayLabel(group.date))}">
          <header class="invoice-day-head">
            <div class="invoice-day-title">
              <span class="day-pin" aria-hidden="true"></span>
              <h2>${escapeHtml(dayLabel(group.date))}</h2>
              <span class="invoice-day-date">${escapeHtml(formatDate(group.date, { weekday: undefined, year: 'numeric' }))}</span>
            </div>
            <div class="invoice-day-total">
              <span>${escapeHtml(formatNumber(group.count))} ${group.count === 1 ? 'فاتورة' : 'فواتير'}</span>
              <strong class="num">${escapeHtml(formatMoney(group.total, settings.currency))}</strong>
            </div>
          </header>
          <div class="invoice-rows">${group.items.map(renderInvoiceRow).join('')}</div>
        </section>
      `
    )
    .join('');
}

export function renderInvoices(state, ui = {}) {
  const settings = state.settings;
  const query = ui.invoiceSearch || '';
  const payment = ui.invoicePayment || 'all';
  const limit = Math.max(20, Number(ui.invoicesLimit) || 60);
  const text = normalizeSearch(query);
  const digits = String(query).replace(/\D/g, '');
  const filtered = state.invoices.filter((invoice) => {
    if (payment !== 'all' && invoice.paymentMethod !== payment) return false;
    if (!query) return true;
    return (
      invoiceText(invoice).includes(text) ||
      (digits.length > 0 && String(invoice.number).includes(digits))
    );
  });
  const visible = filtered.slice(0, limit);
  const lead = renderPageLead({
    eyebrow: 'سجل المبيعات · محفوظ محلياً',
    title: 'كل فاتورة، وأثرها',
    description: 'افتح أي فاتورة لمراجعة أصنافها ورمز QR، أو أعد طباعتها بنقرة واحدة.',
    action: `<a class="btn btn--primary" href="#pos">${icon('cartPlus', { size: 18 })} بيع جديد</a>`
  });

  return `
    <section class="page page--invoices" data-page="invoices">
      ${lead}
      ${renderStats(state.invoices, settings)}

      <div class="ledger-panel">
        <div class="ledger-toolbar">
          <div class="search-field search-field--soft">
            ${icon('search', { size: 18 })}
            <input
              id="invoice-search"
              type="search"
              value="${escapeAttr(query)}"
              placeholder="ابحث برقم الفاتورة أو الصنف…"
              autocomplete="off"
              aria-label="ابحث في الفواتير"
            >
            ${query ? `<button type="button" class="search-clear" data-action="clear-invoice-search" aria-label="مسح البحث">${icon('close', { size: 14 })}</button>` : ''}
          </div>
          <span class="result-count">${escapeHtml(`عرض ${formatNumber(visible.length)} من ${formatNumber(filtered.length)}`)}</span>
        </div>

        <div class="ledger-filterbar">
          <div class="filter-chips" role="group" aria-label="تصفية حسب طريقة الدفع">
            ${PAYMENT_FILTERS.map(
              (entry) => `
                <button type="button" class="filter-chip ${payment === entry.id ? 'is-active' : ''}" data-action="set-invoice-payment" data-payment="${escapeAttr(entry.id)}" aria-pressed="${payment === entry.id}">
                  ${escapeHtml(entry.label)}
                </button>
              `
            ).join('')}
          </div>
          <span class="ledger-hint">${icon('info', { size: 14 })} ${escapeHtml(formatNumber(filtered.reduce((sum, invoice) => sum + Number(invoice.itemCount || 0), 0)))} قطعة ضمن هذا العرض</span>
        </div>

        ${
          visible.length
            ? `<div class="invoice-ledger">${renderGroups(visible, settings)}</div>
               ${
                 filtered.length > visible.length
                   ? `<div class="ledger-load-more">
                       <p>عرضت ${escapeHtml(formatNumber(visible.length))} من ${escapeHtml(formatNumber(filtered.length))} فاتورة.</p>
                       <button type="button" class="btn btn--ghost btn--small" data-action="more-invoices">${icon('chevronDown', { size: 15 })} اعرض المزيد</button>
                     </div>`
                   : ''
               }`
            : `<div class="ledger-empty">
                ${icon('receipt', { size: 30 })}
                <h3>${state.invoices.length ? 'لا فواتير تطابق هذا البحث' : 'دفتر الفواتير جديد'}</h3>
                <p>${state.invoices.length ? 'جرّب رقماً آخر، أو امسح التصفية لعرض كل السجل.' : 'أول عملية بيع ستظهر هنا فوراً مع ملخص QR قابل للطباعة.'}</p>
                <div class="ledger-empty-actions">
                  ${state.invoices.length ? `<button type="button" class="btn btn--ghost" data-action="clear-invoice-filters">امسح التصفية</button>` : ''}
                  <a class="btn btn--primary" href="#pos">${icon('cartPlus', { size: 17 })} ابدأ البيع</a>
                </div>
              </div>`
        }

        <footer class="ledger-foot">
          <span>${icon('qr', { size: 14 })} لكل فاتورة رمز QR</span>
          <span class="ledger-foot-sep" aria-hidden="true"></span>
          <span>${icon('database', { size: 14 })} سجل محلي، دون خادم</span>
          <span class="ledger-foot-sep" aria-hidden="true"></span>
          <span>العملة ${escapeHtml(currencyLabel(settings))}</span>
        </footer>
      </div>
    </section>
  `;
}
