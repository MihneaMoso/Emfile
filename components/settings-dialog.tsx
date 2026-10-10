"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { toast } from "sonner";
import type { PageSummary } from "@/lib/page-types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { SettingsForm, settingsFromPage } from "./settings-form";

export function SettingsDialog({
  page,
  slug,
  signedIn,
  open,
  onOpenChange,
}: {
  page: PageSummary;
  slug: string;
  signedIn: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page settings</DialogTitle>
          <DialogDescription>
            Anyone with this PIN can edit and manage this page.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <SettingsDialogBody
            key={`${page.id}:${page.updatedAt}`}
            page={page}
            slug={slug}
            signedIn={signedIn}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialogBody({
  page,
  slug,
  signedIn,
  onOpenChange,
}: {
  page: PageSummary;
  slug: string;
  signedIn: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = React.useState(() => settingsFromPage(page));
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (state.title.trim() !== page.title) {
        body.title = state.title.trim().slice(0, 80);
      }
      if (state.description !== page.description) {
        body.description = state.description.slice(0, 500);
      }
      if (state.nextSlug.trim().toLowerCase() !== page.slug) {
        body.slug = state.nextSlug.trim().toLowerCase();
      }
      if (state.viewPolicy !== page.viewPolicy) body.viewPolicy = state.viewPolicy;
      if (state.editPolicy !== page.editPolicy) body.editPolicy = state.editPolicy;
      if (state.removePin) body.secret = null;
      else if (state.pin.length > 0) body.secret = state.pin;
      if (Object.keys(body).length === 0) {
        onOpenChange(false);
        return;
      }
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        page?: PageSummary;
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "Could not save settings.");
        return;
      }
      toast.success("Settings saved.");
      onOpenChange(false);
      const newSlug = data?.page?.slug ?? slug;
      await mutate(["page", slug]);
      if (newSlug !== slug) router.push(`/file/${newSlug}`);
      else router.refresh();
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("claim failed");
      toast.success("Page claimed to your account.");
      await mutate(["page", slug]);
      router.refresh();
    } catch {
      toast.error("Could not claim this page.");
    }
  };

  const destroy = async () => {
    if (!window.confirm("Delete this page and all its files?")) return;
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Deleted.");
      onOpenChange(false);
      router.push(signedIn ? "/dashboard" : "/");
    } catch {
      toast.error("Could not delete.");
    }
  };

  return (
    <>
      <SettingsForm
        page={page}
        signedIn={signedIn}
        state={state}
        onChange={setState}
      />
      {!page.ownerId && signedIn ? (
        <Button variant="outline" onClick={claim}>
          Claim this page to my account
        </Button>
      ) : null}
      <DialogFooter>
        <Button variant="destructive" onClick={destroy}>
          Delete page
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
