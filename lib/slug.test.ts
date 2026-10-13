import { describe, expect, test } from "bun:test";
import { parseSlugInput } from "./slug";

describe("parseSlugInput", () => {
  test("plain slug passes through", () => {
    expect(parseSlugInput("math-book")).toEqual({ ok: true, slug: "math-book" });
  });
  test("trims, lowercases, and hyphenates spaces", () => {
    expect(parseSlugInput("  My Cool Page  ")).toEqual({
      ok: true,
      slug: "my-cool-page",
    });
  });
  test("drops a trailing slash", () => {
    expect(parseSlugInput("math-book/")).toEqual({ ok: true, slug: "math-book" });
  });
  test("extracts the slug from a full https link", () => {
    expect(parseSlugInput("https://emfile.site/file/math-book/")).toEqual({
      ok: true,
      slug: "math-book",
    });
  });
  test("extracts from a bare domain link and strips query strings", () => {
    expect(parseSlugInput("emfile.site/file/Math-Book?x=1")).toEqual({
      ok: true,
      slug: "math-book",
    });
  });
  test("extracts from a localhost link", () => {
    expect(parseSlugInput("http://localhost:3000/file/ABC")).toEqual({
      ok: true,
      slug: "abc",
    });
  });
  test("empty input is invalid", () => {
    const r = parseSlugInput("   ");
    expect(r.ok).toBe(false);
  });
  test("reserved words are invalid", () => {
    expect(parseSlugInput("api").ok).toBe(false);
    expect(parseSlugInput("dashboard").ok).toBe(false);
  });
  test("too short and bad characters are invalid", () => {
    expect(parseSlugInput("ab").ok).toBe(false);
    expect(parseSlugInput("a/b").ok).toBe(false);
    expect(parseSlugInput("under_score").ok).toBe(false);
  });
  test("invalid results carry the spec error message", () => {
    const r = parseSlugInput("!!!");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(
        "Slugs use lowercase letters, numbers and hyphens (3-40 characters).",
      );
    }
  });
});
