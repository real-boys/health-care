import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en/translation.json';
import es from './locales/es/translation.json';
import fr from './locales/fr/translation.json';
import pidgin from './locales/pidgin/translation.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  pidgin: { translation: pidgin }
};

// RTL languages
export const rtlLanguages = ['ar', 'he', 'fa', 'ur'];

// Detect if current language is RTL
export const isRTL = (lng) => rtlLanguages.includes(lng);

// Apply RTL direction to document
export const applyDirection = (lng) => {
  const dir = isRTL(lng) ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', lng);
  
  // Update body class for CSS targeting
  if (isRTL(lng)) {
    document.body.classList.add('rtl');
  } else {
    document.body.classList.remove('rtl');
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false,
    },
    supportedLngs: ['en', 'es', 'fr', 'pidgin'],
  });

// Apply direction on language change
i18n.on('languageChanged', (lng) => {
  applyDirection(lng);
});

// Initialize direction on load
applyDirection(i18n.language);

export default i18n;
