import type { Request } from "express";

/**
 * Best-effort server-side IP -> country detection.
 *
 * Previous version only tried `cf-ipcountry` then a single geo API
 * (ip-api.com over plain HTTP). That single provider is unreliable on its
 * own: it does not resolve every IPv6 address, it rate-limits aggressively,
 * and plain HTTP requests can be blocked or time out on some networks/carriers.
 * This meant a fresh phone/device with no Cloudflare header and a flaky
 * ip-api lookup would register with no country at all.
 *
 * This version tries multiple independent providers (over HTTPS) before
 * giving up, so a single provider hiccup no longer means "no flag".
 */

function extractClientIp(req: Request): string | undefined {
  const rawIp =
    (req.headers["cf-connecting-ip"] as string) ||
    (req.headers["x-real-ip"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.socket.remoteAddress || "").replace("::ffff:", "");

  const ip = rawIp?.trim();
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "") return undefined;
  return ip;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupIpApi(ip: string): Promise<string | undefined> {
  const res = await fetchWithTimeout(
    `https://ip-api.com/json/${ip}?fields=countryCode,status`,
    4000
  );
  if (!res?.ok) return undefined;
  const data = (await res.json()) as { countryCode?: string; status?: string };
  if (data.status === "success" && data.countryCode?.length === 2) {
    return data.countryCode.toUpperCase();
  }
  return undefined;
}

async function lookupIpwhois(ip: string): Promise<string | undefined> {
  const res = await fetchWithTimeout(`https://ipwho.is/${ip}`, 4000);
  if (!res?.ok) return undefined;
  const data = (await res.json()) as { success?: boolean; country_code?: string };
  if (data.success !== false && data.country_code?.length === 2) {
    return data.country_code.toUpperCase();
  }
  return undefined;
}

async function lookupIpapiCo(ip: string): Promise<string | undefined> {
  const res = await fetchWithTimeout(`https://ipapi.co/${ip}/country/`, 4000);
  if (!res?.ok) return undefined;
  const text = (await res.text()).trim();
  if (text.length === 2 && /^[A-Za-z]{2}$/.test(text)) {
    return text.toUpperCase();
  }
  return undefined;
}

/** Detect a request's country: Cloudflare header first, then a chain of IP geo providers. */
export async function detectCountry(req: Request): Promise<string | undefined> {
  try {
    const cfCountry = req.headers["cf-ipcountry"] as string | undefined;
    if (cfCountry && cfCountry.length === 2 && cfCountry.toUpperCase() !== "XX") {
      return cfCountry.toUpperCase();
    }

    const ip = extractClientIp(req);
    if (!ip) return undefined;

    for (const lookup of [lookupIpApi, lookupIpwhois, lookupIpapiCo]) {
      try {
        const country = await lookup(ip);
        if (country) return country;
      } catch (err) {
        console.error("[GEO] provider lookup failed:", err);
      }
    }
  } catch (err) {
    console.error("[GEO] detectCountry failed:", err);
  }
  return undefined;
}
