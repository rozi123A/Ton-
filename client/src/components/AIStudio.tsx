import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Plus,
  Search,
  Send,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";

type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeocodeResult = {
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  }>;
  status?: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let offset = 0; offset < chunk.length; offset += 1) {
      binary += String.fromCharCode(chunk[offset]);
    }
  }
  return window.btoa(binary);
}

export default function AIStudio({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"chat" | "image" | "voice" | "map">("chat");
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mapAddress, setMapAddress] = useState("");
  const [mapResult, setMapResult] = useState<GeocodeResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedInitialConversation = useRef(false);
  const utils = trpc.useUtils();

  const conversationsQuery = trpc.ai.listConversations.useQuery();
  const conversationMessagesQuery = trpc.ai.getConversationMessages.useQuery(
    { conversationId: conversationId as number },
    { enabled: conversationId !== null },
  );
  const imagesQuery = trpc.ai.listImages.useQuery();

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (
      !hasLoadedInitialConversation.current &&
      conversationsQuery.data &&
      conversationsQuery.data.length > 0
    ) {
      hasLoadedInitialConversation.current = true;
      setConversationId(conversationsQuery.data[0].id);
    }
  }, [conversationsQuery.data]);

  useEffect(() => {
    if (conversationMessagesQuery.data && conversationId !== null) {
      setMessages(
        conversationMessagesQuery.data.map(message => ({
          role: message.role,
          content: message.content,
        })),
      );
    }
  }, [conversationMessagesQuery.data, conversationId]);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: data => {
      setMessages(current => [...current, { role: "assistant", content: data.text }]);
      setConversationId(data.conversationId);
      void utils.ai.listConversations.invalidate();
      void utils.ai.getConversationMessages.invalidate({ conversationId: data.conversationId });
    },
    onError: error => toast.error(error.message),
  });
  const imageMutation = trpc.ai.generateImage.useMutation({
    onSuccess: data => {
      if (!data.url) {
        toast.error("لم تُرجع خدمة الصور رابطاً صالحاً.");
        return;
      }
      setImageUrl(data.url);
      void utils.ai.listImages.invalidate();
      toast.success("تم إنشاء الصورة.");
    },
    onError: error => toast.error(error.message),
  });
  const voiceMutation = trpc.ai.transcribe.useMutation({
    onSuccess: data => {
      setVoiceText(data.text);
      toast.success("تم تحويل الصوت إلى نص.");
    },
    onError: error => toast.error(error.message),
  });
  const mapQuery = trpc.maps.geocode.useQuery(
    { address: mapAddress, language: "ar" },
    { enabled: false },
  );

  useEffect(() => {
    if (mapQuery.data) {
      setMapResult(mapQuery.data as GeocodeResult);
    }
  }, [mapQuery.data]);

  const sendChat = () => {
    const value = prompt.trim();
    if (!value || chatMutation.isPending) return;
    const nextMessages = [...messages, { role: "user" as const, content: value }];
    setMessages(nextMessages);
    setPrompt("");
    chatMutation.mutate({
      messages: nextMessages,
      conversationId: conversationId ?? undefined,
      maxTokens: 500,
    });
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setPrompt("");
  };

  const selectConversation = (id: number) => {
    if (id === conversationId) return;
    setMessages([]);
    setConversationId(id);
  };

  const generateImage = () => {
    const value = imagePrompt.trim();
    if (!value || imageMutation.isPending) return;
    setImageUrl("");
    imageMutation.mutate({ prompt: value, quality: "medium" });
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error("المتصفح لا يدعم تسجيل الصوت.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (!blob.size) return;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        voiceMutation.mutate({
          audioBase64: bytesToBase64(bytes),
          mimeType: (recorder.mimeType || "audio/webm").split(";")[0],
          language: "ar",
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("تعذر الوصول إلى الميكروفون. اسمح للموقع باستخدامه ثم حاول مرة أخرى.");
    }
  };

  const searchMap = () => {
    const value = mapAddress.trim();
    if (!value || mapQuery.isFetching) return;
    setMapResult(null);
    mapQuery.refetch();
  };

  const tabs = [
    { id: "chat" as const, label: "مساعد ذكي", icon: WandSparkles },
    { id: "image" as const, label: "توليد صورة", icon: ImageIcon },
    { id: "voice" as const, label: "تحويل صوت", icon: Mic },
    { id: "map" as const, label: "خرائط", icon: MapPin },
  ];

  const location = mapResult?.results?.[0]?.geometry?.location;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" dir="rtl">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black">
               <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-blue-500 to-purple-600 shadow-lg shadow-cyan-500/25">
                 <WandSparkles className="h-5 w-5 text-white" />
               </span>
              أدوات ConnectLive الذكية
            </h2>
            <p className="mt-1 text-xs text-white/50">الخدمات تعمل من الخادم ولا تكشف مفاتيحها للمتصفح.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 border-b border-white/10 bg-white/[0.03] p-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition ${
                  activeTab === tab.id ? "bg-cyan-500/20 text-cyan-200" : "text-white/55 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {activeTab === "chat" && (
            <div className="flex min-h-[360px] flex-col">
              <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={startNewConversation}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  محادثة جديدة
                </button>
                {conversationsQuery.data?.map(conversation => (
                  <button
                    key={conversation.id}
                    onClick={() => selectConversation(conversation.id)}
                    className={`max-w-[180px] shrink-0 truncate rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      conversation.id === conversationId
                        ? "bg-white/15 text-white"
                        : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                    }`}
                    title={conversation.title}
                  >
                    {conversation.title}
                  </button>
                ))}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                {messages.length === 0 && (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-white/50">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-300/20 via-blue-500/20 to-purple-500/25 ring-1 ring-cyan-200/20">
                      <Sparkles className="h-8 w-8 text-cyan-200" />
                    </div>
                    <p className="font-bold text-white/80">اسأل المساعد عن أي شيء</p>
                    <p className="mt-1 text-xs">اكتب سؤالك بالعربية أو بأي لغة تريدها.</p>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      message.role === "user" ? "bg-purple-600/80" : "bg-cyan-500/15 text-cyan-50"
                    }`}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    المساعد يفكر...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="mt-3 flex gap-2">
                <textarea
                  value={prompt}
                  onChange={event => setPrompt(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder="اكتب رسالتك..."
                  className="min-h-12 flex-1 resize-none rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-sm outline-none placeholder:text-white/35 focus:border-cyan-400"
                />
                <button onClick={sendChat} disabled={!prompt.trim() || chatMutation.isPending} className="rounded-2xl bg-cyan-500 px-4 text-slate-950 disabled:opacity-40">
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {activeTab === "image" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <label className="mb-2 block text-sm font-bold">وصف الصورة</label>
                <textarea
                  value={imagePrompt}
                  onChange={event => setImagePrompt(event.target.value)}
                  placeholder="مثال: منظر طبيعي هادئ عند الغروب بأسلوب واقعي"
                  className="min-h-28 w-full resize-none rounded-xl border border-white/15 bg-white/10 p-3 text-sm outline-none placeholder:text-white/35 focus:border-pink-400"
                />
                <button onClick={generateImage} disabled={!imagePrompt.trim() || imageMutation.isPending} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 font-bold disabled:opacity-40">
                  {imageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  إنشاء الصورة
                </button>
              </div>
              {imageUrl && (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <img src={imageUrl} alt="الصورة المنشأة بالذكاء الاصطناعي" className="max-h-[420px] w-full object-contain" />
                  <a href={imageUrl} download className="block border-t border-white/10 p-3 text-center text-sm font-bold text-pink-200 hover:bg-white/10">
                    فتح أو تنزيل الصورة
                  </a>
                </div>
              )}
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white/85">سجل الصور</h3>
                    <p className="mt-1 text-[11px] text-white/45">تظهر هنا الصور التي أنشأتها في حسابك.</p>
                  </div>
                  {imagesQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
                </div>
                {imagesQuery.data && imagesQuery.data.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {imagesQuery.data.map(image => (
                      <button
                        key={image.id}
                        onClick={() => setImageUrl(image.imageUrl)}
                        className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20 text-right transition hover:border-pink-300/50 hover:shadow-lg hover:shadow-pink-500/10"
                        title={image.prompt}
                      >
                        <img src={image.imageUrl} alt={image.prompt} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                        <span className="block truncate p-2 text-[11px] text-white/60">{image.prompt}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-white/40">
                    <WandSparkles className="mb-2 h-5 w-5 text-pink-200/60" />
                    <p className="text-xs">لا توجد صور محفوظة بعد</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "voice" && (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={voiceMutation.isPending}
                className={`mb-4 flex h-20 w-20 items-center justify-center rounded-full transition ${
                  isRecording ? "bg-red-500 shadow-lg shadow-red-500/30" : "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30"
                } disabled:opacity-40`}
                aria-label={isRecording ? "إيقاف التسجيل" : "بدء التسجيل"}
              >
                {voiceMutation.isPending ? <Loader2 className="h-8 w-8 animate-spin" /> : isRecording ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8" />}
              </button>
              <p className="font-bold">{isRecording ? "جارٍ التسجيل، اضغط للإيقاف" : "اضغط لتسجيل مقطع صوتي"}</p>
              <p className="mt-2 max-w-sm text-xs text-white/50">سيتم رفع التسجيل بشكل مؤقت إلى التخزين ثم تحويله إلى نص عبر خدمة الصوت.</p>
              {voiceText && (
                <div className="mt-6 w-full rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-right text-sm leading-7">
                  {voiceText}
                </div>
              )}
            </div>
          )}

          {activeTab === "map" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={mapAddress}
                  onChange={event => setMapAddress(event.target.value)}
                  onKeyDown={event => event.key === "Enter" && searchMap()}
                  placeholder="اكتب عنواناً أو مدينة..."
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm outline-none placeholder:text-white/35 focus:border-cyan-400"
                />
                <button onClick={searchMap} disabled={!mapAddress.trim() || mapQuery.isFetching} className="rounded-xl bg-cyan-500 px-4 text-slate-950 disabled:opacity-40">
                  {mapQuery.isFetching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </button>
              </div>
              {mapQuery.error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{mapQuery.error.message}</p>}
              {mapResult && location && (
                <>
                  <p className="flex items-center gap-2 text-sm text-cyan-100">
                    <MapPin className="h-4 w-4" />
                    {mapResult.results?.[0]?.formatted_address || "تم العثور على الموقع"}
                  </p>
                  <MapView initialCenter={location} initialZoom={14} className="h-[320px] overflow-hidden rounded-2xl" />
                </>
              )}
              {mapResult && !location && <p className="rounded-xl bg-yellow-500/10 p-3 text-sm text-yellow-100">لم يتم العثور على إحداثيات لهذا العنوان.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}