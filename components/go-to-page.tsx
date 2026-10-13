"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { parseSlugInput } from "@/lib/slug";
import { pushRoute } from "@/lib/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/loading";

/**
 * "Go to:" — compact jump-to-page row above the upload area.
 * Navigates client-side (in-progress seeding survives) with no existence
 * pre-check; the file page handles public / unlock / private / not-found.
 */
export function GoToPage() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSlugInput(value);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const slug = parsed.slug;
    startTransition(() => {
      pushRoute(router, `/file/${slug}`);
    });
  };

  return (
    <div className="rounded-xl border bg-muted/30 px-3.5 py-3">
      <form
        aria-label="Go to a page"
        onSubmit={submit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
      >
        <Label htmlFor="goto-slug" className="shrink-0 text-sm font-semibold">
          Go to:
        </Label>
        <div className="flex flex-1 gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            <span
              aria-hidden
              className="hidden h-11 shrink-0 items-center rounded-l-xl border border-r-0 border-input bg-muted px-3 text-[13px] text-muted-foreground min-[420px]:flex"
            >
              emfile.site/file/
            </span>
            <span
              aria-hidden
              className="flex h-11 shrink-0 items-center rounded-l-xl border border-r-0 border-input bg-muted px-3 text-[13px] text-muted-foreground min-[420px]:hidden"
            >
              /file/
            </span>
            <Input
              id="goto-slug"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="math-book"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              disabled={isPending}
              aria-invalid={error !== null}
              aria-describedby={error ? "goto-slug-error" : undefined}
              className="h-11 rounded-l-none bg-background font-mono text-sm"
            />
          </div>
          <LoadingButton
            type="submit"
            loading={isPending}
            disabled={value.trim() === "" || isPending}
            aria-label="Go"
            className="h-11 shrink-0 px-4"
          >
            {isPending ? (
              "Going…"
            ) : (
              <span className="inline-flex items-center gap-1.5">
                Go <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            )}
          </LoadingButton>
        </div>
      </form>
      {error ? (
        <p
          id="goto-slug-error"
          role="status"
          aria-live="polite"
          className="pt-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
