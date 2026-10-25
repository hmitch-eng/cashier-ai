import { PAYMENT_LABELS } from './constants.js';
import { ean13Svg, formatBarcode } from './ean.js';
import { invoiceQrPayload, makeQrSvg, productQrPayload } from './qr.js';
import { escapeHtml, formatDate, formatMoney, formatTime } from './util.js';

const printArea = document.getElementById('print-area');

function markSvg() {
  return `<svg class="print-brand-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="#17382e"/>
    <path d="M17 18v29M25 18v29M33 18v20M41 18v29M49 18v20" stroke="#f8f2e7" stroke-width="4" stroke-linecap="round"/>
    <circle cx="47" cy="46" r="7" fill="#e7a93e"/>
  </svg>`;
}

export function renderInvoiceSheet(invoice) {
  const qr = makeQrSvg(invoiceQrPayload(invoice), {
    cellSize: 4,
    margin: 2,
    scalable: true,
    alt: `رمز فاتورة ${invoice.number}`
  });
  const rows = (invoice.items || [])
    .map(
      (item, index) => `
        <tr>
          <td><span class="print-row-number">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>${escapeHtml(item.name)}</td>
          <td class="mono"><span dir="ltr">${escapeHtml(item.barcode || '—')}</span></td>
          <td class="num">${escapeHtml(String(item.quantity))}</td>
          <td class="num">${escapeHtml(formatMoney(item.unitPrice, invoice.currency))}</td>
          <td class="num">${escapeHtml(formatMoney(item.lineTotal, invoice.currency))}</td>
        </tr>
      `
    )
    .join('');
  const payment = PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod || '—';
  return `
    <article class="print-sheet invoice-print">
      <header class="print-head">
        <div class="print-store">
          ${markSvg()}
          <div>
            <span class="print-eyebrow">كاشير AI · فاتورة بيع</span>
            <h1>${escapeHtml(invoice.store?.name || 'المتجر')}</h1>
            <p>${escapeHtml(invoice.store?.branch || '')}${invoice.store?.phone ? ` · ${escapeHtml(invoice.store.phone)}` : ''}</p>
          </div>
        </div>
        <div class="print-invoice-meta">
          <span>فاتورة</span>
          <strong class="mono">#${escapeHtml(invoice.number)}</strong>
          <small>${escapeHtml(formatDate(invoice.date, { year: 'numeric' }))} · ${escapeHtml(formatTime(invoice.date))}</small>
        </div>
      </header>

      <div class="print-details">
        <div><span>الكاشير</span><strong>${escapeHtml(invoice.cashierName || '—')}</strong></div>
        <div><span>طريقة الدفع</span><strong>${escapeHtml(payment)}</strong></div>
        <div><span>عدد الأصناف</span><strong class="mono">${escapeHtml(String(invoice.items?.length || 0))}</strong></div>
        <div><span>الكمية</span><strong class="mono">${escapeHtml(String(invoice.itemCount || 0))}</strong></div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th>الصنف</th>
            <th>الباركود</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <footer class="print-footer">
        <div class="print-thanks">
          <span class="print-eyebrow">شكراً لهذه الزيارة</span>
          <h2>نراك قريباً في ${escapeHtml(invoice.store?.name || 'المتجر')}.</h2>
          <p>هذه نسخة تجريبية من كاشير AI، وليست فاتورة ضريبية معتمدة.</p>
          <div class="print-qr-note">
            <span class="print-qr-code">${qr}</span>
            <div>
              <strong>ملخص الفاتورة</strong>
              <p dir="ltr" class="mono print-payload">${escapeHtml(invoiceQrPayload(invoice))}</p>
            </div>
          </div>
        </div>
        <div class="print-totals">
          <div><span>المجموع</span><strong class="num">${escapeHtml(formatMoney(invoice.subtotal, invoice.currency))}</strong></div>
          ${invoice.discountAmount > 0 ? `<div><span>الخصم</span><strong class="num">− ${escapeHtml(formatMoney(invoice.discountAmount, invoice.currency))}</strong></div>` : ''}
          <div><span>${invoice.taxIncluded ? 'منها الضريبة' : 'الضريبة'} (${escapeHtml(String(invoice.taxRate))}٪)</span><strong class="num">${escapeHtml(formatMoney(invoice.tax, invoice.currency))}</strong></div>
          <div class="print-grand"><span>الإجمالي</span><strong class="num">${escapeHtml(formatMoney(invoice.total, invoice.currency))}</strong></div>
          ${
            invoice.paymentMethod === 'cash'
              ? `<div class="print-cash"><span>المدفوع / الباقي</span><strong class="num">${escapeHtml(formatMoney(invoice.cashReceived, invoice.currency))} / ${escapeHtml(formatMoney(invoice.change, invoice.currency))}</strong></div>`
              : ''
          }
        </div>
      </footer>
    </article>
  `;
}

export function renderProductLabel(product, settings, copyIndex = 0) {
  const qr = makeQrSvg(productQrPayload(product, settings.currencyCode), {
    cellSize: 4,
    margin: 1,
    scalable: true,
    alt: `رمز منتج ${product.name}`
  });
  return `
    <div class="product-label">
      <div class="product-label-head">
        <span>${escapeHtml(settings.storeName)}</span>
        <small class="mono">${escapeHtml(String(copyIndex + 1).padStart(2, '0'))}</small>
      </div>
      <div class="product-label-name">${escapeHtml(product.name)}</div>
      <div class="product-label-main">
        <div class="product-label-qr">${qr}</div>
        <div class="product-label-info">
          <span class="product-label-price num">${escapeHtml(formatMoney(product.price, settings.currency))}</span>
          <span class="product-label-category">${escapeHtml(product.category)}</span>
          <div class="product-label-barcode">
            ${ean13Svg(product.barcode, { height: 28, label: `باركود ${product.name}` })}
            ${formatBarcode(product.barcode)}
          </div>
        </div>
      </div>
      <div class="product-label-foot">
        <span>منتج محلي</span>
        <span>${escapeHtml(settings.branch || '')}</span>
      </div>
    </div>
  `;
}

export function renderLabelsSheet({ products, settings, copies = 1 }) {
  const labels = [];
  for (const product of products) {
    for (let index = 0; index < Math.max(1, copies); index += 1) {
      labels.push(renderProductLabel(product, settings, index));
    }
  }
  return `<article class="print-sheet labels-sheet"><div class="labels-grid">${labels.join('')}</div></article>`;
}

export function printPreparedHtml(html, title = 'طباعة') {
  if (!printArea) return false;
  printArea.innerHTML = html;
  const previousTitle = document.title;
  document.title = title;
  document.body.classList.add('is-printing');
  const cleanup = () => {
    document.title = previousTitle;
    document.body.classList.remove('is-printing');
    printArea.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => {
        if (document.body.classList.contains('is-printing')) cleanup();
      }, 1000);
    });
  });
  return true;
}

export function printInvoice(invoice) {
  return printPreparedHtml(renderInvoiceSheet(invoice), `فاتورة ${invoice.number}`);
}

export function printLabels({ products, settings, copies = 1 }) {
  return printPreparedHtml(renderLabelsSheet({ products, settings, copies }), 'ملصقات المنتجات');
}

export { printArea };
