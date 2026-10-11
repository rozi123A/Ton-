import { describe, expect, it } from "vitest";
import { isAllowedCorsOrigin } from "./corsOrigins";

describe("Netlify CORS origin policy", () => {
  it("allows only the production site and its numbered deploy previews", () => {
    const configured = new Set<string>();
    expect(isAllowedCorsOrigin("https://chat-live-connectee.netlify.app", configured)).toBe(true);
    expect(isAllowedCorsOrigin("https://deploy-preview-26--chat-live-connectee.netlify.app", configured)).toBe(true);
    expect(isAllowedCorsOrigin("https://deploy-preview-abc--chat-live-connectee.netlify.app", configured)).toBe(false);
    expect(isAllowedCorsOrigin("https://other-project.netlify.app", configured)).toBe(false);
    expect(isAllowedCorsOrigin("http://chat-live-connectee.netlify.app", configured)).toBe(false);
  });

  it("preserves explicitly configured origins", () => {
    const configured = new Set(["https://admin.example.test"]);
    expect(isAllowedCorsOrigin("https://admin.example.test", configured)).toBe(true);
    expect(isAllowedCorsOrigin("https://attacker.example.test", configured)).toBe(false);
    expect(isAllowedCorsOrigin(undefined, configured)).toBe(false);
  });
});
