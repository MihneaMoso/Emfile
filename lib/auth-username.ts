import { RESERVED_SLUGS } from "./slug";

/**
 * Client-safe mirror of the server username policy (lib/auth.ts):
 * case-insensitive, 3–30 chars, ^[a-z0-9_.-]+$, no reserved words.
 * Kept in a UI-importable module so auth forms validate instantly;
 * the server re-validates via Better Auth regardless.
 */
export const USERNAME_RE = /^[a-z0-9_.-]+$/;

export function isUsernameAllowed(name: string): boolean {
  if (name.length < 3 || name.length > 30) return false;
  if (!USERNAME_RE.test(name)) return false;
  if (RESERVED_SLUGS.has(name)) return false;
  return true;
}
