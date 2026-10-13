/**
 * Normalize a database URL for @libsql/client, which accepts only
 * "libsql:", "wss:", "ws:", "https:", "http:" and "file:" schemes.
 * Turso surfaces the same database as `turso://…` in several places, and
 * users sometimes paste a bare host — map both to `libsql://…`.
 * Anything else (including file: URLs) passes through untouched.
 */
export function normalizeDatabaseUrl(raw: string): string {
  const url = raw.trim();
  if (/^turso:\/\//i.test(url)) {
    return url.replace(/^turso:\/\//i, "libsql://");
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    return url;
  }
  return `libsql://${url}`;
}
