CREATE TABLE "price_catalogue_items" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"catalog_code" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"category_code" text NOT NULL,
	"category_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "price_including_vat" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "price_observations" ADD COLUMN "source_version" text NOT NULL;--> statement-breakpoint
ALTER TABLE "price_catalogue_items" ADD CONSTRAINT "price_catalogue_items_source_id_price_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."price_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_catalogue_items_source_code_unique" ON "price_catalogue_items" USING btree ("source_id","catalog_code");--> statement-breakpoint
CREATE UNIQUE INDEX "price_observations_reading_unique" ON "price_observations" USING btree ("source_id","catalog_code","province_code","effective_month");--> statement-breakpoint
CREATE INDEX "price_observations_province_month_idx" ON "price_observations" USING btree ("province_code","effective_month");