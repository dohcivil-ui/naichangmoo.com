import { formatThaiDateTime } from "@/lib/thai-format";
import { entitlementStateLabel } from "@/lib/platform-admin-labels";
import { readPlatformMetrics, readRecentPlatformAudit } from "@/server/platform-admin-metrics";

/**
 * Every tile on this page is a count of rows that exist. Where a count is zero the tile says the
 * thing has not happened yet rather than filling itself in — a back office that invents a figure
 * is worse than one that admits an empty table, because the invented figure gets acted on.
 */
export default async function AdminOverviewPage() {
  const [metricsResult, recentAudit] = await Promise.all([readPlatformMetrics(), readRecentPlatformAudit()]);

  if (!metricsResult.ok) {
    return (
      <section className="admin-panel">
        <h2>อ่านตัวเลขไม่ได้</h2>
        <p className="admin-panel__muted">
          ระบบเชื่อมต่อฐานข้อมูลไม่สำเร็จ หน้านี้จึงไม่แสดงตัวเลขใด ๆ แทนที่จะเดา ลองใหม่อีกครั้งหรือตรวจการเชื่อมต่อฐานข้อมูล
        </p>
      </section>
    );
  }

  const { metrics } = metricsResult;
  const tiles = [
    { label: "สมาชิก", value: metrics.members, empty: "ยังไม่มีใครสมัคร" },
    { label: "องค์กร", value: metrics.organizations, empty: "ยังไม่มีองค์กร" },
    { label: "โครงการ", value: metrics.projects, empty: "ยังไม่มีโครงการ" },
    { label: "คำขอใบเสนอราคาที่ยังไม่ปิด", value: metrics.openQuotationRequests, empty: "ไม่มีคำขอค้าง" }
  ];

  return (
    <>
      <section className="admin-tiles">
        {tiles.map((tile) => (
          <article className="admin-tile" key={tile.label}>
            <p className="admin-tile__label">{tile.label}</p>
            {tile.value > 0 ? (
              <p className="admin-tile__value">{tile.value.toLocaleString("th-TH")}</p>
            ) : (
              <p className="admin-tile__empty">{tile.empty}</p>
            )}
          </article>
        ))}
      </section>

      <div className="admin-columns">
        <section className="admin-panel">
          <header>
            <h2>สิทธิ์การใช้งานตามสถานะ</h2>
            <p className="admin-panel__muted">นับจาก app_entitlements ตามสถานะที่ระบบบังคับใช้จริง</p>
          </header>
          {metrics.entitlementsByState.length === 0 ? (
            <p className="admin-panel__muted">ยังไม่มีสิทธิ์ใดถูกออก</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">สถานะ</th>
                  <th scope="col">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {metrics.entitlementsByState.map((row) => (
                  <tr key={row.state}>
                    <th scope="row">{entitlementStateLabel[row.state] ?? row.state}</th>
                    <td>{row.total.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-panel">
          <header>
            <h2>บันทึกการเปลี่ยนแปลงล่าสุด</h2>
            <p className="admin-panel__muted">
              เฉพาะเหตุการณ์ระดับแพลตฟอร์ม เหตุการณ์ที่ผูกกับองค์กรใดเป็นงานของลูกค้า ไม่แสดงที่นี่
            </p>
          </header>
          {recentAudit.length === 0 ? (
            <p className="admin-panel__muted">ยังไม่มีเหตุการณ์ระดับแพลตฟอร์ม</p>
          ) : (
            <ul className="admin-events">
              {recentAudit.map((event) => (
                <li key={event.id}>
                  <code>{event.eventType}</code>
                  <span>{event.resourceType}</span>
                  <time>{formatThaiDateTime(event.createdAt) ?? "—"}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-panel admin-panel--note">
        <h2>สิทธิ์ของหน้านี้ครอบคลุมแค่ไหน</h2>
        <p className="admin-panel__muted">
          ผู้ดูแลแพลตฟอร์มดูแลเนื้อหาของแพลตฟอร์มและตัวเลขสรุปเชิงรวม ตาม ADR 0012 สิทธิ์นี้
          <strong> ไม่ให้สิทธิ์เปิดโครงการ แบบก่อสร้าง บรรทัดวัด หรือชุดราคาของลูกค้ารายใด</strong>{" "}
          ข้อมูลเหล่านั้นยังถูกจำกัดด้วย organization เหมือนเดิม ถ้าวันหน้าต้องการสิทธิ์ช่วยเหลือลูกค้าที่เห็นข้อมูลได้
          ต้องเป็นสิทธิ์คนละตัวที่มีการยินยอมและมีอายุจำกัด ไม่ใช่การขยายสิทธิ์นี้
        </p>
        <p className="admin-panel__muted">
          ขณะนี้มีผู้ดูแลที่ยังไม่ถูกถอน {metrics.activeAdministrators.toLocaleString("th-TH")} คน และมีบันทึกเหตุการณ์ทั้งหมด{" "}
          {metrics.auditEventsRecorded.toLocaleString("th-TH")} รายการ
        </p>
      </section>
    </>
  );
}
