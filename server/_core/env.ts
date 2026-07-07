export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // 🔒 FIX: No hardcoded fallback — must be set in environment variables
  adminSecret: process.env.ADMIN_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  binancePayId: process.env.BINANCE_PAY_ID ?? "",
  usdtTrc20Address: process.env.USDT_TRC20_ADDRESS ?? "",
};

/**
 * 🔒 Validate critical secrets on startup.
 * Throws if any required secret is missing or too weak.
 */
export function validateEnv(): void {
  const errors: string[] = [];

  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    errors.push("JWT_SECRET (or SESSION_SECRET) must be set and at least 32 characters long.");
  }

  if (!ENV.adminSecret || ENV.adminSecret.length < 12) {
    errors.push("ADMIN_SECRET must be set and at least 12 characters long.");
  }

  if (errors.length > 0) {
    console.error("[Startup] ❌ Missing or weak secrets:");
    errors.forEach(e => console.error("  -", e));
    process.exit(1);
  }

  console.log("[Startup] ✅ Environment secrets validated.");
}
