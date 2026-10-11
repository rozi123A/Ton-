const NETLIFY_PRODUCTION_ORIGIN = "https://chat-live-connectee.netlify.app";
const NETLIFY_PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d+--chat-live-connectee\.netlify\.app$/;

export function isAllowedCorsOrigin(
  origin: string | undefined,
  configuredOrigins: ReadonlySet<string>,
): boolean {
  if (!origin) return false;
  return origin === NETLIFY_PRODUCTION_ORIGIN ||
    NETLIFY_PREVIEW_ORIGIN.test(origin) ||
    configuredOrigins.has(origin);
}
