import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Detect country from IP — best-effort, multiple fallbacks
      let detectedCountry: string | undefined = undefined;
      try {
        // 1) Cloudflare header (most reliable when behind CF)
        const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
        if (cfCountry && cfCountry.length === 2 && cfCountry !== 'XX') {
          detectedCountry = cfCountry.toUpperCase();
        }

        // 2) ip-api.com with all possible IP headers
        if (!detectedCountry) {
          // Try all common proxy headers in order
          const rawIp =
            (req.headers['cf-connecting-ip'] as string) ||
            (req.headers['x-real-ip'] as string) ||
            (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            (req.socket.remoteAddress || '').replace('::ffff:', '');

          const ip = rawIp?.trim();
          console.log('[GEO] Detected IP:', ip);

          if (ip && ip !== '127.0.0.1' && ip !== '::1' && ip !== '') {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
              const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,status`, { signal: controller.signal });
              if (geoRes.ok) {
                const data = await geoRes.json() as { countryCode?: string; status?: string };
                console.log('[GEO] ip-api result:', JSON.stringify(data));
                if (data.status === 'success' && data.countryCode && data.countryCode.length === 2) {
                  detectedCountry = data.countryCode.toUpperCase();
                }
              }
            } finally {
              clearTimeout(timer);
            }
          }
        }
      } catch (geoErr) {
        console.error('[GEO] Country detection failed:', geoErr);
      }

      console.log('[GEO] Final country:', detectedCountry ?? 'none');

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
        // Only pass country if we actually detected one — never overwrite with undefined/null
        ...(detectedCountry ? { country: detectedCountry } : {}),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
