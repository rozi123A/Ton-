import { Globe, X, Copy, Check, Languages } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface TranslationPanelProps {
  text: string;
  fromLang: string;
  toLang: string;
  onClose: () => void;
  autoTranslate?: boolean;
  onTranslatedMessage?: (original: string, translated: string) => void;
}

const LANG_OPTIONS = [
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'الإنجليزية' },
  { code: 'fr', name: 'الفرنسية' },
  { code: 'tr', name: 'التركية' },
  { code: 'de', name: 'الألمانية' },
  { code: 'es', name: 'الإسبانية' },
  { code: 'ru', name: 'الروسية' },
  { code: 'zh', name: 'الصينية' },
  { code: 'hi', name: 'الهندية' },
  { code: 'ur', name: 'الأردية' },
  { code: 'fa', name: 'الفارسية' },
];

async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`
    );
    if (!res.ok) throw new Error('فشل الاتصال');
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    throw new Error('لم تُرجع الخدمة نتيجة');
  } catch {
    throw new Error('خطأ في خدمة الترجمة');
  }
}

export default function TranslationPanel({
  text,
  fromLang,
  toLang,
  onClose,
  autoTranslate = false,
  onTranslatedMessage,
}: TranslationPanelProps) {
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [targetLang, setTargetLang] = useState(toLang || 'ar');
  const [isAutoMode, setIsAutoMode] = useState(autoTranslate);
  const [lastTranslated, setLastTranslated] = useState('');

  useEffect(() => {
    if (isAutoMode && text?.trim() && text !== lastTranslated) {
      setLastTranslated(text);
      handleTranslate(text, targetLang);
    }
  }, [text, isAutoMode, targetLang]);

  const handleTranslate = async (src?: string, lang?: string) => {
    const srcText = src ?? text;
    const tgtLang = lang ?? targetLang;
    if (!srcText?.trim()) return;

    setLoading(true);
    try {
      const result = await translateText(srcText, tgtLang);
      setTranslatedText(result);
      if (onTranslatedMessage) onTranslatedMessage(srcText, result);
    } catch (err: any) {
      toast.error(err.message || 'فشلت الترجمة');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('تم نسخ النص');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/10 max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white font-bold">
            <Globe className="w-5 h-5 text-blue-400" />
            ترجمة فورية
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto translate toggle */}
        <div className="flex items-center justify-between mb-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-blue-400" />
            <span className="text-white text-sm font-semibold">ترجمة تلقائية</span>
          </div>
          <button
            onClick={() => setIsAutoMode(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
              isAutoMode ? 'bg-blue-500' : 'bg-white/20'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
                isAutoMode ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Target language selector */}
        <div className="mb-4">
          <p className="text-white/60 text-xs mb-2">ترجم إلى</p>
          <select
            value={targetLang}
            onChange={e => { setTargetLang(e.target.value); setTranslatedText(''); }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
          >
            {LANG_OPTIONS.map(l => (
              <option key={l.code} value={l.code} className="bg-gray-900">
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Original Text */}
        <div className="mb-4">
          <p className="text-white/60 text-xs mb-2">النص الأصلي</p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm break-words min-h-10">
            {text || <span className="text-white/30">لا يوجد نص للترجمة</span>}
          </div>
        </div>

        {/* Translated Text */}
        <div className="mb-4">
          <p className="text-white/60 text-xs mb-2">الترجمة</p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm break-words min-h-12">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay:'0.15s'}} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay:'0.3s'}} />
                <span className="text-white/50 text-xs">جاري الترجمة...</span>
              </div>
            ) : translatedText ? (
              translatedText
            ) : (
              <span className="text-white/30">
                {isAutoMode ? 'في انتظار رسالة للترجمة...' : 'اضغط ترجم للبدء'}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => handleTranslate()}
            disabled={loading || !text?.trim()}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {loading ? 'جاري الترجمة...' : 'ترجم الآن'}
          </button>
          {translatedText && (
            <button
              onClick={handleCopy}
              className="px-4 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>

        {isAutoMode && (
          <p className="text-blue-400/70 text-[11px] mt-3 text-center">
            ✓ الترجمة التلقائية مفعّلة — ستُترجم كل رسالة واردة فوراً
          </p>
        )}
      </div>
    </div>
  );
}
