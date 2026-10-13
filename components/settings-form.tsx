"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageSummary } from "@/lib/page-types";
import { isSlugValid } from "@/lib/slug";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";

export type ViewPolicy = "public" | "pin" | "owner";
export type EditPolicy = "owner" | "pin" | "anyone";

export interface SettingsState {
  title: string;
  description: string;
  nextSlug: string;
  viewPolicy: ViewPolicy;
  editPolicy: EditPolicy;
  pin: string;
  removePin: boolean;
}

export function settingsFromPage(page: PageSummary): SettingsState {
  return {
    title: page.title,
    description: page.description,
    nextSlug: page.slug,
    viewPolicy: page.viewPolicy,
    editPolicy: page.editPolicy,
    pin: "",
    removePin: false,
  };
}

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SettingsForm({
  page,
  signedIn,
  state,
  onChange,
}: {
  page: PageSummary;
  signedIn: boolean;
  state: SettingsState;
  onChange: (s: SettingsState) => void;
}) {
  const [slugMsg, setSlugMsg] = React.useState<string | null>(null);
  const [slugOk, setSlugOk] = React.useState<boolean | null>(null);
  const needsPin = state.viewPolicy === "pin" || state.editPolicy === "pin";

  const checkSlug = React.useCallback(
    async (value: string) => {
      const v = value.trim().toLowerCase();
      if (!v || v === page.slug) {
        setSlugMsg(null);
        setSlugOk(null);
        return;
      }
      if (!isSlugValid(v)) {
        setSlugMsg("Invalid slug (3–40 chars, a-z/0-9/dashes).");
        setSlugOk(false);
        return;
      }
      try {
        const res = await fetch(`/api/slug-check?slug=${encodeURIComponent(v)}`);
        const data = (await res.json()) as { available?: boolean };
        setSlugOk(data.available === true);
        setSlugMsg(data.available ? "Available." : "That slug is taken.");
      } catch {
        setSlugMsg(null);
        setSlugOk(null);
      }
    },
    [page.slug],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-title">Title</Label>
        <Input
          id="settings-title"
          value={state.title}
          maxLength={80}
          onChange={(e) => onChange({ ...state, title: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-desc">Description</Label>
        <Textarea
          id="settings-desc"
          value={state.description}
          maxLength={500}
          rows={3}
          onChange={(e) => onChange({ ...state, description: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-slug">Slug</Label>
        <div className="relative">
          <Input
            id="settings-slug"
            value={state.nextSlug}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            className="pr-10 font-mono text-sm"
            onChange={(e) => {
              onChange({ ...state, nextSlug: e.target.value });
              void checkSlug(e.target.value);
            }}
          />
          {slugOk === true ? (
            <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" aria-hidden />
          ) : null}
        </div>
        {slugMsg ? (
          <p
            className={cn(
              "text-xs",
              slugOk === false ? "text-destructive" : "text-muted-foreground",
            )}
            role="status"
          >
            {slugMsg}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            emfile.site/file/{state.nextSlug || page.slug}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-view">Who can view</Label>
          <select
            id="settings-view"
            className={selectClass}
            value={state.viewPolicy}
            onChange={(e) =>
              onChange({ ...state, viewPolicy: e.target.value as ViewPolicy })
            }
          >
            <option value="public">Anyone with the link</option>
            <option value="pin">Only with PIN</option>
            {signedIn ? <option value="owner">Only me (private)</option> : null}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-edit">Who can edit</Label>
          <select
            id="settings-edit"
            className={selectClass}
            value={state.editPolicy}
            onChange={(e) =>
              onChange({ ...state, editPolicy: e.target.value as EditPolicy })
            }
          >
            <option value="anyone">Anyone with the link</option>
            <option value="pin">Only with PIN</option>
            {signedIn ? <option value="owner">Only me (private)</option> : null}
          </select>
        </div>
      </div>
      {needsPin ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3.5">
          <Label htmlFor="settings-pin">
            PIN {page.hasSecret ? "(change)" : "(set)"} — 4–128 characters
          </Label>
          <Input
            id="settings-pin"
            type="password"
            autoComplete="new-password"
            value={state.pin}
            minLength={4}
            maxLength={128}
            placeholder={page.hasSecret ? "Leave blank to keep current PIN" : "Choose a PIN"}
            onChange={(e) => onChange({ ...state, pin: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Anyone with this PIN can edit and manage this page.
          </p>
        </div>
      ) : null}
      {page.hasSecret && !needsPin ? (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm">
          <span>Remove PIN</span>
          <Switch
            checked={state.removePin}
            onCheckedChange={(v) => onChange({ ...state, removePin: v })}
            aria-label="Remove PIN"
          />
        </label>
      ) : null}
      {!page.ownerId ? (
        <p className="rounded-xl bg-muted/50 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {page.hasSecret
            ? "Anonymous page: keep the PIN safe — it is the only way back in if the browser cookie is lost."
            : "Anonymous page: set a PIN so access survives a lost browser cookie."}
        </p>
      ) : null}
    </div>
  );
}
