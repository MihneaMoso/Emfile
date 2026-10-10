"use client";

import * as React from "react";
import type { PageSummary } from "@/lib/page-types";
import { isSlugValid } from "@/lib/slug";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

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
  const needsPin = state.viewPolicy === "pin" || state.editPolicy === "pin";

  const checkSlug = React.useCallback(
    async (value: string) => {
      const v = value.trim().toLowerCase();
      if (!v || v === page.slug) {
        setSlugMsg(null);
        return;
      }
      if (!isSlugValid(v)) {
        setSlugMsg("Invalid slug (3–40 chars, a-z/0-9/dashes).");
        return;
      }
      try {
        const res = await fetch(`/api/slug-check?slug=${encodeURIComponent(v)}`);
        const data = (await res.json()) as { available?: boolean };
        setSlugMsg(data.available ? "Available." : "That slug is taken.");
      } catch {
        setSlugMsg(null);
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
        <Input
          id="settings-slug"
          value={state.nextSlug}
          maxLength={40}
          onChange={(e) => {
            onChange({ ...state, nextSlug: e.target.value });
            void checkSlug(e.target.value);
          }}
        />
        {slugMsg ? (
          <p className="text-xs text-muted-foreground">{slugMsg}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-view">Who can view</Label>
          <select
            id="settings-view"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            value={state.viewPolicy}
            onChange={(e) =>
              onChange({ ...state, viewPolicy: e.target.value as ViewPolicy })
            }
          >
            <option value="public">Anyone with the link</option>
            <option value="pin">Only with PIN</option>
            {signedIn ? <option value="owner">Only me</option> : null}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-edit">Who can edit</Label>
          <select
            id="settings-edit"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            value={state.editPolicy}
            onChange={(e) =>
              onChange({ ...state, editPolicy: e.target.value as EditPolicy })
            }
          >
            <option value="anyone">Anyone with the link</option>
            <option value="pin">Only with PIN</option>
            {signedIn ? <option value="owner">Only me</option> : null}
          </select>
        </div>
      </div>
      {needsPin ? (
        <div className="flex flex-col gap-2">
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
            placeholder={page.hasSecret ? "Leave blank to keep" : "Choose a PIN"}
            onChange={(e) => onChange({ ...state, pin: e.target.value })}
          />
        </div>
      ) : null}
      {page.hasSecret && !needsPin ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.removePin}
            onChange={(e) => onChange({ ...state, removePin: e.target.checked })}
          />
          Remove PIN
        </label>
      ) : null}
      {!page.ownerId && !page.hasSecret ? (
        <p className="text-xs text-muted-foreground">
          Tip: set a PIN so access survives a lost browser cookie.
        </p>
      ) : null}
    </div>
  );
}
