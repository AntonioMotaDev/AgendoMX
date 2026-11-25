import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal/legal-document";
import { Logo } from "@/components/ui/logo";
import { getDb } from "@/db";
import { legalPublished } from "@/lib/legal";
import { fillClientNotice, LEGAL_TEXTS } from "@/lib/legal-content";
import { getPublicBusinessBySlug } from "@/server/queries/public";

export const metadata: Metadata = { title: "Aviso de privacidad — AgendoMX", robots: { index: false } };

export const dynamic = "force-dynamic";

/**
 * Privacy notice for the customers of one business. The business is the data controller, so the
 * text names it and its own contact data; AgendoMX appears as the platform and processor.
 */
export default async function BusinessPrivacyPage({ params }: PageProps<"/[slug]/privacidad">) {
  if (!legalPublished()) notFound();
  const { slug } = await params;
  const found = await getPublicBusinessBySlug(await getDb(), slug);
  if (!found) notFound();
  const { business } = found;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href={`/${business.slug}`} aria-label={business.name}>
        <Logo className="text-xl" />
      </Link>
      <LegalDocument markdown={fillClientNotice(LEGAL_TEXTS.privacyClientsFull, business)} />
      <Link href={`/${business.slug}`} className="text-sm font-semibold text-brand-ink underline underline-offset-4">
        Volver al perfil de {business.name}
      </Link>
    </main>
  );
}
