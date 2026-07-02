import { Heart, X, MessageCircle, Video, UserPlus, Check, Clock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
  currentPeerName?: string;
  currentPeerAvatar?: string;
  currentPeerId?: string;
  myPeerId?: string;
  onSendFriendRequest?: (peerId: string) => void;
}

export default function FriendsPanel({
  friends,
  onClose,
  onStartChat,
  currentPeerName,
  currentPeerAvatar,
  currentPeerId,
  myPeerId,
  onSendFriendRequest,
}: FriendsPanelProps) {
  const [requestSent, setRequestSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'add'>('friends');

  const onlineFriends = friends.filter(f => f.status === 'online');
  const offlineFriends = friends.filter(f => f.status === 'offline');

  const handleSendRequest = async () => {
    if (!currentPeerId || !myPeerId) return;
    setRequestSent(true);
    toast.success(`تم إرسال طلب صداقة إلى ${currentPeerName || 'المستخدم'}`);

    // Send via signal SSE so partner sees it live in ChatRoom
    try {
      await fetch('/api/signal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: myPeerId,
          type: 'friend-request',
          data: { fromName: currentPeerName },
        }),
      });
    } catch {}

    if (onSendFriendRequest) onSendFriendRequest(currentPeerId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/10 max-w-sm w-full max-h-[85vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
          <div className="flex items-center gap-2 text-white font-bold">
            <Heart className="w-5 h-5 text-red-400" />
            الأصدقاء
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'friends'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            قائمة الأصدقاء ({friends.length})
          </button>
          {currentPeerId && (
            <button
              onClick={() => setActiveTab('add')}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                activeTab === 'add'
                  ? 'text-white border-b-2 border-pink-500'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              إضافة صديق
            </button>
          )}
        </div>

        {/* Tab: Add Friend */}
        {activeTab === 'add' && currentPeerId && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
            <div className="relative">
              <img
                src={currentPeerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPeerName}`}
                alt={currentPeerName}
                className="w-20 h-20 rounded-full border-4 border-purple-500/40 object-cover"
              />
              <span className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 rounded-full border-2 border-gray-900" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{currentPeerName || 'مستخدم'}</p>
              <p className="text-green-400 text-xs mt-1">متصل الآن</p>
            </div>
            <p className="text-white/50 text-sm text-center">
              هل تريد إرسال طلب صداقة إلى هذا الشخص؟
            </p>
            {requestSent ? (
              <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-xl px-5 py-3">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-green-300 font-bold">تم إرسال الطلب</span>
              </div>
            ) : (
              <button
                onClick={handleSendRequest}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 active:scale-95 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg"
              >
                <UserPlus className="w-5 h-5" />
                إرسال طلب صداقة
              </button>
            )}
          </div>
        )}

        {/* Tab: Friends List */}
        {activeTab === 'friends' && (
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
                          <img
                            src={friend.avatar}
                            alt={friend.name}
                            className="w-10 h-10 rounded-full border-2 border-white/20 object-cover"
                          />
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{friend.name}</p>
                          <p className="text-green-400 text-xs">متصل الآن</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => onStartChat(friend.id)}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                          >
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
                        <div className="relative">
                          <img
                            src={friend.avatar}
                            alt={friend.name}
                            className="w-10 h-10 rounded-full border-2 border-white/20 object-cover"
                          />
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 rounded-full border-2 border-gray-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{friend.name}</p>
                          <p className="text-white/40 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            آخر ظهور: {friend.lastSeen}
                          </p>
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
                <p className="text-white/60 text-sm font-semibold">لا توجد أصدقاء بعد</p>
                <p className="text-white/40 text-xs mt-1 leading-relaxed">
                  أثناء الدردشة اضغط على تبويب "إضافة صديق"<br />لإرسال طلب للشخص الذي تتحدث معه
                </p>
                {currentPeerId && (
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-4 flex items-center gap-2 bg-purple-600/30 border border-purple-500/40 hover:bg-purple-600/50 text-purple-300 font-bold px-4 py-2 rounded-xl transition-all text-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    أضف الشخص الحالي
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
