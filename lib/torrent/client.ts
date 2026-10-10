import { trackers } from "./load";
import type { TorrentConstructor, WebTorrentClient } from "./types";

let clientPromise: Promise<WebTorrentClient | null> | null = null;
let clientInstance: WebTorrentClient | null = null;
let vendorAttempted = false;

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
 * Inject /vendor/webtorrent.min.js (copied by scripts/copy-webtorrent.ts)
 * once and read the global it sets. Resolves null when the vendor copy is
 * absent so the caller falls back to the npm import.
 */
function loadVendorGlobal(): Promise<TorrentConstructor | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }
  if (window.WebTorrent) return Promise.resolve(window.WebTorrent);
  if (vendorAttempted) return Promise.resolve(window.WebTorrent ?? null);
  vendorAttempted = true;
  return new Promise((resolve) => {
    const el = document.createElement("script");
    el.src = "/vendor/webtorrent.min.js";
    el.async = true;
    const done = () => {
      el.removeEventListener("load", done);
      el.removeEventListener("error", done);
      resolve(window.WebTorrent ?? null);
    };
    el.addEventListener("load", done);
    el.addEventListener("error", done);
    document.head.appendChild(el);
  });
}

/**
 * Lazily create the singleton WebTorrent client. Prefers the pinned vendor
 * copy at /vendor/webtorrent.min.js (copied by scripts/copy-webtorrent.ts)
 * so bundlers never parse the 1MB+ UMD bundle; falls back to the npm
 * package on dev machines where postinstall has not run yet.
 */
export async function loadWebTorrent(): Promise<WebTorrentClient | null> {
  if (typeof window === "undefined") return null;
  if (clientInstance) return clientInstance;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        let Ctor: TorrentConstructor | null = null;
        // Vendor bundle: <script src="/vendor/webtorrent.min.js"> exposes a
        // global; loading via script tag keeps the bundler out entirely.
        Ctor = await loadVendorGlobal();
        if (!Ctor) {
          const mod = (await import("webtorrent")) as unknown as {
            default?: TorrentConstructor;
          };
          Ctor = mod.default ?? (mod as unknown as TorrentConstructor);
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
