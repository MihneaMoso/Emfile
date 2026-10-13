"use client";

import * as React from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import type { FileSummary } from "@/lib/page-types";
import { announceList } from "@/lib/torrent/client";
import { useTorrent } from "@/lib/torrent/provider";
import { Button } from "./ui/button";
import { Spinner } from "./loading";

/**
 * Re-seed a P2P file: recompute the infohash of the picked file and verify
 * it equals the stored one (deterministic for same name/content/piece
 * length) before seeding.
 */
export function SeedAgainButton({
  file,
  slug,
  onSeeded,
}: {
  file: FileSummary;
  slug: string;
  onSeeded?: () => void;
}) {
  const { ensureClient, markSeeding } = useTorrent();
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pick = async (picked: FileList | null) => {
    const f = picked?.[0];
    if (!f || !file.infoHash) return;
    setBusy(true);
    try {
      const client = await ensureClient();
      if (!client) {
        toast.error("P2P engine failed to load.");
        return;
      }
      const torrent = client.seed(f, { name: f.name, announce: announceList() });
      const hash: string = await new Promise((resolve, reject) => {
        if (torrent.infoHash) resolve(torrent.infoHash);
        else {
          torrent.once("infoHash", () => resolve(torrent.infoHash));
          torrent.once("error", () => reject(new Error("seed failed")));
        }
      });
      if (hash.toLowerCase() !== file.infoHash.toLowerCase()) {
        try {
          torrent.destroy();
        } catch {
          /* noop */
        }
        toast.error(
          "That file does not match. Pick the exact same file (name and content).",
        );
        return;
      }
      await fetch(`/api/pages/${encodeURIComponent(slug)}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "p2p",
          name: file.name,
          size: f.size,
          mime: f.type || file.mime,
          infoHash: hash.toLowerCase(),
          magnetUri: torrent.magnetURI,
        }),
      }).catch(() => undefined);
      markSeeding(hash);
      toast.success("Seeding again. Keep this tab open.");
      onSeeded?.();
    } catch {
      toast.error("Could not seed that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        aria-label={busy ? "Verifying file" : `Seed ${file.name} again`}
      >
        {busy ? (
          <>
            <Spinner label="Verifying file" size="sm" /> Verifying file…
          </>
        ) : (
          <>
            <RefreshCw aria-hidden /> Seed again
          </>
        )}
      </Button>
    </>
  );
}
