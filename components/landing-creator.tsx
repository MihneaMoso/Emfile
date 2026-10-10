"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { suggestSlug, isSlugValid } from "@/lib/slug";
import { useTorrent } from "@/lib/torrent/provider";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/dropzone";
import { seedAndRegister } from "./seed-and-register";
import { PinSection, SlugField, useSlugCheck } from "./slug-pin-fields";

export function LandingCreator() {
  const router = useRouter();
  const { ensureClient, markSeeding } = useTorrent();
  const { slug, setSlug, slugState } = useSlugCheck(suggestSlug());
  const [pin, setPin] = React.useState("");
  const [restrictView, setRestrictView] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const create = async (picked: File[]) => {
    if (creating) return;
    const v = slug.trim().toLowerCase();
    if (!isSlugValid(v)) {
      toast.error("Pick a valid slug first (3–40 chars, a-z/0-9/dashes).");
      return;
    }
    if (slugState === "taken") {
      toast.error("That slug is taken. Try another.");
      return;
    }
    if (pin.length > 0 && pin.length < 4) {
      toast.error("PIN must be at least 4 characters.");
      return;
    }
    setCreating(true);
    try {
      const wantsPin = pin.length >= 4;
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: v,
          title: "Untitled page",
          description: "",
          viewPolicy: wantsPin && restrictView ? "pin" : "public",
          editPolicy: wantsPin ? "pin" : "anyone",
          ...(wantsPin ? { secret: pin } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        page?: { slug: string };
      } | null;
      if (!res.ok || !data?.page) {
        toast.error(data?.error ?? "Could not create the page.");
        return;
      }
      const target = data.page.slug;
      router.push(`/file/${target}`);
      if (picked.length > 0) {
        void seedAndRegister(target, picked, ensureClient, markSeeding);
      }
    } catch {
      toast.error("Could not create the page.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="flex flex-col gap-6 py-10 sm:py-14" aria-label="Create a page">
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Drop a file, share a link.
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Anyone can upload and get a page like{" "}
          <code className="rounded bg-muted px-1">emfile.site/file/[slug]</code>.
          File bytes travel peer-to-peer — the server keeps only metadata.
        </p>
      </div>
      <Dropzone onFiles={(f) => void create(f)} />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <SlugField slug={slug} setSlug={setSlug} slugState={slugState} idPrefix="landing" />
        <PinSection
          pin={pin}
          setPin={setPin}
          restrictView={restrictView}
          setRestrictView={setRestrictView}
        />
        <Button size="lg" disabled={creating} onClick={() => void create([])}>
          {creating ? "Creating…" : "Create page"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Tip: drop files onto the zone above to create and seed in one step.
        </p>
      </div>
    </section>
  );
}

export function LandingHowItWorks() {
  return (
    <section className="flex flex-col gap-4 pb-10" aria-label="How it works">
      <h2 className="text-xl font-semibold">How it works</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { t: "1. Drop files", d: "Files never touch the server — your browser seeds them directly." },
          { t: "2. Share the link", d: "Send emfile.site/file/[slug] to anyone. Optional PIN for editing or viewing." },
          { t: "3. Stay online to share", d: "P2P files exist while a seeder is online. Small text files are stored inline instead." },
        ].map((s) => (
          <div key={s.t} className="rounded-xl border p-4">
            <p className="font-medium">{s.t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
