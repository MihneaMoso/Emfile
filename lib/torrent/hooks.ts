"use client";

import * as React from "react";
import { announceList } from "./client";
import { useTorrent } from "./provider";
import type { Torrent } from "./types";

export type DownloadPhase =
  | "idle"
  | "connecting"
  | "downloading"
  | "saving"
  | "done"
  | "error";

export interface DownloadState {
  phase: DownloadPhase;
  peers: number;
  progress: number;
  speed: number;
  noPeers: boolean;
  /** No bytes for >20s while still incomplete (peer connected but silent). */
  stalled: boolean;
  error: string | null;
}

const INITIAL: DownloadState = {
  phase: "idle",
  peers: 0,
  progress: 0,
  speed: 0,
  noPeers: false,
  stalled: false,
  error: null,
};

/**
 * Stalled transfer? Still downloading, incomplete, and no bytes for longer
 * than the threshold (default 20s). Happens when the seeder's tab closes or
 * freezes mid-transfer while the peer connection lingers.
 */
export function isStalled(
  lastAdvanceAt: number,
  now: number,
  phase: DownloadPhase,
  progress: number,
  thresholdMs = 20_000,
): boolean {
  return (
    phase === "downloading" && progress < 1 && now - lastAdvanceAt > thresholdMs
  );
}

/**
 * Download one magnet in this tab. Connects only on user action (never
 * auto-joins every swarm on page load). After success the tab keeps seeding
 * while open (default WebTorrent behavior).
 */
export function useDownload(magnetUri: string | null, fileName: string) {
  const { ensureClient, markSeeding } = useTorrent();
  const [state, setState] = React.useState<DownloadState>(INITIAL);
  const torrentRef = React.useRef<Torrent | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const stallTimerRef = React.useRef<number | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const lastAdvanceRef = React.useRef(0);
  // Generation counter: cancel() bumps it so an in-flight start() stops
  // touching state (and disk) after the user gave up on it.
  const runRef = React.useRef(0);

  const clearTimers = React.useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (stallTimerRef.current) window.clearInterval(stallTimerRef.current);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    timerRef.current = null;
    stallTimerRef.current = null;
    saveTimerRef.current = null;
  }, []);

  const cancel = React.useCallback(() => {
    runRef.current += 1;
    clearTimers();
    const t = torrentRef.current;
    torrentRef.current = null;
    if (t) {
      try {
        t.destroy();
      } catch {
        /* noop */
      }
    }
    setState((s) => (s.phase === "done" ? s : { ...INITIAL }));
  }, [clearTimers]);

  React.useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (stallTimerRef.current) window.clearInterval(stallTimerRef.current);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const start = React.useCallback(async () => {
    if (!magnetUri) return;
    // A malformed stored link makes the torrent engine throw deep inside
    // (cryptic TypeErrors). Catch it here with a clear, actionable message.
    if (!isMagnetValid(magnetUri)) {
      setState({
        ...INITIAL,
        phase: "error",
        error:
          "This file's link looks damaged. Ask the uploader to open the page and seed it again.",
      });
      return;
    }
    const run = runRef.current + 1;
    runRef.current = run;
    const alive = () => runRef.current === run;
    // Restart cleanly: drop any previous in-flight torrent and its timer.
    const prev = torrentRef.current;
    torrentRef.current = null;
    if (prev) {
      try {
        prev.destroy();
      } catch {
        /* noop */
      }
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setState({ ...INITIAL, phase: "connecting" });
    lastAdvanceRef.current = Date.now();
    // Stall watchdog: a connected-but-silent peer (e.g. a seeder tab that
    // closed or froze mid-transfer) would otherwise park the UI at 99-100%
    // forever with no message.
    if (stallTimerRef.current) window.clearInterval(stallTimerRef.current);
    stallTimerRef.current = window.setInterval(() => {
      if (!alive()) return;
      setState((s) =>
        isStalled(lastAdvanceRef.current, Date.now(), s.phase, s.progress)
          ? { ...s, stalled: true }
          : s,
      );
    }, 5000);
    const client = await ensureClient();
    if (!alive()) return;
    if (!client) {
      setState({
        ...INITIAL,
        phase: "error",
        error: "P2P engine failed to load. Try again.",
      });
      return;
    }
    try {
      // Shared phase transitions (used by both the reuse path below and the
      // fresh-download path after client.add).
      const enterSaving = (peers: number) => {
        if (!alive()) return;
        setState((s) => ({
          ...s,
          phase: "saving",
          progress: 1,
          peers,
        }));
        // Saving must not hang forever (e.g. blob assembly stalling on a
        // constrained device): time out with a retryable error instead.
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          if (!alive()) return;
          clearTimers();
          setState((s) =>
            s.phase === "saving"
              ? { ...s, phase: "error", error: "Saving is taking too long. Cancel and retry?" }
              : s,
          );
        }, 60_000);
      };
      const enterDone = (peers: number, infoHash: string) => {
        if (!alive()) return;
        clearTimers();
        setState((s) => ({
          ...s,
          phase: "done",
          progress: 1,
          peers,
        }));
        markSeeding(infoHash);
      };
      // Reuse a complete local copy (e.g. this tab seeded the file) instead
      // of destroying our own seed and re-downloading it from nobody.
      const existing = client.get(magnetUri);
      if (existing) {
        const localFile = pickFile(existing.files, fileName);
        if (localFile && existing.progress >= 1) {
          enterSaving(existing.numPeers);
          const blob = await blobOf(localFile);
          if (!alive()) return;
          await saveBlobToDisk(blob, fileName);
          if (!alive()) return;
          enterDone(existing.numPeers, existing.infoHash);
          return;
        }
        try {
          existing.destroy();
        } catch {
          /* noop */
        }
      }
      const torrent = client.add(magnetUri, { announce: announceList() });
      torrentRef.current = torrent;

      const onPeers = () => {
        if (!alive()) return;
        setState((s) => ({ ...s, peers: torrent.numPeers }));
      };
      const onDownload = () => {
        if (!alive()) return;
        lastAdvanceRef.current = Date.now();
        setState((s) => ({
          ...s,
          phase: "downloading",
          progress: torrent.progress,
          speed: torrent.downloadSpeed,
          peers: torrent.numPeers,
          noPeers: false,
        }));
      };
      const onSaving = () => enterSaving(torrent.numPeers);
      const onDone = () => enterDone(torrent.numPeers, torrent.infoHash);
      const onNoPeers = () => {
        setState((s) =>
          s.phase === "done" || s.phase === "saving" || s.phase === "error"
            ? s
            : { ...s, noPeers: s.peers === 0 },
        );
      };

      torrent.on("wire", onPeers);
      torrent.on("download", onDownload);
      // Torrent bytes complete: enter the brief "Saving…" phase while the
      // blob is assembled and written to disk (catalog requirement).
      torrent.on("done", onSaving);
      torrent.once("error", () => {
        if (!alive()) return;
        clearTimers();
        setState((s) => ({
          ...s,
          phase: "error",
          error: "Download failed. The seeder may be offline.",
        }));
      });

      // No peers after ~20s: show the recovery hint (the sanctioned terminal
      // UX for seedless swarms: message + Cancel, per the P2P spec section).
      timerRef.current = window.setTimeout(onNoPeers, 20_000);

      // Magnet metadata (file list) arrives asynchronously from peers — never
      // read .files before it does ("Torrent is empty" bug).
      await waitForMetadata(torrent);
      if (!alive()) return;

      const file = pickFile(torrent.files, fileName);
      if (!file) {
        setState((s) => ({ ...s, phase: "error", error: "Torrent is empty." }));
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (torrent.progress >= 1) {
            resolve();
            return;
          }
          torrent.once("done", () => resolve());
          torrent.once("error", () =>
            reject(new Error("Download failed. The seeder may be offline.")),
          );
        };
        check();
      });
      if (!alive()) return;
      onSaving();
      const blob = await blobOf(file);
      if (!alive()) return;
      await saveBlobToDisk(blob, fileName);
      if (!alive()) return;
      onDone();
    } catch (err) {
      if (!alive()) return;
      clearTimers();
      // Vendor internals can throw raw TypeErrors (e.g. on malformed input).
      // Log the technical detail for diagnostics, but show a friendly message.
      console.error("[emfile] download failed", err);
      const message =
        err instanceof Error &&
        /seeder may be offline|empty|engine failed/i.test(err.message)
          ? err.message
          : "Download failed. Try again — and keep the uploader's tab open.";
      setState((s) => ({ ...s, phase: "error", error: message }));
    }
  }, [magnetUri, fileName, ensureClient, markSeeding, clearTimers]);

  return { ...state, start, cancel };
}

/** Minimal surface waitForMetadata needs: real torrents satisfy it as-is. */
export interface MetadataSource {
  readonly files: { readonly length: number } | null | undefined;
  once(event: "ready" | "error", cb: () => void): unknown;
}

/**
 * Resolve once the torrent's metadata (file list) is available. Magnet links
 * carry no file list — it arrives asynchronously once peers answer. Reading
 * `.files` before this resolves is the "Torrent is empty" bug.
 */
export function waitForMetadata(t: MetadataSource): Promise<void> {
  if (t.files && t.files.length > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    t.once("ready", () => resolve());
    t.once("error", () =>
      reject(new Error("Download failed. The seeder may be offline.")),
    );
  });
}

/** Pick the downloaded file: single-file torrents, else match by name. */
export function pickFile<T extends { name: string }>(
  files: readonly T[] | null | undefined,
  fileName: string,
): T | undefined {
  if (!files || files.length === 0) return undefined;
  if (files.length === 1) return files[0];
  return files.find((f) => f.name === fileName) ?? files[0];
}

/** Magnet links our seeds produce: v1 (40 hex chars) or v2+ (base32). */
const MAGNET_RE = /^magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,}/i;

export function isMagnetValid(magnet: string): boolean {
  return MAGNET_RE.test(magnet.trim());
}

function blobOf(file: {
  getBlob(cb: (err: Error | null | undefined, blob?: Blob) => void): void;
}): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    file.getBlob((err, blob) => {
      if (err || !blob) reject(err ?? new Error("blob failed"));
      else resolve(blob);
    });
  });
}

/** Write a blob to disk: File System Access picker when available, else anchor download. */
export async function saveBlobToDisk(blob: Blob, fileName: string): Promise<void> {
  const anyWindow = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName: string;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (b: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };
  // Streaming save for large files when the File System Access API exists.
  if (typeof anyWindow.showSaveFilePicker === "function") {
    try {
      const handle = await anyWindow.showSaveFilePicker({
        suggestedName: fileName,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch {
      // User cancelled the picker or it failed: fall through to anchor.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
