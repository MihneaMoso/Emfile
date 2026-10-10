import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

const KEY_LEN = 32;
// scrypt params — balanced for serverless CPU limits, still OWASP-reasonable.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 32 * 1024 * 1024;

function scryptKey(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      secret,
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
      (err, derived) => {
        if (err) reject(err);
        else resolve(derived as Buffer);
      },
    );
  });
}

/** Hash a page PIN/password. Format: `scrypt$v1$<saltHex>$<keyHex>`. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptKey(secret, salt);
  return `scrypt$v1$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Constant-time verification of a page PIN/password. */
export async function verifySecret(
  secret: string,
  stored: string,
): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "v1") {
      return false;
    }
    const salt = Buffer.from(parts[2], "hex");
    const expected = Buffer.from(parts[3], "hex");
    if (salt.length !== 16 || expected.length !== KEY_LEN) return false;
    const actual = await scryptKey(secret, salt);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Hash opaque tokens (creator tokens) with SHA-256. Token itself is random. */
export function hashToken(token: string): string {
  return `sha256$${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

export function verifyToken(token: string, storedHash: string): boolean {
  const candidate = hashToken(token);
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(storedHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

