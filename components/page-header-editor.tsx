"use client";

import * as React from "react";
import { toast } from "sonner";
import type { PageSummary } from "@/lib/page-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

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
  const debTitle = useDebounced(title, 800);
  const debDesc = useDebounced(description, 800);
  const firstRun = React.useRef(true);
  // Parent remounts via key when server state changes, so no prop-sync effect.

  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!canEdit) return;
    if (debTitle === page.title && debDesc === page.description) return;
    const body: Record<string, unknown> = {};
    if (debTitle !== page.title) body.title = debTitle.slice(0, 80);
    if (debDesc !== page.description) body.description = debDesc.slice(0, 500);
    if (Object.keys(body).length === 0) return;
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
        onSaved(data.page);
      })
      .catch(() => toast.error("Could not save."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debTitle, debDesc]);

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
      <Input
        aria-label="Page title"
        value={title}
        maxLength={80}
        onChange={(e) => setTitle(e.target.value)}
        className="border-0 px-0 text-3xl font-bold shadow-none focus-visible:ring-1"
      />
      <Textarea
        aria-label="Page description"
        value={description}
        maxLength={500}
        rows={2}
        placeholder="Add a description…"
        onChange={(e) => setDescription(e.target.value)}
        className="border-0 px-0 shadow-none focus-visible:ring-1"
      />
    </>
  );
}
