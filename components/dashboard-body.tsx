"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PageSummary } from "@/lib/page-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    if (!window.confirm(`Delete /file/${slug}?`)) return;
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
      <div className="mx-auto mt-10 w-full max-w-md rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">No pages yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first page from the landing page, or claim an anonymous
          page you made.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/">Create a page</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((p) => (
        <Card key={p.id} className="flex flex-col">
          <CardHeader>
            <CardTitle className="truncate">{p.title}</CardTitle>
            <CardDescription className="truncate">
              /file/{p.slug}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">
                {p.viewPolicy === "owner"
                  ? "Private"
                  : p.viewPolicy === "pin"
                    ? "PIN view"
                    : "Public"}
              </Badge>
              <Badge variant="outline">
                {p.fileCount ?? 0} file{(p.fileCount ?? 0) === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="mt-auto flex gap-2">
              <Button size="sm" asChild>
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
                variant="destructive"
                disabled={deleting === p.slug}
                onClick={() => void destroy(p.slug)}
              >
                {deleting === p.slug ? "…" : "Delete"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
