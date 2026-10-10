"use client";

import useSWR from "swr";
import type { PageResponse } from "@/lib/page-types";
import { FilePageBody } from "@/components/file-page-body";

async function fetcher([_key, slug]: [string, string]): Promise<PageResponse> {
  const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Failed to load page.");
  return (await res.json()) as PageResponse;
}

function LoadingSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4 py-8" aria-label="Loading">
      <div className="h-9 w-2/3 rounded-xl bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
      <div className="h-44 rounded-xl bg-muted" />
      <div className="h-20 rounded-xl bg-muted" />
      <div className="h-20 rounded-xl bg-muted" />
    </div>
  );
}

/** SWR wrapper: revalidates on focus, keeps server fallback for SEO/instant paint. */
export function FilePageClient({
  slug,
  initial,
  signedIn,
}: {
  slug: string;
  initial: PageResponse;
  signedIn: boolean;
}) {
  const { data, error, isLoading } = useSWR<PageResponse>(["page", slug], fetcher, {
    fallbackData: initial,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  if (isLoading && !data) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border p-6 text-center">
        <p className="font-medium">Could not load this page.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been deleted, or you may need to unlock it.
        </p>
        <button
          type="button"
          className="mt-4 underline"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }
  return <FilePageBody slug={slug} initial={data} signedIn={signedIn} />;
}
