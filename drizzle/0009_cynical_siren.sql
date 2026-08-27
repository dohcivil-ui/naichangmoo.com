CREATE TYPE "public"."assistant_decision" AS ENUM('proposed', 'accepted', 'rejected', 'partially_accepted', 'expired');--> statement-breakpoint
CREATE TABLE "assistant_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"actor_id" text NOT NULL,
	"app_slug" text NOT NULL,
	"verb" text NOT NULL,
	"subject" text NOT NULL,
	"model_id" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micro_usd" integer DEFAULT 0 NOT NULL,
	"elapsed_ms" integer DEFAULT 0 NOT NULL,
	"decision" "assistant_decision" DEFAULT 'proposed' NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_proposals_created_idx" ON "assistant_proposals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assistant_proposals_actor_idx" ON "assistant_proposals" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_proposals_app_idx" ON "assistant_proposals" USING btree ("app_slug","verb");