/** Shape every server action returns (CLAUDE.md §7). */
export type ActionError = { message: string; field?: string };
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (message: string, field?: string): ActionResult<never> => ({ ok: false, error: { message, field } });
