import { Menu, X, LogOut, Video, UserCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();

  const handleStartChat = () => setLocation("/chat");
  const handleLogin    = () => setLocation("/login");
  const handleProfile  = () => setLocation("/profile");
  const handleLogout   = async () => { await logout(); setLocation("/"); };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation('/')}>
          <img src="/manus-storage/logo-icon_bfd3654c.png" alt="ConnectLive" className="w-10 h-10" />
          <span className="font-display text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
            ConnectLive
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">الميزات</a>
          <a href="#faq"      className="text-gray-700 hover:text-purple-600 font-medium transition-colors">الأسئلة الشائعة</a>
          <a href="#security" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">الأمان</a>
        </nav>

        {/* CTA — desktop */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          ) : isAuthenticated && user ? (
            <>
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
                <UserCircle className="w-3.5 h-3.5 text-purple-400" />
              </button>

              <button onClick={handleStartChat}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-2 px-5 rounded-full hover:from-purple-700 hover:to-pink-600 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                ابدأ الدردشة
              </button>

              <button onClick={handleLogout} title="تسجيل الخروج"
                className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={handleLogin} className="text-purple-600 font-semibold hover:text-purple-700 transition-colors">
                تسجيل الدخول
              </button>
              <button onClick={handleLogin}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-2 px-6 rounded-full hover:from-purple-700 hover:to-pink-600 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                ابدأ الآن
              </button>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X className="w-6 h-6 text-gray-900" /> : <Menu className="w-6 h-6 text-gray-900" />}
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 py-4 px-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          <a href="#features" className="block text-gray-700 hover:text-purple-600 font-medium py-2">الميزات</a>
          <a href="#faq"      className="block text-gray-700 hover:text-purple-600 font-medium py-2">الأسئلة الشائعة</a>
          <a href="#security" className="block text-gray-700 hover:text-purple-600 font-medium py-2">الأمان</a>

          <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-3 py-2">
                  <img
                    src={(user as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((user as any).name || "user")}`}
                    alt={(user as any).name || "المستخدم"}
                    className="w-10 h-10 rounded-full border-2 border-purple-400 object-cover"
                  />
                  <div>
                    <p className="font-semibold text-gray-800">{(user as any).name || "المستخدم"}</p>
                    <p className="text-xs text-gray-500">مسجّل الدخول</p>
                  </div>
                </div>
                <button onClick={() => { setIsMenuOpen(false); handleProfile(); }}
                  className="border border-purple-300 text-purple-600 font-semibold py-2.5 px-6 rounded-full flex items-center justify-center gap-2"
                >
                  <UserCircle className="w-4 h-4" /> الملف الشخصي
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleStartChat(); }}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-3 px-6 rounded-full text-center"
                >
                  ابدأ الدردشة الآن
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                  className="text-red-500 font-medium py-2 text-center"
                >
                  تسجيل الخروج
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setIsMenuOpen(false); handleLogin(); }} className="text-purple-600 font-semibold py-2">
                  تسجيل الدخول
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleLogin(); }}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-2 px-6 rounded-full"
                >
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
