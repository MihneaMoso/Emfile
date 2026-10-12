"use client";

import * as React from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import type { FileSummary } from "@/lib/page-types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Spinner } from "./loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function RenameDialog({
  file,
  slug,
  open,
  onOpenChange,
}: {
  file: FileSummary;
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename file</DialogTitle>
          <DialogDescription>
            Names are shown to everyone with access.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <RenameDialogBody
            key={file.id}
            file={file}
            slug={slug}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RenameDialogBody({
  file,
  slug,
  onOpenChange,
}: {
  file: FileSummary;
  slug: string;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = React.useState(file.name);
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    if (!name.trim() || name.trim() === file.name) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/pages/${encodeURIComponent(slug)}/files/${encodeURIComponent(file.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      if (!res.ok) throw new Error("rename failed");
      toast.success("Renamed.");
      onOpenChange(false);
      await mutate(["page", slug]);
    } catch {
      toast.error("Could not rename.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Input
        aria-label="File name"
        value={name}
        maxLength={255}
        onChange={(e) => setName(e.target.value)}
      />
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? (
            <>
              <Spinner label="Renaming file" /> Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
