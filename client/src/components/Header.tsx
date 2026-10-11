import { Menu, X, LogOut, Video, UserCircle, Star, Languages, Shield, Moon, Sun } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import NotificationBell from "@/components/NotificationBell";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { language, setLanguage, t: translate } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const t = (key: string) => translate(key);
  const isDark = theme === "dark";

  const { data: notifData } = trpc.notifications.get.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const unreadNotifCount = notifData ? notifData.filter(n => !n.isRead).length : 0;

  const handleStartChat = () => setLocation("/chat");
  const handleLogin    = () => setLocation("/login");
  const handleProfile  = () => setLocation("/profile");
  const handleLogout   = async () => { await logout(); setLocation("/"); };
  const navigateToSection = (sectionId: string) => {
    setIsMenuOpen(false);

    const scrollToSection = () => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", `/#${sectionId}`);
      }
    };

    if (window.location.pathname !== "/") {
      setLocation("/");
      window.setTimeout(scrollToSection, 150);
      return;
    }

    scrollToSection();
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-300">
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
           <button type="button" onClick={() => navigateToSection("features")} className="font-medium text-violet-700 transition-colors hover:text-violet-500 dark:text-violet-200">{t('nav.features')}</button>
          <button onClick={() => setLocation('/store')} className="font-medium text-pink-600 transition-colors hover:text-pink-500 dark:text-pink-300">{t('nav.store')}</button>
           <button type="button" onClick={() => navigateToSection("faq")} className="font-medium text-cyan-700 transition-colors hover:text-cyan-500 dark:text-cyan-300">{t('nav.faq')}</button>
           <button type="button" onClick={() => navigateToSection("security")} className="font-medium text-blue-700 transition-colors hover:text-blue-500 dark:text-blue-300">{t('nav.security')}</button>
        </nav>

        {/* CTA — desktop */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => toggleTheme?.()}
            title={isDark ? t('theme.switch_to_light') : t('theme.switch_to_dark')}
            aria-label={isDark ? t('theme.switch_to_light') : t('theme.switch_to_dark')}
            aria-pressed={isDark}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-300 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          ) : isAuthenticated && user ? (
            <>
              {/* Notification Bell */}
              <NotificationBell />

              {/* Admin dashboard — visible only to admin accounts */}
              {(user as any).role === "admin" && (
                <button
                  onClick={() => setLocation("/admin")}
                  title="لوحة الإدارة"
                  aria-label="لوحة الإدارة"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60"
                >
                  <Shield className="w-4 h-4" />
                </button>
              )}

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
                className="text-gray-800 dark:text-gray-100 font-semibold text-sm hover:text-purple-600 transition-colors flex items-center gap-1"
              >
                {(user as any).name || "المستخدم"}
                {(user as { isPremium?: boolean }).isPremium && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
                <UserCircle className="w-3.5 h-3.5 text-purple-400" />
              </button>

              <button onClick={handleStartChat}
                className="flex items-center gap-2 rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-600 to-green-700 px-5 py-2 font-semibold text-white shadow-sm shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-md"
              >
                <Video className="w-4 h-4" />
                {t('nav.chat')}
              </button>

              {/* Language Switcher Desktop */}
               <div className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 p-1 dark:border-blue-800 dark:bg-blue-950/40">
                <button onClick={() => setLanguage('ar')} className={`rounded-full px-2 py-1 text-base transition-all ${language === 'ar' ? 'bg-gradient-to-r from-blue-600 to-violet-600 shadow-sm ring-1 ring-blue-300/60' : 'opacity-80 hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-900/50'}`} title="العربية">🇸🇦</button>
                <button onClick={() => setLanguage('en')} className={`rounded-full px-2 py-1 text-base transition-all ${language === 'en' ? 'bg-gradient-to-r from-blue-600 to-violet-600 shadow-sm ring-1 ring-blue-300/60' : 'opacity-80 hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-900/50'}`} title="English">🇺🇸</button>
                <button onClick={() => setLanguage('fr')} className={`rounded-full px-2 py-1 text-base transition-all ${language === 'fr' ? 'bg-gradient-to-r from-blue-600 to-violet-600 shadow-sm ring-1 ring-blue-300/60' : 'opacity-80 hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-900/50'}`} title="Français">🇫🇷</button>
              </div>

              <button onClick={handleLogout} title="تسجيل الخروج"
                className="rounded-full border border-red-300/40 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {/* Language Switcher Desktop (Unauthed) */}
              <div className="mr-2 flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 p-1 dark:border-blue-800 dark:bg-blue-950/40">
                <button onClick={() => setLanguage('ar')} className={`rounded-full px-2 py-1 text-base transition-all ${language === 'ar' ? 'bg-gradient-to-r from-blue-600 to-violet-600 shadow-sm ring-1 ring-blue-300/60' : 'opacity-80 hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-900/50'}`} title="العربية">🇸🇦</button>
                <button onClick={() => setLanguage('en')} className={`rounded-full px-2 py-1 text-base transition-all ${language === 'en' ? 'bg-gradient-to-r from-blue-600 to-violet-600 shadow-sm ring-1 ring-blue-300/60' : 'opacity-80 hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-900/50'}`} title="English">🇺🇸</button>
                <button onClick={() => setLanguage('fr')} className={`rounded-full px-2 py-1 text-base transition-all ${language === 'fr' ? 'bg-gradient-to-r from-blue-600 to-violet-600 shadow-sm ring-1 ring-blue-300/60' : 'opacity-80 hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-900/50'}`} title="Français">🇫🇷</button>
              </div>
              <button onClick={handleLogin} className="text-purple-600 font-semibold hover:text-purple-700 transition-colors">
                {t('nav.login')}
              </button>
              <button onClick={handleLogin}
                className="rounded-full border border-emerald-300/45 bg-gradient-to-r from-emerald-600 to-green-700 px-6 py-2 font-semibold text-white shadow-sm shadow-emerald-950/15 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
              >
                {t('nav.start')}
              </button>
            </>
          )}
        </div>

        {/* Hamburger — with notification badge */}
        <button className="relative rounded-full bg-violet-500/10 p-2 text-violet-700 transition-colors hover:bg-violet-500/15 dark:text-violet-200 md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label={isMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}>
          {isMenuOpen ? (
            <X className="w-6 h-6 text-red-500" />
          ) : (
            <>
              <Menu className="w-6 h-6 text-violet-600 dark:text-violet-200" />
              {unreadNotifCount > 0 && !isMenuOpen && (
                <>
                  {/* Ping animation ring */}
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 opacity-75 animate-ping" />
                  {/* Solid badge with count */}
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-gray-950 shadow-lg">
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
         <div className="md:hidden bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-4 px-4 space-y-4 animate-in fade-in slide-in-from-top-2">
           <button type="button" onClick={() => navigateToSection("features")} className="block w-full py-2 text-right font-medium text-violet-700 hover:text-violet-500 dark:text-violet-200">{t('nav.features')}</button>
           <button onClick={() => { setIsMenuOpen(false); setLocation('/store'); }} className={`block ${language === 'ar' ? 'text-right' : 'text-left'} w-full py-2 font-medium text-pink-600 hover:text-pink-500 dark:text-pink-300`}>{t('nav.store')}</button>
           <button type="button" onClick={() => navigateToSection("faq")} className="block w-full py-2 text-right font-medium text-cyan-700 hover:text-cyan-500 dark:text-cyan-300">{t('nav.faq')}</button>
           <button type="button" onClick={() => navigateToSection("security")} className="block w-full py-2 text-right font-medium text-blue-700 hover:text-blue-500 dark:text-blue-300">{t('nav.security')}</button>

          {/* Language Switcher Mobile */}
           <div className="flex items-center gap-2 pt-2">
             <Languages className="w-4 h-4 text-blue-500 dark:text-blue-300" />
            <div className="flex gap-3">
              <button onClick={() => setLanguage('ar')} className={`rounded-full px-1 text-2xl transition-all ${language === 'ar' ? 'scale-110 bg-blue-100 ring-1 ring-blue-300 dark:bg-blue-900/60' : 'opacity-85 hover:bg-blue-50 dark:hover:bg-blue-900/40'}`}>🇸🇦</button>
              <button onClick={() => setLanguage('en')} className={`rounded-full px-1 text-2xl transition-all ${language === 'en' ? 'scale-110 bg-blue-100 ring-1 ring-blue-300 dark:bg-blue-900/60' : 'opacity-85 hover:bg-blue-50 dark:hover:bg-blue-900/40'}`}>🇺🇸</button>
              <button onClick={() => setLanguage('fr')} className={`rounded-full px-1 text-2xl transition-all ${language === 'fr' ? 'scale-110 bg-blue-100 ring-1 ring-blue-300 dark:bg-blue-900/60' : 'opacity-85 hover:bg-blue-50 dark:hover:bg-blue-900/40'}`}>🇫🇷</button>
            </div>
          </div>

           {/* Theme switcher */}
           <div className="flex items-center justify-between gap-3 rounded-2xl border border-purple-200/80 dark:border-purple-800/70 bg-gradient-to-l from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-gray-900 px-3.5 py-3 shadow-sm">
             <div className="flex min-w-0 items-center gap-3">
               <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${isDark ? "bg-purple-600 text-white" : "bg-white text-amber-500"}`}>
                 {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
               </div>
               <div className="min-w-0">
                 <p className="text-sm font-bold text-gray-900 dark:text-white">
                   {isDark ? t('theme.dark_mode') : t('theme.light_mode')}
                 </p>
                 <p className="mt-0.5 truncate text-[11px] font-medium text-purple-700 dark:text-purple-300">
                   {isDark ? t('theme.switch_to_light') : t('theme.switch_to_dark')}
                 </p>
               </div>
             </div>
             <Switch
               checked={isDark}
               onCheckedChange={() => toggleTheme?.()}
                aria-label={isDark ? t('theme.switch_to_light') : t('theme.switch_to_dark')}
               aria-checked={isDark}
                className="h-6 w-11 border-amber-300 bg-amber-400/70 data-[state=checked]:bg-violet-600 dark:border-amber-800 dark:bg-amber-700/50 dark:data-[state=checked]:bg-violet-500"
             />
           </div>

          <div className="flex flex-col gap-2.5 pt-4 border-t border-gray-100">
            {isAuthenticated && user ? (
              <>
                 <div className="flex items-center gap-3 py-2 bg-purple-50 dark:bg-purple-950/40 rounded-2xl px-3">
                  <img
                    src={(user as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((user as any).name || "user")}`}
                    alt={(user as any).name || "المستخدم"}
                    className="w-11 h-11 rounded-full border-2 border-purple-400 object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                     <p className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1 truncate">
                      {(user as any).name || "المستخدم"}
                      {(user as { isPremium?: boolean }).isPremium && (
                        <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                    </p>
                    <p className="text-xs text-purple-500 font-medium">
                      {(user as any).isPremium ? `⭐ ${t('nav.vip_member')}` : t('nav.logged_in')}
                    </p>
                  </div>
                  {/* Notification bell in mobile menu too */}
                  <NotificationBell />
                  {(user as any).role === "admin" && (
                    <button
                      onClick={() => { setIsMenuOpen(false); setLocation("/admin"); }}
                      title="لوحة الإدارة"
                      aria-label="لوحة الإدارة"
                      className="w-9 h-9 rounded-full border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center flex-shrink-0"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button onClick={() => { setIsMenuOpen(false); handleProfile(); }}
                   className="flex items-center justify-center gap-2 rounded-full border border-blue-300 bg-gradient-to-r from-blue-50 to-violet-50 px-6 py-2.5 font-bold text-blue-700 transition-colors hover:from-blue-100 hover:to-violet-100 dark:border-blue-800 dark:from-blue-950/50 dark:to-violet-950/50 dark:text-blue-200"
                >
                  <UserCircle className="w-4 h-4 flex-shrink-0" /> {t('nav.profile')}
                </button>
                {(user as any).role === "admin" && (
                  <button
                    onClick={() => { setIsMenuOpen(false); setLocation("/admin"); }}
                    className="flex items-center justify-center gap-2 rounded-full border border-red-300/50 bg-red-500/10 px-6 py-2.5 font-bold text-red-700 transition-colors hover:bg-red-500/15 dark:border-red-800 dark:text-red-200"
                  >
                    <Shield className="w-4 h-4 flex-shrink-0" /> لوحة الإدارة
                  </button>
                )}
                <button onClick={() => { setIsMenuOpen(false); handleStartChat(); }}
                  className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-green-700 px-6 py-3 text-center font-bold text-white shadow-md shadow-emerald-950/15 transition-all hover:-translate-y-0.5 hover:brightness-110"
                >
                  <Video className="w-4 h-4 flex-shrink-0" />
                  {t('nav.chat')}
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                  className="flex items-center justify-center gap-2 rounded-full border border-red-300/40 bg-red-500/10 py-2.5 text-center font-semibold text-red-700 transition-colors hover:bg-red-500/15 dark:border-red-800 dark:text-red-200"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setIsMenuOpen(false); handleLogin(); }}
                  className="flex items-center justify-center gap-2 rounded-full border border-blue-300 bg-blue-50 py-2.5 text-center font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
                >
                  <UserCircle className="w-4 h-4" />
                  تسجيل الدخول
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleLogin(); }}
                  className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-green-700 px-6 py-3 font-bold text-white shadow-md shadow-emerald-950/15 transition-all hover:-translate-y-0.5 hover:brightness-110"
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
