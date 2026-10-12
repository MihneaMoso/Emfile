"use client";

import * as React from "react";
import { isSlugValid } from "@/lib/slug";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/loading";

export type SlugState = "idle" | "checking" | "ok" | "taken" | "invalid";

export function useSlugCheck(initial: string) {
  const [slug, setSlug] = React.useState(initial);
  const [slugState, setSlugState] = React.useState<SlugState>("idle");

  const check = React.useCallback(async (value: string) => {
    const v = value.trim().toLowerCase();
    if (!v) {
      setSlugState("idle");
      return;
    }
    if (!isSlugValid(v)) {
      setSlugState("invalid");
      return;
    }
    setSlugState("checking");
    try {
      const res = await fetch(`/api/slug-check?slug=${encodeURIComponent(v)}`);
      const data = (await res.json()) as { available?: boolean };
      setSlugState(data.available ? "ok" : "taken");
    } catch {
      setSlugState("idle");
    }
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => void check(slug), 400);
    return () => window.clearTimeout(t);
  }, [slug, check]);

  return { slug, setSlug, slugState };
}

export function SlugField({
  slug,
  setSlug,
  slugState,
  idPrefix,
}: {
  slug: string;
  setSlug: (v: string) => void;
  slugState: SlugState;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-slug`}>Page link</Label>
      <div className="flex items-center gap-0">
        <span className="flex h-11 items-center rounded-l-xl border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
          emfile.site/file/
        </span>
        <Input
          id={`${idPrefix}-slug`}
          className="rounded-l-none"
          value={slug}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          aria-describedby={`${idPrefix}-slug-hint`}
        />
      </div>
      <p
        id={`${idPrefix}-slug-hint`}
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {slugState === "checking" ? (
          <>
            <Spinner label="Checking slug availability" />
            Checking availability…
          </>
        ) : slugState === "ok" ? (
          "Available."
        ) : slugState === "taken" ? (
          "That slug is taken."
        ) : slugState === "invalid" ? (
          "Invalid slug (3–40 chars, a-z/0-9/dashes)."
        ) : (
          "Pick anything memorable — it becomes the page URL."
        )}
      </p>
    </div>
  );
}

export function PinSection({
  pin,
  setPin,
  restrictView,
  setRestrictView,
}: {
  pin: string;
  setPin: (v: string) => void;
  restrictView: boolean;
  setRestrictView: (v: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-xl border">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Protect with a PIN (optional)
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 border-t p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="landing-pin">PIN — 4–128 characters</Label>
            <Input
              id="landing-pin"
              type="password"
              autoComplete="new-password"
              value={pin}
              minLength={4}
              maxLength={128}
              placeholder="Leave blank for an open page"
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={restrictView}
              onChange={(e) => setRestrictView(e.target.checked)}
            />
            Also require the PIN to view (not just to edit)
          </label>
        </div>
      ) : null}
    </div>
  );
}
