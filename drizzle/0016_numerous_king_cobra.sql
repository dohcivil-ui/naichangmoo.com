CREATE TABLE "drawing_marks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"page_number" integer NOT NULL,
	"marks" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_marks_page_number_positive" CHECK ("drawing_marks"."page_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "drawing_marks" ADD CONSTRAINT "drawing_marks_document_id_drawing_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."drawing_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_marks" ADD CONSTRAINT "drawing_marks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drawing_marks_page_idx" ON "drawing_marks" USING btree ("document_id","page_number");