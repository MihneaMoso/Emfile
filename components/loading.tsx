"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared loading indicators. Every async action in the app uses one of these:
 * - `Spinner` — inline busy icon (buttons, rows, hints)
 * - `LoadingButton` — button that swaps its icon to a spinner while `loading`
 * - `Skeleton` / `LoadingSkeleton` — content placeholders (page loads)
 * - `ProgressBar` — determinate 0–100 progress (downloads)
 * All motion respects `prefers-reduced-motion` (see globals.css).
 */

export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      className={cn("inline-flex items-center", className)}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-muted", className)}
    />
  );
}

/** Page-level skeleton: title, description, dropzone, file rows. */
export function LoadingSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex flex-col gap-4 py-8"
      aria-label={label}
      role="status"
    >
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-44" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
