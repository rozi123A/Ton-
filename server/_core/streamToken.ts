import crypto from "node:crypto";

const STREAM_TOKEN_TTL_MS = 60_000;
const STREAM_TOKEN_SCOPE = "connectlive:realtime-stream:v1";

type StreamClaims = {
  scope: typeof STREAM_TOKEN_SCOPE;
  userId: number;
  expiresAt: number;
  nonce: string;
};

export function createStreamToken(
  userId: number,
  secret: string,
  now = Date.now(),
): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("A persisted user is required to create a stream token");
  }
  if (!secret || secret.length < 32) {
    throw new Error("The session signing secret is not configured");
  }

  const claims: StreamClaims = {
    scope: STREAM_TOKEN_SCOPE,
    userId,
    expiresAt: now + STREAM_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString("base64url"),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyStreamToken(
  token: unknown,
  secret: string,
  now = Date.now(),
): number | null {
  if (typeof token !== "string" || token.length > 1024 || !secret || secret.length < 32) {
    return null;
  }

  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra !== undefined) return null;

  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<StreamClaims>;
    if (
      claims.scope !== STREAM_TOKEN_SCOPE ||
      typeof claims.userId !== "number" ||
      !Number.isSafeInteger(claims.userId) ||
      claims.userId <= 0 ||
      typeof claims.expiresAt !== "number" ||
      !Number.isSafeInteger(claims.expiresAt) ||
      claims.expiresAt <= now ||
      claims.expiresAt > now + STREAM_TOKEN_TTL_MS + 5_000 ||
      typeof claims.nonce !== "string" ||
      claims.nonce.length < 16
    ) {
      return null;
    }
    return claims.userId as number;
  } catch {
    return null;
  }
}
