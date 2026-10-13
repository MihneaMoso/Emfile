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

  const cancel = React.useCallback(() => {
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
    setState({ ...INITIAL, phase: "connecting" });
    const client = await ensureClient();
    if (!client) {
      setState({
        ...INITIAL,
        phase: "error",
        error: "P2P engine failed to load. Try again.",
      });
      return;
    }
    try {
      const existing = client.get(magnetUri);
      if (existing) {
        try {
          existing.destroy();
        } catch {
          /* noop */
        }
      }
      const torrent = client.add(magnetUri, { announce: announceList() });
      torrentRef.current = torrent;

      const onPeers = () => {
        setState((s) => ({ ...s, peers: torrent.numPeers }));
      };
      const onDownload = () => {
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
        setState((s) => ({
          ...s,
          phase: "saving",
          progress: 1,
          peers: torrent.numPeers,
        }));
      };
      const onDone = () => {
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
        setState((s) => ({
          ...s,
          phase: "error",
          error: "Download failed. The seeder may be offline.",
        }));
      });

      // No peers after ~20s: show the recovery hint.
      timerRef.current = window.setTimeout(onNoPeers, 20_000);

      // Already-complete (seeder is this tab): skip straight to saving.
      if (torrent.progress >= 1) onSaving();

      const file =
        torrent.files.length === 1
          ? torrent.files[0]
          : torrent.files.find((f) => f.name === fileName) ?? torrent.files[0];
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
          torrent.once("error", () => reject(new Error("download failed")));
        };
        check();
      });
      onSaving();
      const blob = await new Promise<Blob>((resolve, reject) => {
        file.getBlob((err, b) => {
          if (err || !b) reject(err ?? new Error("blob failed"));
          else resolve(b);
        });
      });
      await saveBlobToDisk(blob, fileName);
      onDone();
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Download failed.",
      }));
    }
  }, [magnetUri, fileName, ensureClient, markSeeding]);

  return { ...state, start, cancel };
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
