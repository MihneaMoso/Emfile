"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { toast } from "sonner";
import { pushRoute } from "@/lib/navigation";
import type { PageSummary } from "@/lib/page-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";
import { SettingsForm, settingsFromPage } from "./settings-form";
import { LoadingButton } from "./loading";
import { Button } from "./ui/button";

function useIsMobile(breakpoint = 640): boolean {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return mobile;
}

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
  const mobile = useIsMobile();
  const body = open ? (
    <SettingsDialogBody
      key={`${page.id}:${page.updatedAt}`}
      page={page}
      slug={slug}
      signedIn={signedIn}
      onOpenChange={onOpenChange}
    />
  ) : null;

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Page settings</DrawerTitle>
            <DrawerDescription>
              Anyone with this PIN can edit and manage this page.
            </DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page settings</DialogTitle>
          <DialogDescription>
            Anyone with this PIN can edit and manage this page.
          </DialogDescription>
        </DialogHeader>
        {body}
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
  const [claiming, setClaiming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

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
      if (newSlug !== slug) pushRoute(router, `/file/${newSlug}`);
      else router.refresh();
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    setClaiming(true);
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
    } finally {
      setClaiming(false);
    }
  };

  const destroy = async () => {
    if (!window.confirm("Delete this page and all its files?")) return;
    setDeleting(true);
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
    } finally {
      setDeleting(false);
    }
  };

  const actions = (
    <>
      <SettingsForm
        page={page}
        signedIn={signedIn}
        state={state}
        onChange={setState}
      />
      {!page.ownerId && signedIn ? (
        <LoadingButton
          variant="outline"
          loading={claiming}
          onClick={claim}
          className="w-full"
        >
          {claiming ? "Claiming…" : "Claim this page to my account"}
        </LoadingButton>
      ) : null}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <LoadingButton
          variant="destructive"
          loading={deleting}
          onClick={destroy}
        >
          {deleting ? "Deleting…" : "Delete page"}
        </LoadingButton>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton loading={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </LoadingButton>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {actions}
    </div>
  );
}
