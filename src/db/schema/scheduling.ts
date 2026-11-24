import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./businesses";
import { availabilityExceptionType } from "./enums";

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("staff_business_id_idx").on(t.businessId)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMin: integer("duration_min").notNull(),
    priceCents: integer("price_cents"),
    bufferAfterMin: integer("buffer_after_min").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("services_business_id_idx").on(t.businessId),
    check("services_duration_range", sql`${t.durationMin} BETWEEN 5 AND 720`),
    check("services_buffer_range", sql`${t.bufferAfterMin} BETWEEN 0 AND 240`),
    check("services_price_nonneg", sql`${t.priceCents} IS NULL OR ${t.priceCents} >= 0`),
  ],
);

export const staffServices = pgTable(
  "staff_services",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })],
);

/** Weekly hours in the business's local time. weekday: 0 = Sunday … 6 = Saturday. */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    index("availability_rules_staff_weekday_idx").on(t.staffId, t.weekday),
    check("availability_rules_weekday_range", sql`${t.weekday} BETWEEN 0 AND 6`),
    check("availability_rules_time_order", sql`${t.endTime} > ${t.startTime}`),
  ],
);

/** Date-specific overrides in local time: closed day or custom hours. */
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    type: availabilityExceptionType("type").notNull(),
  },
  (t) => [
    index("availability_exceptions_staff_date_idx").on(t.staffId, t.date),
    check(
      "availability_exceptions_shape",
      sql`(${t.type} = 'closed' AND ${t.startTime} IS NULL AND ${t.endTime} IS NULL)
        OR (${t.type} = 'custom_hours' AND ${t.startTime} IS NOT NULL AND ${t.endTime} > ${t.startTime})`,
    ),
  ],
);
