import { analyzeProductImage } from './ai.js';
import {
  CameraError,
  cameraSupportError,
  capturePhoto,
  friendlyCameraError,
  startCamera,
  stopCamera
} from './camera.js';
import { CommerceError } from './commerce.js';
import { PAYMENT_METHODS } from './constants.js';
import { ean13Svg, formatBarcode, isValidEan13 } from './ean.js';
import {
  currencyLabel,
  formatPrice,
  paymentLabel,
  productVisual,
  stockState
} from './components.js';
import { icon } from './icons.js';
import { printInvoice, printLabels, renderProductLabel } from './print.js';
import { invoiceQrPayload, makeQrSvg } from './qr.js';
import {
  scanBarcodeFromFile,
  ScannerError,
  startBarcodeScanner
} from './scanner.js';
import {
  confirmDialog,
  openModal,
  playSound,
  setButtonBusy,
  toast
} from './ui.js';
import {
  drawImageToCanvas,
  escapeAttr,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
  imageFileToJpeg,
  normalizeDigits,
  roundMoney,
  uid
} from './util.js';

function playFeedback(store, kind = 'success') {
  if (store?.state?.settings?.sounds === false) return;
  playSound(kind);
}

function fieldErrorsMarkup(name) {
  return `<span class="field-error" data-error-for="${escapeAttr(name)}" role="alert"></span>`;
}

function barcodePreviewMarkup(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 13) {
    return `<span class="barcode-preview-svg">${ean13Svg(digits, { height: 24, label: 'معاينة الباركود' })}</span><span class="barcode-preview-digits mono" dir="ltr">${escapeHtml(digits)}</span>`;
  }
  return `<span class="field-hint">${digits ? 'أكمل 13 رقماً ليظهر الباركود.' : 'اتركه فارغاً ليُولَّد تلقائياً، أو ولّد الآن.'}</span>`;
}

function productFieldsMarkup({ values = {}, categories = [], prefix = 'product', addToCart = null } = {}) {
  const listId = `${prefix}-categories`;
  return `
    <datalist id="${escapeAttr(listId)}">
      ${categories.map((category) => `<option value="${escapeAttr(category)}"></option>`).join('')}
    </datalist>
    <div class="form-grid form-grid--two">
      <label class="field field--wide">
        <span class="field-label">اسم المنتج</span>
        <input class="input" name="name" value="${escapeAttr(values.name || '')}" maxlength="80" required placeholder="مثال: تمر سكري فاخر 500غ" autocomplete="off">
        ${fieldErrorsMarkup('name')}
      </label>
      <label class="field">
        <span class="field-label">الفئة</span>
        <input class="input" name="category" value="${escapeAttr(values.category || '')}" list="${escapeAttr(listId)}" maxlength="60" required placeholder="تمور وحلويات">
        ${fieldErrorsMarkup('category')}
      </label>
      <label class="field">
        <span class="field-label">الباركود</span>
        <span class="input-group">
          <input class="input mono" name="barcode" value="${escapeAttr(values.barcode || '')}" maxlength="13" inputmode="numeric" dir="ltr" placeholder="6281000000090" autocomplete="off">
          <button type="button" class="input-group-btn" data-generate-barcode title="ولّد باركود EAN-13 جديداً">${icon('refresh', { size: 15 })} <span>ولّد</span></button>
        </span>
        ${fieldErrorsMarkup('barcode')}
        <span class="barcode-preview" data-barcode-preview>${barcodePreviewMarkup(values.barcode)}</span>
      </label>
      <label class="field">
        <span class="field-label">سعر البيع <small class="field-suffix">${escapeHtml(currencyLabel({ currency: values.currency }))}</small></span>
        <input class="input num" name="price" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeAttr(values.price ?? '')}" required placeholder="0.00">
        ${fieldErrorsMarkup('price')}
      </label>
      <label class="field">
        <span class="field-label">تكلفة الشراء</span>
        <input class="input num" name="cost" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeAttr(values.cost ?? '')}" required placeholder="0.00">
        ${fieldErrorsMarkup('cost')}
        <span class="field-hint">لهامش محسوب: <strong data-margin>—</strong></span>
      </label>
      <label class="field">
        <span class="field-label">الكمية في المخزون</span>
        <input class="input num" name="stock" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(values.stock ?? '')}" required placeholder="0">
        ${fieldErrorsMarkup('stock')}
      </label>
      <label class="field">
        <span class="field-label">حد التنبيه</span>
        <input class="input num" name="lowStock" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(values.lowStock ?? 3)}" required>
        ${fieldErrorsMarkup('lowStock')}
        <span class="field-hint">ننبّهك عند الوصول إلى هذه الكمية.</span>
      </label>
    </div>
    ${
      addToCart !== null
        ? `<label class="checkline checkline--card">
            <input type="checkbox" name="addToCart" ${addToCart ? 'checked' : ''}>
            <span><strong>أضف إلى السلة بعد الحفظ</strong><small>سيظهر المنتج مباشرة في الفاتورة الحالية.</small></span>
          </label>`
        : ''
    }
    <div class="form-error" data-form-error role="alert"></div>
  `;
}

function collectProductInput(form) {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || '').trim(),
    category: String(data.get('category') || '').trim(),
    barcode: normalizeDigits(data.get('barcode') || ''),
    price: Number(data.get('price')),
    cost: Number(data.get('cost')),
    stock: Math.floor(Number(data.get('stock'))),
    lowStock: Math.floor(Number(data.get('lowStock')))
  };
}

function clearFormErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((node) => {
    node.textContent = '';
  });
  form.querySelectorAll('.field.has-error').forEach((field) => field.classList.remove('has-error'));
  form.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute('aria-invalid'));
  const errorBox = form.querySelector('[data-form-error]');
  if (errorBox) {
    errorBox.textContent = '';
    errorBox.classList.remove('is-visible');
  }
}

function showFieldErrors(form, errors) {
  clearFormErrors(form);
  let firstInput = null;
  for (const [name, message] of Object.entries(errors)) {
    const hint = form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    if (hint) hint.textContent = message;
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      const field = input.closest('.field');
      if (field) field.classList.add('has-error');
      if (!firstInput) firstInput = input;
    }
  }
  if (firstInput) {
    firstInput.focus({ preventScroll: false });
    firstInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function showFormError(form, message) {
  const box = form.querySelector('[data-form-error]');
  if (!box) return;
  box.textContent = message;
  box.classList.add('is-visible');
}

function updateMargin(form) {
  const price = Number(form.elements.price?.value);
  const cost = Number(form.elements.cost?.value);
  const target = form.querySelector('[data-margin]');
  if (!target) return;
  if (!Number.isFinite(price) || !price) {
    target.textContent = '—';
    target.classList.remove('is-negative');
    return;
  }
  const margin = roundMoney(((price - cost) / price) * 100);
  target.textContent = `${formatNumber(margin)}٪`;
  target.classList.toggle('is-negative', margin < 0);
}

function updateBarcodePreview(form) {
  const preview = form.querySelector('[data-barcode-preview]');
  if (preview) preview.innerHTML = barcodePreviewMarkup(form.elements.barcode?.value);
}

function bindProductFields(form, store) {
  const barcode = form.elements.barcode;
  if (barcode) {
    barcode.addEventListener('input', () => {
      const raw = normalizeDigits(barcode.value).slice(0, 13);
      if (barcode.value !== raw) barcode.value = raw;
      updateBarcodePreview(form);
    });
    barcode.addEventListener('blur', () => {
      if (!barcode.value) return;
      if (barcode.value.length === 13 && !isValidEan13(barcode.value)) {
        const hint = form.querySelector('[data-error-for="barcode"]');
        if (hint) hint.textContent = 'رقم التحقق في هذا الباركود لا يطابق EAN-13. تأكد من الرقم أو ولّد واحداً.';
      }
    });
  }
  form.querySelector('[data-generate-barcode]')?.addEventListener('click', () => {
    const next = store.suggestBarcode();
    if (barcode) {
      barcode.value = next;
      barcode.focus();
    }
    updateBarcodePreview(form);
    const hint = form.querySelector('[data-error-for="barcode"]');
    if (hint) hint.textContent = '';
  });
  form.querySelectorAll('[name="price"], [name="cost"]').forEach((input) => {
    input.addEventListener('input', () => updateMargin(form));
  });
  form.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
    });
  });
  updateMargin(form);
}

async function shrinkImage(dataUrl, maxSize = 760, quality = 0.78) {
  if (!dataUrl) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = drawImageToCanvas(image, maxSize);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

/* ------------------------------------------------------------------ */
/* Barcode scanner                                                     */
/* ------------------------------------------------------------------ */

export function openScannerModal({ onCode = () => {}, sounds = true } = {}) {
  let scanner = null;
  let starting = false;
  let disposed = false;
  let finishing = false;
  let activeTab = 'camera';

  const instance = openModal({
    title: 'امسح باركود المنتج',
    kicker: 'الكاميرا · قراءة محلياً',
    size: 'md',
    className: 'scanner-modal',
    body: `
      <div class="scan-tabs" role="tablist" aria-label="طريقة المسح">
        <button type="button" class="scan-tab is-active" data-scan-tab="camera" role="tab" aria-selected="true">${icon('camera', { size: 17 })} الكاميرا</button>
        <button type="button" class="scan-tab" data-scan-tab="upload" role="tab" aria-selected="false">${icon('image', { size: 17 })} صورة</button>
        <button type="button" class="scan-tab" data-scan-tab="manual" role="tab" aria-selected="false">${icon('barcode', { size: 17 })} يدوي</button>
      </div>

      <section class="scan-panel" data-scan-panel="camera" role="tabpanel">
        <div class="scan-viewfinder" data-scan-viewfinder>
          <video data-scan-video playsinline muted autoplay aria-label="بث الكاميرا لمسح الباركود"></video>
          <div class="scan-guide" aria-hidden="true">
            <span class="scan-corner scan-corner--tl"></span>
            <span class="scan-corner scan-corner--tr"></span>
            <span class="scan-corner scan-corner--bl"></span>
            <span class="scan-corner scan-corner--br"></span>
            <span class="scan-beam"></span>
          </div>
          <div class="scan-status" data-scan-status data-tone="neutral">أطلب إذن الكاميرا…</div>
          <div class="scan-camera-error" data-scan-error hidden>
            <span class="scan-error-icon">${icon('camera', { size: 24 })}</span>
            <p data-scan-error-text></p>
            <div class="scan-error-actions">
              <button type="button" class="btn btn--ghost btn--small" data-scan-retry>${icon('refresh', { size: 15 })} أعد المحاولة</button>
              <button type="button" class="btn btn--dark btn--small" data-scan-goto="upload">${icon('upload', { size: 15 })} ارفع صورة</button>
            </div>
          </div>
        </div>
        <p class="scan-help">${icon('info', { size: 14 })} وجّه الكاميرا نحو الباركود أو رمز QR المطبوع على الملصق. القراءة تجري داخل جهازك.</p>
      </section>

      <section class="scan-panel" data-scan-panel="upload" role="tabpanel" hidden>
        <label class="scan-drop" data-scan-drop>
          <span class="scan-drop-icon">${icon('image', { size: 26 })}</span>
          <strong>اختر صورة باركود</strong>
          <span>أو أفلتها هنا — JPG أو PNG</span>
          <input type="file" accept="image/*" data-scan-file hidden>
        </label>
        <p class="scan-upload-status" data-scan-upload-status aria-live="polite"></p>
        <p class="scan-help">${icon('lock', { size: 14 })} لا تُرفع الصورة إلى أي خادم؛ يُقرأ الرمز في هذا المتصفح.</p>
      </section>

      <section class="scan-panel scan-manual-panel" data-scan-panel="manual" role="tabpanel" hidden>
        <form class="scan-manual-form" data-scan-manual novalidate>
          <label class="field">
            <span class="field-label">رقم الباركود</span>
            <input class="input mono scan-manual-input" name="code" inputmode="numeric" maxlength="14" dir="ltr" placeholder="6281000000014" autocomplete="off" data-scan-manual-input>
            <span class="field-hint">من 8 إلى 14 رقماً، أو امسح باركود EAN-13.</span>
          </label>
          <button type="submit" class="btn btn--primary">${icon('search', { size: 17 })} ابحث وأضف</button>
          <p class="field-error" data-scan-manual-error role="alert"></p>
        </form>
        <div class="scan-sample-hint">
          <span class="mono" dir="ltr">6281000000014</span>
          <button type="button" class="text-btn" data-scan-sample>جرّب هذا الرقم</button>
        </div>
      </section>
    `
  });

  const dialog = instance.dialog;
  const video = dialog.querySelector('[data-scan-video]');
  const statusEl = dialog.querySelector('[data-scan-status]');
  const errorBox = dialog.querySelector('[data-scan-error]');

  function setStatus(text, tone = 'neutral') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  function showCameraError(message) {
    setStatus('تعذّر تشغيل الكاميرا', 'error');
    if (!errorBox) return;
    errorBox.hidden = false;
    const text = errorBox.querySelector('[data-scan-error-text]');
    if (text) text.textContent = message;
    dialog.querySelector('[data-scan-viewfinder]')?.classList.add('has-error');
  }

  function clearCameraError() {
    if (!errorBox) return;
    errorBox.hidden = true;
    dialog.querySelector('[data-scan-viewfinder]')?.classList.remove('has-error');
  }

  async function stopScan() {
    const current = scanner;
    scanner = null;
    if (current) {
      try {
        await current.stop();
      } catch {
        // Scanning may have already stopped after a successful read.
      }
    }
    stopCamera(video);
  }

  async function startScan() {
    if (disposed || starting) return;
    if (activeTab !== 'camera') return;
    if (scanner) return;
    starting = true;
    clearCameraError();
    const supportError = cameraSupportError();
    if (supportError) {
      showCameraError(supportError);
      starting = false;
      return;
    }
    setStatus('أجهّز الكاميرا…', 'neutral');
    try {
      const handle = await startBarcodeScanner({
        video,
        onStatus: (text, tone) => setStatus(text, tone),
        onResult: (code) => finish(code)
      });
      if (disposed) {
        await handle.stop();
        return;
      }
      scanner = handle;
      setStatus('الكاميرا جاهزة · ثبّت الباركود داخل الإطار', 'ready');
    } catch (error) {
      if (disposed) return;
      showCameraError(error instanceof ScannerError || error instanceof CameraError ? error.message : friendlyCameraError(error));
    } finally {
      starting = false;
    }
  }

  async function finish(code) {
    if (finishing) return;
    finishing = true;
    const clean = normalizeDigits(code);
    setStatus('قرأت الرمز · جارٍ البحث', 'success');
    if (sounds) playSound('scan');
    await stopScan();
    if (disposed) return;
    instance.close();
    setTimeout(() => onCode(clean), 160);
  }

  function selectTab(tab) {
    if (activeTab === tab) return;
    activeTab = tab;
    dialog.querySelectorAll('[data-scan-tab]').forEach((button) => {
      const active = button.dataset.scanTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    dialog.querySelectorAll('[data-scan-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.scanPanel !== tab;
    });
    if (tab !== 'camera') stopScan();
    if (tab === 'camera') startScan();
    if (tab === 'manual') {
      requestAnimationFrame(() => dialog.querySelector('[data-scan-manual-input]')?.focus());
    }
  }

  dialog.querySelectorAll('[data-scan-tab]').forEach((button) => {
    button.addEventListener('click', () => selectTab(button.dataset.scanTab));
  });

  dialog.querySelector('[data-scan-retry]')?.addEventListener('click', async () => {
    await stopScan();
    startScan();
  });

  dialog.querySelectorAll('[data-scan-goto]').forEach((button) => {
    button.addEventListener('click', () => selectTab(button.dataset.scanGoto));
  });

  async function handleFile(file) {
    if (!file || disposed) return;
    const uploadStatus = dialog.querySelector('[data-scan-upload-status]');
    const drop = dialog.querySelector('[data-scan-drop]');
    if (drop) drop.classList.add('is-busy');
    if (uploadStatus) uploadStatus.textContent = `أفحص «${file.name}»…`;
    try {
      const code = await scanBarcodeFromFile(file);
      await finish(code);
    } catch (error) {
      if (uploadStatus) {
        uploadStatus.textContent = error instanceof ScannerError ? error.message : 'تعذّرت قراءة الصورة. جرّب صورة أوضح.';
        uploadStatus.classList.add('is-error');
      }
    } finally {
      if (drop) drop.classList.remove('is-busy');
    }
  }

  const fileInput = dialog.querySelector('[data-scan-file]');
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) handleFile(file);
  });

  const drop = dialog.querySelector('[data-scan-drop]');
  if (drop) {
    ['dragenter', 'dragover'].forEach((name) => {
      drop.addEventListener(name, (event) => {
        event.preventDefault();
        drop.classList.add('is-dragging');
      });
    });
    ['dragleave', 'drop'].forEach((name) => {
      drop.addEventListener(name, (event) => {
        event.preventDefault();
        drop.classList.remove('is-dragging');
      });
    });
    drop.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });
  }

  const manualForm = dialog.querySelector('[data-scan-manual]');
  manualForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = manualForm.querySelector('[data-scan-manual-input]');
    const error = manualForm.querySelector('[data-scan-manual-error]');
    const code = normalizeDigits(input?.value || '');
    if (code.length < 8 || code.length > 14) {
      if (error) error.textContent = 'أدخل من 8 إلى 14 رقماً.';
      input?.focus();
      return;
    }
    if (error) error.textContent = '';
    finish(code);
  });

  dialog.querySelector('[data-scan-sample]')?.addEventListener('click', () => {
    const input = dialog.querySelector('[data-scan-manual-input]');
    if (input) {
      input.value = '6281000000014';
      input.focus();
    }
  });

  dialog.addEventListener('close', () => {
    disposed = true;
    stopScan();
  }, { once: true });

  setTimeout(startScan, 180);
  return instance;
}

/* ------------------------------------------------------------------ */
/* AI product capture                                                  */
/* ------------------------------------------------------------------ */

function makeDemoSampleImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  const background = context.createLinearGradient(0, 0, 960, 720);
  background.addColorStop(0, '#f2e6cf');
  background.addColorStop(0.55, '#e6cfa9');
  background.addColorStop(1, '#cda16a');
  context.fillStyle = background;
  context.fillRect(0, 0, 960, 720);

  context.strokeStyle = 'rgba(81, 61, 35, 0.09)';
  context.lineWidth = 1.4;
  for (let x = 0; x < 960; x += 34) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 720);
    context.stroke();
  }
  for (let y = 0; y < 720; y += 34) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(960, y);
    context.stroke();
  }

  const light = context.createRadialGradient(330, 160, 20, 330, 160, 500);
  light.addColorStop(0, 'rgba(255, 250, 236, 0.9)');
  light.addColorStop(1, 'rgba(255, 250, 236, 0)');
  context.fillStyle = light;
  context.fillRect(0, 0, 960, 720);

  context.fillStyle = 'rgba(61, 43, 24, 0.16)';
  context.beginPath();
  context.ellipse(480, 600, 260, 40, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#3d5137';
  context.beginPath();
  context.roundRect(338, 206, 284, 372, 42);
  context.fill();
  context.strokeStyle = 'rgba(24, 42, 24, .35)';
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = '#f4e8cf';
  context.beginPath();
  context.roundRect(362, 328, 236, 186, 14);
  context.fill();
  context.strokeStyle = 'rgba(61, 50, 29, .3)';
  context.stroke();

  context.fillStyle = '#9b6b2e';
  context.beginPath();
  context.arc(480, 386, 44, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#e7b257';
  context.beginPath();
  context.arc(466, 372, 17, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(77, 48, 22, .62)';
  context.fillRect(418, 450, 124, 8);
  context.fillRect(438, 468, 84, 6);

  context.fillStyle = 'rgba(255, 252, 241, .3)';
  context.beginPath();
  context.roundRect(372, 230, 34, 300, 18);
  context.fill();

  context.fillStyle = '#6d3c2b';
  [[212, 566], [766, 545], [266, 612], [742, 618]].forEach(([x, y]) => {
    context.beginPath();
    context.ellipse(x, y, 28, 20, -0.4, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = 'rgba(85, 61, 31, 0.48)';
  context.font = '500 22px "IBM Plex Sans Arabic", sans-serif';
  context.direction = 'rtl';
  context.fillText('صورة تجريبية', 812, 678);

  return canvas.toDataURL('image/jpeg', 0.9);
}

function sourceBadge(mode, model) {
  if (mode === 'gemini') {
    return {
      className: 'is-gemini',
      label: 'Gemini',
      note: model ? `تحليل بصري · ${model}` : 'تحليل بصري حقيقي'
    };
  }
  return {
    className: 'is-demo',
    label: 'تجريبي',
    note: 'محاكاة مبنية على لون الصورة'
  };
}

export function openAiModal(store, { onSaved = null } = {}) {
  let stream = null;
  let disposed = false;
  let analysisRun = 0;
  let photo = null;
  let capturing = false;

  const categories = store.categories();
  const instance = openModal({
    title: 'صوّر منتجاً، وأضفه',
    kicker: 'المساعد البصري · منتج مجهول',
    size: 'lg',
    className: 'ai-modal',
    body: '<div class="ai-stage" data-ai-stage></div>',
    onClose: () => {
      disposed = true;
      analysisRun += 1;
      stopCamera(stream);
      stream = null;
    }
  });

  const stage = instance.dialog.querySelector('[data-ai-stage]');

  function stopAiCamera() {
    stopCamera(stream);
    stopCamera(stage.querySelector('[data-ai-video]'));
    stream = null;
  }

  async function startAiCamera() {
    stopAiCamera();
    const video = stage.querySelector('[data-ai-video]');
    const card = stage.querySelector('[data-ai-camera]');
    const errorPanel = stage.querySelector('[data-ai-camera-error]');
    if (!video || !card) return;
    card.classList.remove('is-ready', 'has-error');
    card.classList.add('is-connecting');
    try {
      const nextStream = await startCamera(video);
      if (disposed || !stage.contains(video)) {
        stopCamera(nextStream);
        return;
      }
      stream = nextStream;
      card.classList.add('is-ready');
      card.classList.remove('is-connecting');
      const shutter = stage.querySelector('[data-ai-shutter]');
      if (shutter) shutter.disabled = false;
      const status = stage.querySelector('[data-ai-capture-status]');
      if (status) status.textContent = 'الكاميرا جاهزة · ضع المنتج وسط الإطار';
    } catch (error) {
      card.classList.remove('is-connecting');
      card.classList.add('has-error');
      if (errorPanel) {
        errorPanel.hidden = false;
        const message = errorPanel.querySelector('[data-ai-camera-error-text]');
        if (message) message.textContent = error?.message || friendlyCameraError(error);
      }
      const shutter = stage.querySelector('[data-ai-shutter]');
      if (shutter) shutter.disabled = true;
    }
  }

  function renderCapture() {
    stopAiCamera();
    analysisRun += 1;
    photo = null;
    const settings = store.state.settings;
    const usingGemini = Boolean(settings.geminiKey);
    stage.innerHTML = `
      <div class="ai-flow-head">
        <div>
          <span class="ai-source ${usingGemini ? 'is-gemini' : 'is-demo'}">
            <i aria-hidden="true"></i>
            ${usingGemini ? icon('sparkles', { size: 13 }) : icon('sparkles', { size: 13 })}
            ${usingGemini ? 'Gemini جاهز' : 'وضع تجريبي'}
          </span>
          <h3>ضع المنتج في الإطار</h3>
          <p>${usingGemini ? 'ستُرسل الصورة إلى Gemini للتعرف على المنتج. النتيجة تُراجع قبل الحفظ.' : 'اقتراح تجريبي مبني على لون الصورة، وليس تعرّفاً حقيقياً. جرّبه الآن أو أضف مفتاح Gemini من الإعدادات.'}</p>
        </div>
        <a class="ai-settings-link" href="#settings" data-ai-settings>${icon('settings', { size: 15 })} إعدادات المساعد</a>
      </div>

      <div class="ai-capture-grid">
        <div class="ai-camera-card" data-ai-camera>
          <video data-ai-video playsinline muted autoplay aria-label="بث الكاميرا لالتقاط صورة المنتج"></video>
          <div class="ai-view-corners" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
          <div class="ai-camera-veil">
            <span class="spinner"></span>
            <span>أفتح الكاميرا…</span>
          </div>
          <div class="ai-camera-error" data-ai-camera-error hidden>
            <span>${icon('camera', { size: 24 })}</span>
            <p data-ai-camera-error-text>تعذّر تشغيل الكاميرا.</p>
            <div>
              <button type="button" class="btn btn--paper btn--small" data-ai-retry-camera>${icon('refresh', { size: 14 })} إعادة المحاولة</button>
            </div>
          </div>
          <button type="button" class="ai-shutter" data-ai-shutter disabled aria-label="التقط صورة المنتج">
            <span class="ai-shutter-ring"></span>
            <span class="ai-shutter-core">${icon('camera', { size: 22 })}</span>
          </button>
          <span class="ai-camera-note" data-ai-capture-status>أجهّز الكاميرا…</span>
        </div>

        <div class="ai-capture-side">
          <div class="ai-step-card">
            <span class="ai-step-number mono">01</span>
            <h4>صوّر أو ارفع</h4>
            <p>خلفية هادئة وإضاءة جيدة تعطيان أفضل اقتراح. المنتج وحده في الإطار.</p>
          </div>
          <div class="ai-capture-actions">
            <button type="button" class="btn btn--ghost" data-ai-upload-trigger>${icon('upload', { size: 17 })} ارفع صورة من الجهاز</button>
            <input type="file" accept="image/*" data-ai-file hidden>
            <button type="button" class="btn btn--ghost" data-ai-sample>${icon('sparkles', { size: 17 })} جرّب صورة تجريبية</button>
          </div>
          <p class="ai-capture-status" data-ai-upload-status aria-live="polite"></p>
          <div class="ai-privacy-note">
            ${icon('lock', { size: 15 })}
            <span>${usingGemini ? 'لا تُرسل الصورة إلا عند الضغط على زر التحليل، وتذهب إلى Google Gemini فقط.' : 'الصورة تبقى في هذا المتصفح. لا يتصل التطبيق بأي خدمة في الوضع التجريبي.'}</span>
          </div>
        </div>
      </div>
    `;

    stage.querySelector('[data-ai-shutter]')?.addEventListener('click', () => {
      if (capturing) return;
      const videoEl = stage.querySelector('[data-ai-video]');
      try {
        const captured = capturePhoto(videoEl, 1200);
        capturing = true;
        stopAiCamera();
        analyze(captured, { forceDemo: false });
      } catch (error) {
        toast(error?.message || 'انتظر لحظة حتى تجهز الكاميرا.', { tone: 'warning' });
      } finally {
        capturing = false;
      }
    });

    stage.querySelector('[data-ai-upload-trigger]')?.addEventListener('click', () => {
      stage.querySelector('[data-ai-file]')?.click();
    });

    stage.querySelector('[data-ai-file]')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      const status = stage.querySelector('[data-ai-upload-status]');
      if (!file) return;
      if (status) status.textContent = `أجهّز «${file.name}»…`;
      try {
        const dataUrl = await imageFileToJpeg(file, 1200, 0.86);
        if (disposed) return;
        stopAiCamera();
        analyze(dataUrl, { forceDemo: false });
      } catch (error) {
        if (status) status.textContent = error?.message || 'تعذّرت قراءة الصورة.';
      }
    });

    stage.querySelector('[data-ai-sample]')?.addEventListener('click', () => {
      const status = stage.querySelector('[data-ai-upload-status]');
      if (status) status.textContent = 'أحضّر صورة تجريبية…';
      try {
        const sample = makeDemoSampleImage();
        stopAiCamera();
        analyze(sample, { forceDemo: true });
      } catch {
        if (status) status.textContent = 'تعذّر تجهيز الصورة التجريبية.';
      }
    });

    stage.querySelector('[data-ai-retry-camera]')?.addEventListener('click', () => {
      const errorPanel = stage.querySelector('[data-ai-camera-error]');
      if (errorPanel) errorPanel.hidden = true;
      startAiCamera();
    });

    stage.querySelector('[data-ai-settings]')?.addEventListener('click', () => instance.close());

    setTimeout(startAiCamera, 120);
  }

  function renderAnalyzing(image, forceDemo) {
    const settings = store.state.settings;
    const usingGemini = !forceDemo && Boolean(settings.geminiKey);
    stage.innerHTML = `
      <div class="ai-analyzing" aria-live="polite">
        <div class="ai-analyzing-photo">
          <img src="${escapeAttr(image)}" alt="صورة المنتج الملتقطة">
          <div class="ai-scanline" aria-hidden="true"></div>
          <span class="ai-focus-tag">${icon('camera', { size: 13 })} لقطة جديدة</span>
        </div>
        <div class="ai-analyzing-copy">
          <span class="ai-source ${usingGemini ? 'is-gemini' : 'is-demo'}"><i aria-hidden="true"></i>${usingGemini ? 'Gemini يعمل' : 'محاكاة تجريبية'}</span>
          <h3>${usingGemini ? 'أقرأ ملامح المنتج…' : 'أقرأ ألوان الصورة…'}</h3>
          <p>${usingGemini ? 'قد يستغرق التحليل ثوانٍ. لا تغلق النافذة.' : 'في الوضع التجريبي أقترح منتجاً من عائلة لونية مشابهة. النتيجة قابلة للتعديل بالكامل.'}</p>
          <div class="ai-progress"><span></span></div>
          <ul class="ai-analyzing-steps">
            <li class="${usingGemini ? 'is-active' : 'is-done'}">${icon('check', { size: 12 })} استلام الصورة</li>
            <li class="is-active">${icon('sparkles', { size: 12 })} قراءة البصمة</li>
            <li>${icon('tag', { size: 12 })} اقتراح الاسم والسعر</li>
          </ul>
        </div>
      </div>
    `;
  }

  function renderAiError(message, { forceDemo, canUseDemo, retry }) {
    stage.innerHTML = `
      <div class="ai-error-state">
        <span class="ai-error-icon">${icon('alert', { size: 26 })}</span>
        <span class="eyebrow">تعذّر إكمال التحليل</span>
        <h3>لم أوصل إلى اقتراح هذه المرة</h3>
        <p>${escapeHtml(message)}</p>
        <div class="ai-error-actions">
          <button type="button" class="btn btn--primary" data-ai-error-retry>${icon('refresh', { size: 16 })} أعد المحاولة</button>
          ${canUseDemo ? `<button type="button" class="btn btn--ghost" data-ai-use-demo>${icon('sparkles', { size: 16 })} استخدم الاقتراح التجريبي</button>` : ''}
          <button type="button" class="btn btn--ghost" data-ai-error-manual>${icon('edit', { size: 16 })} أضف المنتج يدوياً</button>
        </div>
        <button type="button" class="text-btn" data-ai-error-back>${icon('arrowRight', { size: 14 })} صورة أخرى</button>
      </div>
    `;
    stage.querySelector('[data-ai-error-retry]')?.addEventListener('click', retry);
    stage.querySelector('[data-ai-use-demo]')?.addEventListener('click', () => {
      if (photo) analyze(photo, { forceDemo: true });
    });
    stage.querySelector('[data-ai-error-back]')?.addEventListener('click', renderCapture);
    stage.querySelector('[data-ai-error-manual]')?.addEventListener('click', () => {
      const current = photo;
      instance.close();
      openProductFormModal(store, {
        initial: { barcode: store.suggestBarcode() },
        image: current,
        addToCartDefault: true,
        onSaved: (product, details) => onSaved?.(product, details)
      });
    });
  }

  async function analyze(image, { forceDemo = false } = {}) {
    if (!image || disposed) return;
    photo = image;
    const run = ++analysisRun;
    stopAiCamera();
    renderAnalyzing(image, forceDemo);
    const settings = store.state.settings;
    try {
      const result = await analyzeProductImage({
        dataUrl: image,
        apiKey: settings.geminiKey,
        model: settings.geminiModel,
        settings,
        forceDemo
      });
      if (disposed || run !== analysisRun) return;
      renderReview(result, image);
    } catch (error) {
      if (disposed || run !== analysisRun) return;
      const usingGemini = !forceDemo && Boolean(settings.geminiKey);
      renderAiError(error?.message || 'تعذّر تحليل الصورة. جرّب صورة أخرى.', {
        forceDemo,
        canUseDemo: usingGemini,
        retry: () => analyze(image, { forceDemo })
      });
    }
  }

  function renderReview(result, image) {
    const suggestion = result.suggestion || {};
    const source = sourceBadge(result.mode, result.model);
    const isDemo = result.mode !== 'gemini';
    const initialBarcode = store.suggestBarcode();
    const confidence = suggestion.confidence != null && Number.isFinite(Number(suggestion.confidence))
      ? Math.round(Number(suggestion.confidence) * 100)
      : null;
    const formId = uid('ai-form');
    stage.innerHTML = `
      <div class="ai-review">
        <div class="ai-review-head">
          <div class="ai-review-photo">
            <img src="${escapeAttr(image)}" alt="صورة المنتج التي حللها المساعد">
            <span class="ai-review-stamp">${icon('camera', { size: 13 })} لقطة المساعد</span>
          </div>
          <div class="ai-review-verdict">
            <span class="ai-source ${source.className}"><i aria-hidden="true"></i>${escapeHtml(source.label)}</span>
            <h3>وجدت شيئاً يشبه هذا</h3>
            <p>${escapeHtml(result.note || source.note)}</p>
            ${confidence !== null ? `<div class="ai-confidence ${confidence >= 75 ? 'is-high' : confidence >= 50 ? 'is-mid' : 'is-low'}"><span>ثقة الاقتراح</span><div class="ai-confidence-bar" aria-hidden="true"><span style="inline-size:${confidence}%"></span></div><strong class="num">${escapeHtml(formatNumber(confidence))}٪</strong></div>` : ''}
            <div class="ai-mode-warning ${isDemo ? 'is-demo' : 'is-gemini'}">
              ${icon(isDemo ? 'info' : 'sparkles', { size: 15 })}
              <span>${isDemo ? 'هذا اقتراح تجريبي وليس تعرّفاً حقيقياً. عدّل الاسم والسعر والمخزون قبل الحفظ.' : 'نتيجة نموذج بصري — راجع الاسم والسعر دائماً قبل إضافته للمخزون.'}</span>
            </div>
            <button type="button" class="text-btn" data-ai-retake>${icon('camera', { size: 14 })} صورة أخرى</button>
          </div>
        </div>

        <form class="ai-review-form product-form" id="${escapeAttr(formId)}" data-form="ai-review" novalidate>
          ${productFieldsMarkup({
            values: {
              name: suggestion.name || '',
              category: suggestion.category || '',
              barcode: initialBarcode,
              price: suggestion.price ?? '',
              cost: suggestion.cost ?? '',
              stock: suggestion.stock ?? 12,
              lowStock: suggestion.lowStock ?? 4,
              currency: store.state.settings.currency
            },
            categories,
            prefix: formId,
            addToCart: true
          })}
          <div class="ai-review-actions">
            <button type="submit" class="btn btn--primary" name="after" value="cart">${icon('cartPlus', { size: 17 })} احفظ وأضف للسلة</button>
            <button type="submit" class="btn btn--ghost" name="after" value="save">${icon('check', { size: 17 })} احفظ فقط</button>
            <span class="ai-review-hint">${icon('qr', { size: 13 })} سيحصل المنتج على ملصق QR وباركود فور الحفظ.</span>
          </div>
        </form>
      </div>
    `;
    const form = stage.querySelector('form');
    bindProductFields(form, store);
    stage.querySelector('[data-ai-retake]')?.addEventListener('click', renderCapture);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.classList.contains('is-saving')) return;
      clearFormErrors(form);
      const input = collectProductInput(form);
      const { candidate, errors } = store.validateProduct(input);
      if (Object.keys(errors).length) {
        showFieldErrors(form, errors);
        return;
      }
      const submitter = event.submitter;
      form.classList.add('is-saving');
      form.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
      });
      if (submitter) setButtonBusy(submitter, true, 'أحفظ…');
      try {
        const storedImage = await shrinkImage(image);
        const product = store.addProduct({ ...input, barcode: candidate.barcode }, { image: storedImage });
        let addedToCart = false;
        const wantsCart = submitter?.value === 'cart' && Boolean(form.querySelector('[name="addToCart"]')?.checked);
        if (wantsCart) {
          try {
            store.addToCart(product.id);
            addedToCart = true;
          } catch (error) {
            toast('حُفظ المنتج، لكن لم يُضف للسلة', { tone: 'warning', detail: error.message });
          }
        }
        playFeedback(store);
        toast(addedToCart ? 'منتج جديد في السلة' : 'منتج جديد في المخزون', {
          detail: `${product.name} · ${formatPrice(product.price, store.state.settings)}${addedToCart ? ' · أضفناه للفاتورة' : ''}`,
          tone: 'success'
        });
        instance.close();
        onSaved?.(product, { addedToCart });
      } catch (error) {
        form.classList.remove('is-saving');
        form.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
        if (submitter) setButtonBusy(submitter, false);
        if (error instanceof CommerceError) {
          if (error.field) showFieldErrors(form, { [error.field]: error.message });
          else showFormError(form, error.message);
        } else {
          showFormError(form, error?.message || 'تعذّر حفظ المنتج.');
        }
      }
    });
  }

  renderCapture();
  return instance;
}

/* ------------------------------------------------------------------ */
/* Product form                                                        */
/* ------------------------------------------------------------------ */

export function openProductFormModal(store, {
  product = null,
  initial = null,
  image = null,
  scanned = false,
  addToCartDefault = false,
  onSaved = null
} = {}) {
  const isEditing = Boolean(product);
  const categories = store.categories();
  const formId = uid('product-form');
  let currentImage = product?.image || image || null;
  let imageRemoved = false;
  const values = {
    name: product?.name || initial?.name || '',
    category: product?.category || initial?.category || '',
    barcode: product?.barcode || initial?.barcode || store.suggestBarcode(),
    price: product?.price ?? initial?.price ?? '',
    cost: product?.cost ?? initial?.cost ?? '',
    stock: product?.stock ?? initial?.stock ?? 0,
    lowStock: product?.lowStock ?? initial?.lowStock ?? 3,
    currency: store.state.settings.currency
  };

  const instance = openModal({
    title: isEditing ? 'تعديل المنتج' : scanned ? 'باركود جديد على الرف' : 'منتج جديد',
    kicker: isEditing ? 'بطاقة الصنف · تعديل' : scanned ? `الباركود ${values.barcode}` : 'بطاقة صنف جديدة',
    size: 'md',
    className: 'product-modal',
    body: `
      ${scanned ? `<div class="scanned-note">${icon('scan', { size: 17 })}<span>هذا الباركود غير مسجّل بعد. أضف الاسم والسعر وسنعيده إلى السلة مباشرة.</span></div>` : ''}
      <form class="product-form" id="${escapeAttr(formId)}" novalidate>
        ${productFieldsMarkup({
          values,
          categories,
          prefix: formId,
          addToCart: isEditing ? null : Boolean(addToCartDefault || scanned)
        })}
        <div class="image-editor">
          <div class="image-editor-preview" data-product-image-preview>
            ${productVisual({ ...values, image: currentImage, art: product?.art }, { className: 'image-editor-art' })}
          </div>
          <div class="image-editor-copy">
            <strong>صورة المنتج <small>اختياري</small></strong>
            <p>تظهر على بطاقة الرف وسجل الفواتير. صورة واضحة، خلفية هادئة.</p>
            <div class="image-editor-actions">
              <button type="button" class="btn btn--ghost btn--small" data-product-image-trigger>${icon('upload', { size: 15 })} ${currentImage ? 'تغيير الصورة' : 'رفع صورة'}</button>
              <button type="button" class="text-btn ${currentImage ? '' : 'is-hidden'}" data-product-image-remove>إزالة</button>
              <input type="file" accept="image/*" data-product-image hidden>
            </div>
          </div>
        </div>
      </form>
    `,
    footer: `
      ${isEditing ? `<button type="button" class="btn btn--ghost btn--danger-ghost" data-product-delete>${icon('trash', { size: 16 })} حذف</button>` : ''}
      <span class="footer-spacer"></span>
      <button type="button" class="btn btn--ghost" data-close-modal>إلغاء</button>
      <button type="submit" form="${escapeAttr(formId)}" class="btn btn--primary">${icon('check', { size: 17 })} ${isEditing ? 'حفظ التعديلات' : 'أضف إلى المخزون'}</button>
    `
  });

  const dialog = instance.dialog;
  const form = dialog.querySelector('form');
  bindProductFields(form, store);

  const fileInput = dialog.querySelector('[data-product-image]');
  dialog.querySelector('[data-product-image-trigger]')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const trigger = dialog.querySelector('[data-product-image-trigger]');
    setButtonBusy(trigger, true, 'أجهّز الصورة…');
    try {
        currentImage = await imageFileToJpeg(file, 900, 0.82);
        imageRemoved = false;
        const preview = dialog.querySelector('[data-product-image-preview]');
        if (preview) preview.innerHTML = productVisual({ image: currentImage }, { className: 'image-editor-art' });
        dialog.querySelector('[data-product-image-remove]')?.classList.remove('is-hidden');
        if (trigger) trigger.dataset.idleHtml = `${icon('upload', { size: 15 })} تغيير الصورة`;
      } catch (error) {
        toast(error?.message || 'تعذّرت قراءة الصورة.', { tone: 'warning' });
      } finally {
        if (trigger) setButtonBusy(trigger, false);
        fileInput.value = '';
      }
  });

  dialog.querySelector('[data-product-image-remove]')?.addEventListener('click', () => {
    currentImage = null;
    imageRemoved = true;
    const preview = dialog.querySelector('[data-product-image-preview]');
    if (preview) preview.innerHTML = productVisual({ art: product?.art || 'pantry' }, { className: 'image-editor-art' });
    dialog.querySelector('[data-product-image-remove]')?.classList.add('is-hidden');
    const trigger = dialog.querySelector('[data-product-image-trigger]');
    if (trigger) trigger.innerHTML = `${icon('upload', { size: 15 })} رفع صورة`;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.classList.contains('is-saving')) return;
    clearFormErrors(form);
    const input = collectProductInput(form);
    const { candidate, errors } = store.validateProduct(input, product?.id || null);
    if (Object.keys(errors).length) {
      showFieldErrors(form, errors);
      return;
    }
    const submitButton = dialog.querySelector(`[type="submit"][form="${CSS.escape(formId)}"]`);
    form.classList.add('is-saving');
    setButtonBusy(submitButton, true, 'أحفظ…');
    try {
      let saved;
      let addedToCart = false;
      if (isEditing) {
        saved = store.updateProduct(product.id, { ...input, barcode: candidate.barcode }, {
          image: currentImage && currentImage !== product.image ? currentImage : undefined,
          removeImage: imageRemoved
        });
      } else {
        saved = store.addProduct({ ...input, barcode: candidate.barcode }, { image: currentImage });
        const wantsCart = Boolean(form.querySelector('[name="addToCart"]')?.checked);
        if (wantsCart) {
          try {
            store.addToCart(saved.id);
            addedToCart = true;
          } catch (error) {
            toast('حُفظ المنتج، لكن لم يُضف للسلة', { tone: 'warning', detail: error.message });
          }
        }
      }
      playFeedback(store);
      toast(isEditing ? 'حُدّثت بطاقة المنتج' : addedToCart ? 'منتج جديد في السلة' : 'منتج جديد في المخزون', {
        detail: `${saved.name} · ${formatPrice(saved.price, store.state.settings)}${addedToCart ? ' · أضفناه للفاتورة' : ''}`,
        tone: 'success'
      });
      instance.close();
      onSaved?.(saved, { addedToCart, isNew: !isEditing });
    } catch (error) {
      form.classList.remove('is-saving');
      if (submitButton) setButtonBusy(submitButton, false);
      if (error instanceof CommerceError) {
        if (error.field) showFieldErrors(form, { [error.field]: error.message });
        else showFormError(form, error.message);
      } else {
        showFormError(form, error?.message || 'تعذّر حفظ المنتج.');
      }
    }
  });

  dialog.querySelector('[data-product-delete]')?.addEventListener('click', async () => {
    if (!product) return;
    const confirmed = await confirmDialog({
      title: 'حذف المنتج من الرف؟',
      message: `سيُحذف «${product.name}» من المخزون والسلة الحالية. الفواتير القديمة تحتفظ بنسختها.`,
      details: `<span class="mono">${escapeHtml(product.barcode)}</span><span>${escapeHtml(formatPrice(product.price, store.state.settings))} · ${escapeHtml(formatNumber(product.stock))} قطعة</span>`,
      confirmLabel: 'احذف المنتج',
      tone: 'danger'
    });
    if (!confirmed) return;
    store.deleteProduct(product.id);
    instance.close();
    toast('حُذف المنتج من الرف', { tone: 'info', detail: product.name });
  });

  return instance;
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export function openLabelsModal(store, { initialIds = null } = {}) {
  const settings = store.state.settings;
  const allProducts = store.state.products;
  if (!allProducts.length) {
    toast('لا توجد منتجات لطباعة ملصقاتها.', { tone: 'warning', actionLabel: 'أضف منتجاً', onAction: () => openProductFormModal(store, {}) });
    return null;
  }
  const initialSet = initialIds?.length
    ? new Set(initialIds.filter((id) => allProducts.some((product) => product.id === id)))
    : new Set(allProducts.slice(0, allProducts.length > 60 ? 30 : allProducts.length).map((product) => product.id));
  const selected = new Set(initialSet);
  let copies = 1;
  const listed = allProducts.slice(0, 300);

  const instance = openModal({
    title: 'ملصقات المنتجات',
    kicker: 'QR + باركود · جاهزة للطباعة',
    size: 'lg',
    className: 'labels-modal',
    body: `
      <div class="labels-layout">
        <div class="labels-picker">
          <div class="labels-picker-head">
            <div>
              <h3>اختر الأصناف</h3>
              <p>كل ملصق يحمل QR وباركود المنتج.</p>
            </div>
            <span class="labels-selected-count" data-labels-count>${escapeHtml(formatNumber(selected.size))} محدد</span>
          </div>
          <div class="labels-controls">
            <button type="button" class="text-btn" data-labels-all>تحديد الكل</button>
            <button type="button" class="text-btn" data-labels-none>مسح</button>
            <span class="labels-controls-sep" aria-hidden="true"></span>
            <label class="labels-copies">${icon('print', { size: 14 })} نسخ لكل صنف
              <select class="select select--compact" data-labels-copies aria-label="عدد النسخ لكل منتج">
                ${[1, 2, 3, 4, 5, 6].map((value) => `<option value="${value}">${escapeHtml(formatNumber(value))}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="labels-list">
            ${listed
              .map((product) => {
                const checked = selected.has(product.id);
                return `
                  <label class="label-choice ${checked ? 'is-selected' : ''}" data-label-choice="${escapeAttr(product.id)}">
                    <input type="checkbox" data-label-check="${escapeAttr(product.id)}" ${checked ? 'checked' : ''}>
                    ${productVisual(product, { className: 'label-choice-art' })}
                    <span class="label-choice-copy">
                      <strong>${escapeHtml(product.name)}</strong>
                      <small>${escapeHtml(product.category)} · ${escapeHtml(formatPrice(product.price, settings))}</small>
                    </span>
                    <span class="label-choice-mark" aria-hidden="true">${icon('check', { size: 13 })}</span>
                  </label>
                `;
              })
              .join('')}
          </div>
          ${allProducts.length > listed.length ? `<p class="labels-cap-note">تعرض أول ${escapeHtml(formatNumber(listed.length))} منتجاً لتسريع النافذة. ابحث في المخزون لاختيار الباقي صنفاً صنفاً.</p>` : ''}
        </div>

        <div class="labels-preview">
          <div class="labels-preview-head">
            <span class="eyebrow">معاينة الملصق</span>
            <span class="labels-preview-meta" data-labels-summary>${escapeHtml(formatNumber(selected.size))} ملصق</span>
          </div>
          <div class="labels-preview-stage" data-labels-preview></div>
          <p class="labels-preview-note">${icon('info', { size: 13 })} تُطبع 3 ملصقات في كل صف على ورق A4، مع خطوط قص دقيقة.</p>
        </div>
      </div>
    `,
    footer: `
      <span class="labels-footnote">${icon('qr', { size: 14 })} امسح الرمز في الكاشير لإضافة المنتج فوراً</span>
      <span class="footer-spacer"></span>
      <button type="button" class="btn btn--ghost" data-close-modal>إلغاء</button>
      <button type="button" class="btn btn--primary" data-labels-print>${icon('print', { size: 17 })} اطبع الملصقات</button>
    `
  });

  const dialog = instance.dialog;
  const previewStage = dialog.querySelector('[data-labels-preview]');
  const summary = dialog.querySelector('[data-labels-summary]');
  const count = dialog.querySelector('[data-labels-count]');
  const printButton = dialog.querySelector('[data-labels-print]');

  function currentProducts() {
    return store.state.products.filter((product) => selected.has(product.id));
  }

  function paintPreview() {
    const products = currentProducts();
    if (!products.length) {
      previewStage.innerHTML = `<div class="labels-preview-empty">${icon('qr', { size: 28 })}<p>اختر صنفاً واحداً على الأقل لترى ملصقه.</p></div>`;
    } else {
      previewStage.innerHTML = renderProductLabel(products[0], settings, 0);
      const more = products.length - 1;
      if (more > 0) {
        const note = document.createElement('span');
        note.className = 'labels-preview-more';
        note.textContent = `+${formatNumber(more)} ${more === 1 ? 'صنف آخر' : 'أصناف أخرى'}`;
        previewStage.append(note);
      }
    }
    const total = products.reduce((sum, product) => sum + copies, 0);
    if (summary) summary.textContent = `${formatNumber(total)} ${total === 1 ? 'ملصق' : 'ملصقات'} · ${formatNumber(products.length)} ${products.length === 1 ? 'صنف' : 'أصناف'}`;
    if (count) count.textContent = `${formatNumber(selected.size)} محدد`;
    if (printButton) {
      printButton.disabled = !products.length;
      printButton.innerHTML = `${icon('print', { size: 17 })} ${products.length ? `اطبع ${formatNumber(total)} ملصقاً` : 'اطبع الملصقات'}`;
    }
    dialog.querySelectorAll('[data-label-choice]').forEach((row) => {
      const id = row.dataset.labelChoice;
      row.classList.toggle('is-selected', selected.has(id));
    });
  }

  dialog.querySelectorAll('[data-label-check]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.labelCheck;
      if (checkbox.checked) selected.add(id);
      else selected.delete(id);
      paintPreview();
    });
  });

  dialog.querySelector('[data-labels-all]')?.addEventListener('click', () => {
    for (const product of listed) selected.add(product.id);
    dialog.querySelectorAll('[data-label-check]').forEach((checkbox) => {
      checkbox.checked = true;
    });
    paintPreview();
  });

  dialog.querySelector('[data-labels-none]')?.addEventListener('click', () => {
    selected.clear();
    dialog.querySelectorAll('[data-label-check]').forEach((checkbox) => {
      checkbox.checked = false;
    });
    paintPreview();
  });

  dialog.querySelector('[data-labels-copies]')?.addEventListener('change', (event) => {
    copies = Math.max(1, Math.min(6, Number(event.target.value) || 1));
    paintPreview();
  });

  printButton?.addEventListener('click', () => {
    const products = currentProducts();
    if (!products.length) return;
    const printed = printLabels({ products, settings, copies });
    if (printed) {
      toast('أرسلت الملصقات إلى الطباعة', {
        tone: 'info',
        detail: `${formatNumber(products.length * copies)} ملصقاً · A4`,
        duration: 2600
      });
    }
  });

  paintPreview();
  return instance;
}

/* ------------------------------------------------------------------ */
/* Checkout and receipt                                                */
/* ------------------------------------------------------------------ */

export function openCheckoutModal(store, { onViewInvoices = null } = {}) {
  const cart = store.getCart();
  const settings = store.state.settings;
  if (!cart.lineCount) {
    toast('السلة فارغة. أضف صنفاً أولاً.', { tone: 'warning' });
    return null;
  }
  const exact = roundMoney(cart.total);
  const quickAmounts = [...new Set([exact, Math.ceil(exact / 10) * 10, Math.ceil(exact / 50) * 50, Math.ceil(exact / 100) * 100].filter((value) => value >= exact))].slice(0, 4);
  let method = 'cash';

  const instance = openModal({
    title: 'إتمام البيع',
    kicker: 'الصندوق · فاتورة جديدة',
    size: 'md',
    className: 'checkout-modal',
    body: `
      <div class="checkout-total">
        <div class="checkout-total-copy">
          <span class="eyebrow">الإجمالي المطلوب</span>
          <strong class="num" data-checkout-total>${escapeHtml(formatMoney(cart.total, settings.currency))}</strong>
          <span>${escapeHtml(formatNumber(cart.quantityCount))} قطعة · ${escapeHtml(formatNumber(cart.lineCount))} ${cart.lineCount === 1 ? 'صنف' : 'أصناف'} · منها ضريبة ${escapeHtml(formatMoney(cart.tax, settings.currency))}</span>
        </div>
        <span class="checkout-total-stamp">${icon('qr', { size: 19 })}<small>QR<br>جاهز</small></span>
      </div>

      <div class="checkout-items">
        ${cart.items
          .map(
            (item) => `
              <div class="checkout-item">
                <span class="checkout-item-qty mono">×${escapeHtml(formatNumber(item.quantity))}</span>
                <span class="checkout-item-name">${escapeHtml(item.product.name)}</span>
                <span class="checkout-item-price num">${escapeHtml(formatMoney(item.lineTotal, settings.currency))}</span>
              </div>
            `
          )
          .join('')}
      </div>

      <div class="checkout-section">
        <span class="field-label">طريقة الدفع</span>
        <div class="payment-options" role="radiogroup" aria-label="طريقة الدفع">
          ${PAYMENT_METHODS.map(
            (payment, index) => `
              <label class="payment-option ${index === 0 ? 'is-selected' : ''}" data-payment-option="${escapeAttr(payment.id)}" data-payment-choice="${escapeAttr(payment.id)}">
                <input type="radio" name="payment" value="${escapeAttr(payment.id)}" ${index === 0 ? 'checked' : ''}>
                <span class="payment-option-icon">${icon(payment.icon, { size: 19 })}</span>
                <span>${escapeHtml(payment.label)}</span>
                <span class="payment-option-check" aria-hidden="true">${icon('check', { size: 12 })}</span>
              </label>
            `
          ).join('')}
        </div>
      </div>

      <div class="cash-panel" data-cash-panel>
        <label class="field">
          <span class="field-label">المبلغ المستلم نقداً</span>
          <input class="input input--cash mono" type="number" inputmode="decimal" min="${exact}" step="0.01" value="${escapeAttr(exact.toFixed(2))}" data-cash-input>
        </label>
        <div class="cash-quick" role="group" aria-label="مبالغ سريعة">
          ${quickAmounts
            .map(
              (amount, index) =>
                `<button type="button" class="cash-chip ${index === 0 ? 'is-exact' : ''}" data-cash-amount="${amount}">${index === 0 ? 'بالضبط' : escapeHtml(formatNumber(amount))}</button>`
            )
            .join('')}
        </div>
        <div class="cash-change">
          <span>الباقي للعميل</span>
          <strong class="num" data-cash-change>${escapeHtml(formatMoney(0, settings.currency))}</strong>
        </div>
      </div>

      <div class="checkout-note">${icon('lock', { size: 14 })} ستُخصم الكميات من المخزون، وتُحفظ الفاتورة محلياً مع رمز QR.</div>
      <div class="form-error" data-checkout-error role="alert"></div>
    `,
    footer: `
      <button type="button" class="btn btn--ghost" data-close-modal>رجوع للسلة</button>
      <span class="footer-spacer"></span>
      <button type="button" class="btn btn--primary checkout-confirm" data-checkout-confirm>${icon('check', { size: 18 })} تأكيد البيع</button>
    `
  });

  const dialog = instance.dialog;
  const cashInput = dialog.querySelector('[data-cash-input]');
  const cashPanel = dialog.querySelector('[data-cash-panel]');
  const changeEl = dialog.querySelector('[data-cash-change]');
  const errorBox = dialog.querySelector('[data-checkout-error]');
  const confirmButton = dialog.querySelector('[data-checkout-confirm]');

  function updateChange() {
    const received = Number(cashInput?.value) || 0;
    const change = roundMoney(received - exact);
    if (changeEl) {
      changeEl.textContent = method === 'cash' ? formatMoney(Math.max(0, change), settings.currency) : '—';
      changeEl.classList.toggle('is-short', method === 'cash' && change < 0);
    }
    if (errorBox) {
      errorBox.classList.remove('is-visible');
      errorBox.textContent = '';
    }
  }

  function selectMethod(next) {
    method = next;
    dialog.querySelectorAll('[data-payment-choice]').forEach((option) => {
      const active = option.dataset.paymentChoice === next;
      option.classList.toggle('is-selected', active);
      const input = option.querySelector('input');
      if (input) input.checked = active;
    });
    if (cashPanel) cashPanel.hidden = next !== 'cash';
    updateChange();
  }

  dialog.querySelectorAll('[data-payment-choice]').forEach((option) => {
    option.addEventListener('click', (event) => {
      event.preventDefault();
      selectMethod(option.dataset.paymentChoice);
    });
  });

  cashInput?.addEventListener('input', updateChange);
  dialog.querySelectorAll('[data-cash-amount]').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!cashInput) return;
      cashInput.value = Number(chip.dataset.cashAmount).toFixed(2);
      updateChange();
    });
  });

  confirmButton?.addEventListener('click', () => {
    const received = method === 'cash' ? Number(cashInput?.value) : null;
    if (method === 'cash' && (!Number.isFinite(received) || received < exact)) {
      if (errorBox) {
        errorBox.textContent = 'المبلغ المستلم أقل من الإجمالي. عدّل المبلغ أو اختر طريقة أخرى.';
        errorBox.classList.add('is-visible');
      }
      cashInput?.focus();
      return;
    }
    setButtonBusy(confirmButton, true, 'أُقفل الفاتورة…');
    try {
      const invoice = store.checkout({ paymentMethod: method, cashReceived: method === 'cash' ? received : null });
      if (errorBox) errorBox.classList.remove('is-visible');
      playFeedback(store);
      instance.close();
      toast(`فاتورة #${invoice.number} محفوظة`, {
        tone: 'success',
        detail: `${formatMoney(invoice.total, invoice.currency)} · ${paymentLabel(invoice.paymentMethod)}`,
        duration: 3600
      });
      openReceiptModal(invoice, { onViewInvoices });
    } catch (error) {
      setButtonBusy(confirmButton, false);
      if (errorBox) {
        errorBox.textContent = error?.message || 'تعذّر إتمام البيع.';
        errorBox.classList.add('is-visible');
      }
      if (error instanceof CommerceError && error.code === 'STOCK') {
        playFeedback(store, 'error');
      }
    }
  });

  selectMethod('cash');
  requestAnimationFrame(() => cashInput?.select());
  return instance;
}

export function openReceiptModal(invoice, { onViewInvoices = null } = {}) {
  const qr = makeQrSvg(invoiceQrPayload(invoice), {
    cellSize: 4,
    margin: 1,
    scalable: true,
    alt: `رمز فاتورة ${invoice.number}`
  });
  const instance = openModal({
    title: 'تم حفظ الفاتورة',
    kicker: 'الصندوق · تم البيع بنجاح',
    size: 'sm',
    className: 'receipt-modal',
    dismissible: true,
    body: `
      <div class="receipt-success">
        <span class="receipt-tick" aria-hidden="true">${icon('check', { size: 28 })}</span>
        <span class="eyebrow">المخزون حُدّث والفاتورة محفوظة</span>
        <h3>شكراً لهذه الزيارة</h3>
        <p>${escapeHtml(invoice.store?.name || '')} · ${escapeHtml(formatDateTime(invoice.date))}</p>
      </div>
      <div class="receipt-stub">
        <div class="receipt-stub-head">
          <div><span>فاتورة</span><strong class="mono">#${escapeHtml(invoice.number)}</strong></div>
          <div><span>الإجمالي</span><strong class="num">${escapeHtml(formatMoney(invoice.total, invoice.currency))}</strong></div>
        </div>
        <div class="receipt-stub-body">
          <div class="receipt-qr">${qr}<span>امسح للتحقق من الملخص</span></div>
          <ul class="receipt-meta">
            <li><span>طريقة الدفع</span><strong>${escapeHtml(paymentLabel(invoice.paymentMethod))}</strong></li>
            <li><span>عدد القطع</span><strong class="num">${escapeHtml(formatNumber(invoice.itemCount))}</strong></li>
            ${invoice.paymentMethod === 'cash' ? `<li><span>المدفوع</span><strong class="num">${escapeHtml(formatMoney(invoice.cashReceived, invoice.currency))}</strong></li><li><span>الباقي</span><strong class="num">${escapeHtml(formatMoney(invoice.change, invoice.currency))}</strong></li>` : ''}
            <li class="receipt-items-preview"><span>أول صنف</span><strong>${escapeHtml(invoice.items[0]?.name || '—')}${invoice.items.length > 1 ? ` <small>+${formatNumber(invoice.items.length - 1)}</small>` : ''}</strong></li>
          </ul>
        </div>
        <footer class="receipt-stub-foot"><span>${icon('qr', { size: 13 })} QR جاهز للطباعة</span><span>${escapeHtml(formatTime(invoice.date))}</span></footer>
      </div>
    `,
    footer: `
      <button type="button" class="btn btn--ghost" data-receipt-new>فاتورة جديدة</button>
      ${onViewInvoices ? `<button type="button" class="btn btn--ghost" data-receipt-history>السجل</button>` : ''}
      <span class="footer-spacer"></span>
      <button type="button" class="btn btn--dark" data-receipt-print>${icon('print', { size: 17 })} اطبع الفاتورة</button>
    `
  });

  const dialog = instance.dialog;
  dialog.querySelector('[data-receipt-new]')?.addEventListener('click', () => instance.close());
  dialog.querySelector('[data-receipt-history]')?.addEventListener('click', () => {
    instance.close();
    onViewInvoices?.();
  });
  dialog.querySelector('[data-receipt-print]')?.addEventListener('click', () => {
    const printed = printInvoice(invoice);
    if (!printed) toast('تعذّرت تهيئة الطباعة في هذا المتصفح.', { tone: 'warning' });
  });
  return instance;
}

/* ------------------------------------------------------------------ */
/* Invoice detail                                                      */
/* ------------------------------------------------------------------ */

export function openInvoiceModal(store, invoiceId) {
  const invoice = store.state.invoices.find((entry) => entry.id === invoiceId) || store.state.invoices.find((entry) => entry.number === invoiceId);
  if (!invoice) {
    toast('لم أجد هذه الفاتورة في السجل.', { tone: 'warning' });
    return null;
  }
  const qr = makeQrSvg(invoiceQrPayload(invoice), {
    cellSize: 4,
    margin: 1,
    scalable: true,
    alt: `رمز فاتورة ${invoice.number}`
  });
  const instance = openModal({
    title: `فاتورة \u2066#${invoice.number}\u2069`,
    kicker: 'سجل الفواتير · نسخة محفوظة',
    size: 'md',
    className: 'invoice-modal',
    body: `
      <article class="invoice-detail">
        <header class="invoice-detail-head">
          <div>
            <span class="eyebrow">${escapeHtml(invoice.store?.name || 'فاتورة بيع')}</span>
            <h3>${escapeHtml(invoice.store?.branch || '')}</h3>
            <p>${escapeHtml(formatDateTime(invoice.date))} · الكاشير ${escapeHtml(invoice.cashierName || '—')}</p>
          </div>
          <div class="invoice-detail-badges">
            <span class="payment-chip payment-chip--${escapeAttr(invoice.paymentMethod)}">${icon('checkCircle', { size: 14 })} ${escapeHtml(paymentLabel(invoice.paymentMethod))}</span>
            <span class="invoice-saved-badge">${icon('database', { size: 13 })} محفوظة محلياً</span>
          </div>
        </header>

        <div class="invoice-detail-main">
          <div class="invoice-detail-items">
            ${invoice.items
              .map(
                (item, index) => `
                  <div class="invoice-detail-line">
                    <span class="invoice-line-index mono">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
                    <span class="invoice-line-name"><strong>${escapeHtml(item.name)}</strong><small class="mono" dir="ltr">${escapeHtml(item.barcode || '')}</small></span>
                    <span class="invoice-line-calc"><small>${escapeHtml(formatNumber(item.quantity))} × ${escapeHtml(formatMoney(item.unitPrice, invoice.currency))}</small><strong class="num">${escapeHtml(formatMoney(item.lineTotal, invoice.currency))}</strong></span>
                  </div>
                `
              )
              .join('')}
          </div>
          <aside class="invoice-detail-side">
            <div class="invoice-detail-qr">${qr}<span>رمز ملخص الفاتورة</span></div>
            <div class="invoice-totals">
              <div><span>المجموع</span><strong class="num">${escapeHtml(formatMoney(invoice.subtotal, invoice.currency))}</strong></div>
              ${invoice.discountAmount > 0 ? `<div><span>الخصم</span><strong class="num">− ${escapeHtml(formatMoney(invoice.discountAmount, invoice.currency))}</strong></div>` : ''}
              <div><span>${invoice.taxIncluded ? 'منها الضريبة' : 'الضريبة'} (${escapeHtml(formatNumber(invoice.taxRate))}٪)</span><strong class="num">${escapeHtml(formatMoney(invoice.tax, invoice.currency))}</strong></div>
              <div class="invoice-grand"><span>الإجمالي</span><strong class="num">${escapeHtml(formatMoney(invoice.total, invoice.currency))}</strong></div>
              ${invoice.paymentMethod === 'cash' ? `<div class="invoice-cash"><span>المدفوع</span><strong class="num">${escapeHtml(formatMoney(invoice.cashReceived, invoice.currency))}</strong></div><div class="invoice-cash"><span>الباقي</span><strong class="num">${escapeHtml(formatMoney(invoice.change, invoice.currency))}</strong></div>` : ''}
            </div>
          </aside>
        </div>

        <footer class="invoice-detail-foot">
          <span>${escapeHtml(formatNumber(invoice.itemCount))} قطعة في ${escapeHtml(formatNumber(invoice.items.length))} ${invoice.items.length === 1 ? 'صنف' : 'أصناف'}</span>
          <span>نسخة تجريبية — ليست فاتورة ضريبية معتمدة</span>
        </footer>
      </article>
    `,
    footer: `
      <span class="footer-note">${icon('qr', { size: 13 })} بيانات الفاتورة لا تتغير بعد الحفظ</span>
      <span class="footer-spacer"></span>
      <button type="button" class="btn btn--ghost" data-close-modal>إغلاق</button>
      <button type="button" class="btn btn--primary" data-invoice-print>${icon('print', { size: 17 })} اطبع</button>
    `
  });

  instance.dialog.querySelector('[data-invoice-print]')?.addEventListener('click', () => {
    printInvoice(invoice);
  });
  return instance;
}
