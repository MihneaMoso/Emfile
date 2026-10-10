import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { files, pages } from "@/lib/db/schema";
import { hashSecret } from "@/lib/secrets";
import { normalizeSlug } from "@/lib/slug";
import { policyErrors } from "@/lib/authorize";
import { updatePageSchema } from "@/lib/validation";
import {
  checkMutation,
  loadPageBySlug,
  notFound,
  resolveAccess,
} from "@/lib/api-helpers";

export const runtime = "nodejs";

function serializePage(p: typeof pages.$inferSelect, fileCount?: number) {
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
    ...(fileCount !== undefined ? { fileCount } : {}),
  };
}

async function fileCountFor(pageId: string): Promise<number> {
  const rows = await db
    .select({ id: files.id })
    .from(files)
    .where(eq(files.pageId, pageId));
  return rows.length;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const access = await resolveAccess(slug);
  if (!access || !access.authz.isViewer) return notFound();
  const list = access.authz.isEditor
    ? await db.select().from(files).where(eq(files.pageId, access.page.id))
    : await db.select().from(files).where(eq(files.pageId, access.page.id));
  const ordered = [...list].sort((a, b) => a.position - b.position);
  // Non-editors still receive the file list (names/sizes/magnets) — viewing
  // and downloading is the point of viewer access. Secrets are never sent.
  const pubFiles = ordered.map((f) => ({
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
  }));
  return Response.json({
    page: serializePage(access.page),
    files: pubFiles,
    role: access.authz.role,
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const blocked = checkMutation(req);
  if (blocked) return blocked;
  const { slug } = await ctx.params;
  const access = await resolveAccess(slug);
  if (!access) return notFound();
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updatePageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const { page, authz, userId } = access;

  const wantsSettings =
    input.slug !== undefined ||
    input.viewPolicy !== undefined ||
    input.editPolicy !== undefined ||
    input.secret !== undefined;
  const wantsContent =
    input.title !== undefined || input.description !== undefined;

  if (wantsSettings && !authz.isAdmin) return notFound();
  if (wantsContent && !authz.isEditor) return notFound();
  if (!wantsSettings && !wantsContent) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const patch: Partial<typeof pages.$inferInsert> = {
    updatedAt: new Date(),
    lastActivityAt: new Date(),
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;

  if (wantsSettings) {
    const nextSlug =
      input.slug !== undefined ? normalizeSlug(input.slug) : page.slug;
    if (nextSlug !== page.slug) {
      const taken = await loadPageBySlug(nextSlug);
      if (taken) return Response.json({ error: "Slug is taken" }, { status: 409 });
      patch.slug = nextSlug;
    }
    const nextView = (input.viewPolicy ?? page.viewPolicy) as
      | "public"
      | "pin"
      | "owner";
    const nextEdit = (input.editPolicy ?? page.editPolicy) as
      | "owner"
      | "pin"
      | "anyone";
    let nextHash = page.secretHash;
    if (input.secret !== undefined) {
      if (input.secret === null) nextHash = null;
      else nextHash = await hashSecret(input.secret);
    }
    const errs = policyErrors({
      viewPolicy: nextView,
      editPolicy: nextEdit,
      ownerId: page.ownerId,
      hasSecret: nextHash !== null,
      isAuthenticated: userId !== null,
    });
    if (errs.length > 0) {
      return Response.json({ error: errs.join("; ") }, { status: 400 });
    }
    patch.viewPolicy = nextView;
    patch.editPolicy = nextEdit;
    patch.secretHash = nextHash;
  }

  await db.update(pages).set(patch).where(eq(pages.id, page.id));
  const rows = await db.select().from(pages).where(eq(pages.id, page.id));
  const updated = rows[0];
  if (!updated) return notFound();
  return Response.json({
    page: serializePage(updated, await fileCountFor(updated.id)),
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const blocked = checkMutation(req);
  if (blocked) return blocked;
  const { slug } = await ctx.params;
  const access = await resolveAccess(slug);
  if (!access || !access.authz.isAdmin) return notFound();
  await db.delete(files).where(eq(files.pageId, access.page.id));
  await db.delete(pages).where(eq(pages.id, access.page.id));
  return Response.json({ ok: true });
}
