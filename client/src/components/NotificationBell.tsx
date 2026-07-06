import { Bell, X, MessageCircle, UserPlus, Check, Heart } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { playFriendSound, playMessageSound } from '@/lib/notificationSound';
import { trpc } from '@/lib/trpc';

interface AppNotif {
  id: string;
  type: string;
  title?: string;
  message?: string;
  fromName?: string;
  fromAvatar?: string;
  ts: number;
  read: boolean;
}

const STORAGE_KEY = 'app_notifications';
const MAX_STORED = 50;

function loadStored(): AppNotif[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStored(notifs: AppNotif[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(-MAX_STORED)));
  } catch {}
}

function requestBrowserPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function showBrowserNotif(title: string, body: string, icon?: string) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try {
      new Notification(title, { body, icon: icon || '/favicon.ico' });
    } catch {}
  }
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'friend-request')  return <UserPlus className="w-4 h-4 text-purple-400" />;
  if (type === 'friend-accepted') return <Heart className="w-4 h-4 text-pink-400" />;
  if (type === 'new-message')     return <MessageCircle className="w-4 h-4 text-blue-400" />;
  return <Bell className="w-4 h-4 text-yellow-400" />;
}

export default function NotificationBell() {
  const { user, isAuthenticated } = useAuth();
  const userId = (user as { id?: number } | null)?.id;
  const [notifs, setNotifs] = useState<AppNotif[]>(loadStored);
  const [open, setOpen] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: dbNotifs, refetch: refetchNotifs } = trpc.notifications.get.useQuery(undefined, {
    enabled: isAuthenticated && !!userId,
  });

  useEffect(() => {
    if (dbNotifs) {
      const formatted = dbNotifs.map(n => ({
        id: n.id.toString(),
        type: n.type,
        title: n.title || undefined,
        message: n.message || undefined,
        fromName: n.fromName || undefined,
        fromAvatar: n.fromAvatar || undefined,
        ts: n.createdAt instanceof Date ? n.createdAt.getTime() : new Date(n.createdAt).getTime(),
        read: n.isRead
      }));
      setNotifs(formatted);
    }
  }, [dbNotifs]);

  const markReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => refetchNotifs()
  });

  // Auto-open once per session when there are unread notifications
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const unreadCount = notifs.filter(n => !n.read).length;
    if (unreadCount === 0) return;

    const sessionKey = `notif_auto_shown_${userId}`;
    if (sessionStorage.getItem(sessionKey)) return;

    autoOpenedRef.current = true;
    sessionStorage.setItem(sessionKey, '1');

    // Delay so the page renders first
    const openTimer = setTimeout(() => {
      setOpen(true);
      // Auto-close after 8 seconds if user doesn't interact
      const closeTimer = setTimeout(() => {
        setOpen(prev => {
          if (prev) markReadMutation.mutate();
          return false;
        });
      }, 8000);
      // Store close timer so manual close can cancel it
      (openTimer as unknown as { _closeTimer: ReturnType<typeof setTimeout> })._closeTimer = closeTimer;
    }, 1200);

    return () => clearTimeout(openTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifs, userId]);

  const addNotif = useCallback((raw: Omit<AppNotif, 'id' | 'read'>) => {
    const notif: AppNotif = { ...raw, id: `${raw.ts}-${Math.random()}`, read: false };
    setNotifs(prev => {
      const next = [notif, ...prev].slice(0, MAX_STORED);
      saveStored(next);
      return next;
    });
    showBrowserNotif(
      raw.title || (raw.type === 'friend-request' ? 'طلب صداقة جديد' :
        raw.type === 'friend-accepted' ? 'تم قبول طلبك' : 'إشعار جديد'),
      raw.message || (raw.fromName ? `من ${raw.fromName}` : ''),
      raw.fromAvatar,
    );
    if (raw.type === 'friend-request' || raw.type === 'friend-accepted') {
      playFriendSound();
    } else {
      playMessageSound();
    }
  }, []);

  // Connect to notification stream
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    requestBrowserPermission();

    const connect = () => {
      if (esRef.current) esRef.current.close();
      const es = new EventSource(`/api/notify/stream?userId=${userId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'connected') return;
          addNotif({
            type: data.type,
            title: data.title,
            message: data.message,
            fromName: data.fromName,
            fromAvatar: data.fromAvatar,
            ts: data.ts || Date.now(),
          });
        } catch {}
      };

      es.onerror = () => {
        es.close();
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => { esRef.current?.close(); };
  }, [isAuthenticated, userId, addNotif]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = notifs.filter(n => !n.read).length;

  const markAllRead = () => {
    markReadMutation.mutate();
    setNotifs(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      saveStored(next);
      return next;
    });
  };

  const removeNotif = (id: string) => {
    setNotifs(prev => {
      const next = prev.filter(n => n.id !== id);
      saveStored(next);
      return next;
    });
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
        className={
          unread > 0
            ? "relative p-2 rounded-full transition-all duration-200 bg-red-50 hover:bg-red-100 ring-2 ring-red-200 shadow-sm shadow-red-100"
            : "relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        }
        title="الإشعارات"
      >
        <Bell className={unread > 0 ? "w-5 h-5 text-red-500" : "w-5 h-5 text-gray-600"} />
        {unread > 0 && (
          <>
            {/* Ping ring for attention */}
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 opacity-60 animate-ping" />
            {/* Solid badge */}
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-md border-2 border-white">
              {unread > 9 ? '9+' : unread}
            </span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-10 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden"
          style={{ transform: 'translateX(calc(-100% + 36px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-gray-800 text-sm">الإشعارات</span>
              {unread > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs font-bold rounded-full px-2 py-0.5">
                  {unread} جديد
                </span>
              )}
            </div>
            {notifs.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />
                قراءة الكل
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-gray-400 text-sm font-medium">لا توجد إشعارات بعد</p>
                <p className="text-gray-300 text-xs mt-1">ستظهر هنا عند وصول رسالة أو طلب صداقة</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-purple-50/50' : ''}`}
                >
                  {/* Avatar or icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {n.fromAvatar ? (
                      <div className="relative">
                        <img src={n.fromAvatar} alt={n.fromName} className="w-9 h-9 rounded-full object-cover border border-gray-100" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                          <NotifIcon type={n.type} />
                        </span>
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                        <NotifIcon type={n.type} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-tight">
                      {n.title || (
                        n.type === 'friend-request' ? 'طلب صداقة' :
                        n.type === 'friend-accepted' ? 'قبول طلب الصداقة' :
                        n.type === 'new-message' ? 'رسالة جديدة' : 'إشعار'
                      )}
                    </p>
                    {(n.message || n.fromName) && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {n.message || (n.fromName ? `من ${n.fromName}` : '')}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.ts)}</p>
                  </div>

                  {/* Delete */}
                  <button onClick={() => removeNotif(n.id)} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
