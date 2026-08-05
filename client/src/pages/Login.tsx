import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { Heart, Video, Camera } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { detectBrowserCountry } from '@/lib/detectCountry';
import {
  COOKIE_NAME,
  GUEST_SESSION_ACTIVE_KEY,
  GUEST_TOKEN_KEY,
} from '@shared/const';

async function compressImage(file: File, maxPx = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Storage is only used to remember the guest session on this device. Some
// mobile browsers and embedded WebViews block storage, so a storage error must
// never turn a successful server login into a registration error.
type StorageKind = 'local' | 'session';

function safeStorageSet(kind: StorageKind, key: string, value: string): boolean {
  try {
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(kind: StorageKind, key: string) {
  try {
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    storage.removeItem(key);
  } catch {
    // Storage can be unavailable in private mode or an embedded browser.
  }
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [photo, setPhoto] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const guestLoginMutation = trpc.users.guestLogin.useMutation();

  useEffect(() => {
    // Redirect to chat if already authenticated.
    // Only check after a short delay so the form renders first.
    if (isAuthenticated) setLocation('/chat');
  }, [isAuthenticated, setLocation]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch { /* ignore */ }
    e.target.value = '';
  };

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('يرجى ادخال اسمك'); return; }
    if (!age || parseInt(age) < 13) { setError('يجب ان يكون عمرك 13 سنة او اكثر'); return; }
    if (!gender) { setError('يرجى اختيار الجنس'); return; }
    
    // Prevent double-click
    if (isLoading || guestLoginMutation.isPending) return;
    
    setIsLoading(true);
    try {
      // Re-enable the saved device identity for this login attempt.
      safeStorageSet('local', GUEST_SESSION_ACTIVE_KEY, '1');
      const browserCountry = detectBrowserCountry();
      
      // Create a timeout promise to prevent hanging forever
      const loginPromise = guestLoginMutation.mutateAsync({
        name: name.trim(),
        age: parseInt(age),
        gender: gender as 'male' | 'female' | 'other',
        ...(photo ? { avatar: photo } : {}),
        ...(browserCountry ? { country: browserCountry } : {}),
      });
      
      // 🔒 SPEED & ROBUSTNESS FIX
      console.log('[Login] Sending request...');
      const result = await guestLoginMutation.mutateAsync({
        name: name.trim(),
        age: parseInt(age),
        gender: gender as 'male' | 'female' | 'other',
        ...(photo ? { avatar: photo } : {}),
        ...(browserCountry ? { country: browserCountry } : {}),
      }) as any;

      if (result && result.success) {
        console.log('[Login] Success! Token received.');
        if (result.guestToken) {
          safeStorageSet('local', GUEST_TOKEN_KEY, result.guestToken);
          safeStorageSet('session', 'manus-cookie', `${COOKIE_NAME}=${result.guestToken}`);
        }
        
        // Immediate redirect
        window.location.replace('/chat');
      } else {
        throw new Error('فشل التسجيل: استجابة غير متوقعة من السيرفر');
      }
    } catch (err) {
      safeStorageRemove('local', GUEST_SESSION_ACTIVE_KEY);
      console.error('[Login Error]', err);
      
      // Detailed error messages for debugging
      let errorMsg = 'حدث خطا اثناء التسجيل، يرجى المحاولة مرة اخرى';
      if (err instanceof Error) {
        if (err.message === 'TIMEOUT') {
          errorMsg = 'الخادم يستغرق وقتاً أطول من المعتاد، يرجى المحاولة مرة اخرى';
        } else if (err.message.includes('network') || err.message.includes('Network')) {
          errorMsg = 'خطأ في الاتصال بالإنترنت، يرجى التحقق من الاتصال';
        } else if (err.message.includes('CORS')) {
          errorMsg = 'خطأ في الاتصال بالخادم (CORS)، يرجى المحاولة لاحقاً';
        }
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // No loading screen — show the form immediately even if auth is still loading.
  // If auth resolves to authenticated, redirect to /chat automatically.
  // The auth.me query will still run in the background (retryOnMount:false
  // means it won't run until explicitly triggered).
  void loading; // suppress unused warning

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-cyan-400 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mb-4 border border-white/30">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-1">ConnectLive</h1>
          <p className="text-white/80 text-sm">تواصل مع اشخاص جدد من حول العالم</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
          <form onSubmit={handleStartChat} className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-white text-sm p-3 rounded-xl">{error}</div>
            )}

            {/* Hidden file input */}
            <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />

            {/* Photo — clickable circle only, no label */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-white/60 shadow-lg focus:outline-none active:scale-95 transition-transform"
              >
                {photo ? (
                  <img src={photo} alt="صورتك" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/20 flex flex-col items-center justify-center gap-1">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                )}
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </button>
            </div>

            {/* الاسم */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">اسمك</label>
              <Input
                type="text"
                placeholder="ادخل اسمك"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50 rounded-xl"
                required
              />
            </div>

            {/* العمر */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">العمر</label>
              <Input
                type="number"
                placeholder="ادخل عمرك"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50 rounded-xl"
                min="13"
                max="100"
                required
              />
            </div>

            {/* الجنس */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">الجنس</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/50"
                required
              >
                <option value="" className="bg-gray-900">اختر الجنس</option>
                <option value="male" className="bg-gray-900">ذكر</option>
                <option value="female" className="bg-gray-900">انثى</option>
                <option value="other" className="bg-gray-900">اخر</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={isLoading || guestLoginMutation.isPending}
              className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-bold py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 mt-2"
            >
              {isLoading || guestLoginMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">جاري التسجيل...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Heart className="w-5 h-5" />
                  ابدا الدردشة الان
                </span>
              )}
            </Button>
          </form>

          <p className="text-white/60 text-xs text-center mt-4">
            بالضغط على "ابدا الدردشة" فانك توافق على{' '}
            <a href="#" className="text-white/80 hover:text-white underline">شروط الاستخدام</a>
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-white/70 text-sm">اتصالات فورية - خصوصية تامة - مجتمع عالمي</p>
        </div>
      </div>
    </div>
  );
}
