import {
  CameraError,
  cameraSupportError,
  startCamera,
  stopCamera
} from './camera.js';
import { drawImageToCanvas, imageSourceFromFile, normalizeDigits } from './util.js';

const PRODUCT_FORMATS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf'];
let supportedFormatsPromise = null;

export class ScannerError extends Error {
  constructor(message, code = 'SCANNER') {
    super(message);
    this.name = 'ScannerError';
    this.code = code;
  }
}

export function extractProductCode(value) {
  const text = String(value || '').trim();
  const productQr = text.match(/CASHIER-AI\|PRODUCT\|(\d{8,14})/i);
  if (productQr) return productQr[1];
  const invoiceQr = text.match(/CASHIER-AI\|INVOICE\|(\d+)/i);
  if (invoiceQr) return '';
  const digits = normalizeDigits(text);
  if (digits.length >= 8 && digits.length <= 14) return digits;
  return '';
}

async function getSupportedFormats() {
  if (supportedFormatsPromise) return supportedFormatsPromise;
  supportedFormatsPromise = (async () => {
    if (!('BarcodeDetector' in window) || typeof window.BarcodeDetector?.getSupportedFormats !== 'function') {
      return [];
    }
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      return PRODUCT_FORMATS.filter((format) => formats.includes(format));
    } catch {
      return [];
    }
  })();
  return supportedFormatsPromise;
}

function makeZxingReader() {
  if (!window.ZXing?.BrowserMultiFormatReader) return null;
  try {
    const hints = new Map();
    if (window.ZXing.DecodeHintType && window.ZXing.BarcodeFormat) {
      hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        window.ZXing.BarcodeFormat.QR_CODE,
        window.ZXing.BarcodeFormat.EAN_13,
        window.ZXing.BarcodeFormat.EAN_8,
        window.ZXing.BarcodeFormat.UPC_A,
        window.ZXing.BarcodeFormat.UPC_E,
        window.ZXing.BarcodeFormat.CODE_128,
        window.ZXing.BarcodeFormat.CODE_39,
        window.ZXing.BarcodeFormat.CODE_93,
        window.ZXing.BarcodeFormat.ITF
      ]);
    }
    return new window.ZXing.BrowserMultiFormatReader(hints, 220);
  } catch (error) {
    console.warn('ZXing initialization failed', error);
    return null;
  }
}

export async function startBarcodeScanner({ video, onResult, onStatus = () => {} }) {
  const supportError = cameraSupportError();
  if (supportError) throw new ScannerError(supportError, 'UNSUPPORTED');
  const supportedFormats = await getSupportedFormats();
  const hasNative = supportedFormats.length > 0;
  const zxingReader = hasNative ? null : makeZxingReader();
  if (!hasNative && !zxingReader) {
    throw new ScannerError(
      'قراءة الباركود التلقائية غير متاحة في هذا المتصفح. استخدم رفع الصورة أو الإدخال اليدوي.',
      'UNSUPPORTED'
    );
  }

  let stopped = false;
  let timer = null;
  let detector = null;
  let stream = null;

  const cleanup = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    try {
      zxingReader?.stopContinuousDecode();
      zxingReader?.reset();
    } catch {
      // The reader may not have started yet.
    }
    stopCamera(stream || video);
  };

  const process = async (raw) => {
    if (stopped) return;
    const code = extractProductCode(raw);
    if (!code) {
      onStatus('هذا الرمز ليس باركود منتج. جرّب باركود EAN أو UPC.', 'warning');
      return;
    }
    stopped = true;
    await cleanup();
    onResult(code);
  };

  try {
    if (zxingReader) {
      stream = await startCamera(video);
      onStatus('وجّه الكاميرا نحو الباركود، وقرّبها قليلاً.');
      zxingReader.decodeFromVideoElementContinuously(video, (result, error) => {
        if (stopped) return;
        if (result) {
          process(result.getText());
          return;
        }
        if (error && !/notfound/i.test(error?.name || error?.message || '')) {
          onStatus('أحافظ على المحاولة… ثبّت الباركود داخل الإطار.', 'trying');
        }
      });
    } else {
      stream = await startCamera(video);
      detector = new window.BarcodeDetector({ formats: supportedFormats });
      onStatus('وجّه الكاميرا نحو الباركود، وقرّبها قليلاً.');
      const tick = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            const results = await detector.detect(video);
            if (results.length) {
              const best = results.find((result) => extractProductCode(result.rawValue)) || results[0];
              await process(best.rawValue);
              return;
            }
          }
        } catch (error) {
          if (!['InvalidStateError', 'AbortError'].includes(error?.name)) {
            console.debug('Barcode detection frame skipped', error);
          }
        }
        if (!stopped) timer = setTimeout(tick, 260);
      };
      tick();
    }
  } catch (error) {
    await cleanup();
    if (error instanceof CameraError) throw new ScannerError(error.message, error.code);
    throw new ScannerError(error?.message || 'تعذّر بدء المسح.', 'SCANNER');
  }

  return {
    stop: async () => {
      if (stopped) {
        await cleanup();
        return;
      }
      stopped = true;
      await cleanup();
    },
    mode: hasNative ? 'native' : 'zxing'
  };
}

async function decodeCanvas(canvas) {
  const supportedFormats = await getSupportedFormats();
  if (supportedFormats.length && 'BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: supportedFormats });
      const results = await detector.detect(canvas);
      const match = results.find((result) => extractProductCode(result.rawValue));
      if (match) return match.rawValue;
    } catch (error) {
      console.debug('Native image scan failed', error);
    }
  }
  const reader = makeZxingReader();
  if (!reader) return '';
  try {
    const result = await reader.decodeFromImageUrl(canvas.toDataURL('image/jpeg', 0.92));
    return result?.getText?.() || '';
  } catch {
    return '';
  } finally {
    try {
      reader.reset();
    } catch {
      // Ignore cleanup failure.
    }
  }
}

export async function scanBarcodeFromFile(file) {
  let source;
  try {
    source = await imageSourceFromFile(file);
  } catch (error) {
    throw new ScannerError(error.message, 'FILE');
  }
  const canvas = drawImageToCanvas(source, 1600);
  if (source.close) source.close();
  const raw = await decodeCanvas(canvas);
  const code = extractProductCode(raw);
  if (!code) {
    throw new ScannerError(
      'لم أجد باركوداً واضحاً في الصورة. جرّب صورة أقرب، أو أدخل الرقم يدوياً.',
      'NOT_FOUND'
    );
  }
  return code;
}

export async function scanBarcodeFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const raw = await decodeCanvas(canvas);
        const code = extractProductCode(raw);
        if (!code) throw new ScannerError('لم أجد باركوداً واضحاً في الصورة.', 'NOT_FOUND');
        resolve(code);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new ScannerError('تعذّر فتح الصورة.', 'FILE'));
    image.src = dataUrl;
  });
}
