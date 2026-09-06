import { X, UserPlus, Check, Clock, Play } from 'lucide-react';
import { useLocation } from 'wouter';
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import VerifiedBadge from '@/components/VerifiedBadge';

interface UserProfileModalProps {
  userId: number;
  onClose: () => void;
}

export default function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = trpc.users.getPublicProfile.useQuery(userId, {
    enabled: userId > 0,
  });
  const { data: stories = [] } = trpc.stories.getPublicUserStories.useQuery(
    { userId },
    { enabled: userId > 0 },
  );
  const { data: friendStatus, refetch: refetchStatus } = trpc.social.getFriendStatus.useQuery(userId, {
    enabled: userId > 0,
  });

  const sendRequestMutation = trpc.social.sendRequest.useMutation({
    onSuccess: () => {
      toast.success('تم إرسال طلب الصداقة ✅');
      refetchStatus();
    },
    onError: (e) => toast.error(e.message || 'حدث خطأ'),
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center">
        <div className="bg-gray-900 rounded-3xl p-8 flex items-center gap-3 text-white">
          <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          {t('profile.loading')}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-gray-900 rounded-3xl p-8 text-white text-center">
          <p className="text-white/60">{t('profile.not_found')}</p>
        </div>
      </div>
    );
  }

  const status = friendStatus?.status ?? 'none';
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient banner */}
        <div className="h-28 bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 text-white rounded-full p-1.5 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar + basic info */}
        <div className="px-5 pb-5">
          {/* Avatar positioning - moved down more with -mt-10 and adjusted layout */}
          <div className="flex items-start gap-4 -mt-10 mb-4 relative z-20">
            <div className="relative shrink-0">
              <img
                src={profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`}
                alt={profile.name || ''}
                className="w-20 h-20 rounded-2xl border-4 border-gray-900 object-cover bg-white shadow-xl"
              />
            </div>
            
            {/* Info container - added pt-12 to push text below the gradient banner area */}
            <div className="pt-11 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="flex items-center gap-1.5 text-white font-black text-lg leading-tight truncate">
                  <span className="truncate">{profile.name || 'مستخدم'}</span>
                  {profile.isVerified && <VerifiedBadge size={18} />}
                </h2>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {profile.age && (
                  <span className="text-white/60 text-xs">{profile.age} {t('profile.years')}</span>
                )}
                {profile.gender && (
                  <span className="text-white/40 text-xs">
                    {profile.gender === 'male' ? t('profile.male') : profile.gender === 'female' ? t('profile.female') : ''}
                  </span>
                )}
              </div>
              <div className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${profile.isOnline ? 'text-emerald-400' : 'text-white/40'}`}>
                <span className={`h-2 w-2 rounded-full ${profile.isOnline ? 'bg-emerald-400' : 'bg-white/30'}`} />
                {profile.isOnline ? t('profile.online') : t('profile.offline')}
              </div>
              
              {/* Stars and Points (Blurred) */}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                  <span className="text-yellow-500 text-[10px] font-bold">⭐</span>
                  <span className="text-white/50 text-xs font-bold">—</span>
                </div>
                <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  <span className="text-blue-500 text-[10px] font-bold">💎</span>
                  <span className="text-white/50 text-xs font-bold">—</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-white/70 text-sm mb-4 leading-relaxed bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
              {profile.bio}
            </p>
          )}

          {/* Public content preview — no wallet, points, stars, or view stats */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/70 text-xs font-bold">قصص وفيديوهات المستخدم</p>
              {stories.length > 0 && <Play className="w-3.5 h-3.5 text-pink-400" />}
            </div>
            {stories.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {stories.slice(0, 3).map((story: any) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      setLocation(`/profile?userId=${userId}`);
                    }}
                    className="relative aspect-[9/12] rounded-xl overflow-hidden bg-black border border-white/10"
                  >
                    {story.mediaType === 'video' ? (
                      <video src={story.mediaUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={story.mediaUrl} alt="" className="w-full h-full object-cover" />
                    )}
                    {story.mediaType === 'video' && (
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                        فيديو
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-xs rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                لا توجد قصص أو فيديوهات نشطة
              </p>
            )}
          </div>

          {/* Friend request button */}
          {status === 'friends' ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500/15 border border-green-500/30 text-green-400 font-bold text-sm">
              <Check className="w-4 h-4" /> {t('profile.is_friend')}
            </div>
          ) : status === 'pending' ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 font-bold text-sm">
              <Clock className="w-4 h-4" /> {t('profile.pending')}
            </div>
          ) : (
            <button
              onClick={() => sendRequestMutation.mutate({ receiverId: userId })}
              disabled={sendRequestMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {sendRequestMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {t('profile.send_friend')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
