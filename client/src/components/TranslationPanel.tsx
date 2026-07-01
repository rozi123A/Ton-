import { Globe, X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface TranslationPanelProps {
  text: string;
  fromLang: string;
  toLang: string;
  onClose: () => void;
}

export default function TranslationPanel({ text, fromLang, toLang, onClose }: TranslationPanelProps) {
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTranslate = async () => {
    if (!text.trim()) return;
    
    setLoading(true);
    try {
      // Placeholder for translation API call
      // In production, this would call Google Translate API or similar
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, fromLang, toLang })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTranslatedText(data.translatedText);
      } else {
        toast.error('فشلت الترجمة. حاول مجدداً.');
      }
    } catch (error) {
      toast.error('خطأ في الاتصال بخدمة الترجمة.');
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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white font-bold">
            <Globe className="w-5 h-5 text-blue-400" />
            ترجمة فورية
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Original Text */}
        <div className="mb-4">
          <p className="text-white/60 text-xs mb-2">النص الأصلي ({fromLang})</p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm break-words">
            {text}
          </div>
        </div>

        {/* Translated Text */}
        <div className="mb-4">
          <p className="text-white/60 text-xs mb-2">الترجمة ({toLang})</p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm break-words min-h-12">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                جاري الترجمة...
              </div>
            ) : translatedText ? (
              translatedText
            ) : (
              <span className="text-white/40">انقر على "ترجم" للبدء</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleTranslate}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? 'جاري الترجمة...' : 'ترجم'}
          </button>
          {translatedText && (
            <button
              onClick={handleCopy}
              className="px-4 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
