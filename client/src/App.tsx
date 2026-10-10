import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { Globe2, ShieldCheck, Sparkles, Video } from "lucide-react";

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
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b18] px-5 text-white"
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(99,102,241,0.18),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(217,70,239,0.14),transparent_32%)]" />

      <div
        className="relative w-full max-w-[23rem] overflow-hidden rounded-[2rem] border border-white/15 bg-[#101628]/95 p-7 text-center shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
        role="status"
        aria-live="polite"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/80 to-transparent" />
        <div className="mx-auto mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.4rem] border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-[0_0_22px_rgba(217,70,239,0.3)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#090d1b]">
            <Video className="h-6 w-6 text-fuchsia-300" strokeWidth={2.4} />
          </div>
        </div>

        <p className="mb-2 text-[0.7rem] font-black uppercase tracking-[0.42em] text-fuchsia-200/80" dir="ltr">
          ConnectLive
        </p>
        <h1 className="mb-2 text-[1.7rem] font-black tracking-tight text-white">العالم بانتظارك</h1>
        <p className="mx-auto mb-7 max-w-[16rem] text-sm leading-6 text-slate-300">نجهّز لك اتصالاً آمناً لتلتقي بأشخاص جدد من كل مكان</p>

        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-0 animate-[loading-progress_1.2s_linear_forwards] rounded-full bg-gradient-to-l from-cyan-300 via-white to-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.65)]" />
        </div>

        <div className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-300">
          <ShieldCheck className="h-4 w-4" />
          <span>اتصال خاص وآمن</span>
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-300 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-300 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-300" />
          </span>
        </div>
        <div className="flex items-center justify-center gap-5 border-t border-white/10 pt-4 text-[0.65rem] font-bold text-slate-400">
          <span className="flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5 text-cyan-300" /> عالمي</span>
          <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-fuchsia-300" /> فوري</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> موثوق</span>
        </div>
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
