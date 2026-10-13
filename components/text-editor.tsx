"use client";

import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { useTheme } from "next-themes";
import {
  githubDarkInit,
  githubLightInit,
} from "@uiw/codemirror-theme-github";
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
import { LoadingButton, Skeleton } from "./loading";

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
 * App-chrome-matched CodeMirror themes. Backgrounds/gutters/caret/selection
 * use the app's CSS variables (not hard-coded white/black), so there is no
 * visible seam in either theme. Syntax colors stay the familiar github
 * palette, which meets WCAG AA contrast on both backgrounds.
 */
const lightTheme = githubLightInit({
  settings: {
    background: "var(--card)",
    foreground: "var(--foreground)",
    caret: "var(--primary)",
    selection: "#BBDFFF",
    selectionMatch: "#BBDFFF",
    gutterBackground: "var(--card)",
    gutterForeground: "var(--muted-foreground)",
    lineHighlight: "var(--muted)",
  },
});

const darkTheme = githubDarkInit({
  settings: {
    background: "var(--card)",
    foreground: "var(--foreground)",
    caret: "var(--primary)",
    selection: "#003d73",
    selectionMatch: "#003d73",
    gutterBackground: "var(--card)",
    gutterForeground: "var(--muted-foreground)",
    lineHighlight: "var(--muted)",
  },
});

/**
 * Inline text editor: explicit Save + Cmd/Ctrl-S, dirty-state guard, and a
 * 409 "changed elsewhere" state with reload. Viewers without edit rights get
 * the same editor read-only (no Save).
 */
export function TextEditor({
  file,
  slug,
  open,
  onOpenChange,
  canEdit = true,
}: {
  file: FileSummary;
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canEdit?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:rounded-xl max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-8 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:pb-[env(safe-area-inset-bottom)]">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
          <DialogDescription>
            {canEdit
              ? "Edit inline text. Press Cmd/Ctrl-S to save."
              : "Read-only — you have view access to this page."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TextEditorBody
            key={`${file.id}:${file.revision}`}
            file={file}
            slug={slug}
            onOpenChange={onOpenChange}
            canEdit={canEdit}
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
  canEdit,
}: {
  file: FileSummary;
  slug: string;
  onOpenChange: (v: boolean) => void;
  canEdit: boolean;
}) {
  const { resolvedTheme } = useTheme();
  // Until mounted, resolvedTheme is unresolved: render the skeleton so there
  // is no hydration mismatch and no flash of the wrong theme. Mounted guard
  // without setState-in-effect (same useSyncExternalStore pattern as
  // components/theme-toggle.tsx).
  const mounted = React.useSyncExternalStore(
    (cb) => {
      cb();
      return () => {};
    },
    () => true,
    () => false,
  );
  const theme = resolvedTheme === "dark" ? darkTheme : lightTheme;

  const [value, setValue] = React.useState(file.content ?? "");
  // Language packs load async; track mount to avoid setting state post-close.
  const [extensions, setExtensions] = React.useState<unknown[] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [conflict, setConflict] = React.useState<number | null>(null);
  const dirty = canEdit && value !== (file.content ?? "");

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
    if (!canEdit) return;
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
  }, [value, file.id, file.revision, slug, onOpenChange, canEdit]);

  // Cmd/Ctrl-S to save. Body is mounted only while the dialog is open, so
  // no `open` guard or sync setState is needed here.
  React.useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, canEdit]);

  const attemptClose = (next: boolean) => {
    if (!next && dirty && !saving) {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    onOpenChange(next);
  };

  const loading = !mounted || extensions === null;

  return (
    <>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {canEdit
          ? dirty
            ? "Unsaved changes. Press Cmd/Ctrl-S to save."
            : "No changes. Press Cmd/Ctrl-S to save."
          : "Read-only."}
      </p>
      {conflict !== null ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          This file changed elsewhere (revision {conflict}).{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-4"
            onClick={() => {
              void mutate(["page", slug]);
              onOpenChange(false);
            }}
          >
            Reload and try again.
          </button>
        </p>
      ) : null}
      <div className="emfile-editor overflow-hidden rounded-xl border">
        {loading ? (
          <div
            className="flex h-80 flex-col gap-2 p-4"
            role="status"
            aria-busy="true"
            aria-label="Loading editor"
          >
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-full" />
            <span className="sr-only">Loading editor…</span>
          </div>
        ) : (
          <CodeMirror
            value={value}
            height="320px"
            theme={theme}
            extensions={extensions as never[]}
            editable={canEdit}
            onChange={(v: string) => setValue(v)}
            basicSetup={{ lineNumbers: true }}
          />
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => attemptClose(false)}>
          {dirty ? "Discard" : "Close"}
        </Button>
        {canEdit ? (
          <LoadingButton onClick={() => void save()} loading={saving} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </LoadingButton>
        ) : null}
      </DialogFooter>
    </>
  );
}
