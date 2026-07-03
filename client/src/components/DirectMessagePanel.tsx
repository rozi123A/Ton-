import { X, Send, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { playMessageSound } from '@/lib/notificationSound';

interface DirectMessagePanelProps {
  friendId: number;
  friendName: string;
  friendAvatar: string;
  onClose: () => void;
}

export default function DirectMessagePanel({ friendId, friendName, friendAvatar, onClose }: DirectMessagePanelProps) {
  const { user } = useAuth();
  const myId = (user as { id?: number } | null)?.id;
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const { data: messages, refetch } = trpc.messages.getMessages.useQuery(friendId, {
    refetchInterval: 3000,
  });

  const sendMutation = trpc.messages.save.useMutation({
    onSuccess: () => {
      setText('');
      refetch();
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages && messages.length > lastCountRef.current) {
      const last = messages[messages.length - 1];
      if (last && last.senderId !== myId && lastCountRef.current !== 0) {
        playMessageSound();
      }
      lastCountRef.current = messages.length;
    }
  }, [messages, myId]);

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    sendMutation.mutate({ receiverId: friendId, content });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/10 max-w-sm w-full h-[80vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
          <div className="flex items-center gap-2.5">
            <img
              src={friendAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendName}`}
              alt={friendName}
              className="w-9 h-9 rounded-full object-cover border border-white/20"
            />
            <div>
              <p className="text-white font-bold text-sm">{friendName}</p>
              <p className="text-white/40 text-[10px]">دردشة خاصة</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="w-10 h-10 text-white/20 mb-2" />
              <p className="text-white/40 text-sm">لا توجد رسائل بعد</p>
              <p className="text-white/30 text-xs mt-1">ابدأ المحادثة مع {friendName}</p>
            </div>
          ) : (
            messages.map(m => {
              const mine = m.senderId === myId;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-sm'
                        : 'bg-white/10 text-white rounded-bl-sm'
                    }`}
                  >
                    <p className="leading-relaxed break-words">{m.content}</p>
                    <p className={`text-[9px] mt-1 ${mine ? 'text-white/70' : 'text-white/40'}`}>
                      {new Date(m.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="اكتب رسالة..."
            dir="rtl"
            className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
