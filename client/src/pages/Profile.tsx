import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Camera, Save, ArrowLeft, Star, ShoppingCart, CheckCircle } from "lucide-react";

const AVATAR_SEEDS = [
  'Sara', 'Ahmed', 'Fatima', 'Mohammed', 'Layla', 'Ali',
  'Noor', 'Omar', 'Hana', 'Yusuf', 'Aisha', 'Khalid',
];

const CREDIT_PACKAGES = [
  { credits: 200, price: '1$', popular: false },
  { credits: 500, price: '2$', popular: true  },
  { credits: 1000, price: '4$', popular: false },
];

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  const u = user as any;

  const [name,   setName]   = useState(u?.name   || '');
  const [age,    setAge]    = useState<number>(u?.age ?? 18);
  const [bio,    setBio]    = useState(u?.bio    || '');
  const [avatar, setAvatar] = useState(u?.avatar || '');
  const [gender, setGender] = useState<'male'|'female'|'other'>(u?.gender || 'other');
  const [saved,  setSaved]  = useState(false);
  const [showBuy, setShowBuy] = useState(false);

  // Sync once user is loaded
  useEffect(() => {
    if (u?.name)   setName(u.name);
    if (u?.age)    setAge(u.age);
    if (u?.bio)    setBio(u.bio);
    if (u?.avatar) setAvatar(u.avatar);
    if (u?.gender) setGender(u.gender);
  }, [u?.name, u?.age, u?.bio, u?.avatar, u?.gender]);

  const saveProfile = trpc.users.saveProfile.useMutation({
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });

  const balanceQuery = trpc.gifts.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation('/login');
    return null;
  }

  const currentAvatar =
    avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'user')}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50" dir="rtl">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 max-w-lg">
          <button onClick={() => setLocation('/')} className="text-gray-500 hover:text-purple-600 transition-colors p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">الملف الشخصي</h1>
          <button
            onClick={() => setLocation('/chat')}
            className="text-sm bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-1.5 rounded-full font-medium"
          >
            دردشة
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-lg space-y-4">

        {/* ── Avatar ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <img src={currentAvatar} alt="صورتك"
                className="w-28 h-28 rounded-full border-4 border-purple-200 shadow-lg object-cover bg-white"
              />
              <div className="absolute bottom-1 right-1 bg-purple-600 rounded-full p-1.5 shadow">
                <Camera className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-3">اختر أفاتار من القائمة</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_SEEDS.map(seed => {
                const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                const active = avatar === url;
                return (
                  <button key={seed} onClick={() => setAvatar(url)}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${active ? 'border-purple-500 scale-110 shadow-md' : 'border-transparent hover:border-purple-300'}`}
                  >
                    <img src={url} alt={seed} className="w-full h-full" />
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Info fields ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-gray-900">معلوماتك</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="اسمك"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-purple-400 text-gray-900 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">العمر</label>
            <input type="number" value={age} onChange={e => setAge(Number(e.target.value))} min={13} max={100}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-purple-400 text-gray-900 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الجنس</label>
            <div className="flex gap-2">
              {([{ v: 'male', l: 'ذكر' }, { v: 'female', l: 'أنثى' }, { v: 'other', l: 'آخر' }] as const).map(({ v, l }) => (
                <button key={v} onClick={() => setGender(v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${
                    gender === v ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-700 hover:border-purple-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نبذة عنك</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="اكتب شيئاً عن نفسك..." rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-purple-400 text-gray-900 resize-none transition-colors"
            />
          </div>

          <button
            onClick={() => saveProfile.mutate({ name, age, gender, bio, avatar: currentAvatar })}
            disabled={saveProfile.isPending}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saved ? (
              <><CheckCircle className="w-4 h-4" /> تم الحفظ!</>
            ) : saveProfile.isPending ? (
              'جاري الحفظ...'
            ) : (
              <><Save className="w-4 h-4" /> حفظ التغييرات</>
            )}
          </button>
        </section>

        {/* ── Credits ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900">رصيد النقاط</h2>
            <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-bold text-yellow-700 text-sm">
                {balanceQuery.data?.credits ?? 100}
              </span>
              <span className="text-xs text-yellow-600">نقطة</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            استخدم نقاطك لإرسال هدايا افتراضية خلال المحادثات المرئية.
            تبدأ بـ 100 نقطة مجانية عند التسجيل.
          </p>

          <button onClick={() => setShowBuy(v => !v)}
            className="w-full border-2 border-dashed border-purple-300 rounded-xl py-3 text-purple-600 font-semibold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            {showBuy ? 'إخفاء الباقات' : 'شراء المزيد من النقاط'}
          </button>

          {showBuy && (
            <div className="mt-4 space-y-3">
              <div className="text-center py-2 bg-blue-50 rounded-xl text-sm text-blue-700 font-medium">
                🔒 سيتم تفعيل الدفع قريباً — Stripe قيد الإعداد
              </div>
              {CREDIT_PACKAGES.map(pkg => (
                <div key={pkg.credits}
                  className={`relative flex items-center justify-between p-4 rounded-xl border-2 ${pkg.popular ? 'border-purple-400 bg-purple-50' : 'border-gray-200'}`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-2.5 right-4 bg-purple-600 text-white text-xs px-2.5 py-0.5 rounded-full">
                      الأكثر شيوعاً
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="font-bold text-gray-900">{pkg.credits} نقطة</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-purple-700">{pkg.price}</span>
                    <button disabled className="bg-gray-100 text-gray-400 text-sm px-3 py-1.5 rounded-lg cursor-not-allowed">
                      قريباً
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
