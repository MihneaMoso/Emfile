import { and, eq, isNull, lt } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { files, pages } from "@/lib/db/schema";

export const runtime = "nodejs";

const INACTIVE_DAYS = 180;

/**
 * GET /api/cron/cleanup
 * Deletes ownerless pages inactive for > 180 days (plus their files).
 * Guarded by CRON_SECRET: callers must send
 * `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret`). Failures
 * return 404 so the endpoint's existence isn't leaked.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "Cleanup is not configured" },
      { status: 500 },
    );
  }
  const bearer = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  if (bearer !== `Bearer ${secret}` && headerSecret !== secret) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const cutoff = new Date(
    Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000,
  );
  const stale = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(isNull(pages.ownerId), lt(pages.lastActivityAt, cutoff)));

  let deleted = 0;
  for (const p of stale) {
    await db.delete(files).where(eq(files.pageId, p.id));
    await db.delete(pages).where(eq(pages.id, p.id));
    deleted += 1;
  }
  return Response.json({ ok: true, deleted });
}
