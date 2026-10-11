import {
  Menu,
  X,
  LogOut,
  Video,
  UserCircle,
  Star,
  Languages,
  Shield,
  Moon,
  Sun,
  ChevronDown,
  Check,
  ShoppingBag,
} from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import NotificationBell from "@/components/NotificationBell";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SupportedLanguage = "ar" | "en" | "fr";

function PreferencesMenu({
  language,
  setLanguage,
  isDark,
  toggleTheme,
  themeLabel,
}: {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  isDark: boolean;
  toggleTheme: () => void;
  themeLabel: string;
}) {
  const languages: { value: SupportedLanguage; flag: string; label: string }[] = [
    { value: "ar", flag: "🇸🇦", label: "العربية" },
    { value: "en", flag: "🇺🇸", label: "English" },
    { value: "fr", flag: "🇫🇷", label: "Français" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="اللغة والمظهر"
          title="اللغة والمظهر"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Languages className="h-4.5 w-4.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <DropdownMenuLabel className="text-xs text-gray-500 dark:text-gray-400">اللغة</DropdownMenuLabel>
        {languages.map(item => (
          <DropdownMenuItem
            key={item.value}
            onSelect={() => setLanguage(item.value)}
            className="min-h-10 text-gray-800 dark:text-gray-100"
          >
            <span aria-hidden="true" className="text-base">{item.flag}</span>
            <span>{item.label}</span>
            {language === item.value && <Check className="mr-auto h-4 w-4 text-purple-600" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
        <DropdownMenuItem onSelect={toggleTheme} className="min-h-10 text-gray-800 dark:text-gray-100">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{themeLabel}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  const handleLogin = () => setLocation("/login");
  const handleProfile = () => setLocation("/profile");
  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

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

  const preferences = (
    <PreferencesMenu
      language={language as SupportedLanguage}
      setLanguage={setLanguage as (language: SupportedLanguage) => void}
      isDark={isDark}
      toggleTheme={() => toggleTheme?.()}
      themeLabel={isDark ? t("theme.switch_to_light") : t("theme.switch_to_dark")}
    />
  );

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-xl transition-colors dark:border-gray-800 dark:bg-gray-950/95">
      <div className="container mx-auto flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => setLocation("/")}
          aria-label="ConnectLive — الرئيسية"
          className="flex shrink-0 items-center gap-2 rounded-xl text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-md shadow-purple-500/20 sm:h-10 sm:w-10">
            <Video className="h-5 w-5 text-white" />
          </span>
          <span className="font-display text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 sm:text-xl">
            ConnectLive
          </span>
        </button>

        <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-5 xl:flex">
          <button type="button" onClick={() => navigateToSection("features")} className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-gray-200">{t("nav.features")}</button>
          <button type="button" onClick={() => setLocation("/store")} className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-gray-200">{t("nav.store")}</button>
          <button type="button" onClick={() => navigateToSection("faq")} className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-gray-200">{t("nav.faq")}</button>
          <button type="button" onClick={() => navigateToSection("security")} className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-gray-200">{t("nav.security")}</button>
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          {preferences}
          {loading ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" aria-label="جارٍ تحميل الحساب" />
          ) : isAuthenticated && user ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${t("nav.profile")}: ${(user as any).name || "المستخدم"}`}
                    className="flex h-10 items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-2 pr-1 transition hover:border-purple-300 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                  >
                    <img
                      src={(user as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((user as any).name || "user")}`}
                      alt=""
                      className="h-8 w-8 rounded-full border border-purple-300 object-cover"
                    />
                    <span className="hidden max-w-28 truncate text-sm font-semibold text-gray-800 dark:text-gray-100 2xl:inline">
                      {(user as any).name || "المستخدم"}
                    </span>
                    {(user as { isPremium?: boolean }).isPremium && <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />}
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                  <DropdownMenuLabel className="max-w-48 truncate text-gray-700 dark:text-gray-200">{(user as any).name || "المستخدم"}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                  <DropdownMenuItem onSelect={handleProfile} className="min-h-10 text-gray-800 dark:text-gray-100">
                    <UserCircle className="h-4 w-4" /> {t("nav.profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLocation("/store")} className="min-h-10 text-gray-800 dark:text-gray-100">
                    <ShoppingBag className="h-4 w-4" /> {t("nav.store")}
                  </DropdownMenuItem>
                  {(user as any).role === "admin" && (
                    <DropdownMenuItem onSelect={() => setLocation("/admin")} className="min-h-10 text-gray-800 dark:text-gray-100">
                      <Shield className="h-4 w-4 text-red-500" /> لوحة الإدارة
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                  <DropdownMenuItem onSelect={() => void handleLogout()} variant="destructive" className="min-h-10">
                    <LogOut className="h-4 w-4" /> {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={handleStartChat}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-4 text-sm font-bold text-white shadow-md shadow-purple-500/20 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
              >
                <Video className="h-4 w-4" /> {t("nav.chat")}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={handleLogin} className="min-h-10 rounded-full px-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/50">
                {t("nav.login")}
              </button>
              <button type="button" onClick={handleStartChat} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-4 text-sm font-bold text-white shadow-md shadow-purple-500/20 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2">
                <Video className="h-4 w-4" /> {t("nav.start")}
              </button>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 xl:hidden">
          <button
            type="button"
            onClick={handleStartChat}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-3 text-xs font-bold text-white shadow-md shadow-purple-500/20 transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
          >
            <Video className="h-4 w-4" />
            <span>{isAuthenticated ? t("nav.chat") : t("nav.start")}</span>
          </button>
          <button
            type="button"
            aria-label={isMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={isMenuOpen}
            aria-controls="site-mobile-menu"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-800 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-gray-100 dark:hover:bg-gray-800"
            onClick={() => setIsMenuOpen(value => !value)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            {!isMenuOpen && unreadNotifCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-black text-white dark:border-gray-950">
                {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div id="site-mobile-menu" className="xl:hidden border-t border-gray-200 bg-white px-4 pb-5 pt-3 shadow-lg dark:border-gray-800 dark:bg-gray-950">
          <nav aria-label="التنقل" className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => navigateToSection("features")} className="rounded-xl px-3 py-3 text-right text-sm font-semibold text-gray-700 transition hover:bg-purple-50 hover:text-purple-700 dark:text-gray-200 dark:hover:bg-gray-900">{t("nav.features")}</button>
            <button type="button" onClick={() => { setIsMenuOpen(false); setLocation("/store"); }} className="rounded-xl px-3 py-3 text-right text-sm font-semibold text-gray-700 transition hover:bg-purple-50 hover:text-purple-700 dark:text-gray-200 dark:hover:bg-gray-900">{t("nav.store")}</button>
            <button type="button" onClick={() => navigateToSection("faq")} className="rounded-xl px-3 py-3 text-right text-sm font-semibold text-gray-700 transition hover:bg-purple-50 hover:text-purple-700 dark:text-gray-200 dark:hover:bg-gray-900">{t("nav.faq")}</button>
            <button type="button" onClick={() => navigateToSection("security")} className="rounded-xl px-3 py-3 text-right text-sm font-semibold text-gray-700 transition hover:bg-purple-50 hover:text-purple-700 dark:text-gray-200 dark:hover:bg-gray-900">{t("nav.security")}</button>
          </nav>

          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-3 rounded-2xl bg-purple-50 px-3 py-3 dark:bg-purple-950/40">
                  <img
                    src={(user as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((user as any).name || "user")}`}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full border-2 border-purple-400 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate font-bold text-gray-800 dark:text-gray-100">
                      {(user as any).name || "المستخدم"}
                      {(user as { isPremium?: boolean }).isPremium && <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" />}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-purple-600 dark:text-purple-300">
                      {(user as any).isPremium ? `⭐ ${t("nav.vip_member")}` : t("nav.logged_in")}
                    </p>
                  </div>
                  <NotificationBell />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setIsMenuOpen(false); handleProfile(); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-purple-200 px-3 text-sm font-bold text-purple-700 transition hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40">
                    <UserCircle className="h-4 w-4" /> {t("nav.profile")}
                  </button>
                  {(user as any).role === "admin" && (
                    <button type="button" onClick={() => { setIsMenuOpen(false); setLocation("/admin"); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                      <Shield className="h-4 w-4" /> لوحة الإدارة
                    </button>
                  )}
                  <button type="button" onClick={() => { setIsMenuOpen(false); void handleLogout(); }} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-50 px-3 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50">
                    <LogOut className="h-4 w-4" /> {t("nav.logout")}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => { setIsMenuOpen(false); handleLogin(); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-purple-200 px-3 text-sm font-bold text-purple-700 transition hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40">
                <UserCircle className="h-4 w-4" /> {t("nav.login")}
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-purple-200/80 bg-gradient-to-l from-purple-50 to-pink-50 px-3.5 py-3 shadow-sm dark:border-purple-800/70 dark:from-purple-950/50 dark:to-gray-900">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${isDark ? "bg-purple-600 text-white" : "bg-white text-amber-500"}`}>
                {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{isDark ? t("theme.dark_mode") : t("theme.light_mode")}</p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-purple-700 dark:text-purple-300">{isDark ? t("theme.switch_to_light") : t("theme.switch_to_dark")}</p>
              </div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={() => toggleTheme?.()}
              aria-label={isDark ? t("theme.switch_to_light") : t("theme.switch_to_dark")}
              aria-checked={isDark}
              className="h-6 w-11 border-purple-300 bg-gray-300 data-[state=checked]:bg-purple-600 dark:border-purple-700 dark:bg-gray-700"
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 px-1">
            <span className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400"><Languages className="h-4 w-4" /> اللغة</span>
            <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900" role="group" aria-label="اختيار اللغة">
              {([
                ["ar", "🇸🇦", "العربية"],
                ["en", "🇺🇸", "English"],
                ["fr", "🇫🇷", "Français"],
              ] as const).map(([value, flag, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLanguage(value)}
                  aria-label={label}
                  aria-pressed={language === value}
                  className={`flex h-9 w-10 items-center justify-center rounded-full text-lg transition ${language === value ? "bg-white shadow-sm dark:bg-gray-700" : "opacity-60 hover:opacity-100"}`}
                >
                  {flag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
