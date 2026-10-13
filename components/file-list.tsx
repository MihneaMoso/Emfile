import type { FileSummary } from "@/lib/page-types";
import { RadioTower } from "lucide-react";
import { FileRow } from "./file-row";
import { Progress, Spinner } from "./loading";
import { Button } from "./ui/button";

export interface PendingUpload {
  key: string;
  name: string;
  size: number;
  phase: "seeding" | "registering" | "error";
  error?: string;
}

export function FileList({
  files,
  slug,
  canEdit,
  syncing = false,
  dimmedIds = [],
  pending = [],
  seeding,
  onMove,
  onRetryUpload,
}: {
  files: FileSummary[];
  slug: string;
  canEdit: boolean;
  /** True while polling for files that are still being registered. */
  syncing?: boolean;
  /** File ids with an unconfirmed optimistic mutation (dimmed + spinner). */
  dimmedIds?: string[];
  pending?: PendingUpload[];
  /** InfoHashes (lowercased) this tab is currently seeding. */
  seeding?: Set<string>;
  onMove?: (fileId: string, dir: -1 | 1) => void;
  onRetryUpload?: (key: string) => void;
}) {
  const ordered = [...files].sort((a, b) => a.position - b.position);
  const dimmed = new Set(dimmedIds);
  // Seeded bytes live only in this tab's memory: after a refresh (or on a
  // device that never held the files) nothing here is shared. Say so plainly
  // instead of letting downloaders stare at "Connecting…" — but only for
  // editors, who can actually re-seed.
  const unseeded =
    canEdit && seeding && pending.length === 0
      ? ordered.filter(
          (f) =>
            f.kind === "p2p" &&
            f.infoHash &&
            !seeding.has(f.infoHash.toLowerCase()),
        ).length
      : 0;
  if (ordered.length === 0 && pending.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed p-10 text-center"
        role="status"
        aria-live="polite"
        aria-label={syncing ? "Waiting for files" : "No files yet"}
      >
        {syncing ? (
          <>
            <p className="flex items-center justify-center gap-2 font-medium">
              <Spinner label="Waiting for files" /> Getting your files ready…
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Seeding and registration can take a few seconds — they will
              appear here automatically. Keep this tab open.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">No files yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canEdit
                ? "Upload something to get started — it stays in your browser."
                : "Nothing has been shared here yet."}
            </p>
          </>
        )}
      </div>
    );
  }
  return (
    <>
      {unseeded > 0 ? (
        <div
          className="mb-3 flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-[13px] leading-relaxed"
          role="status"
        >
          <RadioTower
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <p>
            <span className="font-semibold">
              This tab isn&apos;t sharing {unseeded} file{unseeded === 1 ? "" : "s"}.
            </span>{" "}
            Seeded bytes live only in the tab that uploaded them — a refresh
            forgets them. To resume sharing, re-pick {unseeded === 1 ? "the file" : "each file"} via
            its “Seed again” menu; the infohash is verified before seeding
            restarts.
          </p>
        </div>
      ) : null}
      <ul className="flex flex-col gap-3" aria-label="Files">
      {pending.map((p) => (
        <li
          key={p.key}
          className="flex flex-col gap-2 rounded-2xl border border-dashed bg-card p-4"
          role="status"
          aria-live="polite"
          aria-busy={p.phase !== "error"}
          aria-label={p.phase === "error" ? `Failed to add ${p.name}` : `Adding ${p.name}`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {p.name}
            </p>
            {p.phase === "error" ? (
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 shrink-0"
                onClick={() => onRetryUpload?.(p.key)}
              >
                Retry
              </Button>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner label={`Adding ${p.name}`} size="sm" />
                Adding…
              </span>
            )}
          </div>
          {p.phase === "error" ? (
            <p role="alert" className="text-xs text-destructive">
              {p.error ?? "Could not add this file."}
            </p>
          ) : (
            <Progress
              label={`Adding ${p.name}`}
            />
          )}
        </li>
      ))}
      {ordered.map((f, i) => (
        <FileRow
          key={f.id}
          file={f}
          slug={slug}
          canEdit={canEdit}
          dimmed={dimmed.has(f.id)}
          onMove={canEdit ? onMove : undefined}
          moveUpDisabled={i === 0}
          moveDownDisabled={i === ordered.length - 1}
        />
      ))}
      </ul>
    </>
  );
}
