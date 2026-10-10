import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { verifyToken } from "./secrets";

function secretKey(): Uint8Array {
  const s = process.env.BETTER_AUTH_SECRET ?? "";
  // jose requires a sufficiently long key; hash whatever is configured.
  return createHash("sha256").update(s, "utf8").digest();
}

export function creatorCookieName(pageId: string): string {
  return `mp_c_${pageId}`;
}

export function unlockCookieName(pageId: string): string {
  return `mp_u_${pageId}`;
}

export async function signUnlockToken(pageId: string): Promise<string> {
  const key = secretKey();
  return new SignJWT({ pid: pageId, kind: "unlock" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifyUnlockToken(
  token: string,
  pageId: string,
): Promise<boolean> {
  try {
    const key = secretKey();
    const { payload } = await jwtVerify(token, key);
    return (
      payload["kind"] === "unlock" &&
      (payload["pid"] as string) === pageId
    );
  } catch {
    return false;
  }
}

export function verifyCreatorToken(
  raw: string | null | undefined,
  storedHash: string | null,
): boolean {
  if (!raw || !storedHash) return false;
  return verifyToken(raw, storedHash);
}

export const COOKIE_FLAGS = "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000";

export function secureFlag(): string {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

export function hashIp(ip: string): string {
  const salt = process.env.BETTER_AUTH_SECRET ?? "emfile-dev";
  return createHash("sha256").update(`${salt}:${ip}`, "utf8").digest("hex");
}

export function getIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
