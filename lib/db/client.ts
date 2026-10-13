import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { normalizeDatabaseUrl } from "./url";

function resolveUrl(): string {
  const turso = process.env.TURSO_DATABASE_URL;
  if (turso && turso.length > 0) return normalizeDatabaseUrl(turso);
  return "file:./local.db";
}

const globalForDb = globalThis as unknown as {
  __emfileDb?: ReturnType<typeof drizzle<typeof schema>>;
  __emfileClient?: ReturnType<typeof createClient>;
};

function build() {
  const url = resolveUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient(
    authToken ? { url, authToken } : { url },
  );
  return { client, db: drizzle(client, { schema }) };
}

if (!globalForDb.__emfileDb) {
  const { client, db } = build();
  globalForDb.__emfileClient = client;
  globalForDb.__emfileDb = db;
}

export const db = globalForDb.__emfileDb as ReturnType<
  typeof drizzle<typeof schema>
>;
export { schema };
