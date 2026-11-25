import type { MetadataRoute } from "next";
import { copy } from "@/lib/copy";

/**
 * Web app manifest (served at /manifest.webmanifest). The installed app is the
 * owner's panel: it opens at /app, which sends signed-out people to login.
 * Colors match docs/BRAND.md (paper background, charcoal status bar).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy.pwa.name,
    short_name: copy.pwa.name,
    description: copy.pwa.description,
    lang: "es-MX",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2efe7",
    theme_color: "#f2efe7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
