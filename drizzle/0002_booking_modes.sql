CREATE TYPE "public"."appointment_event_type" AS ENUM('created', 'confirmed', 'rejected', 'expired', 'cancelled', 'completed', 'no_show', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."confirmation_mode" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."event_actor" AS ENUM('owner', 'client', 'system');--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "appointment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"type" "appointment_event_type" NOT NULL,
	"actor" "event_actor" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "confirmation_mode" "confirmation_mode" DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "pending_expiry_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "price_is_from" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "is_bookable_online" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_events_appointment_idx" ON "appointment_events" USING btree ("appointment_id","created_at");--> statement-breakpoint
CREATE INDEX "appointments_pending_expiry_idx" ON "appointments" USING btree ("expires_at") WHERE "appointments"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_pending_expiry_range" CHECK ("businesses"."pending_expiry_hours" BETWEEN 1 AND 168);