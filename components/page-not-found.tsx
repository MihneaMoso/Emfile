import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { isSlugValid } from "@/lib/slug";
import { Button } from "@/components/ui/button";

/**
 * Friendly not-found screen for /file/[slug]. Shown identically when the
 * slug does not exist OR the visitor may not know it exists (private / still
 * locked pages) — never leak which case it is. Rendered directly with the
 * slug so it can offer to create the page.
 */
export function PageNotFound({ slug }: { slug: string }) {
  // Only offer creation for format-valid, unreserved slugs. The check is
  // format-only on purpose: showing it for existing-but-private slugs too
  // keeps this screen identical in every case (the landing availability
  // check handles taken slugs gracefully).
  const canCreate = isSlugValid(slug);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-20 text-center">
      <span className="rounded-2xl bg-muted p-3.5" aria-hidden>
        <FileQuestion className="h-6 w-6 text-muted-foreground" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">
        We couldn&apos;t find this page.
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        It may never have existed, it may have been deleted, or it is private
        and you don&apos;t have access to it.
      </p>
      <div className="flex flex-col items-center gap-2">
        {canCreate ? (
          <Button asChild className="min-h-11">
            <Link href={`/?slug=${encodeURIComponent(slug)}`}>Create it</Link>
          </Button>
        ) : null}
        <Button variant="ghost" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
