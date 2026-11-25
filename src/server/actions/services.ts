"use server";

import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { getCurrentBusiness, requireOwner } from "@/lib/session";
import { serviceFormSchema } from "@/lib/validators/services";
import { firstIssue, guarded } from "./helpers";
import { fail, ok, type ActionResult } from "./result";
import { createService, deleteService, moveService, updateService, type ServiceWriteError } from "./service-writes";

const t = copy.panel.services;

const messages: Record<ServiceWriteError, string> = {
  not_found: copy.panel.common.notFound,
  last_active: t.errors.lastActive,
  has_appointments: t.errors.hasAppointments,
};

/** Every action resolves the business from the session; ids from the client only pick a row inside it. */
async function currentBusinessId(): Promise<string | null> {
  await requireOwner();
  return (await getCurrentBusiness())?.id ?? null;
}

export async function createServiceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const businessId = await currentBusinessId();
  if (!businessId) return fail(copy.onboarding.guard.incomplete);
  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  return guarded("createService", async () => {
    const result = await createService(await getDb(), businessId, parsed.data);
    return result.ok ? ok(result.data) : fail(copy.panel.common.genericError);
  });
}

export async function updateServiceAction(serviceId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const businessId = await currentBusinessId();
  if (!businessId) return fail(copy.onboarding.guard.incomplete);
  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  return guarded("updateService", async () => {
    const result = await updateService(await getDb(), businessId, serviceId, parsed.data);
    return result.ok ? ok(result.data) : fail(messages[result.error as ServiceWriteError] ?? copy.panel.common.genericError);
  });
}

export async function deleteServiceAction(serviceId: string): Promise<ActionResult> {
  const businessId = await currentBusinessId();
  if (!businessId) return fail(copy.onboarding.guard.incomplete);

  return guarded("deleteService", async () => {
    const result = await deleteService(await getDb(), businessId, serviceId);
    return result.ok ? ok(undefined) : fail(messages[result.error]);
  });
}

export async function moveServiceAction(serviceId: string, direction: "up" | "down"): Promise<ActionResult> {
  const businessId = await currentBusinessId();
  if (!businessId) return fail(copy.onboarding.guard.incomplete);
  if (direction !== "up" && direction !== "down") return fail(copy.panel.common.genericError);

  return guarded("moveService", async () => {
    const result = await moveService(await getDb(), businessId, serviceId, direction);
    return result.ok ? ok(undefined) : fail(copy.panel.common.notFound);
  });
}
