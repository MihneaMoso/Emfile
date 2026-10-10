"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTorrent } from "@/lib/torrent/provider";

export function Dropzone({
  onFiles,
  multiple = true,
  className,
  label = "Drag & drop files here, click to browse, or paste from clipboard",
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  className?: string;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const { prefetch } = useTorrent();

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
        "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/40 px-6 py-10 text-center transition-colors hover:border-primary/60 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragOver && "border-primary bg-muted",
        className,
      )}
    >
      <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        Files stay in your browser and are shared peer-to-peer.
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
