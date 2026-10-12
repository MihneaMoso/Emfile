"use client";

import useSWR from "swr";
import type { PageResponse } from "@/lib/page-types";
import { FilePageBody } from "@/components/file-page-body";
import { LoadingSkeleton } from "@/components/loading";

async function fetcher([_key, slug]: [string, string]): Promise<PageResponse> {
  const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Failed to load page.");
  return (await res.json()) as PageResponse;
}

/** SWR wrapper: revalidates on focus + polls for files registered after instant
 * navigation (seeding continues in the background once the file page mounts).
 * Shows a skeleton only when there is genuinely no data yet. */
export function FilePageClient({
  slug,
  initial,
  signedIn,
}: {
  slug: string;
  initial: PageResponse;
  signedIn: boolean;
}) {
  const { data, error, isLoading, isValidating } = useSWR<PageResponse>(
    ["page", slug],
    fetcher,
    {
      fallbackData: initial,
      revalidateOnFocus: true,
      // Seed-and-register can take a while (WebTorrent load + infohash +
      // metadata POST). Poll every 3s until the file list is non-empty,
      // then stop polling.
      refreshInterval: (latest) =>
        latest && latest.files.length === 0 ? 3000 : 0,
      shouldRetryOnError: false,
    },
  );

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
  const stamp = `${data.page.updatedAt}:${data.files.length}:${data.files.map((f) => `${f.id}:${f.revision}`).join(",")}`;
  return (
    <FilePageBody
      key={stamp}
      slug={slug}
      initial={data}
      signedIn={signedIn}
      syncing={isValidating && data.files.length === 0}
    />
  );
}
