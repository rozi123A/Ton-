import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { Heart, Video, Camera, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

const AVATAR_SEEDS = [
  'Felix','Aneka','Jocelyn','Leah','Destiny','Jasmine','Amaya','Brian',
  'Mason','Lily','Zoe','Omar','Sara','Adam','Nora','Khalid'
];

function generateAvatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const guestLoginMutation = trpc.users.guestLogin.useMutation();

  useEffect(() => {
    if (name && !selectedAvatar) {
      setSelectedAvatar(generateAvatarUrl(name));
    }
  }, [name]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation('/chat');
    }
  }, [isAuthenticated, loading, setLocation]);

  const finalAvatar = customImageUrl || selectedAvatar || generateAvatarUrl(name || 'user');

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('يرجى ادخال اسمك'); return; }
    if (!age || parseInt(age) < 13) { setError('يجب ان يكون عمرك 13 سنة او اكثر'); return; }
    if (!gender) { setError('يرجى اختيار الجنس'); return; }
    setIsLoading(true);
    try {
      // Detect country from browser language (e.g. "ar-SA" → "SA", "ar-DZ" → "DZ")
      let browserCountry: string | undefined;
      try {
        const lang = navigator.language || '';
        if (lang.includes('-')) {
          const code = lang.split('-').pop()?.toUpperCase();
          if (code && code.length === 2 && /^[A-Z]{2}$/.test(code)) browserCountry = code;
        }
      } catch { /* ignore */ }

      const result = await guestLoginMutation.mutateAsync({
        name: name.trim(),
        age: parseInt(age),
        gender: gender as 'male' | 'female' | 'other',
        avatar: finalAvatar,
        ...(browserCountry ? { country: browserCountry } : {}),
      });
      // Store token in localStorage so it survives browser restarts and
      // works even when cookies are blocked (mobile / private browsing).
      if (result?.token) {
        try {
          localStorage.setItem('guest_token', result.token);
          // Also mirror into sessionStorage in the format the SDK expects
          localStorage.setItem('manus-cookie', `app_session_id=${result.token}`);
        } catch { /* storage unavailable */ }
      }
      // Invalidate auth cache so the Header immediately reflects the logged-in state
      await utils.auth.me.invalidate();
      setTimeout(() => setLocation('/chat'), 300);
    } catch (err) {
      console.error(err);
      setError('حدث خطا اثناء التسجيل، يرجى المحاولة مرة اخرى');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-cyan-400 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-medium">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-cyan-400 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
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

            {/* اختيار الصورة الشخصية */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <img
                  src={finalAvatar}
                  alt="صورتك"
                  className="w-24 h-24 rounded-full border-4 border-white/60 shadow-lg bg-white object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = generateAvatarUrl('default'); }}
                />
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
              </div>
              <p className="text-white/60 text-xs">اضغط على الكاميرا لاختيار صورتك</p>
            </div>

            {/* قائمة اختيار الصورة */}
            {showAvatarPicker && (
              <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
                <p className="text-white text-sm font-semibold mb-3 text-center">اختر صورة شخصية</p>
                <div className="grid grid-cols-4 gap-2 mb-3 max-h-40 overflow-y-auto">
                  {AVATAR_SEEDS.map((seed) => {
                    const url = generateAvatarUrl(seed);
                    const isSelected = selectedAvatar === url && !customImageUrl;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => { setSelectedAvatar(url); setCustomImageUrl(''); }}
                        className={`relative rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-white scale-110 shadow-lg' : 'border-white/30 hover:border-white/60'}`}
                      >
                        <img src={url} alt={seed} className="w-full aspect-square bg-white" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-purple-500/40 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/20 pt-3">
                  <p className="text-white/70 text-xs mb-2">او ادخل رابط صورة:</p>
                  <Input
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/40 rounded-xl text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(false)}
                  className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white text-sm py-2 rounded-xl transition-colors"
                >
                  تم الاختيار
                </button>
              </div>
            )}

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
