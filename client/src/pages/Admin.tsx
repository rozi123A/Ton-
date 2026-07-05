import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Users, Globe, Crown, RefreshCw, ArrowRight, Lock, Shield, Eye, EyeOff } from 'lucide-react';

const ADMIN_SESSION_KEY = 'admin_mode';

const COUNTRY_NAMES: Record<string, string> = {
  SA:'السعودية 🇸🇦', AE:'الإمارات 🇦🇪', EG:'مصر 🇪🇬', KW:'الكويت 🇰🇼',
  QA:'قطر 🇶🇦', BH:'البحرين 🇧🇭', OM:'عمان 🇴🇲', JO:'الأردن 🇯🇴',
  LB:'لبنان 🇱🇧', IQ:'العراق 🇮🇶', SY:'سوريا 🇸🇾', MA:'المغرب 🇲🇦',
  DZ:'الجزائر 🇩🇿', TN:'تونس 🇹🇳', LY:'ليبيا 🇱🇾', YE:'اليمن 🇾🇪',
  SD:'السودان 🇸🇩', TR:'تركيا 🇹🇷', PK:'باكستان 🇵🇰', IN:'الهند 🇮🇳',
  US:'أمريكا 🇺🇸', GB:'بريطانيا 🇬🇧', DE:'ألمانيا 🇩🇪', FR:'فرنسا 🇫🇷',
  AR:'الأرجنتين 🇦🇷', EC:'الإكوادور 🇪🇨',
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'الآن';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
  return `منذ ${Math.floor(seconds / 86400)} يوم`;
}

/* ══════════════════════════════════════════════════════════
   Password Gate — independent of user role
══════════════════════════════════════════════════════════ */
function PasswordGate({ onVerified }: { onVerified: () => void }) {
  const [secret, setSecret] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const verifyMutation = trpc.admin.verifySecret.useMutation({
    onSuccess: (data) => {
      if (data.verified) {
        // Store admin session — survives page navigations but not tab close
        sessionStorage.setItem(ADMIN_SESSION_KEY, data.token);
        // Also try to set DB role (if user is logged in) — best effort
        onVerified();
      }
    },
    onError: (e) => setError(e.message),
  });

  const activateMutation = trpc.admin.activate.useMutation();

  const handleSubmit = () => {
    setError('');
    if (!secret.trim()) return;
    verifyMutation.mutate(
      { secret: secret.trim() },
      {
        onSuccess: () => {
          // Also promote DB role (best-effort — might fail if not logged in)
          activateMutation.mutate({ secret: secret.trim() });
        },
      }
    );
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100%', backgroundColor: '#030712',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px', padding: '32px 24px', textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '64px', height: '64px', borderRadius: '16px',
          background: 'linear-gradient(135deg,#7c3aed,#db2777)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Lock style={{ width: '28px', height: '28px', color: 'white' }} />
        </div>

        <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 900, marginBottom: '6px' }}>
          لوحة الإدارة
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '28px' }}>
          أدخل كلمة المرور للدخول
        </p>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
            color: '#fca5a5', fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        {/* Password input */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="كلمة المرور"
              dir="ltr"
              style={{
                width: '100%', boxSizing: 'border-box',
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px', padding: '12px 40px 12px 14px',
                color: 'white', fontSize: '15px', outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.4)', padding: 0,
              }}
            >
              {showPw
                ? <EyeOff style={{ width: '16px', height: '16px' }} />
                : <Eye style={{ width: '16px', height: '16px' }} />
              }
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={verifyMutation.isPending}
            style={{
              backgroundColor: '#7c3aed', color: 'white', border: 'none',
              borderRadius: '12px', padding: '12px 20px',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              opacity: verifyMutation.isPending ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            {verifyMutation.isPending ? '...' : 'دخول'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Admin Dashboard
══════════════════════════════════════════════════════════ */
function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [, setLocation] = useLocation();

  const { data: registrations, isLoading: regLoading, refetch, isFetching } =
    trpc.admin.newRegistrations.useQuery(50, { refetchInterval: 30_000 });

  const { data: countryStats } =
    trpc.admin.countryStats.useQuery(undefined, { refetchInterval: 30_000 });

  const totalUsers = registrations?.length ?? 0;
  const premiumCount = registrations?.filter(u => u.isPremium).length ?? 0;
  const todayCount = registrations?.filter(u => {
    const d = new Date(u.createdAt);
    return d.toDateString() === new Date().toDateString();
  }).length ?? 0;
  const maxCount = Math.max(...(countryStats?.map(s => s.count) ?? [1]), 1);

  if (regLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(168,85,247,0.4)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%', backgroundColor: '#030712', color: 'white' }}>
      <div style={{ padding: '16px', maxWidth: '672px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingTop: '16px' }}>
          <button onClick={() => setLocation('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}>
            <ArrowRight style={{ width: '20px', height: '20px' }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>لوحة الإدارة</h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>مراقبة التسجيلات والدول</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => refetch()}
              style={{
                padding: '8px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)',
                border: 'none', cursor: 'pointer', color: 'white',
                animation: isFetching ? 'spin 0.8s linear infinite' : 'none',
              }}
            >
              <RefreshCw style={{ width: '16px', height: '16px' }} />
            </button>
            <button
              onClick={() => { sessionStorage.removeItem(ADMIN_SESSION_KEY); onLogout(); }}
              style={{
                padding: '8px 14px', borderRadius: '10px',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                cursor: 'pointer', color: '#fca5a5', fontSize: '12px', fontWeight: 700,
              }}
            >
              خروج
            </button>
          </div>
        </div>

        {/* Admin badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: '12px', padding: '10px 14px', marginBottom: '20px',
        }}>
          <Shield style={{ width: '18px', height: '18px', color: '#a78bfa' }} />
          <span style={{ color: '#c4b5fd', fontSize: '13px', fontWeight: 700 }}>دخلت كمدير — صلاحيات كاملة</span>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: 'rgba(88,28,135,0.5)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
            <Users style={{ width: '20px', height: '20px', color: '#c084fc', margin: '0 auto 4px' }} />
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'white' }}>{totalUsers}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#d8b4fe' }}>المستخدمون</p>
          </div>
          <div style={{ backgroundColor: 'rgba(113,63,18,0.5)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
            <Crown style={{ width: '20px', height: '20px', color: '#facc15', margin: '0 auto 4px' }} />
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'white' }}>{premiumCount}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#fde047' }}>Premium</p>
          </div>
          <div style={{ backgroundColor: 'rgba(20,83,45,0.5)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
            <Globe style={{ width: '20px', height: '20px', color: '#4ade80', margin: '0 auto 4px' }} />
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'white' }}>{todayCount}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#86efac' }}>اليوم</p>
          </div>
        </div>

        {/* Country Stats */}
        {countryStats && countryStats.length > 0 && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe style={{ width: '16px', height: '16px', color: '#60a5fa' }} />
              المستخدمون حسب الدولة
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {countryStats.map(s => (
                <div key={s.country} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', width: '110px', textAlign: 'right', color: 'rgba(255,255,255,0.8)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {COUNTRY_NAMES[s.country] ?? s.country}
                  </span>
                  <div style={{ flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(to right,#9333ea,#ec4899)', borderRadius: '99px', width: `${(s.count / maxCount) * 100}%`, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', width: '24px', textAlign: 'left', flexShrink: 0 }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registrations List */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users style={{ width: '16px', height: '16px', color: '#c084fc' }} />
              آخر التسجيلات
            </h2>
          </div>
          {registrations && registrations.length > 0 ? (
            <div>
              {registrations.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <img
                    src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', flexShrink: 0 }}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`; }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name || 'مجهول'}
                      </span>
                      {u.isPremium && <Crown style={{ width: '12px', height: '12px', color: '#facc15', flexShrink: 0 }} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                        {u.country ? (COUNTRY_NAMES[u.country] ?? u.country) : '🌍 غير معروفة'}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>•</span>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{u.loginMethod ?? 'guest'}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                    {timeAgo(u.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
              لا يوجد مستخدمون حتى الآن
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '16px', paddingBottom: '24px' }}>
          يتحدث تلقائياً كل 30 ثانية
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Export — routes between gate and dashboard
══════════════════════════════════════════════════════════ */
export default function Admin() {
  const [verified, setVerified] = useState(() =>
    !!sessionStorage.getItem(ADMIN_SESSION_KEY)
  );

  if (!verified) {
    return <PasswordGate onVerified={() => setVerified(true)} />;
  }

  return <AdminDashboard onLogout={() => setVerified(false)} />;
}
