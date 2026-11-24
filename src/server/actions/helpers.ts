import type { ZodError } from "zod";
import { copy } from "@/lib/copy";
import { fail, type ActionResult } from "./result";

/** First validation problem as an action error, tagged with the field it belongs to. */
export function firstIssue(error: ZodError, fallback: string = copy.panel.common.genericError): ActionResult<never> {
  const issue = error.issues[0];
  return fail(issue?.message ?? fallback, issue?.path[0] === undefined ? undefined : String(issue.path[0]));
}

/**
 * Runs an action body. Unexpected failures are logged (Sentry picks up console.error)
 * and shown generically; Next's redirect()/notFound() signals keep propagating.
 */
export async function guarded<T>(label: string, work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await work();
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    console.error(`${label} failed`, error instanceof Error ? error.message : "unknown error");
    return fail(copy.panel.common.genericError);
  }
}
