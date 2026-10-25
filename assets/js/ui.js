import { icon } from './icons.js';
import { escapeHtml, uid } from './util.js';

const modalRoot = document.getElementById('modal-root');
const toastRegion = document.getElementById('toast-region');
const openDialogs = [];
let toastCounter = 0;

function raiseToastLayer() {
  if (!toastRegion || typeof toastRegion.showPopover !== 'function') return;
  if (!toastRegion.children.length) return;
  try {
    if (toastRegion.matches(':popover-open')) toastRegion.hidePopover();
    toastRegion.showPopover();
  } catch {
    toastRegion.classList.add('toast-region--fallback');
  }
}

function hideToastLayer() {
  if (!toastRegion || typeof toastRegion.hidePopover !== 'function') return;
  if (toastRegion.children.length) return;
  try {
    if (toastRegion.matches(':popover-open')) toastRegion.hidePopover();
  } catch {
    // The page may be tearing down its top layer.
  }
}

export function openModal({
  title = '',
  kicker = '',
  body = '',
  footer = '',
  size = 'md',
  className = '',
  dismissible = true,
  onMount,
  onClose,
  initialFocus = ''
} = {}) {
  const titleId = uid('modal-title');
  const dialog = document.createElement('dialog');
  dialog.className = `modal modal--${size} ${className}`.trim();
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `
    <div class="modal-card">
      <header class="modal-head">
        <div class="modal-heading">
          ${kicker ? `<span class="modal-kicker">${escapeHtml(kicker)}</span>` : ''}
          <h2 id="${titleId}">${escapeHtml(title)}</h2>
        </div>
        ${dismissible ? `<button type="button" class="icon-btn modal-close" data-close-modal aria-label="إغلاق النافذة">${icon('close', { size: 20 })}</button>` : ''}
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>
  `;
  modalRoot.append(dialog);
  let cleanup = null;
  let cleanupCalled = false;
  const entry = { dialog, close: () => safeClose(dialog) };
  openDialogs.push(entry);
  document.body.classList.add('has-modal');

  const runCleanup = () => {
    if (cleanupCalled) return;
    cleanupCalled = true;
    try {
      if (typeof cleanup === 'function') cleanup();
      if (typeof onClose === 'function') onClose();
    } catch (error) {
      console.warn('Modal cleanup failed', error);
    }
  };

  dialog.addEventListener('close', () => {
    runCleanup();
    dialog.remove();
    const index = openDialogs.findIndex((item) => item.dialog === dialog);
    if (index >= 0) openDialogs.splice(index, 1);
    if (!openDialogs.length) document.body.classList.remove('has-modal');
  });

  dialog.addEventListener('click', (event) => {
    if (!dismissible) return;
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('cancel', (event) => {
    if (!dismissible) event.preventDefault();
  });

  dialog.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });

  dialog.showModal();
  raiseToastLayer();
  requestAnimationFrame(() => dialog.classList.add('is-visible'));

  if (typeof onMount === 'function') {
    try {
      const result = onMount(dialog, entry);
      if (result && typeof result.then === 'function') {
        result
          .then((maybeCleanup) => {
            if (typeof maybeCleanup === 'function') cleanup = maybeCleanup;
          })
          .catch((error) => console.warn('Modal setup failed', error));
      } else if (typeof result === 'function') {
        cleanup = result;
      }
    } catch (error) {
      console.warn('Modal setup failed', error);
    }
  }

  if (initialFocus) {
    requestAnimationFrame(() => {
      const target = dialog.querySelector(initialFocus);
      if (target) target.focus({ preventScroll: true });
    });
  } else {
    requestAnimationFrame(() => {
      const preferred = dialog.querySelector('[data-autofocus]');
      if (preferred) preferred.focus({ preventScroll: true });
    });
  }

  return {
    dialog,
    close: () => safeClose(dialog),
    setTitle: (nextTitle) => {
      const heading = dialog.querySelector(`#${titleId}`);
      if (heading) heading.textContent = nextTitle;
    },
    setLoading: (loading) => {
      dialog.classList.toggle('is-loading', Boolean(loading));
    }
  };
}

function safeClose(dialog) {
  if (!dialog) return;
  if (dialog.open) dialog.close();
  else dialog.remove();
}

export function closeTopModal() {
  const entry = openDialogs.at(-1);
  if (entry) safeClose(entry.dialog);
}

export function closeAllModals() {
  for (const entry of [...openDialogs].reverse()) safeClose(entry.dialog);
}

export function confirmDialog({
  title = 'تأكيد الإجراء',
  message = '',
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  tone = 'danger',
  details = ''
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const instance = openModal({
      title,
      size: 'sm',
      body: `
        <div class="confirm-body">
          <span class="confirm-icon confirm-icon--${escapeHtml(tone)}">${icon(tone === 'danger' ? 'alert' : 'info', { size: 24 })}</span>
          <p>${escapeHtml(message)}</p>
          ${details ? `<div class="confirm-details">${details}</div>` : ''}
        </div>
      `,
      footer: `
        <button type="button" class="btn btn--ghost" data-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}" data-confirm data-autofocus>${escapeHtml(confirmLabel)}</button>
      `,
      onMount(dialog) {
        dialog.querySelector('[data-confirm]').addEventListener('click', () => {
          finish(true);
          instance.close();
        });
        dialog.querySelector('[data-cancel]').addEventListener('click', () => {
          finish(false);
          instance.close();
        });
      },
      onClose() {
        finish(false);
      }
    });
  });
}

export function toast(message, {
  tone = 'success',
  detail = '',
  duration = 4200,
  actionLabel = '',
  onAction = null
} = {}) {
  if (!toastRegion) return null;
  toastCounter += 1;
  const toneIcons = {
    success: 'checkCircle',
    error: 'alert',
    warning: 'alert',
    info: 'info'
  };
  const element = document.createElement('div');
  element.className = `toast toast--${tone}`;
  element.setAttribute('role', 'status');
  element.dataset.toastId = String(toastCounter);
  element.innerHTML = `
    <span class="toast-icon">${icon(toneIcons[tone] || 'info', { size: 20 })}</span>
    <div class="toast-copy">
      <strong>${escapeHtml(message)}</strong>
      ${detail ? `<span>${escapeHtml(detail)}</span>` : ''}
      ${actionLabel ? `<button type="button" class="toast-action" data-toast-action>${escapeHtml(actionLabel)}</button>` : ''}
    </div>
    <button type="button" class="toast-close" aria-label="إغلاق التنبيه">${icon('close', { size: 15 })}</button>
  `;
  toastRegion.append(element);
  raiseToastLayer();
  requestAnimationFrame(() => element.classList.add('is-visible'));
  let timer = null;
  const dismiss = () => {
    if (!element.isConnected) return;
    clearTimeout(timer);
    element.classList.remove('is-visible');
    element.classList.add('is-leaving');
    setTimeout(() => {
      element.remove();
      hideToastLayer();
    }, 220);
  };
  const schedule = () => {
    if (duration > 0) timer = setTimeout(dismiss, duration);
  };
  element.querySelector('.toast-close').addEventListener('click', dismiss);
  const actionButton = element.querySelector('[data-toast-action]');
  if (actionButton) {
    actionButton.addEventListener('click', () => {
      try {
        onAction?.();
      } finally {
        dismiss();
      }
    });
  }
  element.addEventListener('mouseenter', () => clearTimeout(timer));
  element.addEventListener('mouseleave', schedule);
  schedule();
  return { dismiss, element };
}

let audioContext = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  audioContext = new AudioContext();
  return audioContext;
}

export function playSound(kind = 'success') {
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === 'suspended') context.resume();
    const now = context.currentTime;
    const notes = kind === 'scan' ? [920, 1240] : kind === 'error' ? [280, 210] : [620, 880];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.09);
      gain.gain.setValueAtTime(0.0001, now + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.055, now + index * 0.09 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.11);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * 0.09);
      oscillator.stop(now + index * 0.09 + 0.12);
    });
  } catch {
    // Audio is a progressive enhancement only.
  }
}

export function setButtonBusy(button, busy, busyLabel = 'جارٍ التنفيذ…') {
  if (!button) return;
  if (busy) {
    button.dataset.idleHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-busy');
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${escapeHtml(busyLabel)}</span>`;
  } else {
    button.disabled = false;
    button.classList.remove('is-busy');
    if (button.dataset.idleHtml) {
      button.innerHTML = button.dataset.idleHtml;
      delete button.dataset.idleHtml;
    }
  }
}

export function emptyState({ iconName = 'bag', title = '', text = '', action = '' } = {}) {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${icon(iconName, { size: 28 })}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${action}
    </div>
  `;
}
