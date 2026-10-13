"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { isUsernameAllowed } from "@/lib/auth-username";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/loading";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [googleBusy, setGoogleBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = username.trim().toLowerCase();
    if (!isUsernameAllowed(name)) {
      setError("Username must be 3–30 chars: a-z, 0-9, _ . -");
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("Password must be 8–128 characters.");
      return;
    }
    setBusy(true);
    try {
      // Better Auth requires an email column internally: the username
      // plugin path uses signUp.email with a synthetic .invalid address
      // (documented in lib/auth.ts). We never display it.
      const res = await authClient.signUp.email({
        email: `${name}.${crypto.randomUUID().slice(0, 8)}@users.emfile.invalid`,
        password,
        name,
        username: name,
        displayUsername: username.trim(),
      });
      if (res.error) {
        setError("That username is taken or invalid. Try another.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("That username is taken or invalid. Try another.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setError("Google sign-in is not configured yet.");
      setGoogleBusy(false);
    }
  };

  return (
    <Card className="mx-auto mt-10 w-full max-w-md shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:mt-14">
      <CardHeader>
        <CardTitle>Sign up</CardTitle>
        <CardDescription>
          Pick a username and password — no email required. Or continue with
          Google.
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
            <Label htmlFor="signup-username">Username</Label>
            <Input
              id="signup-username"
              value={username}
              autoComplete="username"
              spellCheck={false}
              required
              minLength={3}
              maxLength={30}
              disabled={busy}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              3–30 chars, lowercase letters/numbers plus _ . -
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="signup-password"
                type={show ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
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
          <p className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground" role="note">
            Emfile has no email, so we can&apos;t reset a lost password. Store
            it somewhere safe.
          </p>
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <LoadingButton type="submit" loading={busy} className="w-full">
            {busy ? "Creating account…" : "Sign up"}
          </LoadingButton>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
