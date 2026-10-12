import type { FileSummary } from "@/lib/page-types";
import { FileRow } from "./file-row";
import { Spinner } from "./loading";

export function FileList({
  files,
  slug,
  canEdit,
  syncing = false,
}: {
  files: FileSummary[];
  slug: string;
  canEdit: boolean;
  /** True while polling for files that are still being registered. */
  syncing?: boolean;
}) {
  const ordered = [...files].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) {
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
    <ul className="flex flex-col gap-3" aria-label="Files">
      {ordered.map((f) => (
        <FileRow key={f.id} file={f} slug={slug} canEdit={canEdit} />
      ))}
    </ul>
  );
}
