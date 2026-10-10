export const INLINE_MAX_BYTES = 256 * 1024;

const INLINE_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "yaml",
  "yml",
  "toml",
  "csv",
  "log",
  "ini",
  "env",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "cs",
  "swift",
  "kt",
  "php",
  "sh",
  "bash",
  "zsh",
  "sql",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "xml",
  "svg",
  "vue",
  "svelte",
  "r",
  "pl",
  "lua",
  "dockerfile",
  "gitignore",
  "editorconfig",
  "properties",
  "cfg",
  "conf",
]);

export function extensionOf(name: string): string {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

/** Text-like if mime is text/* or extension is whitelisted. */
export function isTextLike(mime: string, name: string): boolean {
  if (mime.startsWith("text/")) return true;
  if (
    mime === "application/json" ||
    mime === "application/x-yaml" ||
    mime === "application/toml" ||
    mime === "application/csv" ||
    mime === "application/javascript" ||
    mime === "application/typescript"
  ) {
    return true;
  }
  const ext = extensionOf(name);
  if (!ext) {
    const lower = name.toLowerCase();
    if (
      lower === "dockerfile" ||
      lower === "makefile" ||
      lower === "procfile" ||
      lower === ".env" ||
      lower === ".gitignore"
    ) {
      return true;
    }
    return false;
  }
  return INLINE_EXTS.has(ext);
}

export function shouldStoreInline(
  mime: string,
  name: string,
  size: number,
): boolean {
  return size <= INLINE_MAX_BYTES && isTextLike(mime, name);
}

/** Server-side filename sanitization. Strips paths, controls, truncates. */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/[<>:"|?*\u0000-\u001f\u007f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 255);
  return cleaned.length > 0 ? cleaned : "file";
}

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "javascript",
  tsx: "javascript",
  mts: "javascript",
  cts: "javascript",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  html: "html",
  htm: "html",
  xml: "html",
  svg: "html",
  vue: "html",
  svelte: "html",
  css: "css",
  scss: "css",
  less: "css",
  py: "python",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  java: "java",
  c: "cpp",
  h: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  go: "go",
  rs: "rust",
  cs: "cpp",
  swift: "cpp",
  kt: "java",
  php: "html",
  sh: "shell",
};

export function languageForFile(name: string): string {
  const ext = extensionOf(name);
  return EXT_TO_LANG[ext] ?? "plaintext";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const v = bytes / 1024 ** i;
  return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}
