import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation, Link } from 'wouter';
import { Video, Camera, Check, RefreshCw, ArrowRight } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

const AVATAR_SEEDS = [
  'Felixh3s0cj', 'Milo34kqt2', 'Maxxl1u6', 'Jasper17wmpm',
  'Anekat4z9qy', 'Jasperq6seb', 'Felixrk3xe', 'Leour9sb'
];

const COLORS = ['fef08a', 'c0aede', 'f4d150', 'f4d150', 'ffdce5', 'bbf7d0', 'ffdce5', 'f4d150'];

function generateAvatarUrl(seed: string, color?: string) {
  const bgColor = color || COLORS[Math.floor(Math.random() * COLORS.length)];
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bgColor}`;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState('male');
  const [selectedAvatar, setSelectedAvatar] = useState(generateAvatarUrl(AVATAR_SEEDS[0], COLORS[0]));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const guestLoginMutation = trpc.users.guestLogin.useMutation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation('/chat');
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('يرجى إدخال اسمك المستعار'); return; }
    
    setIsLoading(true);
    try {
      await guestLoginMutation.mutateAsync({
        name: name.trim(),
        age: parseInt(age) || 25,
        gender: gender as 'male' | 'female' | 'other',
        avatar: selectedAvatar,
      });
      // Force immediate navigation
      window.location.href = '/chat';
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء التجهيز، يرجى المحاولة مرة أخرى');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[10%] left-[-50px] w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px]" style={{ animationDelay: '-5s' }}></div>
      </div>

      <div className="absolute top-6 right-6 z-10">
        <Link href="/">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground group">
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            العودة للرئيسية
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl relative z-10 overflow-hidden">
        <div className="p-6 text-center border-b border-white/5 pb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">إعداد هويتك</h1>
          <p className="text-muted-foreground">اختر كيف تود أن تظهر للآخرين. لا حاجة لحساب.</p>
        </div>

        <div className="p-6 pt-8">
          <form onSubmit={handleStartChat} className="space-y-8">
            <div className="space-y-4">
              <label className="text-base font-medium block">اختر الأفاتار الخاص بك</label>
              
              <div className="flex justify-center mb-6">
                <div className="relative h-28 w-28 rounded-full border-4 border-card bg-muted shadow-xl overflow-hidden">
                  <img src={selectedAvatar} alt="Selected Avatar" className="w-full h-full" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 bg-black/20 p-4 rounded-xl border border-white/5">
                {AVATAR_SEEDS.map((seed, i) => {
                  const url = generateAvatarUrl(seed, COLORS[i]);
                  const isSelected = selectedAvatar === url;
                  return (
                    <button
                      key={seed}
                      type="button"
                      onClick={() => setSelectedAvatar(url)}
                      className={`relative rounded-full overflow-hidden transition-all hover:scale-110 aspect-square ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover bg-muted" />
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center px-1">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-muted-foreground"
                  onClick={() => setSelectedAvatar(generateAvatarUrl(Math.random().toString(36).substring(7)))}
                >
                  <RefreshCw className="ml-2 h-3 w-3" />
                  أشكال جديدة
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-muted-foreground"
                  onClick={() => setName('مستخدم_' + Math.floor(Math.random() * 1000))}
                >
                  استخدم اسمي
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الاسم المستعار</label>
                <Input
                  placeholder="أدخل اسماً مستعاراً لك"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/50 h-12 text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">العمر</label>
                  <Input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="bg-background/50 h-12 text-lg text-center"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">الجنس</label>
                  <div className="flex gap-2 bg-background/50 p-2 rounded-md border border-input">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`flex-1 py-1 text-sm rounded ${gender === 'male' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      ذكر
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`flex-1 py-1 text-sm rounded ${gender === 'female' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      أنثى
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 shadow-lg transition-transform hover:scale-[1.02]"
            >
              {isLoading ? 'جاري التجهيز...' : 'ابدأ الدردشة'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
