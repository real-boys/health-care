import { useState, useEffect } from 'react';

// Translation data for different languages
const translations = {
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.refresh': 'Refresh',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.ok': 'OK',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.submit': 'Submit',
    'common.retry': 'Retry',
    'common.continue': 'Continue',
    
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.records': 'Records',
    'nav.claims': 'Claims',
    'nav.appointments': 'Appointments',
    'nav.payments': 'Payments',
    'nav.providers': 'Providers',
    'nav.security': 'Security',
    'nav.engine': 'Engine',
    'nav.funding': 'Funding',
    'nav.contributors': 'Contributors',
    
    // Dashboard
    'dashboard.title': 'Patient Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.stats.records': 'Medical Records',
    'dashboard.stats.claims': 'Insurance Claims',
    'dashboard.stats.payments': 'Premium Payments',
    'dashboard.stats.appointments': 'Upcoming',
    'dashboard.stats.appointments_suffix': 'appointments',
    'dashboard.patient_info': 'Patient Information',
    'dashboard.recent_activity': 'Recent Activity',
    'dashboard.connect_wallet': 'Connect Wallet',
    'dashboard.wallet_connected': 'Wallet Connected',
    
    // Forms
    'form.required': 'This field is required',
    'form.invalid_email': 'Please enter a valid email address',
    'form.invalid_phone': 'Please enter a valid phone number',
    'form.password_mismatch': 'Passwords do not match',
    'form.min_length': 'Must be at least {min} characters',
    'form.max_length': 'Must be no more than {max} characters',
    
    // Payments
    'payment.title': 'Payment Center',
    'payment.select_method': 'Select Payment Method',
    'payment.amount': 'Amount',
    'payment.currency': 'Currency',
    'payment.status': 'Status',
    'payment.date': 'Date',
    'payment.method': 'Method',
    'payment.provider': 'Provider',
    'payment.processing': 'Processing...',
    'payment.success': 'Payment Successful',
    'payment.failed': 'Payment Failed',
    'payment.pending': 'Payment Pending',
    'payment.make_payment': 'Make Payment',
    'payment.complete_payment': 'Complete Secure Payment',
    'payment.recent_activity': 'Recent Activity',
    'payment.global_balance': 'Global Balance',
    'payment.transaction_fee': 'Transaction Fee',
    'payment.estimated_wait': 'Estimated Wait Time',
    'payment.confidence': 'Confidence',
    
    // Payment Conflicts
    'payment.conflict_detected': 'Payment Conflict Detected',
    'payment.conflict_same_meter': 'Multiple payments scheduled for same meter',
    'payment.conflict_insufficient_balance': 'Insufficient balance for scheduled payments',
    'payment.conflict_duplicate_amount': 'Duplicate payment amount detected',
    'payment.resolve_conflict': 'Resolve Conflict',
    'payment.reschedule': 'Reschedule',
    'payment.modify_amount': 'Modify Amount',
    'payment.reduce_amount': 'Reduce Amount',
    
    // Error Messages
    'error.network': 'Network error. Please check your connection.',
    'error.server': 'Server error. Please try again later.',
    'error.unauthorized': 'You are not authorized to perform this action.',
    'error.not_found': 'The requested resource was not found.',
    'error.validation': 'Please check your input and try again.',
    'error.wallet_not_connected': 'Please connect your wallet first.',
    'error.insufficient_balance': 'Insufficient balance for this transaction.',
    'error.transaction_failed': 'Transaction failed. Please try again.',
    'error.payment_conflict': 'Payment scheduling conflict detected.',
    'error.invalid_amount': 'Please enter a valid amount.',
    'error.invalid_date': 'Please enter a valid date.',
    'error.file_upload': 'File upload failed. Please try again.',
    'error.timeout': 'Request timed out. Please try again.',
    
    // Success Messages
    'success.payment_processed': 'Payment processed successfully.',
    'success.payment_scheduled': 'Payment scheduled successfully.',
    'success.conflict_resolved': 'Payment conflict resolved successfully.',
    'success.wallet_connected': 'Wallet connected successfully.',
    'success.data_saved': 'Data saved successfully.',
    'success.record_added': 'Medical record added successfully.',
    'success.claim_submitted': 'Claim submitted successfully.',
    'success.appointment_scheduled': 'Appointment scheduled successfully.',
    
    // Claims
    'claims.title': 'Insurance Claims',
    'claims.new_claim': 'New Claim',
    'claims.claim_number': 'Claim #',
    'claims.service_date': 'Service Date',
    'claims.total_amount': 'Total Amount',
    'claims.insurance_amount': 'Insurance Amount',
    'claims.provider_name': 'Provider Name',
    'claims.approved': 'Approved',
    'claims.pending': 'Pending',
    'claims.denied': 'Denied',
    'claims.submitted': 'Submitted',
    
    // Appointments
    'appointments.title': 'Appointments',
    'appointments.upcoming': 'Upcoming Appointments',
    'appointments.schedule': 'Schedule',
    'appointments.virtual': 'Virtual',
    'appointments.join_meeting': 'Join Meeting',
    'appointments.appointment_type': 'Appointment Type',
    'appointments.confirmed': 'Confirmed',
    'appointments.cancelled': 'Cancelled',
    
    // Medical Records
    'records.title': 'Medical Records',
    'records.add_record': 'Add Record',
    'records.record_type': 'Record Type',
    'records.date_of_service': 'Date of Service',
    'records.provider_name': 'Provider Name',
    'records.title_field': 'Title',
    'records.download': 'Download',
    
    // Security
    'security.title': 'Security',
    'security.mfa': 'Multi-Factor Authentication',
    'security.two_factor': 'Two-Factor Authentication',
    'security.verify_code': 'Verify Code',
    'security.enter_code': 'Enter verification code',
    'security.code_sent': 'Verification code sent to your device.',
    'security.invalid_code': 'Invalid verification code.',
    
    // Wallet
    'wallet.connect': 'Connect Wallet',
    'wallet.connected': 'Connected',
    'wallet.balance': 'Balance',
    'wallet.address': 'Address',
    'wallet.refresh_balance': 'Refresh Balance',
    'wallet.balance_updated': 'Balance updated successfully.',
    'wallet.balance_refresh_error': 'Failed to refresh balance.',
    
    // Notifications
    'notifications.title': 'Notifications',
    'notifications.new_payment': 'New payment received',
    'notifications.new_claim': 'New claim submitted',
    'notifications.claim_update': 'Claim status updated',
    'notifications.new_appointment': 'New appointment scheduled',
    'notifications.appointment_updated': 'Appointment updated',
    'notifications.new_record': 'New medical record added',
    'notifications.payment_conflict': 'Payment conflict detected',
    'notifications.conflict_resolved': 'Payment conflict resolved',
    
    // Date/Time
    'date.today': 'Today',
    'date.yesterday': 'Yesterday',
    'date.tomorrow': 'Tomorrow',
    'date.this_week': 'This Week',
    'date.this_month': 'This Month',
    'date.just_now': 'Just now',
    'date.minutes_ago': '{count} minutes ago',
    'date.hours_ago': '{count} hours ago',
    'date.days_ago': '{count} days ago',
    'date.weeks_ago': '{count} weeks ago',
    'date.months_ago': '{count} months ago',
  },
  
  es: {
    // Common
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.refresh': 'Actualizar',
    'common.close': 'Cerrar',
    'common.confirm': 'Confirmar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.ok': 'OK',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.submit': 'Enviar',
    'common.retry': 'Reintentar',
    'common.continue': 'Continuar',
    
    // Navigation
    'nav.dashboard': 'Panel',
    'nav.records': 'Registros',
    'nav.claims': 'Reclamaciones',
    'nav.appointments': 'Citas',
    'nav.payments': 'Pagos',
    'nav.providers': 'Proveedores',
    'nav.security': 'Seguridad',
    'nav.engine': 'Motor',
    'nav.funding': 'Financiación',
    'nav.contributors': 'Contribuidores',
    
    // Dashboard
    'dashboard.title': 'Panel del Paciente',
    'dashboard.welcome': 'Bienvenido de nuevo',
    'dashboard.stats.records': 'Registros Médicos',
    'dashboard.stats.claims': 'Reclamaciones de Seguro',
    'dashboard.stats.payments': 'Pagos de Primas',
    'dashboard.stats.appointments': 'Próximas',
    'dashboard.stats.appointments_suffix': 'citas',
    'dashboard.patient_info': 'Información del Paciente',
    'dashboard.recent_activity': 'Actividad Reciente',
    'dashboard.connect_wallet': 'Conectar Billetera',
    'dashboard.wallet_connected': 'Billetera Conectada',
    
    // Payments
    'payment.title': 'Centro de Pagos',
    'payment.select_method': 'Seleccionar Método de Pago',
    'payment.amount': 'Cantidad',
    'payment.currency': 'Moneda',
    'payment.status': 'Estado',
    'payment.date': 'Fecha',
    'payment.method': 'Método',
    'payment.provider': 'Proveedor',
    'payment.processing': 'Procesando...',
    'payment.success': 'Pago Exitoso',
    'payment.failed': 'Pago Fallido',
    'payment.pending': 'Pago Pendiente',
    'payment.make_payment': 'Hacer Pago',
    'payment.complete_payment': 'Completar Pago Seguro',
    'payment.recent_activity': 'Actividad Reciente',
    'payment.global_balance': 'Saldo Global',
    
    // Error Messages
    'error.network': 'Error de red. Por favor verifique su conexión.',
    'error.server': 'Error del servidor. Por favor intente más tarde.',
    'error.unauthorized': 'No está autorizado para realizar esta acción.',
    'error.not_found': 'El recurso solicitado no fue encontrado.',
    'error.validation': 'Por favor verifique su entrada e intente nuevamente.',
    'error.wallet_not_connected': 'Por favor conecte su billetera primero.',
    'error.insufficient_balance': 'Saldo insuficiente para esta transacción.',
    'error.transaction_failed': 'Transacción fallida. Por favor intente nuevamente.',
    'error.payment_conflict': 'Conflicto de programación de pago detectado.',
    
    // Success Messages
    'success.payment_processed': 'Pago procesado exitosamente.',
    'success.payment_scheduled': 'Pago programado exitosamente.',
    'success.conflict_resolved': 'Conflicto de pago resuelto exitosamente.',
    'success.wallet_connected': 'Billetera conectada exitosamente.',
    'success.data_saved': 'Datos guardados exitosamente.',
    
    // Wallet
    'wallet.connect': 'Conectar Billetera',
    'wallet.connected': 'Conectado',
    'wallet.balance': 'Saldo',
    'wallet.address': 'Dirección',
    'wallet.refresh_balance': 'Actualizar Saldo',
    'wallet.balance_updated': 'Saldo actualizado exitosamente.',
    'wallet.balance_refresh_error': 'Error al actualizar el saldo.',
  },
  
  fr: {
    // Common
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.view': 'Voir',
    'common.search': 'Rechercher',
    'common.filter': 'Filtrer',
    'common.refresh': 'Actualiser',
    'common.close': 'Fermer',
    'common.confirm': 'Confirmer',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.ok': 'OK',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.previous': 'Précédent',
    'common.submit': 'Soumettre',
    'common.retry': 'Réessayer',
    'common.continue': 'Continuer',
    
    // Navigation
    'nav.dashboard': 'Tableau de Bord',
    'nav.records': 'Dossiers',
    'nav.claims': 'Réclamations',
    'nav.appointments': 'Rendez-vous',
    'nav.payments': 'Paiements',
    'nav.providers': 'Fournisseurs',
    'nav.security': 'Sécurité',
    'nav.engine': 'Moteur',
    'nav.funding': 'Financement',
    'nav.contributors': 'Contributeurs',
    
    // Dashboard
    'dashboard.title': 'Tableau de Bord du Patient',
    'dashboard.welcome': 'Bon retour',
    'dashboard.stats.records': 'Dossiers Médicaux',
    'dashboard.stats.claims': 'Réclamations d\'Assurance',
    'dashboard.stats.payments': 'Paiements de Primes',
    'dashboard.stats.appointments': 'À Venir',
    'dashboard.stats.appointments_suffix': 'rendez-vous',
    'dashboard.patient_info': 'Informations du Patient',
    'dashboard.recent_activity': 'Activité Récente',
    'dashboard.connect_wallet': 'Connecter le Portefeuille',
    'dashboard.wallet_connected': 'Portefeuille Connecté',
    
    // Payments
    'payment.title': 'Centre de Paiements',
    'payment.select_method': 'Sélectionner le Méthode de Paiement',
    'payment.amount': 'Montant',
    'payment.currency': 'Devise',
    'payment.status': 'Statut',
    'payment.date': 'Date',
    'payment.method': 'Méthode',
    'payment.provider': 'Fournisseur',
    'payment.processing': 'Traitement...',
    'payment.success': 'Paiement Réussi',
    'payment.failed': 'Paiement Échoué',
    'payment.pending': 'Paiement en Attente',
    'payment.make_payment': 'Effectuer un Paiement',
    'payment.complete_payment': 'Compléter le Paiement Sécurisé',
    'payment.recent_activity': 'Activité Récente',
    'payment.global_balance': 'Solde Global',
    
    // Error Messages
    'error.network': 'Erreur réseau. Veuillez vérifier votre connexion.',
    'error.server': 'Erreur serveur. Veuillez réessayer plus tard.',
    'error.unauthorized': 'Vous n\'êtes pas autorisé à effectuer cette action.',
    'error.not_found': 'La ressource demandée n\'a pas été trouvée.',
    'error.validation': 'Veuillez vérifier votre saisie et réessayer.',
    'error.wallet_not_connected': 'Veuillez connecter votre portefeuille d\'abord.',
    'error.insufficient_balance': 'Solde insuffisant pour cette transaction.',
    'error.transaction_failed': 'Transaction échouée. Veuillez réessayer.',
    'error.payment_conflict': 'Conflit de programmation de paiement détecté.',
    
    // Success Messages
    'success.payment_processed': 'Paiement traité avec succès.',
    'success.payment_scheduled': 'Paiement programmé avec succès.',
    'success.conflict_resolved': 'Conflit de paiement résolu avec succès.',
    'success.wallet_connected': 'Portefeuille connecté avec succès.',
    'success.data_saved': 'Données enregistrées avec succès.',
    
    // Wallet
    'wallet.connect': 'Connecter le Portefeuille',
    'wallet.connected': 'Connecté',
    'wallet.balance': 'Solde',
    'wallet.address': 'Adresse',
    'wallet.refresh_balance': 'Actualiser le Solde',
    'wallet.balance_updated': 'Solde mis à jour avec succès.',
    'wallet.balance_refresh_error': 'Échec de la mise à jour du solde.',
  }
};

class I18n {
  constructor() {
    this.currentLanguage = 'en';
    this.fallbackLanguage = 'en';
    this.listeners = [];
  }

  // Set the current language
  setLanguage(language) {
    if (translations[language]) {
      this.currentLanguage = language;
      this.notifyListeners();
    } else {
      console.warn(`Language '${language}' not supported, falling back to English`);
      this.currentLanguage = 'en';
    }
  }

  // Get the current language
  getLanguage() {
    return this.currentLanguage;
  }

  // Get available languages
  getAvailableLanguages() {
    return Object.keys(translations);
  }

  // Translate a key
  t(key, params = {}) {
    const translation = this.getTranslation(key, this.currentLanguage);
    return this.interpolate(translation, params);
  }

  // Get translation for a specific language
  getTranslation(key, language) {
    const keys = key.split('.');
    let translation = translations[language];
    
    for (const k of keys) {
      if (translation && translation[k]) {
        translation = translation[k];
      } else {
        // Fallback to English if translation not found
        if (language !== this.fallbackLanguage) {
          return this.getTranslation(key, this.fallbackLanguage);
        }
        return key; // Return key if no translation found
      }
    }
    
    return translation;
  }

  // Interpolate parameters into translation
  interpolate(translation, params) {
    if (typeof translation !== 'string') {
      return translation;
    }
    
    return translation.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  // Add a listener for language changes
  addListener(callback) {
    this.listeners.push(callback);
  }

  // Remove a listener
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners of language change
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentLanguage));
  }

  // Detect browser language
  detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0];
    
    if (translations[langCode]) {
      return langCode;
    }
    
    return 'en'; // Default to English
  }

  // Initialize with browser language or saved preference
  initialize() {
    const savedLanguage = localStorage.getItem('preferred-language');
    const language = savedLanguage || this.detectBrowserLanguage();
    this.setLanguage(language);
  }

  // Save language preference
  savePreference() {
    localStorage.setItem('preferred-language', this.currentLanguage);
  }
}

// Create singleton instance
const i18n = new I18n();

// React hook for translations
export const useTranslation = () => {
  const [language, setLanguage] = useState(i18n.getLanguage());

  useEffect(() => {
    const handleLanguageChange = (newLanguage) => {
      setLanguage(newLanguage);
    };

    i18n.addListener(handleLanguageChange);
    return () => i18n.removeListener(handleLanguageChange);
  }, []);

  const changeLanguage = (newLanguage) => {
    i18n.setLanguage(newLanguage);
    i18n.savePreference();
  };

  const t = (key, params = {}) => {
    return i18n.t(key, params);
  };

  return {
    t,
    changeLanguage,
    currentLanguage: language,
    availableLanguages: i18n.getAvailableLanguages()
  };
};

// Export the i18n instance for direct usage
export default i18n;
