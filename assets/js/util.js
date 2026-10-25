const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const intFormatter = new Intl.NumberFormat('ar-SA-u-nu-latn', {
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
});

export const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const escapeAttr = escapeHtml;

export function cx(...values) {
  return values.filter(Boolean).join(' ');
}

export function formatMoney(value, currency = 'ر.س') {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${moneyFormatter.format(amount)} ${currency}`;
}

export function formatNumber(value, maximumFractionDigits = 2) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return numberFormatter.format(amount);
}

export function formatInt(value) {
  return intFormatter.format(Number(value) || 0);
}

export function formatPercent(value, maximumFractionDigits = 0) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${numberFormatter.format(amount)}٪`;
}

export function toArabicDigits(value) {
  return String(value).replace(/\d/g, (digit) => AR_DIGITS[Number(digit)]);
}

export function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dayKey(date = new Date()) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function parseDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options
  }).format(parseDate(date));
}

export function formatShortDate(date) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'short'
  }).format(parseDate(date));
}

export function formatDay(date) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    weekday: 'long'
  }).format(parseDate(date));
}

export function formatTime(date) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(parseDate(date));
}

export function formatDateTime(date) {
  return `${formatDate(date, { month: 'short' })}، ${formatTime(date)}`;
}

export function formatDateInput(date = new Date()) {
  const value = parseDate(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function relativeTime(date) {
  const diff = Date.now() - parseDate(date).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${formatInt(minutes)} د`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `قبل ${formatInt(hours)} س`;
  const days = Math.round(hours / 24);
  if (days < 30) return `قبل ${formatInt(days)} يوم`;
  return formatDate(date, { year: undefined });
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function uid(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

export function debounce(fn, delay = 180) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hashString(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function normalizeDigits(value) {
  return String(value)
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

export function normalizeSearch(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '');
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 ك.ب';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function downloadJson(data, filename) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذّرت قراءة الملف.'));
    reader.readAsText(file);
  });
}

export async function imageSourceFromFile(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('اختر ملف صورة صالحاً.');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('حجم الصورة أكبر من 15 م.ب.');
  }
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the image element for browsers with partial file support.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذّر فتح الصورة. جرّب صورة أخرى.'));
    };
    image.src = url;
  });
}

export function drawImageToCanvas(source, maxSize = 1000) {
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) throw new Error('أبعاد الصورة غير صالحة.');
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#f6f0e4';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function imageFileToJpeg(file, maxSize = 1100, quality = 0.84) {
  const source = await imageSourceFromFile(file);
  const canvas = drawImageToCanvas(source, maxSize);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (source.close) source.close();
  return dataUrl;
}

export function canvasToJpeg(canvas, quality = 0.82) {
  return canvas.toDataURL('image/jpeg', quality);
}

export function captureVideoFrame(video, maxSize = 1200) {
  if (!video || !video.videoWidth) throw new Error('الكاميرا لم تجهز بعد.');
  const canvas = document.createElement('canvas');
  const width = video.videoWidth;
  const height = video.videoHeight;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function dataUrlToBase64(dataUrl) {
  return String(dataUrl).split(',')[1] || '';
}

export function storageSizeBytes(value) {
  return new Blob([typeof value === 'string' ? value : JSON.stringify(value)]).size;
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function trapInputNumbers(input) {
  if (!input) return;
  input.addEventListener('keydown', (event) => {
    if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
  });
}
