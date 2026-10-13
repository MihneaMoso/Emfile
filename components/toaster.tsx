"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/** Sonner toasts follow the active app theme (never stuck light in dark mode). */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={
        resolvedTheme === "dark"
          ? "dark"
          : resolvedTheme === "light"
            ? "light"
            : "system"
      }
      richColors
      closeButton
      position="bottom-center"
    />
  );
}
