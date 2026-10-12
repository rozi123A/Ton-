import { trpc } from "@/lib/trpc";
import {
  COOKIE_NAME,
  GUEST_SESSION_ACTIVE_KEY,
  GUEST_TOKEN_KEY,
  UNAUTHED_ERR_MSG,
} from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ── Auto-reload on new deploy ────────────────────────────────────────────────
// Fetches /api/version (never cached) and compares with the value stored in
// localStorage. When a new server starts (new deploy), the version changes and
// the page reloads once to load fresh assets — works even when index.html is
// served from browser cache.
(async () => {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const { version } = await res.json();
    const stored = localStorage.getItem("_app_build_v");
    if (stored && stored !== version) {
      // New deploy detected — reload to pick up fresh JS/CSS
      localStorage.setItem("_app_build_v", version);
      window.location.reload();
      return;
    }
    localStorage.setItem("_app_build_v", version);
  } catch { /* offline or server error — skip silently */ }
})();
// ────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reuse recent data across route changes and component remounts.
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      retryDelay: attempt => Math.min(500 * 2 ** attempt, 2_000),
    },
    mutations: { retry: false },
  },
});

// Netlify hosts the static UI while Render hosts the authenticated API.
// Keep a runtime fallback so protected queries do not target Netlify's
// relative /api/trpc path when the build variable is missing.
const apiOrigin = import.meta.env.VITE_API_URL ||
  (window.location.hostname.endsWith("netlify.app")
    ? "https://connectlive-jce9.onrender.com"
    : "");

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpLink({
    url: apiOrigin + "/api/trpc",
      transformer: superjson,
      headers() {
        const headers: Record<string, string> = {};
        try {
          const adminToken = sessionStorage.getItem("connectlive_admin_token");
          if (adminToken) headers["x-admin-session"] = adminToken;
        } catch { /* sessionStorage unavailable */ }
        // 1. Persistent guest session for restoring the same device account.
        try {
          const guestToken = localStorage.getItem(GUEST_TOKEN_KEY);
          const sessionActive =
            localStorage.getItem(GUEST_SESSION_ACTIVE_KEY) === "1";
          if (guestToken && sessionActive) {
            headers.Authorization = `Bearer ${guestToken}`;
          }
        } catch { /* storage unavailable */ }

        // 2. Preview auto-login fallback (Replit iframe / Safari ITP / WebView)
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) headers.Authorization = `Bearer ${token}`;
          }
        } catch { /* sessionStorage unavailable */ }

        return headers;
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
