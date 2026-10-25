import { escapeHtml } from './util.js';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13CheckDigit(firstTwelve) {
  const digits = String(firstTwelve).replace(/\D/g, '');
  if (digits.length !== 12) throw new Error('يتطلب حساب التحقق 12 رقماً.');
  const sum = digits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

export function makeEan13(baseTwelve) {
  const base = String(baseTwelve).replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  return `${base}${ean13CheckDigit(base)}`;
}

export function isValidEan13(code) {
  const digits = String(code).replace(/\D/g, '');
  if (digits.length !== 13) return false;
  return ean13CheckDigit(digits.slice(0, 12)) === digits.slice(12);
}

export function generateEan13(existing = [], prefix = '200') {
  const used = new Set(existing.map(String));
  for (let attempt = 0; attempt < 60; attempt += 1) {
    let base = String(prefix).replace(/\D/g, '').slice(0, 12);
    while (base.length < 12) {
      base += Math.floor(Math.random() * 10);
    }
    const code = makeEan13(base);
    if (!used.has(code)) return code;
  }
  const fallback = makeEan13(`${Date.now()}`.slice(-9).padStart(12, '0'));
  return fallback;
}

export function ean13Modules(code) {
  const digits = String(code).replace(/\D/g, '');
  if (digits.length !== 13) return null;
  const parity = PARITY[Number(digits[0])];
  const left = digits
    .slice(1, 7)
    .split('')
    .map((digit, index) => (parity[index] === 'L' ? L : G)[Number(digit)])
    .join('');
  const right = digits
    .slice(7)
    .split('')
    .map((digit) => R[Number(digit)])
    .join('');
  return `101${left}01010${right}101`;
}

export function ean13Svg(code, { height = 34, className = '', label = '' } = {}) {
  const modules = ean13Modules(code);
  if (!modules) return '';
  const quiet = 9;
  const total = modules.length + quiet * 2;
  let rects = '';
  let x = quiet;
  for (let index = 0; index < modules.length; index += 1) {
    if (modules[index] === '1') {
      const inGuard =
        index < 3 ||
        (index >= 45 && index < 50) ||
        index >= 92;
      const barHeight = inGuard ? height : height * 0.86;
      rects += `<rect x="${x}" y="0" width="1" height="${barHeight.toFixed(2)}"/>`;
    }
    x += 1;
  }
  return `<svg class="ean-svg ${className}" viewBox="0 0 ${total} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(label || `باركود ${code}`)}"><g fill="currentColor">${rects}</g></svg>`;
}

export function formatBarcode(code) {
  const digits = String(code).replace(/\D/g, '');
  if (digits.length !== 13) return escapeHtml(digits);
  return `<span dir="ltr" class="barcode-digits">${escapeHtml(`${digits[0]} ${digits.slice(1, 7)} ${digits.slice(7)}`)}</span>`;
}
