"use client";

import * as React from "react";
import { toast } from "sonner";
import { isInlineText, type PageResponse } from "@/lib/page-types";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/dropzone";
import { FileList } from "@/components/file-list";
import { SettingsDialog } from "@/components/settings-dialog";
import { seedAndRegister } from "@/components/seed-and-register";
import { Spinner } from "@/components/loading";
import { useTorrent } from "@/lib/torrent/provider";
import { PageHeaderEditor } from "./page-header-editor";

export function FilePageBody({
  slug,
  initial,
  signedIn,
}: {
  slug: string;
  initial: PageResponse;
  signedIn: boolean;
}) {
  const { ensureClient, markSeeding } = useTorrent();
  const [page, setPage] = React.useState(initial.page);
  const [files, setFiles] = React.useState(initial.files);
  const [role, setRole] = React.useState(initial.role);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

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
        await fetch(`/api/pages/${encodeURIComponent(slug)}/files`, {
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
      }
      const p2p = picked.filter(
        (f) => !isInlineText(f.type || "application/octet-stream", f.name, f.size),
      );
      if (p2p.length > 0) {
        await seedAndRegister(slug, p2p, ensureClient, markSeeding);
      }
      await refresh();
      const { mutate } = await import("swr");
      await mutate(["page", slug]);
    } finally {
      setUploading(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/file/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy. The URL is in the address bar.");
    }
  };

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-4">
        <PageHeaderEditor
          key={`${page.id}:${page.updatedAt}`}
          slug={slug}
          page={page}
          canEdit={canEdit}
          onSaved={setPage}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={share}>
            Share (copy link)
          </Button>
          {isAdmin ? (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
          ) : null}
          {!canEdit && role === "viewer" ? (
            <span className="text-xs text-muted-foreground">View only</span>
          ) : null}
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
              className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-background/60 backdrop-blur-[1px]"
              role="status"
              aria-label="Uploading"
            >
              <Spinner label="Uploading files" />
              <span className="text-sm font-medium">Uploading…</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <FileList files={files} slug={slug} canEdit={canEdit} />
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
