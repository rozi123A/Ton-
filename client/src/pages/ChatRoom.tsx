import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff, SkipForward,
  Flag, Volume2, VolumeX, Send, MessageSquare, X,
  SwitchCamera, Lock, Gift, Bell, Star, Search, ShoppingBag, Zap,
  Users, UserRound, Heart, ChevronLeft, Globe, Wand2, Play, Square
} from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import GiftPanel, { GIFTS, type GiftItem } from '@/components/GiftPanel';
import TranslationPanel from '@/components/TranslationPanel';
import FaceFiltersPanel from '@/components/FaceFiltersPanel';
import FriendsPanel from '@/components/FriendsPanel';
import DirectMessagePanel from '@/components/DirectMessagePanel';
import PremiumMessageBubble from "@/components/PremiumMessageBubble";
import { playMessageSound, playFriendSound, playRingSound } from '@/lib/notificationSound';
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

type Status = 'idle' | 'setup' | 'connecting' | 'waiting' | 'confirming' | 'matched' | 'ended';
interface ChatMsg  { text: string; mine: boolean; name: string; time: string; }
interface GiftAnim { emoji: string; name: string; senderName: string; id: number; }
interface Notif    { partnerName: string; partnerAvatar: string; }
interface PendingMatch { name: string; avatar: string; userId?: number; role: 'caller' | 'callee'; }

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
  const [status,       setStatus]      = useState<Status>('idle');
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
  const [pendingMatch, setPendingMatchState] = useState<PendingMatch | null>(null);
  const pendingMatchRef = useRef<PendingMatch | null>(null);
  const setPendingMatch = useCallback((m: PendingMatch | null) => { pendingMatchRef.current = m; setPendingMatchState(m); }, []);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── gifts ──────────────────────────────────────────────────────────────────
  const [showGifts, setShowGifts] = useState(false);
  const [giftAnims, setGiftAnims] = useState<GiftAnim[]>([]);
  const [credits,   setCredits]   = useState(100);

  // ── new features ────────────────────────────────────────────────────────────
  const [showTranslation, setShowTranslation] = useState(false);
  const [showFaceFilters, setShowFaceFilters] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [dmTarget, setDmTarget] = useState<{ id: number; name: string; avatar: string } | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const { data: dbFriends, refetch: refetchFriends } = trpc.social.getFriends.useQuery(undefined, { enabled: !!user });
  const { data: unreadDmData, refetch: refetchUnread } = trpc.messages.getUnreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 8000,
  });
  const unreadDmCount = unreadDmData?.count ?? 0;
  const sendFriendRequestMutation = trpc.social.sendRequest.useMutation({
    onSuccess: () => toast.success('تم إرسال طلب الصداقة بنجاح'),
    onError: (err) => toast.error(err.message),
  });
  const acceptFriendRequestMutation = trpc.social.acceptRequest.useMutation({
    onSuccess: () => {
      toast.success('تم قبول الصداقة!');
      refetchFriends();
    },
    onError: (err) => toast.error(err.message),
  });

  // ── DM notification: toast when unread count rises while panel is closed ─────
  const prevUnreadRef = useRef(0);
  useEffect(() => {
    if (unreadDmCount > prevUnreadRef.current && !dmTarget) {
      const diff = unreadDmCount - prevUnreadRef.current;
      playMessageSound();
      toast(`لديك ${diff} رسالة خاصة جديدة 💬`, {
        description: 'افتح قائمة الأصدقاء للرد',
        duration: 5000,
      });
    }
    prevUnreadRef.current = unreadDmCount;
  }, [unreadDmCount, dmTarget]);

  const [friendReqBanner, setFriendReqBanner] = useState<{name:string;avatar:string;fromPeerId?:string;fromUserId?:number} | null>(null);
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
  const walletQuery     = trpc.gifts.getWallet.useQuery(undefined, { staleTime: 30_000 });
  const { data: countryStats } = trpc.users.countryStats.useQuery(undefined, { staleTime: 60_000 });
  const spendGift    = trpc.gifts.spend.useMutation({
    onSuccess: (data) => setCredits(data.newBalance),
    onError:   (err)  => alert(err.message),
  });
  const convertStars = trpc.gifts.convertStars.useMutation({
    onSuccess: (data) => {
      toast.success(`تم تحويل النجوم! حصلت على ${data.creditsGained} نقاط`);
      walletQuery.refetch();
      balanceQuery.refetch();
    },
    onError: (err) => toast.error(err.message)
  });

  const claimBonus = trpc.users.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      toast.success(`مبروك! حصلت على ${data.starsGained} نجوم و ${data.creditsGained} نقاط 🎁`);
      setShowDailyBonus(false);
      walletQuery.refetch();
      balanceQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setShowDailyBonus(false);
    }
  });

  const { data: notifications } = trpc.notifications.get.useQuery(undefined, { 
    enabled: !!user,
    refetchInterval: 10000 
  });

  useEffect(() => {
    if (notifications) {
      const alreadyClaimed = notifications.some(n => 
        n.type === 'system' && 
        n.title === 'مكافأة يومية 🎁' && 
        new Date(n.createdAt).toDateString() === new Date().toDateString()
      );
      setShowDailyBonus(!alreadyClaimed);
    }
  }, [notifications]);

  useEffect(() => { if (balanceQuery.data) setCredits(balanceQuery.data.credits); }, [balanceQuery.data]);

  // Auto-fill country for all users from their detected profile country
  useEffect(() => {
    if (myCountry) {
      setFilterCountry(myCountry);
    }
  }, [myCountry]);

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
    const peerUserId = (window as any).currentPeerUserId;
    spendGift.mutate({ 
      giftType: gift.id, 
      cost: gift.cost,
      receiverId: peerUserId 
    });
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

  // ── finalize a confirmed match: update UI state (no PC handling here) ───────
  const finalizeMatch = useCallback((match: PendingMatch) => {
    setPeerName(match.name);
    setPeerAvatar(match.avatar);
    (window as any).currentPeerUserId = match.userId;
    setPendingMatch(null);
    setStatus('matched'); startTimer(); setNotif(null);
  }, [startTimer]);

  // ── SSE event handler ──────────────────────────────────────────────────────
  const handleEvent = useCallback(async (msg: any) => {
    switch (msg.type) {
      case 'waiting':
        setPendingMatch(null);
        setStatus('waiting'); stopTimer(); closePC(); resetRemote(); setMessages([]); setShowGifts(false);
        break;
      case 'matched': {
        // Show an accept/reject confirmation before connecting, with a phone-style ring.
        setPendingMatch({
          name: msg.peer?.name || 'مستخدم',
          avatar: msg.peer?.avatar || '',
          userId: msg.peer?.userId,
          role: msg.role === 'caller' ? 'caller' : 'callee',
        });
        setStatus('confirming');
        setNotif(null);
        break;
      }
      case 'offer': {
        // Partner already accepted and started the connection — auto-confirm our side too.
        if (pendingMatchRef.current) finalizeMatch(pendingMatchRef.current);
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
        setPendingMatch(null);
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
        setFriendReqBanner({ 
          name: msg.fromName || 'مستخدم', 
          avatar: msg.fromAvatar || '',
          fromPeerId: msg.fromPeerId,
          fromUserId: msg.fromUserId
        });
        toast(`طلب صداقة من ${msg.fromName || 'مستخدم'}`, { icon: '👥' });
        playFriendSound();
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification('طلب صداقة جديد', { body: `${msg.fromName || 'مستخدم'} يريد إضافتك كصديق`, icon: '/favicon.ico' }); } catch {}
        }
        setTimeout(() => setFriendReqBanner(null), 10000);
        break;
      case 'friend-accepted':
        toast.success(`${msg.fromName || 'مستخدم'} قبل طلب صداقتك! 🎉`);
        playFriendSound();
        refetchFriends();
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification('تم قبول طلب الصداقة', { body: `${msg.fromName || 'مستخدم'} قبل طلب صداقتك`, icon: '/favicon.ico' }); } catch {}
        }
        break;
      case 'radar-blocked':
        // Server rejected connection: insufficient stars
        destroyedRef.current = true;
        esRef.current?.close();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        closePC();
        setStatus('idle');
        toast.error(msg.message || 'رصيد نجوم غير كافٍ لاستخدام الرادار');
        walletQuery.refetch();
        setTimeout(() => setLocation('/store'), 1500);
        break;
    }
  }, [createPC, signal, addMessage, startTimer, stopTimer, closePC, resetRemote, showGiftAnim, peerName, walletQuery, setLocation]);

  const deductRadarStars = trpc.gifts.deductRadarStars.useMutation();

  // ── start session (called after filter screen) ────────────────────────────
  const startSession = useCallback(async (fg: string, fc: string) => {
    // Star Radar logic: free for "any" gender + own/any country; paid otherwise
    const isPaidRadar = fg !== 'any' || (fc !== 'any' && fc !== myCountry);
    if (isPaidRadar && !(user as any)?.isPremium) {
      const stars = walletQuery.data?.wallet || 0;
      if (stars < 5) {
        toast.error(`رصيد نجومك ${stars} نجمة فقط. تحتاج 5 نجوم لاستخدام الرادار. يرجى الشحن أولاً.`);
        setLocation('/store');
        return;
      }
      // Deduct stars immediately on start
      try {
        await deductRadarStars.mutateAsync({ amount: 5 });
        toast.success("تم خصم 5 نجوم لتفعيل رادار النجوم 🌟");
        walletQuery.refetch();
      } catch (err: any) {
        toast.error(err.message || "رصيد نجوم غير كافٍ");
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
      userId: (user as any)?.id || '',
    });
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const es = new EventSource(`/api/signal/connect?${params}`);
    esRef.current = es;
    es.onmessage = (e) => { try { handleEvent(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror   = () => { if (!destroyedRef.current) setStatus('ended'); };
  }, [myId, myName, myAvatar, myGender, myCountry, handleEvent, user, walletQuery, deductRadarStars, setLocation]);

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
    if (shouldAutoStart && (status === 'setup' || status === 'idle')) {
      sessionStorage.removeItem('chat_auto_start');
      startSession('any', 'any');
    }
  }, [autoStartParam, status, authLoading, startSession]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (showChat) setUnread(0); }, [showChat]);

  // ── controls ───────────────────────────────────────────────────────────────
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const toggleCamera = async () => {
    const isAdmin =
      (user as any)?.role === 'admin' ||
      sessionStorage.getItem('admin_mode') !== null;
    if (!(user as any)?.isPremium && !isAdmin) {
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

  // ── stop searching (cancel queue without ending a call) ───────────────────
  const stopSession = useCallback(() => {
    destroyedRef.current = true;   // stays true until next startSession() resets it
    esRef.current?.close();
    esRef.current = null;
    closePC();
    stopTimer();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setStatus('idle');
    // NOTE: do NOT reset destroyedRef here — onerror fires async after close()
    // and would call setStatus('ended') if destroyedRef were false.
    // startSession() resets destroyedRef.current = false when a new session begins.
  }, [closePC, stopTimer]);
  const handleRejectMatch = useCallback(() => {
    setPendingMatch(null);
    setStatus('waiting');
    signal('next');
  }, [signal, setPendingMatch]);

  const handleAcceptMatch = useCallback(async () => {
    const match = pendingMatchRef.current;
    if (!match) return;

    // Deduction already happened at startSession — proceed directly
    finalizeMatch(match);
    const pc = createPC();
    if (match.role === 'caller') {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal('offer', offer);
    }
  }, [finalizeMatch, createPC, signal, handleRejectMatch]);
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
  const statusLabel = status === 'idle'     ? 'اضغط ابدأ مباشرة للبدء'
    : status === 'connecting' ? 'جاري الاتصال...'
    : status === 'waiting'  ? 'جاري البحث...'
    : status === 'confirming' ? 'تم العثور على شخص!'
    : status === 'matched'  ? fmt(callDuration)
    : 'انتهت المكالمة';

  // ── ring while a match confirmation is pending ──────────────────────────────
  useEffect(() => {
    if (status === 'confirming') {
      playRingSound();
      ringIntervalRef.current = setInterval(playRingSound, 2200);
    }
    return () => {
      if (ringIntervalRef.current) { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null; }
    };
  }, [status]);

  // ── SETUP SCREEN ───────────────────────────────────────────────────────────
  if (status === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
        <div className="w-full max-w-md py-4">
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

            {/* Gender filter — Star Radar */}
            <div>
              <label className="block text-white font-semibold mb-3 text-sm flex items-center gap-2">
                الجنس المطلوب
                {!(user as any)?.isPremium && filterGender !== 'any' && (
                  <span className="text-[10px] bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> 5 نجوم
                  </span>
                )}
              </label>
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

            {/* Country filter — Star Radar */}
            <div>
              <label className="block text-white font-semibold mb-3 text-sm flex items-center gap-2">
                الدولة
                {(user as any)?.isPremium ? (
                  <span className="text-[10px] bg-green-500/20 border border-green-500/40 text-green-300 px-2 py-0.5 rounded-full font-bold">
                    مفعّل ✓
                  </span>
                ) : filterCountry !== 'any' && filterCountry === myCountry ? (
                  <span className="text-[10px] bg-green-500/20 border border-green-500/40 text-green-300 px-2 py-0.5 rounded-full font-bold">
                    مجاني ✓
                  </span>
                ) : (
                  <span className="text-[10px] bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> Star Radar
                  </span>
                )}
              </label>

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
              
              {!(user as any)?.isPremium && filterCountry !== 'any' && filterCountry !== myCountry && (
                <p className="text-yellow-400 text-[11px] mt-1.5 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> استخدام الرادار سيكلفك 5 نجوم
                </p>
              )}
              {myCountry && filterCountry === myCountry && (
                <p className="text-green-400 text-[11px] mt-1.5 flex items-center gap-1">
                  ✓ تم اختيار بلدك تلقائياً
                </p>
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
              onClick={() => startSession(filterGender, filterCountry)}
              className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-700 hover:via-fuchsia-700 hover:to-pink-600 text-white font-bold py-4 rounded-2xl shadow-2xl shadow-purple-900/50 transform hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 text-lg tracking-wide"
            >
              <Video className="w-5 h-5" />
              {(filterGender === 'any' && (filterCountry === 'any' || filterCountry === myCountry)) ? 'ابدأ البحث الآن' : 'تفعيل رادار النجوم 🚀'}
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

      {/* Match Found — Accept / Reject */}
      {status === 'confirming' && pendingMatch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 via-purple-900/60 to-gray-900 rounded-3xl border border-white/20 shadow-2xl max-w-xs w-full p-6 flex flex-col items-center text-center">
            <p className="text-white/60 text-xs font-bold mb-4 tracking-wide">تم العثور على شخص!</p>
            <div className="relative mb-4">
              <span className="absolute inset-0 rounded-full bg-purple-500/40 animate-ping" />
              <span className="absolute -inset-2 rounded-full bg-pink-500/20 animate-ping" style={{ animationDelay: '0.3s' }} />
              <img
                src={pendingMatch.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${pendingMatch.name}`}
                alt={pendingMatch.name}
                className="relative w-24 h-24 rounded-full border-4 border-purple-400 object-cover shadow-2xl"
              />
            </div>
            <h2 className="text-white font-bold text-xl mb-1">{pendingMatch.name}</h2>
            <p className="text-purple-300 text-sm mb-6 animate-pulse">📞 جاري الاتصال...</p>
            <div className="flex gap-4 w-full">
              <button
                onClick={handleRejectMatch}
                className="flex-1 flex flex-col items-center gap-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-red-900/40"
              >
                <PhoneOff className="w-6 h-6" />
                رفض
              </button>
              <button
                onClick={handleAcceptMatch}
                className="flex-1 flex flex-col items-center gap-1.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-green-900/40"
              >
                <Video className="w-6 h-6" />
                قبول
              </button>
            </div>
          </div>
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

        {/* Right: Wallet & Credits */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">

          {/* Row 1: Star wallet + Credits */}
          <div className="flex items-center gap-2">
            {/* Star Wallet */}
            <button
              onClick={() => {
                const stars = walletQuery.data?.wallet || 0;
                if (stars < 10) {
                  toast("محفظة النجوم 🌟", {
                    description: `رصيدك الحالي ${stars} نجوم. اشحن النجوم لاستخدام الرادار أو أرسل هدايا مميزة.`,
                    action: { label: "شحن", onClick: () => setLocation('/store') }
                  });
                  return;
                }
                setShowConvertModal(true);
              }}
              className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/30 px-2 py-1 rounded-full shadow-sm hover:bg-purple-500/30 transition-colors"
            >
              <Star className="w-3 h-3 text-purple-400 fill-purple-400" />
              <span className="text-purple-300 text-[11px] font-black">{walletQuery.data?.wallet || 0}</span>
              <span className="text-purple-500 text-[9px]">⭐</span>
            </button>

            {/* Credits */}
            <button
              onClick={() => setLocation('/store')}
              className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/30 px-2 py-1 rounded-full shadow-sm hover:bg-yellow-500/30 transition-colors"
            >
              <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-300 text-[11px] font-black">{credits}</span>
            </button>
          </div>

          {/* Row 2: Daily Bonus compact card */}
          {showDailyBonus && (
            <button
              onClick={() => claimBonus.mutate()}
              disabled={claimBonus.isPending}
              className="relative flex items-center gap-2 px-3 py-0 h-[42px] w-[115px] rounded-2xl
                         bg-gradient-to-r from-orange-500/80 to-amber-400/80
                         backdrop-blur-md border border-orange-300/25
                         shadow-sm shadow-orange-900/20
                         active:scale-[0.97] hover:brightness-110
                         transition-all duration-150 overflow-hidden flex-shrink-0"
            >
              {/* Glassmorphism sheen */}
              <span className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent pointer-events-none rounded-2xl" />

              {/* Gift icon with glow */}
              <span
                className="text-[20px] leading-none flex-shrink-0 relative z-10"
                style={{ filter: 'drop-shadow(0 0 5px rgba(255,200,50,0.7))' }}
              >🎁</span>

              {/* Text */}
              <div className="flex flex-col leading-tight relative z-10">
                <span className="text-white font-black text-[11px] tracking-wide">مكافأة</span>
                <span className="text-white/65 text-[9px]">اضغط للاستلام</span>
              </div>

              {/* Red pulse dot */}
              <span className="absolute top-1.5 left-1.5 flex h-2 w-2 z-20">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            </button>
          )}

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
                ) : status === 'idle' ? (
                  <div className="text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center mx-auto mb-3">
                      <Play className="w-7 h-7 text-green-400 fill-green-400" />
                    </div>
                    <p className="text-white/60 text-sm">اضغط <span className="text-green-400 font-bold">ابدأ مباشرة</span> للبدء</p>
                  </div>
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
                <PremiumMessageBubble
                  key={i}
                  text={m.text}
                  senderName={m.name}
                  time={m.time}
                  isMine={m.mine}
                  isPremium={user?.isPremium || false}
                />
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

        {/* ═══════════════ Controls Panel ═══════════════ */}
        <div className="px-3 pt-3 pb-2 space-y-2.5">

          {/* ── Row 1 : دردشة · صوت · كاميرا · ميكروفون ─── */}
          <div className="grid grid-cols-4 gap-2.5">

            {/* Chat */}
            <button
              onClick={() => { setShowChat(v => !v); setUnread(0); }}
              className={`relative flex flex-col items-center gap-2 pt-3 pb-2.5 rounded-[18px] transition-all duration-200 active:scale-95 hover:scale-[1.03] ${showChat ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.07] text-emerald-300 hover:bg-white/[0.11]'}`}
            >
              <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md relative ${showChat ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-900/40' : 'bg-gradient-to-br from-emerald-500 to-green-700 shadow-emerald-900/40'}`}>
                <MessageSquare className="w-[18px] h-[18px] text-white" />
                {unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-black border-2 border-gray-900 px-0.5">
                    {unread}
                  </span>
                )}
              </div>
              <span className="text-[10.5px] font-bold tracking-wide">دردشة</span>
            </button>

            {/* Speaker */}
            <button
              onClick={() => setIsSpeakerOn(v => !v)}
              className={`flex flex-col items-center gap-2 pt-3 pb-2.5 rounded-[18px] transition-all duration-200 active:scale-95 hover:scale-[1.03] ${isSpeakerOn ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/25' : 'bg-red-500/10 text-red-400 hover:bg-red-500/15'}`}
            >
              <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md ${isSpeakerOn ? 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-teal-900/40' : 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-900/40'}`}>
                {isSpeakerOn ? <Volume2 className="w-[18px] h-[18px] text-white" /> : <VolumeX className="w-[18px] h-[18px] text-white" />}
              </div>
              <span className="text-[10.5px] font-bold tracking-wide">{isSpeakerOn ? 'صوت' : 'صامت'}</span>
            </button>

            {/* Camera */}
            <button
              onClick={toggleVideo}
              className={`flex flex-col items-center gap-2 pt-3 pb-2.5 rounded-[18px] transition-all duration-200 active:scale-95 hover:scale-[1.03] ${isVideoOn ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/25' : 'bg-red-500/10 text-red-400 hover:bg-red-500/15'}`}
            >
              <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md ${isVideoOn ? 'bg-gradient-to-br from-indigo-500 to-violet-700 shadow-violet-900/40' : 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-900/40'}`}>
                {isVideoOn ? <Video className="w-[18px] h-[18px] text-white" /> : <VideoOff className="w-[18px] h-[18px] text-white" />}
              </div>
              <span className="text-[10.5px] font-bold tracking-wide">{isVideoOn ? 'كاميرا' : 'مطفأة'}</span>
            </button>

            {/* Mic */}
            <button
              onClick={toggleMic}
              className={`flex flex-col items-center gap-2 pt-3 pb-2.5 rounded-[18px] transition-all duration-200 active:scale-95 hover:scale-[1.03] ${isMicOn ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/25' : 'bg-red-500/10 text-red-400 hover:bg-red-500/15'}`}
            >
              <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md ${isMicOn ? 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-900/40' : 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-900/40'}`}>
                {isMicOn ? <Mic className="w-[18px] h-[18px] text-white" /> : <MicOff className="w-[18px] h-[18px] text-white" />}
              </div>
              <span className="text-[10.5px] font-bold tracking-wide">{isMicOn ? 'ميكروفون' : 'مكتوم'}</span>
            </button>
          </div>

          {/* ── Row 2 : أصدقاء · المتجر · الخلفية · هدية ── */}
          <div className="grid grid-cols-4 gap-2.5">

            {/* Friends */}
            <button
              onClick={() => { setShowFriends(v => !v); refetchUnread(); }}
              className="relative flex flex-col items-center gap-2 pt-3 pb-2.5 rounded-[18px] bg-white/[0.07] text-red-300 transition-all duration-200 active:scale-95 hover:scale-[1.03] hover:bg-white/[0.11]"
            >
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-600 shadow-md shadow-red-900/40 relative">
                <Heart className="w-[18px] h-[18px] text-white" />
                {unreadDmCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-gray-900 text-[9px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-black border-2 border-gray-900 px-0.5">
                    {unreadDmCount > 99 ? '99+' : unreadDmCount}
                  </span>
                )}
              </div>
              <span className="text-[10.5px] font-bold tracking-wide">أصدقاء</span>
            </button>

            {/* Store */}
            <button
              onClick={() => { sessionStorage.setItem('chat_auto_start', 'true'); setLocation('/store?from=chat'); }}
              className="flex flex-col items-center gap-2 pt-3 pb-2.5 rounded-[18px] bg-white/[0.07] text-fuchsia-300 transition-all duration-200 active:scale-95 hover:scale-[1.03] hover:bg-white/[0.11]"
            >
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center bg-gradient-to-br from-fuchsia-500 to-pink-700 shadow-md shadow-fuchsia-900/40">
                <ShoppingBag className="w-[18px] h-[18px] text-white" />
              </div>
              <span className="text-[10.5px] font-bold tracking-wide">المتجر</span>
            </button>

            {/* Camera Switch — Premium or Admin only */}
            {(() => {
              const canSwitch = (user as any)?.isPremium || (user as any)?.role === 'admin';
              return (
                <button
                  onClick={toggleCamera}
                  className={`flex flex-col items-center gap-2 pt-3 pb-2.5 rounded-[18px] transition-all duration-200 active:scale-95 ${canSwitch ? 'bg-amber-500/15 text-yellow-300 hover:scale-[1.03] hover:bg-amber-500/22' : 'bg-white/[0.04] text-white/35'}`}
                >
                  <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md relative ${canSwitch ? 'bg-gradient-to-br from-yellow-400 to-amber-600 shadow-amber-900/40' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
                    <SwitchCamera className={`w-[18px] h-[18px] ${canSwitch ? 'text-gray-900' : 'text-white/40'}`} />
                    {!canSwitch && <Lock className="w-2.5 h-2.5 text-white/50 absolute top-1 right-1" />}
                  </div>
                  <span className="text-[10.5px] font-bold tracking-wide leading-tight text-center">
                    {canSwitch ? (facingMode === 'user' ? 'خلفية' : 'أمامية') : 'تبديل 🔒'}
                  </span>
                </button>
              );
            })()}

            {/* Gift */}
            <button
              onClick={() => status === 'matched' ? setShowGifts(v => !v) : undefined}
              disabled={status !== 'matched'}
              className={`flex flex-col items-center gap-2 pt-3 pb-2.5 rounded-[18px] transition-all duration-200 active:scale-95 ${status === 'matched' ? 'bg-orange-500/15 text-orange-300 hover:scale-[1.03] hover:bg-orange-500/22' : 'bg-white/[0.04] text-white/25 cursor-not-allowed'}`}
            >
              <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md ${status === 'matched' ? 'bg-gradient-to-br from-orange-400 to-pink-600 shadow-orange-900/40' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
                <Gift className="w-[18px] h-[18px] text-white" />
              </div>
              <span className="text-[10.5px] font-bold tracking-wide">هدية</span>
            </button>
          </div>

          {/* ── Row 3 : ابدأ مباشرة · إبلاغ ─────────────── */}
          <div className="grid grid-cols-2 gap-2.5 pb-1">

            {/* Quick start / Stop */}
            {(() => {
              const isSearching = status === 'connecting' || status === 'waiting' || status === 'confirming';
              const isMatched   = status === 'matched';
              return (
                <button
                  onClick={() => {
                    if (isMatched)        { handleNext(); }
                    else if (isSearching) { stopSession(); }
                    else                  { 
                      if (filterCountry !== 'any' || filterGender !== 'any') {
                        startSession(filterGender, filterCountry);
                      } else {
                        startSession('any', 'any');
                      }
                    }
                  }}
                  className={`flex items-center justify-center gap-2.5 py-3.5 rounded-[18px] font-bold text-[13px] tracking-wide transition-all duration-200 active:scale-95 shadow-lg ${
                    isSearching
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-900/40 text-white animate-pulse hover:from-red-400 hover:to-rose-500'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-900/40 text-white hover:from-green-400 hover:to-emerald-500 hover:scale-[1.02]'
                  }`}
                >
                  {isSearching
                    ? <Square className="w-4 h-4 fill-white text-white" />
                    : <Play   className="w-4 h-4 fill-white text-white" />
                  }
                  {isSearching ? 'إيقاف البحث' : 'ابدأ مباشرة'}
                </button>
              );
            })()}

            {/* Star Radar Button */}
            <button
              onClick={() => {
                const isSearching = status === 'connecting' || status === 'waiting' || status === 'confirming';
                if (isSearching) {
                  stopSession();
                  toast.info("تم إيقاف البحث. اضغط على الرادار مرة أخرى لضبط الفلاتر.");
                  return;
                }
                setStatus('setup');
              }}
              className={`flex items-center justify-center gap-2.5 py-3.5 rounded-[18px] transition-all duration-200 active:scale-95 hover:scale-[1.02] font-bold text-[13px] tracking-wide ${filterCountry !== 'any' || filterGender !== 'any' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/[0.07] text-purple-300'}`}
            >
              <Zap className="w-4 h-4" />
              الرادار
            </button>
          </div>

        </div>

        {/* Divider before action row */}
        <div className="h-px bg-white/8 mx-3 mb-0" />

        {/* Next + End Call row */}
        <div className="flex items-stretch gap-2.5 px-3 pt-2 pb-3">
          {/* Next */}
          <button
            onClick={handleNext}
            disabled={status === 'connecting' || status === 'waiting' || status === 'confirming'}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[18px] bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-900 font-bold text-sm tracking-wide shadow-md shadow-amber-900/25 hover:brightness-105 hover:shadow-amber-900/35 disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.97] transition-all duration-150"
          >
            <SkipForward className="w-4 h-4 flex-shrink-0" />
            التالي — شخص جديد
          </button>

          {/* End Call */}
          <button
            onClick={handleEnd}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-[18px] bg-gradient-to-br from-red-500 to-rose-600 text-white font-bold text-sm shadow-md shadow-red-900/30 hover:brightness-105 active:scale-[0.97] transition-all duration-150"
          >
            <PhoneOff className="w-4 h-4 flex-shrink-0" />
            <span className="tracking-wide">إنهاء</span>
          </button>
        </div>
      </div>

      {showGifts && (
        <GiftPanel credits={credits} onSend={sendGift} onClose={() => setShowGifts(false)} disabled={spendGift.isPending} />
      )}

      {/* ── Convert Stars Modal ─────────────────────────────────────── */}
      {showConvertModal && (() => {
        const stars = walletQuery.data?.wallet || 0;
        const gains = Math.floor(stars / 2);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowConvertModal(false)}>
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg text-2xl">⭐</div>
                <div>
                  <h3 className="text-white font-black text-lg">تحويل النجوم</h3>
                  <p className="text-white/50 text-xs">نجومك تساوي نقاطاً قيّمة</p>
                </div>
              </div>

              {/* Exchange rate card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5 flex items-center justify-between gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-black text-purple-300">{stars}</span>
                  <span className="text-[11px] text-purple-400 font-bold">⭐ نجوم</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-white/40">
                  <span className="text-xl">→</span>
                  <span className="text-[10px]">معدل 2:1</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-black text-yellow-300">{gains}</span>
                  <span className="text-[11px] text-yellow-400 font-bold">⚡ نقطة</span>
                </div>
              </div>

              {stars < 2 ? (
                <div className="text-center text-white/50 text-sm mb-5">
                  لا يكفي نجوم للتحويل (الحد الأدنى نجمتان)
                </div>
              ) : (
                <p className="text-white/60 text-sm text-center mb-5">
                  ستتحول <span className="text-purple-300 font-bold">{stars} نجمة</span> إلى <span className="text-yellow-300 font-bold">{gains} نقطة</span> وتُضاف لرصيدك فوراً
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/8 hover:bg-white/12 text-white/70 font-bold text-sm transition-all active:scale-95"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => { convertStars.mutate({ amount: stars }); setShowConvertModal(false); }}
                  disabled={stars < 2 || convertStars.isPending}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-purple-900/40 disabled:opacity-40 transition-all active:scale-95 hover:brightness-110"
                >
                  {convertStars.isPending ? '...' : 'تحويل الآن ✓'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
          friends={(dbFriends || []).map((f: any) => ({
            id: String(f.id),
            name: f.name || 'مستخدم',
            avatar: f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.id}`,
            status: f.isOnline ? 'online' : 'offline',
            lastSeen: f.lastSeen ? new Date(f.lastSeen).toLocaleString('ar') : '',
          }))}
          onClose={() => setShowFriends(false)}
          onStartChat={(friend) => { setDmTarget({ id: Number(friend.id), name: friend.name, avatar: friend.avatar }); setShowFriends(false); }}
          currentPeerName={peerName}
          currentPeerAvatar={peerAvatar}
          currentPeerId={status === 'matched' ? 'peer_current' : undefined}
          myPeerId={myId}
          onFriendAccepted={() => refetchFriends()}
          onSendFriendRequest={() => {
            const peerUserId = (window as any).currentPeerUserId;
            signal('friend-request', { 
              senderName: myName, 
              senderAvatar: myAvatar,
              fromUserId: (user as any)?.id
            });
            if (peerUserId) {
              sendFriendRequestMutation.mutate({ receiverId: peerUserId });
            }
          }}
        />
      )}

      {dmTarget && (
        <DirectMessagePanel
          friendId={dmTarget.id}
          friendName={dmTarget.name}
          friendAvatar={dmTarget.avatar}
          onClose={() => setDmTarget(null)}
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
              if (friendReqBanner.fromUserId) {
                acceptFriendRequestMutation.mutate({ senderId: friendReqBanner.fromUserId });
              }
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
