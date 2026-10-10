import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { checkMutation, notFound, resolveAccess } from "@/lib/api-helpers";
import { db } from "@/lib/db/client";
import { pages } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Claim takes no fields — zod-validated as an empty object. */
const claimSchema = z.object({});

/**
 * POST /api/pages/[slug]/claim
 * A signed-in user who is admin of an ownerless page (creator cookie or
 * valid unlock) claims it: sets ownerId and clears creatorTokenHash.
 * 404 (not 403) when the page is missing, already owned, anonymous, or the
 * caller is not an admin — so existence is never leaked.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const blocked = checkMutation(req);
  if (blocked) return blocked;
  const { slug } = await ctx.params;

  let body: unknown = {};
  const text = await req.text();
  if (text.trim().length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const access = await resolveAccess(slug);
  if (!access) return notFound();
  const { page, authz, userId } = access;

  if (!userId) return notFound();
  if (page.ownerId !== null) return notFound();
  if (!authz.isAdmin) return notFound();

  const now = new Date();
  await db
    .update(pages)
    .set({
      ownerId: userId,
      creatorTokenHash: null,
      updatedAt: now,
      lastActivityAt: now,
    })
    .where(eq(pages.id, page.id));

  const rows = await db.select().from(pages).where(eq(pages.id, page.id));
  const updated = rows[0];
  if (!updated) return notFound();
  return Response.json({
    ok: true,
    page: {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      description: updated.description,
      viewPolicy: updated.viewPolicy,
      editPolicy: updated.editPolicy,
      hasSecret: updated.secretHash !== null,
      ownerId: updated.ownerId,
      updatedAt: updated.updatedAt,
    },
  });
}
