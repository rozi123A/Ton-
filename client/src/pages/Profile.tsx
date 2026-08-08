import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import StoryViewer from "@/components/StoryViewer";
import {
  Save, ArrowLeft, Star, ShoppingCart, CheckCircle,
  User, Calendar, Zap, Crown, Camera,
  Award, TrendingUp, Shield, PlusCircle, Play, Image as ImageIcon, X, Eye, MessageCircle, Trash2
} from "lucide-react";

async function compressImage(file: File, maxPx = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CREDIT_PACKAGES = [
  { credits: 200, price: "1$", popular: false },
  { credits: 500, price: "2$", popular: true  },
  { credits: 1000, price: "4$", popular: false },
];

export default function Profile() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  
  // Parse userId from query string
  const queryParams = new URLSearchParams(window.location.search);
  const targetUserId = queryParams.get("userId") ? parseInt(queryParams.get("userId")!) : null;
  const isOwnProfile = !targetUserId || targetUserId === (user as any)?.id;

  const { data: publicProfile, isLoading: loadingPublic } = trpc.users.getPublicProfile.useQuery(
    targetUserId || 0,
    { enabled: !!targetUserId && !isOwnProfile }
  );

  const u = isOwnProfile ? (user as any) : publicProfile;

  const [name,   setName]   = useState(u?.name   || "");
  const [age,    setAge]    = useState<number>(u?.age ?? 18);
  const [bio,    setBio]    = useState(u?.bio    || "");
  const [avatar, setAvatar] = useState(u?.avatar || "");
  const [gender, setGender] = useState<"male"|"female"|"other">(u?.gender || "other");
  const [saved,  setSaved]  = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showBuy, setShowBuy] = useState(false);
  const [showStoryUpload, setShowStoryUpload] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [storyMedia, setStoryMedia] = useState<string | null>(null);
  const [storyType, setStoryType] = useState<"image" | "video">("image");
  const [storyCaption, setStoryCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const storyFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(u?.name || "");
    setAge(u?.age ?? 18);
    setBio(u?.bio || "");
    setAvatar(u?.avatar || "");
    setGender(u?.gender || "other");
  }, [u]);

  const saveProfile = trpc.users.saveProfile.useMutation({
    onSuccess: () => {
      setSaveError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (error) => {
      setSaveError(error.message || "تعذر حفظ التغييرات. حاول مرة أخرى.");
    },
  });

  const walletQuery  = trpc.gifts.getWallet.useQuery(undefined,  { enabled: isAuthenticated });
  const balanceQuery = trpc.gifts.getBalance.useQuery(undefined, { enabled: isAuthenticated });
  const myStoriesQuery = trpc.stories.getUserStories.useQuery({ userId: u?.id }, { enabled: !!u?.id });
  
  const utils = trpc.useUtils();
  const createStory = trpc.stories.create.useMutation({
    onSuccess: async () => {
      setShowStoryUpload(false);
      setStoryMedia(null);
      setStoryCaption("");
      await utils.stories.getActive.invalidate();
      await utils.stories.getUserStories.invalidate({ userId: u?.id });
      await utils.users.getRecent.invalidate();
      alert("تم نشر القصة بنجاح!");
    },
    onError: (error) => {
      alert("خطأ: " + (error.message || "تعذر نشر القصة"));
    },
  });

  const deleteStory = trpc.stories.delete.useMutation({
    onSuccess: async () => {
      await utils.stories.getActive.invalidate();
      await utils.stories.getUserStories.invalidate({ userId: u?.id });
      await utils.users.getRecent.invalidate();
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setAvatar(compressed);
    } catch {
      alert("تعذر تجهيز الصورة. حاول اختيار صورة أخرى.");
    }
    e.target.value = "";
  };

  const handleStoryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type.startsWith("video/")) {
      if (file.size > 10 * 1024 * 1024) {
        alert("حجم الفيديو كبير جداً. الحد الأقصى هو 10 ميجابايت.");
        return;
      }
      setStoryType("video");
      const reader = new FileReader();
      reader.onload = (ev) => setStoryMedia(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("image/")) {
      setStoryType("image");
      try {
        const compressed = await compressImage(file);
        setStoryMedia(compressed);
      } catch { /* ignore */ }
    }
    e.target.value = "";
  };

  const completionItems = [
    { done: !!name.trim(),      label: "الاسم" },
    { done: age >= 13,          label: "العمر" },
    { done: gender !== "other", label: "الجنس" },
    { done: !!bio.trim(),       label: "نبذة شخصية" },
    { done: !!avatar,           label: "صورة شخصية" },
  ];
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100);

  const memberSince = u?.createdAt
    ? new Date(u.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long" })
    : null;

  if (loading || (targetUserId && !isOwnProfile && loadingPublic)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-purple-900">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) { setLocation("/login"); return null; }
  if (targetUserId && !isOwnProfile && !publicProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <p className="text-xl font-bold mb-4">المستخدم غير موجود</p>
        <button onClick={() => setLocation("/")} className="bg-purple-600 px-6 py-2 rounded-full">العودة للرئيسية</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" dir="rtl">

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={storyFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleStoryFileChange} />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 max-w-lg">
          <button onClick={() => setLocation("/")} className="text-white/70 hover:text-white transition-colors p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">
            {isOwnProfile ? "الملف الشخصي" : `ملف ${u?.name || "مستخدم"}`}
          </h1>
          {u?.isPremium && (
            <span className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs px-3 py-1 rounded-full font-bold">
              <Crown className="w-3.5 h-3.5" /> VIP
            </span>
          )}
          {u?.role === 'admin' && (
            <button
              onClick={() => setLocation("/admin")}
              className="flex items-center gap-1 bg-red-600/80 border border-red-500/60 text-white text-xs px-3 py-1.5 rounded-full font-bold"
            >
              <Shield className="w-3.5 h-3.5" /> أدمن
            </button>
          )}
          <button
            onClick={() => setLocation("/chat")}
            className="text-sm bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-1.5 rounded-full font-medium"
          >
            دردشة
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">

        {/* ── Story Upload Modal ─────────────────────────────────────────── */}
        {showStoryUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-800 w-full max-w-md rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-white font-bold">إضافة قصة جديدة</h3>
                <button onClick={() => { setShowStoryUpload(false); setStoryMedia(null); }} className="text-white/50 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {!storyMedia ? (
                  <div 
                    onClick={() => storyFileRef.current?.click()}
                    className="aspect-[9/16] bg-slate-900 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-purple-500 transition-colors"
                  >
                    <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center">
                      <PlusCircle className="w-8 h-8 text-purple-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium">اختر صورة أو فيديو</p>
                      <p className="text-white/40 text-xs mt-1">الحد الأقصى 10 ميجابايت</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative aspect-[9/16] bg-black rounded-2xl overflow-hidden">
                      {storyType === "image" ? (
                        <img src={storyMedia} className="w-full h-full object-contain" />
                      ) : (
                        <video src={storyMedia} className="w-full h-full object-contain" controls />
                      )}
                      <button 
                        onClick={() => setStoryMedia(null)}
                        className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <input 
                      value={storyCaption}
                      onChange={(e) => setStoryCaption(e.target.value)}
                      placeholder="أضف وصفاً للقصة..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                    />
                    
                    <button
                      onClick={() => createStory.mutate({ mediaUrl: storyMedia, mediaType: storyType, caption: storyCaption })}
                      disabled={createStory.isPending}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50"
                    >
                      {createStory.isPending ? "جاري النشر..." : "نشر القصة الآن"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <section className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 relative">
            {u?.isPremium && (
              <div className="absolute top-3 left-3 flex items-center gap-1 bg-yellow-400 text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow">
                <Crown className="w-3.5 h-3.5" /> عضو VIP
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-12 mb-4">
              <div className="relative group">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-4 border-slate-900 shadow-xl flex-shrink-0">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500/60 to-pink-500/60 flex items-center justify-center">
                      <User className="w-10 h-10 text-white/70" />
                    </div>
                  )}
                  {isOwnProfile && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <Camera className="w-6 h-6 text-white" />
                    </button>
                  )}
                </div>
                {isOwnProfile && (
                  <button 
                    onClick={() => setShowStoryUpload(true)}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 hover:scale-110 transition-transform"
                  >
                    <PlusCircle className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>

              <div className="flex-1 pt-14">
                <p className="text-white font-bold text-lg leading-tight">{name || "مستخدم"}</p>
                {memberSince && (
                  <p className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" /> عضو منذ {memberSince}
                  </p>
                )}
              </div>
              {u?.isPremium && <Shield className="w-5 h-5 text-green-400 mb-1" />}
            </div>

            {/* Stats row — tap اكتمال 7 times to reveal admin box */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/50 rounded-xl p-3 text-center border border-slate-700">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-400 font-bold text-lg">{walletQuery.data?.wallet ?? 0}</span>
                </div>
                <p className="text-white/50 text-xs">نجوم</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 text-center border border-slate-700">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-purple-400 font-bold text-lg">{balanceQuery.data?.credits ?? 0}</span>
                </div>
                <p className="text-white/50 text-xs">نقاط</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 text-center border border-slate-700">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Award className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400 font-bold text-lg">{completionPct}%</span>
                </div>
                <p className="text-white/50 text-xs">اكتمال</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── My Active Stories ────────────────────────────────────────── */}
        {myStoriesQuery.data && myStoriesQuery.data.length > 0 && (
          <section className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
            <h2 className="font-bold text-white flex items-center gap-2 mb-4">
              <Play className="w-4 h-4 text-pink-400" /> قصصي النشطة
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {myStoriesQuery.data.map((story: any, index: number) => (
                <div 
                  key={story.id} 
                  onClick={() => setSelectedStoryIndex(index)}
                  className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] cursor-pointer group"
                >
                  {story.mediaType === "video" ? (
                    <video src={story.mediaUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={story.mediaUrl} className="w-full h-full object-cover" />
                  )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-2 opacity-100 group-hover:from-black/80 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2 text-xs text-white">
                          <span className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full">
                            <Eye className="w-3 h-3" /> {story.viewCount || 0}
                          </span>
                          <span className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full">
                            <MessageCircle className="w-3 h-3" /> {story.commentCount || 0}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("هل أنت متأكد من حذف هذه القصة؟")) {
                              deleteStory.mutate({ storyId: story.id });
                            }
                          }}
                          className="bg-red-500/80 p-1.5 rounded-full text-white hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Story Viewer Modal ─────────────────────────────────────────── */}
        {selectedStoryIndex !== null && myStoriesQuery.data && (
          <StoryViewer 
            stories={myStoriesQuery.data.map(s => ({
              ...s,
              userName: u.name,
              userAvatar: u.avatar
            }))}
            initialIndex={selectedStoryIndex}
            onClose={() => setSelectedStoryIndex(null)}
          />
        )}

        {/* ── Profile completion ────────────────────────────────────────── */}
        {completionPct < 100 && (
          <section style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '16px' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-white font-semibold text-sm">اكتمال الملف الشخصي</span>
              </div>
              <span className="text-purple-300 font-bold text-sm">{completionPct}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ height: '100%', background: 'linear-gradient(to right, #9333ea, #ec4899)', borderRadius: '99px', width: `${completionPct}%`, transition: 'width 0.5s' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {completionItems.map(item => (
                <span key={item.label} style={{
                  fontSize: '12px', padding: '4px 10px', borderRadius: '99px',
                  border: item.done ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: item.done ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
                  color: item.done ? '#86efac' : 'rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  {item.done ? "✓" : "○"} {item.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Info fields ──────────────────────────────────────────────── */}
        <section className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-purple-400" /> معلوماتك
          </h2>

          <div>
            <label className="block text-white/70 text-sm font-medium mb-1.5">الاسم</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="اسمك"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-white/70 text-sm font-medium mb-1.5">العمر</label>
            <input type="number" value={age} onChange={e => setAge(Number(e.target.value))} min={13} max={100}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-white/70 text-sm font-medium mb-1.5">الجنس</label>
            <div className="flex gap-2">
              {([{ v: "male", l: "ذكر" }, { v: "female", l: "أنثى" }, { v: "other", l: "آخر" }] as const).map(({ v, l }) => (
                <button key={v} onClick={() => setGender(v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${
                    gender === v ? "bg-purple-600 text-white border-purple-600" : "border-white/20 text-white/60 hover:border-purple-400 bg-white/5"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-white/70 text-sm font-medium mb-1.5">نبذة عنك</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="اكتب شيئاً عن نفسك..." rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400 resize-none transition-colors"
            />
          </div>

          <button
            onClick={() => {
              setSaveError("");
              saveProfile.mutate({ name, age, gender, bio, avatar: avatar || undefined });
            }}
            disabled={saveProfile.isPending}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-lg"
          >
            {saved ? (
              <><CheckCircle className="w-4 h-4" /> تم الحفظ!</>
            ) : saveProfile.isPending ? "جاري الحفظ..." : (
              <><Save className="w-4 h-4" /> حفظ التغييرات</>
            )}
          </button>
          {saveError && (
            <p role="alert" className="text-center text-sm text-red-300">
              {saveError}
            </p>
          )}
        </section>

        {/* ── Credits & Stars ───────────────────────────────────────────── */}
        <section className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" /> رصيد النجوم
            </h2>
            <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-full px-3 py-1">
              <Star className="w-3.5 h-3.5 text-yellow-400" />
              <span className="font-bold text-yellow-300 text-sm">{walletQuery.data?.wallet ?? 0}</span>
            </div>
          </div>
          <p className="text-white/40 text-sm mb-4">استخدم نجومك لتفعيل رادار النجوم وإرسال هدايا افتراضية.</p>

          <button onClick={() => setShowBuy(v => !v)}
            className="w-full border-2 border-dashed border-purple-500/50 rounded-xl py-3 text-purple-300 font-semibold hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            {showBuy ? "إخفاء الباقات" : "شراء المزيد من النجوم"}
          </button>

          {showBuy && (
            <div className="mt-4 space-y-3">
              <div className="text-center py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-sm text-blue-300 font-medium">
                🔒 سيتم تفعيل الدفع قريباً
              </div>
              {CREDIT_PACKAGES.map(pkg => (
                <div key={pkg.credits} className={`relative flex items-center justify-between p-4 rounded-xl border ${pkg.popular ? "border-purple-500/60 bg-purple-500/10" : "border-white/15 bg-white/5"}`}>
                  {pkg.popular && (
                    <span className="absolute -top-2.5 right-4 bg-purple-600 text-white text-xs px-2.5 py-0.5 rounded-full">الأكثر شيوعاً</span>
                  )}
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <span className="font-bold text-white">{pkg.credits} نجمة</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-purple-300">{pkg.price}</span>
                    <button disabled className="bg-white/10 text-white/30 text-sm px-3 py-1.5 rounded-lg cursor-not-allowed">قريباً</button>
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
