import { productArt } from './art.js';
import { icon } from './icons.js';
import { escapeAttr, escapeHtml, formatMoney } from './util.js';

export function productVisual(product, { className = '', eager = false } = {}) {
  if (product?.image) {
    return `<div class="product-art product-art--photo ${className}"><img src="${escapeAttr(product.image)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`;
  }
  return productArt(product?.art || 'pantry', { className });
}

export function stockState(product) {
  const stock = Number(product?.stock) || 0;
  const lowStock = Number(product?.lowStock) || 0;
  if (stock <= 0) return { key: 'out', label: 'نفد', tone: 'danger', detail: 'غير متوفر' };
  if (stock <= lowStock) return { key: 'low', label: 'منخفض', tone: 'warning', detail: `بقي ${stock}` };
  return { key: 'available', label: 'متوفر', tone: 'success', detail: `${stock} قطعة` };
}

export function stockPill(product) {
  const state = stockState(product);
  return `<span class="stock-pill stock-pill--${state.tone}"><i aria-hidden="true"></i>${escapeHtml(state.label)}</span>`;
}

export function stockNote(product) {
  const state = stockState(product);
  if (state.key === 'out') return 'نفد المخزون';
  if (state.key === 'low') return `بقي ${escapeHtml(String(product.stock))} فقط`;
  return `المخزون ${escapeHtml(String(product.stock))}`;
}

export function initials(name = '') {
  const clean = String(name).trim();
  if (!clean) return '؟';
  const parts = clean.split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`;
  return clean.slice(0, 2);
}

export function avatar(name, { size = 'md', className = '' } = {}) {
  return `<span class="avatar avatar--${size} ${className}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

export function miniQtyBadge(quantity) {
  if (!quantity) return '';
  return `<span class="in-cart-badge" aria-label="الكمية في السلة">${escapeHtml(String(quantity))}</span>`;
}

export function deltaBadge(delta) {
  if (delta === null || !Number.isFinite(delta)) {
    return `<span class="delta-badge delta-badge--flat">${icon('minus', { size: 13 })} لا مقارنة</span>`;
  }
  const positive = delta >= 0;
  return `<span class="delta-badge ${positive ? 'delta-badge--up' : 'delta-badge--down'}">${icon(positive ? 'arrowUp' : 'arrowDown', { size: 13 })}${escapeHtml(formatPercentNumber(delta))}</span>`;
}

function formatPercentNumber(delta) {
  const amount = Math.abs(Number(delta) || 0);
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(amount)}٪`;
}

export function emptyAction(label, { action, iconName = 'plus', attrs = '' } = {}) {
  return `<button type="button" class="btn btn--primary" data-action="${escapeAttr(action)}" ${attrs}>${icon(iconName, { size: 17 })} ${escapeHtml(label)}</button>`;
}

export function paymentLabel(method) {
  if (method === 'cash') return 'نقدي';
  if (method === 'wallet') return 'محفظة رقمية';
  return 'مدى / بطاقة';
}

export function invoicePaymentIcon(method) {
  return method === 'cash' ? 'banknote' : method === 'wallet' ? 'wallet' : 'card';
}

export function currencyLabel(settings) {
  return settings?.currency || 'ر.س';
}

export function formatPrice(value, settings) {
  return formatMoney(value, currencyLabel(settings));
}

export function renderPageLead({ eyebrow, title, description = '', action = '', extra = '' }) {
  return `
    <header class="page-lead">
      <div class="page-lead-copy">
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h1>${escapeHtml(title)}</h1>
        ${description ? `<p>${escapeHtml(description)}</p>` : ''}
      </div>
      <div class="page-lead-actions">${action}${extra}</div>
    </header>
  `;
}
