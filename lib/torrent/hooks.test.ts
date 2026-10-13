import { describe, expect, test } from "bun:test";
import { pickFile, waitForMetadata } from "./hooks";

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
});
