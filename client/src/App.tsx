import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { Sparkles } from "lucide-react";

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

const Home = lazyWithDeployRecovery(() => import("./pages/Home"), "home", 3000);
const Login = lazyWithDeployRecovery(() => import("./pages/Login"), "login");
const ChatRoom = lazyWithDeployRecovery(() => import("./pages/ChatRoom"), "chat");
const Profile = lazyWithDeployRecovery(() => import("./pages/Profile"), "profile");
const Store = lazyWithDeployRecovery(() => import("./pages/Store"), "store");
const Admin = lazyWithDeployRecovery(() => import("@/pages/Admin"), "admin");
const NotFound = lazyWithDeployRecovery(() => import("./pages/NotFound"), "not-found");

function PageLoading() {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#4b2a9b] via-[#c747ce] to-[#19b7e4] px-6 text-white"
      dir="rtl"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-cyan-200/25 blur-3xl" />

      <div className="relative flex w-full max-w-sm flex-col items-center text-center" role="status" aria-live="polite">
        <div className="relative mb-7 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/30 bg-white/[0.16] shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
          <div className="absolute inset-2 rounded-[1.5rem] border border-white/25" />
          <Sparkles className="h-9 w-9 text-fuchsia-200" strokeWidth={1.7} />
          <span className="absolute -bottom-2 -left-2 h-5 w-5 animate-ping rounded-full bg-cyan-200/50" />
          <span className="absolute -bottom-2 -left-2 h-5 w-5 rounded-full border-4 border-[#8240b2] bg-cyan-200" />
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-[0.35em] text-fuchsia-200/80" dir="ltr">
          ConnectLive
        </p>
        <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-white">نجهّز تجربتك</h1>
        <p className="mb-8 text-sm text-slate-300">لحظات قليلة ونكون معك...</p>

        <div className="mb-4 h-1.5 w-full max-w-[230px] overflow-hidden rounded-full bg-white/25">
          <div className="h-full w-2/5 animate-[loading-bar_3s_ease-in-out_infinite] rounded-full bg-gradient-to-l from-cyan-200 via-white to-fuchsia-200" />
        </div>
        <span className="text-xs font-semibold text-slate-400">جاري التحميل...</span>
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
