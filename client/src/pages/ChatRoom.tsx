import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff, SkipForward,
  Flag, Volume2, VolumeX, Send, MessageSquare, X,
  Smartphone, Lock, Gift, Bell, Star, UserCircle, Search, ShoppingBag, Zap,
} from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import GiftPanel, { GIFTS, type GiftItem } from '@/components/GiftPanel';
import { toast } from 'sonner';

// ── ICE config with TURN servers for 4G/5G mobile networks ───────────────────
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:80?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

const COUNTRIES = [
  { code: 'any', name: 'أي دولة' },
  { code: 'SA', name: 'السعودية 🇸🇦' },
  { code: 'AE', name: 'الإمارات 🇦🇪' },
  { code: 'EG', name: 'مصر 🇪🇬' },
  { code: 'KW', name: 'الكويت 🇰🇼' },
  { code: 'QA', name: 'قطر 🇶🇦' },
  { code: 'BH', name: 'البحرين 🇧🇭' },
  { code: 'OM', name: 'عمان 🇴🇲' },
  { code: 'JO', name: 'الأردن 🇯🇴' },
  { code: 'LB', name: 'لبنان 🇱🇧' },
  { code: 'IQ', name: 'العراق 🇮🇶' },
  { code: 'SY', name: 'سوريا 🇸🇾' },
  { code: 'MA', name: 'المغرب 🇲🇦' },
  { code: 'DZ', name: 'الجزائر 🇩🇿' },
  { code: 'TN', name: 'تونس 🇹🇳' },
  { code: 'LY', name: 'ليبيا 🇱🇾' },
  { code: 'YE', name: 'اليمن 🇾🇪' },
  { code: 'SD', name: 'السودان 🇸🇩' },
  { code: 'TR', name: 'تركيا 🇹🇷' },
  { code: 'PK', name: 'باكستان 🇵🇰' },
  { code: 'IN', name: 'الهند 🇮🇳' },
  { code: 'US', name: 'أمريكا 🇺🇸' },
  { code: 'GB', name: 'بريطانيا 🇬🇧' },
  { code: 'DE', name: 'ألمانيا 🇩🇪' },
  { code: 'FR', name: 'فرنسا 🇫🇷' },
];

type Status = 'setup' | 'connecting' | 'waiting' | 'matched' | 'ended';
interface ChatMsg  { text: string; mine: boolean; name: string; time: string; }
interface GiftAnim { emoji: string; name: string; senderName: string; id: number; }
interface Notif    { partnerName: string; partnerAvatar: string; }

function makePeerId() { return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

export default function ChatRoom() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const myName    = (user as any)?.name   || 'انت';
  const myAvatar  = (user as any)?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(myName)}`;
  const myGender  = (user as any)?.gender || 'other';
  const myId      = useRef(makePeerId()).current;

  // ── filter state (setup screen) ───────────────────────────────────────────
  const [filterGender,  setFilterGender]  = useState<'male'|'female'|'any'>('any');
  const [filterCountry, setFilterCountry] = useState('any');

  // ── core state ─────────────────────────────────────────────────────────────
  const [status,       setStatus]      = useState<Status>('setup');
  const [peerName,     setPeerName]    = useState('');
  const [peerAvatar,   setPeerAvatar]  = useState('');
  const [isMicOn,      setIsMicOn]     = useState(true);
  const [isVideoOn,    setIsVideoOn]   = useState(true);
  const [isSpeakerOn,  setIsSpeakerOn] = useState(true);
  const [showChat,     setShowChat]    = useState(false);
  const [messages,     setMessages]    = useState<ChatMsg[]>([]);
  const [inputText,    setInputText]   = useState('');
  const [callDuration, setCallDuration]= useState(0);
  const [peerVideoOff, setPeerVideoOff]= useState(false);
  const [unread,       setUnread]      = useState(0);

  // ── gifts ──────────────────────────────────────────────────────────────────
  const [showGifts, setShowGifts] = useState(false);
  const [giftAnims, setGiftAnims] = useState<GiftAnim[]>([]);
  const [credits,   setCredits]   = useState(100);

  // ── notification ───────────────────────────────────────────────────────────
  const [notif, setNotif] = useState<Notif | null>(null);

  // ── refs ───────────────────────────────────────────────────────────────────
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef          = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const destroyedRef   = useRef(false);

  // ── tRPC ───────────────────────────────────────────────────────────────────
  const balanceQuery = trpc.gifts.getBalance.useQuery(undefined, { staleTime: 30_000 });
  const spendGift    = trpc.gifts.spend.useMutation({
    onSuccess: (data) => setCredits(data.newBalance),
    onError:   (err)  => alert(err.message),
  });
  useEffect(() => { if (balanceQuery.data) setCredits(balanceQuery.data.credits); }, [balanceQuery.data]);

  // ── signaling ──────────────────────────────────────────────────────────────
  const signal = useCallback(async (type: string, data?: unknown, text?: string) => {
    try {
      await fetch('/api/signal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: myId, type, data, text }),
      });
    } catch { /* network error */ }
  }, [myId]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const addMessage = useCallback((text: string, mine: boolean, name: string) => {
    const time = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { text, mine, name, time }]);
    if (!mine) setUnread(u => u + 1);
  }, []);

  const stopTimer   = useCallback(() => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }, []);
  const startTimer  = useCallback(() => { stopTimer(); setCallDuration(0); timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000); }, [stopTimer]);
  const closePC     = useCallback(() => { pcRef.current?.close(); pcRef.current = null; }, []);
  const resetRemote = useCallback(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setPeerName(''); setPeerAvatar(''); setPeerVideoOff(false);
  }, []);

  const showGiftAnim = useCallback((emoji: string, name: string, senderName: string) => {
    const id = Date.now() + Math.random();
    setGiftAnims(prev => [...prev, { emoji, name, senderName, id }]);
    setTimeout(() => setGiftAnims(prev => prev.filter(g => g.id !== id)), 3500);
  }, []);

  const sendGift = useCallback((gift: GiftItem) => {
    if (status !== 'matched') return;
    spendGift.mutate({ giftType: gift.id, cost: gift.cost });
    signal('gift', { giftType: gift.id, emoji: gift.emoji, giftName: gift.name });
    showGiftAnim(gift.emoji, gift.name, myName);
    setShowGifts(false);
  }, [status, spendGift, signal, showGiftAnim, myName]);

  // ── peer connection with TURN ──────────────────────────────────────────────
  const createPC = useCallback(() => {
    closePC();
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
        const hasVideo = e.streams[0].getVideoTracks().some(t => t.enabled && t.readyState === 'live');
        setPeerVideoOff(!hasVideo);
      }
    };
    pc.onicecandidate = (e) => { if (e.candidate) signal('ice-candidate', e.candidate); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        if (!destroyedRef.current) { stopTimer(); resetRemote(); setStatus('waiting'); signal('next'); }
      }
    };
    return pc;
  }, [closePC, signal, stopTimer, resetRemote]);

  // ── SSE event handler ──────────────────────────────────────────────────────
  const handleEvent = useCallback(async (msg: any) => {
    switch (msg.type) {
      case 'waiting':
        setStatus('waiting'); stopTimer(); closePC(); resetRemote(); setMessages([]); setShowGifts(false);
        break;
      case 'matched': {
        setPeerName(msg.peer?.name || 'مستخدم');
        setPeerAvatar(msg.peer?.avatar || '');
        setStatus('matched'); startTimer(); setNotif(null);
        const pc = createPC();
        if (msg.role === 'caller') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signal('offer', offer);
        }
        break;
      }
      case 'offer': {
        const pc = pcRef.current || createPC();
        await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signal('answer', answer);
        break;
      }
      case 'answer':
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.data));
        break;
      case 'ice-candidate':
        try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(msg.data)); } catch { /* ignore */ }
        break;
      case 'text-message':
        addMessage(msg.text, false, msg.senderName || 'مستخدم');
        break;
      case 'peer-left':
        stopTimer(); closePC(); resetRemote(); setStatus('waiting'); setShowGifts(false);
        break;
      case 'gift': {
        const { emoji, giftName, senderName } = msg.data || {};
        if (emoji) showGiftAnim(emoji, giftName || '', senderName || peerName);
        break;
      }
      case 'notification':
        setNotif({ partnerName: msg.partnerName, partnerAvatar: msg.partnerAvatar });
        break;
    }
  }, [createPC, signal, addMessage, startTimer, stopTimer, closePC, resetRemote, showGiftAnim, peerName]);

  // ── start session (called after filter screen) ────────────────────────────
  const startSession = useCallback(async (fg: string, fc: string) => {
    destroyedRef.current = false;
    setStatus('connecting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      if (localVideoRef.current) localVideoRef.current.srcObject = s;
    } catch {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStreamRef.current = s; setIsVideoOn(false);
      } catch { setIsVideoOn(false); }
    }
    if (destroyedRef.current) return;

    const params = new URLSearchParams({
      peerId: myId,
      name: myName,
      avatar: myAvatar,
      gender: myGender,
      filterGender: fg,
      filterCountry: fc,
    });
    const es = new EventSource(`/api/signal/connect?${params}`);
    esRef.current = es;
    es.onmessage = (e) => { try { handleEvent(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror   = () => { if (!destroyedRef.current) setStatus('ended'); };
  }, [myId, myName, myAvatar, myGender, handleEvent]);

  // ── cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      stopTimer();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      closePC();
      esRef.current?.close();
    };
  }, [stopTimer, closePC]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (showChat) setUnread(0); }, [showChat]);

  // ── controls ───────────────────────────────────────────────────────────────
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const toggleCamera = async () => {
    if (!(user as any)?.isPremium) {
      toast.error("هذه الميزة متاحة فقط لمشتركي Premium.");
      setLocation('/store');
      return;
    }
    if (!localStreamRef.current) return;
    
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      // Create new stream with specified facing mode
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { exact: newMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      }).catch(async () => {
        // Fallback if exact mode fails (some browsers/devices)
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newMode },
          audio: true
        });
      });
      
      // Replace video track in existing PeerConnection
      if (pcRef.current) {
        const videoTrack = newStream.getVideoTracks()[0];
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack);
        }
      }

      // Stop only old video tracks to keep audio seamless if possible, 
      // but here we replace the whole stream for simplicity
      localStreamRef.current.getTracks().forEach(t => t.stop());
      
      localStreamRef.current = newStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }
      
      setFacingMode(newMode);
      setIsVideoOn(true);
      toast.success(newMode === 'user' ? "تم التبديل للكاميرا الأمامية" : "تم التبديل للكاميرا الخلفية");
    } catch (e) {
      console.error("Failed to switch camera:", e);
      toast.error("عذراً، لا يمكن تبديل الكاميرا على هذا الجهاز");
    }
  };
  const toggleMic   = () => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !isMicOn; }); setIsMicOn(v => !v); };
  const toggleVideo = () => { localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !isVideoOn; }); setIsVideoOn(v => !v); };
  const handleNext  = () => { setMessages([]); stopTimer(); closePC(); if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null; signal('next'); };
  const handleEnd   = () => {
    destroyedRef.current = true;
    esRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    closePC(); setLocation('/');
  };
  const sendText = () => {
    const text = inputText.trim();
    if (!text) return;
    signal('text-message', undefined, text);
    addMessage(text, true, myName);
    setInputText('');
  };
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const statusLabel = status === 'connecting' ? 'جاري الاتصال...'
    : status === 'waiting'  ? 'جاري البحث...'
    : status === 'matched'  ? fmt(callDuration)
    : 'انتهت المكالمة';

  // ── SETUP SCREEN ───────────────────────────────────────────────────────────
  if (status === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-2xl">
              <Search className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ابحث عن شخص</h1>
            <p className="text-white/60 text-sm">اختر تفضيلاتك قبل البدء</p>
          </div>

          {/* Filter Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl space-y-6">

            {/* Gender filter */}
            <div>
              <label className="block text-white font-semibold mb-3 text-sm">الجنس المطلوب</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'any',    label: 'الكل 👥' },
                  { val: 'male',   label: 'ذكر 👨' },
                  { val: 'female', label: 'أنثى 👩' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setFilterGender(opt.val as any)}
                    className={`py-3 rounded-2xl font-bold text-sm transition-all border-2 ${
                      filterGender === opt.val
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-transparent text-white shadow-lg scale-105'
                        : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Country filter */}
            <div>
              <label className="block text-white font-semibold mb-3 text-sm">الدولة</label>
              <select
                value={filterCountry}
                onChange={e => setFilterCountry(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 text-sm"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-gray-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* My profile preview */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center gap-3">
              <img
                src={myAvatar}
                alt={myName}
                className="w-12 h-12 rounded-full border-2 border-white/40 object-cover bg-white flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=default`; }}
              />
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{myName}</p>
                <p className="text-white/50 text-xs">
                  {myGender === 'male' ? 'ذكر' : myGender === 'female' ? 'أنثى' : 'غير محدد'}
                </p>
              </div>
              <span className="mr-auto text-xs text-green-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
                متصل
              </span>
            </div>

            {/* Start button */}
            <button
              onClick={() => {
                if ((filterGender !== 'any' || filterCountry !== 'any') && !(user as any)?.isPremium) {
                  alert("فلاتر البحث متاحة فقط لمشتركي Premium. يرجى الاشتراك أو اختيار 'الكل'.");
                  setLocation('/store');
                  return;
                }
                startSession(filterGender, filterCountry);
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold py-4 rounded-2xl shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3 text-lg"
            >
              <Search className="w-5 h-5" />
              ابدأ البحث الآن
            </button>

            <button
              onClick={() => setLocation('/')}
              className="w-full text-white/50 hover:text-white text-sm transition-colors py-2"
            >
              العودة للرئيسية
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 text-center text-white/40 text-xs space-y-1">
            <p>المكالمات مشفرة ومباشرة بين المستخدمين</p>
            <p>يعمل على شبكات 4G/5G وWiFi</p>
          </div>
        </div>
      </div>
    );
  }

  // ── CHAT ROOM ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col p-2 md:p-4 relative overflow-hidden" dir="rtl">

      {/* Gift animations */}
      {giftAnims.map(anim => (
        <div key={anim.id} className="fixed inset-0 pointer-events-none z-50 flex items-end justify-center pb-40">
          <div className="flex flex-col items-center animate-bounce-in-up">
            <span className="text-8xl drop-shadow-2xl" style={{ animation: 'giftFloat 3s ease-out forwards' }}>
              {anim.emoji}
            </span>
            <div className="mt-2 bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 text-white text-sm font-medium">
              {anim.senderName} أرسل {anim.name}
            </div>
          </div>
        </div>
      ))}

      {/* Notification */}
      {notif && status === 'waiting' && (
        <div className="mb-3 bg-gradient-to-r from-purple-600/90 to-pink-600/90 backdrop-blur-md rounded-2xl border border-white/20 p-3 flex items-center gap-3">
          <Bell className="w-5 h-5 text-yellow-300 flex-shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            {notif.partnerAvatar && (
              <img src={notif.partnerAvatar} alt={notif.partnerName}
                className="w-8 h-8 rounded-full border-2 border-white/40 float-right ml-2 mt-0.5 object-cover bg-white"
              />
            )}
            <p className="text-white text-sm font-medium leading-snug">
              🔔 <span className="font-bold">{notif.partnerName}</span> يبحث الآن!
            </p>
          </div>
          <button onClick={() => setNotif(null)} className="text-white/60 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setLocation('/profile')}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
          <div className="relative">
            <img src={myAvatar} alt={myName} className="w-8 h-8 rounded-full border border-white/30 object-cover bg-white" />
            {(user as any)?.isPremium && (
              <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 border border-gray-900">
                <Star className="w-2 h-2 text-gray-900 fill-gray-900" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold flex items-center gap-1">
              {myName}
              {(user as any)?.isPremium && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
            </span>
            <span className="text-[10px] opacity-60">الملف الشخصي</span>
          </div>
        </button>

        <div className="text-center">
          <h1 className="text-xl font-bold text-white">غرفة الدردشة</h1>
          <p className={`text-xs mt-0.5 ${status === 'matched' ? 'text-green-400' : 'text-yellow-300 animate-pulse'}`}>
            {status === 'matched' ? `متصل بـ ${peerName} — ${statusLabel}` : statusLabel}
          </p>
          {/* Active filters badge */}
          {(filterGender !== 'any' || filterCountry !== 'any') && (
            <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
              {filterGender !== 'any' && (
                <span className="bg-purple-600/60 text-white text-xs px-2 py-0.5 rounded-full">
                  {filterGender === 'male' ? 'ذكر' : 'أنثى'}
                </span>
              )}
              {filterCountry !== 'any' && (
                <span className="bg-pink-600/60 text-white text-xs px-2 py-0.5 rounded-full">
                  {COUNTRIES.find(c => c.code === filterCountry)?.name.split(' ')[0] || filterCountry}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full border border-white/10">
            <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-300 text-sm font-bold">{credits}</span>
          </div>
          <button onClick={() => setLocation('/store')} className="text-[10px] text-purple-400 font-bold mt-1 hover:text-purple-300">
            شحن النقاط
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        {/* Videos */}
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Remote video */}
          <div className="relative bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ minHeight: 220 }}>
            <video ref={remoteVideoRef} autoPlay playsInline
              className={`w-full h-full object-cover ${(status !== 'matched' || peerVideoOff) ? 'hidden' : ''}`}
              style={{ transform: 'scaleX(-1)', maxHeight: 340 }}
            />
            {(status !== 'matched' || peerVideoOff) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ minHeight: 220 }}>
                {status === 'matched' ? (
                  <>
                    <div className="relative mb-3">
                      {peerAvatar
                        ? <img src={peerAvatar} alt={peerName} className="w-24 h-24 rounded-full border-4 border-white/30 bg-white object-cover" />
                        : <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl">👤</div>}
                      <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md" />
                    </div>
                    <p className="text-white font-semibold text-lg">{peerName}</p>
                    <p className="text-white/50 text-sm mt-1">الكاميرا مطفاة</p>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-white/70">{statusLabel}</p>
                    {(filterGender !== 'any' || filterCountry !== 'any') && (
                      <p className="text-white/40 text-xs mt-2">
                        البحث حسب الفلتر المحدد...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs">
              {status === 'matched' ? peerName : 'ينتظر...'}
            </div>
          </div>

          {/* Local video */}
          <div className="relative bg-gray-700 rounded-2xl overflow-hidden shadow-xl border border-white/10" style={{ height: 130 }}>
            <video ref={localVideoRef} autoPlay playsInline muted
              className={`w-full h-full object-cover ${!isVideoOn ? 'hidden' : ''}`}
              style={{ transform: 'scaleX(-1)' }}
            />
            {!isVideoOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative mb-1">
                  <img src={myAvatar} alt={myName} className="w-14 h-14 rounded-full border-2 border-white/40 bg-white object-cover" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-md" />
                </div>
                <p className="text-white text-xs">{myName}</p>
              </div>
            )}
            <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-600 to-pink-500 px-2 py-0.5 rounded-full text-white text-xs font-bold">
              {myName}
            </div>
          </div>
        </div>

        {/* Text chat panel */}
        {showChat && (
          <div className="flex flex-col bg-gray-800/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl w-full md:w-72" style={{ maxHeight: 400 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-semibold text-sm">الدردشة الكتابية</span>
              <button onClick={() => setShowChat(false)} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {messages.length === 0 && <p className="text-white/30 text-xs text-center mt-4">لا توجد رسائل بعد</p>}
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                  <span className="text-white/40 text-xs mb-0.5">{m.name} · {m.time}</span>
                  <div className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] break-words ${m.mine ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white' : 'bg-white/15 text-white'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendText()}
                placeholder="اكتب رسالة..." dir="rtl"
                className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              />
              <button onClick={sendText} className="bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl px-3 hover:opacity-90">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-3 bg-black/40 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/10 shadow-2xl">
        <div className="grid grid-cols-5 gap-4 mb-6">
          {/* Row 1: Primary Controls */}
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={toggleMic}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isMicOn ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <span className="text-white/60 text-[10px] font-bold">ميكروفون</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button onClick={toggleVideo}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isVideoOn ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <span className="text-white/60 text-[10px] font-bold">كاميرا</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button onClick={toggleCamera}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg relative active:scale-90 ${
                (user as any)?.isPremium 
                  ? 'bg-gradient-to-b from-yellow-300 to-yellow-500 text-gray-900 border-b-4 border-yellow-700 hover:brightness-110' 
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}>
              <Smartphone className={`w-6 h-6 ${(user as any)?.isPremium ? 'animate-pulse' : ''}`} />
              {!(user as any)?.isPremium && <Lock className="w-2.5 h-2.5 absolute top-1.5 right-1.5" />}
            </button>
            <span className={`text-[10px] font-bold ${(user as any)?.isPremium ? 'text-yellow-400' : 'text-white/40'}`}>
              {facingMode === 'user' ? 'خلفية' : 'أمامية'}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button onClick={() => setIsSpeakerOn(v => !v)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isSpeakerOn ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
              {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <span className="text-white/60 text-[10px] font-bold">صوت</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button onClick={() => { setShowChat(v => !v); setUnread(0); }}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg relative ${showChat ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white'}`}>
              <MessageSquare className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-gray-900">{unread}</span>
              )}
            </button>
            <span className="text-white/60 text-[10px] font-bold">دردشة</span>
          </div>

          {/* Row 2: Secondary & Action Controls */}
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={() => setLocation('/store?from=chat')}
              className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg hover:brightness-110 active:scale-90">
              <ShoppingBag className="w-5 h-5" />
            </button>
            <span className="text-white/60 text-[10px] font-bold">المتجر</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => status === 'matched' ? setShowGifts(v => !v) : undefined}
              disabled={status !== 'matched'}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                status === 'matched'
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}>
              <Gift className="w-5 h-5" />
            </button>
            <span className="text-white/60 text-[10px] font-bold">هدية</span>
          </div>

          <div className="col-span-2 flex flex-col items-center gap-1.5">
            <button onClick={handleNext} disabled={status === 'connecting' || status === 'waiting'}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition-all active:scale-95">
              <SkipForward className="w-5 h-5" />
              <span>التالي</span>
            </button>
            <span className="text-white/60 text-[10px] font-bold">البحث عن شخص جديد</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-white/40 hover:bg-rose-500/20 hover:text-rose-500 transition-all">
              <Flag className="w-5 h-5" />
            </button>
            <span className="text-white/60 text-[10px] font-bold">إبلاغ</span>
          </div>
        </div>

        <button onClick={handleEnd}
          className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all border border-rose-500/20">
          <PhoneOff className="w-5 h-5" />
          <span>انهاء الاتصال</span>
        </button>
      </div>

      {showGifts && (
        <GiftPanel credits={credits} onSend={sendGift} onClose={() => setShowGifts(false)} disabled={spendGift.isPending} />
      )}

      <style>{`
        @keyframes giftFloat {
          0%   { transform: translateY(0) scale(0.5); opacity: 0; }
          20%  { transform: translateY(-20px) scale(1.2); opacity: 1; }
          80%  { transform: translateY(-80px) scale(1); opacity: 1; }
          100% { transform: translateY(-120px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
