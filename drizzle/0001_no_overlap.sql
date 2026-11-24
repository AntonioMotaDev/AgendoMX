-- Zero double bookings, enforced by Postgres (CLAUDE.md §4).
-- The busy range includes the service buffer: [starts_at, blocked_until).
-- Violations raise SQLSTATE 23P01 (exclusion_violation).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    tstzrange("starts_at", "blocked_until", '[)') WITH &&
  )
  WHERE ("status" IN ('pending', 'confirmed'));
