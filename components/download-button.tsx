"use client";

import * as React from "react";
import { Check, Download } from "lucide-react";
import { toast } from "sonner";
import type { FileSummary } from "@/lib/page-types";
import { formatBytes } from "@/lib/files";
import { saveBlobToDisk, useDownload } from "@/lib/torrent/hooks";
import { Button } from "./ui/button";
import { Progress, Spinner } from "./loading";

function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(size: number, progress: number, speed: number): string {
  if (!Number.isFinite(speed) || speed <= 0 || progress <= 0 || progress >= 1) return "";
  const secs = Math.ceil((size * (1 - progress)) / speed);
  if (!Number.isFinite(secs) || secs <= 0) return "";
  if (secs < 60) return ` · ${secs}s left`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return ` · ${mins}m left`;
  return ` · ${Math.floor(mins / 60)}h left`;
}

/**
 * Download button rendered on EVERY file row (p2p and inline alike).
 * Never hidden in the overflow menu, never hover-only.
 * Desktop: icon + "Download" label. Narrow mobile: icon-only (44px target)
 * with aria-label="Download <name>".
 */
export function DownloadButton({ file }: { file: FileSummary }) {
  if (file.kind === "inline") return <InlineDownloadButton file={file} />;
  return <P2pDownloadButton file={file} />;
}

function downloadLabel(name: string): string {
  return `Download ${name}`;
}

const buttonClass = "h-11 min-h-11 px-4";

function InlineDownloadButton({ file }: { file: FileSummary }) {
  const [busy, setBusy] = React.useState(false);

  const download = async () => {
    if (busy) return;
    if (file.content == null) {
      toast.error("No content stored for this file yet. Try reloading.");
      return;
    }
    setBusy(true);
    try {
      const blob = new Blob([file.content], {
        type: file.mime || "text/plain",
      });
      await saveBlobToDisk(blob, file.name);
    } catch {
      toast.error("Could not save the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      onClick={() => void download()}
      disabled={busy}
      aria-label={busy ? `Saving ${file.name}` : downloadLabel(file.name)}
      aria-busy={busy}
      className={buttonClass}
    >
      {busy ? (
        <Spinner label={`Saving ${file.name}`} size="sm" />
      ) : (
        <Download aria-hidden />
      )}
      <span className="hidden sm:inline">{busy ? "Saving…" : "Download"}</span>
    </Button>
  );
}

function P2pDownloadButton({ file }: { file: FileSummary }) {
  const dl = useDownload(file.magnetUri, file.name);
  const pct = Math.round(dl.progress * 100);

  if (dl.phase === "idle") {
    return (
      <Button
        size="sm"
        onClick={() => void dl.start()}
        disabled={!file.magnetUri}
        aria-label={downloadLabel(file.name)}
        title={file.magnetUri ? undefined : "No magnet link yet"}
        className={buttonClass}
      >
        <Download aria-hidden />
        <span className="hidden sm:inline">Download</span>
      </Button>
    );
  }

  if (dl.phase === "done") {
    return (
      <p
        className="inline-flex min-h-11 items-center gap-1.5 text-xs text-green-700 dark:text-green-400"
        role="status"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        Done · keeping it alive
      </p>
    );
  }

  if (dl.phase === "error") {
    return (
      <div className="flex min-w-44 flex-col gap-1.5">
        <p role="alert" className="max-w-56 text-xs text-destructive">
          {dl.error ?? "Download failed."}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void dl.start()}
          className="min-h-11"
          aria-label={`Retry download of ${file.name}`}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (dl.phase === "saving") {
    return (
      <p
        className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Spinner label={`Saving ${file.name}`} size="sm" />
        <span className="tabular-nums">Saving…</span>
      </p>
    );
  }

  const status =
    dl.phase === "downloading"
      ? `Downloading ${pct}%${dl.speed > 0 ? ` · ${formatSpeed(dl.speed)}${formatEta(file.size, dl.progress, dl.speed)}` : ""}`
      : dl.peers > 0
        ? `Found ${dl.peers} peer${dl.peers === 1 ? "" : "s"}…`
        : "Connecting…";

  return (
    <div className="flex min-w-44 flex-col items-stretch gap-1.5">
      <p
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Spinner
          label={status}
          size="sm"
        />
        <span className="tabular-nums">{status}</span>
      </p>
      <Progress value={pct} label={`Download progress for ${file.name}`} />
      <Button
        size="sm"
        variant="ghost"
        onClick={dl.cancel}
        className="h-8 self-start px-2 text-xs"
      >
        Cancel
      </Button>
      {dl.noPeers ? (
        <p className="max-w-56 text-xs leading-relaxed text-muted-foreground">
          No one is sharing this file right now. Ask the uploader to open this
          page, or re-seed it.
        </p>
      ) : null}
    </div>
  );
}
