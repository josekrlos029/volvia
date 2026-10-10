CREATE TYPE "public"."message_delivery_status" AS ENUM('queued', 'delivered', 'failed', 'skipped_no_pass');--> statement-breakpoint
CREATE TABLE "customer_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"customer_card_id" uuid NOT NULL,
	"status" "message_delivery_status" DEFAULT 'queued' NOT NULL,
	"delivered_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_customer_card_id_customer_cards_id_fk" FOREIGN KEY ("customer_card_id") REFERENCES "public"."customer_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_segments_org_name_key" ON "customer_segments" USING btree ("org_id",lower("name")) WHERE "customer_segments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customer_segments_org_idx" ON "customer_segments" USING btree ("org_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_deliveries_message_card_key" ON "message_deliveries" USING btree ("message_id","customer_card_id");--> statement-breakpoint
CREATE INDEX "message_deliveries_message_status_idx" ON "message_deliveries" USING btree ("message_id","status");--> statement-breakpoint
CREATE INDEX "message_deliveries_card_idx" ON "message_deliveries" USING btree ("customer_card_id","created_at");