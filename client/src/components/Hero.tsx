import { Play, LogOut, UserPlus, MessageCircle, Video } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import CircularIconButton from "@/components/CircularIconButton";

export default function Hero() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user, loading, logout } = useAuth();
  const { t: translate } = useTranslation();
  const t = translate;

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.15),transparent_50%)]" />
      </div>

      {/* Floating blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-pink-600/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-cyan-400 rounded-full opacity-20 blur-3xl animate-pulse" style={{ animationDelay: "4s" }} />

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 text-center flex flex-col items-center">

        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-3xl font-bold text-white shadow-2xl animate-float">
            <Video className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="font-display text-5xl md:text-6xl font-bold mb-4 text-white leading-tight drop-shadow-lg">
          {t('home.hero_title')}
        </h1>

        {isAuthenticated && user ? (
          /* ===== SAVED ACCOUNT - circular card ===== */
          <div className="mt-8 flex flex-col items-center gap-5">
            <p className="text-white/80 text-base font-medium tracking-wide">{t('nav.logged_in')}</p>

            {/* Big circular avatar card — clicking it enters chat */}
            <button
              onClick={() => setLocation('/chat')}
              className="group relative flex flex-col items-center gap-4 cursor-pointer"
              title="اضغط للدخول"
            >
              {/* Outer glowing ring */}
              <div className="relative">
                <div className="absolute inset-0 scale-125 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 opacity-20 blur-xl transition-opacity duration-300 group-hover:opacity-35" />
                {/* Avatar circle */}
                <div className="relative w-40 h-40 rounded-full border-4 border-white/80 shadow-2xl overflow-hidden bg-white/20 group-hover:scale-105 transition-transform duration-500">
                  <img
                    src={
                      user.avatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || "user")}`
                    }
                    alt={user.name || ""}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;
                    }}
                  />
                </div>
                {/* Online indicator */}
                <span className="absolute bottom-2 right-2 w-5 h-5 bg-green-400 border-2 border-white rounded-full shadow" />
              </div>

              {/* Name + gender */}
              <div>
                <p className="text-white font-bold text-2xl drop-shadow">{user.name}</p>
                {user.gender && (
                  <p className="text-white/60 text-sm mt-0.5">
                    {user.gender === "male" ? t('profile.male') : user.gender === "female" ? t('profile.female') : "other"}
                  </p>
                )}
              </div>

              {/* Enter chat button */}
              <div className="flex flex-col items-center gap-1.5 text-white transition-transform duration-200 group-hover:-translate-y-0.5">
                <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border border-emerald-200/55 bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-[0_4px_14px_rgba(16,185,129,0.2)]">
                  <MessageCircle className="h-[22px] w-[22px] stroke-[1.8]" />
                </span>
                <span className="text-[11px] font-semibold leading-4">{t('nav.chat')}</span>
              </div>
            </button>


            {/* Secondary actions */}
            <div className="mt-3 flex flex-wrap justify-center gap-6">
              <CircularIconButton
                icon={<LogOut />}
                label={t('nav.logout')}
                intent="logout"
                onClick={() => logout()}
              />
              <CircularIconButton
                icon={<UserPlus />}
                label={t('nav.add_account') || 'Add Account'}
                intent="addAccount"
                onClick={async () => { await logout(); setLocation("/login"); }}
              />
            </div>
          </div>

        ) : (
          /* ===== GUEST - registration CTA ===== */
          <>
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
              {t('home.hero_desc')}
            </p>

            <div className="mb-12 flex items-start justify-center gap-8">
              <CircularIconButton
                icon={<MessageCircle />}
                label={t('home.start_now')}
                active
                intent="start"
                onClick={() => setLocation("/login")}
              />
              <CircularIconButton
                icon={<Play className="fill-current" />}
                label={t('home.how_it_works') || 'How it works'}
                intent="info"
                onClick={() =>
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
                }
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center text-white/70 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
                <span>{t('home.badge_ai_verification')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
                <span>{t('home.badge_no_signup')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
                <span>{t('home.badge_instant_connections')}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
