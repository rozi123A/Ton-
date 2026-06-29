import { Shield, Zap, Users, Lock, Smartphone, Award } from "lucide-react";

/**
 * Features Section Component
 * Design: Showcase key platform features with icons and descriptions
 * Features: Grid layout with feature cards and benefits
 */

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const features: Feature[] = [
  {
    icon: <Zap className="w-8 h-8" />,
    title: "اتصالات فورية وعالية الجودة",
    description: "استمتع باتصالات فيديو وصوت فائقة الوضوح مع أشخاص حقيقيين من جميع أنحاء العالم. بفضل تقنية WebRTC المتقدمة، يتم إنشاء الاتصال في ثوانٍ معدودة، مما يضمن تجربة سلسة وخالية من التأخير.",
    gradient: "from-purple-600 to-blue-600",
  },
  {
    icon: <Shield className="w-8 h-8" />,
    title: "خصوصية وأمان لا مثيل لهما",
    description: "في ConnectLive، خصوصيتك هي أولويتنا القصوى. نحن نضمن: اتصالات مجهولة تماماً، حماية البيانات، تحقق من الملفات الشخصية.",
    gradient: "from-pink-600 to-purple-600",
  },
  {
    icon: <Lock className="w-8 h-8" />,
    title: "تحكم كامل في تجربتك",
    description: "تمنحك ConnectLive التحكم الكامل في مكالماتك: تشغيل/إيقاف الميكروفون والكاميرا، الدردشة النصية، الانتقال السريع.",
    gradient: "from-cyan-600 to-blue-600",
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "مجتمع عالمي متنوع",
    description: "تواصل مع مجتمع واسع ومتنوع من المستخدمين من مختلف الثقافات والخلفيات. اكتشف آفاقاً جديدة، وتعرف على أصدقاء جدد، وشارك الأفكار مع أشخاص من جميع أنحاء العالم.",
    gradient: "from-orange-600 to-pink-600",
  },
  {
    icon: <Smartphone className="w-8 h-8" />,
    title: "مرونة الوصول عبر الأجهزة",
    description: "استخدم ConnectLive بسلاسة على أي جهاز. سواء كنت تفضل التصفح عبر الويب أو استخدام التطبيق، فإن منصتنا متوافقة تماماً مع جميع الأجهزة، مما يضمن لك تجربة متسقة ومريحة أينما كنت.",
    gradient: "from-green-600 to-cyan-600",
  },
  {
    icon: <Award className="w-8 h-8" />,
    title: "سهولة الاستخدام وبدون تسجيل",
    description: "ابدأ الدردشة فوراً دون الحاجة إلى إجراءات تسجيل معقدة. لا يتطلب ConnectLive إنشاء حساب أو التحقق من البريد الإلكتروني، مما يتيح لك الانطلاق مباشرة في محادثات ممتعة ومثيرة.",
    gradient: "from-yellow-600 to-orange-600",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            لماذا تختار <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">ConnectLive</span>؟
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            منصة دردشة فيديو عشوائية حديثة تجمع بين التكنولوجيا المتطورة والتركيز على الخصوصية والأمان.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-100 hover:border-purple-200"
            >
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

              {/* Content */}
              <div className="relative z-10">
                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} text-white mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300`}
                >
                  {feature.icon}
                </div>

                {/* Title */}
                <h3 className="font-bold text-xl text-gray-900 mb-3">{feature.title}</h3>

                {/* Description */}
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>

                {/* Hover accent line */}
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full w-0 group-hover:w-12 transition-all duration-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
