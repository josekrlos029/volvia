CREATE TABLE "pass_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"customer_card_id" uuid NOT NULL,
	"source" text NOT NULL,
	"campaign_id" uuid,
	"automation_id" uuid,
	"offer" jsonb NOT NULL,
	"pass_override" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"bonus_applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "pass_override" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pass_offers" ADD CONSTRAINT "pass_offers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_offers" ADD CONSTRAINT "pass_offers_customer_card_id_customer_cards_id_fk" FOREIGN KEY ("customer_card_id") REFERENCES "public"."customer_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_offers" ADD CONSTRAINT "pass_offers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_offers" ADD CONSTRAINT "pass_offers_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pass_offers_card_campaign_key" ON "pass_offers" USING btree ("customer_card_id","campaign_id") WHERE "pass_offers"."campaign_id" is not null;--> statement-breakpoint
CREATE INDEX "pass_offers_card_idx" ON "pass_offers" USING btree ("customer_card_id","ended_at");--> statement-breakpoint
CREATE INDEX "pass_offers_campaign_idx" ON "pass_offers" USING btree ("campaign_id","ended_at");--> statement-breakpoint
CREATE INDEX "pass_offers_expiry_idx" ON "pass_offers" USING btree ("expires_at") WHERE "pass_offers"."ended_at" is null;