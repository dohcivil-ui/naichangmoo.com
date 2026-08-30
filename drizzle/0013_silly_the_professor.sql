CREATE TYPE "public"."costing_method" AS ENUM('factor_f', 'contractor_cost');--> statement-breakpoint
CREATE TYPE "public"."price_authority_source" AS ENUM('official', 'organization');--> statement-breakpoint
DROP INDEX "estimate_revisions_project_number_unique";--> statement-breakpoint
ALTER TABLE "estimate_revisions" ALTER COLUMN "price_set_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "estimate_revisions" ALTER COLUMN "status" SET DEFAULT 'issued';--> statement-breakpoint
ALTER TABLE "estimate_revisions" ADD COLUMN "costing_method" "costing_method" NOT NULL;--> statement-breakpoint
-- ชุดราคาที่มีอยู่แล้วทุกใบมาจากบัญชีที่หน่วยงานรัฐประกาศ (ตรวจแล้ว: ทุกบรรทัดเป็น tpso)
-- การเติม 'official' จึงเป็นการบันทึกข้อเท็จจริง ไม่ใช่การเดา แล้วถอนค่าตั้งต้นทิ้งทันที
-- เพื่อให้ทางกดส่งต้องระบุแหล่งอำนาจเองเสมอ ไม่ใช่ปล่อยให้ฐานข้อมูลเดาให้เงียบ ๆ
ALTER TABLE "price_sets" ADD COLUMN "authority_source" "price_authority_source" DEFAULT 'official' NOT NULL;--> statement-breakpoint
ALTER TABLE "price_sets" ALTER COLUMN "authority_source" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "estimate_revisions_method_number_unique" ON "estimate_revisions" USING btree ("project_id","costing_method","revision_number");--> statement-breakpoint
CREATE INDEX "estimate_revisions_price_set_idx" ON "estimate_revisions" USING btree ("price_set_id");