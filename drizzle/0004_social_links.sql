ALTER TABLE "businesses" ADD COLUMN "facebook_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "twitter_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "tiktok_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "youtube_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_social_https" CHECK (("businesses"."facebook_url" IS NULL OR "businesses"."facebook_url" LIKE 'https://%')
        AND ("businesses"."instagram_url" IS NULL OR "businesses"."instagram_url" LIKE 'https://%')
        AND ("businesses"."twitter_url" IS NULL OR "businesses"."twitter_url" LIKE 'https://%')
        AND ("businesses"."tiktok_url" IS NULL OR "businesses"."tiktok_url" LIKE 'https://%')
        AND ("businesses"."youtube_url" IS NULL OR "businesses"."youtube_url" LIKE 'https://%')
        AND ("businesses"."linkedin_url" IS NULL OR "businesses"."linkedin_url" LIKE 'https://%'));