ALTER TABLE "stamp_cards" ADD COLUMN "collect_phone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stamp_cards" ADD COLUMN "phone_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "customers_org_phone_idx" ON "customers" USING btree ("org_id","phone") WHERE "customers"."phone" is not null;