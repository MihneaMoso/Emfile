"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSlugValid } from "@/lib/slug";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
      <Label htmlFor={`${idPrefix}-slug`} className="text-sm font-semibold">
        Page link
      </Label>
      <div className="relative flex items-center">
        <span className="flex h-11 shrink-0 items-center rounded-l-xl border border-r-0 border-input bg-muted px-3 text-[13px] text-muted-foreground">
          emfile.site/file/
        </span>
        <Input
          id={`${idPrefix}-slug`}
          className="h-11 rounded-l-none pr-10 font-mono text-sm"
          value={slug}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          aria-describedby={`${idPrefix}-slug-hint`}
          aria-invalid={slugState === "taken" || slugState === "invalid"}
        />
        <span className="pointer-events-none absolute right-3 flex items-center" aria-hidden>
          {slugState === "checking" ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : slugState === "ok" ? (
            <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
          ) : slugState === "taken" || slugState === "invalid" ? (
            <X className="h-4 w-4 text-destructive" />
          ) : null}
        </span>
      </div>
      <p
        id={`${idPrefix}-slug-hint`}
        className={cn(
          "min-h-4 text-xs text-muted-foreground",
          (slugState === "taken" || slugState === "invalid") && "text-destructive",
          slugState === "ok" && "text-green-600 dark:text-green-500",
        )}
        aria-live="polite"
        role="status"
      >
        {slugState === "checking"
          ? "Checking availability…"
          : slugState === "ok"
            ? "Available — this will be your shareable link."
            : slugState === "taken"
              ? "That slug is taken. Try another."
              : slugState === "invalid"
                ? "3–40 chars, lowercase letters/numbers, single dashes."
                : "Pick anything memorable — it becomes the page URL."}
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
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
        aria-expanded={open}
        aria-controls="pin-section-body"
        onClick={() => setOpen((v) => !v)}
      >
        Protect with a PIN
        <span className="text-xs text-muted-foreground">optional</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id="pin-section-body"
          className="flex flex-col gap-4 border-t p-4"
        >
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
            <p className="text-xs text-muted-foreground">
              {pin.length === 0
                ? "No PIN: anyone with the link can edit."
                : pin.length < 4
                  ? `Need ${4 - pin.length} more character${4 - pin.length === 1 ? "" : "s"}.`
                  : "Anyone with this PIN can edit and manage this page."}
            </p>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
            <span>Also require the PIN to view</span>
            <Switch
              checked={restrictView}
              onCheckedChange={setRestrictView}
              aria-label="Also require the PIN to view"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
