import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/**
 * FAQ Section Component
 * Design: Accordion-style FAQ with questions and answers
 * Features: Collapsible sections for easy readability
 */

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "ما هو ConnectLive؟",
    answer: "ConnectLive هي منصة دردشة فيديو عشوائية تتيح لك التواصل الفوري مع أشخاص حقيقيين من جميع أنحاء العالم عبر مكالمات الفيديو والصوت، مع التركيز على الخصوصية والأمان.",
  },
  {
    question: "هل ConnectLive آمن؟",
    answer: "نعم، الأمان هو أولويتنا القصوى. نستخدم تقنيات تشفير متقدمة لحماية اتصالاتك، ولا نقوم بتخزين أي بيانات شخصية أو سجلات للمكالمات. كما يتم التحقق من المستخدمين بواسطة الذكاء الاصطناعي لضمان بيئة آمنة.",
  },
  {
    question: "هل أحتاج إلى التسجيل لاستخدام ConnectLive؟",
    answer: "لا، يمكنك البدء في استخدام ConnectLive فوراً دون الحاجة إلى إنشاء حساب أو تقديم أي معلومات شخصية. نحن نؤمن بالوصول السريع والمجهول.",
  },
  {
    question: "ما هي المتطلبات التقنية لاستخدام ConnectLive؟",
    answer: "لتحقيق أفضل تجربة، تحتاج إلى: متصفح ويب حديث يدعم WebRTC (مثل Chrome، Firefox، Safari، Edge)، كاميرا وميكروفون يعملان بشكل صحيح، اتصال إنترنت مستقر، والسماح للمتصفح بالوصول إلى الكاميرا والميكروفون.",
  },
  {
    question: "هل يمكنني التواصل مع أشخاص من بلدان معينة؟",
    answer: "بشكل افتراضي، يتم مطابقتك عشوائياً مع مستخدمين من جميع أنحاء العالم. في المستقبل، قد نوفر ميزات اختيار المنطقة الجغرافية كجزء من الميزات المدفوعة.",
  },
  {
    question: "هل يمكنني إيقاف تشغيل الكاميرا أو الميكروفون أثناء المكالمة؟",
    answer: "نعم، يمكنك التحكم الكامل في الكاميرا والميكروفون الخاصين بك في أي وقت أثناء المكالمة. يمكنك تشغيلهما أو إيقاف تشغيلهما بضغطة زر.",
  },
  {
    question: "هل توجد دردشة نصية؟",
    answer: "نعم، بالإضافة إلى مكالمات الفيديو والصوت، يمكنك أيضاً استخدام الدردشة النصية للتواصل مع شريكك في الدردشة.",
  },
  {
    question: "ماذا يحدث إذا أردت الانتقال إلى شخص آخر؟",
    answer: "يمكنك ببساطة النقر على زر \"التالي\" للانتقال فوراً إلى شريك دردشة جديد. سيتم إنهاء المكالمة الحالية والبحث عن شخص آخر.",
  },
  {
    question: "هل ConnectLive مجاني؟",
    answer: "نعم، الميزات الأساسية لـ ConnectLive مجانية تماماً. نحن نخطط لتقديم ميزات إضافية ومتقدمة كجزء من خطط الاشتراك المدفوعة في المستقبل.",
  },
  {
    question: "ماذا أفعل إذا واجهت مشكلة تقنية؟",
    answer: "إذا واجهت أي مشاكل، يرجى التأكد من: السماح للمتصفح بالوصول إلى الكاميرا والميكروفون، تحديث متصفحك إلى أحدث إصدار، التحقق من اتصال الإنترنت الخاص بك، ومراجعة قسم \"استكشاف الأخطاء\" في توثيقنا أو التواصل مع الدعم الفني (إذا كان متاحاً).",
  },
];

export default function FAQ() {
  const { t } = useTranslation();
  return (
    <section id="faq" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            {t('nav.faq')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">ConnectLive</span>
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {t('home.hero_desc')}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem value={`item-${index}`} key={index} className="border-b border-gray-200">
                <AccordionTrigger className="flex justify-between items-center py-4 text-lg font-semibold text-gray-800 hover:text-purple-600 transition-colors">
                  {item.question}
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 text-gray-600 leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
