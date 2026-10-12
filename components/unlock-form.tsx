"use client";

import * as React from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Spinner } from "./loading";

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
    <Card className="mx-auto mt-16 w-full max-w-md">
      <CardHeader>
        <CardTitle>This page is protected</CardTitle>
        <CardDescription>
          Enter the PIN to view and edit this page.
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
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending || secret.length === 0}>
            {pending ? (
              <>
                <Spinner label="Unlocking" /> Unlocking…
              </>
            ) : (
              "Unlock"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
