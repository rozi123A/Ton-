import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import StoryViewer from "@/components/StoryViewer";
import VerifiedBadge from "@/components/VerifiedBadge";
import {
  Save, ArrowLeft, Star, ShoppingCart, CheckCircle,
  User, Calendar, Zap, Crown, Camera,
  Award, TrendingUp, Shield, PlusCircle, Play, Image as ImageIcon, ImagePlus, X, Eye, MessageCircle, Trash2
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  
  // Parse userId from query string
  const queryParams = new URLSearchParams(window.location.search);
  const targetUserId = queryParams.get("userId") ? parseInt(queryParams.get("userId")!) : null;
  const isOwnProfile = !targetUserId || targetUserId === (user as any)?.id;
  const isPublicProfile = !!targetUserId && !isOwnProfile;

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
  const [storyFile, setStoryFile] = useState<File | null>(null);
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

  // Wallet and points belong to the signed-in user only. Never request them
  // while a public profile is open.
  const walletQuery  = trpc.gifts.getWallet.useQuery(undefined,  { enabled: isAuthenticated && isOwnProfile });
  const balanceQuery = trpc.gifts.getBalance.useQuery(undefined, { enabled: isAuthenticated && isOwnProfile });
  const publicStoriesQuery = trpc.stories.getPublicUserStories.useQuery(
    { userId: u?.id ?? 0 },
    { enabled: isPublicProfile && !!u?.id },
  );
  const ownStoriesQuery = trpc.stories.getUserStories.useQuery(
    { userId: u?.id ?? 0 },
    { enabled: !isPublicProfile && !!u?.id },
  );
  const myStoriesQuery = isPublicProfile ? publicStoriesQuery : ownStoriesQuery;
  
  const utils = trpc.useUtils();
  const uploadStoryVideo = trpc.stories.uploadVideo.useMutation();
  const createStory = trpc.stories.create.useMutation({
    onSuccess: async () => {
      setShowStoryUpload(false);
      clearStoryMedia();
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

  const clearStoryMedia = () => {
    if (storyMedia?.startsWith("blob:")) URL.revokeObjectURL(storyMedia);
    setStoryMedia(null);
    setStoryFile(null);
  };

  const publishStory = async () => {
    if (!storyMedia) return;
    try {
      let mediaUrl = storyMedia;
      if (storyType === "video") {
        if (!storyFile) throw new Error("لم يتم اختيار فيديو صالح");
        const uploaded = await uploadStoryVideo.mutateAsync({
          dataUrl: await readFileAsDataUrl(storyFile),
        });
        mediaUrl = uploaded.mediaUrl;
      }
      await createStory.mutateAsync({ mediaUrl, mediaType: storyType, caption: storyCaption });
    } catch (error) {
      alert("خطأ: " + (error instanceof Error ? error.message : "تعذر نشر القصة"));
    }
  };

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
      setStoryFile(file);
      setStoryMedia(URL.createObjectURL(file));
    } else if (file.type.startsWith("image/")) {
      setStoryType("image");
      if (storyMedia?.startsWith("blob:")) URL.revokeObjectURL(storyMedia);
      setStoryFile(null);
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
    <div className="relative min-h-screen overflow-x-hidden bg-[#080d1a] text-white" dir="rtl">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -right-32 top-24 h-72 w-72 rounded-full bg-purple-600/15 blur-3xl" />
        <div className="absolute -left-40 top-[42%] h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={storyFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleStoryFileChange} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1020]/80 shadow-lg shadow-black/20 backdrop-blur-xl">
        <div className="container mx-auto flex max-w-lg items-center gap-2 px-4 py-3.5">
          <button onClick={() => setLocation("/")} className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-white/70 transition hover:border-purple-300/40 hover:bg-purple-500/15 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-lg font-black tracking-wide text-white md:text-xl">
            {isOwnProfile ? "الملف الشخصي" : `ملف ${u?.name || "مستخدم"}`}
          </h1>
          {isOwnProfile && u?.isPremium && (
            <span className="flex items-center gap-1 rounded-full border border-yellow-300/40 bg-gradient-to-l from-yellow-300/20 to-orange-400/15 px-2.5 py-1.5 text-[10px] font-black text-yellow-200 shadow-lg shadow-yellow-950/20">
              <Crown className="w-3.5 h-3.5" /> VIP
            </span>
          )}
          {isOwnProfile && u?.role === 'admin' && (
            <button
              onClick={() => setLocation("/admin")}
              className="flex items-center gap-1 rounded-full border border-red-300/35 bg-gradient-to-l from-red-600/90 to-rose-500/80 px-2.5 py-1.5 text-[10px] font-black text-white shadow-lg shadow-red-950/20 transition hover:brightness-110"
            >
              <Shield className="w-3.5 h-3.5" /> أدمن
            </button>
          )}
          <button
            onClick={() => setLocation("/chat")}
            className="rounded-full border border-fuchsia-300/30 bg-gradient-to-l from-purple-600 to-fuchsia-500 px-3.5 py-2 text-xs font-black text-white shadow-lg shadow-purple-950/30 transition hover:brightness-110"
          >
            دردشة
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4 flex flex-col">

        {/* ── Story Upload Modal ─────────────────────────────────────────── */}
        {showStoryUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-800 w-full max-w-md rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-white font-bold">إضافة قصة جديدة</h3>
                <button onClick={() => { setShowStoryUpload(false); clearStoryMedia(); }} className="text-white/50 hover:text-white">
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
                        onClick={clearStoryMedia}
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
                      onClick={() => void publishStory()}
                      disabled={createStory.isPending || uploadStoryVideo.isPending}
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
        <section className="relative order-1 overflow-hidden rounded-[2rem] border border-purple-300/15 bg-[#141e32]/95 shadow-2xl shadow-purple-950/30">
          <div className="relative h-32 overflow-hidden bg-gradient-to-l from-indigo-700 via-purple-700 to-fuchsia-500">
            <div className="absolute -left-10 -top-20 h-56 w-56 rounded-full border-[28px] border-white/10" />
            <div className="absolute -right-16 top-4 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-2xl" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#141e32] to-transparent" />
            {isOwnProfile && u?.isPremium && (
              <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full border border-yellow-200/40 bg-yellow-300/90 px-3 py-1.5 text-xs font-black text-slate-900 shadow-xl shadow-yellow-950/20">
                <Crown className="w-3.5 h-3.5" /> عضو VIP
              </div>
            )}
          </div>

          <div className="relative px-5 pb-5 sm:px-6">
            <div className="mb-5 -mt-16 flex items-end gap-4">
              <div className="relative group">
                <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-[2rem] border-4 border-[#141e32] bg-slate-950 shadow-2xl shadow-black/40 ring-1 ring-white/15">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/70 to-fuchsia-500/70">
                      <User className="w-10 h-10 text-white/70" />
                    </div>
                  )}
                  {isOwnProfile && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Camera className="w-6 h-6 text-white" />
                    </button>
                  )}
                </div>
                {isOwnProfile && (
                  <button 
                    onClick={() => setShowStoryUpload(true)}
                    aria-label="إضافة قصة أو فيديو"
                    title="إضافة قصة أو فيديو"
                    className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-2xl border-2 border-[#141e32] bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-lg shadow-purple-950/40 transition-transform hover:scale-110"
                  >
                    <ImagePlus className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>

              <div className="flex-1 pb-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-lg font-black leading-tight text-white">{name || "مستخدم"}</p>
                  {u?.isVerified && <VerifiedBadge size={18} />}
                </div>
                <p className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${u?.isOnline ? "text-emerald-400" : "text-white/40"}`}>
                  <span className={`h-2 w-2 rounded-full ${u?.isOnline ? "bg-emerald-400" : "bg-white/25"}`} />
                  {u?.isOnline ? "متصل الآن" : "غير متصل"}
                </p>
                {isOwnProfile && memberSince && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
                    <Calendar className="w-3 h-3" /> عضو منذ {memberSince}
                  </p>
                )}
              </div>
              {isOwnProfile && u?.isPremium && <Shield className="w-5 h-5 text-green-400 mb-1" />}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.06] p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400" />
                  <span className={`text-yellow-400 font-bold text-lg ${!isOwnProfile ? 'blur-[4px] select-none' : ''}`}>
                    {isOwnProfile ? (walletQuery.data?.wallet ?? 0) : '—'}
                  </span>
                </div>
                <p className="text-white/50 text-xs">نجوم</p>
              </div>
              <div className="rounded-2xl border border-purple-300/10 bg-purple-300/[0.06] p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span className={`text-purple-400 font-bold text-lg ${!isOwnProfile ? 'blur-[4px] select-none' : ''}`}>
                    {isOwnProfile ? (balanceQuery.data?.credits ?? 0) : '—'}
                  </span>
                </div>
                <p className="text-white/50 text-xs">نقاط</p>
              </div>
              <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.06] p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Award className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400 font-bold text-lg">{isOwnProfile ? completionPct : '??'}%</span>
                </div>
                <p className="text-white/50 text-xs">اكتمال</p>
              </div>
            </div>

            {!isOwnProfile && (
              <div className="mt-3 rounded-2xl bg-purple-500/10 border border-purple-400/20 px-4 py-2 text-center">
                <p className="text-purple-100 text-[10px] font-semibold">بطاقة المستخدم العامة</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Public stories and videos / My active stories ─────────────── */}
        {myStoriesQuery.data && myStoriesQuery.data.length > 0 && (
          <section className="order-6 relative overflow-hidden rounded-[2rem] border border-fuchsia-300/15 bg-gradient-to-b from-[#18243b] to-[#10192b] p-5 shadow-2xl shadow-purple-950/25">
            <div className="pointer-events-none absolute -left-16 -top-20 h-44 w-44 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <h2 className="relative mb-4 flex items-center gap-3 font-black text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/80 to-purple-600/80 shadow-lg shadow-purple-950/30 ring-1 ring-white/20">
                <Play className="h-4 w-4 fill-white text-white" />
              </span>
              {isPublicProfile ? "قصص وفيديوهات المستخدم" : "قصصي النشطة"}
            </h2>
            <div className="relative grid grid-cols-2 gap-3">
              {myStoriesQuery.data.map((story: any, index: number) => (
                <div 
                  key={story.id} 
                  onClick={() => setSelectedStoryIndex(index)}
                  className="group relative aspect-[9/16] cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-fuchsia-300/40 hover:shadow-fuchsia-950/20"
                >
                  {story.mediaType === "video" ? (
                    <video src={story.mediaUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={story.mediaUrl} className="w-full h-full object-cover" />
                  )}
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/10 to-transparent p-2 transition-all group-hover:from-black/90">
                      <div className="flex items-center justify-between">
                        {isOwnProfile ? (
                          <>
                            <div className="flex gap-1.5 text-[10px] text-white">
                              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1 backdrop-blur-sm">
                                <Eye className="w-3 h-3" /> {story.viewCount || 0}
                              </span>
                              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1 backdrop-blur-sm">
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
                              className="rounded-xl border border-red-200/20 bg-red-500/80 p-1.5 text-white transition-colors hover:bg-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
                            {story.mediaType === "video" ? "فيديو" : "قصة"}
                          </span>
                        )}
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
             showViewCount={isOwnProfile}
          />
        )}

        {/* ── Profile completion ────────────────────────────────────────── */}
        {isOwnProfile && completionPct < 100 && (
          <section className="order-3" style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '16px' }}>
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

        {/* ── Private edit fields / public identity card ───────────────── */}
        {isOwnProfile ? (
          <section className="relative order-2 overflow-hidden rounded-[2rem] border border-purple-300/15 bg-[#172338] shadow-2xl shadow-purple-950/30">
            <div className="pointer-events-none absolute -left-16 -top-20 h-44 w-44 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 bottom-20 h-52 w-52 rounded-full bg-purple-500/15 blur-3xl" />
            <div className="relative border-b border-white/10 bg-gradient-to-l from-fuchsia-500/25 via-purple-500/15 to-transparent px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400/70 to-purple-600/70 shadow-lg shadow-purple-950/30 ring-1 ring-white/25">
                    <User className="h-6 w-6 text-white" />
                  </span>
                  <div>
                    <h2 className="font-black tracking-wide text-white">معلوماتك</h2>
                    <p className="mt-1 text-xs text-white/55">حدّث بياناتك لتظهر بصورة أفضل</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 rounded-full bg-gradient-to-l from-fuchsia-400 to-purple-400" />
              </div>
            </div>

            <div className="relative space-y-4 p-5">
              <div className="group">
                <label className="mb-2 flex items-center gap-2 text-xs font-bold text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]" />
                  الاسم
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/60 transition-colors group-focus-within:text-fuchsia-300" />
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="اسمك"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/65 py-3.5 pl-4 pr-11 text-white shadow-inner shadow-black/20 placeholder:text-white/25 outline-none transition-all focus:border-fuchsia-400/60 focus:bg-slate-950/90 focus:ring-4 focus:ring-fuchsia-500/10"
                  />
                </div>
              </div>

              <div className="group">
                <label className="mb-2 flex items-center gap-2 text-xs font-bold text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                  العمر
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/60 transition-colors group-focus-within:text-fuchsia-300" />
                  <input type="number" value={age} onChange={e => setAge(Number(e.target.value))} min={13} max={100}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/65 py-3.5 pl-4 pr-11 text-white shadow-inner shadow-black/20 outline-none transition-all focus:border-fuchsia-400/60 focus:bg-slate-950/90 focus:ring-4 focus:ring-fuchsia-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-bold text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                  الجنس
                </label>
                <div className="flex gap-2">
                  {([{ v: "male", l: "ذكر" }, { v: "female", l: "أنثى" }, { v: "other", l: "آخر" }] as const).map(({ v, l }) => (
                    <button key={v} onClick={() => setGender(v)}
                      className={`flex-1 rounded-2xl border py-2.5 text-sm font-bold transition-all ${
                        gender === v
                          ? "border-fuchsia-300/70 bg-gradient-to-l from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-purple-900/40 ring-2 ring-fuchsia-300/10"
                          : "border-white/10 bg-slate-950/35 text-white/55 hover:border-purple-400/40 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group">
                <label className="mb-2 flex items-center gap-2 text-xs font-bold text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]" />
                  نبذة عنك
                </label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="اكتب شيئاً عن نفسك..." rows={3}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3.5 text-white shadow-inner shadow-black/20 placeholder:text-white/25 outline-none transition-all focus:border-fuchsia-400/60 focus:bg-slate-950/90 focus:ring-4 focus:ring-fuchsia-500/10"
                />
              </div>

              <button
                onClick={() => {
                  setSaveError("");
                  saveProfile.mutate({ name, age, gender, bio, avatar: avatar || undefined });
                }}
                disabled={saveProfile.isPending}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-l from-fuchsia-500 via-purple-600 to-violet-600 py-3.5 font-bold text-white shadow-lg shadow-purple-900/30 transition hover:brightness-110 disabled:opacity-60"
              >
                <span className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-white/10 blur-xl" />
                {saved ? (
                  <><CheckCircle className="h-4 w-4" /> تم الحفظ!</>
                ) : saveProfile.isPending ? "جاري الحفظ..." : (
                  <><Save className="h-4 w-4" /> حفظ التغييرات</>
                )}
              </button>
              {saveError && (
                <p role="alert" className="text-center text-sm text-red-300">
                  {saveError}
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="order-2 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-800 to-slate-900 shadow-xl shadow-purple-950/20">
            <div className="border-b border-white/10 bg-gradient-to-l from-purple-500/15 via-fuchsia-500/10 to-transparent px-5 py-4">
              <h2 className="flex items-center gap-3 font-bold text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/20 ring-1 ring-purple-300/20">
                  <User className="h-5 w-5 text-purple-300" />
                </span>
                بطاقة المستخدم
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="mb-1 text-xs text-white/45">العمر</p>
                <p className="font-bold text-white">{u?.age ? `${u.age} سنة` : "غير محدد"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="mb-1 text-xs text-white/45">الجنس</p>
                <p className="font-bold text-white">
                  {u?.gender === "male" ? "ذكر" : u?.gender === "female" ? "أنثى" : "غير محدد"}
                </p>
              </div>
            </div>
            {u?.bio && (
              <p className="mx-5 mb-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-relaxed text-white/70">
                {u.bio}
              </p>
            )}
          </section>
        )}

        {/* ── Credits & Stars ───────────────────────────────────────────── */}
        {isOwnProfile && <section className="order-5 overflow-hidden rounded-3xl border border-yellow-300/15 bg-gradient-to-b from-slate-800 to-slate-900 shadow-xl shadow-yellow-950/10">
          <div className="border-b border-white/10 bg-gradient-to-l from-yellow-500/15 via-orange-500/10 to-transparent px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/15 ring-1 ring-yellow-300/25">
                  <Star className="h-5 w-5 fill-yellow-300 text-yellow-300" />
                </span>
                <div>
                  <h2 className="font-bold text-white">رصيد النجوم</h2>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-yellow-300/30 bg-yellow-400/10 px-3 py-1.5">
                <Star className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
                <span className="font-black text-yellow-200">{walletQuery.data?.wallet ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-4 rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.06] p-3.5">
              <p className="text-sm leading-6 text-white/60">استخدم نجومك لتفعيل رادار النجوم وإرسال هدايا افتراضية.</p>
            </div>

            <button onClick={() => setShowBuy(v => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/40 bg-gradient-to-l from-purple-600/20 to-fuchsia-500/20 py-3.5 font-bold text-purple-100 transition hover:border-purple-300/70 hover:from-purple-600/30 hover:to-fuchsia-500/30"
            >
              <ShoppingCart className="h-4 w-4" />
              {showBuy ? "إخفاء الباقات" : "شراء المزيد من النجوم"}
            </button>

            {showBuy && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-3.5 py-3 text-sm font-medium text-blue-200">
                  <span className="text-base">🔒</span>
                  <span>سيتم تفعيل الدفع قريباً</span>
                </div>
                {CREDIT_PACKAGES.map(pkg => (
                  <div key={pkg.credits} className={`relative flex items-center justify-between rounded-2xl border p-4 transition ${
                    pkg.popular
                      ? "border-purple-400/60 bg-gradient-to-l from-purple-500/20 to-fuchsia-500/10 shadow-lg shadow-purple-950/20"
                      : "border-white/10 bg-white/[0.04] hover:border-white/20"
                  }`}>
                    {pkg.popular && (
                      <span className="absolute -top-2.5 right-4 rounded-full border border-purple-300/30 bg-purple-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
                        الأكثر شيوعاً
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10">
                        <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                      </span>
                      <div>
                        <span className="block font-bold text-white">{pkg.credits} نجمة</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-purple-200">{pkg.price}</span>
                      <button disabled className="cursor-not-allowed rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white/35">قريباً</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>}

      </div>
    </div>
  );
}
