import { describe, expect, it } from "vitest";
import { createStreamToken, verifyStreamToken } from "./streamToken";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const NOW = 1_800_000_000_000;

describe("realtime stream tokens", () => {
  it("issues a short-lived token scoped to a persisted user", () => {
    const token = createStreamToken(123, SECRET, NOW);

    expect(verifyStreamToken(token, SECRET, NOW)).toBe(123);
    expect(verifyStreamToken(token, SECRET, NOW + 59_999)).toBe(123);
    expect(verifyStreamToken(token, SECRET, NOW + 60_000)).toBeNull();
  });

  it("rejects tokens with a changed payload or different secret", () => {
    const token = createStreamToken(123, SECRET, NOW);
    const [payload, signature] = token.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ userId: 456 })).toString("base64url")}.${signature}`;

    expect(verifyStreamToken(tampered, SECRET, NOW)).toBeNull();
    expect(verifyStreamToken(token, `${SECRET}-wrong`, NOW)).toBeNull();
    expect(verifyStreamToken(`${payload}.${signature}.extra`, SECRET, NOW)).toBeNull();
  });

  it("rejects malformed tokens and non-persisted user IDs", () => {
    expect(verifyStreamToken(undefined, SECRET, NOW)).toBeNull();
    expect(verifyStreamToken("not-a-token", SECRET, NOW)).toBeNull();
    expect(() => createStreamToken(-1, SECRET, NOW)).toThrow();
    expect(() => createStreamToken(1, "short", NOW)).toThrow();
  });
});
