import Link from "next/link";

export function Footer() {
  // REPORT_EMAIL is display-only (footer mailto:); Emfile v1 sends no email.
  const report = process.env.REPORT_EMAIL ?? "";
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-semibold text-foreground">Emfile</span> — files
          travel peer-to-peer. Nothing is stored on the server.
        </p>
        <nav className="flex items-center gap-4" aria-label="Footer">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          {report ? (
            <a href={`mailto:${report}`} className="hover:text-foreground">
              Report abuse
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
