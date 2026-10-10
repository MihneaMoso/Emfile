import { describe, expect, test } from "bun:test";
import nextConfig from "./next.config";

describe("security headers (next.config)", () => {
  test("global headers include HSTS, nosniff, referrer, frame deny, CSP", async () => {
    const headers = await nextConfig.headers!();
    const global = headers.find((h) => h.source === "/:path*");
    expect(global).toBeDefined();
    const map = new Map(global!.headers.map((h) => [h.key, h.value]));
    expect(map.get("Strict-Transport-Security")).toContain("max-age=");
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("X-Frame-Options")).toBe("DENY");
    const csp = map.get("Content-Security-Policy") ?? "";
    // CSP must allow WebSocket trackers + WebRTC while denying framing.
    expect(csp).toContain("connect-src");
    expect(csp).toContain("wss:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
