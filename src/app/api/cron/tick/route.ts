import { getDb } from "@/db";
import { isValidCronRequest } from "@/lib/cron-auth";
import { optionalEnv } from "@/lib/env";
import { sendReminderEmail } from "@/lib/email/booking-emails";
import { runCronTick } from "@/server/actions/cron-run";

export const dynamic = "force-dynamic";

/**
 * Internal endpoint hit by the Worker's `scheduled` handler (worker.ts) through
 * the self-reference binding. Not meant for people: it needs the derived bearer
 * token, and answers 404 to everything else so it does not advertise itself.
 */
export async function POST(request: Request) {
  if (!(await isValidCronRequest(request.headers.get("authorization"), optionalEnv("BETTER_AUTH_SECRET")))) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const summary = await runCronTick(await getDb(), new Date(), (r) => sendReminderEmail({ to: r.clientEmail, clientName: r.clientName, token: r.publicToken, startsAt: r.startsAt, serviceName: r.serviceName, business: r.business }));
    return Response.json(summary);
  } catch (error) {
    console.error("cron tick failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok: false }, { status: 500 });
  }
}
