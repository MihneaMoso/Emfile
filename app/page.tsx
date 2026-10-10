import type { Metadata } from "next";
import {
  LandingCreator,
  LandingHowItWorks,
} from "@/components/landing-creator";

export const metadata: Metadata = {
  title: "Emfile — a linktree for files",
  description:
    "Drop a file, get a shareable page. File bytes travel peer-to-peer in the browser.",
};

export default function Home() {
  return (
    <>
      <LandingCreator />
      <LandingHowItWorks />
    </>
  );
}
