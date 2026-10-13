import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Window event the TopProgressBar listens for (programmatic navigations). */
export const ROUTE_START_EVENT = "emfile:route-start";

export function notifyRouteStart(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ROUTE_START_EVENT));
  }
}

/**
 * Client-side navigation that keeps the singleton WebTorrent client alive
 * (never a full reload) and runs the top progress bar, like anchor clicks do.
 */
export function pushRoute(router: AppRouterInstance, href: string): void {
  notifyRouteStart();
  router.push(href);
}
