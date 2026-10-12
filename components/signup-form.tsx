"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { isUsernameAllowed } from "@/lib/auth-username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/loading";

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

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
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setError("Google sign-in is not configured yet.");
    }
  };

  return (
    <Card className="mx-auto mt-12 w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign up</CardTitle>
        <CardDescription>
          Pick a username and password — no email required. Or continue with
          Google.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button variant="outline" onClick={google}>
          Continue with Google
        </Button>
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
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          <p className="rounded-lg border p-3 text-xs text-muted-foreground" role="note">
            Emfile has no email, so we can&apos;t reset a lost password. Store
            it somewhere safe.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <Spinner label="Creating account" /> Creating account…
              </>
            ) : (
              "Sign up"
            )}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          Have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
