import Link from "next/link";

export function Footer() {
  // REPORT_EMAIL is display-only (footer mailto:); Emfile v1 sends no email.
  const report = process.env.REPORT_EMAIL ?? "";
  return (
    <footer className="border-t bg-muted/20">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-7 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-[13px] leading-relaxed">
          <span className="font-semibold text-foreground">Emfile</span> — a
          linktree for files. Bytes travel peer-to-peer; the server keeps only
          metadata.
        </p>
        <nav className="flex items-center gap-5 text-[13px]" aria-label="Footer">
          <Link
            href="/"
            className="rounded px-1 py-1 transition-colors hover:text-foreground"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="rounded px-1 py-1 transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          {report ? (
            <a
              href={`mailto:${report}`}
              className="rounded px-1 py-1 transition-colors hover:text-foreground"
            >
              Report abuse
            </a>
          ) : (
            <span className="text-xs">P2P · no uploads stored</span>
          )}
        </nav>
      </div>
    </footer>
  );
}
