"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowUp,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  FileVideo,
  File as FileIcon,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { FileSummary } from "@/lib/page-types";
import { extensionOf, formatBytes } from "@/lib/files";
import { useTorrent } from "@/lib/torrent/provider";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { DownloadButton } from "./download-button";
import { SeedAgainButton } from "./seed-again";
import { RenameDialog } from "./rename-dialog";
import { DeleteFileDialog } from "./delete-file-dialog";
import { Spinner } from "./loading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const TextEditor = dynamic(
  () => import("./text-editor").then((m) => m.TextEditor),
  {
    ssr: false,
    loading: () => (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Spinner label="Loading editor" size="sm" /> Loading editor…
      </p>
    ),
  },
);

function FileTypeIcon({ name, mime, className }: { name: string; mime: string; className?: string }) {
  const ext = extensionOf(name);
  if (mime.startsWith("image/")) return <FileImage className={className} aria-hidden />;
  if (mime.startsWith("video/")) return <FileVideo className={className} aria-hidden />;
  if (mime.startsWith("audio/")) return <FileAudio className={className} aria-hidden />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
    return <FileArchive className={className} aria-hidden />;
  if (
    ["txt", "md", "json", "yaml", "yml", "toml", "csv", "log", "ini"].includes(ext) ||
    mime.startsWith("text/")
  )
    return <FileText className={className} aria-hidden />;
  if (ext) return <FileCode2 className={className} aria-hidden />;
  return <FileIcon className={className} aria-hidden />;
}

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return coarse;
}

export function FileRow({
  file,
  slug,
  canEdit,
  dimmed = false,
  onMove,
  moveUpDisabled = false,
  moveDownDisabled = false,
}: {
  file: FileSummary;
  slug: string;
  canEdit: boolean;
  /** Optimistic pending state: dimmed + spinner badge until the server confirms. */
  dimmed?: boolean;
  onMove?: (fileId: string, dir: -1 | 1) => void;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
}) {
  const { seeding } = useTorrent();
  const coarse = useCoarsePointer();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const isSeeding =
    file.infoHash != null && seeding.has(file.infoHash.toLowerCase());
  const isText = file.kind === "inline";

  const openEditor = React.useCallback(() => {
    if (isText) setEditorOpen(true);
  }, [isText]);

  return (
    <li
      onDoubleClick={(e) => {
        // Double-click opens the editor on desktop — but never when the
        // double-click started on a button, link, input or menu item.
        const t = e.target as HTMLElement;
        if (t.closest("button, a, input, [role='menuitem'], [role='menu']")) return;
        openEditor();
      }}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-input [touch-action:manipulation] select-none sm:flex-row sm:items-center sm:justify-between sm:gap-4 aria-busy:opacity-60"
      aria-busy={dimmed}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className="shrink-0 rounded-xl bg-muted p-2.5"
          aria-hidden
        >
          <FileTypeIcon name={file.name} mime={file.mime} className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block max-w-full truncate text-left text-sm font-semibold tracking-tight hover:underline disabled:no-underline disabled:hover:no-underline"
            disabled={!isText}
            onClick={(e) => {
              // Keyboard activation (Enter/Space) always opens. Mouse:
              // single tap opens on touch devices; on desktop the editor
              // opens on double-click instead, so plain clicks do nothing.
              if (e.detail === 0 || coarse) openEditor();
            }}
            title={isText ? `Open ${file.name} in editor` : file.name}
          >
            {file.name}
          </button>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {formatBytes(file.size)}
            <span aria-hidden> · </span>
            {file.kind === "inline" ? "stored on page" : "peer-to-peer"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {dimmed ? (
              <Badge variant="outline" className="gap-1">
                <Spinner label="Saving change" size="sm" />
                Saving…
              </Badge>
            ) : null}
            {isSeeding ? (
              <Badge className="gap-1 bg-green-600/10 text-green-700 hover:bg-green-600/15 dark:text-green-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600 dark:bg-green-400" aria-hidden />
                Sharing from this tab
              </Badge>
            ) : null}
            {isText ? <Badge variant="secondary">Text</Badge> : null}
          </div>
        </div>
      </div>
      <div
        className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <DownloadButton file={file} />
        {isText && !canEdit ? (
          <Button
            size="sm"
            variant="outline"
            onClick={openEditor}
            className="min-h-11"
          >
            Open
          </Button>
        ) : null}
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label={`More actions for ${file.name}`}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <MoreVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isText ? (
                <DropdownMenuItem onSelect={openEditor}>
                  <Pencil aria-hidden /> Edit
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <Pencil aria-hidden /> Rename
              </DropdownMenuItem>
              {onMove ? (
                <>
                  <DropdownMenuItem
                    disabled={moveUpDisabled}
                    onSelect={() => onMove(file.id, -1)}
                  >
                    <ArrowUp aria-hidden /> Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={moveDownDisabled}
                    onSelect={() => onMove(file.id, 1)}
                  >
                    <ArrowDown aria-hidden /> Move down
                  </DropdownMenuItem>
                </>
              ) : null}
              {file.kind === "p2p" ? (
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <SeedAgainButton file={file} slug={slug} />
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : file.kind === "p2p" ? (
          <SeedAgainButton file={file} slug={slug} />
        ) : null}
      </div>
      {isText && editorOpen ? (
        <TextEditor
          file={file}
          slug={slug}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          canEdit={canEdit}
        />
      ) : null}
      {canEdit ? (
        <RenameDialog
          file={file}
          slug={slug}
          open={renameOpen}
          onOpenChange={setRenameOpen}
        />
      ) : null}
      <DeleteFileDialog
        file={file}
        slug={slug}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </li>
  );
}
