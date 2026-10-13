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

export type SlugParseResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

/** Inline error shown when a "Go to:" input cannot be parsed. */
export const SLUG_INPUT_ERROR =
  "Slugs use lowercase letters, numbers and hyphens (3-40 characters).";

/**
 * Parse free-form "Go to:" input into a page slug.
 * Trims, lowercases, converts whitespace runs to hyphens, drops a trailing
 * slash, and extracts the slug when a full link is pasted
 * (`https://emfile.site/file/math-book/` → `math-book`). The result is
 * validated with the same regex and reserved-word list used everywhere else.
 */
export function parseSlugInput(raw: string): SlugParseResult {
  const invalid = (): SlugParseResult => ({ ok: false, error: SLUG_INPUT_ERROR });
  let s = raw.trim().toLowerCase();
  if (!s) return invalid();
  const fileIdx = s.indexOf("/file/");
  if (fileIdx >= 0) s = s.slice(fileIdx + "/file/".length);
  s = s.split(/[?#]/)[0].replace(/\/+$/, "").replace(/\s+/g, "-");
  if (!s) return invalid();
  if (!isSlugValid(s)) return invalid();
  return { ok: true, slug: s };
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
