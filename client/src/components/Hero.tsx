import { Play, LogOut, UserPlus, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function Hero() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user, loading, logout } = useAuth();

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
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-pink-800/20 to-cyan-700/20" />
      </div>

      {/* Floating blobs */}
      <div className="absolute top-20 left-10 w-40 h-40 bg-purple-400 rounded-full opacity-20 blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-56 h-56 bg-pink-400 rounded-full opacity-20 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-cyan-400 rounded-full opacity-20 blur-3xl animate-pulse" style={{ animationDelay: "4s" }} />

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 text-center flex flex-col items-center">

        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
            C
          </div>
        </div>

        <h1 className="font-display text-5xl md:text-6xl font-bold mb-4 text-white leading-tight drop-shadow-lg">
          ابدأ دردشة فيديو حية الآن
        </h1>

        {loading ? (
          /* Loading state */
          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="w-36 h-36 rounded-full bg-white/10 animate-pulse border-4 border-white/20" />
            <div className="h-4 w-32 bg-white/20 rounded-full animate-pulse" />
          </div>

        ) : isAuthenticated && user ? (
          /* ===== SAVED ACCOUNT - circular card ===== */
          <div className="mt-8 flex flex-col items-center gap-5">
            <p className="text-white/80 text-base font-medium tracking-wide">حسابك المحفوظ</p>

            {/* Big circular avatar card — clicking it enters chat */}
            <button
              onClick={() => setLocation('/chat')}
              className="group relative flex flex-col items-center gap-4 cursor-pointer"
              title="اضغط للدخول"
            >
              {/* Outer glowing ring */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-400 via-purple-500 to-cyan-400 blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-300 scale-110" />
                {/* Avatar circle */}
                <div className="relative w-36 h-36 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white">
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
                    {user.gender === "male" ? "ذكر" : user.gender === "female" ? "انثى" : "اخر"}
                  </p>
                )}
              </div>

              {/* Enter chat button */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-red-500 group-hover:from-pink-600 group-hover:to-red-600 text-white font-bold px-8 py-3 rounded-full shadow-xl transition-all duration-300 transform group-hover:scale-105">
                <MessageCircle className="w-5 h-5" />
                <span>ابدأ الدردشة الآن</span>
              </div>
            </button>

            {/* Secondary actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <button
                onClick={() => logout()}
                className="flex items-center justify-center gap-2 text-white/70 hover:text-white text-sm border border-white/30 hover:border-white/60 rounded-full px-6 py-2.5 backdrop-blur-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </button>
              <button
                onClick={async () => { await logout(); setLocation("/login"); }}
                className="flex items-center justify-center gap-2 text-white/70 hover:text-white text-sm border border-white/30 hover:border-white/60 rounded-full px-6 py-2.5 backdrop-blur-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                إضافة حساب آخر
              </button>
            </div>
          </div>

        ) : (
          /* ===== GUEST - registration CTA ===== */
          <>
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
              اتصل بأشخاص حقيقيين من حول العالم. لا حدود، لا انتظار، فقط اتصالات حقيقية.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button
                size="lg"
                className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white text-lg px-10 py-6 rounded-full shadow-xl transform hover:scale-105 transition-all duration-300"
                onClick={() => setLocation("/login")}
              >
                ابدأ الدردشة مجاناً
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white/60 text-white hover:bg-white/10 text-lg px-8 py-6 rounded-full backdrop-blur-sm"
                onClick={() =>
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Play className="w-5 h-5 mr-2" />
                شاهد كيفية العمل
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center text-white/70 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
                <span>تحقق بالذكاء الاصطناعي</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
                <span>بدون تسجيل مطلوب</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
                <span>اتصالات فورية</span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
