import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses";
import { clients } from "./clients";
import { appointmentEventType, appointmentSource, appointmentStatus, cancelledBy, eventActor } from "./enums";
import { services, staff } from "./scheduling";

/**
 * The no-overlap EXCLUDE constraint on [starts_at, blocked_until) lives in a
 * manual SQL migration (drizzle/*_no_overlap.sql). See CLAUDE.md §4.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /** starts_at + service duration */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** ends_at + buffer_after_min; the range the staff is actually busy */
    blockedUntil: timestamp("blocked_until", { withTimezone: true }).notNull(),
    serviceNameSnapshot: text("service_name_snapshot").notNull(),
    priceCentsSnapshot: integer("price_cents_snapshot"),
    status: appointmentStatus("status").notNull().default("confirmed"),
    source: appointmentSource("source").notNull(),
    publicToken: text("public_token").notNull().unique(),
    /** `pending` only: when the request expires if the owner does not answer. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    cancelledBy: cancelledBy("cancelled_by"),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_business_starts_idx").on(t.businessId, t.startsAt),
    index("appointments_staff_starts_idx").on(t.staffId, t.startsAt),
    index("appointments_pending_expiry_idx")
      .on(t.expiresAt)
      .where(sql`${t.status} = 'pending'`),
    index("appointments_reminder_due_idx")
      .on(t.startsAt)
      .where(sql`${t.reminderSentAt} IS NULL AND ${t.status} = 'confirmed'`),
    check("appointments_time_order", sql`${t.endsAt} > ${t.startsAt} AND ${t.blockedUntil} >= ${t.endsAt}`),
    check("appointments_token_len", sql`char_length(${t.publicToken}) >= 32`),
  ],
);

/**
 * Append-only change log for an appointment. No clinical data: `note` is an
 * operational remark only (e.g. a reschedule reason). See CLAUDE.md §1.
 */
export const appointmentEvents = pgTable(
  "appointment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    type: appointmentEventType("type").notNull(),
    actor: eventActor("actor").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appointment_events_appointment_idx").on(t.appointmentId, t.createdAt)],
);
