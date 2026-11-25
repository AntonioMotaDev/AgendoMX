import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NEW_SERVICE_DEFAULTS, ServiceForm } from "@/components/dashboard/service-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Nuevo servicio — AgendoMX", robots: { index: false } };

export default function NewServicePage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <Link href="/app/servicios" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-ink">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {copy.panel.common.back}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{copy.panel.services.newTitle}</h1>
      <ServiceForm initial={NEW_SERVICE_DEFAULTS} />
    </section>
  );
}
