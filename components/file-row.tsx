"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { FileText, MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { FileSummary } from "@/lib/page-types";
import { formatBytes } from "@/lib/files";
import { useTorrent } from "@/lib/torrent/provider";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { DownloadButton } from "./download-button";
import { SeedAgainButton } from "./seed-again";
import { RenameDialog } from "./rename-dialog";
import { DeleteFileDialog } from "./delete-file-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const TextEditor = dynamic(
  () => import("./text-editor").then((m) => m.TextEditor),
  { ssr: false, loading: () => <p className="text-sm">Loading editor…</p> },
);

export function FileRow({
  file,
  slug,
  canEdit,
}: {
  file: FileSummary;
  slug: string;
  canEdit: boolean;
}) {
  const { seeding } = useTorrent();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const isSeeding =
    file.infoHash != null && seeding.has(file.infoHash.toLowerCase());
  const isText = file.kind === "inline";

  return (
    <li className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-muted p-2" aria-hidden>
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <button
            type="button"
            className="block max-w-full truncate text-left text-sm font-medium hover:underline disabled:no-underline"
            disabled={!isText}
            onClick={() => setEditorOpen(true)}
            title={isText ? `Open ${file.name} in editor` : file.name}
          >
            {file.name}
          </button>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size)}
            {file.kind === "inline" ? " · stored" : " · peer-to-peer"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {isSeeding ? <Badge>Sharing from this tab</Badge> : null}
            {isText ? <Badge variant="secondary">Text</Badge> : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {file.kind === "p2p" ? <DownloadButton file={file} /> : null}
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`More actions for ${file.name}`}
              >
                <MoreVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isText ? (
                <DropdownMenuItem onSelect={() => setEditorOpen(true)}>
                  <Pencil aria-hidden /> Open in editor
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <Pencil aria-hidden /> Rename
              </DropdownMenuItem>
              {file.kind === "p2p" ? (
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <SeedAgainButton file={file} slug={slug} />
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>
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
