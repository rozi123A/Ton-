import { Star } from 'lucide-react';

interface PremiumMessageBubbleProps {
  text: string;
  senderName: string;
  time: string;
  isPremium: boolean;
  isMine: boolean;
}

export default function PremiumMessageBubble({
  text,
  senderName,
  time,
  isPremium,
  isMine,
}: PremiumMessageBubbleProps) {
  if (isMine) {
    return (
      <div className="flex flex-col items-end">
        <span className="text-white/40 text-xs mb-0.5">{senderName} · {time}</span>
        <div className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] break-words ${
          isPremium
            ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/30 border border-purple-400/30'
            : 'bg-gradient-to-r from-purple-600 to-pink-500 text-white'
        }`}>
          {isPremium && <Star className="w-3 h-3 inline-block mr-1 fill-yellow-300 text-yellow-300" />}
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      <span className="text-white/40 text-xs mb-0.5">{senderName} · {time}</span>
      <div className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] break-words ${
        isPremium
          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 border border-blue-400/30'
          : 'bg-white/15 text-white'
      }`}>
        {isPremium && <Star className="w-3 h-3 inline-block mr-1 fill-yellow-300 text-yellow-300" />}
        {text}
      </div>
    </div>
  );
}
