/** SQLSTATE raised by the appointments_no_overlap EXCLUDE constraint. */
export const EXCLUSION_VIOLATION = "23P01";
export const UNIQUE_VIOLATION = "23505";

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  // drizzle wraps driver errors in `cause`
  if ("cause" in error) return sqlState(error.cause);
  return undefined;
}

export function isExclusionViolation(error: unknown): boolean {
  return sqlState(error) === EXCLUSION_VIOLATION;
}

export function isUniqueViolation(error: unknown): boolean {
  return sqlState(error) === UNIQUE_VIOLATION;
}
