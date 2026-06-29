import { Menu, X, LogOut, Video } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Header Component
 * Design: Sticky navigation with logo and menu
 * Features: Responsive menu, brand logo, auth-aware navigation
 */

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();

  const handleStartChat = () => setLocation("/chat");
  const handleLogin = () => setLocation("/login");
  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/manus-storage/logo-icon_bfd3654c.png"
            alt="ConnectLive"
            className="w-10 h-10"
          />
          <span className="font-display text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
            ConnectLive
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
            الميزات
          </a>
          <a href="#faq" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
            الأسئلة الشائعة
          </a>
          <a href="#security" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
            الأمان
          </a>
        </nav>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-4">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          ) : isAuthenticated && user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <img
                    src={(user as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((user as any).name || "user")}`}
                    alt={(user as any).name || "المستخدم"}
                    className="w-9 h-9 rounded-full border-2 border-purple-400 object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-md"></span>
                </div>
                <span className="text-gray-800 font-semibold text-sm">
                  {(user as any).name || "المستخدم"}
                </span>
              </div>
              <button
                onClick={handleStartChat}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-2 px-5 rounded-full hover:from-purple-700 hover:to-pink-600 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                ابدأ الدردشة
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleLogin}
                className="text-purple-600 font-semibold hover:text-purple-700 transition-colors"
              >
                تسجيل الدخول
              </button>
              <button
                onClick={handleLogin}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-2 px-6 rounded-full hover:from-purple-700 hover:to-pink-600 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                ابدأ الآن
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? (
            <X className="w-6 h-6 text-gray-900" />
          ) : (
            <Menu className="w-6 h-6 text-gray-900" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 py-4 px-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          <a href="#features" className="block text-gray-700 hover:text-purple-600 font-medium py-2">
            الميزات
          </a>
          <a href="#faq" className="block text-gray-700 hover:text-purple-600 font-medium py-2">
            الأسئلة الشائعة
          </a>
          <a href="#security" className="block text-gray-700 hover:text-purple-600 font-medium py-2">
            الأمان
          </a>
          <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-3 py-2">
                  <div className="relative">
                    <img
                      src={(user as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((user as any).name || "user")}`}
alt={(user as any).name || "المستخدم"}
	                      className="w-10 h-10 rounded-full border-2 border-purple-400 object-cover"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-md"></span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{(user as any).name || "المستخدم"}</p>
                    <p className="text-xs text-gray-500">مسجّل الدخول</p>
                  </div>
                </div>
                <button
                  onClick={() => { setIsMenuOpen(false); handleStartChat(); }}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-3 px-6 rounded-full text-center"
                >
                  ابدأ الدردشة الآن
                </button>
                <button
                  onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                  className="text-red-500 font-medium py-2 text-center"
                >
                  تسجيل الخروج
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setIsMenuOpen(false); handleLogin(); }}
                  className="text-purple-600 font-semibold py-2"
                >
                  تسجيل الدخول
                </button>
                <button
                  onClick={() => { setIsMenuOpen(false); handleLogin(); }}
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