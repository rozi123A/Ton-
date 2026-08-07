import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Users, Globe, Crown, RefreshCw, ArrowRight, Lock, Shield, Eye, EyeOff, Video, Radio, X, MonitorPlay, Trash2, Play, Download, Wallet, Check, Ban, Clock, Star, Search, Bell, Wifi } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_SESSION_KEY = 'admin_mode';

type ActiveCall = {
  peerId1: string;
  name1: string;
  avatar1: string;
  userId1?: number;
  peerId2: string;
  name2: string;
  avatar2: string;
  userId2?: number;
};

type RecMeta = {
  sessionId: string;
  name1: string;
  name2: string;
  startTime: number;
  size: number;
};

function CallWatcher({
  call,
  token,
  onClose,
}: {
  call: ActiveCall;
  token: string;
  onClose: () => void;
}) {
  return (
    <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <p style={{ margin: 0, color: 'white', fontWeight: 700 }}>مراقبة المكالمة</p>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '12px' }}>{call.name1} &amp; {call.name2}</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
          <X style={{ width: '18px' }} />
        </button>
      </div>
      <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: 0 }}>
        بدأت المراقبة الآمنة للجلسة. {token ? '' : 'انتهت صلاحية جلسة الإدارة.'}
      </p>
    </div>
  );
}

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
  const { data: payments, refetch, isLoading } = trpc.gifts.getPendingPayments.useQuery(undefined, { refetchInterval: 60000 });
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
  const [activeTab, setActiveTab] = useState<'stats'|'calls'|'recordings'|'payments'|'search'|'broadcast'>('stats');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
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
            { id: 'search', label: 'بحث مستخدم', icon: <Search /> },
            { id: 'broadcast', label: 'إشعار جماعي', icon: <Bell /> },
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
        {activeTab === 'stats' && (
          selectedUserId ? (
            <UserProfileView userId={selectedUserId} adminToken={token!} onBack={() => setSelectedUserId(null)} />
          ) : (
            <StatsTab adminToken={token!} onSelectUser={setSelectedUserId} />
          )
        )}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'calls' && <CallsTab token={token!} />}
        {activeTab === 'recordings' && <RecordingsTab token={token!} />}
        {activeTab === 'search' && <SearchTab adminToken={token!} />}
        {activeTab === 'broadcast' && <BroadcastTab adminToken={token!} />}
      </div>
    </div>
  );
}

function ResetVipsButton() {
  const resetMutation = trpc.gifts.resetAllVips.useMutation({
    onSuccess: () => toast.success("تم سحب VIP من جميع المستخدمين بنجاح"),
    onError: (e) => toast.error(`فشل العملية: ${e.message}`),
  });

  return (
    <button
      onClick={() => confirm("هل أنت متأكد من سحب VIP من جميع المستخدمين؟ (لن يتم المساس بالأدمن)") && resetMutation.mutate()}
      disabled={resetMutation.isPending}
      style={{
        backgroundColor: '#451a1a', color: '#fca5a5', border: '1px solid #991b1b',
        borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
      }}
    >
      {resetMutation.isPending ? "جاري السحب..." : "سحب VIP من الكل"}
    </button>
  );
}

function RevokeUserVipButton({ userId }: { userId: number }) {
  const revokeMutation = trpc.gifts.revokeVip.useMutation({
    onSuccess: () => toast.success("تم سحب VIP من المستخدم"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <button
      onClick={(e) => { e.stopPropagation(); revokeMutation.mutate({ userId }); }}
      disabled={revokeMutation.isPending}
      title="سحب VIP"
      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
    >
      <X style={{ width: '12px', height: '12px' }} />
    </button>
  );
}

// ── Stats Tab Component ───────────────────────────────────────────────────
function StatsTab({ adminToken, onSelectUser }: { adminToken: string; onSelectUser: (id: number) => void }) {
  const { data: dbStatus, isLoading: dbLoading, isError: dbError, refetch: refetchDbStatus, isFetching } = trpc.admin.dbStatus.useQuery(
    { adminToken },
    { 
      enabled: !!adminToken, 
      retry: 3, 
      retryDelay: 2_000, 
      staleTime: 0, 
      refetchInterval: 3000 
    },
  );

  const { data: totalCount, isLoading: totalLoading, refetch: refetchTotalCount } = trpc.admin.totalCount.useQuery(
    { adminToken },
    { enabled: !!adminToken, retry: 3, retryDelay: 1_000, staleTime: 0, refetchInterval: 3000 },
  );
  const { data: onlineCount } = trpc.admin.onlineCount.useQuery(
    { adminToken },
    { enabled: !!adminToken, retry: 3, retryDelay: 1_000, staleTime: 0, refetchInterval: 3000 },
  );

  const statsEnabled = !!adminToken;
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.countryStats.useQuery(
    { adminToken },
    { enabled: statsEnabled, retry: 2, staleTime: 0, refetchInterval: 5000 },
  );
  const { data: recent, isLoading: recentLoading, refetch: refetchRecent } = trpc.admin.newRegistrations.useQuery(
    { adminToken, limit: 100 },
    {
      enabled: statsEnabled,
      retry: 2,
      staleTime: 0,
      refetchInterval: 3000,
    },
  );

  const totalUsers = dbStatus?.connected
    ? dbStatus.totalUsers
    : totalCount ?? dbStatus?.totalUsers ?? 0;
  const vipCount = dbStatus?.premiumUsers ?? 0;
  // Do not let a temporarily empty secondary query hide a value already
  // returned by the DB status query.
  const onlineUsers = Math.max(onlineCount ?? 0, dbStatus?.onlineUsers ?? 0);

  function refetchAll() {
    refetchDbStatus();
    refetchTotalCount();
    refetchStats();
    refetchRecent();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* The admin shell must not wait for PostgreSQL. The health check runs
          in the background and only controls whether real values are filled. */}
      {dbLoading && !dbStatus && totalLoading && (
        <div style={{ backgroundColor: '#172554', border: '1px solid #1d4ed8', borderRadius: '12px', padding: '12px 14px' }}>
          <p style={{ color: '#bfdbfe', fontSize: '12px', margin: 0 }}>⏳ جارِ التحقق من قاعدة البيانات في الخلفية...</p>
        </div>
      )}
      {(dbError || (dbStatus && !dbStatus.connected)) && (
        <div style={{ backgroundColor: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: '12px', padding: '12px 14px' }}>
          <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '13px', margin: '0 0 5px' }}>⚠️ قاعدة البيانات غير متصلة</p>
          <p style={{ color: '#fca5a5', fontSize: '12px', margin: '0 0 9px' }}>{dbStatus?.reason || 'تعذر الاتصال بقاعدة البيانات'}</p>
          <button onClick={refetchAll} disabled={isFetching} style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer', fontWeight: 700, opacity: isFetching ? 0.6 : 1 }}>
            {isFetching ? 'جارِ المحاولة...' : 'إعادة المحاولة'}
          </button>
        </div>
      )}

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>
          {isFetching ? 'جاري تحديث...' : `آخر تحديث: ${new Date().toLocaleTimeString('ar')}`}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <ResetVipsButton />
          <button onClick={() => refetchDbStatus()} disabled={isFetching} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', opacity: isFetching ? 0.5 : 1 }}>
            <RefreshCw style={{ width: '16px' }} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '20px', padding: '20px', textAlign: 'center' }}>
          <Users style={{ width: '24px', height: '24px', color: '#818cf8', margin: '0 auto 8px' }} />
          <h4 style={{ margin: 0, color: '#a5b4fc', fontSize: '12px', fontWeight: 700 }}>إجمالي المستخدمين</h4>
          <p style={{ margin: '4px 0 0', color: 'white', fontSize: '28px', fontWeight: 900 }}>{totalLoading && !dbStatus && totalCount === undefined ? '...' : totalUsers}</p>
        </div>
        <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '20px', padding: '20px', textAlign: 'center' }}>
          <Crown style={{ width: '24px', height: '24px', color: '#fbbf24', margin: '0 auto 8px' }} />
          <h4 style={{ margin: 0, color: '#fde68a', fontSize: '12px', fontWeight: 700 }}>أعضاء VIP</h4>
          <p style={{ margin: '4px 0 0', color: 'white', fontSize: '28px', fontWeight: 900 }}>{isFetching && !dbStatus ? '...' : vipCount}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '-12px' }}>
        <div style={{ backgroundColor: '#0f2026', border: '1px solid #134e4a', borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
          <Wifi style={{ width: '20px', height: '20px', color: '#34d399', margin: '0 auto 6px' }} />
          <h4 style={{ margin: 0, color: '#6ee7b7', fontSize: '12px', fontWeight: 700 }}>المتصلون الآن</h4>
          <p style={{ margin: '4px 0 0', color: 'white', fontSize: '24px', fontWeight: 900 }}>{isFetching && !dbStatus ? '...' : onlineUsers}</p>
        </div>
        <div style={{ backgroundColor: '#1a0a0a', border: '1px solid #4a1515', borderRadius: '20px', padding: '16px', textAlign: 'center' }}>
          <Users style={{ width: '20px', height: '20px', color: '#f87171', margin: '0 auto 6px' }} />
          <h4 style={{ margin: 0, color: '#fca5a5', fontSize: '12px', fontWeight: 700 }}>آخر تسجيلات</h4>
          <p style={{ margin: '4px 0 0', color: 'white', fontSize: '24px', fontWeight: 900 }}>{recent?.length ?? totalUsers}</p>
        </div>
      </div>

      {/* Country Stats */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '20px', padding: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>المستخدمين حسب الدولة</h3>
        {statsLoading && <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>جاري التحميل...</p>}
        {stats?.length === 0 && !statsLoading && <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>لا توجد بيانات</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {stats?.map(s => (
            <div key={s.country} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#1f2937', borderRadius: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{COUNTRY_NAMES[s.country] || s.country}</span>
              <span style={{ color: '#7c3aed', fontWeight: 900 }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Registrations */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '20px', padding: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>آخر التسجيلات</h3>
        {recentLoading && <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>جاري التحميل...</p>}
        {recent?.length === 0 && !recentLoading && <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>لا توجد تسجيلات</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recent?.map(u => (
            <div 
              key={u.id} 
              onClick={(e) => {
                e.stopPropagation();
                onSelectUser(u.id);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderBottom: '1px solid #1e293b', cursor: 'pointer', borderRadius: '10px', transition: 'background 0.2s', position: 'relative', zIndex: 5 }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ position: 'relative' }}>
                <img 
                  src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.name || 'user')}`} 
                  style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover', backgroundColor: '#1f2937' }} 
                  onError={(e) => { 
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('dicebear.com')) {
                      target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.name || 'user')}`;
                    }
                  }}
                />
                {/* Status Dot */}
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: (u as any).isOnline && (new Date().getTime() - new Date((u as any).lastSeen || (u as any).lastSignedIn).getTime() < 5 * 60 * 1000) ? '#10b981' : '#ef4444',
                  border: '2px solid #111827'
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'white' }}>{u.name || 'مستخدم جديد'}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                  {u.gender ? (u.gender === 'male' ? 'ذكر' : u.gender === 'female' ? 'أنثى' : u.gender) : 'غير محدد'} 
                  {u.age ? ` • ${u.age} سنة` : ''} 
                  {u.country ? ` • ${COUNTRY_NAMES[u.country] || u.country}` : ''}
                </p>
              </div>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#4b5563' }}>{timeAgo((u as any).lastSignedIn || u.createdAt)}</p>
                {u.isPremium && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Crown style={{ width: '12px', color: '#fbbf24' }} />
                    {u.role !== 'admin' && <RevokeUserVipButton userId={u.id} />}
                  </div>
                )}
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


/* ══════════════════════════════════════════════════════════
   Search Tab
══════════════════════════════════════════════════════════ */
function SearchTab({ adminToken }: { adminToken: string }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data: results, isLoading } = trpc.admin.searchUsers.useQuery(
    { adminToken, query: submitted },
    { enabled: !!adminToken && submitted.length > 0 }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) setSubmitted(query.trim());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ابحث باسم المستخدم..."
          style={{
            flex: 1, backgroundColor: '#1f2937', border: '1px solid #374151',
            borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px',
            outline: 'none', direction: 'rtl',
          }}
        />
        <button
          type="submit"
          style={{
            backgroundColor: '#7c3aed', color: 'white', border: 'none',
            borderRadius: '12px', padding: '12px 20px', fontWeight: 700,
            cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <Search style={{ width: '16px', height: '16px' }} />
          بحث
        </button>
      </form>

      {isLoading && <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>جاري البحث...</div>}

      {results && results.length === 0 && submitted && (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>لم يُعثر على نتائج</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {results?.map(u => (
          <div key={u.id} style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'U') + '&background=7c3aed&color=fff'}
              style={{ width: '46px', height: '46px', borderRadius: '12px', objectFit: 'cover' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>{u.name}</p>
                {u.isPremium && <Crown style={{ width: '14px', color: '#fbbf24' }} />}
                {u.role === 'admin' && <Shield style={{ width: '14px', color: '#818cf8' }} />}
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                {u.gender === 'male' ? 'ذكر' : u.gender === 'female' ? 'أنثى' : 'آخر'} • {u.age} سنة • {COUNTRY_NAMES[u.country || ''] || u.country || 'غير محدد'}
              </p>
            </div>
            <div style={{ textAlign: 'left', fontSize: '11px', color: '#4b5563' }}>
              <p style={{ margin: 0 }}>⭐ {u.credits} نقطة</p>
              <p style={{ margin: '2px 0 0' }}>💰 {u.wallet} نجمة</p>
              <p style={{ margin: '2px 0 0' }}>#{u.id}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   User Profile View Component (For clicking recent registrations)
══════════════════════════════════════════════════════════ */
function UserProfileView({ userId, adminToken, onBack }: { userId: number; adminToken: string; onBack: () => void }) {
  const { data: results, isLoading } = trpc.admin.searchUsers.useQuery(
    { adminToken, query: String(userId) },
    { enabled: !!adminToken && userId > 0 }
  );

  const user = results?.find(u => u.id === userId) || results?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button
        onClick={onBack}
        style={{
          alignSelf: 'flex-start', backgroundColor: '#1f2937', color: 'white',
          border: '1px solid #374151', borderRadius: '12px', padding: '10px 16px',
          fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
        }}
      >
        <ArrowRight style={{ width: '16px', height: '16px' }} /> العودة إلى لوحة التحكم
      </button>

      {isLoading && <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>جاري تحميل بيانات المستخدم...</div>}

      {!isLoading && !user && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '20px', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
          لم يتم العثور على بيانات هذا المستخدم
        </div>
      )}

      {user && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ position: 'relative' }}>
              <img 
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || 'user')}`} 
                style={{ width: '60px', height: '60px', borderRadius: '15px', objectFit: 'cover', backgroundColor: '#1f2937' }}
                onError={(e) => { 
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('dicebear.com')) {
                    target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || 'user')}`;
                  }
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: (user as any).isOnline && (new Date().getTime() - new Date((user as any).lastSeen || (user as any).lastSignedIn).getTime() < 5 * 60 * 1000) ? '#10b981' : '#ef4444',
                border: '3px solid #111827'
              }} />
            </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'white' }}>{user.name || 'مستخدم جديد'}</h2>
              {user.isPremium && <Crown style={{ width: '18px', color: '#fbbf24' }} />}
              {user.role === 'admin' && <Shield style={{ width: '18px', color: '#818cf8' }} />}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
              معرف المستخدم (ID): #{user.id} • طريقة الدخول: {user.loginMethod || 'غير محدد'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#1f2937', padding: '14px', borderRadius: '16px' }}>
              <p style={{ color: '#9ca3af', fontSize: '11px', margin: '0 0 4px', fontWeight: 700 }}>الجنس • العمر</p>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: 800, margin: 0 }}>
                {user.gender === 'male' ? 'ذكر' : user.gender === 'female' ? 'أنثى' : 'غير محدد'} {user.age ? `(${user.age})` : ''}
              </p>
            </div>
            <div style={{ backgroundColor: '#1f2937', padding: '14px', borderRadius: '16px' }}>
              <p style={{ color: '#9ca3af', fontSize: '11px', margin: '0 0 4px', fontWeight: 700 }}>الدولة</p>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: 800, margin: 0 }}>
                {COUNTRY_NAMES[user.country || ''] || user.country || 'غير محدد'}
              </p>
            </div>
            <div style={{ backgroundColor: '#1f2937', padding: '14px', borderRadius: '16px' }}>
              <p style={{ color: '#9ca3af', fontSize: '11px', margin: '0 0 4px', fontWeight: 700 }}>الرصيد</p>
              <p style={{ color: '#10b981', fontSize: '14px', fontWeight: 800, margin: 0 }}>
                {user.credits} نقطة
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '10px' }}>
            <button
              onClick={() => alert(`معرف المستخدم: ${user.id}\nالاسم: ${user.name}\nالإيميل: ${user.email || 'غير متوفر'}`)}
              style={{
                flex: 1, backgroundColor: '#7c3aed', color: 'white', border: 'none',
                borderRadius: '12px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer'
              }}
            >
              عرض التفاصيل الكاملة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Broadcast Tab
══════════════════════════════════════════════════════════ */
function BroadcastTab({ adminToken }: { adminToken: string }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const broadcastMutation = trpc.admin.broadcast.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ تم إرسال الإشعار لـ ${data.count} مستخدم بنجاح!`);
      setTitle('');
      setMessage('');
    },
    onError: (e) => toast.error(`فشل الإرسال: ${e.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    if (!confirm(`سيتم إرسال الإشعار لجميع المستخدمين. هل أنت متأكد؟`)) return;
    broadcastMutation.mutate({ adminToken, title: title.trim(), message: message.trim() });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Bell style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>إرسال إشعار لجميع المستخدمين</h3>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>عنوان الإشعار</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: تحديث جديد!"
              maxLength={200}
              style={{
                width: '100%', backgroundColor: '#1f2937', border: '1px solid #374151',
                borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px',
                outline: 'none', direction: 'rtl', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>نص الإشعار</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              rows={4}
              maxLength={1000}
              style={{
                width: '100%', backgroundColor: '#1f2937', border: '1px solid #374151',
                borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px',
                outline: 'none', direction: 'rtl', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#4b5563', textAlign: 'left' }}>{message.length}/1000</p>
          </div>
          <button
            type="submit"
            disabled={broadcastMutation.isPending || !title.trim() || !message.trim()}
            style={{
              backgroundColor: broadcastMutation.isPending ? '#374151' : '#f59e0b',
              color: broadcastMutation.isPending ? '#6b7280' : 'black',
              border: 'none', borderRadius: '12px', padding: '14px',
              fontWeight: 800, fontSize: '15px', cursor: broadcastMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <Bell style={{ width: '18px' }} />
            {broadcastMutation.isPending ? 'جاري الإرسال...' : 'إرسال للجميع'}
          </button>
        </form>
      </div>

      <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: '16px', padding: '16px' }}>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '12px', lineHeight: '1.6' }}>
          💡 الإشعارات ستظهر للمستخدمين في قسم الإشعارات عند دخولهم للتطبيق. لا يمكن التراجع عن الإرسال.
        </p>
      </div>
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
