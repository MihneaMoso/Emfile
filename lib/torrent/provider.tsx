"use client";

import * as React from "react";
import { loadWebTorrent, prefetchWebTorrent } from "./client";
import type { WebTorrentClient } from "./types";

declare global {
  interface Window {
    __emfileSeeding?: Set<string>;
  }
}

export interface TorrentContextValue {
  ready: boolean;
  ensureClient: () => Promise<WebTorrentClient | null>;
  prefetch: () => void;
  seeding: Set<string>;
  markSeeding: (infoHash: string) => void;
  unmarkSeeding: (infoHash: string) => void;
}

const TorrentContext = React.createContext<TorrentContextValue>({
  ready: false,
  ensureClient: () => loadWebTorrent(),
  prefetch: () => prefetchWebTorrent(),
  seeding: new Set<string>(),
  markSeeding: () => undefined,
  unmarkSeeding: () => undefined,
});

/**
 * Singleton WebTorrent client that survives client-side navigation.
 * Mounted once in the root layout; pages use `router.push` (never a full
 * reload) so seeding continues across navigation.
 */
export function TorrentProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [seeding, setSeeding] = React.useState<Set<string>>(new Set());

  const markSeeding = React.useCallback((infoHash: string) => {
    setSeeding((prev) => {
      const next = new Set(prev);
      next.add(infoHash.toLowerCase());
      if (typeof window !== "undefined") window.__emfileSeeding = next;
      return next;
    });
  }, []);

  const unmarkSeeding = React.useCallback((infoHash: string) => {
    setSeeding((prev) => {
      const next = new Set(prev);
      next.delete(infoHash.toLowerCase());
      if (typeof window !== "undefined") window.__emfileSeeding = next;
      return next;
    });
  }, []);

  const ensureClient = React.useCallback(async () => {
    const c = await loadWebTorrent();
    if (c) setReady(true);
    return c;
  }, []);

  const prefetch = React.useCallback(() => {
    prefetchWebTorrent();
  }, []);

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const active =
        typeof window !== "undefined" ? window.__emfileSeeding : undefined;
      if (active && active.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const value = React.useMemo<TorrentContextValue>(
    () => ({ ready, ensureClient, prefetch, seeding, markSeeding, unmarkSeeding }),
    [ready, ensureClient, prefetch, seeding, markSeeding, unmarkSeeding],
  );

  return <TorrentContext.Provider value={value}>{children}</TorrentContext.Provider>;
}

export function useTorrent(): TorrentContextValue {
  return React.useContext(TorrentContext);
}
