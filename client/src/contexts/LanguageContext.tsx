import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ar' | 'en' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    "nav.features": "الميزات",
    "nav.store": "المتجر",
    "nav.faq": "الأسئلة الشائعة",
    "nav.security": "الأمان",
    "nav.login": "تسجيل الدخول",
    "nav.start": "ابدأ الآن",
    "nav.chat": "ابدأ الدردشة",
    "nav.profile": "الملف الشخصي",
    "nav.logout": "تسجيل الخروج",
    "chat.title": "غرفة الدردشة",
    "chat.start_hint": "اضغط ابدأ مباشرة للبدء",
    "chat.online": "متصل",
    "chat.waiting": "جاري البحث...",
    "store.title": "متجر ConnectLive",
    "store.vip": "Premium VIP",
    "store.stars": "شحن النجوم",
    "store.buy": "شحن الآن",
    "store.subscribe": "اشترك الآن",
    "profile.edit": "تعديل الملف",
    "profile.friends": "الأصدقاء",
    "profile.stars": "نجوم",
    "profile.points": "نقاط",
    "profile.views": "مشاهدة",
    "common.back": "العودة",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.loading": "جاري التحميل...",
  },
  en: {
    "nav.features": "Features",
    "nav.store": "Store",
    "nav.faq": "FAQ",
    "nav.security": "Security",
    "nav.login": "Login",
    "nav.start": "Get Started",
    "nav.chat": "Start Chat",
    "nav.profile": "Profile",
    "nav.logout": "Logout",
    "chat.title": "Chat Room",
    "chat.start_hint": "Press Start to begin",
    "chat.online": "Online",
    "chat.waiting": "Searching...",
    "store.title": "ConnectLive Store",
    "store.vip": "Premium VIP",
    "store.stars": "Buy Stars",
    "store.buy": "Buy Now",
    "store.subscribe": "Subscribe Now",
    "profile.edit": "Edit Profile",
    "profile.friends": "Friends",
    "profile.stars": "Stars",
    "profile.points": "Points",
    "profile.views": "Views",
    "common.back": "Back",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.loading": "Loading...",
  },
  fr: {
    "nav.features": "Fonctionnalités",
    "nav.store": "Boutique",
    "nav.faq": "FAQ",
    "nav.security": "Sécurité",
    "nav.login": "Connexion",
    "nav.start": "Commencer",
    "nav.chat": "Démarrer le chat",
    "nav.profile": "Profil",
    "nav.logout": "Déconnexion",
    "chat.title": "Salle de chat",
    "chat.start_hint": "Appuyez sur Démarrer",
    "chat.online": "En ligne",
    "chat.waiting": "Recherche...",
    "store.title": "Boutique ConnectLive",
    "store.vip": "Premium VIP",
    "store.stars": "Acheter des étoiles",
    "store.buy": "Acheter",
    "store.subscribe": "S'abonner",
    "profile.edit": "Modifier le profil",
    "profile.friends": "Amis",
    "profile.stars": "Étoiles",
    "profile.points": "Points",
    "profile.views": "Vues",
    "common.back": "Retour",
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.loading": "Chargement...",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('app_lang') as Language) || 'ar';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_lang', lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
