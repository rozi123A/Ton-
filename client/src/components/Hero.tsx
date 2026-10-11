import { MessageCircle, Play, Users, Video } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function Hero() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();

  const browseUsers = () => {
    document.getElementById("trending-users")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative flex min-h-[78svh] items-center justify-center overflow-hidden px-4 py-14 sm:min-h-[82svh] sm:py-20">
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0"
        style={{ backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.15),transparent_50%)]" />
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-purple-600/30 blur-[120px] animate-pulse" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-pink-600/30 blur-[120px] animate-pulse [animation-delay:2s]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-1/4 top-1/2 h-32 w-32 rounded-full bg-cyan-400 opacity-20 blur-3xl animate-pulse [animation-delay:4s]" />

      <div className="container relative z-10 mx-auto flex flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-white shadow-2xl sm:mb-6 sm:h-16 sm:w-16">
          <Video className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>

        <h1 className="font-display mb-3 max-w-4xl text-4xl font-black leading-tight text-white drop-shadow-lg sm:mb-4 sm:text-5xl md:text-6xl">
          {t("home.hero_title")}
        </h1>

        {isAuthenticated && user ? (
          <div className="mt-5 flex w-full max-w-xl flex-col items-center gap-5 sm:mt-7">
            <p className="text-sm font-semibold tracking-wide text-white/80 sm:text-base">{t("nav.logged_in")}</p>

            <button
              type="button"
              onClick={() => setLocation("/profile")}
              aria-label="عرض الملف الشخصي"
              className="group flex flex-col items-center gap-3 rounded-3xl px-5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-purple-600"
            >
              <span className="relative">
                <span aria-hidden="true" className="absolute inset-0 scale-125 rounded-full bg-gradient-to-br from-pink-400 via-purple-500 to-cyan-400 opacity-40 blur-xl transition-opacity duration-500 group-hover:opacity-80" />
                <span className="relative block h-28 w-28 overflow-hidden rounded-full border-[3px] border-white/80 bg-white/20 shadow-2xl transition-transform duration-300 group-hover:scale-[1.04] sm:h-32 sm:w-32">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || "user")}`}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={event => {
                      (event.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/avataaars/svg?seed=default";
                    }}
                  />
                </span>
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-green-400 shadow sm:h-5 sm:w-5" />
              </span>
              <span>
                <span className="block text-xl font-black text-white drop-shadow sm:text-2xl">{user.name}</span>
                {user.gender && (
                  <span className="mt-0.5 block text-sm text-white/75">
                    {user.gender === "male" ? t("profile.male") : user.gender === "female" ? t("profile.female") : "other"}
                  </span>
                )}
              </span>
            </button>

            <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                className="min-h-14 w-full gap-2.5 rounded-2xl border-b-4 border-green-800 bg-gradient-to-r from-green-500 to-emerald-600 px-6 text-base font-extrabold text-white shadow-xl shadow-green-950/25 transition hover:-translate-y-0.5 hover:from-green-600 hover:to-emerald-700 active:translate-y-0 sm:text-lg"
                onClick={() => setLocation("/chat")}
              >
                <MessageCircle className="h-5 w-5" />
                {t("nav.chat")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-14 w-full gap-2 rounded-2xl border-2 border-white/60 bg-white/10 px-5 text-base font-bold text-white backdrop-blur transition hover:bg-white/20 sm:text-lg"
                onClick={browseUsers}
              >
                <Users className="h-5 w-5" />
                {t("home.active_users") || "استكشف المستخدمين"}
              </Button>
            </div>
            <p className="text-xs text-white/65 sm:text-sm">يمكنك إدارة الحساب واللغة والمظهر من القائمة العلوية.</p>
          </div>
        ) : (
          <>
            <p className="mb-7 mt-1 max-w-2xl text-base leading-7 text-white/85 sm:mb-9 sm:text-lg md:text-xl">
              {t("home.hero_desc")}
            </p>

            <div className="mb-8 grid w-full max-w-md grid-cols-1 gap-3 sm:mb-10 sm:grid-cols-2">
              <Button
                size="lg"
                className="min-h-14 w-full gap-2.5 rounded-2xl border-b-4 border-red-700 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 px-6 text-base font-extrabold text-white shadow-2xl shadow-pink-950/30 transition hover:-translate-y-0.5 hover:from-pink-600 hover:via-rose-600 hover:to-red-600 active:translate-y-0 sm:text-lg"
                onClick={() => setLocation("/chat")}
              >
                <MessageCircle className="h-5 w-5" />
                {t("home.start_now")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-14 w-full gap-2 rounded-2xl border-2 border-white/60 bg-white/10 px-5 text-base font-bold text-white backdrop-blur transition hover:bg-white/20 sm:text-lg"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Play className="h-5 w-5 fill-white" />
                {t("home.how_it_works") || "كيف يعمل الموقع"}
              </Button>
            </div>

            <div className="grid w-full max-w-3xl grid-cols-1 gap-3 text-sm font-medium text-white/85 sm:grid-cols-3 sm:gap-5">
              <div className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />
                <span>{t("home.badge_ai_verification")}</span>
              </div>
              <div className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />
                <span>{t("home.badge_no_signup")}</span>
              </div>
              <div className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />
                <span>{t("home.badge_instant_connections")}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
