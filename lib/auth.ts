import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db, schema } from "./db/client";
import { RESERVED_SLUGS } from "./slug";

function baseURL(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

/**
 * Emfile v1 auth: username + password (via the `username` plugin) and Google
 * OAuth. No email is ever collected, displayed, or mailed: username signups
 * store a synthetic `<random>@users.emfile.invalid` address internally to
 * satisfy Better Auth's required `email` column (`.invalid` can never receive
 * mail). No verification / password-reset email exists in v1.
 */
export const USERNAME_RE = /^[a-z0-9_.-]+$/;

export function isUsernameAllowed(name: string): boolean {
  if (name.length < 3 || name.length > 30) return false;
  if (!USERNAME_RE.test(name)) return false;
  if (RESERVED_SLUGS.has(name)) return false;
  return true;
}

export const auth = betterAuth({
  baseURL: baseURL(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    // Pass the full schema: the adapter validates its expected tables
    // (user/session/account/verification/rateLimit) against this object.
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  account: {
    // Never auto-link Google identities into username accounts: the
    // synthetic .invalid address would never match, and implicit linking
    // would be a takeover vector.
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
    },
  },
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : undefined,
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (name) => isUsernameAllowed(name),
      displayUsername: true,
      usernameNormalization: (u) => u.toLowerCase(),
      validationOrder: {
        username: "post-normalization",
        displayUsername: "pre-normalization",
      },
    }),
    nextCookies(),
  ],
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-in/username": { window: 60, max: 10 },
      "/sign-up/email": { window: 300, max: 10 },
      "/sign-up/username": { window: 300, max: 10 },
    },
  },
});

export type Session = typeof auth.$Infer.Session;

