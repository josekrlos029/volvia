ALTER TYPE "public"."stamp_source" ADD VALUE 'remote';--> statement-breakpoint
ALTER TABLE "stamp_cards" ADD COLUMN "collect_document" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stamp_cards" ADD COLUMN "document_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "document_number" text;--> statement-breakpoint
CREATE INDEX "customers_org_document_idx" ON "customers" USING btree ("org_id","document_number") WHERE "customers"."document_number" is not null;