DROP INDEX "analytics_daily_key";--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_key" UNIQUE NULLS NOT DISTINCT("org_id","card_id","location_id","day");