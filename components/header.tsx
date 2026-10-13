"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import { Skeleton } from "./loading";

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
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-lg px-1 py-1 text-lg font-bold tracking-tight transition-colors hover:text-primary"
          aria-label="Emfile home"
        >
          Emfile
        </Link>
        <div className="flex min-h-11 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {isPending ? (
            <span className="flex items-center gap-2" aria-label="Loading account">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="hidden h-8 w-20 rounded-lg sm:block" />
            </span>
          ) : name ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="gap-1.5">
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  Dashboard
                </Link>
              </Button>
              <span
                className="hidden max-w-32 truncate rounded-md bg-muted px-2 py-1 text-[13px] text-muted-foreground sm:inline"
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
