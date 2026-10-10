import { NextRequest } from "next/server";
import { z } from "zod";
import { loadPageBySlug } from "@/lib/api-helpers";
import { isSlugValid } from "@/lib/slug";

export const runtime = "nodejs";

const querySchema = z.object({ slug: z.string().min(1).max(40) });

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("slug") ?? "";
  const parsed = querySchema.safeParse({ slug: raw });
  if (!parsed.success) {
    return Response.json(
      { available: false, error: "Invalid slug" },
      { status: 400 },
    );
  }
  const slug = raw.trim().toLowerCase();
  if (!isSlugValid(slug)) {
    return Response.json({ available: false, reason: "invalid" });
  }
  const existing = await loadPageBySlug(slug);
  return Response.json({ available: !existing });
}

