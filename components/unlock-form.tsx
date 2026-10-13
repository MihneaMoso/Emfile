"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { LoadingButton } from "./loading";

export function UnlockForm({ slug }: { slug: string }) {
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        retryAfter?: number;
      } | null;
      if (res.status === 429) {
        setError(
          `Too many attempts. Try again${data?.retryAfter ? ` in ${data.retryAfter}s` : " later"}.`,
        );
      } else {
        setError(data?.error ?? "Incorrect PIN.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="mx-auto mt-14 w-full max-w-md shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:mt-20">
      <CardHeader className="items-center text-center">
        <span className="rounded-2xl bg-muted p-3" aria-hidden>
          <Lock className="h-5 w-5 text-muted-foreground" />
        </span>
        <CardTitle>This page is protected</CardTitle>
        <CardDescription>
          Enter the PIN to view and download. Nothing about this page is shown
          until you unlock it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="unlock-pin">PIN</Label>
            <Input
              id="unlock-pin"
              type="password"
              autoComplete="current-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter PIN"
              required
              disabled={pending}
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <LoadingButton
            type="submit"
            loading={pending}
            disabled={pending || secret.length === 0}
            className="w-full"
          >
            {pending ? "Unlocking…" : "Unlock"}
          </LoadingButton>
        </form>
      </CardContent>
    </Card>
  );
}
