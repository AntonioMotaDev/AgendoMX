"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production only: in development the service worker would
 * cache non-hashed chunks and fight hot reloading. Failure is harmless (the app
 * simply works online-only), so errors are ignored.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
