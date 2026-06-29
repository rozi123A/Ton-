import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Hero Section Component
 * Design: Vibrant gradient background with flowing organic shapes
 * Features: Main CTA buttons, animated elements, and compelling headline
 */
export default function Hero() {
  const [, setLocation] = useLocation();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-pink-500/10 to-cyan-400/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        {/* Logo/Brand */}
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-3xl font-bold text-white animate-pulse">
            C
          </div>
        </div>

        {/* Main Headline */}
        <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-400 leading-tight">
          ابدأ دردشة فيديو حية الآن
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-gray-700 mb-12 max-w-2xl mx-auto leading-relaxed">
          اتصل بأشخاص حقيقيين من حول العالم بدون تسجيل. لا حدود، لا انتظار، فقط اتصالات حقيقية.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            onClick={() => setLocation('/login')}
          >
            ابدأ الدردشة مجاناً
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50 text-lg px-8 py-6 rounded-full"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Play className="w-5 h-5 mr-2" />
            شاهد كيفية العمل
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-col sm:flex-row gap-8 justify-center text-gray-600 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>تحقق من الملفات الشخصية بالذكاء الاصطناعي</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>بدون تسجيل مطلوب</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>اتصالات فورية</span>
          </div>
        </div>
      </div>

      {/* Floating elements for visual interest */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-purple-400 rounded-full opacity-20 blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-pink-400 rounded-full opacity-20 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-cyan-400 rounded-full opacity-20 blur-3xl animate-float" style={{ animationDelay: "4s" }} />
    </section>
  );
}
