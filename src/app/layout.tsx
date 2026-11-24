import type { Metadata, Viewport } from "next";
import { copy } from "@/lib/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
