import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { Users, Globe, Crown, RefreshCw, ArrowRight } from 'lucide-react';

const COUNTRY_NAMES: Record<string, string> = {
  SA:'السعودية 🇸🇦', AE:'الإمارات 🇦🇪', EG:'مصر 🇪🇬', KW:'الكويت 🇰🇼',
  QA:'قطر 🇶🇦', BH:'البحرين 🇧🇭', OM:'عمان 🇴🇲', JO:'الأردن 🇯🇴',
  LB:'لبنان 🇱🇧', IQ:'العراق 🇮🇶', SY:'سوريا 🇸🇾', MA:'المغرب 🇲🇦',
  DZ:'الجزائر 🇩🇿', TN:'تونس 🇹🇳', LY:'ليبيا 🇱🇾', YE:'اليمن 🇾🇪',
  SD:'السودان 🇸🇩', TR:'تركيا 🇹🇷', PK:'باكستان 🇵🇰', IN:'الهند 🇮🇳',
  US:'أمريكا 🇺🇸', GB:'بريطانيا 🇬🇧', DE:'ألمانيا 🇩🇪', FR:'فرنسا 🇫🇷',
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'الآن';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
  return `منذ ${Math.floor(seconds / 86400)} يوم`;
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  const { data: registrations, isLoading: regLoading, refetch, isFetching } =
    trpc.admin.newRegistrations.useQuery(50, { refetchInterval: 30_000 });

  const { data: countryStats } =
    trpc.admin.countryStats.useQuery(undefined, { refetchInterval: 30_000 });

  useEffect(() => {
    if (!loading && (!user || (user as any).role !== 'admin')) {
      setLocation('/');
    }
  }, [user, loading]);

  if (loading || regLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalUsers = registrations?.length ?? 0;
  const premiumCount = registrations?.filter(u => u.isPremium).length ?? 0;
  const todayCount = registrations?.filter(u => {
    const d = new Date(u.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length ?? 0;

  const maxCount = Math.max(...(countryStats?.map(s => s.count) ?? [1]), 1);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pt-4">
        <button onClick={() => setLocation('/')} className="text-white/50 hover:text-white">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black">لوحة الإدارة</h1>
          <p className="text-white/40 text-xs">مراقبة التسجيلات والدول</p>
        </div>
        <button
          onClick={() => refetch()}
          className={`mr-auto p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors ${isFetching ? 'animate-spin' : ''}`}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-purple-900/40 border border-purple-500/30 rounded-2xl p-3 text-center">
          <Users className="w-5 h-5 text-purple-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-white">{totalUsers}</p>
          <p className="text-purple-300 text-[11px]">إجمالي المستخدمين</p>
        </div>
        <div className="bg-yellow-900/40 border border-yellow-500/30 rounded-2xl p-3 text-center">
          <Crown className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-white">{premiumCount}</p>
          <p className="text-yellow-300 text-[11px]">مشتركون Premium</p>
        </div>
        <div className="bg-green-900/40 border border-green-500/30 rounded-2xl p-3 text-center">
          <Globe className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-white">{todayCount}</p>
          <p className="text-green-300 text-[11px]">تسجيل اليوم</p>
        </div>
      </div>

      {/* Country Stats */}
      {countryStats && countryStats.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <h2 className="text-sm font-bold text-white/80 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            المستخدمون حسب الدولة
          </h2>
          <div className="space-y-2">
            {countryStats.map(s => (
              <div key={s.country} className="flex items-center gap-2">
                <span className="text-sm w-28 text-right text-white/80 truncate">
                  {COUNTRY_NAMES[s.country] ?? s.country}
                </span>
                <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-white/60 w-6 text-left">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registrations List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-bold text-white/80 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            آخر التسجيلات
          </h2>
        </div>
        {registrations && registrations.length > 0 ? (
          <div className="divide-y divide-white/5">
            {registrations.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <img
                  src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`}
                  className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate">
                      {u.name || 'مجهول'}
                    </span>
                    {u.isPremium && (
                      <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/50">
                      {u.country ? (COUNTRY_NAMES[u.country] ?? u.country) : '🌍 دولة غير معروفة'}
                    </span>
                    <span className="text-white/20 text-[10px]">•</span>
                    <span className="text-[11px] text-white/40">{u.loginMethod ?? 'مجهول'}</span>
                  </div>
                </div>
                <span className="text-[11px] text-white/30 flex-shrink-0 text-left">
                  {timeAgo(u.createdAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-white/30 text-sm">
            لا يوجد مستخدمون حتى الآن
          </div>
        )}
      </div>

      <p className="text-center text-white/20 text-[11px] mt-4 pb-4">
        يتحدث تلقائياً كل 30 ثانية
      </p>
    </div>
  );
}
