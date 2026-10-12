"use client";

import * as React from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import type { FileSummary } from "@/lib/page-types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Spinner } from "./loading";

export function DeleteFileDialog({
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
  const [busy, setBusy] = React.useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/pages/${encodeURIComponent(slug)}/files/${encodeURIComponent(file.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("delete failed");
      toast.success("Deleted.");
      onOpenChange(false);
      await mutate(["page", slug]);
    } catch {
      toast.error("Could not delete.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {file.name}?</DialogTitle>
          <DialogDescription>
            This removes the file entry from the page. P2P bytes keep living
            on seeders until they close the tab.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            {busy ? (
              <>
                <Spinner label="Deleting file" /> Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
