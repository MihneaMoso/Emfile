"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Link2, Lock, Radio } from "lucide-react";
import { toast } from "sonner";
import { parseSlugInput, suggestSlug, isSlugValid } from "@/lib/slug";
import { pushRoute } from "@/lib/navigation";
import { useTorrent } from "@/lib/torrent/provider";
import { Dropzone } from "@/components/dropzone";
import { seedAndRegister } from "./seed-and-register";
import { PinSection, SlugField, useSlugCheck } from "./slug-pin-fields";
import { LoadingButton, Skeleton } from "@/components/loading";

/**
 * Reads `?slug=` (set by the not-found screen's "Create it" button) during
 * render — no effect, no extra render pass. Only called inside the Suspense
 * boundary in app/page.tsx so the landing route stays statically rendered.
 */
function useInitialSlug(): string {
  const params = useSearchParams();
  return React.useMemo(() => {
    const q = params.get("slug");
    if (!q) return suggestSlug();
    const parsed = parseSlugInput(q);
    return parsed.ok ? parsed.slug : suggestSlug();
  }, [params]);
}

export function LandingCreator() {
  const initial = useInitialSlug();
  // Remount (fresh suggestion/prefill state) if the query slug changes.
  return <LandingCreatorInner key={initial} initialSlug={initial} />;
}

/** Static hero: no search params, prerenders with the landing route. */
export function LandingHero() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="rounded-full border bg-muted/50 px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
        A linktree for files · peer-to-peer, no uploads
      </p>
      <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        Drop a file, share a link.
      </h1>
      <p className="max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
        Anyone can upload and get a page like{" "}
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px]">
          emfile.site/file/[slug]
        </code>
        . File bytes travel directly between browsers — the server keeps
        only metadata.
      </p>
    </div>
  );
}

/** Skeleton matching the creator form layout (no layout shift while suspended). */
export function LandingCreatorSkeleton() {
  return (
    <div
      className="flex flex-col gap-5"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function LandingCreatorInner({ initialSlug }: { initialSlug: string }) {
  const router = useRouter();
  const { ensureClient, markSeeding, ready } = useTorrent();
  const { slug, setSlug, slugState } = useSlugCheck(initialSlug);
  const [pin, setPin] = React.useState("");
  const [restrictView, setRestrictView] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [preparing, setPreparing] = React.useState(false);

  // Warm up the P2P engine on first pointer-down over the dropzone so the
  // "Preparing…" state rarely shows. Track readiness for the dropzone hint.
  const warm = React.useCallback(() => {
    if (ready || preparing) return;
    setPreparing(true);
    void ensureClient().finally(() => setPreparing(false));
  }, [ready, preparing, ensureClient]);

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
      // Client-side navigation keeps the singleton WebTorrent client alive,
      // so seeding continues uninterrupted onto the file page.
      pushRoute(router, `/file/${target}`);
      if (picked.length > 0) {
        toast.success("Page created — sharing your files…");
        void seedAndRegister(target, picked, ensureClient, markSeeding);
      }
    } catch {
      toast.error("Could not create the page.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div onPointerDown={warm} onFocusCapture={warm}>
        <Dropzone
          onFiles={(f) => void create(f)}
          preparing={preparing && !ready}
          label="Drop files here, click to browse, or paste"
        />
      </div>
      <SlugField slug={slug} setSlug={setSlug} slugState={slugState} idPrefix="landing" />
      <PinSection
        pin={pin}
        setPin={setPin}
        restrictView={restrictView}
        setRestrictView={setRestrictView}
      />
      <LoadingButton
        size="lg"
        loading={creating}
        onClick={() => void create([])}
        className="h-12 w-full text-[15px]"
      >
        {creating ? "Creating…" : (
          <span className="inline-flex items-center gap-2">
            Create page <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </LoadingButton>
      <p className="text-center text-xs text-muted-foreground">
        Tip: drop files onto the zone above to create and seed in one step.
        Keep the tab open while sharing.
      </p>
    </div>
  );
}

const STEPS = [
  {
    icon: ArrowRight,
    title: "1. Drop files",
    body: "Files never touch the server — your browser seeds them directly over WebRTC.",
  },
  {
    icon: Link2,
    title: "2. Share the link",
    body: "Send emfile.site/file/[slug] to anyone. Add an optional PIN for editing or viewing.",
  },
  {
    icon: Radio,
    title: "3. Stay online to share",
    body: "P2P files live while a seeder is online. Small text files are stored inline instead.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="flex flex-col gap-5 pb-14" aria-label="How it works">
      <h2 className="text-center text-lg font-semibold tracking-tight">
        How it works
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div
            key={s.title}
            className="flex flex-col gap-2.5 rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <span className="w-fit rounded-xl bg-primary/10 p-2" aria-hidden>
              <s.icon className="h-4 w-4 text-primary" />
            </span>
            <p className="text-[15px] font-semibold tracking-tight">{s.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
      <p className="mx-auto flex max-w-xl items-center gap-2 text-center text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Private pages are owner-only · PIN pages show only an unlock screen ·
        everything else is exactly as shareable as the link.
      </p>
    </section>
  );
}
