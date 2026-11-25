import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal/legal-document";
import { legalPublished } from "@/lib/legal";
import { LEGAL_TEXTS } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Términos y condiciones — AgendoMX" };

export const dynamic = "force-dynamic";

export default function TermsPage() {
  if (!legalPublished()) notFound();
  return <LegalDocument markdown={LEGAL_TEXTS.terms} />;
}
