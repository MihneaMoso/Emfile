import { Suspense } from "react";
import type { Metadata } from "next";
import {
  LandingCreator,
  LandingCreatorSkeleton,
  LandingHero,
  LandingHowItWorks,
} from "@/components/landing-creator";
import { GoToPage } from "@/components/go-to-page";

export const metadata: Metadata = {
  title: "Emfile — a linktree for files",
  description:
    "Drop a file, get a shareable page. File bytes travel peer-to-peer in the browser.",
};

export default function Home() {
  return (
    <>
      <section
        className="flex flex-col gap-8 py-10 sm:py-16"
        aria-label="Create a page"
      >
        <LandingHero />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          <GoToPage />
          {/* Only the creator form reads ?slug= (not-found "Create it")
              client-side inside this boundary, so the hero, the "Go to:"
              section and the landing route itself stay statically rendered. */}
          <Suspense fallback={<LandingCreatorSkeleton />}>
            <LandingCreator />
          </Suspense>
        </div>
      </section>
      <LandingHowItWorks />
    </>
  );
}
