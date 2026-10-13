import { CardGridSkeleton } from "@/components/loading";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" aria-hidden />
          <div className="h-4 w-64 animate-pulse rounded-xl bg-muted" aria-hidden />
        </div>
        <div className="h-11 w-28 animate-pulse rounded-xl bg-muted" aria-hidden />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
