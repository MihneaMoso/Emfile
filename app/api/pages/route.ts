import { and, eq, lt } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { files, pages } from "@/lib/db/schema";
import { hashSecret, hashToken, randomToken } from "@/lib/secrets";
import { newId, normalizeSlug } from "@/lib/slug";
import { policyErrors } from "@/lib/authorize";
import { createPageSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";
import {
  COOKIE_FLAGS,
  creatorCookieName,
  getIp,
  hashIp,
  secureFlag,
} from "@/lib/cookies";
import { checkMutation, loadPageBySlug, notFound } from "@/lib/api-helpers";
import { hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function serializePage(p: typeof pages.$inferSelect) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    viewPolicy: p.viewPolicy,
    editPolicy: p.editPolicy,
    hasSecret: p.secretHash !== null,
    ownerId: p.ownerId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function POST(req: NextRequest) {
  const blocked = checkMutation(req);
  if (blocked) return blocked;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createPageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const slug = normalizeSlug(input.slug);

  // Anonymous page creation rate limit: 10/hour per IP hash.
  const user = await getSessionUser();
  const ipHash = hashIp(getIp(req.headers));
  if (!user) {
    const count = await hitRateLimit(
      `create:${ipHash}`,
      60 * 60 * 1000,
    );
    if (count > 10) {
      return Response.json(
        { error: "Too many pages created. Try again later." },
        { status: 429 },
      );
    }
  }

  const existing = await loadPageBySlug(slug);
  if (existing) {
    return Response.json({ error: "Slug is taken" }, { status: 409 });
  }

  const ownerId = user?.id ?? null;
  const wantsPin = input.viewPolicy === "pin" || input.editPolicy === "pin";
  if (wantsPin && !input.secret) {
    return Response.json(
      { error: "PIN policies require a secret" },
      { status: 400 },
    );
  }
  const errs = policyErrors({
    viewPolicy: input.viewPolicy,
    editPolicy: input.editPolicy,
    ownerId,
    hasSecret: Boolean(input.secret) || (wantsPin ? false : true),
    isAuthenticated: Boolean(user),
  });
  if (errs.length > 0) {
    return Response.json({ error: errs.join("; ") }, { status: 400 });
  }

  const id = newId("pg_");
  const secretHash = input.secret ? await hashSecret(input.secret) : null;
  // Ownerless PIN-less pages rely on the creator cookie; ownerless PIN pages
  // allow both creator and unlock cookies as admin.
  let creatorToken: string | null = null;
  let creatorTokenHash: string | null = null;
  if (!ownerId) {
    creatorToken = randomToken();
    creatorTokenHash = hashToken(creatorToken);
  }
  const now = new Date();
  await db.insert(pages).values({
    id,
    slug,
    title: input.title || "Untitled page",
    description: input.description || "",
    ownerId,
    viewPolicy: input.viewPolicy,
    editPolicy: input.editPolicy,
    secretHash,
    creatorTokenHash,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  });
  const rows = await db.select().from(pages).where(eq(pages.id, id));
  const created = rows[0];
  if (!created) return notFound();

  const res = Response.json({ page: serializePage(created) }, { status: 201 });
  if (creatorToken) {
    res.headers.append(
      "Set-Cookie",
      `${creatorCookieName(id)}=${creatorToken}${COOKIE_FLAGS}${secureFlag()}`,
    );
  }
  return res;
}

export async function GET(req: NextRequest) {
  // Dashboard listing for the signed-in user (?mine=1). Public enumeration
  // is not allowed.
  const mine = req.nextUrl.searchParams.get("mine");
  if (mine !== "1") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const user = await getSessionUser();
  if (!user) return notFound();
  const rows = await db.select().from(pages).where(eq(pages.ownerId, user.id));
  const out: Array<Record<string, unknown>> = [];
  for (const p of rows) {
    const count = await db
      .select({ id: files.id })
      .from(files)
      .where(eq(files.pageId, p.id));
    out.push({ ...serializePage(p), fileCount: count.length });
  }
  return Response.json({ pages: out });
}
