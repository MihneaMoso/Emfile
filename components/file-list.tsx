import type { FileSummary } from "@/lib/page-types";
import { FileRow } from "./file-row";

export function FileList({
  files,
  slug,
  canEdit,
}: {
  files: FileSummary[];
  slug: string;
  canEdit: boolean;
}) {
  const ordered = [...files].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">No files yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit
            ? "Upload something to get started — it stays in your browser."
            : "Nothing has been shared here yet."}
        </p>
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
