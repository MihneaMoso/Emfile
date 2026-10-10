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

function hasCreator(page: PageLike, ctx: AuthContext): boolean {
  if (!ctx.creatorCookie || !page.creatorTokenHash) return false;
  // Cookie holds the raw token; compare via the same sha256 wrapper used
  // at creation (lib/secrets hashToken). To keep this module dependency-free
  // and synchronous for testability, verification happens in the caller and
  // is passed as `creatorValid`. Here we treat a non-empty cookie as a claim
  // only when the page actually has a stored hash — the route layer verifies.
  return true;
}

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
  void hasCreator;
  const userId = ctx.userId ?? null;
  const creatorValid = ctx.creatorValid ?? false;
  const unlocked = ctx.unlockedValid ?? ctx.unlocked ?? false;

  const isOwner = userId !== null && page.ownerId !== null && userId === page.ownerId;
  // Ownerless page: creator cookie OR unlock cookie grants admin.
  const isAnonymousAdmin =
    page.ownerId === null && (creatorValid || unlocked);

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
    errors.push("owner policies require an authenticated owner");
  }
  if (ownerId === null && (viewPolicy === "owner" || editPolicy === "owner")) {
    errors.push("anonymous pages cannot use owner policies");
  }
  void isAuthenticated;
  void hasCreator;
  return errors;
}

export type { Page };
