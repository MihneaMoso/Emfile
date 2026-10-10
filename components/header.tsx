"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const { data, isPending } = useSession();
  const router = useRouter();
  const user = data?.user as
    | { username?: string | null; displayUsername?: string | null; name?: string | null }
    | undefined;
  const name =
    user?.displayUsername ?? user?.username ?? user?.name ?? null;

  const signOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight" aria-label="Emfile home">
          Emfile
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {isPending ? null : name ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <span
                className="hidden max-w-32 truncate text-sm text-muted-foreground sm:inline"
                title={name}
              >
                {name}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
