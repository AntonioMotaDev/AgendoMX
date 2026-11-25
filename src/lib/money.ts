const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

/** 18000 → "$180.00". Money is always integer cents (CLAUDE.md §7). */
export function formatMxn(cents: number): string {
  return mxn.format(cents / 100);
}

/** Whole pesos drop the decimals: 18000 → "$180", 18050 → "$180.50". */
export function formatMxnShort(cents: number): string {
  return cents % 100 === 0 ? mxn.format(cents / 100).replace(/\.00$/, "") : mxn.format(cents / 100);
}

/** Cents → what an owner types in a price field: 18000 → "180", 18050 → "180.50", null → "". */
export function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
