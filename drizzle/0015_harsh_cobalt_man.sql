CREATE TABLE "drawing_calibrations" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"page_number" integer NOT NULL,
	"metres_per_point" numeric(18, 12) NOT NULL,
	"method" text NOT NULL,
	"reference_geometry" jsonb NOT NULL,
	"grid" jsonb,
	"dimensions" jsonb,
	"confirmed_by" text NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_calibrations_metres_per_point_positive" CHECK ("drawing_calibrations"."metres_per_point" > 0),
	CONSTRAINT "drawing_calibrations_page_number_positive" CHECK ("drawing_calibrations"."page_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "drawing_view_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"page_number" integer NOT NULL,
	"view" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_view_states_page_number_positive" CHECK ("drawing_view_states"."page_number" > 0)
);
--> statement-breakpoint
-- Hand-edited from the generated single statement, which would fail on a table that already has
-- rows: a NOT NULL column with no default has no value to give them. Three steps instead.
--
-- Every existing row came from the take-off form, where a person read the drawing and keyed the
-- figures in, so 'typed' is a statement of fact about them, not a placeholder. The default is
-- then dropped, so from here on every write path has to say which method it used and none can
-- inherit this backfill by accident.
ALTER TABLE "takeoff_measurements" ADD COLUMN "method" text;--> statement-breakpoint
UPDATE "takeoff_measurements" SET "method" = 'typed' WHERE "method" IS NULL;--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ALTER COLUMN "method" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD COLUMN "proposal_id" text;--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD COLUMN "method_context" jsonb;--> statement-breakpoint
ALTER TABLE "drawing_calibrations" ADD CONSTRAINT "drawing_calibrations_document_id_drawing_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."drawing_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_calibrations" ADD CONSTRAINT "drawing_calibrations_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_view_states" ADD CONSTRAINT "drawing_view_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_view_states" ADD CONSTRAINT "drawing_view_states_document_id_drawing_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."drawing_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drawing_calibrations_page_idx" ON "drawing_calibrations" USING btree ("document_id","page_number");--> statement-breakpoint
CREATE UNIQUE INDEX "drawing_view_states_person_idx" ON "drawing_view_states" USING btree ("user_id","document_id");--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_proposal_id_assistant_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."assistant_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_model_pairs_proposal" CHECK (("takeoff_measurements"."method" = 'model') = ("takeoff_measurements"."proposal_id" IS NOT NULL));