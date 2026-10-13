import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { authorize, type Authz } from "./authorize";
import {
  creatorCookieName,
  unlockCookieName,
  verifyCreatorToken,
  verifyUnlockToken,
} from "./cookies";
import { db } from "./db/client";
import { pages, type Page } from "./db/schema";
import { getSessionUser } from "./session";
import { normalizeSlug } from "./slug";

export interface PageAccess {
  page: Page;
  authz: Authz;
  userId: string | null;
}

export async function loadPageBySlug(slug: string): Promise<Page | null> {
  const normalized = normalizeSlug(slug);
  const rows = await db.select().from(pages).where(eq(pages.slug, normalized));
  return rows[0] ?? null;
}

/** Resolve authorize() inputs from session + cookies. Returns 404-style null when missing. */
export async function resolveAccess(rawSlug: string): Promise<PageAccess | null> {
  // Normalize here (single place) so every API route + server component
  // handles mixed-case / padded slugs identically. Previously each caller
  // had to remember to normalize, which caused 404s on pages that existed.
  const slug = normalizeSlug(rawSlug);
  const page = await loadPageBySlug(slug);
  if (!page) return null;
  const user = await getSessionUser();
  const jar = await cookies();
  const rawCreator = jar.get(creatorCookieName(page.id))?.value;
  const rawUnlock = jar.get(unlockCookieName(page.id))?.value;
  const creatorValid = verifyCreatorToken(rawCreator, page.creatorTokenHash);
  const unlockedValid = rawUnlock
    ? await verifyUnlockToken(rawUnlock, page.id)
    : false;
  const authz = authorize(page, {
    userId: user?.id ?? null,
    creatorValid,
    unlocked: unlockedValid,
    unlockedValid,
  });
  return { page, authz, userId: user?.id ?? null };
}

export function notFound() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export function badRequest(message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status: 400 });
}

export function sameOrigin(req: Request): boolean {
  // Mutating routes: require same-origin (fetch same-origin + explicit check).
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetch may omit Origin
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    return o.host === host && (o.protocol.replace(":", "") === proto || process.env.NODE_ENV !== "production");
  } catch {
    return false;
  }
}

export function checkMutation(req: Request): Response | null {
  if (!sameOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const ct = req.headers.get("content-type") ?? "";
  if ((req.method === "POST" || req.method === "PATCH" || req.method === "PUT") && !ct.includes("application/json")) {
    // Allow empty-body POSTs (claim) but reject wrong content types.
    if (ct !== "") {
      return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }
  }
  return null;
}
