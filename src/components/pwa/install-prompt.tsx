"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

const t = copy.pwa.install;
const DISMISS_KEY = "agendomx:install-dismissed";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false; // storage blocked: just show it again next time
  }
}

/**
 * Offers to install the panel as an app. Android/desktop Chrome give us an install
 * event; iPhone has none, so it gets the Share-menu instructions instead. Hidden
 * once installed (standalone) or dismissed.
 */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || readDismissed()) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // Deferred out of the effect body on purpose: the prompt is a progressive extra, never part of first paint.
    const timer = window.setTimeout(() => {
      setIos(isIos);
      setHidden(false);
    }, 0);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Not remembered; harmless.
    }
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
    setHidden(true);
  }

  // Nothing to offer: no install event (yet) and not an iPhone.
  if (hidden || (!installEvent && !ios)) return null;

  return (
    <aside aria-label={t.title} className="mb-5 flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
      <Download aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">{t.title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{installEvent ? t.body : t.iosBody}</p>
        {installEvent ? (
          <Button onClick={install} className="mt-3 sm:w-auto">
            {t.cta}
          </Button>
        ) : null}
      </div>
      <button type="button" onClick={dismiss} aria-label={t.dismiss} className="-mr-2 -mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-muted hover:bg-ink/5">
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
    </aside>
  );
}
