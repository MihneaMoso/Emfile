import { NextRequest } from "next/server";
import {
  checkMutation,
  notFound,
  resolveAccess,
} from "@/lib/api-helpers";
import {
  COOKIE_FLAGS,
  getIp,
  hashIp,
  secureFlag,
  signUnlockToken,
  unlockCookieName,
} from "@/lib/cookies";
import {
  clearRateLimit,
  recordUnlockFailure,
  unlockBackoffMs,
} from "@/lib/rate-limit";
import { verifySecret } from "@/lib/secrets";
import { unlockSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /api/pages/[slug]/unlock { secret }
 * Verifies the page PIN (scrypt, per-secret salt, timingSafeEqual) and on
 * success sets an httpOnly jose-signed unlock cookie (mp_u_<pageId>, 30d).
 * Attempts are rate-limited per (IP-hash, page) with exponential lockout.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const blocked = checkMutation(req);
  if (blocked) return blocked;
  const { slug } = await ctx.params;
  const access = await resolveAccess(slug);
  if (!access) return notFound();
  const { page } = access;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!page.secretHash) {
    return Response.json({ error: "This page has no PIN" }, { status: 400 });
  }

  const ipHash = hashIp(getIp(req.headers));
  const key = `unlock:${page.id}:${ipHash}`;
  const waitMs = await unlockBackoffMs(key);
  if (waitMs > 0) {
    const retryAfter = Math.ceil(waitMs / 1000);
    return Response.json(
      { error: "Too many attempts. Try again later.", retryAfter },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const ok = await verifySecret(parsed.data.secret, page.secretHash);
  if (!ok) {
    await recordUnlockFailure(key);
    return Response.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  await clearRateLimit(key);
  const token = await signUnlockToken(page.id);
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${unlockCookieName(page.id)}=${token}${COOKIE_FLAGS}${secureFlag()}`,
  );
  return res;
}
