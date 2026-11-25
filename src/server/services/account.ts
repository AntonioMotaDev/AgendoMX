/** Pure rules for deleting an owner's account. */

/** Collapses case, accents' composition and runs of spaces, so a harmless typo in spacing does not block a legitimate deletion. */
export function normalizeConfirmation(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");
}

/** The owner must type the business name (or, before a business exists, the account email) to confirm. */
export function confirmationMatches(input: unknown, expected: string): boolean {
  return typeof input === "string" && normalizeConfirmation(expected) !== "" && normalizeConfirmation(input) === normalizeConfirmation(expected);
}
