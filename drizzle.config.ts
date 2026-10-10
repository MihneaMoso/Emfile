import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    // drizzle-kit only needs this for studio; runtime uses libsql client.
    url: "./local.db",
  },
} satisfies Config;
