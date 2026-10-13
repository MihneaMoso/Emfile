import { Skeleton } from "@/components/loading";

export default function Loading() {
  return (
    <div
      className="mx-auto mt-12 flex w-full max-w-md flex-col gap-4 rounded-xl border p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
