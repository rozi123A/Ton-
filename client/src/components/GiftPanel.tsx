import { Star, X, ShoppingBag } from 'lucide-react';
import { useLocation } from 'wouter';

export const GIFTS = [
  { id: 'rose',    emoji: '🌹', name: 'وردة',   cost: 10  },
  { id: 'heart',   emoji: '❤️',  name: 'قلب',    cost: 15  },
  { id: 'star',    emoji: '🌟',  name: 'نجمة',   cost: 20  },
  { id: 'gift',    emoji: '🎁',  name: 'هدية',   cost: 30  },
  { id: 'diamond', emoji: '💎',  name: 'جوهرة',  cost: 50  },
  { id: 'crown',   emoji: '👑',  name: 'تاج',    cost: 100 },
  { id: 'fire',    emoji: '🔥',  name: 'نار',    cost: 25  },
  { id: 'rocket',  emoji: '🚀',  name: 'صاروخ',  cost: 40  },
  { id: 'unicorn', emoji: '🦄',  name: 'يونيكورن', cost: 75 },
  { id: 'car',     emoji: '🏎️',  name: 'سيارة',  cost: 250 },
  { id: 'island',  emoji: '🏝️',  name: 'جزيرة',  cost: 500 },
  { id: 'planet',  emoji: '🪐',  name: 'كوكب',   cost: 1000 },
] as const;

export type GiftItem = typeof GIFTS[number];

interface GiftPanelProps {
  credits: number;
  onSend: (gift: GiftItem) => void;
  onClose: () => void;
  disabled: boolean;
}

export default function GiftPanel({ credits, onSend, onClose, disabled }: GiftPanelProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl border border-white/10 p-4 mt-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-white font-semibold text-sm">🎁 أرسل هدية</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-yellow-500/20 rounded-full px-2.5 py-1">
            <Star className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-300 text-xs font-bold">{credits} نقطة</span>
          </div>
          <button onClick={onClose} aria-label="إغلاق الهدايا" className="rounded-full bg-red-500/10 p-1.5 text-red-300 transition-colors hover:bg-red-500/20 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gifts grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {GIFTS.map(gift => {
          const canAfford = credits >= gift.cost && !disabled;
          return (
            <button
              key={gift.id}
              onClick={() => canAfford && onSend(gift)}
              disabled={!canAfford}
              className={`group flex flex-col items-center py-3 px-2 rounded-2xl border-2 transition-all duration-200 ${
                canAfford
                ? 'border-amber-300/25 bg-amber-500/5 hover:border-amber-300/65 hover:bg-gradient-to-b hover:from-amber-500/20 hover:to-orange-500/10 active:scale-[0.98] cursor-pointer shadow-sm hover:shadow-md'
                  : 'border-amber-300/10 bg-amber-500/5 opacity-35 cursor-not-allowed'
              }`}
            >
              <span className="text-3xl mb-1.5 leading-none drop-shadow-lg group-hover:scale-125 group-hover:animate-bounce transition-transform duration-200">{gift.emoji}</span>
              <span className="text-white text-xs font-bold">{gift.name}</span>
              <div className="flex items-center gap-0.5 mt-1 bg-yellow-500/20 px-2 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-300 text-[10px] font-bold">{gift.cost}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Buy more link */}
      {credits < 10 && (
        <button
          onClick={() => setLocation('/profile')}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400 to-orange-500 py-2.5 text-xs font-bold text-amber-950 shadow-sm shadow-amber-950/10 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105"
        >
          <ShoppingBag className="w-3.5 h-3.5 flex-shrink-0" />
          نقاطك غير كافية — شراء المزيد
        </button>
      )}
    </div>
  );
}
