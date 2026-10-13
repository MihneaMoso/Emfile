import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { normalizeDatabaseUrl } from "../lib/db/url";

// Run with: bun run scripts/migrate.ts
// Applies ./drizzle migrations to local.db or Turso when configured.
// Skips Turso when TURSO_DATABASE_URL is unset (local dev uses push/auto).
async function main() {
  if (process.env.TURSO_DATABASE_URL) {
    const client = createClient({
      url: normalizeDatabaseUrl(process.env.TURSO_DATABASE_URL),
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.info("migrations applied to Turso");
  } else {
    // Local SQLite: ensure tables exist via direct DDL (no server roundtrip).
    const { createClient: lc } = await import("@libsql/client");
    const client = lc({ url: "file:./local.db" });
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = "./drizzle";
    if (fs.existsSync(dir)) {
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const f of files) {
        const sql = fs.readFileSync(path.join(dir, f), "utf8");
        const statements = sql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter(Boolean);
        for (const stmt of statements) {
          try {
            await client.execute(stmt);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!/already exists/i.test(msg)) throw err;
          }
        }
        console.info(`applied ${f}`);
      }
    } else {
      console.info("no ./drizzle folder; nothing to apply");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
