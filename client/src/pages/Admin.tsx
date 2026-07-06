import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Users, Globe, Crown, RefreshCw, ArrowRight, Lock, Shield, Eye, EyeOff, Video, Radio, X, MonitorPlay, Trash2, Play, Download } from 'lucide-react';

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
   Admin Dashboard
══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   Live Calls Monitor
══════════════════════════════════════════════════════════ */
interface ActiveCall {
  peerId1: string; name1: string; avatar1: string; userId1?: number;
  peerId2: string; name2: string; avatar2: string; userId2?: number;
}

const WATCH_ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

function CallWatcher({ call, token, onClose }: { call: ActiveCall; token: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const watcherId = useRef(`w-${Math.random().toString(36).slice(2)}`).current;
  const [status, setStatus] = useState<'connecting'|'watching'|'error'>('connecting');

  useEffect(() => {
    const pc = new RTCPeerConnection(WATCH_ICE_CONFIG);

    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
        setStatus('watching');
      }
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      fetch('/api/admin/watch-signal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, watcherId, type: 'ice', data: e.candidate }),
      }).catch(() => {});
    };

    const params = new URLSearchParams({ token, watcherId, targetPeerId: call.peerId1 });
    const es = new EventSource(`/api/admin/watch-stream?${params}`);

    es.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'watch-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await fetch('/api/admin/watch-signal', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, watcherId, type: 'answer', data: answer }),
          });
        } else if (msg.type === 'watch-ice') {
          try { await pc.addIceCandidate(new RTCIceCandidate(msg.data)); } catch {}
        }
      } catch {}
    };
    es.onerror = () => setStatus('error');

    const timeout = setTimeout(() => setStatus(s => s === 'connecting' ? 'error' : s), 20000);
    return () => { clearTimeout(timeout); es.close(); pc.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avt1 = call.avatar1 || `https://api.dicebear.com/7.x/avataaars/svg?seed=${call.peerId1}`;
  const avt2 = call.avatar2 || `https://api.dicebear.com/7.x/avataaars/svg?seed=${call.peerId2}`;

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.88)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ backgroundColor:'#0f172a', borderRadius:'20px', border:'1px solid #1e293b', width:'100%', maxWidth:'480px', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #1e293b', background:'linear-gradient(135deg,#4c1d95,#831843)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Radio style={{ width:'16px', height:'16px', color:'#f472b6' }} />
            <span style={{ color:'white', fontWeight:700, fontSize:'14px' }}>مراقبة مباشرة</span>
            {status === 'watching' && (
              <span style={{ backgroundColor:'#dc2626', color:'white', fontSize:'10px', fontWeight:900, padding:'2px 6px', borderRadius:'99px', animation:'pulse 1.5s infinite' }}>LIVE</span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <img src={avt1} style={{ width:'22px', height:'22px', borderRadius:'50%', border:'2px solid white' }} />
            <img src={avt2} style={{ width:'22px', height:'22px', borderRadius:'50%', border:'2px solid white' }} />
            <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{call.name1} ↔ {call.name2}</span>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'white', padding:'4px' }}>
              <X style={{ width:'18px', height:'18px' }} />
            </button>
          </div>
        </div>
        {/* Video */}
        <div style={{ position:'relative', backgroundColor:'#000', aspectRatio:'16/9', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <video ref={videoRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover', display: status==='watching'?'block':'none' }} />
          {status !== 'watching' && (
            <div style={{ textAlign:'center', color:'white' }}>
              {status === 'connecting' ? (
                <>
                  <div style={{ width:'32px', height:'32px', border:'3px solid #7c3aed', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 8px' }} />
                  <p style={{ margin:0, fontSize:'13px', color:'#9ca3af' }}>جاري الاتصال...</p>
                </>
              ) : (
                <>
                  <X style={{ width:'32px', height:'32px', color:'#ef4444', margin:'0 auto 8px', display:'block' }} />
                  <p style={{ margin:0, fontSize:'13px', color:'#9ca3af' }}>فشل الاتصال أو المستخدم أنهى المكالمة</p>
                </>
              )}
            </div>
          )}
        </div>
        <p style={{ margin:0, padding:'10px 16px', textAlign:'center', fontSize:'11px', color:'#6b7280' }}>
          🔒 المراقبة سرية — المستخدمون لا يعلمون
        </p>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════
   Recordings Tab
══════════════════════════════════════════════════════════ */
interface RecMeta {
  sessionId: string;
  startTime: number;
  endTime?: number;
  name1: string;
  name2: string;
  size: number;
}

function fmt(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60), ss = s % 60;
  return m > 0 ? `${m}د ${ss}ث` : `${ss}ث`;
}
function fmtSize(b: number) {
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('ar-EG', { hour12: true, year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function RecordingsTab({ token }: { token: string }) {
  const [recs, setRecs] = useState<RecMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<RecMeta | null>(null);

  const fetchRecs = async () => {
    try {
      const r = await fetch(`/api/admin/recordings?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      setRecs(d.recordings || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchRecs();
    const id = setInterval(fetchRecs, 10000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteRec = async (id: string) => {
    if (!confirm('حذف هذا التسجيل نهائياً؟')) return;
    await fetch(`/api/admin/recording/${id}?token=${encodeURIComponent(token)}`, { method: 'DELETE' });
    setRecs(prev => prev.filter(r => r.sessionId !== id));
    if (playing?.sessionId === id) setPlaying(null);
  };

  return (
    <div>
      {/* Stats row */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
        <div style={{ flex:1, backgroundColor:'#1e1b4b', border:'1px solid #3730a3', borderRadius:'14px', padding:'12px', textAlign:'center' }}>
          <Video style={{ width:'18px', height:'18px', color:'#818cf8', margin:'0 auto 4px', display:'block' }} />
          <p style={{ margin:0, fontSize:'26px', fontWeight:900, color:'white' }}>{recs.length}</p>
          <p style={{ margin:0, fontSize:'11px', color:'#818cf8' }}>تسجيلات محفوظة</p>
        </div>
        <div style={{ flex:1, backgroundColor:'#052e16', border:'1px solid #166534', borderRadius:'14px', padding:'12px', textAlign:'center' }}>
          <Download style={{ width:'18px', height:'18px', color:'#4ade80', margin:'0 auto 4px', display:'block' }} />
          <p style={{ margin:0, fontSize:'22px', fontWeight:900, color:'white' }}>
            {fmtSize(recs.reduce((a,r) => a + (r.size||0), 0))}
          </p>
          <p style={{ margin:0, fontSize:'11px', color:'#4ade80' }}>إجمالي الحجم</p>
        </div>
      </div>

      {/* Video player modal */}
      {playing && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.92)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ backgroundColor:'#0f172a', borderRadius:'20px', border:'1px solid #1e293b', width:'100%', maxWidth:'500px', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #1e293b', background:'linear-gradient(135deg,#1e1b4b,#312e81)' }}>
              <div>
                <p style={{ margin:0, fontSize:'14px', fontWeight:700, color:'white' }}>{playing.name1} ↔ {playing.name2}</p>
                <p style={{ margin:0, fontSize:'11px', color:'#818cf8' }}>{fmtDate(playing.startTime)} · {fmtSize(playing.size)}</p>
              </div>
              <button onClick={() => setPlaying(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'white', padding:'4px' }}>
                <X style={{ width:'18px', height:'18px' }} />
              </button>
            </div>
            <video
              key={playing.sessionId}
              src={`/api/admin/recording/${playing.sessionId}?token=${encodeURIComponent(token)}`}
              controls
              autoPlay
              style={{ width:'100%', backgroundColor:'#000', display:'block', maxHeight:'400px' }}
            />
            <div style={{ display:'flex', gap:'8px', padding:'10px 12px' }}>
              <a
                href={`/api/admin/recording/${playing.sessionId}?token=${encodeURIComponent(token)}&dl=1`}
                download={`${playing.sessionId}.webm`}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', backgroundColor:'#1d4ed8', color:'white', borderRadius:'10px', padding:'8px', fontSize:'13px', fontWeight:700, textDecoration:'none' }}
              >
                <Download style={{ width:'14px', height:'14px' }} />
                تحميل
              </a>
              <button
                onClick={() => deleteRec(playing.sessionId)}
                style={{ display:'flex', alignItems:'center', gap:'6px', backgroundColor:'#7f1d1d', color:'white', border:'none', borderRadius:'10px', padding:'8px 14px', cursor:'pointer', fontSize:'13px', fontWeight:700 }}
              >
                <Trash2 style={{ width:'14px', height:'14px' }} />
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ backgroundColor:'#111827', border:'1px solid #374151', borderRadius:'16px', overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #1f2937', display:'flex', alignItems:'center', gap:'8px' }}>
          <Video style={{ width:'16px', height:'16px', color:'#818cf8' }} />
          <span style={{ color:'#e5e7eb', fontWeight:700, fontSize:'14px' }}>التسجيلات المحفوظة</span>
          <button onClick={fetchRecs} style={{ marginRight:'auto', background:'none', border:'none', cursor:'pointer', color:'#6b7280', padding:'2px' }}>
            <RefreshCw style={{ width:'14px', height:'14px' }} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding:'40px', textAlign:'center' }}>
            <div style={{ width:'28px', height:'28px', border:'3px solid #7c3aed', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }} />
          </div>
        ) : recs.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#4b5563' }}>
            <Video style={{ width:'40px', height:'40px', margin:'0 auto 12px', display:'block', opacity:0.3 }} />
            <p style={{ margin:0, fontSize:'14px' }}>لا توجد تسجيلات بعد</p>
            <p style={{ margin:0, fontSize:'11px', marginTop:'4px', color:'#374151' }}>تظهر هنا تلقائياً عند بدء أي مكالمة</p>
          </div>
        ) : recs.map((rec) => {
          const dur = rec.endTime ? fmt(rec.endTime - rec.startTime) : 'جارٍ...';
          return (
            <div key={rec.sessionId} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderBottom:'1px solid #1f2937' }}>
              {/* Thumb */}
              <div style={{ width:'48px', height:'48px', borderRadius:'12px', backgroundColor:'#1f2937', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Video style={{ width:'20px', height:'20px', color:'#818cf8' }} />
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:'13px', fontWeight:700, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {rec.name1} <span style={{ color:'#6b7280' }}>↔</span> {rec.name2}
                </p>
                <p style={{ margin:0, fontSize:'11px', color:'#4b5563', marginTop:'2px' }}>
                  {fmtDate(rec.startTime)} · {dur} · {fmtSize(rec.size)}
                  {!rec.endTime && <span style={{ color:'#dc2626', marginRight:'4px' }}> ● جارٍ</span>}
                </p>
              </div>
              {/* Actions */}
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => setPlaying(rec)} style={{ display:'flex', alignItems:'center', gap:'4px', backgroundColor:'#4c1d95', color:'white', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'12px', fontWeight:700 }}>
                  <Play style={{ width:'12px', height:'12px' }} />
                  تشغيل
                </button>
                <button onClick={() => deleteRec(rec.sessionId)} style={{ display:'flex', alignItems:'center', backgroundColor:'#7f1d1d', color:'white', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer' }}>
                  <Trash2 style={{ width:'13px', height:'13px' }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveCallsTab({ token }: { token: string }) {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [stats, setStats] = useState({ online: 0, waiting: 0 });
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState<ActiveCall | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch(`/api/admin/active-calls?token=${encodeURIComponent(token)}`);
        const d = await r.json();
        setCalls(d.calls || []);
        setStats({ online: d.online || 0, waiting: d.waiting || 0 });
      } catch {}
      setLoading(false);
    };
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
        {[
          { icon: <Radio style={{ width:'18px', height:'18px', color:'#f472b6', margin:'0 auto 4px', display:'block' }} />, value: calls.length, label:'مكالمات حية', bg:'#1e1b4b', border:'#3730a3', color:'#818cf8' },
          { icon: <div style={{ width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#22c55e', margin:'5px auto 4px', boxShadow:'0 0 6px #22c55e' }} />, value: stats.online, label:'متصلون', bg:'#052e16', border:'#166534', color:'#4ade80' },
          { icon: <div style={{ width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#f97316', margin:'5px auto 4px' }} />, value: stats.waiting, label:'بانتظار', bg:'#431407', border:'#9a3412', color:'#fb923c' },
        ].map((s, i) => (
          <div key={i} style={{ backgroundColor:s.bg, border:`1px solid ${s.border}`, borderRadius:'14px', padding:'12px', textAlign:'center' }}>
            {s.icon}
            <p style={{ margin:0, fontSize:'26px', fontWeight:900, color:'white' }}>{s.value}</p>
            <p style={{ margin:0, fontSize:'11px', color:s.color }}>{s.label}</p>
          </div>
        ))}
      </div>
      {/* List */}
      <div style={{ backgroundColor:'#111827', border:'1px solid #374151', borderRadius:'16px', overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #1f2937', display:'flex', alignItems:'center', gap:'8px' }}>
          <MonitorPlay style={{ width:'16px', height:'16px', color:'#f472b6' }} />
          <span style={{ color:'#e5e7eb', fontWeight:700, fontSize:'14px' }}>المكالمات الجارية</span>
          <span style={{ marginRight:'auto', fontSize:'11px', color:'#4b5563' }}>تحديث تلقائي كل 5 ثوانٍ</span>
        </div>
        {loading ? (
          <div style={{ padding:'40px', textAlign:'center' }}>
            <div style={{ width:'28px', height:'28px', border:'3px solid #7c3aed', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }} />
          </div>
        ) : calls.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#4b5563' }}>
            <Video style={{ width:'40px', height:'40px', margin:'0 auto 12px', display:'block', opacity:0.3 }} />
            <p style={{ margin:0, fontSize:'14px' }}>لا توجد مكالمات نشطة حالياً</p>
          </div>
        ) : calls.map((call, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderBottom:'1px solid #1f2937' }}>
            <div style={{ display:'flex', position:'relative', width:'56px', flexShrink:0 }}>
              <img src={call.avatar1||`https://api.dicebear.com/7.x/avataaars/svg?seed=${call.peerId1}`} style={{ width:'32px', height:'32px', borderRadius:'50%', border:'2px solid #1f2937', backgroundColor:'#374151' }} />
              <img src={call.avatar2||`https://api.dicebear.com/7.x/avataaars/svg?seed=${call.peerId2}`} style={{ width:'32px', height:'32px', borderRadius:'50%', border:'2px solid #1f2937', backgroundColor:'#374151', position:'absolute', right:0 }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:0, fontSize:'14px', fontWeight:600, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {call.name1} <span style={{ color:'#6b7280' }}>↔</span> {call.name2}
              </p>
              <p style={{ margin:0, fontSize:'11px', color:'#4b5563', marginTop:'2px' }}>مكالمة فيديو مباشرة</p>
            </div>
            <button onClick={() => setWatching(call)} style={{ display:'flex', alignItems:'center', gap:'5px', backgroundColor:'#7c3aed', color:'white', border:'none', borderRadius:'10px', padding:'7px 12px', cursor:'pointer', fontSize:'12px', fontWeight:700, flexShrink:0 }}>
              <Eye style={{ width:'14px', height:'14px' }} />
              مراقبة
            </button>
          </div>
        ))}
      </div>
      {watching && <CallWatcher call={watching} token={token} onClose={() => setWatching(null)} />}
    </div>
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'users'|'livecalls'|'recordings'>('users');
  const adminToken = sessionStorage.getItem(ADMIN_SESSION_KEY) || '';

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
        <div style={{ width: '32px', height: '32px', border: '3px solid #a855f7', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%', backgroundColor: '#030712', color: 'white' }}>
      <div style={{ padding: '16px', maxWidth: '672px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingTop: '16px' }}>
          <button onClick={() => setLocation('/')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}>
            <ArrowRight style={{ width: '20px', height: '20px' }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>لوحة الإدارة</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>مراقبة التسجيلات والدول</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => refetch()}
              style={{
                padding: '8px', borderRadius: '10px', background: '#1f2937',
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
                background: '#450a0a', border: '1px solid #991b1b',
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
          backgroundColor: '#1e1b4b', border: '1px solid #4338ca',
          borderRadius: '12px', padding: '10px 14px', marginBottom: '20px',
        }}>
          <Shield style={{ width: '18px', height: '18px', color: '#a78bfa' }} />
          <span style={{ color: '#c4b5fd', fontSize: '13px', fontWeight: 700 }}>دخلت كمدير — صلاحيات كاملة</span>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'20px', backgroundColor:'#111827', padding:'4px', borderRadius:'14px', border:'1px solid #374151' }}>
          {([
            { id:'users',     label:'المستخدمون',   icon:<Users style={{ width:'14px', height:'14px' }} />,  color:'#7c3aed' },
            { id:'livecalls',   label:'مكالمات حية',   icon:<Radio  style={{ width:'14px', height:'14px' }} />, color:'#be185d' },
            { id:'recordings',  label:'التسجيلات',      icon:<Video  style={{ width:'14px', height:'14px' }} />, color:'#1d4ed8' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex:1, padding:'9px', borderRadius:'10px', border:'none', cursor:'pointer', fontWeight:700, fontSize:'13px', backgroundColor: activeTab===tab.id ? tab.color : 'transparent', color: activeTab===tab.id ? 'white' : '#6b7280', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'livecalls' ? <LiveCallsTab token={adminToken} /> : activeTab === 'recordings' ? <RecordingsTab token={adminToken} /> : <>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#4c1d95', border: '1px solid #7c3aed', borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
            <Users style={{ width: '20px', height: '20px', color: '#c084fc', margin: '0 auto 4px' }} />
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'white' }}>{totalUsers}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#d8b4fe' }}>المستخدمون</p>
          </div>
          <div style={{ backgroundColor: '#713f12', border: '1px solid #a16207', borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
            <Crown style={{ width: '20px', height: '20px', color: '#facc15', margin: '0 auto 4px' }} />
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'white' }}>{premiumCount}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#fde047' }}>Premium</p>
          </div>
          <div style={{ backgroundColor: '#064e3b', border: '1px solid #059669', borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
            <Globe style={{ width: '20px', height: '20px', color: '#4ade80', margin: '0 auto 4px' }} />
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'white' }}>{todayCount}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#86efac' }}>اليوم</p>
          </div>
        </div>

        {/* Country Stats */}
        {countryStats && countryStats.length > 0 && (
          <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe style={{ width: '16px', height: '16px', color: '#60a5fa' }} />
              المستخدمون حسب الدولة
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {countryStats.map(s => (
                <div key={s.country} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', width: '110px', textAlign: 'right', color: '#e5e7eb', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {COUNTRY_NAMES[s.country] ?? s.country}
                  </span>
                  <div style={{ flex: 1, height: '8px', backgroundColor: '#374151', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: '#9333ea', borderRadius: '99px', width: `${(s.count / maxCount) * 100}%`, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', width: '24px', textAlign: 'left', flexShrink: 0 }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registrations List */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f2937' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users style={{ width: '16px', height: '16px', color: '#c084fc' }} />
              آخر التسجيلات
            </h2>
          </div>
          {registrations && registrations.length > 0 ? (
            <div>
              {registrations.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #1f2937' }}>
                  <img
                    src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1f2937', flexShrink: 0 }}
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
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {u.country ? (COUNTRY_NAMES[u.country] ?? u.country) : '🌍 غير معروفة'}
                      </span>
                      <span style={{ color: '#374151', fontSize: '10px' }}>•</span>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>{u.loginMethod ?? 'guest'}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#4b5563', flexShrink: 0 }}>
                    {timeAgo(u.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center', color: '#4b5563', fontSize: '14px' }}>
              لا يوجد مستخدمون حتى الآن
            </div>
          )}
        </div>

        </>}

        <p style={{ textAlign: 'center', color: '#374151', fontSize: '11px', marginTop: '16px', paddingBottom: '24px' }}>
          يتحدث تلقائياً كل 30 ثانية
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
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
