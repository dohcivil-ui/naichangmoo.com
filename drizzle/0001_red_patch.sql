CREATE TABLE "rate_limit_counters" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"identifier" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enterprise_quotation_requests" ADD COLUMN "ip_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_counters_unique" ON "rate_limit_counters" USING btree ("scope","identifier","window_start");