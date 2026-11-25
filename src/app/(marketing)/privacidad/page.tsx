import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal/legal-document";
import { legalPublished } from "@/lib/legal";
import { LEGAL_TEXTS } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Aviso de privacidad — AgendoMX" };

// Dark until legal approves the text (see lib/legal.ts).
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  if (!legalPublished()) notFound();
  return <LegalDocument markdown={LEGAL_TEXTS.privacyOwners} />;
}
