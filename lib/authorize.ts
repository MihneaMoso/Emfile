import type { Page } from "./db/schema";

export type Role = "admin" | "editor" | "viewer" | "none";

export interface AuthContext {
  /** Authenticated user id, if any. */
  userId?: string | null;
  /** Raw creator cookie value (`mp_c_<pageId>`), if present. */
  creatorCookie?: string | null;
  /** Whether a valid unlock cookie (`mp_u_<pageId>`) was presented. */
  unlocked?: boolean;
}

export interface Authz {
  role: Role;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
}

export type ViewPolicy = "public" | "pin" | "owner";
export type EditPolicy = "owner" | "pin" | "anyone";

export interface PageLike {
  ownerId: string | null;
  viewPolicy: string;
  editPolicy: string;
  secretHash: string | null;
  creatorTokenHash: string | null;
}

/**
 * Single source of truth for page authorization.
 *
 * NOTE on creator cookies: this pure function cannot do async scrypt/sha
 * compare, so callers must pre-verify cookies and pass the results in:
 * - `creatorValid`: creator cookie token matches `creatorTokenHash`
 *   (callers compute this via `verifyCreatorToken`, which already requires
 *   a stored hash — so `creatorValid: true` implies the page has one).
 * - `unlocked` / `unlockedValid`: unlock cookie (jose JWT) is valid.
 */

/**
 * Single source of truth for page authorization.
 *
 * NOTE on creator cookies: this pure function cannot do async scrypt/sha
 * compare, so callers must pre-verify cookies and pass the results in:
 * - `creatorValid`: creator cookie token matches `creatorTokenHash`
 * - `unlocked`: unlock cookie (jose JWT) is valid for this page
 */
export function authorize(
  page: PageLike,
  ctx: AuthContext & { creatorValid?: boolean; unlockedValid?: boolean },
): Authz {
  const userId = ctx.userId ?? null;
  const creatorValid = ctx.creatorValid ?? false;
  const unlocked = ctx.unlockedValid ?? ctx.unlocked ?? false;

  const isOwner = userId !== null && page.ownerId !== null && userId === page.ownerId;
  // Ownerless page: verified creator cookie OR valid unlock cookie grants admin.
  const isAnonymousAdmin = page.ownerId === null && (creatorValid || unlocked);

  if (isOwner || isAnonymousAdmin) {
    return { role: "admin", isAdmin: true, isEditor: true, isViewer: true };
  }

  const view = page.viewPolicy as ViewPolicy;
  const edit = page.editPolicy as EditPolicy;

  let editor = false;
  if (edit === "anyone") editor = true;
  else if (edit === "pin" && unlocked) editor = true;

  let viewer = editor;
  if (!viewer) {
    if (view === "public") viewer = true;
    else if (view === "pin" && unlocked) viewer = true;
  }

  if (editor) return { role: "editor", isAdmin: false, isEditor: true, isViewer: true };
  if (viewer) return { role: "viewer", isAdmin: false, isEditor: false, isViewer: true };
  return { role: "none", isAdmin: false, isEditor: false, isViewer: false };
}

/** Validate a (viewPolicy, editPolicy, owner, secret) combination. */
export function policyErrors(input: {
  viewPolicy: ViewPolicy;
  editPolicy: EditPolicy;
  ownerId: string | null;
  hasSecret: boolean;
  isAuthenticated: boolean;
}): string[] {
  const errors: string[] = [];
  const { viewPolicy, editPolicy, ownerId, hasSecret, isAuthenticated } = input;
  if (viewPolicy === "owner" && editPolicy !== "owner") {
    errors.push("view=owner requires edit=owner");
  }
  if (viewPolicy === "pin" && !(editPolicy === "pin" || editPolicy === "owner")) {
    errors.push("view=pin requires edit to be pin or owner");
  }
  const needsSecret =
    viewPolicy === "pin" || editPolicy === "pin";
  if (needsSecret && !hasSecret) {
    errors.push("PIN policies require a secret");
  }
  if ((viewPolicy === "owner" || editPolicy === "owner") && ownerId === null) {
    errors.push("anonymous pages cannot use owner policies");
  }
  return errors;
}

export type { Page };
