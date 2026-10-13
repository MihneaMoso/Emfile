"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { PageSummary } from "@/lib/page-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Inline-editable title + description with debounced optimistic autosave. */
export function PageHeaderEditor({
  slug,
  page,
  canEdit,
  onSaved,
}: {
  slug: string;
  page: PageSummary;
  canEdit: boolean;
  onSaved: (p: PageSummary) => void;
}) {
  const [title, setTitle] = React.useState(page.title);
  const [description, setDescription] = React.useState(page.description);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  // Parent remounts via key when server state changes, so no prop-sync effect.
  // Track the last saved snapshot in state (updated after each save), so the
  // debounced saver always diffs against fresh server state without refs.
  const [saved, setSaved] = React.useState({
    title: page.title,
    description: page.description,
  });
  const savedRef = React.useRef(saved);
  const timer = React.useRef<number | null>(null);
  const savedTimer = React.useRef<number | null>(null);

  const flashSaved = React.useCallback(() => {
    setStatus("saved");
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setStatus("idle"), 2000);
  }, []);

  // Debounced autosave scheduled from change handlers (event context), never
  // from an effect body — setState only happens in callbacks.
  const scheduleSave = React.useCallback(
    (nextTitle: string, nextDesc: string) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        const base = savedRef.current;
        const body: Record<string, unknown> = {};
        if (nextTitle !== base.title) body.title = nextTitle.slice(0, 80);
        if (nextDesc !== base.description) {
          body.description = nextDesc.slice(0, 500);
        }
        if (Object.keys(body).length === 0) return;
        setStatus("saving");
        fetch(`/api/pages/${encodeURIComponent(slug)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
          .then(async (res) => {
            if (!res.ok) {
              setStatus("idle");
              toast.error("Could not save.");
              return;
            }
            const data = (await res.json()) as { page: PageSummary };
            const snap = {
              title: data.page.title,
              description: data.page.description,
            };
            savedRef.current = snap;
            setSaved(snap);
            onSaved(data.page);
            flashSaved();
          })
          .catch(() => {
            setStatus("idle");
            toast.error("Could not save.");
          });
      }, 800);
    },
    // `onSaved` is stable from the parent (setPage); slug is fixed per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, flashSaved],
  );

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    },
    [],
  );

  const onTitle = (v: string) => {
    setTitle(v);
    if (canEdit) scheduleSave(v, description);
  };
  const onDescription = (v: string) => {
    setDescription(v);
    if (canEdit) scheduleSave(title, v);
  };

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-1.5">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {page.title}
        </h1>
        {page.description ? (
          <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
            {page.description}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <Input
          aria-label="Page title"
          value={title}
          maxLength={80}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Untitled page"
          className="h-auto border-0 bg-transparent px-0 py-1 text-3xl font-bold tracking-tight shadow-none focus-visible:ring-1 sm:text-4xl"
        />
      </div>
      <Textarea
        aria-label="Page description"
        value={description}
        maxLength={500}
        rows={2}
        placeholder="Add a description…"
        onChange={(e) => onDescription(e.target.value)}
        className="border-0 bg-transparent px-0 py-1 text-[15px] shadow-none focus-visible:ring-1"
      />
      <p
        className="flex min-h-4 items-center gap-1 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {status === "saving" ? (
          "Saving…"
        ) : status === "saved" ? (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-500">
            <Check className="h-3 w-3" aria-hidden /> Saved
          </span>
        ) : null}
      </p>
    </div>
  );
}
