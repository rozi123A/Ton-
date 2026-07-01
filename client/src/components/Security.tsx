import { ShieldCheck, Lock, UserCheck, Lightbulb } from "lucide-react";

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

const securityPoints: SecurityPoint[] = [
  {
    icon: <Lock className="w-8 h-8" />,
    title: "حماية الخصوصية",
    description: "لا نطلب أي معلومات شخصية للتسجيل، ولا نسجل أو نخزن مكالمات الفيديو أو الصوت أو الدردشات النصية. الاتصال مباشر (P2P) بين جهازك وجهاز شريكك.",
  },
  {
    icon: <ShieldCheck className="w-8 h-8" />,
    title: "إجراءات الأمان",
    description: "جميع الاتصالات مشفرة بالكامل، ونستخدم أنظمة ذكاء اصطناعي للتحقق من هوية المستخدمين. نوفر أدوات للإبلاغ عن أي سلوك مسيء.",
  },
  {
    icon: <UserCheck className="w-8 h-8" />,
    title: "بيئة مجتمعية آمنة",
    description: "نسعى لبناء مجتمع إيجابي ومحترم. نشجع على الاحترام المتبادل والإبلاغ عن الانتهاكات وعدم مشاركة المعلومات الشخصية.",
  },
  {
    icon: <Lightbulb className="w-8 h-8" />,
    title: "نصائح للحفاظ على أمانك",
    description: "لا تشارك معلومات شخصية، كن حذراً من الروابط المشبوهة، استخدم اتصال إنترنت آمن، وحافظ على تحديث متصفحك دائماً.",
  },
];

export default function Security() {
  return (
    <section id="security" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            مركز <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">الأمان</span> في ConnectLive
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            نلتزم بتوفير بيئة آمنة وموثوقة لجميع مستخدمينا. يتم بناء منصتنا على مبادئ الخصوصية والحماية.
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
