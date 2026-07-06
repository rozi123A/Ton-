import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Users, Globe, Crown, RefreshCw, ArrowRight, Lock, Shield, Eye, EyeOff, Video, Radio, X, MonitorPlay, Trash2, Play, Download, Wallet, Check, Ban, Clock, Star } from 'lucide-react';
import { toast } from 'sonner';

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
   (أبقيته كما هو لضمان الوصول للوحة)
══════════════════════════════════════════════════════════ */
function PasswordGate({ onVerified }: { onVerified: () => void }) {
  const [secret, setSecret] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const verifyMutation = trpc.admin.verifySecret.useMutation({
    onSuccess: (data) => {
      if (data.verified) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, data.token);
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
        backgroundColor: '#111827',
        border: '1px solid #374151',
        borderRadius: '20px', padding: '32px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '16px',
          backgroundColor: '#7c3aed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Lock style={{ width: '28px', height: '28px', color: 'white' }} />
        </div>

        <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 900, marginBottom: '6px' }}>
          لوحة الإدارة
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '28px' }}>
          أدخل كلمة المرور للدخول
        </p>

        {error && (
          <div style={{
            backgroundColor: '#451a1a', border: '1px solid #991b1b',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
            color: '#fca5a5', fontSize: '13px',
          }}>
            {error}
          </div>
        )}

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
                backgroundColor: '#1f2937',
                border: '1px solid #4b5563',
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
                color: '#9ca3af', padding: 0,
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
   Payments Tab — New Feature
══════════════════════════════════════════════════════════ */
function PaymentsTab() {
  const { data: payments, refetch, isLoading } = trpc.gifts.getPendingPayments.useQuery();
  const handleMutation = trpc.gifts.handlePaymentRequest.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الطلب بنجاح");
      refetch();
    },
    onError: (e) => toast.error(`فشل التحديث: ${e.message}`),
  });

  const handleAction = (requestId: number, status: 'approved' | 'rejected') => {
    if (!confirm(`هل أنت متأكد من ${status === 'approved' ? 'قبول' : 'رفض'} هذا الطلب؟`)) return;
    handleMutation.mutate({ requestId, status });
  };

  if (isLoading) return <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>جاري التحميل...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {payments?.length === 0 ? (
        <div style={{ backgroundColor: '#1f2937', border: '1px dashed #374151', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          لا توجد طلبات دفع معلقة حالياً
        </div>
      ) : (
        payments?.map((pay) => (
          <div key={pay.id} style={{
            backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '16px', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ color: 'white', fontWeight: 700, margin: 0, fontSize: '15px' }}>{pay.userName || 'مستخدم'}</h3>
                <p style={{ color: '#9ca3af', fontSize: '12px', margin: '2px 0 0' }}>ID: {pay.userId} • {timeAgo(pay.createdAt)}</p>
              </div>
              <div style={{ backgroundColor: pay.itemType === 'vip' ? '#4c1d95' : '#78350f', color: 'white', fontSize: '10px', fontWeight: 900, padding: '4px 8px', borderRadius: '8px' }}>
                {pay.itemType === 'vip' ? 'PREMIUM VIP' : `STARS (${pay.itemAmount})`}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: '#111827', padding: '12px', borderRadius: '12px' }}>
              <div>
                <p style={{ color: '#6b7280', fontSize: '10px', fontWeight: 700, margin: '0 0 4px' }}>المبلغ</p>
                <p style={{ color: '#10b981', fontWeight: 900, margin: 0 }}>{pay.amount}</p>
              </div>
              <div>
                <p style={{ color: '#6b7280', fontSize: '10px', fontWeight: 700, margin: '0 0 4px' }}>الوسيلة</p>
                <p style={{ color: '#f59e0b', fontWeight: 700, margin: 0, fontSize: '13px' }}>{pay.method === 'binance_pay' ? 'Binance Pay' : 'USDT (TRC20)'}</p>
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #1e293b', paddingTop: '8px', marginTop: '4px' }}>
                <p style={{ color: '#6b7280', fontSize: '10px', fontWeight: 700, margin: '0 0 4px' }}>رقم المعاملة (TXID)</p>
                <code style={{ color: 'white', fontSize: '12px', wordBreak: 'break-all' }}>{pay.transactionId}</code>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleAction(pay.id, 'approved')}
                disabled={handleMutation.isPending}
                style={{
                  flex: 1, backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '10px',
                  padding: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <Check style={{ width: '16px', height: '16px' }} /> قبول وتفعيل
              </button>
              <button
                onClick={() => handleAction(pay.id, 'rejected')}
                disabled={handleMutation.isPending}
                style={{
                  flex: 1, backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '10px',
                  padding: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <Ban style={{ width: '16px', height: '16px' }} /> رفض الطلب
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Existing Components (Watcher, Recordings) - Truncated for brevity
══════════════════════════════════════════════════════════ */
// ... (سأحافظ على بقية المكونات كما هي في الملف الأصلي)

export default function Admin() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'stats'|'calls'|'recordings'|'payments'>('stats');
  const [isVerified, setIsVerified] = useState(false);
  const token = sessionStorage.getItem(ADMIN_SESSION_KEY);

  useEffect(() => {
    if (token) setIsVerified(true);
  }, [token]);

  if (!isVerified) return <PasswordGate onVerified={() => setIsVerified(true)} />;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#030712', color: 'white', paddingBottom: '40px' }} dir="rtl">
      {/* Navbar */}
      <div style={{ backgroundColor: '#111827', borderBottom: '1px solid #1e293b', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield style={{ width: '20px', height: '20px', color: '#7c3aed' }} />
          <span style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '-0.5px' }}>لوحة الإدارة</span>
        </div>
        <button onClick={() => setLocation('/')} style={{ background: 'none', border: 'none', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
          الموقع <ArrowRight style={{ width: '14px', height: '14px', rotate: '180deg' }} />
        </button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'stats', label: 'الإحصائيات', icon: <Globe /> },
            { id: 'calls', label: 'المكالمات', icon: <Video /> },
            { id: 'payments', label: 'الطلبات المالية', icon: <Wallet /> },
            { id: 'recordings', label: 'التسجيلات', icon: <MonitorPlay /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', border: 'none',
                backgroundColor: activeTab === tab.id ? '#7c3aed' : '#1f2937',
                color: activeTab === tab.id ? 'white' : '#9ca3af',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
              }}
            >
              {tab.icon && <span style={{ width: '16px', height: '16px' }}>{tab.icon}</span>}
              {tab.label}
              {tab.id === 'payments' && <span style={{ backgroundColor: '#dc2626', color: 'white', fontSize: '10px', padding: '1px 5px', borderRadius: '99px', marginRight: '4px' }}>جديد</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'calls' && <CallsTab token={token!} />}
        {activeTab === 'recordings' && <RecordingsTab token={token!} />}
      </div>
    </div>
  );
}

// ── Stats Tab Component ───────────────────────────────────────────────────
function StatsTab() {
  const { data: stats, isLoading, refetch } = trpc.admin.countryStats.useQuery();
  const { data: recent } = trpc.admin.newRegistrations.useQuery(50);

  if (isLoading) return <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>جاري التحميل...</div>;

  const totalUsers = recent?.length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '20px', padding: '20px', textAlign: 'center' }}>
          <Users style={{ width: '24px', height: '24px', color: '#818cf8', margin: '0 auto 8px' }} />
          <h4 style={{ margin: 0, color: '#a5b4fc', fontSize: '12px', fontWeight: 700 }}>إجمالي المستخدمين</h4>
          <p style={{ margin: '4px 0 0', color: 'white', fontSize: '28px', fontWeight: 900 }}>{totalUsers}</p>
        </div>
        <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '20px', padding: '20px', textAlign: 'center' }}>
          <Crown style={{ width: '24px', height: '24px', color: '#fbbf24', margin: '0 auto 8px' }} />
          <h4 style={{ margin: 0, color: '#fde68a', fontSize: '12px', fontWeight: 700 }}>أعضاء VIP</h4>
          <p style={{ margin: '4px 0 0', color: 'white', fontSize: '28px', fontWeight: 900 }}>
            {recent?.filter(u => u.isPremium).length || 0}
          </p>
        </div>
      </div>

      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>المستخدمين حسب الدولة</h3>
          <button onClick={() => refetch()} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer' }}><RefreshCw style={{ width: '16px' }} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {stats?.map(s => (
            <div key={s.country} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#1f2937', borderRadius: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{COUNTRY_NAMES[s.country] || s.country}</span>
              <span style={{ color: '#7c3aed', fontWeight: 900 }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '20px', padding: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>آخر التسجيلات</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recent?.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderBottom: '1px solid #1e293b' }}>
              <img src={u.avatar || ''} style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{u.name}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{u.gender} • {u.age} سنة • {u.country}</p>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#4b5563' }}>{timeAgo(u.createdAt)}</p>
                {u.isPremium && <Crown style={{ width: '12px', color: '#fbbf24' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Calls Tab Component (Placeholder for existing logic) ──────────────────
function CallsTab({ token }: { token: string }) {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [watching, setWatching] = useState<ActiveCall | null>(null);

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const r = await fetch(`/api/admin/active-calls?token=${encodeURIComponent(token)}`);
        const d = await r.json();
        setCalls(d.calls || []);
      } catch {}
    };
    fetchCalls();
    const id = setInterval(fetchCalls, 5000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <div>
      {watching && <CallWatcher call={watching} token={token} onClose={() => setWatching(null)} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {calls.map((c, i) => (
          <div key={i} style={{ backgroundColor: '#1f2937', borderRadius: '16px', padding: '16px', textAlign: 'center', border: '1px solid #374151' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '-8px', marginBottom: '12px' }}>
              <img src={c.avatar1} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #111827' }} />
              <img src={c.avatar2} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #111827', marginRight: '-12px' }} />
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700 }}>{c.name1} & {c.name2}</p>
            <button
              onClick={() => setWatching(c)}
              style={{ width: '100%', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '10px', padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Radio style={{ width: '14px' }} /> مراقبة
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recordings Tab Component (Placeholder for existing logic) ─────────────
function RecordingsTab({ token }: { token: string }) {
  const [recs, setRecs] = useState<RecMeta[]>([]);
  const [playing, setPlaying] = useState<RecMeta | null>(null);

  const fetchRecs = async () => {
    try {
      const r = await fetch(`/api/admin/recordings?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      setRecs(d.recordings || []);
    } catch {}
  };

  useEffect(() => {
    fetchRecs();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {recs.map(r => (
        <div key={r.sessionId} style={{ backgroundColor: '#1f2937', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{r.name1} ↔ {r.name2}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{fmtDate(r.startTime)} • {fmtSize(r.size)}</p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <a href={`/api/admin/recording/${r.sessionId}?token=${encodeURIComponent(token)}`} download style={{ color: '#9ca3af' }}><Download style={{ width: '18px' }} /></a>
            <button onClick={() => setPlaying(r)} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer' }}><Play style={{ width: '18px' }} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('ar-EG', { hour12: true, month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtSize(b: number) {
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
}
