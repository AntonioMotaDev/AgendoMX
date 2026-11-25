import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/dashboard/service-form";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { centsToInput } from "@/lib/money";
import { getCurrentBusiness } from "@/lib/session";
import { getService } from "@/server/queries/services";

export const metadata: Metadata = { title: "Editar servicio — AgendoMX", robots: { index: false } };

export default async function EditServicePage({ params }: PageProps<"/app/servicios/[id]">) {
  const { id } = await params;
  const business = (await getCurrentBusiness())!;
  // Scoped by the session's business: an id from another business is simply "not found".
  const service = await getService(await getDb(), business.id, id);
  if (!service) notFound();

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <Link href="/app/servicios" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-ink">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {copy.panel.common.back}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{copy.panel.services.editTitle}</h1>
      <ServiceForm
        serviceId={service.id}
        initial={{
          name: service.name,
          description: service.description ?? "",
          price: centsToInput(service.priceCents),
          priceIsFrom: service.priceIsFrom,
          durationMin: service.durationMin,
          bufferAfterMin: service.bufferAfterMin,
          isBookableOnline: service.isBookableOnline,
          isActive: service.isActive,
        }}
      />
    </section>
  );
}
