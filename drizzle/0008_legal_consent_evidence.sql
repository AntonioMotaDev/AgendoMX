ALTER TABLE "appointments" ADD COLUMN "privacy_notice_version" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "health_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_consent_has_notice" CHECK ("appointments"."health_consent_at" IS NULL OR "appointments"."privacy_notice_version" IS NOT NULL);