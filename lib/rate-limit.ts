import { and, eq, gt } from "drizzle-orm";
import { db } from "./db/client";
import { rateLimits } from "./db/schema";

/**
 * Simple DB-backed fixed-window counter.
 * Returns the current count AFTER incrementing.
 */
export async function hitRateLimit(
  key: string,
  windowMs: number,
): Promise<number> {
  const now = new Date();
  const rows = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.key, key));
  const row = rows[0];
  if (!row || now.getTime() - row.windowStart.getTime() > windowMs) {
    await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: 1, windowStart: now },
      });
    return 1;
  }
  const next = row.count + 1;
  await db
    .update(rateLimits)
    .set({ count: next })
    .where(eq(rateLimits.key, key));
  return next;
}

/**
 * Exponential lockout for PIN attempts: after 5 failures the page locks out
 * for 2^(failures-5) minutes (capped at 60). Counts failures via a dedicated
 * key; callers record failures with `recordUnlockFailure`.
 */
export async function unlockBackoffMs(key: string): Promise<number> {
  const rows = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.key, key));
  const row = rows[0];
  if (!row) return 0;
  const failures = row.count;
  if (failures < 5) return 0;
  const minutes = Math.min(2 ** (failures - 5), 60);
  const elapsed = Date.now() - row.windowStart.getTime();
  const lockout = minutes * 60 * 1000;
  return elapsed < lockout ? lockout - elapsed : 0;
}

export async function recordUnlockFailure(key: string): Promise<void> {
  const rows = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.key, key));
  const row = rows[0];
  if (!row || row.count < 5) {
    await hitRateLimit(key, 15 * 60 * 1000);
  } else {
    // Extend the lockout window start on each new failure.
    await db
      .update(rateLimits)
      .set({ count: row.count + 1, windowStart: new Date() })
      .where(eq(rateLimits.key, key));
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

export function staleGuard() {
  return and(eq(rateLimits.key, "__never__"), gt(rateLimits.count, 0));
}
