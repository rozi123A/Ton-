import { Heart, X, MessageCircle, Video, UserPlus, Check, Clock, Bell, Eye, CheckCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import VerifiedBadge from '@/components/VerifiedBadge';

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  lastSeen: string;
  isVerified?: boolean;
  userId?: number;
}

interface FriendsPanelProps {
  friends: Friend[];
  onClose: () => void;
  onStartChat: (friend: Friend) => void;
  currentPeerName?: string;
  currentPeerAvatar?: string;
  currentPeerId?: string;
  myPeerId?: string;
  onSendFriendRequest?: (peerId: string) => void;
  onFriendAccepted?: () => void;
  onViewProfile?: (userId: number) => void;
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
  onFriendAccepted,
  onViewProfile,
}: FriendsPanelProps) {
  const [requestSent, setRequestSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'add' | 'requests'>('friends');

  const onlineFriends = friends.filter(f => f.status === 'online');
  const offlineFriends = friends.filter(f => f.status === 'offline');

  const utils = trpc.useUtils();
  const markAllReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      toast.success('تم تحديد الكل كمقروء');
      utils.notifications.get.invalidate();
    },
    onError: () => toast.error('حدث خطأ أثناء تحديث الرسائل'),
  });

  const { data: incomingRequests, refetch: refetchRequests } = trpc.social.getIncomingRequests.useQuery(undefined, {
    refetchInterval: 15000,
  });

  useEffect(() => {
    // Auto-clear unread badge when opening the panel
    markAllReadMutation.mutate();
  }, []);

  const acceptRequestMutation = trpc.social.acceptRequest.useMutation({
    onSuccess: (_data, variables) => {
      toast.success('تم قبول طلب الصداقة! يمكنك الآن مراسلته من قائمة الأصدقاء');
      refetchRequests();
      // A profile modal for the sender can remain mounted while the request
      // is accepted. Invalidate its status immediately instead of waiting
      // for a long refetch cycle or a page reload.
      void utils.social.getFriendStatus.invalidate(variables.senderId);
      onFriendAccepted?.();   // refresh friends list in ChatRoom
      setActiveTab('friends'); // switch to friends tab so they see the new friend
    },
    onError: () => toast.error('حدث خطأ أثناء قبول الطلب'),
  });

  const pendingCount = incomingRequests?.length || 0;

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-300 transition-colors hover:bg-emerald-500/20"
              title="تحديد الكل كمقروء"
            >
              <CheckCheck className="w-5 h-5" />
            </button>
            <button onClick={onClose} aria-label="إغلاق لوحة الأصدقاء" className="rounded-full bg-red-500/10 p-1.5 text-red-300 transition-colors hover:bg-red-500/20 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'friends'
                ? 'border-b-2 border-rose-400 text-rose-200'
                : 'text-rose-100/70 hover:text-rose-100'
            }`}
          >
            قائمة الأصدقاء ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`relative flex-1 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'requests'
                ? 'border-b-2 border-rose-400 text-rose-200'
                : 'text-rose-100/70 hover:text-rose-100'
            }`}
          >
            طلبات واردة ({pendingCount})
            {pendingCount > 0 && (
              <span className="absolute top-1.5 left-1/2 translate-x-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
          {currentPeerId && (
            <button
              onClick={() => setActiveTab('add')}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                activeTab === 'add'
                  ? 'border-b-2 border-blue-400 text-blue-200'
                  : 'text-blue-100/70 hover:text-blue-100'
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
                className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-bold text-white shadow-sm shadow-red-950/15 transition-all hover:-translate-y-0.5 hover:bg-red-700 active:scale-[0.98]"
              >
                <UserPlus className="w-5 h-5" />
                إرسال طلب صداقة
              </button>
            )}
          </div>
        )}

        {/* Tab: Incoming Requests */}
        {activeTab === 'requests' && (
          <div className="flex-1 overflow-y-auto">
            {pendingCount === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Bell className="w-12 h-12 text-white/20 mb-3" />
                <p className="text-white/60 text-sm font-semibold">لا توجد طلبات صداقة واردة</p>
                <p className="text-white/40 text-xs mt-1 leading-relaxed">
                  ستظهر هنا طلبات الصداقة التي يرسلها لك الآخرون
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {incomingRequests?.map(req => (
                  <div key={req.requestId} className="p-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <img
                        src={req.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.name}`}
                        alt={req.name}
                        className="w-10 h-10 rounded-full border-2 border-white/20 object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{req.name}</p>
                        <p className="text-white/40 text-xs">يريد إضافتك كصديق</p>
                      </div>
                      <button
                        onClick={() => acceptRequestMutation.mutate({ senderId: req.senderId })}
                        disabled={acceptRequestMutation.isPending}
                        className="flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        قبول
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                        <div className="relative cursor-pointer" onClick={() => friend.userId && onViewProfile?.(friend.userId)}>
                          <img
                            src={friend.avatar}
                            alt={friend.name}
                            className="w-10 h-10 rounded-full border-2 border-white/20 object-cover hover:border-purple-400 transition-colors"
                          />
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => friend.userId && onViewProfile?.(friend.userId)}>
                           <p className="flex items-center gap-1 text-white font-semibold text-sm truncate">
                             <span className="truncate">{friend.name}</span>
                             {friend.isVerified && <VerifiedBadge size={14} />}
                           </p>
                          <p className="text-green-400 text-xs">متصل الآن</p>
                        </div>
                        <div className="flex gap-1">
                          {friend.userId && onViewProfile && (
                            <button
                              onClick={() => onViewProfile(friend.userId!)}
                              className="rounded-full border border-blue-300/30 bg-blue-500/15 p-1.5 text-blue-100 transition-colors hover:bg-blue-600"
                              title="عرض الملف الشخصي"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onStartChat(friend)}
                            className="rounded-full bg-emerald-700 p-1.5 text-white transition-colors hover:bg-emerald-800"
                          >
                            <MessageCircle className="w-4 h-4" />
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
                    <div key={friend.id} className="p-3 transition-colors hover:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="relative cursor-pointer" onClick={() => friend.userId && onViewProfile?.(friend.userId)}>
                          <img
                            src={friend.avatar}
                            alt={friend.name}
                            className="w-10 h-10 rounded-full border-2 border-white/20 object-cover hover:border-purple-400 transition-colors"
                          />
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900" />
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => friend.userId && onViewProfile?.(friend.userId)}>
                           <p className="flex items-center gap-1 text-white font-semibold text-sm truncate">
                             <span className="truncate">{friend.name}</span>
                             {friend.isVerified && <VerifiedBadge size={14} />}
                           </p>
                          <p className="text-white/40 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            آخر ظهور: {friend.lastSeen}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {friend.userId && onViewProfile && (
                            <button
                              onClick={() => onViewProfile(friend.userId!)}
                              className="rounded-full border border-blue-300/30 bg-blue-500/15 p-1.5 text-blue-100 transition-colors hover:bg-blue-600"
                              title="عرض الملف الشخصي"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onStartChat(friend)}
                            className="rounded-full bg-emerald-700 p-1.5 text-white transition-colors hover:bg-emerald-800"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
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
                    className="mt-4 flex items-center gap-2 rounded-full border border-blue-300/35 bg-gradient-to-r from-blue-600/25 to-violet-600/25 px-4 py-2 text-sm font-bold text-blue-100 transition-all hover:from-blue-600/40 hover:to-violet-600/40"
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
