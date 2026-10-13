"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/loading";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [googleBusy, setGoogleBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.signIn.username({
        username: username.trim().toLowerCase(),
        password,
      });
      if (res.error) {
        // Generic error: never reveal whether the username exists.
        setError("Invalid username or password.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Invalid username or password.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: next });
    } catch {
      setError("Google sign-in is not configured yet.");
      setGoogleBusy(false);
    }
  };

  return (
    <Card className="mx-auto mt-10 w-full max-w-md shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:mt-14">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>
          Username and password — no email needed. Or continue with Google.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LoadingButton variant="outline" onClick={google} loading={googleBusy} className="w-full">
          {googleBusy ? "Redirecting…" : "Continue with Google"}
        </LoadingButton>
        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-username">Username</Label>
            <Input
              id="login-username"
              value={username}
              autoComplete="username"
              spellCheck={false}
              required
              disabled={busy}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="login-password"
                type={show ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                required
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="shrink-0"
              >
                {show ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <LoadingButton type="submit" loading={busy} className="w-full">
            {busy ? "Logging in…" : "Log in"}
          </LoadingButton>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
