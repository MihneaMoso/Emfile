"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Plus } from "lucide-react";
import { toast } from "sonner";
import type { PageSummary } from "@/lib/page-types";
import { formatBytes } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/loading";

function visibilityLabel(p: PageSummary): string {
  if (p.viewPolicy === "owner") return "Private";
  if (p.viewPolicy === "pin") return "PIN view";
  return "Public";
}

export function DashboardBody({ initial }: { initial: PageSummary[] }) {
  const router = useRouter();
  const [pages, setPages] = React.useState(initial);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/pages?mine=1");
      if (!res.ok) return;
      const data = (await res.json()) as { pages: PageSummary[] };
      setPages(data.pages);
    } catch {
      /* keep stale */
    }
  }, []);

  const destroy = async (slug: string) => {
    if (!window.confirm(`Delete /file/${slug}? This cannot be undone.`)) return;
    setDeleting(slug);
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Deleted.");
      await refresh();
    } catch {
      toast.error("Could not delete.");
    } finally {
      setDeleting(null);
    }
  };

  if (pages.length === 0) {
    return (
      <div
        className="mx-auto mt-6 flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center"
        role="status"
      >
        <span className="rounded-2xl bg-muted p-3" aria-hidden>
          <FileUp className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="font-semibold">No pages yet</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Create your first page from the landing page, or claim an anonymous
          page you made.
        </p>
        <Button className="mt-1 gap-1.5" asChild>
          <Link href="/">
            <Plus className="h-4 w-4" aria-hidden /> Create a page
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((p) => (
        <Card
          key={p.id}
          className={`flex flex-col transition-opacity ${deleting === p.slug ? "opacity-60" : ""}`}
          aria-busy={deleting === p.slug}
        >
          <CardHeader className="pb-3">
            <CardTitle className="truncate text-[15px]">{p.title}</CardTitle>
            <CardDescription className="truncate font-mono text-xs">
              /file/{p.slug}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{visibilityLabel(p)}</Badge>
              <Badge variant="outline" className="tabular-nums">
                {p.fileCount ?? 0} file{(p.fileCount ?? 0) === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="mt-auto flex gap-2 pt-1">
              <Button size="sm" asChild className="flex-1">
                <Link href={`/file/${p.slug}`}>Open</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={deleting === p.slug}
                onClick={() => {
                  router.push(`/file/${p.slug}`);
                }}
              >
                Manage
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={deleting === p.slug}
                onClick={() => void destroy(p.slug)}
                aria-label={`Delete ${p.slug}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deleting === p.slug ? (
                  <Spinner label={`Deleting ${p.slug}`} size="sm" />
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
