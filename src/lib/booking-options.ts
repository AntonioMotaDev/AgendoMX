/** Choices offered for booking rules. The database accepts wider ranges; these are the sensible steps. */
export const CONFIRMATION_MODES = ["auto", "manual"] as const;
export const LEAD_TIME_OPTIONS_MIN = [0, 30, 60, 120, 240, 720, 1440] as const;
export const WINDOW_OPTIONS_DAYS = [7, 14, 30, 60, 90, 180] as const;
export const CANCELLATION_OPTIONS_HOURS = [0, 1, 2, 4, 12, 24, 48] as const;
export const EXPIRY_OPTIONS_HOURS = [6, 12, 24, 48, 72] as const;

/** Options plus the current value when it falls outside the list, so editing never silently changes it. */
export function withCurrent<T extends number>(options: readonly T[], current: number): number[] {
  return [...new Set<number>([...options, current])].sort((a, b) => a - b);
}
