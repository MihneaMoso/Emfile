import { customAlphabet } from "nanoid";

export const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "login",
  "signup",
  "file",
  "admin",
  "settings",
  "_next",
  "static",
]);

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const nanoidShort = customAlphabet(alphabet, 7);

const ADJECTIVES = [
  "quiet",
  "bright",
  "swift",
  "calm",
  "bold",
  "clever",
  "gentle",
  "lucky",
  "nimble",
  "brave",
  "cosy",
  "eager",
  "fuzzy",
  "happy",
  "jolly",
  "kind",
  "lively",
  "merry",
  "neat",
  "sunny",
];

const ANIMALS = [
  "otter",
  "fox",
  "panda",
  "heron",
  "badger",
  "crane",
  "dove",
  "elk",
  "finch",
  "gecko",
  "ibis",
  "jay",
  "koala",
  "lynx",
  "mole",
  "newt",
  "owl",
  "puma",
  "quail",
  "raven",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random human-friendly slug suggestion, e.g. `quiet-otter-x7k`. */
export function suggestSlug(): string {
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${nanoidShort().slice(0, 3)}`;
}

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isSlugValid(slug: string): boolean {
  if (slug.length < 3 || slug.length > 40) return false;
  if (!SLUG_RE.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

export function newId(prefix = "", size = 12): string {
  const gen = customAlphabet(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    size,
  );
  return `${prefix}${gen()}`;
}
