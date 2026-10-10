// Smoke test: exercises the Emfile API end to end over HTTP.
// Run: bun run scripts/smoke.ts  (expects app on http://localhost:3200)
export {};

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3200";

let cookies = "";

async function req(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookies ? { cookie: cookies } : {}),
      ...(init.headers ?? {}),
    },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    // Keep creator/unlock cookies for subsequent requests.
    const parts = setCookie.split(/,(?=[^;]+=[^;]+;)/g);
    for (const p of parts) {
      const kv = p.split(";")[0].trim();
      if (kv.startsWith("mp_c_") || kv.startsWith("mp_u_")) {
        cookies = cookies ? `${cookies}; ${kv}` : kv;
      }
    }
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function assert(cond: boolean, msg: string, extra?: unknown) {
  if (!cond) {
    console.error(`FAIL: ${msg}`, extra ?? "");
    process.exit(1);
  }
  console.info(`ok: ${msg}`);
}

const slug = `smoke-${Date.now().toString(36)}`;

// 1. slug check
{
  const r = await req(`/api/slug-check?slug=${slug}`);
  assert(r.status === 200, "slug-check 200");
  assert(
    (r.body as { available?: boolean }).available === true,
    "slug available",
  );
}

// 2. create anonymous public/anyone page
let pageId = "";
{
  const r = await req("/api/pages", {
    method: "POST",
    body: JSON.stringify({ slug, title: "Smoke", editPolicy: "anyone" }),
  });
  assert(r.status === 201, "create page 201", r);
  const page = (r.body as { page: { id: string; slug: string } }).page;
  assert(page.slug === slug, "slug matches");
  pageId = page.id;
  assert(cookies.includes(`mp_c_${pageId}`), "creator cookie set");
}

// 3. read page (viewer via public)
{
  const r = await req(`/api/pages/${slug}`);
  assert(r.status === 200, "read page 200", r);
  assert(
    (r.body as { role?: string }).role === "admin",
    "creator is admin",
    r.body,
  );
}

// 4. create inline text file
let fileId = "";
let revision = 1;
{
  const r = await req(`/api/pages/${slug}/files`, {
    method: "POST",
    body: JSON.stringify({
      kind: "inline",
      name: "notes.txt",
      size: 11,
      mime: "text/plain",
      content: "hello world",
    }),
  });
  assert(r.status === 201, "create inline file 201", r);
  const f = (r.body as { file: { id: string; revision: number } }).file;
  fileId = f.id;
  revision = f.revision;
}

// 5. edit inline content with correct revision
{
  const r = await req(`/api/pages/${slug}/files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "hello v2", revision }),
  });
  assert(r.status === 200, "edit inline 200", r);
  // `revision` intentionally stays stale (1) for the next check.
}

// 6. stale revision -> 409
{
  const r = await req(`/api/pages/${slug}/files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "stale", revision }),
  });
  assert(r.status === 409, "stale revision 409", r);
  revision = (r.body as { revision: number }).revision;
}

// 7. PIN page: create + verify locked without cookie
const pinSlug = `pin-${Date.now().toString(36)}`;
{
  const r = await req("/api/pages", {
    method: "POST",
    body: JSON.stringify({
      slug: pinSlug,
      title: "Locked",
      viewPolicy: "pin",
      editPolicy: "pin",
      secret: "1234",
    }),
  });
  assert(r.status === 201, "create pin page 201", r);
}
{
  // Drop cookies to simulate a second browser.
  const saved = cookies;
  cookies = "";
  const r = await req(`/api/pages/${pinSlug}`);
  assert(r.status === 404, "locked page is 404 without unlock", r);
  // Wrong PIN -> 401/429, not 200.
  const bad = await req(`/api/pages/${pinSlug}/unlock`, {
    method: "POST",
    body: JSON.stringify({ secret: "wrong" }),
  });
  assert(bad.status !== 200, "wrong PIN rejected", bad);
  // Correct PIN -> 200 + unlock cookie.
  const good = await req(`/api/pages/${pinSlug}/unlock`, {
    method: "POST",
    body: JSON.stringify({ secret: "1234" }),
  });
  assert(good.status === 200, "correct PIN unlocks", good);
  const r2 = await req(`/api/pages/${pinSlug}`);
  assert(r2.status === 200, "unlocked page reads 200", r2);
  cookies = saved;
}

// 8. p2p file registration (metadata only — no bytes touch server)
{
  const infoHash = "a".repeat(40);
  const r = await req(`/api/pages/${slug}/files`, {
    method: "POST",
    body: JSON.stringify({
      kind: "p2p",
      name: "movie.mp4",
      size: 123456,
      mime: "video/mp4",
      infoHash,
      magnetUri: `magnet:?xt=urn:btih:${infoHash}&dn=movie.mp4`,
    }),
  });
  assert(r.status === 201, "register p2p file 201", r);
}

// 9. rename file
{
  const r = await req(`/api/pages/${slug}/files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "renamed.txt" }),
  });
  assert(r.status === 200, "rename 200", r);
}

// 10. delete file + delete page
{
  const r = await req(`/api/pages/${slug}/files/${fileId}`, {
    method: "DELETE",
  });
  assert(r.status === 200, "delete file 200", r);
  const d = await req(`/api/pages/${slug}`, { method: "DELETE" });
  assert(d.status === 200, "delete page 200", d);
  const gone = await req(`/api/pages/${slug}`);
  assert(gone.status === 404, "deleted page 404", gone);
}

console.info("\nAll smoke tests passed.");
