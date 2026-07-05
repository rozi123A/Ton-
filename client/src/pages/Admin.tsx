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

  const isAdmin = !loading && !!user && (user as any).role === 'admin';

  const { data: registrations, isLoading: regLoading, refetch, isFetching } =
    trpc.admin.newRegistrations.useQuery(50, { refetchInterval: 30_000, enabled: isAdmin });

  const { data: countryStats } =
    trpc.admin.countryStats.useQuery(undefined, { refetchInterval: 30_000, enabled: isAdmin });

  useEffect(() => {
    if (!loading && (!user || (user as any).role !== 'admin')) {
      setLocation('/');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  if (regLoading) {
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
    <div style={{ minHeight: '100vh', width: '100%', backgroundColor: '#030712', color: 'white' }}>
    <div style={{ padding: '16px', maxWidth: '672px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pt-4">
        <button onClick={() => setLocation('/')} style={{ color: 'rgba(255,255,255,0.5)' }}>
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black">لوحة الإدارة</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>مراقبة التسجيلات والدول</p>
        </div>
        <button
          onClick={() => refetch()}
          className={`mr-auto p-2 rounded-xl transition-colors ${isFetching ? 'animate-spin' : ''}`}
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'rgba(88,28,135,0.5)', border: '1px solid rgba(168,85,247,0.3)' }}>
          <Users className="w-5 h-5 mx-auto mb-1" style={{ color: '#c084fc' }} />
          <p className="text-2xl font-black text-white">{totalUsers}</p>
          <p style={{ color: '#d8b4fe', fontSize: '11px' }}>إجمالي المستخدمين</p>
        </div>
        <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'rgba(113,63,18,0.5)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <Crown className="w-5 h-5 mx-auto mb-1" style={{ color: '#facc15' }} />
          <p className="text-2xl font-black text-white">{premiumCount}</p>
          <p style={{ color: '#fde047', fontSize: '11px' }}>مشتركون Premium</p>
        </div>
        <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'rgba(20,83,45,0.5)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <Globe className="w-5 h-5 mx-auto mb-1" style={{ color: '#4ade80' }} />
          <p className="text-2xl font-black text-white">{todayCount}</p>
          <p style={{ color: '#86efac', fontSize: '11px' }}>تسجيل اليوم</p>
        </div>
      </div>

      {/* Country Stats */}
      {countryStats && countryStats.length > 0 && (
        <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <Globe className="w-4 h-4" style={{ color: '#60a5fa' }} />
            المستخدمون حسب الدولة
          </h2>
          <div className="space-y-2">
            {countryStats.map(s => (
              <div key={s.country} className="flex items-center gap-2">
                <span className="text-sm w-28 text-right truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {COUNTRY_NAMES[s.country] ?? s.country}
                </span>
                <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${(s.count / maxCount) * 100}%`, background: 'linear-gradient(to right, #9333ea, #ec4899)' }}
                  />
                </div>
                <span className="text-xs font-bold w-6 text-left" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registrations List */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <Users className="w-4 h-4" style={{ color: '#c084fc' }} />
            آخر التسجيلات
          </h2>
        </div>
        {registrations && registrations.length > 0 ? (
          <div>
            {registrations.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <img
                  src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`}
                  className="w-9 h-9 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate">
                      {u.name || 'مجهول'}
                    </span>
                    {u.isPremium && (
                      <Crown className="w-3 h-3 flex-shrink-0" style={{ color: '#facc15' }} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {u.country ? (COUNTRY_NAMES[u.country] ?? u.country) : '🌍 دولة غير معروفة'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>•</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{u.loginMethod ?? 'مجهول'}</span>
                  </div>
                </div>
                <span className="flex-shrink-0 text-left" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                  {timeAgo(u.createdAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            لا يوجد مستخدمون حتى الآن
          </div>
        )}
      </div>

      <p className="text-center text-[11px] mt-4 pb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
        يتحدث تلقائياً كل 30 ثانية
      </p>
    </div>
    </div>
  );
}
