ALTER TABLE "organizations" ALTER COLUMN "brand_color" SET DEFAULT '#16624A';--> statement-breakpoint
ALTER TABLE "stamp_cards" ADD COLUMN "initial_stamps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stamp_cards" ADD COLUMN "messages" jsonb DEFAULT '{"variants":[],"perStamp":{}}'::jsonb NOT NULL;