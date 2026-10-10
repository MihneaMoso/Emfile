import { describe, expect, test } from "bun:test";
import { authorize, policyErrors, type PageLike } from "./authorize";
function page(over: Partial<PageLike>): PageLike {
  return {
    ownerId: null,
    viewPolicy: "public",
    editPolicy: "anyone",
    secretHash: null,
    creatorTokenHash: null,
    ...over,
  };
}

describe("authorize — public page, no owner", () => {
  test("anonymous visitor is editor (public/anyone)", () => {
    const a = authorize(page({}), {});
    expect(a.role).toBe("editor");
    expect(a.isViewer).toBe(true);
  });
  test("authenticated non-owner is editor", () => {
    const a = authorize(page({}), { userId: "u1" });
    expect(a.role).toBe("editor");
  });
});

describe("authorize — owner policies", () => {
  const owned = page({ ownerId: "owner1", viewPolicy: "owner", editPolicy: "owner" });
  test("owner is admin", () => {
    expect(authorize(owned, { userId: "owner1" }).role).toBe("admin");
  });
  test("logged-out user gets none (private)", () => {
    expect(authorize(owned, {}).role).toBe("none");
  });
  test("other signed-in user gets none", () => {
    expect(authorize(owned, { userId: "other" }).role).toBe("none");
  });
  test("creator cookie does NOT grant admin on owned pages", () => {
    expect(
      authorize(owned, { creatorValid: true }).role,
    ).toBe("none");
  });
});

describe("authorize — pin view", () => {
  const p = page({
    ownerId: null,
    viewPolicy: "pin",
    editPolicy: "pin",
    secretHash: "x",
  });
  test("locked without cookie: none", () => {
    expect(authorize(p, {}).role).toBe("none");
  });
  test("unlocked: admin (ownerless + unlock cookie)", () => {
    // Ownerless pages: unlock cookie grants admin per spec.
    expect(authorize(p, { unlocked: true }).role).toBe("admin");
  });
});

describe("authorize — owned pin page (unlock grants editor, not admin)", () => {
  const p = page({
    ownerId: "owner1",
    viewPolicy: "pin",
    editPolicy: "pin",
    secretHash: "x",
  });
  test("unlocked non-owner is editor", () => {
    expect(authorize(p, { userId: "u2", unlocked: true }).role).toBe("editor");
  });
  test("locked non-owner is none", () => {
    expect(authorize(p, { userId: "u2" }).role).toBe("none");
  });
  test("owner is admin regardless", () => {
    expect(authorize(p, { userId: "owner1" }).role).toBe("admin");
  });
});

describe("authorize — public view, pin edit", () => {
  const p = page({
    ownerId: null,
    viewPolicy: "public",
    editPolicy: "pin",
    secretHash: "x",
  });
  test("anonymous without unlock: viewer", () => {
    const a = authorize(p, {});
    expect(a.role).toBe("viewer");
    expect(a.isEditor).toBe(false);
  });
  test("anonymous with creator cookie: admin", () => {
    expect(authorize(p, { creatorValid: true }).role).toBe("admin");
  });
});

describe("authorize — anyone edit", () => {
  test("public/anyone: viewer+editor for all", () => {
    const p = page({ viewPolicy: "public", editPolicy: "anyone" });
    expect(authorize(p, {}).isEditor).toBe(true);
  });
  test("owner-view page cannot have anyone-edit (invariant caught by policyErrors)", () => {
    const errs = policyErrors({
      viewPolicy: "owner",
      editPolicy: "anyone",
      ownerId: "u1",
      hasSecret: false,
      isAuthenticated: true,
    });
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe("authorize — ownerless creator admin", () => {
  test("creator cookie grants admin on ownerless page", () => {
    const p = page({ creatorTokenHash: "hash" });
    expect(authorize(p, { creatorValid: true }).role).toBe("admin");
  });
  test("bogus creator cookie grants nothing extra", () => {
    const p = page({
      viewPolicy: "pin",
      editPolicy: "pin",
      secretHash: "x",
    });
    expect(authorize(p, { creatorValid: false }).role).toBe("none");
  });
});

describe("policyErrors invariants", () => {
  test("view=owner requires edit=owner", () => {
    expect(
      policyErrors({
        viewPolicy: "owner",
        editPolicy: "pin",
        ownerId: "u1",
        hasSecret: true,
        isAuthenticated: true,
      }),
    ).toContain("view=owner requires edit=owner");
  });
  test("view=pin requires edit pin|owner", () => {
    expect(
      policyErrors({
        viewPolicy: "pin",
        editPolicy: "anyone",
        ownerId: null,
        hasSecret: false,
        isAuthenticated: false,
      }).length,
    ).toBeGreaterThan(0);
  });
  test("pin policies require secret", () => {
    expect(
      policyErrors({
        viewPolicy: "public",
        editPolicy: "pin",
        ownerId: null,
        hasSecret: false,
        isAuthenticated: false,
      }),
    ).toContain("PIN policies require a secret");
  });
  test("owner policies need an owner", () => {
    expect(
      policyErrors({
        viewPolicy: "owner",
        editPolicy: "owner",
        ownerId: null,
        hasSecret: false,
        isAuthenticated: false,
      }).length,
    ).toBeGreaterThan(0);
  });
  test("anonymous cannot use owner policies", () => {
    expect(
      policyErrors({
        viewPolicy: "public",
        editPolicy: "owner",
        ownerId: null,
        hasSecret: false,
        isAuthenticated: false,
      }),
    ).toContain("anonymous pages cannot use owner policies");
  });
  test("valid public/anyone combo passes", () => {
    expect(
      policyErrors({
        viewPolicy: "public",
        editPolicy: "anyone",
        ownerId: null,
        hasSecret: false,
        isAuthenticated: false,
      }),
    ).toEqual([]);
  });
  test("valid owned private combo passes", () => {
    expect(
      policyErrors({
        viewPolicy: "owner",
        editPolicy: "owner",
        ownerId: "u1",
        hasSecret: false,
        isAuthenticated: true,
      }),
    ).toEqual([]);
  });
});
