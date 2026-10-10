export interface PageSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  viewPolicy: "public" | "pin" | "owner";
  editPolicy: "owner" | "pin" | "anyone";
  hasSecret: boolean;
  ownerId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  fileCount?: number;
}

export interface FileSummary {
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: "p2p" | "inline";
  infoHash: string | null;
  magnetUri: string | null;
  content: string | null;
  revision: number;
  position: number;
  updatedAt: string | Date;
}

export interface PageResponse {
  page: PageSummary;
  files: FileSummary[];
  role: "admin" | "editor" | "viewer" | "none";
}

export function isInlineText(
  mime: string,
  name: string,
  size: number,
): boolean {
  if (size > 256 * 1024) return false;
  if (mime.startsWith("text/")) return true;
  if (
    mime === "application/json" ||
    mime === "application/javascript" ||
    mime === "application/typescript"
  ) {
    return true;
  }
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (
    [
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
      "js",
      "jsx",
      "mjs",
      "cjs",
      "ts",
      "tsx",
      "py",
      "rb",
      "go",
      "rs",
      "java",
      "c",
      "h",
      "cpp",
      "hpp",
      "cs",
      "sh",
      "sql",
      "html",
      "css",
      "xml",
      "svg",
    ] as string[]
  ).includes(ext);
}
