CREATE TYPE "public"."project_path" AS ENUM('private', 'government');--> statement-breakpoint
CREATE TABLE "takeoff_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"takeoff_item_id" text NOT NULL,
	"label" text NOT NULL,
	"count" integer NOT NULL,
	"dimension_1" numeric(18, 6),
	"dimension_2" numeric(18, 6),
	"dimension_3" numeric(18, 6),
	"conversion_factor" numeric(18, 6),
	"conversion_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_path" "project_path" DEFAULT 'government' NOT NULL;--> statement-breakpoint
ALTER TABLE "takeoff_items" ADD COLUMN "quantity_gross" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "takeoff_items" ADD COLUMN "waste_percent" numeric(9, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "takeoff_items" ADD COLUMN "waste_source_note" text;--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_takeoff_item_id_takeoff_items_id_fk" FOREIGN KEY ("takeoff_item_id") REFERENCES "public"."takeoff_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "takeoff_measurements_item_idx" ON "takeoff_measurements" USING btree ("takeoff_item_id");