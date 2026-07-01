import { Heart, X, MessageCircle, Video } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  lastSeen: string;
}

interface FriendsPanelProps {
  friends: Friend[];
  onClose: () => void;
  onStartChat: (friendId: string) => void;
}

export default function FriendsPanel({ friends, onClose, onStartChat }: FriendsPanelProps) {
  const [, setLocation] = useLocation();
  const onlineFriends = friends.filter(f => f.status === 'online');
  const offlineFriends = friends.filter(f => f.status === 'offline');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/10 max-w-sm w-full max-h-[80vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
          <div className="flex items-center gap-2 text-white font-bold">
            <Heart className="w-5 h-5 text-red-400" />
            قائمة الأصدقاء
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          {/* Online Friends */}
          {onlineFriends.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-white/5 border-b border-white/10">
                <p className="text-white/60 text-xs font-bold">متصلون الآن ({onlineFriends.length})</p>
              </div>
              <div className="divide-y divide-white/5">
                {onlineFriends.map(friend => (
                  <div key={friend.id} className="p-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={friend.avatar} alt={friend.name} className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{friend.name}</p>
                        <p className="text-green-400 text-xs">متصل الآن</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => onStartChat(friend.id)} className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors">
                          <Video className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offline Friends */}
          {offlineFriends.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-white/5 border-b border-white/10">
                <p className="text-white/60 text-xs font-bold">غير متصلين ({offlineFriends.length})</p>
              </div>
              <div className="divide-y divide-white/5">
                {offlineFriends.map(friend => (
                  <div key={friend.id} className="p-3 hover:bg-white/5 transition-colors opacity-60">
                    <div className="flex items-center gap-3">
                      <img src={friend.avatar} alt={friend.name} className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{friend.name}</p>
                        <p className="text-white/40 text-xs">آخر ظهور: {friend.lastSeen}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {friends.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Heart className="w-12 h-12 text-white/20 mb-3" />
              <p className="text-white/60 text-sm">لا توجد أصدقاء بعد</p>
              <p className="text-white/40 text-xs mt-1">أضف أشخاصاً تحب للدردشة معهم لاحقاً</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
