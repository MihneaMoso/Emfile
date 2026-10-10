import { headers } from "next/headers";
import { auth } from "./auth";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
}

/** Never expose the internal synthetic email — only id/username/name. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    const u = session.user as typeof session.user & {
      username?: string | null;
      displayUsername?: string | null;
    };
    return {
      id: u.id,
      username: u.displayUsername ?? u.username ?? u.name ?? "user",
      name: u.displayUsername ?? u.username ?? u.name ?? "user",
    };
  } catch {
    return null;
  }
}

