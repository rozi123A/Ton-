import { Bell, X, UserPlus, Heart, Check, Radio } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { useTranslation } from '@/contexts/LanguageContext';
import { playFriendSound, playMessageSound } from '@/lib/notificationSound';
import { trpc } from '@/lib/trpc';
import { COOKIE_NAME, GUEST_SESSION_ACTIVE_KEY, GUEST_TOKEN_KEY } from '@shared/const';

interface AppNotif {
  id: string;
  type: string;
  title?: string;
  message?: string;
  fromName?: string;
  fromAvatar?: string;
  fromUserId?: number;
  ts: number;
  read: boolean;
}

const STORAGE_KEY = 'app_notifications';
const MAX_STORED = 50;

function loadStored(): AppNotif[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((n: AppNotif) => n.type !== 'new-message') : [];
  } catch {
    return [];
  }
}

function saveStored(notifs: AppNotif[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(-MAX_STORED)));
  } catch {}
}

async function requestBrowserPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    return Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
  }
  return 'Notification' in window ? Notification.permission : 'denied';
}

function showBrowserNotif(title: string, body: string, icon?: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const options = {
      body,
      icon: icon || '/favicon.ico',
      image: icon || undefined,
      badge: '/favicon.ico',
      dir: 'rtl' as const,
      lang: 'ar',
      renotify: true,
      tag: `friend-notification-${Date.now()}`,
      data: { url: '/' },
    };

    // Service-worker notifications are the form Android browsers can place in
    // the system notification shade while the tab is in the background.
    void navigator.serviceWorker?.getRegistration()
      .then((registration) => {
        if (registration) {
          return registration.showNotification(title, options);
        }
        new Notification(title, options);
      })
      .catch(() => {
        try {
          new Notification(title, options);
        } catch {}
      });
  }
}

function timeAgo(ts: number, t: (key: string) => string): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return t('notifications.now');
  if (diff < 3600) return t('notifications.minutes').replace('{count}', String(Math.floor(diff / 60)));
  if (diff < 86400) return t('notifications.hours').replace('{count}', String(Math.floor(diff / 3600)));
  return t('notifications.days').replace('{count}', String(Math.floor(diff / 86400)));
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'friend-request')  return <UserPlus className="w-4 h-4 text-purple-400" />;
  if (type === 'friend-accepted') return <Heart className="w-4 h-4 text-pink-400" />;
  if (type === 'friend-online') return <Radio className="w-4 h-4 text-emerald-500" />;
  return <Bell className="w-4 h-4 text-yellow-400" />;
}

export default function NotificationBell() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { language, t } = useTranslation();
  const userId = (user as { id?: number } | null)?.id;
  const [notifs, setNotifs] = useState<AppNotif[]>(loadStored);
  const [open, setOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const knownDbIdsRef = useRef<Set<string> | null>(null);

  const { data: dbNotifs, refetch: refetchNotifs } = trpc.notifications.get.useQuery(undefined, {
    enabled: isAuthenticated && !!userId,
    refetchInterval: 15_000, // Poll DB every 15s for new notifications
  });

  useEffect(() => {
    if (dbNotifs) {
      const formatted = dbNotifs
        .filter(n => n.type !== 'new-message')
        .map(n => ({
          id: n.id.toString(),
          type: n.type,
          title: n.title || undefined,
          message: n.message || undefined,
          fromName: n.fromName || undefined,
          fromAvatar: n.fromAvatar || undefined,
          fromUserId: (n as any).fromUserId || undefined,
          ts: n.createdAt instanceof Date ? n.createdAt.getTime() : new Date(n.createdAt).getTime(),
          read: n.isRead
        }));
      
      const knownIds = knownDbIdsRef.current;
      if (knownIds) {
        formatted
          .filter(n =>
            !knownIds.has(n.id) &&
            (n.type === 'friend-online' || n.type === 'friend-request' || n.type === 'friend-accepted'),
          )
          .forEach(n => {
            showBrowserNotif(
              n.title || (
                n.type === 'friend-request' ? 'طلب صداقة جديد' :
                n.type === 'friend-accepted' ? 'تم قبول طلب الصداقة' :
                'صديقك نشط الآن'
              ),
              n.message || (
                n.type === 'friend-online'
                  ? (n.fromName ? `${n.fromName} دخل إلى الموقع` : 'دخل صديقك إلى الموقع')
                  : (n.fromName ? `من ${n.fromName}` : 'لديك إشعار جديد')
              ),
              n.fromAvatar,
            );
            playFriendSound();
          });
      }
      knownDbIdsRef.current = new Set(formatted.map(n => n.id));

      // Update state without triggering addNotif logic (which plays sound)
      setNotifs(prev => {
        // Just sync with DB. Live SSE notifications are handled separately.
        return formatted;
      });
    }
  }, [dbNotifs, t]);

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
    // Direct messages remain available in the chat UI; they do not belong in
    // the general notification bell.
    if (raw.type === 'new-message') return;

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
  }, [t]);

  // Connect to notification stream
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/notification-sw.js').catch(() => {});
    }

    const getStreamHeaders = (): HeadersInit => {
      try {
        const guestToken = localStorage.getItem(GUEST_TOKEN_KEY);
        const guestSessionActive = localStorage.getItem(GUEST_SESSION_ACTIVE_KEY) === '1';
        if (guestToken && guestSessionActive) {
          return { Authorization: `Bearer ${guestToken}` };
        }

        const rawCookie = sessionStorage.getItem('manus-cookie');
        const cookiePair = rawCookie
          ?.split(';')
          .find((part) => part.trim().startsWith(`${COOKIE_NAME}=`));
        const sessionToken = cookiePair?.trim().slice(`${COOKIE_NAME}=`.length);
        return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
      } catch {
        return {};
      }
    };

    const connect = async () => {
      const controller = new AbortController();
      streamAbortRef.current = controller;

      try {
        const response = await fetch('/api/notify/stream', {
          credentials: 'include',
          headers: getStreamHeaders(),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Notification stream failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            const dataLine = event
              .split('\n')
              .find((line) => line.startsWith('data:'));
            if (!dataLine) continue;

            try {
              const data = JSON.parse(dataLine.slice(5).trim());
              if (data.type === 'connected' || data.type === 'new-message') continue;
              addNotif({
                type: data.type,
                title: data.title,
                message: data.message,
                fromName: data.fromName,
                fromAvatar: data.fromAvatar,
                fromUserId: data.fromUserId,
                ts: data.ts || Date.now(),
              });
            } catch {
              // Ignore malformed keep-alive/event chunks and keep the stream alive.
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('[Notifications] stream disconnected; retrying', error);
          streamRetryRef.current = setTimeout(() => void connect(), 5000);
        }
      }
    };

    void connect();
    return () => {
      streamAbortRef.current?.abort();
      if (streamRetryRef.current) clearTimeout(streamRetryRef.current);
    };
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
    <>
      {notificationPermission === 'default' && (
        <div
          role="status"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          className="fixed bottom-4 left-4 right-4 z-[110] mx-auto max-w-sm rounded-xl border border-gray-200 bg-white/95 p-3 text-right shadow-lg backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-purple-100 p-1.5 text-purple-700">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900">{t('notifications.enable_title')}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{t('notifications.enable_description')}</p>
              <button
                type="button"
                onClick={() => {
                  void requestBrowserPermission().then(setNotificationPermission);
                }}
                className="mt-2 rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-purple-700"
              >
                {t('notifications.enable_button')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
      onClick={() => {
          if (notificationPermission === 'default') {
            void requestBrowserPermission().then(setNotificationPermission);
          }
          setOpen(o => !o);
          if (!open) markAllRead();
        }}
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
              <span className="font-bold text-gray-800 text-sm">{t('notifications.title')}</span>
              {unread > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs font-bold rounded-full px-2 py-0.5">
                  {unread} {t('notifications.new_count')}
                </span>
              )}
            </div>
            {notifs.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />
                {t('notifications.mark_all')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-gray-400 text-sm font-medium">{t('notifications.empty_title')}</p>
                <p className="text-gray-300 text-xs mt-1">{t('notifications.empty_description')}</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.fromUserId) {
                      setOpen(false);
                      setLocation(`/profile?userId=${n.fromUserId}`);
                    }
                  }}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!n.read ? 'bg-purple-50/50' : ''}`}
                >
                  {/* Avatar or icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="relative">
                      {n.fromAvatar ? (
                        <img src={n.fromAvatar} alt={n.fromName} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center border-2 border-white shadow-sm">
                          <span className="text-purple-600 font-bold text-xs">{n.fromName?.charAt(0) || 'U'}</span>
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-50">
                        <NotifIcon type={n.type} />
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-tight">
                      {n.title || (
                        n.type === 'friend-request' ? t('notifications.friend_request') :
                        n.type === 'friend-accepted' ? t('notifications.friend_accepted') :
                        n.type === 'friend-online' ? t('notifications.friend_online') :
                        t('notifications.general')
                      )}
                    </p>
                    {(n.message || n.fromName) && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {n.message || (n.fromName ? `من ${n.fromName}` : '')}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.ts, t)}</p>
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
    </>
  );
}
