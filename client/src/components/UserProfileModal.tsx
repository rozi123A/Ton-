import { X, Star, Zap, Heart, UserPlus, Check, Clock, MapPin, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface UserProfileModalProps {
  userId: number;
  onClose: () => void;
}

const COUNTRY_NAMES: Record<string, string> = {
  SA: 'السعودية', AE: 'الإمارات', KW: 'الكويت', QA: 'قطر', BH: 'البحرين',
  OM: 'عُمان', EG: 'مصر', JO: 'الأردن', IQ: 'العراق', SY: 'سوريا',
  LB: 'لبنان', MA: 'المغرب', TN: 'تونس', DZ: 'الجزائر', LY: 'ليبيا',
  YE: 'اليمن', SD: 'السودان', SO: 'الصومال',
};

export default function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const { data: profile, isLoading } = trpc.users.getPublicProfile.useQuery(userId, {
    enabled: userId > 0,
  });
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
          جاري التحميل...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-gray-900 rounded-3xl p-8 text-white text-center">
          <p className="text-white/60">لم يُعثر على الملف الشخصي</p>
        </div>
      </div>
    );
  }

  const status = friendStatus?.status ?? 'none';
  const countryName = profile.country ? (COUNTRY_NAMES[profile.country] ?? profile.country) : null;
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('ar', { year: 'numeric', month: 'long' })
    : null;

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
        <div className="h-24 bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 text-white rounded-full p-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {profile.isPremium && (
            <div className="absolute top-3 left-3 bg-yellow-400 text-gray-900 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-gray-900" /> VIP
            </div>
          )}
        </div>

        {/* Avatar + basic info */}
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-12 mb-4">
            <div className="relative">
              <img
                src={profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`}
                alt={profile.name || ''}
                className="w-20 h-20 rounded-2xl border-4 border-gray-900 object-cover bg-white shadow-xl"
              />
              {profile.isOnline && (
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900" />
              )}
            </div>
            <div className="pb-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-black text-lg leading-tight truncate">{profile.name || 'مستخدم'}</h2>
                {profile.isPremium && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {profile.age && (
                  <span className="text-white/60 text-xs">{profile.age} سنة</span>
                )}
                {profile.gender && (
                  <span className="text-white/40 text-xs">
                    {profile.gender === 'male' ? '♂ ذكر' : profile.gender === 'female' ? '♀ أنثى' : ''}
                  </span>
                )}
                {profile.isOnline ? (
                  <span className="text-green-400 text-xs font-bold">● متصل</span>
                ) : (
                  <span className="text-white/40 text-xs">غير متصل</span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-white/70 text-sm mb-4 leading-relaxed bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
              {profile.bio}
            </p>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              </div>
              <p className="text-white font-black text-base">{profile.wallet ?? 0}</p>
              <p className="text-white/50 text-[10px] font-bold">نجوم</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <p className="text-white font-black text-base">{profile.credits ?? 0}</p>
              <p className="text-white/50 text-[10px] font-bold">نقاط</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className="text-white font-black text-base">{profile.profileViews ?? 0}</p>
              <p className="text-white/50 text-[10px] font-bold">مشاهدة</p>
            </div>
          </div>

          {/* Extra info */}
          <div className="flex flex-wrap gap-2 mb-4">
            {countryName && (
              <span className="flex items-center gap-1 bg-white/5 border border-white/10 text-white/60 text-xs px-3 py-1.5 rounded-full">
                <MapPin className="w-3 h-3" /> {countryName}
              </span>
            )}
            {memberSince && (
              <span className="flex items-center gap-1 bg-white/5 border border-white/10 text-white/60 text-xs px-3 py-1.5 rounded-full">
                <Heart className="w-3 h-3" /> منذ {memberSince}
              </span>
            )}
          </div>

          {/* Friend request button */}
          {status === 'friends' ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500/15 border border-green-500/30 text-green-400 font-bold text-sm">
              <Check className="w-4 h-4" /> أصدقاء بالفعل
            </div>
          ) : status === 'pending' ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 font-bold text-sm">
              <Clock className="w-4 h-4" /> طلب الصداقة بانتظار الرد
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
              إرسال طلب صداقة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
