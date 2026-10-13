"use client";

import * as React from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import { FilePlus2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { LoadingButton } from "./loading";

/** Create an inline text file directly (no upload needed). */
export function NewTextFileButton({ slug }: { slug: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="min-h-9 gap-1.5"
      >
        <FilePlus2 className="h-3.5 w-3.5" aria-hidden />
        New text file
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New text file</DialogTitle>
            <DialogDescription>
              Stored inline on the page (≤ 256 KB) — always available, no
              seeder needed.
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <NewTextFileBody slug={slug} onDone={() => setOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewTextFileBody({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [name, setName] = React.useState("notes.txt");
  const [busy, setBusy] = React.useState(false);

  const create = async () => {
    const clean = name.trim() || "notes.txt";
    setBusy(true);
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "inline",
          name: clean,
          size: 0,
          mime: "text/plain",
          content: "",
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "Could not create the file.");
        return;
      }
      toast.success("Text file created — tap it to edit.");
      onDone();
      await mutate(["page", slug]);
    } catch {
      toast.error("Could not create the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor="new-text-name" className="text-sm font-medium">
          File name
        </label>
        <Input
          id="new-text-name"
          value={name}
          maxLength={255}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setName(e.target.value)}
          placeholder="notes.txt"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <LoadingButton loading={busy} onClick={create}>
          {busy ? "Creating…" : "Create"}
        </LoadingButton>
      </DialogFooter>
    </>
  );
}
