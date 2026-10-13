DROP TABLE IF EXISTS "ratelimit";
--> statement-breakpoint
DROP TABLE IF EXISTS "rateLimit";
--> statement-breakpoint
CREATE TABLE "ratelimit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"lastRequest" integer NOT NULL
);
