export type PartOfDay = "morning" | "afternoon" | "evening";

/** 24-hour value of a label like "10:30 a.m." or "4:00 p.m."; null when the label has another shape. */
export function hourOfLabel(label: string): number | null {
  const match = /^\s*(\d{1,2}):\d{2}\s*([ap])\.?\s*m\.?/i.exec(label);
  if (!match) return null;
  const hour = Number(match[1]) % 12;
  return match[2]!.toLowerCase() === "p" ? hour + 12 : hour;
}

/**
 * Splits one day's slots into morning (before 12), afternoon (12–18) and evening (19+),
 * keeping their order and dropping empty parts. If any label cannot be read, everything
 * stays in one list (`part: null`) rather than guessing.
 */
export function groupSlots<T extends { label: string }>(slots: T[]): Array<{ part: PartOfDay | null; slots: T[] }> {
  const hours = slots.map((s) => hourOfLabel(s.label));
  if (hours.some((h) => h === null)) return slots.length ? [{ part: null, slots }] : [];
  const parts: Record<PartOfDay, T[]> = { morning: [], afternoon: [], evening: [] };
  slots.forEach((slot, i) => {
    const h = hours[i]!;
    parts[h < 12 ? "morning" : h < 19 ? "afternoon" : "evening"].push(slot);
  });
  return (["morning", "afternoon", "evening"] as const).filter((p) => parts[p].length > 0).map((part) => ({ part, slots: parts[part] }));
}
