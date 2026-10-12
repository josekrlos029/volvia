CREATE TABLE "page_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_amount" integer,
	"image_url" text,
	"duration_minutes" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"button_label" text,
	"button_url" text,
	"ask_via" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD COLUMN "page_views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "page_items" ADD CONSTRAINT "page_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_items" ADD CONSTRAINT "page_items_section_id_page_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."page_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_items_section_idx" ON "page_items" USING btree ("section_id","position");--> statement-breakpoint
CREATE INDEX "page_sections_org_kind_idx" ON "page_sections" USING btree ("org_id","kind","position");