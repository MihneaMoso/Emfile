import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  checkMutation,
  notFound,
  resolveAccess,
} from "@/lib/api-helpers";
import { db } from "@/lib/db/client";
import { files, pages } from "@/lib/db/schema";
import { INLINE_MAX_BYTES, sanitizeFileName } from "@/lib/files";
import { updateFileSchema } from "@/lib/validation";

export const runtime = "nodejs";

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

type Ctx = { params: Promise<{ slug: string; fileId: string }> };

/**
 * PATCH /api/pages/[slug]/files/[fileId]
 * Requires editor access (else 404). Rename, reorder, or edit inline
 * content. Content edits take an optional `revision` for optimistic
 * concurrency: a mismatch returns 409 with the current revision so the UI
 * can show a "changed elsewhere" state.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const blocked = checkMutation(req);
  if (blocked) return blocked;
  const { slug, fileId } = await ctx.params;
  const access = await resolveAccess(slug);
  if (!access || !access.authz.isEditor) return notFound();
  const { page } = access;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateFileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.pageId, page.id)));
  const file = rows[0];
  if (!file) return notFound();

  if (input.revision !== undefined && input.revision !== file.revision) {
    return Response.json(
      {
        error: "This file changed elsewhere. Reload and try again.",
        revision: file.revision,
      },
      { status: 409 },
    );
  }

  const patch: Partial<typeof files.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = sanitizeFileName(input.name);
  if (input.position !== undefined) patch.position = input.position;
  if (input.content !== undefined) {
    if (file.kind !== "inline") {
      return Response.json(
        { error: "Only inline files have editable content" },
        { status: 400 },
      );
    }
    if (Buffer.byteLength(input.content, "utf8") > INLINE_MAX_BYTES) {
      return Response.json(
        { error: "Inline files must be 256 KB or smaller" },
        { status: 400 },
      );
    }
    patch.content = input.content;
    patch.size = Buffer.byteLength(input.content, "utf8");
    patch.revision = file.revision + 1;
  }

  if (
    patch.name === undefined &&
    patch.position === undefined &&
    patch.content === undefined
  ) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(files).set(patch).where(eq(files.id, file.id));
  const now = new Date();
  await db
    .update(pages)
    .set({ updatedAt: now, lastActivityAt: now })
    .where(eq(pages.id, page.id));

  const updated = await db.select().from(files).where(eq(files.id, file.id));
  if (!updated[0]) return notFound();
  return Response.json({ file: serializeFile(updated[0]) });
}

/**
 * DELETE /api/pages/[slug]/files/[fileId]
 * Requires editor access (else 404).
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const blocked = checkMutation(req);
  if (blocked) return blocked;
  const { slug, fileId } = await ctx.params;
  const access = await resolveAccess(slug);
  if (!access || !access.authz.isEditor) return notFound();
  const { page } = access;

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.pageId, page.id)));
  const file = rows[0];
  if (!file) return notFound();

  await db.delete(files).where(eq(files.id, file.id));
  const now = new Date();
  await db
    .update(pages)
    .set({ updatedAt: now, lastActivityAt: now })
    .where(eq(pages.id, page.id));
  return Response.json({ ok: true });
}
