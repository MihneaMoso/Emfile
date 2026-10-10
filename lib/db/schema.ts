import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Better Auth tables (sqlite dialect, per better-auth drizzle adapter docs)
// Includes username plugin columns on `user`. The `email` column is required
// by Better Auth internally but is NEVER collected, displayed, or mailed in
// Emfile v1: username signups store a synthetic `<random>@users.emfile.invalid`
// address (the .invalid TLD can never receive mail).
// ---------------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});


// ---------------------------------------------------------------------------
// Emfile tables
// ---------------------------------------------------------------------------

export type ViewPolicy = "public" | "pin" | "owner";
export type EditPolicy = "owner" | "pin" | "anyone";
export type FileKind = "p2p" | "inline";

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull().default("Untitled page"),
  description: text("description").notNull().default(""),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
  viewPolicy: text("view_policy").notNull().default("public"),
  editPolicy: text("edit_policy").notNull().default("anyone"),
  secretHash: text("secret_hash"),
  creatorTokenHash: text("creator_token_hash"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  lastActivityAt: integer("last_activity_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull().default(0),
  mime: text("mime").notNull().default("application/octet-stream"),
  kind: text("kind").notNull().default("p2p"),
  infoHash: text("info_hash"),
  magnetUri: text("magnet_uri"),
  content: text("content"),
  revision: integer("revision").notNull().default(1),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: integer("window_start", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Better Auth DB-backed rate limiting (storage: "database") expects its own
// `rateLimit` table. The adapter's schema check requires an `id` column plus
// key/count/lastRequest (epoch ms).
// NOTE: the export name must be `rateLimit` — the drizzle adapter validates
// the schema object by export key.
export const rateLimit = sqliteTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  count: integer("count").notNull(),
  lastRequest: integer("lastRequest").notNull(),
});

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type FileRow = typeof files.$inferSelect;
