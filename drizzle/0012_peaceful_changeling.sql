CREATE TABLE "price_basket_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"basket_id" text NOT NULL,
	"added_by" text NOT NULL,
	"line_key" text NOT NULL,
	"source_key" text NOT NULL,
	"catalog_code" text NOT NULL,
	"province_code" text,
	"effective_month" text,
	"document_page" text,
	"rate_condition" text,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"unit_satang" bigint NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_baskets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"name" text DEFAULT 'รายการที่หยิบไว้' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_set_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"price_set_id" text NOT NULL,
	"added_by" text NOT NULL,
	"line_key" text NOT NULL,
	"source_key" text NOT NULL,
	"catalog_code" text NOT NULL,
	"province_code" text,
	"effective_month" text,
	"document_page" text,
	"rate_condition" text,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"unit_satang" bigint NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_basket_lines" ADD CONSTRAINT "price_basket_lines_basket_id_price_baskets_id_fk" FOREIGN KEY ("basket_id") REFERENCES "public"."price_baskets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_basket_lines" ADD CONSTRAINT "price_basket_lines_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_baskets" ADD CONSTRAINT "price_baskets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_baskets" ADD CONSTRAINT "price_baskets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_set_lines" ADD CONSTRAINT "price_set_lines_price_set_id_price_sets_id_fk" FOREIGN KEY ("price_set_id") REFERENCES "public"."price_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_set_lines" ADD CONSTRAINT "price_set_lines_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_basket_lines_key_unique" ON "price_basket_lines" USING btree ("basket_id","line_key");--> statement-breakpoint
CREATE INDEX "price_basket_lines_basket_idx" ON "price_basket_lines" USING btree ("basket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_baskets_organization_unique" ON "price_baskets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_set_lines_key_unique" ON "price_set_lines" USING btree ("price_set_id","line_key");--> statement-breakpoint
CREATE INDEX "price_set_lines_set_idx" ON "price_set_lines" USING btree ("price_set_id");