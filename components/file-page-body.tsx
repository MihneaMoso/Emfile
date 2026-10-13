"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Link2, Settings2 } from "lucide-react";
import { isInlineText, type FileSummary, type PageResponse } from "@/lib/page-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropzone } from "@/components/dropzone";
import { FileList, type PendingUpload } from "@/components/file-list";
import { SettingsDialog } from "@/components/settings-dialog";
import { NewTextFileButton } from "@/components/new-text-file";
import { seedAndRegister, type SeedPhase } from "@/components/seed-and-register";
import { Spinner } from "@/components/loading";
import { useTorrent } from "@/lib/torrent/provider";
import { PageHeaderEditor } from "./page-header-editor";

export function FilePageBody({
  slug,
  initial,
  signedIn,
  syncing = false,
}: {
  slug: string;
  initial: PageResponse;
  signedIn: boolean;
  /** True while SWR is polling for files still being registered. */
  syncing?: boolean;
}) {
  const { ensureClient, markSeeding, seeding } = useTorrent();
  // SWR owns freshness (polls until non-empty, revalidates on focus); local
  // state mirrors props for optimistic edits. The wrapper remounts this body
  // via key whenever server data changes, so no prop-sync effect is needed.
  const [page, setPage] = React.useState(initial.page);
  const [files, setFiles] = React.useState(initial.files);
  const [role, setRole] = React.useState(initial.role);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [dimmedIds, setDimmedIds] = React.useState<string[]>([]);
  // Retry needs the original File objects; keep them by pending key.
  const pendingFiles = React.useRef(new Map<string, File>());

  const canEdit = role === "admin" || role === "editor";
  const isAdmin = role === "admin";

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
      if (!res.ok) return;
      const data = (await res.json()) as PageResponse;
      setPage(data.page);
      setFiles(data.files);
      setRole(data.role);
    } catch {
      /* keep stale */
    }
  }, [slug]);

  React.useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const seedFile = React.useCallback(
    async (key: string, f: File) => {
      setPending((prev) =>
        prev.map((p) => (p.key === key ? { ...p, phase: "seeding" as const } : p)),
      );
      const onPhase = (done: File, phase: SeedPhase, error?: string) => {
        if (done !== f) return;
        if (phase === "done") {
          pendingFiles.current.delete(key);
          setPending((prev) => prev.filter((p) => p.key !== key));
        } else if (phase === "error") {
          setPending((prev) =>
            prev.map((p) =>
              p.key === key
                ? { ...p, phase: "error" as const, error: error ?? "Could not add this file." }
                : p,
            ),
          );
        } else {
          setPending((prev) =>
            prev.map((p) =>
              p.key === key
                ? { ...p, phase: "registering" as const }
                : p,
            ),
          );
        }
      };
      await seedAndRegister(slug, [f], ensureClient, markSeeding, onPhase);
    },
    [slug, ensureClient, markSeeding],
  );

  const upload = async (picked: File[]) => {
    if (!canEdit || uploading) return;
    setUploading(true);
    try {
      for (const f of picked) {
        if (!isInlineText(f.type || "application/octet-stream", f.name, f.size)) {
          continue;
        }
        const text = await f.text();
        if (new Blob([text]).size > 256 * 1024) {
          toast.error(`${f.name}: text files over 256 KB must use P2P.`);
          continue;
        }
        const res = await fetch(`/api/pages/${encodeURIComponent(slug)}/files`, {
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
        if (!res.ok) toast.error(`Could not save ${f.name}.`);
      }
      const p2p = picked.filter(
        (f) => !isInlineText(f.type || "application/octet-stream", f.name, f.size),
      );
      // Per-file "Adding…" rows with indeterminate progress; failures stay
      // as error rows with Retry instead of vanishing silently.
      for (const f of p2p) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingFiles.current.set(key, f);
        setPending((prev) => [
          ...prev,
          { key, name: f.name, size: f.size, phase: "seeding" },
        ]);
        await seedFile(key, f);
      }
      await refresh();
      const { mutate } = await import("swr");
      await mutate(["page", slug]);
    } finally {
      setUploading(false);
    }
  };

  const retryUpload = (key: string) => {
    const f = pendingFiles.current.get(key);
    if (!f) return;
    void seedFile(key, f).then(() => void refresh());
  };

  const move = async (fileId: string, dir: -1 | 1) => {
    const ordered = [...files].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((f) => f.id === fileId);
    const other = ordered[idx + dir];
    const current = ordered[idx];
    if (!current || !other) return;
    // Optimistic swap with dimmed rows; roll back on error.
    const snapshot: FileSummary[] = files;
    const next = files.map((f) => {
      if (f.id === current.id) return { ...f, position: other.position };
      if (f.id === other.id) return { ...f, position: current.position };
      return f;
    });
    setFiles(next);
    setDimmedIds((prev) => [...prev, current.id, other.id]);
    try {
      for (const [id, position] of [
        [current.id, other.position],
        [other.id, current.position],
      ] as const) {
        const res = await fetch(
          `/api/pages/${encodeURIComponent(slug)}/files/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ position }),
          },
        );
        if (!res.ok) throw new Error("move failed");
      }
      await refresh();
      const { mutate } = await import("swr");
      await mutate(["page", slug]);
    } catch {
      setFiles(snapshot);
      toast.error("Could not reorder. Rolled back.");
    } finally {
      setDimmedIds((prev) => prev.filter((id) => id !== current.id && id !== other.id));
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/file/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. The URL is in the address bar.");
    }
  };

  return (
    <div className="flex flex-col gap-6 py-8 sm:py-10">
      <div className="flex flex-col gap-4">
        <PageHeaderEditor
          key={`${page.id}:${page.updatedAt}`}
          slug={slug}
          page={page}
          canEdit={canEdit}
          onSaved={setPage}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={share} className="min-h-9 gap-1.5">
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" aria-hidden />
            ) : (
              <Link2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {copied ? "Copied!" : "Share"}
          </Button>
          {isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="min-h-9 gap-1.5"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              Settings
            </Button>
          ) : null}
          {canEdit ? <NewTextFileButton slug={slug} /> : null}
          <span className="ml-1 flex items-center gap-1.5">
            {page.viewPolicy === "owner" ? (
              <Badge variant="secondary">Private</Badge>
            ) : page.viewPolicy === "pin" ? (
              <Badge variant="secondary">PIN-protected</Badge>
            ) : null}
            {!canEdit && role === "viewer" ? (
              <span className="text-xs text-muted-foreground">View only</span>
            ) : null}
          </span>
        </div>
      </div>
      {canEdit ? (
        <div className="relative">
          <Dropzone
            onFiles={(f) => void upload(f)}
            label={
              uploading
                ? "Uploading… keep this tab open"
                : "Drop files to add them, or click to browse"
            }
          />
          {uploading ? (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-background/60 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
              aria-label="Uploading"
            >
              <Spinner label="Uploading files" />
              <span className="text-sm font-medium">Uploading…</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <FileList
        files={files}
        slug={slug}
        canEdit={canEdit}
        syncing={syncing}
        dimmedIds={dimmedIds}
        pending={pending}
        seeding={seeding}
        onMove={(id, dir) => void move(id, dir)}
        onRetryUpload={retryUpload}
      />
      {isAdmin ? (
        <SettingsDialog
          page={page}
          slug={slug}
          signedIn={signedIn}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      ) : null}
    </div>
  );
}
