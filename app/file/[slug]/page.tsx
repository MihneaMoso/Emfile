import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { normalizeSlug } from "@/lib/slug";
import { resolveAccess } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db/client";
import { files as filesTable } from "@/lib/db/schema";
import type { PageResponse } from "@/lib/page-types";
import { UnlockForm } from "@/components/unlock-form";
import { FilePageClient } from "./file-page-client";

export const runtime = "nodejs";

// File pages are never indexed. Only public pages expose title/description.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const access = await resolveAccess(normalizeSlug(slug));
  const robots = { index: false, follow: false, noarchive: true };
  if (!access || !access.authz.isViewer) {
    return { title: "Not found · Emfile", robots };
  }
  if (access.page.viewPolicy !== "public") {
    return { title: "Protected page · Emfile", robots };
  }
  return {
    title: `${access.page.title} · Emfile`,
    description: access.page.description || undefined,
    robots,
    openGraph: {
      title: access.page.title,
      description: access.page.description || undefined,
    },
  };
}

export default async function FilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = normalizeSlug(raw);
  const access = await resolveAccess(slug);
  // 404 (not 403) for anything the caller may not know exists.
  if (!access || !access.authz.isViewer) {
    // Locked pages show a generic unlock screen instead of leaking details.
    if (access && (access.page.viewPolicy === "pin" || access.page.editPolicy === "pin")) {
      return <UnlockForm slug={slug} />;
    }
    notFound();
  }
  const user = await getSessionUser();
  // File rows come from the server so first paint already has them. SWR
  // revalidates client-side (focus/interval) and shows a skeleton only when
  // there is genuinely no data yet — never a false "No files yet".
  const fileRows = await db
    .select()
    .from(filesTable)
    .where(eq(filesTable.pageId, access.page.id));
  const ordered = [...fileRows].sort((a, b) => a.position - b.position);
  const initial: PageResponse = {
    page: {
      id: access.page.id,
      slug: access.page.slug,
      title: access.page.title,
      description: access.page.description,
      viewPolicy: access.page.viewPolicy as PageResponse["page"]["viewPolicy"],
      editPolicy: access.page.editPolicy as PageResponse["page"]["editPolicy"],
      hasSecret: access.page.secretHash !== null,
      ownerId: access.page.ownerId,
      createdAt: access.page.createdAt,
      updatedAt: access.page.updatedAt,
    },
    files: ordered.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mime: f.mime,
      kind: f.kind as "p2p" | "inline",
      infoHash: f.infoHash,
      magnetUri: f.magnetUri,
      content: f.kind === "inline" ? f.content : null,
      revision: f.revision,
      position: f.position,
      updatedAt: f.updatedAt,
    })),
    role: access.authz.role,
  };
  return (
    <FilePageClient slug={slug} initial={initial} signedIn={user !== null} />
  );
}
