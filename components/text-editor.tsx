"use client";

import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { toast } from "sonner";
import { mutate } from "swr";
import type { FileSummary } from "@/lib/page-types";
import { languageForFile } from "@/lib/files";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

async function loadLanguage(fileName: string) {
  const lang = languageForFile(fileName);
  switch (lang) {
    case "javascript":
      return (await import("@codemirror/lang-javascript")).javascript();
    case "json":
      return (await import("@codemirror/lang-json")).json();
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown();
    case "html":
      return (await import("@codemirror/lang-html")).html();
    case "css":
      return (await import("@codemirror/lang-css")).css();
    case "python":
      return (await import("@codemirror/lang-python")).python();
    case "sql":
      return (await import("@codemirror/lang-sql")).sql();
    case "yaml":
      return (await import("@codemirror/lang-yaml")).yaml();
    case "java":
      return (await import("@codemirror/lang-java")).java();
    case "cpp":
      return (await import("@codemirror/lang-cpp")).cpp();
    case "go":
      return (await import("@codemirror/lang-go")).go();
    case "rust":
      return (await import("@codemirror/lang-rust")).rust();
    default:
      return [];
  }
}

/**
 * Inline text editor: explicit Save + Cmd/Ctrl-S, dirty-state guard, and a
 * 409 "changed elsewhere" state with reload.
 */
export function TextEditor({
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{file.name}</DialogTitle>
          <DialogDescription>
            Edit inline text. Press Cmd/Ctrl-S to save.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TextEditorBody
            key={`${file.id}:${file.revision}`}
            file={file}
            slug={slug}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TextEditorBody({
  file,
  slug,
  onOpenChange,
}: {
  file: FileSummary;
  slug: string;
  onOpenChange: (v: boolean) => void;
}) {
  const [value, setValue] = React.useState(file.content ?? "");
  // Language packs load async; track mount to avoid setting state post-close.
  const [extensions, setExtensions] = React.useState<unknown[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [conflict, setConflict] = React.useState<number | null>(null);
  const dirty = value !== (file.content ?? "");

  React.useEffect(() => {
    let cancelled = false;
    void loadLanguage(file.name).then((ext) => {
      if (!cancelled) {
        setExtensions(Array.isArray(ext) ? ext : [ext]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [file.name]);

  const save = React.useCallback(async () => {
    setSaving(true);
    setConflict(null);
    try {
      const res = await fetch(
        `/api/pages/${encodeURIComponent(slug)}/files/${encodeURIComponent(file.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: value, revision: file.revision }),
        },
      );
      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as {
          revision?: number;
        } | null;
        setConflict(data?.revision ?? file.revision + 1);
        return;
      }
      if (!res.ok) throw new Error("save failed");
      toast.success("Saved.");
      await mutate(["page", slug]);
      onOpenChange(false);
    } catch {
      toast.error("Could not save.");
    } finally {
      setSaving(false);
    }
  }, [value, file.id, file.revision, slug, onOpenChange]);

  // Cmd/Ctrl-S to save. Body is mounted only while the dialog is open, so
  // no `open` guard or sync setState is needed here.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const attemptClose = (next: boolean) => {
    if (!next && dirty && !saving) {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {dirty ? "Unsaved changes." : "No changes."} Press Cmd/Ctrl-S to save.
      </p>
      {conflict !== null ? (
        <p role="alert" className="rounded-lg border p-3 text-sm">
          This file changed elsewhere (revision {conflict}).{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void mutate(["page", slug]);
              onOpenChange(false);
            }}
          >
            Reload and try again.
          </button>
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border">
        <CodeMirror
          value={value}
          height="320px"
          extensions={extensions as never[]}
          onChange={(v: string) => setValue(v)}
          basicSetup={{ lineNumbers: true }}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => attemptClose(false)}>
          {dirty ? "Discard" : "Close"}
        </Button>
        <Button onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
