import { toast } from "sonner";
import { isInlineText } from "@/lib/page-types";
import { announceList } from "@/lib/torrent/client";
import type { WebTorrentClient } from "@/lib/torrent/types";

export type SeedPhase = "seeding" | "registering" | "done" | "error";

/** Seed picked files and register metadata after instant navigation. */
export async function seedAndRegister(
  target: string,
  picked: File[],
  ensureClient: () => Promise<WebTorrentClient | null>,
  markSeeding: (h: string) => void,
  onFile?: (file: File, phase: SeedPhase, error?: string) => void,
): Promise<void> {
  for (const f of picked.slice(0, 100)) {
    try {
      if (isInlineText(f.type || "application/octet-stream", f.name, f.size)) {
        const text = await f.text();
        if (new Blob([text]).size > 256 * 1024) continue;
        await fetch(`/api/pages/${encodeURIComponent(target)}/files`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "inline",
            name: f.name,
            size: new Blob([text]).size,
            mime: f.type || "text/plain",
            content: text,
          }),
        });
        onFile?.(f, "done");
        continue;
      }
      onFile?.(f, "seeding");
      const client = await ensureClient();
      if (!client) {
        toast.error("P2P engine failed to load; page created without files.");
        onFile?.(f, "error", "P2P engine failed to load.");
        return;
      }
      const torrent = client.seed(f, {
        name: f.name,
        announce: announceList(),
      });
      const hash: string = await new Promise((resolve, reject) => {
        if (torrent.infoHash) resolve(torrent.infoHash);
        else {
          torrent.once("infoHash", () => resolve(torrent.infoHash));
          torrent.once("error", () => reject(new Error("seed failed")));
        }
      });
      markSeeding(hash);
      onFile?.(f, "registering");
      await fetch(`/api/pages/${encodeURIComponent(target)}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "p2p",
          name: f.name,
          size: f.size,
          mime: f.type || "application/octet-stream",
          infoHash: hash.toLowerCase(),
          magnetUri: torrent.magnetURI,
        }),
      });
      onFile?.(f, "done");
    } catch {
      toast.error(`Could not share ${f.name}.`);
      onFile?.(f, "error", `Could not share ${f.name}.`);
    }
  }
  const { mutate } = await import("swr");
  await mutate(["page", target]);
}
