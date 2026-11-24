"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { slugSchema } from "@/lib/validators/onboarding";
import { checkSlugAction } from "@/server/actions/onboarding";

const c = copy.onboarding.business;

export type SlugState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "invalid"; message: string };

/**
 * Live availability of a slug while the owner types. Format problems are derived
 * during render (no server call); only the server's answer is stored, tied to
 * the slug it was for. The owner's own current slug counts as available.
 */
export function useSlugStatus(slug: string | undefined): { state: SlugState; markTaken: () => void; checked: string | null } {
  const [remote, setRemote] = useState<{ slug: string; state: "available" | "taken" } | null>(null);

  const value = (slug ?? "").trim();
  const local = value === "" ? null : slugSchema.safeParse(value);
  const checked = local?.success ? local.data : null;

  useEffect(() => {
    if (!checked) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkSlugAction(checked);
      if (cancelled || !result.ok || result.data.state === "invalid") return;
      setRemote({ slug: checked, state: result.data.state });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [checked]);

  const state: SlugState =
    value === ""
      ? { kind: "idle" }
      : local && !local.success
        ? { kind: "invalid", message: local.error.issues[0]?.message ?? c.slugFormat }
        : remote && remote.slug === checked
          ? { kind: remote.state }
          : { kind: "checking" };

  return { state, markTaken: () => checked && setRemote({ slug: checked, state: "taken" }), checked };
}

export function SlugStatus({ state, serverError }: { state: SlugState; serverError?: string }) {
  if (serverError) return <span className="text-danger">{serverError}</span>;
  switch (state.kind) {
    case "checking":
      return (
        <span className="inline-flex items-center gap-1.5 text-ink-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {c.slugChecking}
        </span>
      );
    case "available":
      return (
        <span className="inline-flex items-center gap-1.5 text-success">
          <Check aria-hidden="true" className="h-4 w-4" />
          {c.slugAvailable}
        </span>
      );
    case "taken":
      return (
        <span className="inline-flex items-center gap-1.5 text-danger">
          <X aria-hidden="true" className="h-4 w-4" />
          {c.slugTaken}
        </span>
      );
    case "invalid":
      return (
        <span className="inline-flex items-center gap-1.5 text-danger">
          <X aria-hidden="true" className="h-4 w-4" />
          {state.message}
        </span>
      );
    default:
      return null;
  }
}
