"use client";

import { Check, Copy, Download, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

const c = copy.onboarding.done;

function downloadPng(svg: string, filename: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const image = new Image();
  image.onload = () => {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return URL.revokeObjectURL(url);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  };
  image.src = url;
}

export function DoneStep({ publicUrl, publicHost, slug, businessName }: { publicUrl: string; publicHost: string; slug: string; businessName: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  // Dark modules on white with a quiet zone: scans reliably on screens and paper.
  const svg = renderSVG(publicUrl, { ecc: "M", border: 2, whiteColor: "#ffffff", blackColor: "#252724" });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the link stays visible on screen for manual copy.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: businessName, text: c.shareText(businessName), url: publicUrl });
    } catch {
      // The user dismissed the share sheet.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="link-label" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 id="link-label" className="text-sm font-medium text-ink-muted">
          {c.linkLabel}
        </h2>
        <p className="break-all text-base font-semibold text-ink">
          {publicHost}/{slug}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={copyLink}>
            {copied ? <Check aria-hidden="true" className="h-5 w-5" /> : <Copy aria-hidden="true" className="h-5 w-5" />}
            {copied ? c.copied : c.copy}
          </Button>
          {canShare ? (
            <Button variant="secondary" onClick={share}>
              <Share2 aria-hidden="true" className="h-5 w-5" />
              {c.share}
            </Button>
          ) : null}
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {copied ? c.copied : ""}
        </p>
      </section>

      <section aria-labelledby="qr-label" className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-4 text-center">
        <h2 id="qr-label" className="text-base font-semibold text-ink">
          {c.qrTitle}
        </h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL generated on the client */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
          alt={`Código QR de ${publicHost}/${slug}`}
          width={192}
          height={192}
          className="h-48 w-48 rounded-md border border-line"
        />
        <p className="text-sm text-ink-muted">{c.qrHint}</p>
        <Button variant="secondary" onClick={() => downloadPng(svg, `qr-${slug}.png`)}>
          <Download aria-hidden="true" className="h-5 w-5" />
          {c.qrDownload}
        </Button>
      </section>

      <Link
        href="/app"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-base font-semibold text-surface hover:bg-ink/90"
      >
        {c.goToBusiness}
      </Link>
    </div>
  );
}
