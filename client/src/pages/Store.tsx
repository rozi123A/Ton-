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
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Store() {
  const { t: translate, isRTL } = useTranslation();
  const t = (key: string) => translate(key);
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
      toast.success(isRTL ? '🎉 تم! ستحصل على ميزاتك فوراً.' : '🎉 Done! Your features are now active.');
      mutateAuth();
      setShowPayModal(false);
      setTxId('');
    },
    onError: (e) => toast.error(`${t('store.payment_modal.error_msg')}: ${e.message}`),
  });

  const upgradeWithCreditsMutation = trpc.gifts.upgradeWithCredits.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "🎉 مرحباً بك في Premium! تم خصم 500 نقطة." : "🎉 Welcome to Premium! 500 points deducted.");
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

  const starPackages = [
    { amount: 50,  price: "$0.99",  label: t('store.stars_pack_1') },
    { amount: 150, price: "$2.49",  label: t('store.stars_pack_2'), popular: true },
    { amount: 500, price: "$6.99", label: t('store.stars_pack_3') },
  ];

  const premiumFeatures = [
    { title: t('store.features.cam'),       icon: <Camera      className="w-5 h-5 text-blue-500"   /> },
    { title: t('store.features.filters'),   icon: <Sparkles    className="w-5 h-5 text-purple-500" /> },
    { title: t('store.features.badge'),     icon: <Star        className="w-5 h-5 text-yellow-500" /> },
    { title: t('store.features.points'),    icon: <Zap         className="w-5 h-5 text-orange-500" /> },
    { title: t('store.features.shield'),    icon: <Shield      className="w-5 h-5 text-green-500"  /> },
    { title: t('store.features.priority'),  icon: <ArrowRight  className="w-5 h-5 text-indigo-500" /> },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t('store.payment_modal.copy_success'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePayClick = (item: { type: 'vip' | 'stars', amount: number, price: string }) => {
    setSelectedItem(item);
    setShowPayModal(true);
  };

  const handleSubmitPayment = () => {
    if (!txId.trim()) {
      toast.error(isRTL ? 'يرجى إدخال عنوان USDT الخاص بك' : 'Please enter your USDT address');
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-10">
        <div className="mb-8 flex justify-start">
          <button
            onClick={handleBack}
            className="group flex items-center gap-3 px-5 py-2.5 bg-gradient-to-b from-yellow-300 to-yellow-500 text-gray-900 font-bold rounded-2xl shadow-[0_4px_0_0_#a16207] active:shadow-none active:translate-y-1 transition-all hover:brightness-110"
          >
            <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            {fromChat ? t('common.back') : t('nav.features')}
          </button>
        </div>

        <div className="text-center mb-10">
          <Badge className="mb-3 px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">
            {t('store.exclusive')}
          </Badge>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
            <ShoppingBag className="w-8 h-8 text-purple-600" />
            {t('store.title')}
          </h1>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">
            {t('store.desc')}
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative overflow-hidden rounded-3xl border-2 border-purple-400 shadow-2xl shadow-purple-200 bg-white">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-5 py-1.5 rounded-br-2xl font-black text-sm flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" /> {t('store.vip_badge')}
            </div>

            <div className="p-6 pt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">{t('store.vip_title')}</h2>
                  <p className="text-gray-400 text-xs">{t('store.vip_desc')}</p>
                </div>
                {isPremium && (
                  <span className="mr-auto bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                    ✓ {t('store.current_sub')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-7">
                {premiumFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    {f.icon}
                    <span className="text-gray-700 text-sm font-medium">{f.title}</span>
                  </div>
                ))}
              </div>

              {!isPremium && (
                <>
                  <div className="flex gap-2 mb-5 p-1 bg-gray-100 rounded-2xl">
                    <button
                      onClick={() => setPayMethod('money')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        payMethod === 'money' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {t('store.digital_pay')}
                    </button>
                    <button
                      onClick={() => setPayMethod('credits')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        payMethod === 'credits' ? 'bg-white shadow text-yellow-700' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" /> {t('store.my_points')}
                    </button>
                  </div>

                  {payMethod === 'money' && (
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-center gap-1 mb-4">
                        <span className="text-4xl font-black text-gray-900">$2.99</span>
                        <span className="text-gray-400 text-sm">{t('store.monthly')}</span>
                      </div>
                      <Button
                        onClick={() => handlePayClick({ type: 'vip', amount: 0, price: '$2.99' })}
                        className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:brightness-110 text-white font-black py-6 text-base rounded-2xl shadow-lg shadow-purple-300/40 transition-all gap-2"
                      >
                        <Sparkles className="w-5 h-5" /> {t('store.subscribe_now')}
                      </Button>
                    </div>
                  )}

                  {payMethod === 'credits' && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-700">{t('store.balance')}</span>
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
                          <p className="text-xs text-gray-400 mt-1.5">
                            {t('store.need_more')} <span className="font-bold text-yellow-600">{PREMIUM_COST - userCredits} {t('store.points_extra')}</span> — {t('store.collect_daily')}
                          </p>
                        )}
                      </div>

                      <Button
                        onClick={() => upgradeWithCreditsMutation.mutate()}
                        disabled={!canAfford || upgradeWithCreditsMutation.isPending}
                        className={`w-full font-black py-6 text-base rounded-2xl shadow-lg transition-all gap-2 ${
                          canAfford ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:brightness-110 text-gray-900 shadow-orange-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {upgradeWithCreditsMutation.isPending ? t('store.deducting') : canAfford ? t('store.points_btn') : `${t('store.insufficient_balance')} (${userCredits}/${PREMIUM_COST})`}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {isPremium && (
                <div className="text-center py-4 bg-green-50 rounded-2xl border border-green-200">
                  <p className="text-green-700 font-black text-base">✨ {t('store.already_premium')}</p>
                  <p className="text-green-500 text-xs mt-1">{t('store.enjoy_features')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-5 text-center flex items-center justify-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            {t('store.stars_recharge')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {starPackages.map((pkg, i) => (
              <Card key={i} className={`relative overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-lg ${pkg.popular ? 'border-yellow-400 shadow-md' : 'border-gray-200'}`}>
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-gray-900 px-3 py-1 rounded-bl-xl font-black text-[10px] uppercase">
                    {t('store.most_popular')}
                  </div>
                )}
                <CardHeader className="text-center pb-2 pt-8">
                  <div className="mx-auto w-11 h-11 bg-yellow-50 rounded-full flex items-center justify-center mb-2">
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                  </div>
                  <CardTitle className="text-2xl font-black">{pkg.amount} {t('store.stars_count')}</CardTitle>
                  <CardDescription className="font-bold text-purple-600">{pkg.label}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-black text-gray-900">{pkg.price}</div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handlePayClick({ type: 'stars', amount: pkg.amount, price: pkg.price })}
                    className="w-full bg-gray-900 hover:bg-black text-white rounded-xl font-bold"
                  >
                    {t('store.buy_now')}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />

      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none bg-gray-900 text-white overflow-hidden p-0">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-8 text-center">
            <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-xl border border-white/30">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black text-white mb-2">{t('store.pay_modal_title')}</DialogTitle>
            <DialogDescription className="text-white/80 text-sm">
            {isRTL
              ? 'أرسل المبلغ على العنوان أدناه ثم أدخل عنوان USDT الخاص بك للتفعيل الفوري'
              : 'Send the amount to the address below, then enter your USDT address for instant activation'}
          </DialogDescription>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="text-center border-r border-white/10">
                <p className="text-white/40 text-[10px] uppercase font-bold mb-1">{t('store.product')}</p>
                <p className="text-sm font-bold">{selectedItem?.type === 'vip' ? t('store.vip_title') : `${selectedItem?.amount} ${t('store.stars_count')}`}</p>
              </div>
              <div className="text-center">
                <p className="text-white/40 text-[10px] uppercase font-bold mb-1">{t('store.amount')}</p>
                <p className="text-lg font-black text-pink-400">{selectedItem?.price}</p>
              </div>
            </div>

            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
              <button
                onClick={() => setCryptoMethod('usdt_trc20')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                  cryptoMethod === 'usdt_trc20' ? 'bg-white text-gray-900 shadow-xl scale-[1.02]' : 'text-white/40 hover:text-white/60'
                }`}
              >
                USDT (TRC20) <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px]">T</span>
              </button>
              <button
                onClick={() => setCryptoMethod('binance_pay')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                  cryptoMethod === 'binance_pay' ? 'bg-white text-gray-900 shadow-xl scale-[1.02]' : 'text-white/40 hover:text-white/60'
                }`}
              >
                Binance Pay <span className="w-5 h-5 bg-yellow-500 text-white rounded-full flex items-center justify-center text-[10px]">B</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Label className="text-xs font-bold text-white/60 uppercase tracking-wider">
                  {cryptoMethod === 'binance_pay' ? 'Binance Pay ID' : 'USDT Wallet (TRC20)'}
                </Label>
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur group-hover:blur-md transition-all" />
                <div className="relative flex items-center bg-gray-800 border border-white/10 rounded-2xl p-1">
                  <div className="flex-1 px-4 py-3 font-mono text-sm text-white/90 truncate">
                    {cryptoMethod === 'binance_pay' ? (payConfig?.binancePayId || '813764011') : (payConfig?.usdtAddress || 'Txxxxxxxxxxxxxxxxxxxxxxxxx')}
                  </div>
                  <button
                    onClick={() => copyToClipboard(cryptoMethod === 'binance_pay' ? (payConfig?.binancePayId || '813764011') : (payConfig?.usdtAddress || 'Txxxxxxxxxxxxxxxxxxxxxxxxx'))}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-yellow-500/80 italic px-1">
                * {isRTL ? 'يرجى تحويل المبلغ الموضح أعلاه بدقة لضمان سرعة التفعيل.' : 'Please transfer the exact amount shown above for fast activation.'}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                {isRTL ? 'عنوان USDT الخاص بك (TRC20)' : 'Your USDT Address (TRC20)'}
                <Info className="w-3 h-3 text-blue-400 cursor-help" title={t('store.txid_help')} />
              </Label>
              <Input
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                placeholder={isRTL ? 'أدخل عنوان USDT الخاص بك هنا...' : 'Enter your USDT address...'}
                className="bg-gray-800 border-white/10 rounded-2xl py-6 text-white placeholder:text-white/20 focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          <DialogFooter className="p-6 pt-0">
            <Button
              onClick={handleSubmitPayment}
              disabled={submitPaymentMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 text-white font-black py-7 text-lg rounded-2xl shadow-2xl shadow-purple-900/40 transition-all border-t border-white/20"
            >
              {submitPaymentMutation.isPending
    ? (isRTL ? '⏳ جاري التفعيل...' : '⏳ Activating...')
    : (isRTL ? '✅ تأكيد وتفعيل فوري' : '✅ Confirm & Activate Now')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
