import { Menu, X, LogOut, Video, UserCircle, Star, Languages } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import NotificationBell from "@/components/NotificationBell";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { language, setLanguage, t } = useTranslation();

  const { data: notifData } = trpc.notifications.get.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const unreadNotifCount = notifData ? notifData.filter(n => !n.isRead).length : 0;

  const handleStartChat = () => setLocation("/chat");
  const handleLogin    = () => setLocation("/login");
  const handleProfile  = () => setLocation("/profile");
  const handleLogout   = async () => { await logout(); setLocation("/"); };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm transition-all duration-300">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation('/')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-200">
            <Video className="w-6 h-6 text-white" />
          </div>
          <span className="font-display text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
            ConnectLive
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">{t('nav.features')}</a>
          <button onClick={() => setLocation('/store')} className="text-gray-700 hover:text-purple-600 font-medium transition-colors">{t('nav.store')}</button>
          <a href="#faq"      className="text-gray-700 hover:text-purple-600 font-medium transition-colors">{t('nav.faq')}</a>
          <a href="#security" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">{t('nav.security')}</a>
        </nav>

        {/* CTA — desktop */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          ) : isAuthenticated && user ? (
            <>
              {/* Notification Bell */}
              <NotificationBell />

              {/* Avatar → profile */}
              <button onClick={handleProfile} title="الملف الشخصي"
                className="relative group"
              >
                <img
                  src={(user as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((user as any).name || "user")}`}
                  alt={(user as any).name || "المستخدم"}
                  className="w-9 h-9 rounded-full border-2 border-purple-400 object-cover group-hover:border-purple-600 transition-colors"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-md" />
              </button>

              {/* Name + profile link */}
              <button onClick={handleProfile}
                className="text-gray-800 font-semibold text-sm hover:text-purple-600 transition-colors flex items-center gap-1"
              >
                {(user as any).name || "المستخدم"}
                {(user as { isPremium?: boolean }).isPremium && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
                <UserCircle className="w-3.5 h-3.5 text-purple-400" />
              </button>

              <button onClick={handleStartChat}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-2 px-5 rounded-full hover:from-purple-700 hover:to-pink-600 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                {t('nav.chat')}
              </button>

              {/* Language Switcher Desktop */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full border border-gray-200">
                <button onClick={() => setLanguage('ar')} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${language === 'ar' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>عربي</button>
                <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${language === 'en' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>EN</button>
                <button onClick={() => setLanguage('fr')} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${language === 'fr' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>FR</button>
              </div>

              <button onClick={handleLogout} title="تسجيل الخروج"
                className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {/* Language Switcher Desktop (Unauthed) */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full border border-gray-200 mr-2">
                <button onClick={() => setLanguage('ar')} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${language === 'ar' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>عربي</button>
                <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${language === 'en' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>EN</button>
                <button onClick={() => setLanguage('fr')} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${language === 'fr' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>FR</button>
              </div>
              <button onClick={handleLogin} className="text-purple-600 font-semibold hover:text-purple-700 transition-colors">
                {t('nav.login')}
              </button>
              <button onClick={handleLogin}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-2 px-6 rounded-full hover:from-purple-700 hover:to-pink-600 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                {t('nav.start')}
              </button>
            </>
          )}
        </div>

        {/* Hamburger — with notification badge */}
        <button className="md:hidden relative p-1" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? (
            <X className="w-6 h-6 text-gray-900" />
          ) : (
            <>
              <Menu className="w-6 h-6 text-gray-900" />
              {unreadNotifCount > 0 && !isMenuOpen && (
                <>
                  {/* Ping animation ring */}
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 opacity-75 animate-ping" />
                  {/* Solid badge with count */}
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-white shadow-lg">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                </>
              )}
            </>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 py-4 px-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          <a href="#features" className="block text-gray-700 hover:text-purple-600 font-medium py-2">{t('nav.features')}</a>
          <button onClick={() => { setIsMenuOpen(false); setLocation('/store'); }} className={`block ${language === 'ar' ? 'text-right' : 'text-left'} w-full text-gray-700 hover:text-purple-600 font-medium py-2`}>{t('nav.store')}</button>
          <a href="#faq"      className="block text-gray-700 hover:text-purple-600 font-medium py-2">{t('nav.faq')}</a>
          <a href="#security" className="block text-gray-700 hover:text-purple-600 font-medium py-2">{t('nav.security')}</a>
          
          {/* Language Switcher Mobile */}
          <div className="flex items-center gap-2 pt-2">
            <Languages className="w-4 h-4 text-gray-400" />
            <div className="flex gap-2">
              <button onClick={() => setLanguage('ar')} className={`px-3 py-1 rounded-lg text-xs font-bold ${language === 'ar' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>العربية</button>
              <button onClick={() => setLanguage('en')} className={`px-3 py-1 rounded-lg text-xs font-bold ${language === 'en' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>English</button>
              <button onClick={() => setLanguage('fr')} className={`px-3 py-1 rounded-lg text-xs font-bold ${language === 'fr' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Français</button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-4 border-t border-gray-100">
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-3 py-2 bg-purple-50 rounded-2xl px-3">
                  <img
                    src={(user as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((user as any).name || "user")}`}
                    alt={(user as any).name || "المستخدم"}
                    className="w-11 h-11 rounded-full border-2 border-purple-400 object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-800 flex items-center gap-1 truncate">
                      {(user as any).name || "المستخدم"}
                      {(user as { isPremium?: boolean }).isPremium && (
                        <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                    </p>
                    <p className="text-xs text-purple-500 font-medium">
                      {(user as any).isPremium ? "⭐ عضو VIP" : "مسجّل الدخول"}
                    </p>
                  </div>
                  {/* Notification bell in mobile menu too */}
                  <NotificationBell />
                </div>
                <button onClick={() => { setIsMenuOpen(false); handleProfile(); }}
                  className="border-2 border-purple-300 text-purple-600 font-bold py-2.5 px-6 rounded-2xl flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
                >
                  <UserCircle className="w-4 h-4 flex-shrink-0" /> الملف الشخصي
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleStartChat(); }}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 px-6 rounded-2xl text-center flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
                >
                  <Video className="w-4 h-4 flex-shrink-0" />
                  ابدأ الدردشة الآن
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                  className="text-red-500 font-semibold py-2 text-center flex items-center justify-center gap-2 hover:text-red-700 transition-colors"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  تسجيل الخروج
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setIsMenuOpen(false); handleLogin(); }}
                  className="text-purple-600 font-bold py-2.5 text-center border-2 border-purple-200 rounded-2xl hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                >
                  <UserCircle className="w-4 h-4" />
                  تسجيل الدخول
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleLogin(); }}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
                >
                  <Video className="w-4 h-4" />
                  ابدأ الآن
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
