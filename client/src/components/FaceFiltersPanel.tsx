import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';

interface FaceFilter {
  id: string;
  name: string;
  emoji: string;
  description: string;
  isPremium: boolean;
}

const FACE_FILTERS: FaceFilter[] = [
  { id: 'none', name: 'بدون فلتر', emoji: '😊', description: 'الوجه الطبيعي', isPremium: false },
  { id: 'bunny', name: 'أرنب', emoji: '🐰', description: 'أذنا أرنب لطيفة', isPremium: false },
  { id: 'cat', name: 'قطة', emoji: '😸', description: 'وجه قطة مرح', isPremium: false },
  { id: 'dog', name: 'كلب', emoji: '🐶', description: 'وجه كلب ودود', isPremium: false },
  { id: 'flower', name: 'زهرة', emoji: '🌸', description: 'إكليل من الزهور', isPremium: true },
  { id: 'sparkle', name: 'براق', emoji: '✨', description: 'تأثيرات براقة', isPremium: true },
  { id: 'neon', name: 'نيون', emoji: '🌈', description: 'ألوان نيون متوهجة', isPremium: true },
  { id: 'vintage', name: 'عتيق', emoji: '📸', description: 'تأثير عتيق كلاسيكي', isPremium: true },
];

interface FaceFiltersPanelProps {
  onClose: () => void;
  isPremium: boolean;
  onSelectFilter: (filterId: string) => void;
}

export default function FaceFiltersPanel({ onClose, isPremium, onSelectFilter }: FaceFiltersPanelProps) {
  const [selectedFilter, setSelectedFilter] = useState('none');

  const handleSelectFilter = (filterId: string) => {
    const filter = FACE_FILTERS.find(f => f.id === filterId);
    if (filter && filter.isPremium && !isPremium) {
      alert('هذا الفلتر متاح فقط لمشتركي Premium');
      return;
    }
    setSelectedFilter(filterId);
    onSelectFilter(filterId);
  };

  return (
    <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl border border-white/10 p-4 mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white font-bold">
          <Sparkles className="w-5 h-5 text-purple-400" />
          فلاتر الوجه
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-4 gap-2">
        {FACE_FILTERS.map(filter => (
          <button
            key={filter.id}
            onClick={() => handleSelectFilter(filter.id)}
            className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all duration-200 ${
              selectedFilter === filter.id
                ? 'border-purple-500 bg-purple-500/20'
                : 'border-white/10 hover:border-white/30'
            } ${filter.isPremium && !isPremium ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={filter.isPremium && !isPremium}
          >
            <span className="text-2xl mb-1">{filter.emoji}</span>
            <span className="text-white text-[10px] font-bold text-center leading-tight">{filter.name}</span>
            {filter.isPremium && (
              <span className="text-yellow-400 text-[8px] mt-0.5">🔒</span>
            )}
          </button>
        ))}
      </div>

      {/* Description */}
      {selectedFilter && (
        <div className="mt-3 p-2 bg-white/5 rounded-lg">
          <p className="text-white/70 text-xs">
            {FACE_FILTERS.find(f => f.id === selectedFilter)?.description}
          </p>
        </div>
      )}
    </div>
  );
}
