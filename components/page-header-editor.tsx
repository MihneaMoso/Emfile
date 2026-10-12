"use client";

import * as React from "react";
import { toast } from "sonner";
import type { PageSummary } from "@/lib/page-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/loading";

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
  const [saving, setSaving] = React.useState(false);
  // Parent remounts via key when server state changes, so no prop-sync effect.
  // Track the last saved snapshot in state (updated after each save), so the
  // debounced saver always diffs against fresh server state without refs.
  const [saved, setSaved] = React.useState({
    title: page.title,
    description: page.description,
  });
  const savedRef = React.useRef(saved);
  const timer = React.useRef<number | null>(null);

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
        setSaving(true);
        fetch(`/api/pages/${encodeURIComponent(slug)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
          .then(async (res) => {
            if (!res.ok) {
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
          })
          .catch(() => toast.error("Could not save."))
          .finally(() => setSaving(false));
      }, 800);
    },
    // `onSaved` is stable from the parent (setPage); slug is fixed per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug],
  );

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
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
      <>
        <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
        {page.description ? (
          <p className="text-muted-foreground">{page.description}</p>
        ) : null}
      </>
    );
  }
  return (
    <>
      <div className="flex items-start gap-2">
        <Input
          aria-label="Page title"
          value={title}
          maxLength={80}
          onChange={(e) => onTitle(e.target.value)}
          className="border-0 px-0 text-3xl font-bold shadow-none focus-visible:ring-1"
        />
        {saving ? <Spinner label="Saving title" className="mt-2" /> : null}
      </div>
      <Textarea
        aria-label="Page description"
        value={description}
        maxLength={500}
        rows={2}
        placeholder="Add a description…"
        onChange={(e) => onDescription(e.target.value)}
        className="border-0 px-0 shadow-none focus-visible:ring-1"
      />
    </>
  );
}
