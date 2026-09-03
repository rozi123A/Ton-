export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  adminSecret: process.env.ADMIN_SECRET ?? "",
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
    errors.push("JWT_SECRET or SESSION_SECRET must be at least 32 characters");
  }

  if (!ENV.adminSecret || ENV.adminSecret.length < 32) {
    errors.push("ADMIN_SECRET must be at least 32 characters");
  }

  if (errors.length > 0) {
    if (ENV.isProduction) {
      throw new Error(`[Startup] Required security configuration is invalid: ${errors.join("; ")}`);
    }
    console.warn(`[Startup] Security configuration warnings: ${errors.join("; ")}`);
    return;
  }

  console.log("[Startup] ✅ Environment secrets validated.");
}
