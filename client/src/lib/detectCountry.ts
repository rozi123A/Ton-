/**
 * Best-effort client-side country detection.
 *
 * The previous implementation only looked at `navigator.language` and
 * required a region subtag (e.g. "ar-SA"). Many mobile browsers/OS locales
 * report a language WITHOUT a region (e.g. just "ar" or "en"), so on a lot
 * of phones this always returned undefined and the app silently fell back
 * to server-side IP geolocation only — which can also fail (VPNs, carrier
 * NAT, blocked geo APIs, etc.), leaving the user with no flag at all.
 *
 * This version checks every entry in `navigator.languages` (not just the
 * first) and, if none carries a region, falls back to mapping the device's
 * IANA time zone to a country. Between the two signals, real devices almost
 * always resolve to a country now.
 */

const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  "Asia/Riyadh": "SA",
  "Asia/Jeddah": "SA",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Asia/Amman": "JO",
  "Asia/Beirut": "LB",
  "Asia/Damascus": "SY",
  "Asia/Baghdad": "IQ",
  "Asia/Gaza": "PS",
  "Asia/Hebron": "PS",
  "Africa/Cairo": "EG",
  "Africa/Khartoum": "SD",
  "Africa/Tripoli": "LY",
  "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ",
  "Africa/Casablanca": "MA",
  "Africa/Nouakchott": "MR",
  "Asia/Aden": "YE",
  "Africa/Mogadishu": "SO",
  "Africa/Djibouti": "DJ",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
  "Europe/London": "GB",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Istanbul": "TR",
  "Europe/Moscow": "RU",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Sao_Paulo": "BR",
  "America/Mexico_City": "MX",
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Kolkata": "IN",
  "Asia/Jakarta": "ID",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Manila": "PH",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Australia/Sydney": "AU",
};

function regionFromLanguageTag(tag: string | undefined | null): string | undefined {
  if (!tag) return undefined;
  const parts = tag.split(/[-_]/);
  for (const part of parts) {
    if (part.length === 2 && /^[A-Za-z]{2}$/.test(part)) {
      return part.toUpperCase();
    }
  }
  return undefined;
}

function detectFromLanguages(): string | undefined {
  try {
    const candidates = [
      ...(navigator.languages ?? []),
      navigator.language,
    ].filter(Boolean) as string[];

    for (const tag of candidates) {
      const region = regionFromLanguageTag(tag);
      if (region) return region;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function detectFromTimeZone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_COUNTRY_MAP[tz]) {
      return TIMEZONE_COUNTRY_MAP[tz];
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Best-effort browser-side country detection: language region, then time zone. */
export function detectBrowserCountry(): string | undefined {
  return detectFromLanguages() ?? detectFromTimeZone();
}
