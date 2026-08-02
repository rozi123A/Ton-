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

export default function FAQ() {
  const { t: translate } = useTranslation();
  const t = translate;

  const faqItems: FAQItem[] = [
    {
      question: t('faq.q1') || "ما هو ConnectLive؟",
      answer: t('faq.a1') || "ConnectLive هي منصة دردشة فيديو عشوائية تتيح لك التواصل الفوري مع أشخاص حقيقيين.",
    },
    {
      question: t('faq.q2') || "هل ConnectLive آمن؟",
      answer: t('faq.a2') || "نعم، الأمان هو أولويتنا القصوى. نستخدم تقنيات تشفير متقدمة لحماية اتصالاتك.",
    },
    {
      question: t('faq.q3') || "هل أحتاج إلى التسجيل؟",
      answer: t('faq.a3') || "لا، يمكنك البدء في استخدام ConnectLive فوراً دون الحاجة إلى إنشاء حساب.",
    },
    {
      question: t('faq.q4') || "ما هي المتطلبات التقنية؟",
      answer: t('faq.a4') || "تحتاج إلى متصفح ويب حديث يدعم WebRTC وكاميرا وميكروفون واتصال إنترنت مستقر.",
    },
  ];

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
