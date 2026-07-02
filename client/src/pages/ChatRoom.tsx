import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff, SkipForward,
  Flag, Volume2, VolumeX, Send, MessageSquare, X,
  SwitchCamera, Lock, Gift, Bell, Star, Search, ShoppingBag, Zap,
  Users, UserRound, Heart, ChevronLeft, Globe, Wand2
} from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import GiftPanel, { GIFTS, type GiftItem } from '@/components/GiftPanel';
import TranslationPanel from '@/components/TranslationPanel';
import FaceFiltersPanel from '@/components/FaceFiltersPanel';
import FriendsPanel from '@/components/FriendsPanel';
import { playMessageSound, playFriendSound } from '@/lib/notificationSound';
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
  const { user, loading: authLoading } = useAuth();

  const myName    = (user as any)?.name    || 'انت';
  const myAvatar  = (user as any)?.avatar  || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(myName)}`;
  const myGender  = (user as any)?.gender  || 'other';
  const myCountry = (user as any)?.country || null;
  const myId      = useRef(makePeerId()).current;

  // ── filter state (setup screen) ───────────────────────────────────────────
  const [filterGender,  setFilterGender]  = useState<'male'|'female'|'any'>('any');
  const [filterCountry, setFilterCountry] = useState('any');

  // ── core state ─────────────────────────────────────────────────────────────
  const queryParams = new URLSearchParams(window.location.search);
  const autoStartParam = queryParams.get('autoStart') === 'true';
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

  // ── new features ────────────────────────────────────────────────────────────
  const [showTranslation, setShowTranslation] = useState(false);
  const [showFaceFilters, setShowFaceFilters] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [friends, setFriends] = useState<any[]>([]);
  const [friendReqBanner, setFriendReqBanner] = useState<{name:string;avatar:string} | null>(null);
  const [lastIncomingMsg, setLastIncomingMsg] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);

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
  const balanceQuery    = trpc.gifts.getBalance.useQuery(undefined, { staleTime: 30_000 });
  const { data: countryStats } = trpc.users.countryStats.useQuery(undefined, { staleTime: 60_000 });
  const spendGift    = trpc.gifts.spend.useMutation({
    onSuccess: (data) => setCredits(data.newBalance),
    onError:   (err)  => alert(err.message),
  });
  useEffect(() => { if (balanceQuery.data) setCredits(balanceQuery.data.credits); }, [balanceQuery.data]);

  // Auto-fill country for premium users from their saved profile
  useEffect(() => {
    if ((user as any)?.isPremium && myCountry) {
      setFilterCountry(myCountry);
    }
  }, [(user as any)?.isPremium, myCountry]);

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
    if (!mine) {
      setUnread(u => u + 1);
      setLastIncomingMsg(text);
      playMessageSound();
      // Browser push notification when window is not focused
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification('رسالة جديدة من ' + name, { body: text, icon: '/favicon.ico' }); } catch {}
      }
    }
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
      case 'friend-request':
        setFriendReqBanner({ name: msg.fromName || 'مستخدم', avatar: msg.fromAvatar || '' });
        toast(`طلب صداقة من ${msg.fromName || 'مستخدم'}`, { icon: '👥' });
        playFriendSound();
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification('طلب صداقة جديد', { body: `${msg.fromName || 'مستخدم'} يريد إضافتك كصديق`, icon: '/favicon.ico' }); } catch {}
        }
        setTimeout(() => setFriendReqBanner(null), 6000);
        break;
      case 'friend-accepted':
        toast.success(`${msg.fromName || 'مستخدم'} قبل طلب صداقتك! 🎉`);
        playFriendSound();
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification('تم قبول طلب الصداقة', { body: `${msg.fromName || 'مستخدم'} قبل طلب صداقتك`, icon: '/favicon.ico' }); } catch {}
        }
        break;
    }
  }, [createPC, signal, addMessage, startTimer, stopTimer, closePC, resetRemote, showGiftAnim, peerName]);

  // ── start session (called after filter screen) ────────────────────────────
  const startSession = useCallback(async (fg: string, fc: string) => {
    if (fg !== 'any' || fc !== 'any') {
      if (!(user as any)?.isPremium) {
        toast.error("فلتر الجنس والدولة ميزة Premium فقط.");
        sessionStorage.setItem('chat_auto_start', 'true');
        setLocation('/store?from=chat');
        return;
      }
    }
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
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

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

  useEffect(() => {
    // Wait until auth finishes loading — otherwise startSession changes when
    // user data arrives, which cancels the timer before it fires.
    if (authLoading) return;
    const shouldAutoStart = autoStartParam || sessionStorage.getItem('chat_auto_start') === 'true';
    if (shouldAutoStart && status === 'setup') {
      sessionStorage.removeItem('chat_auto_start');
      startSession('any', 'any');
    }
  }, [autoStartParam, status, authLoading, startSession]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (showChat) setUnread(0); }, [showChat]);

  // ── controls ───────────────────────────────────────────────────────────────
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const toggleCamera = async () => {
    if (!(user as any)?.isPremium) {
      sessionStorage.setItem('chat_auto_start', 'true');
      setLocation('/store?from=chat');
      return;
    }
    if (!localStreamRef.current) return;
    
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      // Try exact facing mode first, then fallback
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { exact: newMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newMode },
          audio: true
        });
      }
      
      // Replace video track in existing PeerConnection
      if (pcRef.current) {
        const videoTrack = newStream.getVideoTracks()[0];
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack);
        }
      }

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
      sessionStorage.setItem('chat_auto_start', 'true');
      setLocation('/store?from=chat');
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
                  { val: 'any',    label: 'الكل',  Icon: Users },
                  { val: 'male',   label: 'ذكر',   Icon: UserRound },
                  { val: 'female', label: 'أنثى',  Icon: Heart },
                ].map(({ val, label, Icon }) => (
                  <button
                    key={val}
                    onClick={() => setFilterGender(val as any)}
                    className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 border-2 ${
                      filterGender === val
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-transparent text-white shadow-xl scale-105'
                        : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:border-white/40 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Country filter — Premium */}
            <div>
              <label className="block text-white font-semibold mb-3 text-sm flex items-center gap-2">
                الدولة
                {(user as any)?.isPremium ? (
                  <span className="text-[10px] bg-green-500/20 border border-green-500/40 text-green-300 px-2 py-0.5 rounded-full font-bold">
                    مفعّل ✓
                  </span>
                ) : (
                  <span className="text-[10px] bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Premium
                  </span>
                )}
              </label>

              {(user as any)?.isPremium ? (
                <>
                  <select
                    value={filterCountry}
                    onChange={e => setFilterCountry(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 text-sm"
                  >
                    {COUNTRIES.map(c => {
                      const stat = countryStats?.find(s => s.country === c.code);
                      const label = stat ? `${c.name} — ${stat.count} مستخدم` : c.name;
                      return (
                        <option key={c.code} value={c.code} className="bg-gray-900 text-white">
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  {myCountry && filterCountry === myCountry && (
                    <p className="text-green-400 text-[11px] mt-1.5 flex items-center gap-1">
                      ✓ تم اختيار بلدك تلقائياً — يمكنك تغييره
                    </p>
                  )}
                  {filterCountry === 'any' && (
                    <p className="text-white/40 text-[11px] mt-1.5">
                      ستتصل بأشخاص من جميع الدول
                    </p>
                  )}
                </>
              ) : (
                <button
                  onClick={() => { sessionStorage.setItem('chat_auto_start', 'true'); setLocation('/store?from=chat'); }}
                  className="w-full bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-4 py-4 flex items-center justify-between group hover:bg-yellow-500/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-yellow-400" />
                    <div className="text-right">
                      <p className="text-yellow-300 text-sm font-bold">فلترة بالدولة</p>
                      <p className="text-yellow-300/60 text-[11px]">اشترك لتختار بلداً معيناً</p>
                    </div>
                  </div>
                  <span className="text-yellow-400 text-xs font-bold bg-yellow-500/20 px-3 py-1 rounded-full group-hover:bg-yellow-500/30">
                    اشترك الآن
                  </span>
                </button>
              )}
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
              className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-700 hover:via-fuchsia-700 hover:to-pink-600 text-white font-bold py-4 rounded-2xl shadow-2xl shadow-purple-900/50 transform hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 text-lg tracking-wide"
            >
              <Video className="w-5 h-5" />
              ابدأ البحث الآن
            </button>

            <button
              onClick={() => setLocation('/')}
              className="w-full flex items-center justify-center gap-2 text-white/50 hover:text-white/90 text-sm transition-colors py-2"
            >
              <ChevronLeft className="w-4 h-4" />
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
      <div className="grid grid-cols-3 items-center mb-3 gap-1">
        {/* Left: Profile */}
        <button onClick={() => setLocation('/profile')}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors min-w-0">
          <div className="relative flex-shrink-0">
            <img src={myAvatar} alt={myName} className="w-8 h-8 rounded-full border-2 border-white/30 object-cover bg-white shadow-lg" />
            {(user as any)?.isPremium && (
              <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 border-2 border-gray-900 shadow">
                <Star className="w-2 h-2 text-gray-900 fill-gray-900" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xs font-bold truncate max-w-[60px] flex items-center gap-0.5">
              {myName}
              {(user as any)?.isPremium && <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
            </span>
            <span className="text-[9px] opacity-50">ملفي</span>
          </div>
        </button>

        {/* Center: Title */}
        <div className="text-center min-w-0">
          <h1 className="text-base font-bold text-white leading-tight">غرفة الدردشة</h1>
          <p className={`text-[10px] mt-0.5 font-semibold ${status === 'matched' ? 'text-green-400' : 'text-yellow-300 animate-pulse'}`}>
            {status === 'matched' ? `${peerName} · ${statusLabel}` : statusLabel}
          </p>
          {(filterGender !== 'any' || filterCountry !== 'any') && (
            <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
              {filterGender !== 'any' && (
                <span className="bg-purple-600/70 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {filterGender === 'male' ? 'ذكر' : 'أنثى'}
                </span>
              )}
              {filterCountry !== 'any' && (
                <span className="bg-pink-600/70 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {COUNTRIES.find(c => c.code === filterCountry)?.name.split(' ')[0] || filterCountry}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Credits */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/30 px-2.5 py-1 rounded-full shadow-sm">
            <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-300 text-xs font-black">{credits}</span>
          </div>
          <button onClick={() => setLocation('/store')} className="text-[9px] text-purple-400 font-bold hover:text-purple-300 transition-colors flex items-center gap-0.5">
            <ShoppingBag className="w-2.5 h-2.5" />
            شحن
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (status !== 'matched') {
                      toast.info("فلاتر الوجه تفتح أثناء المكالمة النشطة.");
                      return;
                    }
                    setShowFaceFilters(v => !v);
                  }}
                  className={`transition-colors ${status === 'matched' ? 'text-purple-300 hover:text-purple-200' : 'text-white/25'}`}
                  title="فلاتر"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (status !== 'matched') {
                      toast.info("ميزة الترجمة تفتح أثناء المكالمة النشطة.");
                      return;
                    }
                    setShowTranslation(v => !v);
                  }}
                  className={`transition-colors ${status === 'matched' ? 'text-blue-300 hover:text-blue-200' : 'text-white/25'}`}
                  title="ترجمة"
                >
                  <Globe className="w-4 h-4" />
                </button>
                <button onClick={() => setShowChat(false)} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
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

      {/* ── Controls Bar ─────────────────────────────────────────────────────── */}
      <div className="mt-3 bg-gray-900/80 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">

        {/* Row 1 — 4 primary toggles */}
        <div className="grid grid-cols-4 gap-px bg-white/5">
          {/* Mic */}
          <button
            onClick={toggleMic}
            className={`flex flex-col items-center gap-1.5 py-4 px-2 transition-all active:scale-95 ${isMicOn ? 'text-blue-300' : 'text-red-400 bg-red-500/10'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${isMicOn ? 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-900/50' : 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-900/50'}`}>
              {isMicOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
            </div>
            <span className="text-[11px] font-bold">{isMicOn ? 'ميكروفون' : 'مكتوم'}</span>
          </button>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            className={`flex flex-col items-center gap-1.5 py-4 px-2 transition-all active:scale-95 ${isVideoOn ? 'text-indigo-300' : 'text-red-400 bg-red-500/10'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${isVideoOn ? 'bg-gradient-to-br from-indigo-500 to-violet-700 shadow-violet-900/50' : 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-900/50'}`}>
              {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
            </div>
            <span className="text-[11px] font-bold">{isVideoOn ? 'كاميرا' : 'مطفأة'}</span>
          </button>

          {/* Speaker */}
          <button
            onClick={() => setIsSpeakerOn(v => !v)}
            className={`flex flex-col items-center gap-1.5 py-4 px-2 transition-all active:scale-95 ${isSpeakerOn ? 'text-teal-300' : 'text-red-400 bg-red-500/10'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${isSpeakerOn ? 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-teal-900/50' : 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-900/50'}`}>
              {isSpeakerOn ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-white" />}
            </div>
            <span className="text-[11px] font-bold">{isSpeakerOn ? 'صوت' : 'صامت'}</span>
          </button>

          {/* Chat */}
          <button
            onClick={() => { setShowChat(v => !v); setUnread(0); }}
            className={`relative flex flex-col items-center gap-1.5 py-4 px-2 transition-all active:scale-95 ${showChat ? 'text-cyan-300' : 'text-emerald-300'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg relative ${showChat ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-900/50' : 'bg-gradient-to-br from-emerald-500 to-green-700 shadow-emerald-900/50'}`}>
              <MessageSquare className="w-5 h-5 text-white" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-black border-2 border-gray-900 px-0.5">
                  {unread}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold">دردشة</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mx-4" />

        {/* Row 2 — 4 secondary actions */}
        <div className="grid grid-cols-4 gap-px bg-white/5">
          {/* Camera Switch — Premium */}
          <button
            onClick={toggleCamera}
            className={`flex flex-col items-center gap-1.5 py-4 px-2 transition-all active:scale-95 ${(user as any)?.isPremium ? 'text-yellow-300' : 'text-white/40'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg relative ${(user as any)?.isPremium ? 'bg-gradient-to-br from-yellow-400 to-amber-600 shadow-amber-900/50' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
              <SwitchCamera className={`w-5 h-5 ${(user as any)?.isPremium ? 'text-gray-900' : 'text-white/50'}`} />
              {!(user as any)?.isPremium && (
                <Lock className="w-2.5 h-2.5 text-white/60 absolute top-1 right-1" />
              )}
            </div>
            <span className="text-[11px] font-bold leading-tight text-center">
              {(user as any)?.isPremium ? (facingMode === 'user' ? 'خلفية' : 'أمامية') : 'تبديل 🔒'}
            </span>
          </button>

          {/* Friends */}
          <button
            onClick={() => setShowFriends(v => !v)}
            className="flex flex-col items-center gap-1.5 py-4 px-2 text-red-300 transition-all active:scale-95"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-900/50">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="text-[11px] font-bold">أصدقاء</span>
          </button>

          {/* Gift */}
          <button
            onClick={() => status === 'matched' ? setShowGifts(v => !v) : undefined}
            disabled={status !== 'matched'}
            className={`flex flex-col items-center gap-1.5 py-4 px-2 transition-all active:scale-95 ${status === 'matched' ? 'text-orange-300' : 'text-white/30'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${status === 'matched' ? 'bg-gradient-to-br from-orange-400 to-pink-600 shadow-orange-900/50' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
              <Gift className="w-5 h-5 text-white" />
            </div>
            <span className="text-[11px] font-bold">هدية</span>
          </button>

          {/* Store */}
          <button
            onClick={() => { sessionStorage.setItem('chat_auto_start', 'true'); setLocation('/store?from=chat'); }}
            className="flex flex-col items-center gap-1.5 py-4 px-2 text-fuchsia-300 transition-all active:scale-95"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-fuchsia-500 to-pink-700 shadow-lg shadow-fuchsia-900/50">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="text-[11px] font-bold">المتجر</span>
          </button>

          {/* Report */}
          <button
            onClick={() => {
              if (status !== 'matched') {
                toast.info("يمكنك الإبلاغ فقط أثناء المكالمة النشطة.");
                return;
              }
              setReportSent(false);
              setReportReason('');
              setShowReport(true);
            }}
            className="flex flex-col items-center gap-1.5 py-4 px-2 text-rose-400 transition-all active:scale-95"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-rose-600 to-red-800 shadow-lg shadow-rose-900/50">
              <Flag className="w-5 h-5 text-white" />
            </div>
            <span className="text-[11px] font-bold">إبلاغ</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mx-4" />

        {/* Next + End Call row */}
        <div className="grid grid-cols-3 gap-3 p-4">
          {/* Next — spans 2 cols */}
          <button
            onClick={handleNext}
            disabled={status === 'connecting' || status === 'waiting'}
            className="col-span-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-gray-900 font-black flex items-center justify-center gap-2.5 shadow-lg shadow-amber-900/40 disabled:opacity-40 active:scale-95 transition-all text-sm py-3.5 border-b-4 border-amber-600 active:border-b-0 active:translate-y-0.5"
          >
            <SkipForward className="w-5 h-5" />
            التالي — شخص جديد
          </button>

          {/* End Call */}
          <button
            onClick={handleEnd}
            className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white font-black flex flex-col items-center justify-center gap-1 shadow-lg shadow-red-900/50 active:scale-95 transition-all py-3.5 border-b-4 border-red-700 active:border-b-0 active:translate-y-0.5"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="text-[10px] font-black tracking-wide">إنهاء</span>
          </button>
        </div>
      </div>

      {showGifts && (
        <GiftPanel credits={credits} onSend={sendGift} onClose={() => setShowGifts(false)} disabled={spendGift.isPending} />
      )}

      {showTranslation && (
        <TranslationPanel
          text={lastIncomingMsg}
          fromLang="auto"
          toLang="ar"
          onClose={() => setShowTranslation(false)}
          autoTranslate={true}
          onTranslatedMessage={(original, translated) => {
            if (translated && translated !== original) {
              setMessages(prev => prev.map(m =>
                m.text === original && !m.mine
                  ? { ...m, translated }
                  : m
              ));
            }
          }}
        />
      )}

      {showFaceFilters && (
        <FaceFiltersPanel onClose={() => setShowFaceFilters(false)} isPremium={(user as any)?.isPremium} onSelectFilter={setSelectedFilter} />
      )}

      {showFriends && (
        <FriendsPanel
          friends={friends}
          onClose={() => setShowFriends(false)}
          onStartChat={(friendId) => { toast.success('جاري بدء الدردشة...'); setShowFriends(false); }}
          currentPeerName={peerName}
          currentPeerAvatar={peerAvatar}
          currentPeerId={status === 'matched' ? 'peer_current' : undefined}
          myPeerId={myId}
          onSendFriendRequest={() => {
            signal('friend-request', { senderName: myName, senderAvatar: myAvatar });
          }}
        />
      )}

      {/* Friend Request Banner */}
      {friendReqBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 bg-gray-900/95 border border-purple-500/40 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md">
            <img src={friendReqBanner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendReqBanner.name}`}
              alt={friendReqBanner.name} className="w-10 h-10 rounded-full border-2 border-purple-500/40" />
            <div>
              <p className="text-white font-bold text-sm">{friendReqBanner.name}</p>
              <p className="text-purple-300 text-xs">أرسل لك طلب صداقة 👥</p>
            </div>
            <button onClick={() => {
              signal('friend-accepted');
              toast.success('تم قبول الطلب!');
              setFriendReqBanner(null);
            }} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors">
              قبول
            </button>
            <button onClick={() => setFriendReqBanner(null)} className="text-white/40 hover:text-white transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white font-bold">
                <Flag className="w-5 h-5 text-rose-400" />
                الإبلاغ عن مستخدم
              </div>
              <button onClick={() => setShowReport(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSent ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                  <Flag className="w-7 h-7 text-green-400" />
                </div>
                <p className="text-white font-bold text-lg">تم إرسال البلاغ</p>
                <p className="text-white/50 text-sm text-center">شكراً لك. سنراجع البلاغ في أقرب وقت.</p>
                <button
                  onClick={() => { setShowReport(false); handleNext(); }}
                  className="mt-2 w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition-all"
                >
                  الانتقال للشخص التالي
                </button>
              </div>
            ) : (
              <>
                <p className="text-white/60 text-sm mb-3">اختر سبب الإبلاغ:</p>
                <div className="space-y-2 mb-4">
                  {['محتوى غير لائق', 'تحرش أو إزعاج', 'عنف أو تهديد', 'خطاب كراهية', 'محتوى للأطفال', 'أخرى'].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        reportReason === reason
                          ? 'bg-rose-600/30 border-rose-500/60 text-rose-300'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    if (!reportReason) { toast.error('اختر سبب الإبلاغ أولاً'); return; }
                    try {
                      await fetch('/api/report', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reportedPeerId: 'peer_current', reason: reportReason, reporterName: myName }),
                      });
                    } catch { /* best effort */ }
                    setReportSent(true);
                  }}
                  disabled={!reportReason}
                  className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:opacity-90 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-all"
                >
                  إرسال البلاغ
                </button>
              </>
            )}
          </div>
        </div>
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
