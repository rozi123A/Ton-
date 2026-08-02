import { Shield, Lock, UserCheck, Lightbulb } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * Security Section Component
 * Design: Informative section about platform security and privacy
 * Features: Highlights privacy protection, security measures, and community guidelines
 */

interface SecurityPoint {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function Security() {
  const { t: translate } = useTranslation();
  const t = translate;

  const securityPoints: SecurityPoint[] = [
    {
      icon: <Lock className="w-8 h-8" />,
      title: t('security.privacy_title') || "حماية الخصوصية",
      description: t('security.privacy_desc') || "لا نطلب أي معلومات شخصية للتسجيل، ولا نسجل أو نخزن مكالمات الفيديو أو الصوت.",
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: t('security.measures_title') || "إجراءات الأمان",
      description: t('security.measures_desc') || "جميع الاتصالات مشفرة بالكامل، ونستخدم أنظمة ذكاء اصطناعي للتحقق من الهوية.",
    },
    {
      icon: <UserCheck className="w-8 h-8" />,
      title: t('security.community_title') || "بيئة مجتمعية آمنة",
      description: t('security.community_desc') || "نسعى لبناء مجتمع إيجابي ومحترم. نشجع على الاحترام المتبادل.",
    },
    {
      icon: <Lightbulb className="w-8 h-8" />,
      title: t('security.tips_title') || "نصائح للأمان",
      description: t('security.tips_desc') || "لا تشارك معلومات شخصية، كن حذراً من الروابط المشبوهة، واستخدم اتصالاً آمناً.",
    },
  ];

  return (
    <section id="security" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            {t('nav.security')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">ConnectLive</span>
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {t('home.hero_desc')}
          </p>
        </div>

        {/* Security Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {securityPoints.map((point, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(124,58,237,0.1)] transition-all duration-500 hover:-translate-y-2 border border-gray-100/50 overflow-hidden text-center"
            >
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

              {/* Content */}
              <div className="relative z-10">
                {/* Icon */}
                <div
                  className="inline-flex items-center justify-center w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-purple-600 to-pink-500 text-white mb-6 shadow-lg group-hover:shadow-xl group-hover:rotate-6 transition-all duration-500"
                >
                  {point.icon}
                </div>

                {/* Title */}
                <h3 className="font-bold text-xl text-gray-900 mb-3">{point.title}</h3>

                {/* Description */}
                <p className="text-gray-600 leading-relaxed">{point.description}</p>

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
