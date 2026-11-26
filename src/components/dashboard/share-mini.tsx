"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { copy } from "@/lib/copy";

const c = copy.onboarding.done;
const t = copy.panel.agenda;

interface Props {
  publicUrl: string;
  publicHost: string;
  slug: string;
  businessName: string;
  /** SVG of the QR code, drawn on the server. */
  qrSvg: string;
}

/** Compact "share my page" card for the agenda: QR, link, copy and (where the device has it) the share sheet. */
export function ShareMini({ publicUrl, publicHost, slug, businessName, qrSvg }: Props) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the link stays on screen for manual copy.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: businessName, text: c.shareText(businessName), url: publicUrl });
    } catch {
      // The user dismissed the share sheet.
    }
  }

  const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-paper";
  return (
    <section aria-labelledby="share-title" className="flex items-center gap-3.5 rounded-[20px] border border-line bg-surface p-3.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
        alt={t.qrAlt(`${publicHost}/${slug}`)}
        width={76}
        height={76}
        className="h-[76px] w-[76px] shrink-0 rounded-xl border border-line"
      />
      <div className="min-w-0 flex-1">
        <h2 id="share-title" className="text-[15px] font-extrabold text-ink">
          {t.shareTitle}
        </h2>
        <p className="mb-2 truncate text-[13px] font-semibold text-brand-ink">
          {publicHost}/{slug}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={copyLink}>
            {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            {copied ? c.copied : c.copy}
          </button>
          {canShare ? (
            <button type="button" className={btn} onClick={share}>
              <Share2 aria-hidden="true" className="h-4 w-4" />
              {c.share}
            </button>
          ) : null}
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {copied ? c.copied : ""}
        </p>
      </div>
    </section>
  );
}
