"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTE_START_EVENT } from "@/lib/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Shared loading primitives — the ONLY loading UI in the app.
 * Every async wait uses one of these (see MASTER_PROMPT §8 catalog).
 *
 * - `Spinner` — inline busy icon, sizes sm/md/lg, always with screen-reader text.
 * - `Skeleton` — shadcn-style pulse placeholder, shaped like final content.
 * - `LoadingSkeleton` — page-level skeleton matching title/desc/dropzone/rows.
 * - `Progress` — determinate (value 0-100) or indeterminate (value undefined).
 * - `LoadingButton` — wraps shadcn Button; pending shows Spinner, keeps width.
 * - `TopProgressBar` — thin route-transition bar at viewport top (CSS only).
 *
 * Rules: no layout shift (fixed dimensions), `aria-busy` / `role="status"`,
 * `aria-live="polite"`, reduced-motion handled in globals.css.
 */

const spinnerSizes = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
} as const;

export function Spinner({
  className,
  label,
  size = "md",
}: {
  className?: string;
  label?: string;
  size?: keyof typeof spinnerSizes;
}) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <Loader2 className={cn("animate-spin", spinnerSizes[size])} aria-hidden />
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      aria-busy="true"
      className={cn("animate-pulse rounded-xl bg-muted", className)}
    />
  );
}

/** Page-level skeleton: title, description, dropzone, file rows. Matches real layout to avoid shift. */
export function LoadingSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex flex-col gap-4 py-8"
      aria-label={label}
      aria-busy="true"
      role="status"
    >
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-44" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <span className="sr-only" aria-live="polite">
        {label}…
      </span>
    </div>
  );
}

/** Card-grid skeleton for the dashboard. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-busy="true"
      aria-label="Loading pages"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <span className="sr-only">Loading pages…</span>
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
  return (
    <Progress value={value} label={label} />
  );
}

/** Determinate (value 0–100) or indeterminate (value undefined → sliding bar). */
export function Progress({
  value,
  label,
  className,
}: {
  value?: number;
  label?: string;
  className?: string;
}) {
  if (value === undefined) {
    return (
      <div
        className={cn(
          "relative h-1.5 overflow-hidden rounded-full bg-muted",
          className,
        )}
        role="progressbar"
        aria-label={label ?? "Loading"}
      >
        <div className="absolute inset-y-0 w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        <span className="sr-only">{label ?? "Loading"}</span>
        <style jsx>{`
          @keyframes indeterminate {
            0% { left: -33%; }
            100% { left: 100%; }
          }
          @media (prefers-reduced-motion: reduce) {
            div { animation: none; opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
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

export function LoadingButton({
  loading,
  children,
  disabled,
  className,
  ...props
}: ButtonProps & { loading?: boolean }) {
  return (
    <Button
      disabled={disabled ?? loading ?? false}
      aria-busy={loading ?? false}
      className={cn("min-w-24", className)}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner label={typeof children === "string" ? children : "Loading"} size="sm" />
          <span aria-live="polite">{children}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

function TopProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busy, setBusy] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  // Show the bar only if navigation takes >150ms (avoids flicker),
  // keep it visible ≥300ms once shown.
  const start = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBusy(true), 150);
  }, []);

  React.useEffect(() => {
    // Route changed → done.
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (busy) {
      const t = window.setTimeout(() => setBusy(false), 300);
      return () => window.clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a[href]");
      if (a) start();
    };
    // Programmatic router.push navigations (Go to:, page creation, slug
    // renames) dispatch this event so the bar runs for them too.
    const onRouteStart = () => start();
    window.addEventListener("click", onClick, true);
    window.addEventListener(ROUTE_START_EVENT, onRouteStart);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener(ROUTE_START_EVENT, onRouteStart);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [start]);

  if (!busy) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-0.5"
      role="progressbar"
      aria-label="Loading page"
    >
      <div className="h-full w-1/3 animate-[topbar_1s_ease-in-out_infinite] bg-primary" />
      <style jsx>{`
        @keyframes topbar {
          0% { margin-left: -33%; }
          100% { margin-left: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          div > div { animation: none; width: 100%; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export function TopProgressBar() {
  return (
    <React.Suspense fallback={null}>
      <TopProgressBarInner />
    </React.Suspense>
  );
}
