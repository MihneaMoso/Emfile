import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { normalizeSlug } from "@/lib/slug";
import { resolveAccess } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/session";
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
    files: [],
    role: access.authz.role,
  };
  return (
    <FilePageClient slug={slug} initial={initial} signedIn={user !== null} />
  );
}
