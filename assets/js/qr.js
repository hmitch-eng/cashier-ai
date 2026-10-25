import { escapeHtml, hashString, roundMoney } from './util.js';

export function makeQrSvg(value, {
  cellSize = 4,
  margin = 2,
  scalable = true,
  className = '',
  alt = 'رمز QR'
} = {}) {
  if (!window.qrcode) {
    return `<div class="qr-fallback ${className}" aria-label="${escapeHtml(alt)}">QR</div>`;
  }
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(String(value));
    qr.make();
    return qr
      .createSvgTag({ cellSize, margin, scalable, alt })
      .replace('<svg ', `<svg class="qr-svg ${className}" `);
  } catch (error) {
    console.warn('QR generation failed', error);
    return `<div class="qr-fallback ${className}" aria-label="${escapeHtml(alt)}">QR</div>`;
  }
}

export function invoiceQrPayload(invoice) {
  const total = roundMoney(invoice.total).toFixed(2);
  const currency = invoice.currencyCode || 'SAR';
  const stamp = String(invoice.date || '').replace(/[:.]/g, '').slice(0, 15);
  const seed = `${invoice.number}|${stamp}|${total}|${invoice.items?.length || 0}`;
  return `CASHIER-AI|INVOICE|${invoice.number}|${stamp}|${currency}|${total}|V:${hashString(seed)}`;
}

export function productQrPayload(product, currencyCode = 'SAR') {
  const seed = `${product.barcode}|${product.price}|${product.name}`;
  return `CASHIER-AI|PRODUCT|${product.barcode}|${roundMoney(product.price).toFixed(2)}|${currencyCode}|V:${hashString(seed)}`;
}

export function qrMarkup(value, options = {}) {
  return `<div class="qr-holder ${options.wrapperClass || ''}">${makeQrSvg(value, options)}</div>`;
}
