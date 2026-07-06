import { ShoppingBag, Star, Camera, Shield, Zap, Sparkles, ArrowRight, Crown, Copy, CheckCircle2, Wallet, Info } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Store() {
  const [location, setLocation] = useLocation();
  const { user, refresh: mutateAuth } = useAuth();
  const [payMethod, setPayMethod] = useState<'money' | 'credits'>('money');
  
  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: 'vip' | 'stars', amount: number, price: string } | null>(null);
  const [cryptoMethod, setCryptoMethod] = useState<'binance_pay' | 'usdt_trc20'>('binance_pay');
  const [txId, setTxId] = useState('');
  const [copied, setCopied] = useState(false);

  const queryParams = new URLSearchParams(window.location.search);
  const fromChat = queryParams.get('from') === 'chat';

  const { data: payConfig } = trpc.system.getPaymentConfig.useQuery();

  const handleBack = () => {
    if (fromChat) {
      sessionStorage.setItem('chat_auto_start', 'true');
      setLocation('/chat');
    } else {
      setLocation('/');
    }
  };

  /* ── mutations ─────────────────────────────────────────────────── */
  const submitPaymentMutation = trpc.gifts.submitPaymentRequest.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال طلبك بنجاح! سيتم تفعيل الميزة بعد مراجعة الإدارة (خلال 5-30 دقيقة).");
      setShowPayModal(false);
      setTxId('');
    },
    onError: (e) => toast.error(`فشل إرسال الطلب: ${e.message}`),
  });

  const upgradeWithCreditsMutation = trpc.gifts.upgradeWithCredits.useMutation({
    onSuccess: () => {
      toast.success("🎉 مرحباً بك في Premium! تم خصم 500 نقطة.");
      mutateAuth();
    },
    onError: (e) => toast.error(e.message),
  });

  /* ── data ──────────────────────────────────────────────────────── */
  const creditsQuery = trpc.gifts.getBalance.useQuery(undefined, { enabled: !!user });
  const userCredits  = creditsQuery.data?.credits ?? 0;
  const isPremium    = !!(user as any)?.isPremium;
  const PREMIUM_COST = 500;
  const canAfford    = userCredits >= PREMIUM_COST;

  // أسعار جديدة مخفضة
  const starPackages = [
    { amount: 50,  price: "$0.99",  label: "باقة المبتدئين" },
    { amount: 150, price: "$2.49",  label: "الباقة الاقتصادية", popular: true },
    { amount: 500, price: "$6.99", label: "باقة المحترفين" },
  ];

  const premiumFeatures = [
    { title: "تبديل الكاميرا",       icon: <Camera      className="w-5 h-5 text-blue-500"   /> },
    { title: "فلاتر Premium",         icon: <Sparkles    className="w-5 h-5 text-purple-500" /> },
    { title: "شارة ذهبية VIP",        icon: <Star        className="w-5 h-5 text-yellow-500" /> },
    { title: "100 نقطة مجانية/شهر",   icon: <Zap         className="w-5 h-5 text-orange-500" /> },
    { title: "فلتر الجنس والدولة",    icon: <Shield className="w-5 h-5 text-green-500"  /> },
    { title: "أولوية المطابقة",       icon: <ArrowRight  className="w-5 h-5 text-indigo-500" /> },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("تم النسخ بنجاح");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePayClick = (item: { type: 'vip' | 'stars', amount: number, price: string }) => {
    setSelectedItem(item);
    setShowPayModal(true);
  };

  const handleSubmitPayment = () => {
    if (!txId.trim()) {
      toast.error("يرجى إدخال رقم المعاملة (TXID)");
      return;
    }
    if (!selectedItem) return;

    submitPaymentMutation.mutate({
      amount: selectedItem.price,
      method: cryptoMethod,
      transactionId: txId,
      itemType: selectedItem.type,
      itemAmount: selectedItem.type === 'stars' ? selectedItem.amount : undefined
    });
  };

  /* ── render ────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-10">

        {/* Back button */}
        <div className="mb-8 flex justify-start">
          <button
            onClick={handleBack}
            className="group flex items-center gap-3 px-5 py-2.5 bg-gradient-to-b from-yellow-300 to-yellow-500 text-gray-900 font-bold rounded-2xl shadow-[0_4px_0_0_#a16207] active:shadow-none active:translate-y-1 transition-all hover:brightness-110"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            {fromChat ? 'العودة للدردشة' : 'الصفحة الرئيسية'}
          </button>
        </div>

        {/* Page title */}
        <div className="text-center mb-10">
          <Badge className="mb-3 px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">
            عروض حصرية
          </Badge>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
            <ShoppingBag className="w-8 h-8 text-purple-600" />
            متجر ConnectLive
          </h1>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">
            ارتقِ بتجربتك مع ميزات Premium — اشترِ عبر Binance Pay أو USDT.
          </p>
        </div>

        {/* ══ Premium Card ══════════════════════════════════════════ */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative overflow-hidden rounded-3xl border-2 border-purple-400 shadow-2xl shadow-purple-200 bg-white">

            {/* VIP badge */}
            <div className="absolute top-0 left-0 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-5 py-1.5 rounded-br-2xl font-black text-sm flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" /> VIP
            </div>

            <div className="p-6 pt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Premium VIP</h2>
                  <p className="text-gray-400 text-xs">الباقة الكاملة للمحترفين</p>
                </div>
                {isPremium && (
                  <span className="mr-auto bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                    ✓ مشترك حالياً
                  </span>
                )}
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-7">
                {premiumFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    {f.icon}
                    <span className="text-gray-700 text-sm font-medium">{f.title}</span>
                  </div>
                ))}
              </div>

              {/* ── Payment method toggle ─────────────────────────── */}
              {!isPremium && (
                <>
                  <div className="flex gap-2 mb-5 p-1 bg-gray-100 rounded-2xl">
                    <button
                      onClick={() => setPayMethod('money')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        payMethod === 'money'
                          ? 'bg-white shadow text-purple-700'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      💰 دفع رقمي (Binance)
                    </button>
                    <button
                      onClick={() => setPayMethod('credits')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        payMethod === 'credits'
                          ? 'bg-white shadow text-yellow-700'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" /> بنقاطي
                    </button>
                  </div>

                  {/* Money option */}
                  {payMethod === 'money' && (
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-center gap-1 mb-4">
                        <span className="text-4xl font-black text-gray-900">$2.99</span>
                        <span className="text-gray-400 text-sm">/شهرياً</span>
                      </div>
                      <Button
                        onClick={() => handlePayClick({ type: 'vip', amount: 0, price: '$2.99' })}
                        className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:brightness-110 text-white font-black py-6 text-base rounded-2xl shadow-lg shadow-purple-300/40 transition-all gap-2"
                      >
                        <Sparkles className="w-5 h-5" /> اشترك الآن عبر Binance/USDT
                      </Button>
                    </div>
                  )}

                  {/* Credits option */}
                  {payMethod === 'credits' && (
                    <div className="space-y-4">
                      {/* Progress bar */}
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-700">رصيدك الحالي</span>
                          <span className={`text-base font-black ${canAfford ? 'text-green-600' : 'text-red-500'}`}>
                            <Zap className="w-3.5 h-3.5 inline mb-0.5 mr-0.5" />
                            {userCredits} / {PREMIUM_COST}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-700 ${canAfford ? 'bg-green-500' : 'bg-yellow-400'}`}
                            style={{ width: `${Math.min(100, (userCredits / PREMIUM_COST) * 100)}%` }}
                          />
                        </div>
                        {!canAfford && (
                          <p className="text-xs text-gray-400 mt-1.5 text-right">
                            تحتاج <span className="font-bold text-yellow-600">{PREMIUM_COST - userCredits} نقطة إضافية</span> — تجمّعها من المكافأة اليومية والهدايا.
                          </p>
                        )}
                      </div>

                      <Button
                        onClick={() => upgradeWithCreditsMutation.mutate()}
                        disabled={!canAfford || upgradeWithCreditsMutation.isPending}
                        className={`w-full font-black py-6 text-base rounded-2xl shadow-lg transition-all gap-2 ${
                          canAfford
                            ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:brightness-110 text-gray-900 shadow-orange-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {upgradeWithCreditsMutation.isPending
                          ? <><Zap className="w-5 h-5 animate-spin" /> جاري الخصم...</>
                          : canAfford
                            ? <><Zap className="w-5 h-5" /> اشترك بـ 500 نقطة ⚡</>
                            : <><Zap className="w-5 h-5" /> رصيد غير كافٍ ({userCredits}/{PREMIUM_COST})</>
                        }
                      </Button>
                    </div>
                  )}
                </>
              )}

              {isPremium && (
                <div className="text-center py-4 bg-green-50 rounded-2xl border border-green-200">
                  <p className="text-green-700 font-black text-base">✨ أنت مشترك بالفعل في Premium</p>
                  <p className="text-green-500 text-xs mt-1">استمتع بجميع الميزات الحصرية!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ Star Packages ═════════════════════════════════════════ */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-5 text-center flex items-center justify-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            شحن النجوم
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {starPackages.map((pkg, i) => (
              <Card key={i} className={`relative overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-lg ${pkg.popular ? 'border-yellow-400 shadow-md' : 'border-gray-200'}`}>
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-gray-900 px-3 py-1 rounded-bl-xl font-black text-[10px] uppercase">
                    الأكثر توفيراً ⭐
                  </div>
                )}
                <CardHeader className="text-center pb-2 pt-8">
                  <div className="mx-auto w-11 h-11 bg-yellow-50 rounded-full flex items-center justify-center mb-2 border border-yellow-200">
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                  </div>
                  <CardTitle className="text-2xl font-black text-gray-900">{pkg.amount} نجمة</CardTitle>
                  <CardDescription className="text-xs font-bold text-gray-400">{pkg.label}</CardDescription>
                </CardHeader>
                <CardContent className="text-center pb-6">
                  <div className="text-2xl font-black text-purple-600">{pkg.price}</div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handlePayClick({ type: 'stars', amount: pkg.amount, price: pkg.price })}
                    className={`w-full font-bold rounded-xl py-5 ${pkg.popular ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                  >
                    شحن الآن
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />

      {/* ══ Payment Modal ══════════════════════════════════════════ */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <Wallet className="w-6 h-6 text-purple-400" />
                تأكيد عملية الدفع
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm mt-1">
                اختر وسيلة الدفع المفضلة لديك وقم بالتحويل.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 bg-white space-y-6">
            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div>
                <p className="text-gray-400 text-[10px] font-bold uppercase mb-0.5">المنتج</p>
                <p className="text-gray-900 font-black text-sm">
                  {selectedItem?.type === 'vip' ? 'اشتراك Premium VIP' : `${selectedItem?.amount} نجمة`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-[10px] font-bold uppercase mb-0.5">المبلغ</p>
                <p className="text-purple-600 font-black text-lg">{selectedItem?.price}</p>
              </div>
            </div>

            {/* Crypto Tabs */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
              <button
                onClick={() => setCryptoMethod('binance_pay')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  cryptoMethod === 'binance_pay' ? 'bg-white shadow text-gray-900' : 'text-gray-400'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-[8px] font-black text-gray-900">B</div>
                Binance Pay
              </button>
              <button
                onClick={() => setCryptoMethod('usdt_trc20')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  cryptoMethod === 'usdt_trc20' ? 'bg-white shadow text-gray-900' : 'text-gray-400'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[8px] font-black text-white">T</div>
                USDT (TRC20)
              </button>
            </div>

            {/* Address Box */}
            <div className="p-5 bg-yellow-50/50 border border-yellow-100 rounded-2xl text-center relative">
              <p className="text-yellow-700 text-[10px] font-black uppercase mb-2">
                {cryptoMethod === 'binance_pay' ? 'Binance Pay ID' : 'USDT TRC20 Address'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <code className="text-gray-900 font-black text-base tracking-wider">
                  {cryptoMethod === 'binance_pay' 
                    ? (payConfig?.binancePayId || '813764011') 
                    : (payConfig?.usdtAddress || 'سيظهر العنوان هنا')}
                </code>
                <button 
                  onClick={() => copyToClipboard(cryptoMethod === 'binance_pay' ? (payConfig?.binancePayId || '813764011') : (payConfig?.usdtAddress || ''))}
                  className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4 text-yellow-600" />
                </button>
              </div>
              <p className="mt-3 text-[10px] text-yellow-600 font-medium">
                * يرجى تحويل المبلغ الموضح أعلاه بدقة لضمان سرعة التفعيل.
              </p>
            </div>

            {/* TXID Input */}
            <div className="space-y-3">
              <Label className="text-gray-900 font-black text-sm flex items-center gap-2">
                رقم المعاملة (TXID / Order ID)
                <div className="group relative">
                  <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    تجد هذا الرقم في تطبيق Binance بعد إتمام التحويل في تفاصيل العملية.
                  </div>
                </div>
              </Label>
              <Input
                placeholder="أدخل رقم المعاملة هنا للتأكيد..."
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                className="rounded-xl border-gray-200 py-6 text-center font-mono text-sm focus:ring-purple-500"
              />
              <p className="text-[10px] text-gray-400 text-center">
                سيقوم الأدمن بمراجعة هذا الرقم وتفعيل طلبك خلال دقائق.
              </p>
            </div>

            <Button
              onClick={handleSubmitPayment}
              disabled={submitPaymentMutation.isPending}
              className="w-full bg-gray-900 hover:bg-black text-white font-black py-6 rounded-2xl text-base shadow-xl transition-all"
            >
              {submitPaymentMutation.isPending ? "جاري الإرسال..." : "تأكيد عملية الدفع"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
