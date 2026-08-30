CREATE TABLE "boq_items" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"takeoff_item_id" text NOT NULL,
	"price_set_line_id" text NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"matched_by" text DEFAULT 'manual' NOT NULL,
	"match_confidence" text,
	"accepted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_revision_id_estimate_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."estimate_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_takeoff_item_id_takeoff_items_id_fk" FOREIGN KEY ("takeoff_item_id") REFERENCES "public"."takeoff_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_price_set_line_id_price_set_lines_id_fk" FOREIGN KEY ("price_set_line_id") REFERENCES "public"."price_set_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "boq_items_revision_takeoff_unique" ON "boq_items" USING btree ("revision_id","takeoff_item_id");--> statement-breakpoint
CREATE INDEX "boq_items_revision_idx" ON "boq_items" USING btree ("revision_id");