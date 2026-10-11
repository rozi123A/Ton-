import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ShieldCheck, Sparkles, Video } from "lucide-react";
import EarthGlobe from "./components/EarthGlobe";

// Keep the first page small. Heavy pages such as ChatRoom and Admin are loaded
// only when the visitor actually navigates to them.
/**
 * A deploy can replace an old hashed chunk while a phone still has the old
 * entry file in its cache. Retry once with a fresh document before showing
 * the error screen, instead of leaving the user with a broken blank page.
 */
function lazyWithDeployRecovery<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  chunkName: string,
  minimumLoadMs = 0,
) {
  return lazy(async () => {
    const recoveryKey = `connectlive:chunk-recovery:${chunkName}`;
    const startedAt = Date.now();

    try {
      const module = await importer();
      const remainingMs = Math.max(0, minimumLoadMs - (Date.now() - startedAt));
      if (remainingMs > 0) {
        await new Promise<void>(resolve => window.setTimeout(resolve, remainingMs));
      }
      try {
        sessionStorage.removeItem(recoveryKey);
      } catch {
        // Storage can be unavailable in private or embedded browsers.
      }
      return module;
    } catch (error) {
      let alreadyRetried = false;
      try {
        alreadyRetried = sessionStorage.getItem(recoveryKey) === "1";
      } catch {
        // If storage is unavailable, the regular error screen is safer than
        // risking an infinite reload loop.
      }

      if (!alreadyRetried) {
        try {
          sessionStorage.setItem(recoveryKey, "1");
          const freshUrl = new URL(window.location.href);
          freshUrl.searchParams.set("__connectlive_refresh", String(Date.now()));
          window.location.replace(freshUrl.toString());
          return new Promise<never>(() => {});
        } catch {
          // Fall through to the friendly error boundary.
        }
      }

      try {
        sessionStorage.removeItem(recoveryKey);
      } catch {
        // Ignore storage failures.
      }
      throw error;
    }
  });
}

// Never hold the homepage behind an artificial timer; render as soon as its
// chunk is ready and let the page show its own lightweight loading states.
const Home = lazyWithDeployRecovery(() => import("./pages/Home"), "home");
const Login = lazyWithDeployRecovery(() => import("./pages/Login"), "login");
const ChatRoom = lazyWithDeployRecovery(() => import("./pages/ChatRoom"), "chat");
const Profile = lazyWithDeployRecovery(() => import("./pages/Profile"), "profile");
const Store = lazyWithDeployRecovery(() => import("./pages/Store"), "store");
const Admin = lazyWithDeployRecovery(() => import("@/pages/Admin"), "admin");
const NotFound = lazyWithDeployRecovery(() => import("./pages/NotFound"), "not-found");

function PageLoading() {
  return (
    <main
      className="relative isolate flex min-h-screen min-h-[100svh] items-center justify-center overflow-hidden bg-[#070b18] px-5 py-7 text-white"
      dir="rtl"
      aria-busy="true"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 18%, rgba(124,58,237,0.25), transparent 38%), radial-gradient(circle at 10% 78%, rgba(8,145,178,0.15), transparent 33%), radial-gradient(circle at 90% 82%, rgba(217,70,239,0.12), transparent 30%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <div className="relative z-10 w-full max-w-[25rem]">
        <section
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1224]/80 px-6 py-8 text-center shadow-[0_28px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:px-10 sm:py-10"
          role="status"
          aria-live="polite"
        >
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />

          <header className="relative mb-5 flex items-center justify-center gap-3" dir="ltr">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-[0_8px_30px_rgba(168,85,247,0.28)]">
              <Video className="h-6 w-6 text-white" strokeWidth={2.2} />
            </div>
            <div className="text-left">
              <p className="font-display text-xl font-black tracking-tight text-white">ConnectLive</p>
              <p className="text-[9px] font-bold tracking-[0.28em] text-cyan-100/60">MEET THE WORLD</p>
            </div>
          </header>

          <div className="relative mx-auto mb-5 flex h-40 w-40 items-center justify-center" aria-hidden="true">
            <div className="absolute inset-0 rounded-full border border-cyan-100/10 animate-[loading-orbit_14s_linear_infinite] motion-reduce:animate-none" />
            <div className="absolute inset-[14px] rounded-full border border-dashed border-fuchsia-200/20 animate-[loading-orbit_22s_linear_infinite_reverse] motion-reduce:animate-none" />
            <span className="absolute h-24 w-24 rounded-full border border-cyan-200/20 animate-[loading-pulse-ring_2.2s_ease-out_infinite] motion-reduce:animate-none" />
            <span className="absolute h-24 w-24 rounded-full border border-fuchsia-200/15 animate-[loading-pulse-ring_2.2s_ease-out_infinite] [animation-delay:1.1s] motion-reduce:animate-none" />
            <span className="absolute left-[15px] top-[29px] h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.9)] animate-pulse motion-reduce:animate-none" />
            <span className="absolute bottom-[30px] right-[11px] h-2 w-2 rounded-full bg-fuchsia-300 shadow-[0_0_16px_rgba(240,171,252,0.9)] animate-pulse [animation-delay:500ms] motion-reduce:animate-none" />
            <div className="relative flex h-[6.5rem] w-[6.5rem] items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_30%_20%,rgba(103,232,249,0.25),transparent_42%),linear-gradient(135deg,#231b4f,#0a3447)] shadow-[0_0_55px_rgba(34,211,238,0.16)] animate-[loading-globe-breathe_3s_ease-in-out_infinite] motion-reduce:animate-none">
              <div className="absolute inset-2 rounded-full border border-white/10" />
              <EarthGlobe />
              <span className="absolute left-5 right-5 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
            </div>
            <span className="absolute bottom-1 right-[18px] flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-[#121a31] text-fuchsia-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-[loading-float_2.6s_ease-in-out_infinite] motion-reduce:animate-none">
              <Video className="h-5 w-5" strokeWidth={1.9} />
            </span>
          </div>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-100/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-cyan-100/85">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
            <span>مساحة تجمع العالم</span>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight text-white sm:text-4xl">العالم بانتظارك</h1>
          <p className="mx-auto mt-3 max-w-[18rem] text-sm leading-7 text-slate-300/80">
            نجهّز لك اتصالًا آمنًا لتلتقي بأشخاص جدد من كل مكان.
          </p>

          <div className="mx-auto mt-7 max-w-xs">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="جارٍ تجهيز التجربة"
              aria-valuetext="جارٍ التحميل"
            >
              <div className="h-full w-1/3 rounded-full bg-gradient-to-l from-cyan-300 via-white to-fuchsia-400 shadow-[0_0_12px_rgba(103,232,249,0.55)] animate-[loading-sweep_1.6s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:translate-x-0" />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-300/70">
              <ShieldCheck className="h-4 w-4 text-emerald-300/90" />
              <span>خصوصيتك وتجربتك أولويتنا</span>
            </div>
          </div>
        </section>
        <p className="mt-5 text-center text-xs font-medium text-white/40">لحظات ونبدأ</p>
      </div>
    </main>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/chat"} component={ChatRoom} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/store"} component={Store} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Keep an active user's session warm without adding a request to the
  // critical first render. The server also runs its own keep-alive on Render.
  // Keep server alive (Render free tier) — delayed to not block initial load
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(
      () => fetch("/ping", { cache: "no-store" }).catch(() => {}),
      10 * 60 * 1000
    );
    return () => clearInterval(id);
  }, [ready]);

  // Presence ping — refresh the user's lastSeen every minute so the admin
  // online count reflects separate browsers/devices without waiting for a
  // later navigation or login request.
  // IMPORTANT: only fire when authenticated. users.ping is a protectedProcedure;
  // firing it while unauthenticated returns UNAUTHORIZED which the global error
  // handler treats as a redirect signal — sending the user away from /login.
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const presencePing = trpc.users.ping.useMutation({
    onSuccess: () => {
      // A user's presence can be recorded just after the friends query starts.
      // Refresh the cached friends list immediately so the green status dot
      // does not require a full page reload.
      void utils.social.getFriends.invalidate();
      // The home/admin user cards use a separate recent-users query.
      void utils.users.getRecent.invalidate();
    },
  });
  const presencePingRef = useRef(presencePing);
  presencePingRef.current = presencePing;
  useEffect(() => {
    if (!isAuthenticated) return;
    const ping = () => {
      presencePingRef.current.mutate();
    };
    
    // Immediate ping when authenticated
    ping();

    const id = setInterval(() => {
      // Always ping if tab is active to keep session alive
      if (document.visibilityState === "visible") {
        ping();
      }
    }, 30 * 1000); // 30s ping for high accuracy

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ping();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", ping);
    
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", ping);
    };
  }, [isAuthenticated]);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light" switchable>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<PageLoading />}>
              <Router />
            </Suspense>
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
