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
  error: string | null;
}

const INITIAL: DownloadState = {
  phase: "idle",
  peers: 0,
  progress: 0,
  speed: 0,
  noPeers: false,
  error: null,
};

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
  // Generation counter: cancel() bumps it so an in-flight start() stops
  // touching state (and disk) after the user gave up on it.
  const runRef = React.useRef(0);

  const cancel = React.useCallback(() => {
    runRef.current += 1;
    if (timerRef.current) window.clearTimeout(timerRef.current);
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
  }, []);

  React.useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const start = React.useCallback(async () => {
    if (!magnetUri) return;
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
      // Reuse a complete local copy (e.g. this tab seeded the file) instead
      // of destroying our own seed and re-downloading it from nobody.
      const existing = client.get(magnetUri);
      if (existing) {
        const localFile = pickFile(existing.files, fileName);
        if (localFile && existing.progress >= 1) {
          setState((s) => ({
            ...s,
            phase: "saving",
            progress: 1,
            peers: existing.numPeers,
          }));
          const blob = await blobOf(localFile);
          if (!alive()) return;
          await saveBlobToDisk(blob, fileName);
          if (!alive()) return;
          setState((s) => ({
            ...s,
            phase: "done",
            progress: 1,
            peers: existing.numPeers,
          }));
          markSeeding(existing.infoHash);
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
        setState((s) => ({
          ...s,
          phase: "downloading",
          progress: torrent.progress,
          speed: torrent.downloadSpeed,
          peers: torrent.numPeers,
          noPeers: false,
        }));
      };
      const onSaving = () => {
        if (!alive()) return;
        setState((s) => ({
          ...s,
          phase: "saving",
          progress: 1,
          peers: torrent.numPeers,
        }));
      };
      const onDone = () => {
        if (!alive()) return;
        setState((s) => ({
          ...s,
          phase: "done",
          progress: 1,
          peers: torrent.numPeers,
        }));
        markSeeding(torrent.infoHash);
      };
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
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Download failed.",
      }));
    }
  }, [magnetUri, fileName, ensureClient, markSeeding]);

  return { ...state, start, cancel };
}

/** Minimal surface waitForMetadata needs: real torrents satisfy it as-is. */
export interface MetadataSource {
  readonly files: { readonly length: number };
  once(event: "ready" | "error", cb: () => void): unknown;
}

/**
 * Resolve once the torrent's metadata (file list) is available. Magnet links
 * carry no file list — it arrives asynchronously once peers answer. Reading
 * `.files` before this resolves is the "Torrent is empty" bug.
 */
export function waitForMetadata(t: MetadataSource): Promise<void> {
  if (t.files.length > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    t.once("ready", () => resolve());
    t.once("error", () =>
      reject(new Error("Download failed. The seeder may be offline.")),
    );
  });
}

/** Pick the downloaded file: single-file torrents, else match by name. */
export function pickFile<T extends { name: string }>(
  files: readonly T[],
  fileName: string,
): T | undefined {
  if (files.length === 1) return files[0];
  return files.find((f) => f.name === fileName) ?? files[0];
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
