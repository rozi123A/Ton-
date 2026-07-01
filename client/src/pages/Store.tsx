import { ShoppingBag, Star, Camera, ShieldCheck, Zap, Sparkles, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function Store() {
  const [location, setLocation] = useLocation();
  const { user, mutate: mutateAuth } = useAuth();
  
  const queryParams = new URLSearchParams(window.location.search);
  const fromChat = queryParams.get('from') === 'chat';

  const handleBack = () => {
    if (fromChat) {
      sessionStorage.setItem('chat_auto_start', 'true');
      setLocation('/chat');
    } else {
      setLocation('/');
    }
  };
  const upgradeMutation = trpc.gifts.upgrade.useMutation({
    onSuccess: () => {
      toast.success("تم تفعيل اشتراك Premium بنجاح! استمتع بالميزات الحصرية.");
      mutateAuth(); // Refresh user data to update isPremium status
    },
    onError: (error) => {
      toast.error(`فشل الاشتراك: ${error.message}`);
    }
  });

  const handleUpgrade = () => {
    if ((user as any)?.isPremium) {
      toast.info("أنت مشترك بالفعل في باقة Premium.");
      return;
    }
    upgradeMutation.mutate();
  };
  const premiumFeatures = [
    {
      title: "تبديل الكاميرا",
      description: "القدرة على التبديل بين الكاميرا الأمامية والخلفية أثناء الدردشة.",
      icon: <Camera className="w-6 h-6 text-blue-500" />,
    },
    {
      title: "فلاتر Premium",
      description: "وصول غير محدود إلى فلاتر الوجه المتقدمة والمؤثرات البصرية.",
      icon: <Sparkles className="w-6 h-6 text-purple-500" />,
    },
    {
      title: "شارة ذهبية VIP",
      description: "تظهر شارة ذهبية مميزة بجانب اسمك في جميع أنحاء المنصة.",
      icon: <Star className="w-6 h-6 text-yellow-500" />,
    },
    {
      title: "100 نقطة مجانية",
      description: "احصل على 100 نقطة شهرياً لاستخدامها في الهدايا والميزات الخاصة.",
      icon: <Zap className="w-6 h-6 text-orange-500" />,
    },
    {
      title: "فلتر الجنس والدولة",
      description: "تحديد من تريد مقابلته بناءً على الموقع الجغرافي والجنس.",
      icon: <ShieldCheck className="w-6 h-6 text-green-500" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="mb-10 flex justify-start">
          <button 
            onClick={handleBack}
            className="group relative flex items-center gap-3 px-6 py-3 bg-gradient-to-b from-yellow-300 to-yellow-500 text-gray-900 font-bold rounded-2xl shadow-[0_4px_0_0_#a16207] active:shadow-none active:translate-y-1 transition-all hover:brightness-110"
          >
            <div className="bg-white/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowRight className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm leading-tight">العودة مباشرة</span>
              <span className="text-[10px] opacity-70 uppercase tracking-wider">{fromChat ? 'للدردشة الآن' : 'للصفحة الرئيسية'}</span>
            </div>
            {fromChat && (
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full animate-bounce shadow-lg border-2 border-white">
                !
              </div>
            )}
          </button>
        </div>

        <div className="text-center mb-12">
          <Badge className="mb-4 px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">
            عروض حصرية
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-3">
            <ShoppingBag className="w-10 h-10 text-purple-600" />
            متجر ConnectLive
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            ارتقِ بتجربتك إلى المستوى التالي مع مميزات Premium الحصرية.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Premium Card */}
          <Card className="relative overflow-hidden border-2 border-purple-500 shadow-xl lg:col-span-1">
            <div className="absolute top-0 right-0 bg-purple-500 text-white px-4 py-1 rounded-bl-lg font-bold text-sm">
              الأكثر شعبية
            </div>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold">Premium VIP</CardTitle>
              <CardDescription>الباقة الكاملة للمحترفين</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="my-6">
                <span className="text-5xl font-bold text-purple-600">$9.99</span>
                <span className="text-gray-500">/شهرياً</span>
              </div>
              <ul className="text-right space-y-4 mb-6">
                {premiumFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-700">
                    <div className="bg-purple-50 p-1 rounded-full">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                    </div>
                    <span>{feature.title}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleUpgrade}
                disabled={upgradeMutation.isLoading || (user as any)?.isPremium}
                className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-700 hover:via-fuchsia-700 hover:to-pink-600 text-white font-black py-6 text-lg rounded-2xl shadow-xl shadow-purple-300/50 transition-all border-b-4 border-purple-800 active:border-b-0 active:translate-y-0.5 gap-2.5"
              >
                {(user as any)?.isPremium ? (
                  <><Star className="w-5 h-5 fill-white" /> أنت مشترك بالفعل</>
                ) : upgradeMutation.isLoading ? (
                  <><Sparkles className="w-5 h-5 animate-spin" /> جاري التفعيل...</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> اشترك الآن — Premium</>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Features Detail Grid */}
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            {premiumFeatures.map((feature, index) => (
              <Card key={index} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
