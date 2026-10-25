export const APP_NAME = 'كاشير AI';
export const APP_VERSION = '1.0.0';
export const STORAGE_KEY = 'cashier-ai:v1';

export const PRESET_CATEGORIES = [
  'قهوة وشاي',
  'تمور وحلويات',
  'ألبان وأجبان',
  'مخبوزات',
  'زيوت وصلصات',
  'مشروبات',
  'أساسيات',
  'منظفات'
];

export const DEFAULT_SETTINGS = {
  storeName: 'بقالة رواق',
  branch: 'حي النخيل',
  cashierName: 'سالم',
  phone: '+966 55 123 4567',
  currency: 'ر.س',
  currencyCode: 'SAR',
  vatRate: 15,
  pricesIncludeVat: true,
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  sounds: true
};

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'نقدي', icon: 'banknote' },
  { id: 'card', label: 'مدى / بطاقة', icon: 'card' },
  { id: 'wallet', label: 'محفظة رقمية', icon: 'wallet' }
];

export const PAYMENT_LABELS = Object.fromEntries(PAYMENT_METHODS.map((method) => [method.id, method.label]));

export const ROUTES = [
  { id: 'pos', label: 'نقطة البيع', icon: 'grid', title: 'نقطة البيع', hint: 'بيع سريع، بحث، ومسح باركود' },
  { id: 'inventory', label: 'المخزون', icon: 'package', title: 'المخزون', hint: 'الكميات، الأسعار، وملصقات المنتجات' },
  { id: 'invoices', label: 'الفواتير', icon: 'receipt', title: 'الفواتير', hint: 'سجل المبيعات وإعادة الطباعة' },
  { id: 'reports', label: 'التقارير', icon: 'chart', title: 'التقارير', hint: 'أداء المتجر خلال الفترة المختارة' }
];

export const REPORT_RANGES = [
  { days: 7, label: '٧ أيام' },
  { days: 30, label: '٣٠ يوماً' }
];
