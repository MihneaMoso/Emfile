"use client";

import * as React from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTorrent } from "@/lib/torrent/provider";
import { Spinner } from "@/components/loading";

export function Dropzone({
  onFiles,
  multiple = true,
  className,
  label = "Drag & drop files here, click to browse, or paste from clipboard",
  preparing = false,
  preparingLabel = "Preparing…",
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  className?: string;
  label?: string;
  /** When true, the P2P engine chunk is still loading. */
  preparing?: boolean;
  preparingLabel?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const { prefetch } = useTorrent();

  // Prefetch the WebTorrent chunk when idle so the first drop rarely waits.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => prefetch(), { timeout: 3000 });
      void id;
    } else {
      const t = window.setTimeout(() => prefetch(), 2000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [prefetch]);

  const emit = React.useCallback(
    (list: FileList | File[] | null | undefined) => {
      if (!list) return;
      const arr = Array.from(list).filter((f) => f.size >= 0);
      if (arr.length > 0) onFiles(multiple ? arr : arr.slice(0, 1));
    },
    [onFiles, multiple],
  );

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Page-wide paste-to-upload, except where text editing is expected:
      // inputs, textareas, selects, and the CodeMirror editor keep normal
      // paste behavior (this covers the "Go to:" input and every form field).
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, select, [contenteditable], .cm-content")) {
        return;
      }
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        emit(e.clipboardData.files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [emit]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        emit(e.dataTransfer.files);
      }}
      className={cn(
        "group flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200",
        "border-input bg-muted/30 hover:border-primary/50 hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        dragOver && "scale-[1.01] border-primary bg-primary/5 shadow-lg",
        className,
      )}
    >
      <span
        className={cn(
          "rounded-2xl bg-primary/10 p-3.5 transition-colors group-hover:bg-primary/15",
          dragOver && "bg-primary/20",
        )}
        aria-hidden
      >
        <FileUp className="h-7 w-7 text-primary" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold tracking-tight">{label}</span>
        <span className="text-[13px] text-muted-foreground">
          Files stay in your browser and are shared peer-to-peer — nothing is
          uploaded to a server.
        </span>
      </span>
      <span
        className="pointer-events-none flex min-h-5 items-center text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {preparing ? (
          <span className="inline-flex items-center gap-1.5">
            <Spinner label="Preparing sharing engine" size="sm" />
            {preparingLabel}
          </span>
        ) : null}
      </span>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
