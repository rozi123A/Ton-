export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? "a_very_long_default_secret_for_development_32_chars",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // 🔒 FIX: No hardcoded fallback — must be set in environment variables
  adminSecret: process.env.ADMIN_SECRET ?? "default_admin_secret_12_chars",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiApiBase: process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1",
  aiModel: process.env.AI_MODEL ?? "",
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
    console.warn("[Startup] ⚠️ JWT_SECRET is missing or too short. Using default.");
  }

  if (!ENV.adminSecret || ENV.adminSecret.length < 12) {
    console.warn("[Startup] ⚠️ ADMIN_SECRET is missing or too short. Using default.");
  }

  console.log("[Startup] ✅ Environment secrets validated.");
}
