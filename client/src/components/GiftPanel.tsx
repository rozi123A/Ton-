import { Star, X, ShoppingBag } from 'lucide-react';
import { useLocation } from 'wouter';

export const GIFTS = [
  { id: 'rose',    emoji: '🌹', name: 'وردة',   cost: 10  },
  { id: 'heart',   emoji: '❤️',  name: 'قلب',    cost: 15  },
  { id: 'star',    emoji: '🌟',  name: 'نجمة',   cost: 20  },
  { id: 'gift',    emoji: '🎁',  name: 'هدية',   cost: 30  },
  { id: 'diamond', emoji: '💎',  name: 'جوهرة',  cost: 50  },
  { id: 'crown',   emoji: '👑',  name: 'تاج',    cost: 100 },
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
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
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
              className={`flex flex-col items-center py-3 px-2 rounded-xl border transition-all duration-150 ${
                canAfford
                  ? 'border-white/20 hover:border-purple-400 hover:bg-purple-500/20 active:scale-95 cursor-pointer'
                  : 'border-white/5 opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="text-2xl mb-1 leading-none">{gift.emoji}</span>
              <span className="text-white text-xs font-medium">{gift.name}</span>
              <div className="flex items-center gap-0.5 mt-1">
                <Star className="w-2.5 h-2.5 text-yellow-400" />
                <span className="text-yellow-300 text-xs">{gift.cost}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Buy more link */}
      {credits < 10 && (
        <button
          onClick={() => setLocation('/profile')}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs hover:bg-yellow-500/20 transition-colors"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          نقاطك غير كافية — شراء المزيد
        </button>
      )}
    </div>
  );
}
