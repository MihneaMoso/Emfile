import { trackers } from "./load";
import type { TorrentConstructor, WebTorrentClient } from "./types";

let clientPromise: Promise<WebTorrentClient | null> | null = null;
let clientInstance: WebTorrentClient | null = null;

function stunConfig(): Array<{ urls: string | string[] }> {
  const raw = process.env.NEXT_PUBLIC_STUN ?? "";
  const servers = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const list =
    servers.length > 0
      ? servers
      : ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"];
  return [{ urls: list }];
}

declare global {
  interface Window {
    WebTorrent?: TorrentConstructor;
  }
}

/**
 * Load the browser ESM build of WebTorrent from /vendor/webtorrent.min.js
 * (copied by scripts/copy-webtorrent.ts) via dynamic import with the bundler
 * fully bypassed. The file is an ES module (`export{...}`), so a classic
 * <script> tag can never execute it — import() is the only correct loader.
 */
function loadVendorModule(): Promise<TorrentConstructor | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.WebTorrent) return Promise.resolve(window.WebTorrent);
  // webpackIgnore keeps bundlers (webpack/Turbopack) from parsing the 1MB+
  // bundle; it is fetched as a plain ESM file at runtime from public/.
  // NOTE: the specifier is a `string`-typed variable, not a literal, so
  // TypeScript skips static module resolution (types as Promise<any>) and
  // bundlers leave the runtime import untouched.
  const specifier: string = "/vendor/webtorrent.min.js";
  return (
    import(/* webpackIgnore: true */ specifier) as Promise<
      { default?: TorrentConstructor } | TorrentConstructor
    >
  ).then(
    (mod) => {
      const ctor =
        (mod as { default?: TorrentConstructor }).default ??
        (mod as TorrentConstructor);
      if (typeof ctor === "function") {
        window.WebTorrent = ctor;
        return ctor;
      }
      return window.WebTorrent ?? null;
    },
    () => null,
  );
}

/**
 * Lazily create the singleton WebTorrent client from the vendor browser
 * build. There is intentionally NO npm `import("webtorrent")` fallback: the
 * package root is Node-only (requires `os.tmpdir()` and friends) and can
 * only ever crash in the browser.
 */
export async function loadWebTorrent(): Promise<WebTorrentClient | null> {
  if (typeof window === "undefined") return null;
  if (clientInstance) return clientInstance;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const Ctor = await loadVendorModule();
        if (!Ctor) {
          console.warn(
            "[emfile] WebTorrent vendor bundle missing — run `bun install` (postinstall copies it) and reload.",
          );
          return null;
        }
        clientInstance = new Ctor({
          tracker: { rtcConfig: { iceServers: stunConfig() } },
        });
        return clientInstance;
      } catch (err) {
        console.warn("[emfile] WebTorrent failed to load", err);
        return null;
      }
    })();
  }
  return clientPromise;
}

/** Prefetch the bundle when idle (or on dropzone hover). */
export function prefetchWebTorrent(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(() => void loadWebTorrent(), { timeout: 4000 });
  } else {
    window.setTimeout(() => void loadWebTorrent(), 1500);
  }
}

export function announceList(): string[] {
  return trackers();
}
