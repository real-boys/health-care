import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const translations = {
  en: {
    locale: 'en-US',
    dir: 'ltr',
    label: 'English',
    flag: '🇺🇸',
    t: {
      dashboard: 'Dashboard',
      patients: 'Patients',
      claims: 'Claims',
      payments: 'Payments',
      settings: 'Settings',
      welcome: 'Welcome to AEGIS Health Systems',
      language: 'Language',
      selectLanguage: 'Select Language',
      currentLanguage: 'Current Language',
      date: 'Date',
      currency: 'Currency',
      example: 'Example',
    },
  },
  es: {
    locale: 'es-ES',
    dir: 'ltr',
    label: 'Español',
    flag: '🇪🇸',
    t: {
      dashboard: 'Panel de Control',
      patients: 'Pacientes',
      claims: 'Reclamaciones',
      payments: 'Pagos',
      settings: 'Configuración',
      welcome: 'Bienvenido a AEGIS Health Systems',
      language: 'Idioma',
      selectLanguage: 'Seleccionar Idioma',
      currentLanguage: 'Idioma Actual',
      date: 'Fecha',
      currency: 'Moneda',
      example: 'Ejemplo',
    },
  },
  fr: {
    locale: 'fr-FR',
    dir: 'ltr',
    label: 'Français',
    flag: '🇫🇷',
    t: {
      dashboard: 'Tableau de Bord',
      patients: 'Patients',
      claims: 'Réclamations',
      payments: 'Paiements',
      settings: 'Paramètres',
      welcome: 'Bienvenue sur AEGIS Health Systems',
      language: 'Langue',
      selectLanguage: 'Choisir la Langue',
      currentLanguage: 'Langue Actuelle',
      date: 'Date',
      currency: 'Devise',
      example: 'Exemple',
    },
  },
  ar: {
    locale: 'ar-SA',
    dir: 'rtl',
    label: 'العربية',
    flag: '🇸🇦',
    t: {
      dashboard: 'لوحة التحكم',
      patients: 'المرضى',
      claims: 'المطالبات',
      payments: 'المدفوعات',
      settings: 'الإعدادات',
      welcome: 'مرحباً بك في AEGIS Health Systems',
      language: 'اللغة',
      selectLanguage: 'اختر اللغة',
      currentLanguage: 'اللغة الحالية',
      date: 'التاريخ',
      currency: 'العملة',
      example: 'مثال',
    },
  },
  zh: {
    locale: 'zh-CN',
    dir: 'ltr',
    label: '中文',
    flag: '🇨🇳',
    t: {
      dashboard: '仪表板',
      patients: '患者',
      claims: '理赔',
      payments: '付款',
      settings: '设置',
      welcome: '欢迎使用 AEGIS 健康系统',
      language: '语言',
      selectLanguage: '选择语言',
      currentLanguage: '当前语言',
      date: '日期',
      currency: '货币',
      example: '示例',
    },
  },
};

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
  const detectLanguage = () => {
    const saved = localStorage.getItem('aegis-lang');
    if (saved && translations[saved]) return saved;
    const browser = navigator.language.split('-')[0];
    return translations[browser] ? browser : 'en';
  };

  const [lang, setLang] = useState(detectLanguage);

  const switchLanguage = useCallback(code => {
    if (translations[code]) {
      setLang(code);
      localStorage.setItem('aegis-lang', code);
      document.documentElement.lang = code;
      document.documentElement.dir = translations[code].dir;
    }
  }, []);

  const value = useMemo(() => {
    const current = translations[lang];
    return {
      lang,
      dir: current.dir,
      locale: current.locale,
      t: current.t,
      switchLanguage,
      availableLanguages: Object.entries(translations).map(([code, data]) => ({
        code,
        label: data.label,
        flag: data.flag,
        dir: data.dir,
      })),
      formatDate: date =>
        new Intl.DateTimeFormat(current.locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(date instanceof Date ? date : new Date(date)),
      formatCurrency: (amount, currency = 'USD') =>
        new Intl.NumberFormat(current.locale, {
          style: 'currency',
          currency,
        }).format(amount),
    };
  }, [lang, switchLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};

const LanguageSwitcher = () => {
  const { lang, t, switchLanguage, availableLanguages, formatDate, formatCurrency } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 space-y-6" role="main" aria-label="Language Settings">
      <div>
        <h1 className="text-2xl font-black text-white">Multi-language Support</h1>
        <p className="text-slate-400 text-sm mt-1">
          Switch languages — date, time, and currency formats update automatically
        </p>
      </div>

      {/* Language selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold">{t.selectLanguage}</h2>
        <div className="relative w-64">
          <button
            onClick={() => setOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={t.selectLanguage}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <span>
              {availableLanguages.find(l => l.code === lang)?.flag}{' '}
              {availableLanguages.find(l => l.code === lang)?.label}
            </span>
            <span className="text-slate-400">▾</span>
          </button>
          {open && (
            <ul
              role="listbox"
              aria-label={t.selectLanguage}
              className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl"
            >
              {availableLanguages.map(l => (
                <li
                  key={l.code}
                  role="option"
                  aria-selected={l.code === lang}
                  onClick={() => {
                    switchLanguage(l.code);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    l.code === lang
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{l.flag}</span>
                  <span className="font-semibold">{l.label}</span>
                  {l.dir === 'rtl' && (
                    <span className="ml-auto text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                      RTL
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Localization examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h3 className="text-white font-bold">{t.date} Format</h3>
          <p className="text-slate-400 text-sm">{t.example}:</p>
          <p className="text-indigo-400 font-mono text-lg">{formatDate(new Date())}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h3 className="text-white font-bold">{t.currency} Format</h3>
          <p className="text-slate-400 text-sm">{t.example}:</p>
          <p className="text-green-400 font-mono text-lg">{formatCurrency(12500.5)}</p>
        </div>
      </div>

      {/* Translated UI preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-bold mb-4">UI Translation Preview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(t).map(([key, value]) => (
            <div key={key} className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-500 text-xs uppercase tracking-wider">{key}</p>
              <p className="text-white font-semibold mt-1 text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
