"use client";

import * as React from "react";
import { Download } from "lucide-react";
import type { FileSummary } from "@/lib/page-types";
import { useDownload } from "@/lib/torrent/hooks";
import { Button } from "./ui/button";
import { ProgressBar, Spinner } from "./loading";

export function DownloadButton({ file }: { file: FileSummary }) {
  const dl = useDownload(file.magnetUri, file.name);
  const pct = Math.round(dl.progress * 100);
  if (dl.phase === "idle") {
    return (
      <Button
        size="sm"
        onClick={() => void dl.start()}
        disabled={!file.magnetUri}
        aria-label={`Download ${file.name}`}
      >
        <Download aria-hidden /> Download
      </Button>
    );
  }
  if (dl.phase === "done") {
    return (
      <p className="text-xs text-muted-foreground">
        Helping keep this file alive.
      </p>
    );
  }
  if (dl.phase === "error") {
    return (
      <div className="flex flex-col gap-1">
        <p role="alert" className="text-xs text-destructive">
          {dl.error ?? "Download failed."}
        </p>
        <Button size="sm" variant="outline" onClick={() => void dl.start()}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-stretch gap-1">
      <div className="flex min-w-40 flex-col gap-1" aria-live="polite">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Spinner
            label={
              dl.phase === "downloading"
                ? `Downloading ${pct}%`
                : "Connecting"
            }
          />
          {dl.peers > 0
            ? `Found ${dl.peers} peer${dl.peers === 1 ? "" : "s"}`
            : "Connecting…"}
          {dl.phase === "downloading" ? ` · ${pct}%` : ""}
        </p>
        <ProgressBar value={pct} label={`Download progress for ${file.name}`} />
        <Button size="sm" variant="ghost" onClick={dl.cancel}>
          Cancel
        </Button>
      </div>
      {dl.noPeers ? (
        <p className="max-w-56 text-xs text-muted-foreground">
          No one is sharing this file right now. Ask the uploader to open this
          page, or re-seed it.
        </p>
      ) : null}
    </div>
  );
}
