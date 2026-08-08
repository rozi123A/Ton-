import { getLoginUrl } from "@/const";
import { detectBrowserCountry } from "@/lib/detectCountry";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import {
  GUEST_SESSION_ACTIVE_KEY,
  GUEST_TOKEN_KEY,
} from "@shared/const";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes — avoid refetching on every render
    gcTime: 10 * 60 * 1000,  // keep cached for 10 min
  });

  // Auto-detect and save country once per session — uses browser language first
  const updateCountry = trpc.auth.updateCountry.useMutation();
  useEffect(() => {
    const user = meQuery.data;
    if (!user) return;
    const key = `country_detected_${(user as { id?: number }).id ?? 'u'}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const browserCountry = detectBrowserCountry();
    updateCountry.mutate(browserCountry ? { country: browserCountry } : undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meQuery.data]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });
  const rememberGuestMutation = (trpc.auth as any).rememberGuest?.useMutation?.();

  // Existing guests created before persistent guest tokens were added get a
  // recovery token once, while their current cookie session is still valid.
  useEffect(() => {
    const user = meQuery.data;
    if (!user || user.loginMethod !== "guest" || !rememberGuestMutation) return;
    try {
      if (localStorage.getItem(GUEST_TOKEN_KEY)) return;
    } catch {
      return;
    }

    rememberGuestMutation.mutate(undefined, {
      onSuccess: (data: { guestToken?: string }) => {
        if (data?.guestToken) {
          try {
            localStorage.setItem(GUEST_TOKEN_KEY, data.guestToken);
          } catch {}
        }
      },
    });
  }, [meQuery.data, rememberGuestMutation]);

  const logout = useCallback(async () => {
    const wasGuest = meQuery.data?.loginMethod === "guest";
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // End the active session, but keep a guest's signed device token so the
      // same guest account can be restored after returning to the site.
      try {
        sessionStorage.removeItem("manus-cookie");
        localStorage.removeItem(GUEST_SESSION_ACTIVE_KEY);
        if (!wasGuest) localStorage.removeItem(GUEST_TOKEN_KEY);
        localStorage.removeItem("manus-cookie");
        localStorage.removeItem("manus-runtime-user-info"); // 🔒 FIX: clear any stale user data
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, meQuery.data, utils]);

  const state = useMemo(() => {
    // 🔒 FIX: Do NOT store sensitive user data in localStorage (XSS risk)
    // Only show loading on initial mount, not when data is cached
    const isFirstLoad = !meQuery.data && !meQuery.error && !meQuery.isError;
    return {
      user: meQuery.data ?? null,
      loading: (isFirstLoad && meQuery.isPending) || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;

    // Build the login URL lazily — only when we actually need to redirect.
    const target = redirectPath ?? getLoginUrl();
    if (window.location.pathname === target) return;

    window.location.href = target;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
