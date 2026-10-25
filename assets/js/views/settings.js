import { APP_NAME, APP_VERSION } from '../constants.js';
import { avatar, currencyLabel, renderPageLead } from '../components.js';
import { icon } from '../icons.js';
import {
  escapeAttr,
  escapeHtml,
  formatBytes,
  formatDate,
  formatNumber,
  formatTime
} from '../util.js';

function aiStatus(settings) {
  const ready = Boolean(settings.geminiKey);
  return {
    ready,
    label: ready ? 'Gemini جاهز عند الطلب' : 'وضع تجريبي — دون مفتاح',
    tone: ready ? 'success' : 'warning'
  };
}

function renderStorePass(settings) {
  return `
    <article class="store-pass" aria-label="معاينة هوية المتجر">
      <header class="store-pass-head">
        <span class="eyebrow">بطاقة المتجر</span>
        <span class="local-stamp">محلي ١٠٠٪</span>
      </header>
      <div class="store-pass-id">
        <span class="store-pass-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <rect width="64" height="64" rx="15" fill="currentColor"/>
            <path d="M17 18v29M25 18v29M33 18v20M41 18v29M49 18v20" stroke="#f8f2e7" stroke-width="4" stroke-linecap="round"/>
            <circle cx="47" cy="46" r="7" fill="#e7a93e"/>
          </svg>
        </span>
        <div>
          <h2 data-preview="storeName">${escapeHtml(settings.storeName)}</h2>
          <p data-preview="branch">${escapeHtml(settings.branch)}</p>
        </div>
      </div>
      <div class="store-pass-grid">
        <div><span>الكاشير</span><strong data-preview="cashierName">${escapeHtml(settings.cashierName)}</strong></div>
        <div><span>العملة</span><strong>${escapeHtml(settings.currency)} <small class="mono">${escapeHtml(settings.currencyCode)}</small></strong></div>
        <div><span>الضريبة</span><strong class="num">${escapeHtml(formatNumber(settings.vatRate))}٪</strong></div>
        <div><span>الهاتف</span><strong class="mono" dir="ltr">${escapeHtml(settings.phone || '—')}</strong></div>
      </div>
      <footer class="store-pass-foot">
        <span>${icon('database', { size: 13 })} بيانات هذا الجهاز</span>
        <span class="mono">${escapeHtml(formatDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' }))}</span>
      </footer>
    </article>
  `;
}

function renderDataCard(state, extras) {
  const storageBytes = Number(extras.storageBytes) || 0;
  const quota = 5 * 1024 * 1024;
  const percent = Math.min(100, Math.max(1.5, (storageBytes / quota) * 100));
  const lastSaved = extras.lastSavedAt ? `${formatTime(extras.lastSavedAt)}` : 'الآن';
  return `
    <article class="settings-card data-card">
      <header class="settings-card-head">
        <span class="settings-icon">${icon('database', { size: 19 })}</span>
        <div>
          <h2>نسخة جهازك</h2>
          <p>لا يوجد خادم ولا حساب. أنت تحتفظ بالنسخة.</p>
        </div>
      </header>

      <div class="data-counts">
        <div><strong class="num">${escapeHtml(formatNumber(state.products.length))}</strong><span>منتج</span></div>
        <div><strong class="num">${escapeHtml(formatNumber(state.invoices.length))}</strong><span>فاتورة</span></div>
        <div><strong class="num">${escapeHtml(formatNumber(state.cart.items.length))}</strong><span>في السلة</span></div>
      </div>

      <div class="storage-block">
        <div class="storage-head">
          <span>المساحة المستخدمة</span>
          <strong class="num">${escapeHtml(formatBytes(storageBytes))}</strong>
        </div>
        <div class="storage-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}" aria-label="مساحة التخزين المستخدمة">
          <span style="inline-size:${percent}%"></span>
        </div>
        <p>آخر حفظ ${escapeHtml(lastSaved)} · الحد التقريبي للمتصفح ٥ م.ب. صدّر نسخة دورياً.</p>
      </div>

      <div class="data-actions">
        <button type="button" class="btn btn--ghost btn--small" data-action="export-data">${icon('download', { size: 16 })} صدّر نسخة</button>
        <button type="button" class="btn btn--ghost btn--small" data-action="trigger-import">${icon('upload', { size: 16 })} استورد نسخة</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <button type="button" class="text-btn text-btn--danger data-reset" data-action="restore-demo">${icon('refresh', { size: 14 })} استعد البيانات التجريبية</button>
      </div>
      <p class="data-warning">${icon('alert', { size: 14 })} الاستيراد أو الاستعادة يستبدل المنتجات والفواتير الحالية. صدّر نسخة أولاً.</p>
    </article>
  `;
}

export function renderSettings(state, ui = {}, extras = {}) {
  const settings = state.settings;
  const ai = aiStatus(settings);
  const categories = [...new Set([...state.products.map((product) => product.category)])];
  const lead = renderPageLead({
    eyebrow: 'إعدادات المتجر · هذا الجهاز',
    title: 'اضبط المتجر على ذوقك',
    description: 'الاسم، الضريبة، الهوية، ومساعد المنتجات. كل تغيير يُحفظ في نسخة المتصفح فقط.',
    action: `<span class="mode-pill mode-pill--${ai.tone}"><i aria-hidden="true"></i>${escapeHtml(ai.label)}</span>`
  });

  return `
    <section class="page page--settings" data-page="settings">
      ${lead}
      <div class="settings-layout">
        <form class="settings-form" data-form="settings" novalidate>
          <article class="settings-card">
            <header class="settings-card-head">
              <span class="settings-icon">${icon('store', { size: 19 })}</span>
              <div>
                <h2>هوية المتجر</h2>
                <p>تظهر على الفواتير وملصقات المنتجات.</p>
              </div>
              <span class="section-number mono" aria-hidden="true">01</span>
            </header>
            <div class="form-grid form-grid--two">
              <label class="field field--wide">
                <span class="field-label">اسم المتجر</span>
                <input class="input" name="storeName" value="${escapeAttr(settings.storeName)}" maxlength="60" required autocomplete="organization">
                <span class="field-hint">كما تحب أن يراه العميل على الفاتورة.</span>
              </label>
              <label class="field">
                <span class="field-label">الفرع أو الحي</span>
                <input class="input" name="branch" value="${escapeAttr(settings.branch)}" maxlength="60" placeholder="حي النخيل">
              </label>
              <label class="field">
                <span class="field-label">اسم الكاشير</span>
                <input class="input" name="cashierName" value="${escapeAttr(settings.cashierName)}" maxlength="40" autocomplete="name">
              </label>
              <label class="field">
                <span class="field-label">هاتف المتجر</span>
                <input class="input" name="phone" value="${escapeAttr(settings.phone)}" maxlength="30" inputmode="tel" dir="ltr" placeholder="+966 55 123 4567">
              </label>
            </div>
          </article>

          <article class="settings-card">
            <header class="settings-card-head">
              <span class="settings-icon">${icon('receipt', { size: 19 })}</span>
              <div>
                <h2>البيع والضريبة</h2>
                <p>العملة، ضريبة القيمة المضافة، والتنبيهات.</p>
              </div>
              <span class="section-number mono" aria-hidden="true">02</span>
            </header>
            <div class="form-grid form-grid--three">
              <label class="field">
                <span class="field-label">رمز العملة</span>
                <input class="input" name="currency" value="${escapeAttr(settings.currency)}" maxlength="8">
                <span class="field-hint">مثل: ${escapeHtml(currencyLabel(settings))}</span>
              </label>
              <label class="field">
                <span class="field-label">كود العملة ISO</span>
                <input class="input mono" name="currencyCode" value="${escapeAttr(settings.currencyCode)}" maxlength="4" dir="ltr" style="text-transform:uppercase">
                <span class="field-hint">SAR · USD · AED</span>
              </label>
              <label class="field">
                <span class="field-label">نسبة الضريبة</span>
                <div class="input-suffix">
                  <input class="input num" name="vatRate" type="number" min="0" max="100" step="0.5" inputmode="decimal" value="${escapeAttr(String(settings.vatRate))}">
                  <span>٪</span>
                </div>
                <span class="field-hint">السعودية: ١٥٪ افتراضياً.</span>
              </label>
            </div>

            <div class="switch-list">
              <label class="switch-row">
                <span class="switch-copy"><strong>الأسعار تشمل الضريبة</strong><small>يعرض سعر الرف كما يدفعه العميل، وتُحسب الضريبة منه.</small></span>
                <input type="checkbox" name="pricesIncludeVat" ${settings.pricesIncludeVat ? 'checked' : ''}>
                <span class="switch-track" aria-hidden="true"></span>
              </label>
              <label class="switch-row">
                <span class="switch-copy"><strong>أصوات الصندوق</strong><small>نغمة خفيفة عند المسح وإتمام البيع.</small></span>
                <input type="checkbox" name="sounds" ${settings.sounds ? 'checked' : ''}>
                <span class="switch-track" aria-hidden="true"></span>
              </label>
            </div>
          </article>

          <article class="settings-card settings-card--ai">
            <header class="settings-card-head">
              <span class="settings-icon settings-icon--ai">${icon('sparkles', { size: 19 })}</span>
              <div>
                <h2>مساعد المنتجات الذكي</h2>
                <p>وضع تجريبي جاهز فوراً، أو تعرّف بصري حقيقي عبر Gemini.</p>
              </div>
              <span class="section-number mono" aria-hidden="true">03</span>
            </header>

            <div class="ai-state ${ai.ready ? 'is-ready' : ''}">
              <span class="ai-state-orbit" aria-hidden="true">${icon('sparkles', { size: 20 })}</span>
              <div>
                <strong>${ai.ready ? 'مفتاح Gemini محفوظ' : 'تعمل الآن بنمط العرض'}</strong>
                <p>${ai.ready ? 'عند التقاط صورة في المساعد، تُرسل إلى Google Gemini للتحليل. النتيجة قابلة للتعديل قبل الحفظ.' : 'اقتراحات العرض مبنية على ألوان الصورة فقط، ومُعلَّمة بوضوح. أضف مفتاحاً لتجربة التعرّف الحقيقي.'}</p>
              </div>
            </div>

            <div class="form-grid form-grid--two">
              <label class="field field--wide">
                <span class="field-label">مفتاح Gemini API</span>
                <div class="secret-field">
                  <input class="input mono" id="gemini-key" name="geminiKey" type="password" value="${escapeAttr(settings.geminiKey)}" placeholder="اتركه فارغاً للوضع التجريبي" dir="ltr" autocomplete="off" spellcheck="false">
                  <button type="button" class="icon-btn secret-toggle" data-action="toggle-key-visibility" aria-label="إظهار مفتاح Gemini" title="إظهار المفتاح">${icon('eye', { size: 17 })}</button>
                </div>
              </label>
              <label class="field">
                <span class="field-label">الطراز</span>
                <select class="select" name="geminiModel">
                  ${[
                    ['gemini-2.5-flash', 'Gemini 2.5 Flash — الأسرع'],
                    ['gemini-2.5-pro', 'Gemini 2.5 Pro — الأدق'],
                    ['gemini-2.0-flash', 'Gemini 2.0 Flash']
                  ]
                    .map(
                      ([value, label]) =>
                        `<option value="${escapeAttr(value)}" ${settings.geminiModel === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
                    )
                    .join('')}
                </select>
              </label>
            </div>

            <div class="ai-test-row">
              <button type="button" class="btn btn--ghost btn--small" data-action="test-gemini">${icon('wifiOff', { size: 16 })} اختبر الاتصال</button>
              <span class="ai-test-result" data-gemini-result aria-live="polite"></span>
            </div>

            <details class="ai-caution">
              <summary>${icon('lock', { size: 14 })} قبل استخدام مفتاح حقيقي</summary>
              <p>يُحفظ المفتاح في localStorage على هذا الجهاز، ويُرسل من المتصفح مباشرة إلى Google. هذا مناسب للتجربة الشخصية فقط؛ في متجر حقيقي استخدم خادماً وسيطاً لحماية المفتاح. لا تشارك هذا الجهاز مع من لا تثق به، ولا تضع المفتاح في نسخة تصدّرها — تصدير البيانات يحذفه تلقائياً.</p>
            </details>
          </article>

          <div class="settings-savebar">
            <div class="settings-savebar-copy">
              <span>${icon('lock', { size: 14 })} لا تغادر بياناتك هذا المتصفح</span>
              <small>يُنصح بتصدير نسخة احتياطية بعد يوم عمل.</small>
            </div>
            <button type="submit" class="btn btn--primary">${icon('check', { size: 18 })} حفظ الإعدادات</button>
          </div>
        </form>

        <aside class="settings-side">
          ${renderStorePass(settings)}
          ${renderDataCard(state, extras)}

          <article class="settings-card shortcuts-card">
            <header class="settings-card-head settings-card-head--compact">
              <span class="settings-icon">${icon('grid', { size: 18 })}</span>
              <div><h2>اختصارات سريعة</h2></div>
            </header>
            <ul class="shortcut-list">
              <li><span>بحث في الرف</span><kbd>/</kbd></li>
              <li><span>كاميرا الباركود</span><kbd>F2</kbd></li>
              <li><span>المساعد البصري</span><kbd>F3</kbd></li>
              <li><span>إغلاق النافذة</span><kbd>Esc</kbd></li>
            </ul>
            <p class="shortcut-hint">تعمل خارج حقول الكتابة. ${escapeHtml(formatNumber(categories.length))} فئة مستخدمة في المتجر.</p>
          </article>

          <article class="about-card">
            <div class="about-brand">
              <span class="about-mark" aria-hidden="true">${icon('bag', { size: 18 })}</span>
              <div><strong>${escapeHtml(APP_NAME)}</strong><span>الإصدار ${escapeHtml(APP_VERSION)}</span></div>
            </div>
            <p>نقطة بيع عربية، مسح باركود، ملصقات QR، وتقارير — بلا حساب أو خادم.</p>
            <div class="about-foot">${avatar(settings.cashierName, { size: 'sm' })}<span>${escapeHtml(settings.cashierName)} · ${escapeHtml(state.meta?.isDemo ? 'نسخة تجريبية' : 'نسخة المتجر')}</span></div>
          </article>
        </aside>
      </div>
    </section>
  `;
}
