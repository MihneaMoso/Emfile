import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/session";
import type { PageSummary } from "@/lib/page-types";
import { DashboardBody } from "@/components/dashboard-body";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard · Emfile" };

export const runtime = "nodejs";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  // Server-render the first paint; the client body revalidates via ?mine=1.
  const { db } = await import("@/lib/db/client");
  const { pages, files } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db.select().from(pages).where(eq(pages.ownerId, user.id));
  const initial: PageSummary[] = await Promise.all(
    rows.map(async (p) => {
      const f = await db
        .select({ id: files.id })
        .from(files)
        .where(eq(files.pageId, p.id));
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        viewPolicy: p.viewPolicy as PageSummary["viewPolicy"],
        editPolicy: p.editPolicy as PageSummary["editPolicy"],
        hasSecret: p.secretHash !== null,
        ownerId: p.ownerId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        fileCount: f.length,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {user.username}’s pages — create, open, and delete.
          </p>
        </div>
        <Button asChild>
          <Link href="/">New page</Link>
        </Button>
      </div>
      <DashboardBody initial={initial} />
    </div>
  );
}
