ALTER TABLE "apps" ADD COLUMN "announced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "announced_by" text;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_announced_by_users_id_fk" FOREIGN KEY ("announced_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;