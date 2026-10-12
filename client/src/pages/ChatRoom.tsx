import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import CircularIconButton from '@/components/CircularIconButton';
import { useLocation } from 'wouter';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff, SkipForward,
  Flag, Volume2, VolumeX, Send, MessageSquare, X,
  SwitchCamera, Lock, Gift, Bell, Star, Search, ShoppingBag, Zap,
  Users, UserRound, Heart, ChevronLeft, Globe, Bot, WandSparkles, Play, Square
} from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import GiftPanel, { GIFTS, type GiftItem } from '@/components/GiftPanel';
import TranslationPanel from '@/components/TranslationPanel';
import FaceFiltersPanel from '@/components/FaceFiltersPanel';
import FriendsPanel from '@/components/FriendsPanel';
import DirectMessagePanel from '@/components/DirectMessagePanel';
import UserProfileModal from '@/components/UserProfileModal';
import VerifiedBadge from '@/components/VerifiedBadge';
import PremiumMessageBubble from "@/components/PremiumMessageBubble";
import AIStudio from "@/components/AIStudio";
import { playMessageSound, playFriendSound, playRingSound } from '@/lib/notificationSound';
import { toast } from 'sonner';

// ── ICE config with TURN servers for 4G/5G mobile networks ───────────────────
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
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
  const { t: translate, isRTL } = useTranslation();
  const t = (key: string) => translate(key);
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const { mutateAsync: createStreamToken } = trpc.auth.createStreamToken.useMutation();

  const myName    = (user as any)?.name    || (isRTL ? 'أنت' : 'You');
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
  const [peerUserId,   setPeerUserId]  = useState<number | null>(null);
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
  const [showAIStudio, setShowAIStudio] = useState(false);
  const [showFaceFilters, setShowFaceFilters] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [viewProfileUserId, setViewProfileUserId] = useState<number | null>(null);
  const [dmTarget, setDmTarget] = useState<{ id: number; name: string; avatar: string } | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showDailyBonus, setShowDailyBonus] = useState(true);
  const [bonusCountdown, setBonusCountdown] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const { data: dbFriends, refetch: refetchFriends } = trpc.social.getFriends.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
  const { data: incomingFriendRequests } = trpc.social.getIncomingRequests.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
  const { data: peerProfile } = trpc.users.getPublicProfile.useQuery(peerUserId ?? 0, {
    enabled: !!peerUserId,
    staleTime: 30_000,
  });
  const { data: unreadDmData, refetch: refetchUnread } = trpc.messages.getUnreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 15_000,
  });
  const unreadDmCount = unreadDmData?.count ?? 0;
  const incomingFriendRequestCount = incomingFriendRequests?.length ?? 0;
  const sendFriendRequestMutation = trpc.social.sendRequest.useMutation({
    onSuccess: (result, variables) => {
      toast.success('تم إرسال طلب الصداقة بنجاح');
      utils.social.getFriendStatus.setData(variables.receiverId, { status: result.status });
    },
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

  // Friend requests need a visible signal even when the notification bell is
  // not open. Do not toast the initial list; only announce newly arrived ones.
  const previousFriendRequestCountRef = useRef(0);
  useEffect(() => {
    if (incomingFriendRequests === undefined) return;
    if (
      previousFriendRequestCountRef.current > 0 &&
      incomingFriendRequestCount > previousFriendRequestCountRef.current
    ) {
      const added = incomingFriendRequestCount - previousFriendRequestCountRef.current;
      playFriendSound();
      toast(`لديك ${added} ${added === 1 ? 'طلب صداقة جديد' : 'طلبات صداقة جديدة'} 🤝`, {
        description: 'افتح قائمة الأصدقاء لرؤية الطلب وقبوله',
        duration: 6000,
      });
    }
    previousFriendRequestCountRef.current = incomingFriendRequestCount;
  }, [incomingFriendRequests, incomingFriendRequestCount]);

  const [friendReqBanner, setFriendReqBanner] = useState<{name:string;avatar:string;fromPeerId?:string;fromUserId?:number} | null>(null);
  const [lastIncomingMsg, setLastIncomingMsg] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);

  // ── notification ───────────────────────────────────────────────────────────
  const [notif, setNotif] = useState<Notif | null>(null);

  // ── refs ───────────────────────────────────────────────────────────────────
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const adminWatchPcRef  = useRef<RTCPeerConnection | null>(null);
  const recorderRef      = useRef<MediaRecorder | null>(null);
  const recSessionRef    = useRef<string | null>(null);
  const rafRef           = useRef<number | null>(null);
  const recCanvasRef     = useRef<HTMLCanvasElement | null>(null);
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

  const bonusStatusQuery = trpc.users.getBonusStatus.useQuery(undefined, { 
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const claimBonus = trpc.users.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      const rewardToastId = 'daily-bonus-success';
      toast.dismiss(rewardToastId);
      toast.success(
        `مبروك! حصلت على ${data.starsGained} نجوم و ${data.creditsGained} نقاط 🎁`,
        {
          id: rewardToastId,
          position: 'top-center',
          duration: 3500,
          description: 'تمت إضافة المكافأة إلى حسابك بنجاح',
        },
      );
      window.setTimeout(() => toast.dismiss(rewardToastId), 4000);
      bonusStatusQuery.refetch();
      walletQuery.refetch();
      balanceQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const { data: notifications } = trpc.notifications.get.useQuery(undefined, { 
    enabled: !!user,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const updateTimer = () => {
      if (!bonusStatusQuery.data) {
        setBonusCountdown(null);
        return;
      }
      
      const { canClaim, nextAvailable } = bonusStatusQuery.data;
      
      if (canClaim || !nextAvailable) {
        setBonusCountdown(null);
      } else {
        const nextTime = new Date(nextAvailable).getTime();
        const now = Date.now();
        const remaining = nextTime - now;
        
        if (remaining <= 0) {
          setBonusCountdown(null);
          bonusStatusQuery.refetch();
        } else {
          const hours = Math.floor(remaining / (60 * 60 * 1000));
          const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          const secs = Math.floor((remaining % (60 * 1000)) / 1000);
          setBonusCountdown(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [bonusStatusQuery.data]);

  const bonusLoading = bonusStatusQuery.isLoading;
  const bonusCoolingDown = Boolean(bonusCountdown);
  const bonusDisabled = bonusLoading || bonusCoolingDown || claimBonus.isPending;

  useEffect(() => { if (balanceQuery.data) setCredits(balanceQuery.data.credits); }, [balanceQuery.data]);

  // We no longer auto-fill country filter to avoid locking users into same-country matching by default.
  // This ensures "ابدأ مباشرة" (Quick Start) works globally unless user explicitly chooses a country.
  /* 
  useEffect(() => {
    if (myCountry) {
      setFilterCountry(myCountry);
    }
  }, [myCountry]); 
  */

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
  const closePC     = useCallback(() => {
    stopRecording(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    pcRef.current?.close();
    pcRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resetRemote = useCallback(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setPeerName(''); setPeerAvatar(''); setPeerUserId(null); setPeerVideoOff(false);
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

  // ── Recording helpers ──────────────────────────────────────────────────────
  const stopRecording = useCallback((isFinal = false) => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
      recorderRef.current = null;
    }
    if (!isFinal) recSessionRef.current = null;
  }, []);

  const startRecording = useCallback((remoteStream: MediaStream) => {
    if (!localStreamRef.current) return;
    try {
      stopRecording(false);
      const sessionId = `rec_${myId}_${Date.now()}`;
      recSessionRef.current = sessionId;

      // Canvas composite: remote full-screen + local PiP
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 360;
      recCanvasRef.current = canvas;
      const ctx = canvas.getContext('2d')!;

      const drawFrame = () => {
        try {
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, 640, 360);
          const rv = remoteVideoRef.current;
          const lv = localVideoRef.current;
          if (rv && rv.readyState >= 2 && !rv.paused) ctx.drawImage(rv, 0, 0, 640, 360);
          if (lv && lv.readyState >= 2 && !lv.paused) {
            ctx.drawImage(lv, 488, 250, 144, 102);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.strokeRect(488, 250, 144, 102);
          }
        } catch {}
        rafRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      // Audio mixing via AudioContext
      let combinedStream = canvas.captureStream(15);
      try {
        const actx = new AudioContext();
        const dest = actx.createMediaStreamDestination();
        const localAudio = localStreamRef.current.getAudioTracks();
        const remoteAudio = remoteStream.getAudioTracks();
        if (localAudio.length) {
          const src1 = actx.createMediaStreamSource(new MediaStream(localAudio));
          src1.connect(dest);
        }
        if (remoteAudio.length) {
          const src2 = actx.createMediaStreamSource(new MediaStream(remoteAudio));
          src2.connect(dest);
        }
        dest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
      } catch { /* no audio mixing — video only */ }

      // Choose supported mimeType
      const mimeType = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';

      const chunks: Blob[] = [];
      const rec = new MediaRecorder(combinedStream, mimeType ? { mimeType } : {});
      recorderRef.current = rec;

      const sendChunks = async (blob: Blob, final = false) => {
        const sid = sessionId;
        if ((!final && blob.size < 100) || !sid) return;
        try {
          const params = new URLSearchParams({
            sessionId: sid, peerId: myId,
            name1: myName || '؟', name2: (window as any).peerNameForRec || '؟',
            isFinal: String(final),
          });
          const response = await fetch(`/api/record/chunk?${params}`, {
            method: 'POST',
            headers: { 'Content-Type': 'video/webm' },
            body: blob,
          });
          if (!response.ok) {
            throw new Error(`recording upload failed (${response.status})`);
          }
        } catch {}
      };
      let uploadQueue = Promise.resolve();
      const queueChunk = (blob: Blob, final = false) => {
        const nextUpload = uploadQueue.then(() => sendChunks(blob, final));
        uploadQueue = nextUpload.then(() => undefined, () => undefined);
        return nextUpload;
      };

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
        if (chunks.length >= 3) {
          const blob = new Blob(chunks.splice(0), { type: mimeType || 'video/webm' });
          void queueChunk(blob);
        }
      };

      rec.onstop = async () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks.splice(0), { type: mimeType || 'video/webm' });
          await queueChunk(blob, true);
        } else {
          // Send final signal with empty body to close the meta
          await queueChunk(new Blob([''], { type: 'video/webm' }), true);
        }
        if (recSessionRef.current === sessionId) {
          recSessionRef.current = null;
        }
      };

      rec.start(5000); // collect 5-second chunks
    } catch (err) {
      console.warn('[rec] failed to start recording', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, myName, stopRecording]);

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
        // Start recording automatically when remote video stream arrives
        if (e.streams[0].getVideoTracks().length > 0) {
          setTimeout(() => startRecording(e.streams[0]), 500);
        }
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
    setPeerUserId(match.userId ?? null);
    (window as any).currentPeerUserId = match.userId;
    (window as any).peerNameForRec = match.name;
    setPendingMatch(null);
    setStatus('matched'); startTimer(); setNotif(null);
  }, [startTimer]);

  // ── SSE event handler ──────────────────────────────────────────────────────
    const handleEvent = useCallback(async (msg: any) => {
    console.log(`[SSE Event] Received: ${msg.type}`, msg);
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
      case 'accept-match': {
        // Partner already accepted — if we are still on the confirming screen, 
        // it means we haven't clicked accept yet, but we should prepare the PC.
        if (pendingMatchRef.current) {
          // We don't auto-finalize here to let the user click Accept, 
          // but we ensure the PC is ready if they do.
          createPC();
        }
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
        stopRecording(true);
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
        toast.error(msg.message || 'رصيد نقاط غير كافٍ لاستخدام الرادار');
        walletQuery.refetch();
        balanceQuery.refetch();
        setTimeout(() => setLocation('/store'), 1500);
        break;

      case 'admin-watch-request': {
        // Admin requests to watch this peer's stream silently
        const { watcherId } = msg;
        if (!localStreamRef.current || !watcherId) break;
        try {
          adminWatchPcRef.current?.close();
          const watchPc = new RTCPeerConnection(ICE_CONFIG);
          adminWatchPcRef.current = watchPc;
          localStreamRef.current.getTracks().forEach(t =>
            watchPc.addTrack(t, localStreamRef.current!)
          );
          watchPc.onicecandidate = (e) => {
            if (!e.candidate) return;
            fetch('/api/signal/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ peerId: myId, type: 'admin-watch-ice', data: { candidate: e.candidate, watcherId } }),
            }).catch(() => {});
          };
          const offer = await watchPc.createOffer();
          await watchPc.setLocalDescription(offer);
          await fetch('/api/signal/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peerId: myId, type: 'admin-watch-offer', data: { offer, watcherId } }),
          });
        } catch { /* silent — must never disrupt main call */ }
        break;
      }
      case 'admin-watch-answer':
        try { await adminWatchPcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.data)); } catch {}
        break;
      case 'admin-watch-ice-to-peer':
        try { await adminWatchPcRef.current?.addIceCandidate(new RTCIceCandidate(msg.data)); } catch {}
        break;
      case 'admin-watch-stop':
        adminWatchPcRef.current?.close();
        adminWatchPcRef.current = null;
        break;
    }
  }, [createPC, signal, addMessage, startTimer, stopTimer, closePC, resetRemote, showGiftAnim, peerName, walletQuery, setLocation]);

  const deductRadarCredits = trpc.gifts.deductRadarCredits.useMutation();

  // ── start session (called after filter screen) ────────────────────────────
  const startSession = useCallback(async (fg: string, fc: string) => {
    // Radar logic: free for "any" gender + own/any country; paid otherwise (100 points)
    const isPaidRadar = fg !== 'any' || (fc !== 'any' && fc !== myCountry);
    const isAdminUser = (user as any)?.role === 'admin';
    if (isPaidRadar && !(user as any)?.isPremium && !isAdminUser) {
      const userCredits = balanceQuery.data?.credits || 0;
      if (userCredits < 100) {
        toast.error(`رصيدك ${userCredits} نقطة فقط. تحتاج 100 نقطة لاستخدام الرادار. يرجى الشحن أولاً.`);
        setLocation('/store');
        return;
      }
      // Deduct credits immediately on start
      try {
        await deductRadarCredits.mutateAsync({ amount: 100 });
        toast.success("تم خصم 100 نقطة لتفعيل الرادار 🌟");
        balanceQuery.refetch();
      } catch (err: any) {
        toast.error(err.message || "رصيد نقاط غير كافٍ");
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
      filterGender: fg,
      filterCountry: fc,
    });
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const connect = async () => {
      if (destroyedRef.current) return;
      console.log(`[SSE] Connecting to /api/signal/connect with params: ${params.toString()}`);
      let es: EventSource;
      try {
        const { token } = await createStreamToken();
        if (destroyedRef.current) return;
        const streamUrl = new URL(
          `${import.meta.env.VITE_REALTIME_API_URL || ""}/api/signal/connect`,
          window.location.origin,
        );
        params.set("streamToken", token);
        streamUrl.search = params.toString();
        es = new EventSource(streamUrl.toString());
      } catch (error) {
        console.error("[SSE] Could not authorize a realtime connection", error);
        if (!destroyedRef.current) window.setTimeout(() => void connect(), 3000);
        return;
      }
      esRef.current = es;
      
      let pingTimeout: ReturnType<typeof setTimeout>;
      const resetPingTimeout = () => {
        clearTimeout(pingTimeout);
        pingTimeout = setTimeout(() => {
          console.warn("[SSE] No ping received for 45s, reconnecting...");
          es.close();
          connect();
        }, 45000);
      };
      
      es.onmessage = (e) => { 
        resetPingTimeout();
        if (e.data === ': ping') return;
        console.log(`[SSE Raw Data] ${e.data}`);
        try { handleEvent(JSON.parse(e.data)); } catch (err) { console.error("[SSE Parse Error]", err); } 
      };
      
      es.onerror = (err) => {
        console.error("[SSE Error]", err);
        clearTimeout(pingTimeout);
        es.close();
        if (!destroyedRef.current) {
          console.log("[SSE] Connection lost, reconnecting in 3s...");
          setTimeout(connect, 3000);
        }
      };
      
      resetPingTimeout();
    };
    connect();
  }, [myId, myName, myAvatar, myGender, myCountry, handleEvent, user, balanceQuery, deductRadarCredits, setLocation, createStreamToken]);

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
    // حفظ الصوت قبل أي شيء
    const audioTracks = localStreamRef.current.getAudioTracks();

    try {
      // الخطوة 1: إيقاف الكاميرا القديمة أولاً
      // (الهاتف لا يسمح بفتح كاميرتين في نفس الوقت)
      localStreamRef.current.getVideoTracks().forEach(t => t.stop());

      // الخطوة 2: تحديد الكاميرا المطلوبة
      let videoConstraint: MediaTrackConstraints = { facingMode: newMode };

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        if (videoDevices.length > 1) {
          // ابحث عن الكاميرا المطلوبة حسب الاسم أولاً
          const target = videoDevices.find(d => {
            const lbl = d.label.toLowerCase();
            return newMode === 'environment'
              ? lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment')
              : lbl.includes('front') || lbl.includes('user') || lbl.includes('face');
          });
          if (target) {
            videoConstraint = { deviceId: { exact: target.deviceId } };
          } else {
            // لم نجد بالاسم — خذ الأولى للأمامية والأخيرة للخلفية
            const idx = newMode === 'environment' ? videoDevices.length - 1 : 0;
            videoConstraint = { deviceId: { exact: videoDevices[idx].deviceId } };
          }
        }
      } catch {
        // enumerateDevices فشل — نكتفي بـ facingMode
      }

      // الخطوة 3: فتح الكاميرا الجديدة بعد إغلاق القديمة
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false,
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];

      // الخطوة 4: استبدال المسار في WebRTC
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) await videoSender.replaceTrack(newVideoTrack);
      }

      // الخطوة 5: دمج الفيديو الجديد مع الصوت المحفوظ
      const combinedStream = new MediaStream([newVideoTrack, ...audioTracks]);
      localStreamRef.current = combinedStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = combinedStream;

      setFacingMode(newMode);
      setIsVideoOn(true);
      toast.success(newMode === 'user' ? "📷 الكاميرا الأمامية" : "📷 الكاميرا الخلفية");
    } catch (e) {
      console.error("Failed to switch camera:", e);
      // حاول استعادة الكاميرا الأمامية إذا فشل التبديل
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        const combinedStream = new MediaStream([fallback.getVideoTracks()[0], ...audioTracks]);
        localStreamRef.current = combinedStream;
        if (localVideoRef.current) localVideoRef.current.srcObject = combinedStream;
        setFacingMode('user');
        setIsVideoOn(true);
      } catch { /* الكاميرا غير متاحة */ }

      const isAdminFail = (user as any)?.role === 'admin';
      if (!isAdminFail) {
        sessionStorage.setItem('chat_auto_start', 'true');
        setLocation('/store?from=chat');
      } else {
        toast.error("الجهاز لا يدعم تبديل الكاميرا أثناء المكالمة");
      }
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
    
    // Notify the other peer that we have accepted
    signal('accept-match');

    const pc = pcRef.current || createPC();
    if (match.role === 'caller') {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal('offer', offer);
    }
  }, [finalizeMatch, createPC, signal]);
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
                {!(user as any)?.isPremium && (user as any)?.role !== 'admin' && filterGender !== 'any' && (
                  <span className="text-[10px] bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> 100 نقطة
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
                          ? 'border-violet-300/40 bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md shadow-violet-950/20'
                        : 'border-violet-300/25 bg-violet-500/10 text-violet-100 hover:border-violet-300/45 hover:bg-violet-500/20'
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
                {(user as any)?.isPremium || (user as any)?.role === 'admin' ? (
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
              
              {!(user as any)?.isPremium && (user as any)?.role !== 'admin' && filterCountry !== 'any' && filterCountry !== myCountry && (
                <p className="text-yellow-400 text-[11px] mt-1.5 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> استخدام الرادار سيكلفك 100 نقطة
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
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm truncate">{myName}</p>
                <div className="flex items-center gap-2">
                  <p className="text-white/50 text-xs">
                    {myGender === 'male' ? 'ذكر' : myGender === 'female' ? 'أنثى' : 'غير محدد'}
                  </p>
                  <span className="w-1 h-1 bg-white/20 rounded-full" />
                  <p className="text-yellow-400 text-xs font-bold flex items-center gap-0.5">
                    <Zap className="w-3 h-3" />
                    {credits} نقطة
                  </p>
                </div>
              </div>
              <span className="mr-auto text-xs text-green-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
                متصل
              </span>
            </div>

            {/* Start button */}
            {!(user as any)?.isPremium && (user as any)?.role !== 'admin' && (filterGender !== 'any' || (filterCountry !== 'any' && filterCountry !== myCountry)) && (
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-white/60 text-xs font-medium">تكلفة البحث المخصص:</span>
                <span className="text-yellow-400 text-sm font-black flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  100 نقطة
                </span>
              </div>
            )}
            <button
              onClick={() => startSession(filterGender, filterCountry)}
              className={`flex w-full items-center justify-center gap-3 rounded-full py-4 text-lg font-bold tracking-wide text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] ${filterGender !== 'any' || (filterCountry !== 'any' && filterCountry !== myCountry) ? 'border border-violet-300/35 bg-gradient-to-r from-violet-700 to-purple-600 shadow-violet-950/20' : 'border border-emerald-300/35 bg-gradient-to-r from-emerald-600 to-green-700 shadow-emerald-950/20'}`}
            >
              <Video className="w-5 h-5" />
              {(filterGender === 'any' && (filterCountry === 'any' || filterCountry === myCountry)) ? 'ابدأ البحث الآن' : 'تفعيل رادار النقاط 🚀'}
            </button>

            <button
              onClick={() => setStatus('idle')}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/10 py-2 text-sm text-violet-200 transition-colors hover:bg-violet-500/20 hover:text-white"
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
          <button onClick={() => setNotif(null)} aria-label="إغلاق التنبيه" className="flex-shrink-0 rounded-full bg-red-500/15 p-1 text-red-200 transition hover:bg-red-500/25 hover:text-white">
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
            <h2 className="flex items-center justify-center gap-1.5 text-white font-bold text-xl mb-1">
              <span>{pendingMatch.name}</span>
              {pendingMatch.userId && peerProfile?.isVerified && <VerifiedBadge size={18} />}
            </h2>
            <p className="text-purple-300 text-sm mb-6 animate-pulse">📞 جاري الاتصال...</p>
            <div className="flex gap-4 w-full">
              <button
                onClick={handleRejectMatch}
                className="flex-1 flex flex-col items-center gap-1.5 rounded-2xl bg-red-600 py-3.5 font-bold text-white shadow-md shadow-red-950/20 transition-all hover:bg-red-700 active:scale-[0.98]"
              >
                <PhoneOff className="w-6 h-6" />
                رفض
              </button>
              <button
                onClick={handleAcceptMatch}
                className="flex-1 flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-700 py-3.5 font-bold text-white shadow-md shadow-emerald-950/20 transition-all hover:bg-emerald-800 active:scale-[0.98]"
              >
                <Video className="w-6 h-6" />
                قبول
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 px-2">
        {/* Top Row: Profile + Title + Wallet (Flexbox with proper spacing) */}
        <div className="flex items-flex-start justify-between gap-3">
          {/* Left: Profile */}
          <button onClick={() => setLocation('/profile')}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-blue-300/25 bg-blue-500/10 px-2 py-1 text-blue-100 transition-colors hover:border-blue-300/45 hover:bg-blue-500/20">
            <div className="relative flex-shrink-0">
              <img src={myAvatar} alt={myName} className="w-8 h-8 rounded-full border-2 border-white/30 object-cover bg-white shadow-lg" />
              {(user as any)?.isPremium && (
                <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 border-2 border-gray-900 shadow">
                  <Star className="w-2 h-2 text-gray-900 fill-gray-900" />
                </div>
              )}
            </div>
            <div className="flex flex-col items-start flex-shrink-0">
              <span className="text-xs font-bold truncate max-w-[60px] flex items-center gap-0.5">
                {myName}
                {(user as any)?.isPremium && <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
              </span>
              <span className="text-[9px] opacity-50">ملفي</span>
            </div>
          </button>

          {/* Center: Title - Centered and takes available space */}
          <div className="text-center flex-1 px-2 py-1">
            <h1 className="text-base font-bold text-white leading-tight">غرفة الدردشة</h1>
            <p className={`text-[10px] mt-1 font-semibold ${status === 'matched' ? 'text-green-400' : 'text-yellow-300 animate-pulse'}`}>
              {status === 'matched' ? `${peerName} · ${statusLabel}` : statusLabel}
            </p>
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
                className="flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-500/15 px-2 py-1 shadow-sm transition-colors hover:bg-amber-500/25"
              >
                <Star className="w-3 h-3 text-purple-400 fill-purple-400" />
                <span className="text-purple-300 text-[11px] font-black">{walletQuery.data?.wallet || 0}</span>
                <span className="text-purple-500 text-[9px]">⭐</span>
              </button>

              {/* Credits */}
              <button
                onClick={() => setLocation('/store')}
                className="flex items-center gap-1 rounded-full border border-orange-300/35 bg-orange-500/15 px-2 py-1 shadow-sm transition-colors hover:bg-orange-500/25"
              >
                <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-300 text-[11px] font-black">{credits}</span>
              </button>
            </div>

            {/* Row 2: Daily Bonus compact card */}
            {showDailyBonus && (
              <button
                onClick={() => !bonusDisabled && claimBonus.mutate()}
                disabled={bonusDisabled}
                className={`relative flex items-center gap-2 px-3 py-0 h-[42px] w-[115px] rounded-2xl
                           backdrop-blur-md border transition-all duration-150 overflow-hidden flex-shrink-0
                           ${bonusDisabled
                             ? 'border-amber-300/15 bg-amber-500/10 opacity-60 cursor-not-allowed'
                             : 'bg-gradient-to-r from-orange-500/80 to-amber-400/80 border-orange-300/25 shadow-sm shadow-orange-900/20 active:scale-[0.97] hover:brightness-110'
                           }`}
              >
                {/* Glassmorphism sheen */}
                <span className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent pointer-events-none rounded-2xl" />

                {/* Gift icon with glow */}
                <span
                  className={`text-[20px] leading-none flex-shrink-0 relative z-10 ${bonusCountdown ? 'opacity-60' : ''}`}
                  style={{ filter: bonusDisabled ? 'none' : 'drop-shadow(0 0 3px rgba(255,200,50,0.4))' }}
                >🎁</span>

                {/* Text */}
                <div className="flex flex-col leading-tight relative z-10">
                  <span className="text-white font-black text-[11px] tracking-wide">مكافأة</span>
                  <span className="text-white/65 text-[9px]">
                    {claimBonus.isPending ? 'جاري الاستلام...' : bonusLoading ? 'جاري التحقق...' : bonusCountdown ? bonusCountdown : 'اضغط للاستلام'}
                  </span>
                </div>

                {/* Red pulse dot - only show when claimable */}
                {!bonusDisabled && (
                  <span className="absolute top-1.5 left-1.5 flex h-2 w-2 z-20">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Filter Tags Row - Centered below title */}
        {(filterGender !== 'any' || filterCountry !== 'any') && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {filterGender !== 'any' && (
              <span className="bg-purple-600/70 text-white text-[9px] px-2 py-1 rounded-full">
                {filterGender === 'male' ? 'ذكر' : 'أنثى'}
              </span>
            )}
            {filterCountry !== 'any' && (
              <span className="bg-pink-600/70 text-white text-[9px] px-2 py-1 rounded-full">
                {COUNTRIES.find(c => c.code === filterCountry)?.name.split(' ')[0] || filterCountry}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        {/* Videos */}
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Remote video */}
          <div className="relative h-[68vw] min-h-[270px] max-h-[330px] md:h-auto md:min-h-[220px] md:max-h-none bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <video ref={remoteVideoRef} autoPlay playsInline
              className={`w-full h-full object-cover ${(status !== 'matched' || peerVideoOff) ? 'hidden' : ''}`}
              style={{ transform: 'scaleX(-1)', maxHeight: 340 }}
            />
            {(status !== 'matched' || peerVideoOff) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {status === 'matched' ? (
                  <>
                    <div
                      className="relative mb-3 cursor-pointer"
                      onClick={() => { const uid = (window as any).currentPeerUserId; if (uid) setViewProfileUserId(uid); }}
                      title="عرض الملف الشخصي"
                    >
                      {peerAvatar
                        ? <img src={peerAvatar} alt={peerName} className="w-24 h-24 rounded-full border-4 border-purple-400/60 bg-white object-cover hover:border-purple-400 transition-colors shadow-xl" />
                        : <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl">👤</div>}
                      <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md" />
                    </div>
                     <button
                       className="flex items-center justify-center gap-1.5 text-white font-semibold text-lg hover:text-purple-300 transition-colors"
                      onClick={() => { const uid = (window as any).currentPeerUserId; if (uid) setViewProfileUserId(uid); }}
                    >
                       <span>{peerName}</span>
                       {peerProfile?.isVerified && <VerifiedBadge size={18} />}
                    </button>
                    <p className="text-white/50 text-sm mt-1">اضغط لعرض الملف الشخصي</p>
                  </>
                ) : status === 'idle' ? (
                  /* ── Idle: promotional looping video ── */
                  <>
                    {/* Looping background promo video */}
                    <video
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ opacity: 0.55 }}
                      onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                    >
                      <source src="/promo.mp4" type="video/mp4" />
                    </video>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30 pointer-events-none" />

                    {/* CTA content */}
                    <div className="relative z-10 text-center px-4 flex flex-col items-center gap-2 mt-auto mb-6">


                      <p className="text-white font-bold text-base drop-shadow-lg leading-snug">
                        اضغط <span className="text-green-400">ابدأ مباشرة</span> للبدء
                      </p>
                      <p className="text-white/65 text-xs drop-shadow">
                        🟢 آلاف المستخدمين يتحدثون الآن
                      </p>
                    </div>
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
          <div className="relative h-[42vw] min-h-[165px] max-h-[190px] md:h-[130px] md:min-h-0 md:max-h-none bg-gray-700 rounded-2xl overflow-hidden shadow-xl border border-white/10">
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
              <span className="text-white font-semibold text-sm">{t('chat.chat_btn')}</span>
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
                  <Bot className="w-4 h-4" />
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
              <button onClick={() => setShowChat(false)} aria-label="إغلاق الدردشة" className="rounded-full bg-red-500/10 p-1.5 text-red-300 transition hover:bg-red-500/20 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {messages.length === 0 && <p className="text-white/30 text-xs text-center mt-4">{t('chat.no_messages') || 'No messages yet'}</p>}
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
                placeholder={t('chat.type_msg') || 'Type a message...'} dir={isRTL ? 'rtl' : 'ltr'}
                className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              />
              <button onClick={sendText} aria-label="إرسال الرسالة" className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[0.96]">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Circular controls ─────────────────────────────────────────────── */}
      <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-gray-900/85 shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
        <div className="space-y-3 px-2.5 py-3 sm:px-4 md:space-y-4 md:py-4">
          {/* Chat and media */}
          <div className="grid grid-cols-4 justify-items-center gap-x-1.5 gap-y-3 sm:gap-x-3">
            <CircularIconButton
              icon={<MessageSquare />}
              label={t('chat.chat_btn')}
              active={showChat}
              pressed={showChat}
              intent="chat"
              onClick={() => { setShowChat(v => !v); setUnread(0); }}
              badge={unread > 0 ? <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-gray-950 bg-rose-500 px-1 text-[9px] font-bold text-white">{unread}</span> : null}
            />
            <CircularIconButton
              icon={isSpeakerOn ? <Volume2 /> : <VolumeX />}
              label={isSpeakerOn ? t('chat.audio') : (t('chat.mute') || 'Mute')}
              active={isSpeakerOn}
              pressed={isSpeakerOn}
              intent="audio"
              onClick={() => setIsSpeakerOn(v => !v)}
            />
            <CircularIconButton
              icon={isVideoOn ? <Video /> : <VideoOff />}
              label={isVideoOn ? t('chat.cam') : (t('chat.off') || 'Off')}
              active={isVideoOn}
              pressed={isVideoOn}
              intent="camera"
              onClick={toggleVideo}
            />
            <CircularIconButton
              icon={isMicOn ? <Mic /> : <MicOff />}
              label={isMicOn ? t('chat.mic') : (t('chat.muted') || 'Muted')}
              active={isMicOn}
              pressed={isMicOn}
              intent="mic"
              onClick={toggleMic}
            />
          </div>

          <div className="mx-2 h-px bg-white/[0.08]" />

          {/* Social and extra tools */}
          <div className="grid grid-cols-4 justify-items-center gap-x-1.5 gap-y-3 sm:gap-x-3">
            <CircularIconButton
              icon={<Heart />}
              label={t('chat.friends')}
              active={showFriends}
              pressed={showFriends}
              intent="friends"
              onClick={() => { setShowFriends(v => !v); refetchUnread(); }}
              badge={
                <>
                  {unreadDmCount > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-gray-950 bg-amber-400 px-1 text-[9px] font-bold text-gray-950">{unreadDmCount > 99 ? '99+' : unreadDmCount}</span>}
                  {incomingFriendRequestCount > 0 && <span className="absolute -bottom-1 -left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-gray-950 bg-rose-500 px-1 text-[9px] font-bold text-white">{incomingFriendRequestCount > 99 ? '99+' : incomingFriendRequestCount}</span>}
                </>
              }
            />
            <CircularIconButton
              icon={<ShoppingBag />}
              label={t('chat.store')}
              intent="store"
              onClick={() => { sessionStorage.setItem('chat_auto_start', 'true'); setLocation('/store?from=chat'); }}
            />
            {(() => {
              const canSwitch = (user as any)?.isPremium || (user as any)?.role === 'admin';
              return (
                <CircularIconButton
                  icon={<><SwitchCamera />{!canSwitch && <Lock className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-gray-900 p-0.5 text-white/70" />}</>}
                  label={canSwitch ? (facingMode === 'user' ? 'خلفية' : 'أمامية') : 'تبديل 🔒'}
                  onClick={toggleCamera}
                  active={canSwitch && facingMode !== 'user'}
                  pressed={canSwitch && facingMode !== 'user'}
                  intent="background"
                />
              );
            })()}
            <CircularIconButton
              icon={<Gift />}
              label="هدية"
              onClick={() => status === 'matched' ? setShowGifts(v => !v) : undefined}
              disabled={status !== 'matched'}
              active={showGifts}
              pressed={showGifts}
              intent="gift"
            />
            <CircularIconButton
              className="col-span-2 col-start-2 w-full"
              icon={<WandSparkles />}
              label="المساعد الذكي"
              onClick={() => setShowAIStudio(true)}
              active={showAIStudio}
              pressed={showAIStudio}
              intent="ai"
            />
          </div>

          <div className="mx-2 h-px bg-white/[0.08]" />

          {/* Search and call actions */}
          <div className="grid grid-cols-4 justify-items-center gap-x-1.5 gap-y-3 sm:gap-x-3">
            {(() => {
              const isSearching = status === 'connecting' || status === 'waiting' || status === 'confirming';
              const isMatched = status === 'matched';
              return (
                <CircularIconButton
                  icon={isSearching ? <Square className="fill-current" /> : <Play className="fill-current" />}
                  label={isSearching ? 'إيقاف البحث' : isMatched ? t('chat.next_btn') : 'ابدأ مباشرة'}
                  onClick={() => {
                    if (isMatched) { handleNext(); }
                    else if (isSearching) { stopSession(); }
                    else {
                      // Force global matching on quick start to ensure users find each other
                      startSession('any', 'any');
                    }
                  }}
                  active
                  intent={isSearching ? 'end' : isMatched ? 'next' : 'start'}
                />
              );
            })()}
            <CircularIconButton
              icon={<Zap />}
              label="الرادار"
              onClick={() => {
                const isSearching = status === 'connecting' || status === 'waiting' || status === 'confirming';
                if (isSearching) {
                  stopSession();
                  toast.info("تم إيقاف البحث. اضغط على الرادار مرة أخرى لضبط الفلاتر.");
                  return;
                }
                setStatus('setup');
              }}
              active={filterCountry !== 'any' || filterGender !== 'any'}
              intent="radar"
            />
            <CircularIconButton
              icon={<SkipForward />}
              label={t('chat.next_btn')}
              title={`${t('chat.next_btn')} — ${t('chat.another_person')}`}
              onClick={handleNext}
              disabled={status === 'connecting' || status === 'waiting' || status === 'confirming'}
              intent="next"
            />
            <CircularIconButton
              icon={<PhoneOff />}
              label={t('chat.stop_btn')}
              onClick={handleEnd}
              active={status === 'matched'}
              intent="end"
            />
          </div>
        </div>
      </div>

      {showGifts && (
        <GiftPanel credits={credits} onSend={sendGift} onClose={() => setShowGifts(false)} disabled={spendGift.isPending} />
      )}

      {showAIStudio && <AIStudio onClose={() => setShowAIStudio(false)} />}

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
                  <h3 className="text-white font-black text-lg">{isRTL ? 'تحويل النجوم' : 'Convert Stars'}</h3>
                  <p className="text-white/50 text-xs">{isRTL ? 'نجومك تساوي نقاطاً قيّمة' : 'Your stars are worth valuable points'}</p>
                </div>
              </div>

              {/* Exchange rate card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5 flex items-center justify-between gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-black text-purple-300">{stars}</span>
                  <span className="text-[11px] text-purple-400 font-bold">⭐ {t('profile.stars')}</span>
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
                  className="flex-1 rounded-full border border-violet-300/25 bg-violet-500/10 py-3 text-sm font-bold text-violet-100 transition-all hover:bg-violet-500/20 active:scale-[0.98]"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => { convertStars.mutate({ amount: stars }); setShowConvertModal(false); }}
                  disabled={stars < 2 || convertStars.isPending}
                  className="flex-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-amber-950 shadow-sm shadow-amber-950/15 transition-all hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
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
        <FaceFiltersPanel onClose={() => setShowFaceFilters(false)} isPremium={(user as any)?.isPremium || (user as any)?.role === 'admin'} onSelectFilter={setSelectedFilter} />
      )}

      {showFriends && (
        <FriendsPanel
          friends={(dbFriends || []).map((f: any) => ({
            id: String(f.id),
            name: f.name || 'مستخدم',
            avatar: f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.id}`,
             status: f.isOnline && f.lastSeen && new Date(f.lastSeen).getTime() > Date.now() - 2 * 60 * 1000 ? 'online' : 'offline',
            lastSeen: f.lastSeen ? new Date(f.lastSeen).toLocaleString('ar') : '',
             isVerified: Boolean(f.isVerified),
            userId: f.id,
          }))}
          onClose={() => setShowFriends(false)}
          onStartChat={(friend) => { setDmTarget({ id: Number(friend.id), name: friend.name, avatar: friend.avatar }); setShowFriends(false); }}
          currentPeerName={peerName}
          currentPeerAvatar={peerAvatar}
          currentPeerId={status === 'matched' ? 'peer_current' : undefined}
          myPeerId={myId}
          onFriendAccepted={() => refetchFriends()}
          onViewProfile={(uid) => { setShowFriends(false); setViewProfileUserId(uid); }}
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

      {viewProfileUserId && (
        <UserProfileModal
          userId={viewProfileUserId}
          onClose={() => setViewProfileUserId(null)}
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
            }} className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
              قبول
            </button>
            <button onClick={() => setFriendReqBanner(null)} aria-label="إغلاق طلب الصداقة" className="rounded-full bg-red-500/10 p-1.5 text-red-300 transition-colors hover:bg-red-500/20 hover:text-white">
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
              <button onClick={() => setShowReport(false)} aria-label="إغلاق نافذة الإبلاغ" className="rounded-full bg-red-500/10 p-1.5 text-red-300 transition-colors hover:bg-red-500/20 hover:text-white">
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
                  className="mt-2 w-full rounded-full bg-orange-600 py-2.5 font-bold text-white transition-all hover:bg-orange-700"
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
                          : 'border-violet-300/20 bg-violet-500/10 text-violet-100 hover:border-violet-300/40 hover:bg-violet-500/20'
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
