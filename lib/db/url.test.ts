import { describe, expect, test } from "bun:test";
import { normalizeDatabaseUrl } from "./url";

describe("normalizeDatabaseUrl", () => {
  test("rewrites turso:// to libsql://", () => {
    expect(normalizeDatabaseUrl("turso://my-db-org.turso.io")).toBe(
      "libsql://my-db-org.turso.io",
    );
  });
  test("rewrites case-insensitively and trims", () => {
    expect(normalizeDatabaseUrl("  TURSO://my-db-org.turso.io ")).toBe(
      "libsql://my-db-org.turso.io",
    );
  });
  test("adds libsql:// to a bare host", () => {
    expect(normalizeDatabaseUrl("my-db-org.turso.io")).toBe(
      "libsql://my-db-org.turso.io",
    );
  });
  test("leaves supported schemes untouched", () => {
    for (const u of [
      "libsql://my-db-org.turso.io",
      "https://my-db-org.turso.io",
      "wss://my-db-org.turso.io",
      "file:./local.db",
    ]) {
      expect(normalizeDatabaseUrl(u)).toBe(u);
    }
  });
});
