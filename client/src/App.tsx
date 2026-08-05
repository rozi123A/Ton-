import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";

// Keep the first page small. Heavy pages such as ChatRoom and Admin are loaded
// only when the visitor actually navigates to them.
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const ChatRoom = lazy(() => import("./pages/ChatRoom"));
const Profile = lazy(() => import("./pages/Profile"));
const Store = lazy(() => import("./pages/Store"));
const Admin = lazy(() => import("@/pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoading() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
      <div className="flex flex-col items-center gap-3 text-purple-600" role="status" aria-live="polite">
        <div className="w-9 h-9 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
        <span className="font-semibold">جاري التحميل...</span>
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

  // Presence ping — updates lastSignedIn every 2 min so admin online count is accurate
  // IMPORTANT: only fire when authenticated. users.ping is a protectedProcedure;
  // firing it while unauthenticated returns UNAUTHORIZED which the global error
  // handler treats as a redirect signal — sending the user away from /login.
  const { isAuthenticated } = useAuth();
  const presencePing = trpc.users.ping.useMutation();
  const presencePingRef = useRef(presencePing);
  presencePingRef.current = presencePing;
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    const id = setInterval(() => {
      presencePingRef.current.mutate();
    }, 2 * 60 * 1000);
    // Fire after 3s so it doesn't block initial render
    const initialPing = setTimeout(() => presencePingRef.current.mutate(), 3000);
    return () => { clearInterval(id); clearTimeout(initialPing); };
  }, [ready, isAuthenticated]);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light">
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
