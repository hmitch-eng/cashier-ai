import { dataUrlToBase64, roundMoney, sleep } from './util.js';

export class AiError extends Error {
  constructor(message, code = 'AI') {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}

const demoCatalog = {
  red: [
    {
      name: 'عصير رمان طبيعي',
      category: 'مشروبات',
      price: 12,
      cost: 7,
      art: 'juice',
      stock: 18,
      lowStock: 5
    },
    {
      name: 'صلصة طماطم بلدية',
      category: 'زيوت وصلصات',
      price: 9.5,
      cost: 5.5,
      art: 'pantry',
      stock: 14,
      lowStock: 5
    }
  ],
  orange: [
    {
      name: 'عسل جبلي',
      category: 'تمور وحلويات',
      price: 72,
      cost: 51,
      art: 'honey',
      stock: 8,
      lowStock: 3
    },
    {
      name: 'تمر سكري فاخر',
      category: 'تمور وحلويات',
      price: 34,
      cost: 22,
      art: 'dates',
      stock: 20,
      lowStock: 6
    }
  ],
  yellow: [
    {
      name: 'جبن حلوم طازج',
      category: 'ألبان وأجبان',
      price: 26,
      cost: 18,
      art: 'cheese',
      stock: 10,
      lowStock: 4
    },
    {
      name: 'معمول بالتمر',
      category: 'تمور وحلويات',
      price: 32,
      cost: 20,
      art: 'cookie',
      stock: 12,
      lowStock: 4
    }
  ],
  green: [
    {
      name: 'زيت زيتون بكر ممتاز',
      category: 'زيوت وصلصات',
      price: 46,
      cost: 32,
      art: 'oil',
      stock: 8,
      lowStock: 4
    },
    {
      name: 'زعتر بلدي مطحون',
      category: 'أساسيات',
      price: 13,
      cost: 8,
      art: 'pantry',
      stock: 16,
      lowStock: 5
    }
  ],
  cyan: [
    {
      name: 'ماء معدني 600مل',
      category: 'مشروبات',
      price: 1.5,
      cost: 0.7,
      art: 'water',
      stock: 48,
      lowStock: 12
    },
    {
      name: 'حليب طازج كامل الدسم',
      category: 'ألبان وأجبان',
      price: 7.5,
      cost: 5.2,
      art: 'milk',
      stock: 24,
      lowStock: 8
    }
  ],
  blue: [
    {
      name: 'ماء معدني 600مل',
      category: 'مشروبات',
      price: 1.5,
      cost: 0.7,
      art: 'water',
      stock: 48,
      lowStock: 12
    },
    {
      name: 'منظف أرضيات بالياسمين',
      category: 'منظفات',
      price: 22,
      cost: 13.5,
      art: 'detergent',
      stock: 7,
      lowStock: 4
    }
  ],
  purple: [
    {
      name: 'معمول بالتمر',
      category: 'تمور وحلويات',
      price: 32,
      cost: 20,
      art: 'cookie',
      stock: 12,
      lowStock: 4
    },
    {
      name: 'عصير رمان طبيعي',
      category: 'مشروبات',
      price: 12,
      cost: 7,
      art: 'juice',
      stock: 18,
      lowStock: 5
    }
  ],
  neutral: [
    {
      name: 'حليب طازج كامل الدسم',
      category: 'ألبان وأجبان',
      price: 7.5,
      cost: 5.2,
      art: 'milk',
      stock: 24,
      lowStock: 8
    },
    {
      name: 'طحينة بلدية',
      category: 'أساسيات',
      price: 16.5,
      cost: 10,
      art: 'tahini',
      stock: 12,
      lowStock: 5
    }
  ],
  dark: [
    {
      name: 'قهوة عربية بالهيل',
      category: 'قهوة وشاي',
      price: 28.5,
      cost: 17,
      art: 'coffee',
      stock: 15,
      lowStock: 5
    },
    {
      name: 'شاي أسود بالنعناع',
      category: 'قهوة وشاي',
      price: 18,
      cost: 11,
      art: 'tea',
      stock: 20,
      lowStock: 6
    }
  ]
};

function rgbToHsl(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { hue, saturation, lightness };
}

export function classifyDemoColor({ hue = 0, saturation = 0, lightness = 0.5 } = {}) {
  if (lightness < 0.24) return 'dark';
  if (saturation < 0.14) return 'neutral';
  if (hue < 18 || hue >= 335) return 'red';
  if (hue < 43) return 'orange';
  if (hue < 68) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 205) return 'cyan';
  if (hue < 265) return 'blue';
  return 'purple';
}

export async function analyzeImageColors(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 72;
      canvas.height = 72;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 72, 72);
      let pixels;
      try {
        pixels = context.getImageData(0, 0, 72, 72).data;
      } catch {
        resolve({ hue: 35, saturation: 0.3, lightness: 0.5, bucket: 'neutral' });
        return;
      }
      let weight = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      for (let index = 0; index < pixels.length; index += 16) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const { saturation } = rgbToHsl(r, g, b);
        if (saturation > 0.16) {
          const localWeight = saturation ** 1.4;
          red += r * localWeight;
          green += g * localWeight;
          blue += b * localWeight;
          weight += localWeight;
        }
        rSum += r;
        gSum += g;
        bSum += b;
        count += 1;
      }
      const base = weight
        ? { r: red / weight, g: green / weight, b: blue / weight }
        : { r: rSum / count, g: gSum / count, b: bSum / count };
      const hsl = rgbToHsl(base.r, base.g, base.b);
      resolve({ ...hsl, bucket: classifyDemoColor(hsl) });
    };
    image.onerror = () => resolve({ hue: 35, saturation: 0.3, lightness: 0.5, bucket: 'neutral' });
    image.src = dataUrl;
  });
}

function variantIndex(seed = 0) {
  return Math.abs(Math.round(seed * 10)) % 2;
}

export function demoProductSuggestion(profile) {
  const bucket = profile?.bucket || 'neutral';
  const items = demoCatalog[bucket] || demoCatalog.neutral;
  const suggestion = items[variantIndex(profile?.hue || 0.42)];
  return {
    name: suggestion.name,
    category: suggestion.category,
    price: suggestion.price,
    cost: suggestion.cost,
    stock: suggestion.stock,
    lowStock: suggestion.lowStock,
    art: suggestion.art,
    confidence: null
  };
}

export async function analyzeWithDemo(dataUrl) {
  const profile = await analyzeImageColors(dataUrl);
  await sleep(1600);
  return {
    mode: 'demo',
    suggestion: demoProductSuggestion(profile),
    note: 'اقتراح تجريبي مبني على لون الصورة، وليس تعرّفاً بصرياً حقيقياً. راجع الاسم والسعر قبل الحفظ.',
    profile
  };
}

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new AiError('لم يصل وصف للمنتج من الخدمة.', 'EMPTY');
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch {
        // Continue to the friendly error below.
      }
    }
    throw new AiError('وصل رد غير مفهوم من خدمة الذكاء الاصطناعي. أعد المحاولة.', 'PARSE');
  }
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSuggestion(data, settings) {
  const categories = ['قهوة وشاي', 'تمور وحلويات', 'ألبان وأجبان', 'مخبوزات', 'زيوت وصلصات', 'مشروبات', 'أساسيات', 'منظفات'];
  const category = categories.includes(String(data.category || '').trim())
    ? String(data.category).trim()
    : String(data.category || 'أساسيات').trim().slice(0, 40) || 'أساسيات';
  const confidence = Math.min(1, Math.max(0, numberOr(data.confidence, 0.65)));
  const price = roundMoney(Math.max(0, numberOr(data.price, 0)));
  const cost = roundMoney(Math.max(0, numberOr(data.cost, price * 0.65)));
  const stock = Math.max(0, Math.floor(numberOr(data.stock, 12)));
  return {
    name: String(data.name || 'منتج جديد').trim().slice(0, 80),
    category,
    price,
    cost: Math.min(cost, price || cost),
    stock,
    lowStock: Math.max(0, Math.floor(numberOr(data.low_stock, 4))),
    confidence,
    description: String(data.description || '').trim().slice(0, 240),
    isProduct: data.isProduct !== false,
    currency: settings?.currency || 'ر.س'
  };
}

export async function analyzeWithGemini({ dataUrl, apiKey, model = 'gemini-2.5-flash', settings = {} }) {
  if (!apiKey) throw new AiError('أضف مفتاح Gemini من الإعدادات أولاً.', 'NO_KEY');
  const base64 = dataUrlToBase64(dataUrl);
  if (!base64) throw new AiError('صورة المنتج غير جاهزة.', 'IMAGE');
  const safeModel = String(model || 'gemini-2.5-flash').trim().replace(/[^a-zA-Z0-9._-]/g, '');
  const prompt = `أنت مساعد تعرّف منتجات في بقالة عربية. حلّل صورة المنتج وأعد كائن JSON فقط دون أي شرح أو علامات Markdown.
المطلوب:
{
  "isProduct": true إذا كانت الصورة تحتوي منتجاً بقالياً واضحاً،
  "name": "اسم تجاري قصير وواضح بالعربية دون اختراع علامة غير ظاهرة",
  "category": "واحدة من: ${['قهوة وشاي', 'تمور وحلويات', 'ألبان وأجبان', 'مخبوزات', 'زيوت وصلصات', 'مشروبات', 'أساسيات', 'منظفات'].join('، ')}",
  "price": سعر بيع تقديري بالعملة ${settings.currency || 'ر.س'} كرقم فقط,
  "cost": تكلفة تقديرية كرقم فقط,
  "stock": كمية ابتدائية مقترحة كعدد صحيح,
  "low_stock": حد تنبيه المخزون كعدد صحيح,
  "confidence": رقم من 0 إلى 1,
  "description": "وصف قصير للمنتج في جملة واحدة"
}
لا تخترع مكونات أو علامات تجارية غير واضحة. إذا لم تكن الصورة منتجاً، أعد isProduct=false مع confidence=0 وdescription يوضح السبب.`;
  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 500,
            responseMimeType: 'application/json'
          }
        })
      }
    );
  } catch {
    throw new AiError(
      'تعذّر الاتصال بخدمة Gemini. تحقّق من الشبكة، أو استخدم الاقتراح التجريبي الآن.',
      'NETWORK'
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 400) {
      throw new AiError('رفضت الخدمة الطلب. تأكد من صحة المفتاح واسم الطراز.', 'BAD_REQUEST');
    }
    if (status === 401 || status === 403) {
      throw new AiError('مفتاح Gemini غير صالح أو لا يملك صلاحية استخدام الطراز.', 'AUTH');
    }
    if (status === 429) {
      throw new AiError('تم تجاوز حد طلبات Gemini. انتظر قليلاً أو استخدم الوضع التجريبي.', 'QUOTA');
    }
    if (status === 404) {
      throw new AiError('اسم طراز Gemini غير متاح. غيّره من الإعدادات.', 'MODEL');
    }
    throw new AiError(payload?.error?.message || `تعذّر تحليل الصورة (رمز ${status}).`, 'API');
  }

  const candidate = payload?.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY' || payload?.promptFeedback?.blockReason) {
    throw new AiError('تعذّر تحليل هذه الصورة لأسباب تتعلق بالسلامة. جرّب صورة أخرى.', 'SAFETY');
  }
  const text = candidate?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!text) throw new AiError('لم تتضمن استجابة Gemini وصفاً للمنتج.', 'EMPTY');
  const parsed = extractJson(text);
  const suggestion = normalizeSuggestion(parsed, settings);
  if (!suggestion.isProduct) {
    throw new AiError(
      suggestion.description || 'لم أتعرّف على منتج واضح في الصورة. قرّب الكاميرا وأعد التصوير.',
      'NO_PRODUCT'
    );
  }
  return {
    mode: 'gemini',
    suggestion,
    note: suggestion.description || 'نتيجة من Gemini — راجع البيانات قبل الحفظ.',
    model: safeModel
  };
}

export async function analyzeProductImage({ dataUrl, apiKey = '', model = 'gemini-2.5-flash', settings = {}, forceDemo = false }) {
  if (!forceDemo && apiKey) {
    return analyzeWithGemini({ dataUrl, apiKey, model, settings });
  }
  return analyzeWithDemo(dataUrl);
}

export async function testGeminiConnection({ apiKey, model = 'gemini-2.5-flash' }) {
  if (!apiKey) throw new AiError('أدخل مفتاح Gemini أولاً.', 'NO_KEY');
  const safeModel = String(model || 'gemini-2.5-flash').trim().replace(/[^a-zA-Z0-9._-]/g, '');
  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'أجب بكلمة واحدة: جاهز' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8 }
        })
      }
    );
  } catch {
    throw new AiError('تعذّر الاتصال بالخدمة. تحقّق من الشبكة أو إعدادات المتصفح.', 'NETWORK');
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new AiError('المفتاح غير صالح أو لا يملك صلاحية الطراز.', 'AUTH');
    if (response.status === 404) throw new AiError('اسم الطراز غير متاح. جرّب gemini-2.5-flash.', 'MODEL');
    if (response.status === 429) throw new AiError('حصة الطلبات ممتلئة حالياً. جرّب بعد قليل.', 'QUOTA');
    throw new AiError(`فشل الاختبار (${response.status}).`, 'API');
  }
  return true;
}
