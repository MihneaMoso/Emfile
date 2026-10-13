import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TorrentProvider } from "@/lib/torrent/provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { TopProgressBar } from "@/components/loading";
import { ThemedToaster } from "@/components/toaster";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Emfile — a linktree for files",
    template: "%s · Emfile",
  },
  description:
    "Drop a file, get a shareable page. File bytes travel peer-to-peer in the browser; the server hosts only metadata.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-dvh flex-col antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TorrentProvider>
            <TopProgressBar />
            <Header />
            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 sm:px-6">
              {children}
            </main>
            <Footer />
            <ThemedToaster />
          </TorrentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
