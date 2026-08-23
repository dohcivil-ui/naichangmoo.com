ALTER TABLE "takeoff_items" ADD CONSTRAINT "takeoff_items_waste_percent_range" CHECK ("takeoff_items"."waste_percent" >= 0 AND "takeoff_items"."waste_percent" <= 100);--> statement-breakpoint
ALTER TABLE "takeoff_items" ADD CONSTRAINT "takeoff_items_waste_needs_source" CHECK ("takeoff_items"."waste_percent" = 0 OR ("takeoff_items"."waste_source_note" IS NOT NULL AND length(btrim("takeoff_items"."waste_source_note")) > 0));--> statement-breakpoint
ALTER TABLE "takeoff_items" ADD CONSTRAINT "takeoff_items_quantity_not_negative" CHECK ("takeoff_items"."quantity" >= 0);--> statement-breakpoint
ALTER TABLE "takeoff_items" ADD CONSTRAINT "takeoff_items_quantity_gross_not_negative" CHECK ("takeoff_items"."quantity_gross" IS NULL OR "takeoff_items"."quantity_gross" >= 0);--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_count_positive" CHECK ("takeoff_measurements"."count" > 0);--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_dimensions_positive" CHECK (("takeoff_measurements"."dimension_1" IS NULL OR "takeoff_measurements"."dimension_1" > 0)
      AND ("takeoff_measurements"."dimension_2" IS NULL OR "takeoff_measurements"."dimension_2" > 0)
      AND ("takeoff_measurements"."dimension_3" IS NULL OR "takeoff_measurements"."dimension_3" > 0));--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_conversion_needs_source" CHECK ("takeoff_measurements"."conversion_factor" IS NULL
      OR ("takeoff_measurements"."conversion_factor" > 0
        AND "takeoff_measurements"."conversion_note" IS NOT NULL
        AND length(btrim("takeoff_measurements"."conversion_note")) > 0));