import { describe, expect, test } from "bun:test";
import { isMagnetValid, isStalled, pickFile, waitForMetadata } from "./hooks";

function fakeTorrent() {
  const listeners = new Map<string, Array<() => void>>();
  return {
    files: [] as Array<{ name: string }>,
    once(event: string, cb: () => void) {
      const list = listeners.get(event) ?? [];
      list.push(cb);
      listeners.set(event, list);
    },
    emit(event: string) {
      for (const cb of listeners.get(event) ?? []) cb();
    },
  };
}

describe("waitForMetadata", () => {
  test("resolves immediately when files are already present", async () => {
    const t = fakeTorrent();
    t.files.push({ name: "a.txt" });
    await waitForMetadata(t);
  });
  test("waits for ready when the file list is empty (magnet case)", async () => {
    const t = fakeTorrent();
    let done = false;
    const p = waitForMetadata(t).then(() => {
      done = true;
    });
    expect(done).toBe(false);
    t.files.push({ name: "a.txt" });
    t.emit("ready");
    await p;
    expect(done).toBe(true);
  });
  test("rejects on torrent error", async () => {
    const t = fakeTorrent();
    const p = waitForMetadata(t);
    t.emit("error");
    await expect(p).rejects.toThrow();
  });
});

describe("pickFile", () => {
  test("single-file torrent wins regardless of name", () => {
    expect(pickFile([{ name: "other.bin" }], "a.txt")).toEqual({
      name: "other.bin",
    });
  });
  test("matches by name in multi-file torrents", () => {
    const files = [{ name: "a.txt" }, { name: "b.txt" }];
    expect(pickFile(files, "b.txt")).toEqual({ name: "b.txt" });
  });
  test("falls back to the first file", () => {
    const files = [{ name: "a.txt" }, { name: "b.txt" }];
    expect(pickFile(files, "missing.txt")).toEqual({ name: "a.txt" });
  });
  test("empty list yields undefined", () => {
    expect(pickFile([], "a.txt")).toBeUndefined();
  });
  test("nullish list yields undefined (never throws)", () => {
    expect(pickFile(null, "a.txt")).toBeUndefined();
    expect(pickFile(undefined, "a.txt")).toBeUndefined();
  });
});

describe("isMagnetValid", () => {
  test("accepts v1 hex infohashes", () => {
    expect(
      isMagnetValid(
        "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=x",
      ),
    ).toBe(true);
  });
  test("accepts v2 base32 infohashes", () => {
    expect(
      isMagnetValid(
        "magnet:?xt=urn:btih:ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJ&dn=x",
      ),
    ).toBe(true);
  });
  test("rejects empty, truncated and non-magnet strings", () => {
    expect(isMagnetValid("")).toBe(false);
    expect(isMagnetValid("magnet:?xt=urn:btih:abc")).toBe(false);
    expect(isMagnetValid("not a magnet")).toBe(false);
    expect(isMagnetValid("null")).toBe(false);
  });
});

describe("isStalled", () => {
  test("flags an old, incomplete downloading transfer", () => {
    expect(isStalled(0, 30_000, "downloading", 0.99)).toBe(true);
  });
  test("ignores recent progress", () => {
    expect(isStalled(25_000, 30_000, "downloading", 0.5)).toBe(false);
  });
  test("ignores non-downloading phases", () => {
    for (const phase of ["connecting", "saving", "done", "error", "idle"] as const) {
      expect(isStalled(0, 60_000, phase, 0)).toBe(false);
    }
  });
  test("ignores complete progress", () => {
    expect(isStalled(0, 60_000, "downloading", 1)).toBe(false);
  });
  test("respects a custom threshold", () => {
    expect(isStalled(0, 5_000, "downloading", 0.5, 10_000)).toBe(false);
    expect(isStalled(0, 15_000, "downloading", 0.5, 10_000)).toBe(true);
  });
});
