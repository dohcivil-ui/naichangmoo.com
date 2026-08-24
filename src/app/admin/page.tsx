import { AdminCard, AdminEmpty, AdminGrid, AdminStat, AdminStatRow, AdminTable } from "@/components/admin/admin-card";
import { entitlementStateLabel } from "@/lib/platform-admin-labels";
import { formatThaiDateTime } from "@/lib/thai-format";
import { readPlatformMetrics, readRecentPlatformAudit } from "@/server/platform-admin-metrics";
import type { RecentAuditEvent } from "@/server/platform-admin-metrics";

/**
 * Assembled entirely from the card primitives. Every figure is a count of rows that exist; where a
 * count is zero the tile says so rather than filling itself in, because an invented figure on a
 * page that looks authoritative is a figure somebody acts on.
 *
 * Nothing here names a customer's work. ADR 0013: counting projects is a count, opening one is not.
 */
export default async function AdminOverviewPage() {
  const [metricsResult, recentAudit] = await Promise.all([readPlatformMetrics(), readRecentPlatformAudit()]);

  if (!metricsResult.ok) {
    return (
      <AdminCard title="อ่านตัวเลขไม่ได้" tone="warning">
        <AdminEmpty>
          ระบบเชื่อมต่อฐานข้อมูลไม่สำเร็จ หน้านี้จึงไม่แสดงตัวเลขใด ๆ แทนที่จะเดา ลองใหม่อีกครั้งหรือตรวจการเชื่อมต่อฐานข้อมูล
        </AdminEmpty>
      </AdminCard>
    );
  }

  const { metrics } = metricsResult;

  return (
    <>
      <AdminStatRow>
        <AdminStat label="สมาชิก" value={metrics.members} empty="ยังไม่มีใครสมัคร" />
        <AdminStat label="องค์กร" value={metrics.organizations} empty="ยังไม่มีองค์กร" />
        <AdminStat label="โครงการ" value={metrics.projects} empty="ยังไม่มีโครงการ" hint="นับจำนวนเท่านั้น ไม่แสดงชื่อ" />
        <AdminStat
          label="คำขอใบเสนอราคาที่ยังไม่ปิด"
          value={metrics.openQuotationRequests}
          empty="ไม่มีคำขอค้าง"
        />
      </AdminStatRow>

      <AdminGrid columns={2}>
        <AdminCard title="สิทธิ์การใช้งานตามสถานะ" description="นับจาก app_entitlements ตามสถานะที่ระบบบังคับใช้จริง">
          <AdminTable
            columns={[
              {
                key: "state",
                header: "สถานะ",
                render: (row: { state: string; total: number }) => entitlementStateLabel[row.state] ?? row.state
              },
              { key: "total", header: "จำนวน", numeric: true, render: (row) => row.total.toLocaleString("th-TH") }
            ]}
            rows={metrics.entitlementsByState}
            rowKey={(row) => row.state}
            empty="ยังไม่มีสิทธิ์ใดถูกออก"
          />
        </AdminCard>

        <AdminCard
          title="บันทึกการเปลี่ยนแปลงล่าสุด"
          description="เฉพาะเหตุการณ์ระดับแพลตฟอร์ม เหตุการณ์ที่ผูกกับองค์กรใดเป็นงานของลูกค้า จึงถูกกรองออกที่ชั้นข้อมูล ไม่ใช่แค่ไม่แสดง"
        >
          <AdminTable
            columns={[
              { key: "event", header: "เหตุการณ์", render: (row: RecentAuditEvent) => <code>{row.eventType}</code> },
              { key: "resource", header: "สิ่งที่ถูกแก้", render: (row) => row.resourceType },
              { key: "when", header: "เมื่อ", render: (row) => formatThaiDateTime(row.createdAt) ?? "—" }
            ]}
            rows={recentAudit}
            rowKey={(row) => row.id}
            empty="ยังไม่มีเหตุการณ์ระดับแพลตฟอร์ม"
          />
        </AdminCard>
      </AdminGrid>

      <AdminCard title="สิทธิ์ของหน้านี้ครอบคลุมแค่ไหน" tone="note">
        <p>
          ผู้ดูแลแพลตฟอร์มจัดการ <strong>สิทธิ์การใช้งาน</strong> ได้ — ออก ต่ออายุ ระงับ และคืนสิทธิ์ — และดูแลเนื้อหาที่ลูกค้าเห็น
          ทั้งราคา ช่วงลดราคา ข่าวสาร และทะเบียนแอป ตาม ADR 0013
        </p>
        <p>
          แต่ <strong>เปิดโครงการ แบบก่อสร้าง บรรทัดวัด หรือชุดราคาของลูกค้ารายใดไม่ได้</strong>{" "}
          เส้นแบ่งคือสิทธิ์การใช้งานเทียบกับตัวงาน สิทธิ์คือความสัมพันธ์ที่แพลตฟอร์มเป็นคู่สัญญาและเป็นผู้ออกเอง
          ส่วนตัวงานคือสิ่งที่ลูกค้าผลิตด้วยเครื่องมือ แพลตฟอร์มเก็บให้แต่ไม่มีเหตุผลต้องอ่าน
        </p>
        <p>
          ขณะนี้มีผู้ดูแลที่ยังไม่ถูกถอน {metrics.activeAdministrators.toLocaleString("th-TH")} คน
          และมีบันทึกเหตุการณ์ทั้งหมด {metrics.auditEventsRecorded.toLocaleString("th-TH")} รายการ
        </p>
      </AdminCard>
    </>
  );
}
