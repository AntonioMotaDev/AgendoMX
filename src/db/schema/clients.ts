import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses";

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** E.164, e.g. +525512345678 */
    phone: text("phone").notNull(),
    email: text("email"),
    /** Short operational note. Never health data. */
    notesShort: text("notes_short"),
    /** Set when the business erased this person's data (ARCO): name, phone and email are placeholders, the appointments stay without personal data. */
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("clients_business_phone_unique").on(t.businessId, t.phone),
    check("clients_phone_e164", sql`${t.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
    check("clients_notes_len", sql`${t.notesShort} IS NULL OR char_length(${t.notesShort}) <= 280`),
  ],
);
