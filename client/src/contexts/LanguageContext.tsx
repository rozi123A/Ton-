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
    // Nav
    "nav.features": "الميزات",
    "nav.store": "المتجر",
    "nav.faq": "الأسئلة الشائعة",
    "nav.security": "الأمان",
    "nav.login": "تسجيل الدخول",
    "nav.start": "ابدأ الآن",
    "nav.chat": "ابدأ الدردشة",
    "nav.profile": "الملف الشخصي",
    "nav.logout": "تسجيل الخروج",
    "nav.vip_member": "عضو VIP",
    "nav.logged_in": "مسجّل الدخول",

    // Home Page
    "home.hero_title": "تواصل مع العالم مباشرة",
    "home.hero_desc": "دردشة فيديو عشوائية آمنة وسريعة. ابدأ الآن وتعرف على أشخاص جدد من جميع أنحاء العالم بضغطة زر واحدة.",
    "home.start_now": "ابدأ الآن مجاناً",
    "home.stats_users": "مستخدم نشط",
    "home.stats_countries": "دولة",
    "home.stats_matches": "مطابقة يومية",
    "home.active_users": "المستخدمون النشطون الآن",
    "home.why_choose": "لماذا تختار",
    "home.how_it_works": "شاهد كيفية العمل",

    // Chat Room
    "chat.title": "غرفة الدردشة",
    "chat.start_hint": "اضغط ابدأ مباشرة للبدء",
    "chat.online": "متصل",
    "chat.waiting": "جاري البحث عن شريك...",
    "chat.start_btn": "ابدأ مباشرة",
    "chat.stop_btn": "إيقاف",
    "chat.next_btn": "التالي",
    "chat.mic": "ميكروفون",
    "chat.cam": "كاميرا",
    "chat.audio": "صوت",
    "chat.chat_btn": "دردشة",
    "chat.friends": "أصدقاء",
    "chat.store": "المتجر",
    "chat.bg": "خلفية",
    "chat.gift": "هدية",
    "chat.radar": "الرادار",
    "chat.report": "إبلاغ",
    "chat.searching": "جاري البحث عن مستخدمين يتحدثون الآن...",

    // User Profile Card
    "profile.years": "سنة",
    "profile.male": "♂ ذكر",
    "profile.female": "♀ أنثى",
    "profile.online": "● متصل",
    "profile.offline": "غير متصل",
    "profile.stars": "نجوم",
    "profile.points": "نقاط",
    "profile.views": "مشاهدة",
    "profile.since": "منذ",
    "profile.view_profile": "عرض الملف الشخصي",
    "profile.send_friend": "إرسال طلب صداقة",
    "profile.is_friend": "أصدقاء بالفعل",
    "profile.pending": "طلب الصداقة بانتظار الرد",
    "profile.loading": "جاري التحميل...",
    "profile.not_found": "لم يُعثر على الملف الشخصي",

    // Store
    "store.title": "متجر ConnectLive",
    "store.desc": "ارتقِ بتجربتك مع ميزات Premium — اشترِ عبر Binance Pay أو USDT.",
    "store.exclusive": "عروض حصرية",
    "store.vip_title": "Premium VIP",
    "store.vip_desc": "الباقة الكاملة للمحترفين",
    "store.current_sub": "مشترك حالياً",
    "store.digital_pay": "💰 دفع رقمي (Binance)",
    "store.my_points": "بنقاطي",
    "store.balance": "رصيدك الحالي",
    "store.subscribe_btn": "اشترك الآن عبر Binance/USDT",
    "store.points_btn": "اشترك بـ 500 نقطة ⚡",
    "store.stars_title": "شحن النجوم",
    "store.stars_buy": "شحن الآن",
    "store.stars_pack_1": "باقة المبتدئين",
    "store.stars_pack_2": "الباقة الاقتصادية",
    "store.stars_pack_3": "باقة المحترفين",
    "store.most_popular": "الأكثر توفيراً ⭐",
    "store.stars_count": "نجمة",
    "store.buy_now": "شراء الآن",
    "store.pay_modal_title": "تأكيد عملية الدفع",
    "store.pay_modal_desc": "اختر وسيلة الدفع المفضلة لديك وقم بالتحويل.",
    "store.product": "المنتج",
    "store.amount": "المبلغ",
    "store.txid_label": "رقم المعاملة (TXID / Order ID)",
    "store.txid_placeholder": "أدخل رقم المعاملة هنا للتأكيد...",
    "store.txid_help": "تجد هذا الرقم في تطبيق Binance بعد إتمام التحويل في تفاصيل العملية",
    "store.confirm_pay": "تأكيد عملية الدفع",
    "store.submitting": "جاري الإرسال...",
    "store.vip_badge": "VIP",
    "store.stars_recharge": "شحن النجوم",
    "store.need_more": "تحتاج",
    "store.points_extra": "نقطة إضافية",
    "store.collect_daily": "تجمّعها من المكافأة اليومية والهدايا.",
    "store.features.cam": "تبديل الكاميرا",
    "store.features.filters": "فلاتر Premium",
    "store.features.badge": "شارة ذهبية VIP",
    "store.features.points": "100 نقطة مجانية/شهر",
    "store.features.shield": "فلتر الجنس والدولة",
    "store.features.priority": "أولوية المطابقة",

    // Common
    "common.back": "العودة",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.loading": "جاري التحميل...",
  },
  en: {
    // Nav
    "nav.features": "Features",
    "nav.store": "Store",
    "nav.faq": "FAQ",
    "nav.security": "Security",
    "nav.login": "Login",
    "nav.start": "Get Started",
    "nav.chat": "Start Chat",
    "nav.profile": "Profile",
    "nav.logout": "Logout",
    "nav.vip_member": "VIP Member",
    "nav.logged_in": "Logged In",

    // Home Page
    "home.hero_title": "Connect with the World Live",
    "home.hero_desc": "Safe and fast random video chat. Start now and meet new people from all over the world with one click.",
    "home.start_now": "Start Now Free",
    "home.stats_users": "Active Users",
    "home.stats_countries": "Countries",
    "home.stats_matches": "Daily Matches",
    "home.active_users": "Active Users Now",
    "home.why_choose": "Why choose",
    "home.how_it_works": "How it works",

    // Chat Room
    "chat.title": "Chat Room",
    "chat.start_hint": "Press Start to begin",
    "chat.online": "Online",
    "chat.waiting": "Searching for a partner...",
    "chat.start_btn": "Start Live",
    "chat.stop_btn": "Stop",
    "chat.next_btn": "Next",
    "chat.mic": "Mic",
    "chat.cam": "Camera",
    "chat.audio": "Audio",
    "chat.chat_btn": "Chat",
    "chat.friends": "Friends",
    "chat.store": "Store",
    "chat.bg": "Background",
    "chat.gift": "Gift",
    "chat.radar": "Radar",
    "chat.report": "Report",
    "chat.searching": "Searching for users talking now...",

    // User Profile Card
    "profile.years": "years",
    "profile.male": "♂ Male",
    "profile.female": "♀ Female",
    "profile.online": "● Online",
    "profile.offline": "Offline",
    "profile.stars": "Stars",
    "profile.points": "Points",
    "profile.views": "Views",
    "profile.since": "Since",
    "profile.view_profile": "View Profile",
    "profile.send_friend": "Send Friend Request",
    "profile.is_friend": "Already Friends",
    "profile.pending": "Request Pending",
    "profile.loading": "Loading...",
    "profile.not_found": "Profile Not Found",

    // Store
    "store.title": "ConnectLive Store",
    "store.desc": "Enhance your experience with Premium features — Buy via Binance Pay or USDT.",
    "store.exclusive": "Exclusive Offers",
    "store.vip_title": "Premium VIP",
    "store.vip_desc": "The ultimate pro package",
    "store.current_sub": "Currently Subscribed",
    "store.digital_pay": "💰 Digital Pay (Binance)",
    "store.my_points": "My Points",
    "store.balance": "Current Balance",
    "store.subscribe_btn": "Subscribe via Binance/USDT",
    "store.points_btn": "Subscribe for 500 Points ⚡",
    "store.stars_title": "Top-up Stars",
    "store.stars_buy": "Buy Now",
    "store.stars_pack_1": "Starter Pack",
    "store.stars_pack_2": "Economy Pack",
    "store.stars_pack_3": "Pro Pack",
    "store.most_popular": "Most Popular ⭐",
    "store.stars_count": "Stars",
    "store.buy_now": "Buy Now",
    "store.pay_modal_title": "Confirm Payment",
    "store.pay_modal_desc": "Choose your preferred payment method and transfer.",
    "store.product": "Product",
    "store.amount": "Amount",
    "store.txid_label": "Transaction ID (TXID / Order ID)",
    "store.txid_placeholder": "Enter transaction ID here to confirm...",
    "store.txid_help": "You can find this ID in the Binance app after completing the transfer",
    "store.confirm_pay": "Confirm Payment",
    "store.submitting": "Submitting...",
    "store.vip_badge": "VIP",
    "store.stars_recharge": "Recharge Stars",
    "store.need_more": "You need",
    "store.points_extra": "extra points",
    "store.collect_daily": "Collect them from daily rewards and gifts.",
    "store.features.cam": "Camera Switch",
    "store.features.filters": "Premium Filters",
    "store.features.badge": "VIP Gold Badge",
    "store.features.points": "100 Free Points/Month",
    "store.features.shield": "Gender & Country Filter",
    "store.features.priority": "Matching Priority",

    // Common
    "common.back": "Back",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.loading": "Loading...",
  },
  fr: {
    // Nav
    "nav.features": "Fonctionnalités",
    "nav.store": "Boutique",
    "nav.faq": "FAQ",
    "nav.security": "Sécurité",
    "nav.login": "Connexion",
    "nav.start": "Commencer",
    "nav.chat": "Démarrer le chat",
    "nav.profile": "Profil",
    "nav.logout": "Déconnexion",
    "nav.vip_member": "Membre VIP",
    "nav.logged_in": "Connecté",

    // Home Page
    "home.hero_title": "Connectez-vous au monde en direct",
    "home.hero_desc": "Chat vidéo aléatoire sûr et rapide. Commencez maintenant et rencontrez de nouvelles personnes du monde entier en un clic.",
    "home.start_now": "Commencer Gratuitement",
    "home.stats_users": "Utilisateurs Actifs",
    "home.stats_countries": "Pays",
    "home.stats_matches": "Matchs Quotidiens",
    "home.active_users": "Utilisateurs actifs",
    "home.why_choose": "Pourquoi choisir",
    "home.how_it_works": "Comment ça marche",

    // Chat Room
    "chat.title": "Salle de chat",
    "chat.start_hint": "Appuyez sur Démarrer",
    "chat.online": "En ligne",
    "chat.waiting": "Recherche d'un partenaire...",
    "chat.start_btn": "Démarrer",
    "chat.stop_btn": "Arrêter",
    "chat.next_btn": "Suivant",
    "chat.mic": "Micro",
    "chat.cam": "Caméra",
    "chat.audio": "Audio",
    "chat.chat_btn": "Chat",
    "chat.friends": "Amis",
    "chat.store": "Boutique",
    "chat.bg": "Fond",
    "chat.gift": "Cadeau",
    "chat.radar": "Radar",
    "chat.report": "Signaler",
    "chat.searching": "Recherche d'utilisateurs en ligne...",

    // User Profile Card
    "profile.years": "ans",
    "profile.male": "♂ Homme",
    "profile.female": "♀ Femme",
    "profile.online": "● En ligne",
    "profile.offline": "Hors ligne",
    "profile.stars": "Étoiles",
    "profile.points": "Points",
    "profile.views": "Vues",
    "profile.since": "Depuis",
    "profile.view_profile": "Voir le profil",
    "profile.send_friend": "Envoyer demande d'ami",
    "profile.is_friend": "Déjà amis",
    "profile.pending": "Demande en attente",
    "profile.loading": "Chargement...",
    "profile.not_found": "Profil non trouvé",

    // Store
    "store.title": "Boutique ConnectLive",
    "store.desc": "Améliorez votre expérience avec Premium — Achetez via Binance Pay ou USDT.",
    "store.exclusive": "Offres Exclusives",
    "store.vip_title": "Premium VIP",
    "store.vip_desc": "Le forfait pro ultime",
    "store.current_sub": "Déjà abonné",
    "store.digital_pay": "💰 Paiement Digital (Binance)",
    "store.my_points": "Mes Points",
    "store.balance": "Solde Actuel",
    "store.subscribe_btn": "S'abonner via Binance/USDT",
    "store.points_btn": "S'abonner pour 500 Points ⚡",
    "store.stars_title": "Acheter des étoiles",
    "store.stars_buy": "Acheter",
    "store.stars_pack_1": "Pack Débutant",
    "store.stars_pack_2": "Pack Économique",
    "store.stars_pack_3": "Pack Pro",
    "store.most_popular": "Le plus populaire ⭐",
    "store.stars_count": "Étoiles",
    "store.buy_now": "Acheter maintenant",
    "store.pay_modal_title": "Confirmer le paiement",
    "store.pay_modal_desc": "Choisissez votre mode de paiement et transférez.",
    "store.product": "Produit",
    "store.amount": "Montant",
    "store.txid_label": "ID de transaction (TXID / Order ID)",
    "store.txid_placeholder": "Entrez l'ID de transaction ici...",
    "store.txid_help": "Vous trouverez cet ID dans l'application Binance après le transfert",
    "store.confirm_pay": "Confirmer le paiement",
    "store.submitting": "Envoi...",
    "store.vip_badge": "VIP",
    "store.stars_recharge": "Recharger des étoiles",
    "store.need_more": "Il vous faut",
    "store.points_extra": "points de plus",
    "store.collect_daily": "Collectez-les via les récompenses quotidiennes.",
    "store.features.cam": "Changement de Caméra",
    "store.features.filters": "Filtres Premium",
    "store.features.badge": "Badge d'or VIP",
    "store.features.points": "100 Points Gratuits/Mois",
    "store.features.shield": "Filtre Genre & Pays",
    "store.features.priority": "Priorité de Match",

    // Common
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
