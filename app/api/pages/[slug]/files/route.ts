import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  checkMutation,
  notFound,
  resolveAccess,
} from "@/lib/api-helpers";
import { db } from "@/lib/db/client";
import { files, pages } from "@/lib/db/schema";
import {
  INLINE_MAX_BYTES,
  isTextLike,
  sanitizeFileName,
} from "@/lib/files";
import { newId } from "@/lib/slug";
import { createFileSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_FILES_PER_PAGE = 100;

function serializeFile(f: typeof files.$inferSelect) {
  return {
    id: f.id,
    name: f.name,
    size: f.size,
    mime: f.mime,
    kind: f.kind,
    infoHash: f.infoHash,
    magnetUri: f.magnetUri,
    content: f.kind === "inline" ? f.content : null,
    revision: f.revision,
    position: f.position,
    updatedAt: f.updatedAt,
  };
}

/**
 * POST /api/pages/[slug]/files
 * Requires editor access (else 404). Registers a `p2p` file's metadata
 * (bytes never touch the server) or creates an `inline` text file
 * (text-like, <= 256 KB, stored in the DB).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const blocked = checkMutation(req);
  if (blocked) return blocked;
  const { slug } = await ctx.params;
  const access = await resolveAccess(slug);
  if (!access || !access.authz.isEditor) return notFound();
  const { page } = access;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createFileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const existing = await db
    .select({ id: files.id })
    .from(files)
    .where(eq(files.pageId, page.id));
  if (existing.length >= MAX_FILES_PER_PAGE) {
    return Response.json(
      { error: `File limit reached (${MAX_FILES_PER_PAGE} per page)` },
      { status: 400 },
    );
  }

  const name = sanitizeFileName(input.name);
  const now = new Date();
  const id = newId("fl_");

  if (input.kind === "inline") {
    const content = input.content;
    if (content === undefined) {
      return Response.json(
        { error: "Inline files require content" },
        { status: 400 },
      );
    }
    const byteLen = Buffer.byteLength(content, "utf8");
    if (byteLen > INLINE_MAX_BYTES) {
      return Response.json(
        { error: "Inline files must be 256 KB or smaller" },
        { status: 400 },
      );
    }
    if (!isTextLike(input.mime, name)) {
      return Response.json(
        { error: "Only text files can be stored inline" },
        { status: 400 },
      );
    }
    await db.insert(files).values({
      id,
      pageId: page.id,
      name,
      size: byteLen,
      mime: input.mime,
      kind: "inline",
      infoHash: null,
      magnetUri: null,
      content,
      revision: 1,
      position: existing.length,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db.insert(files).values({
      id,
      pageId: page.id,
      name,
      size: input.size,
      mime: input.mime,
      kind: "p2p",
      infoHash: input.infoHash ?? null,
      magnetUri: input.magnetUri ?? null,
      content: null,
      revision: 1,
      position: existing.length,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(pages)
    .set({ updatedAt: now, lastActivityAt: now })
    .where(eq(pages.id, page.id));

  const rows = await db.select().from(files).where(eq(files.id, id));
  const created = rows[0];
  if (!created) return notFound();
  return Response.json({ file: serializeFile(created) }, { status: 201 });
}
