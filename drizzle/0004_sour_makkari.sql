CREATE TABLE "takeoff_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"parent_id" text,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "takeoff_groups_title_present" CHECK (length(btrim("takeoff_groups"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_location" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agency_name" text;--> statement-breakpoint
ALTER TABLE "takeoff_items" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "takeoff_groups" ADD CONSTRAINT "takeoff_groups_run_id_takeoff_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."takeoff_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_groups" ADD CONSTRAINT "takeoff_groups_parent_id_takeoff_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."takeoff_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "takeoff_groups_run_idx" ON "takeoff_groups" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "takeoff_groups_parent_idx" ON "takeoff_groups" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "takeoff_items" ADD CONSTRAINT "takeoff_items_group_id_takeoff_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."takeoff_groups"("id") ON DELETE set null ON UPDATE no action;