import { AdminCard, AdminEmpty, AdminGrid, AdminTable } from "@/components/admin/admin-card";
import { AppRegistryForm } from "@/components/admin/app-registry-form";
import { accessLabel } from "@/lib/platform";
import { formatThaiDateTime } from "@/lib/thai-format";
import { readRecentAnnouncements, readRegistryForAdmin, type RecentAnnouncement, type RegistryEntry } from "@/server/app-registry";
import { resolvePlatformAdmin } from "@/server/platform-admin";

/**
 * The registry, which is what the public pages read before they say anything about an app.
 *
 * The layout already guards this route. The check is repeated because a page is its own entry
 * point, and a guard that exists in exactly one place is a guard somebody eventually routes around.
 *
 * Assembled from the card primitives and nothing else. Nothing here reaches a customer's work:
 * this table is the platform talking about its own products.
 */
export default async function AdminAppsPage() {
  const auth = await resolvePlatformAdmin();
  if (!auth.ok) return <AdminCard title="ไม่มีสิทธิ์เข้าถึงหน้านี้" tone="warning" />;

  const [registry, recent] = await Promise.all([readRegistryForAdmin(), readRecentAnnouncements()]);

  if (!registry.ok) {
    return (
      <AdminCard title="อ่านทะเบียนแอปไม่ได้" tone="warning">
        <AdminEmpty>
          ระบบเชื่อมต่อฐานข้อมูลไม่สำเร็จ หน้านี้จึงไม่แสดงสถานะของแอปใด ๆ แทนที่จะเดา
          ระหว่างนี้หน้าราคาจะไม่เอ่ยชื่อแอปใดเลยเช่นกัน ซึ่งเป็นพฤติกรรมที่ตั้งใจ
        </AdminEmpty>
      </AdminCard>
    );
  }

  const announced = registry.entries.filter((entry) => entry.announced);

  return (
    <>
      <AdminCard title="ทะเบียนนี้คือคำแถลงต่อสาธารณะ ไม่ใช่การให้สิทธิ์" tone="note">
        <p>
          แอปที่ยังไม่ประกาศจะ<strong>ไม่ถูกเอ่ยชื่อบนหน้าราคา</strong> แม้ระบบจะรู้จักแอปนั้นอยู่ก็ตาม
          ส่วนสิ่งที่สมาชิกคนหนึ่งใช้ได้จริงยังตัดสินที่สิทธิ์การใช้งานของเขาเสมอ การประกาศที่นี่ไม่ได้เพิ่มหรือถอนสิทธิ์ของใคร
        </p>
        <p>
          ค่าตั้งต้นคือสิ่งที่ทีมงานตั้งใจไว้ตอนเขียนโค้ด ทะเบียนคือสิ่งที่ประกาศออกไปจริง
          เมื่อสองอย่างขัดกัน <strong>ทะเบียนเป็นฝ่ายถูก</strong> และเหตุผลที่พิมพ์ไว้คือสิ่งที่อธิบายว่าทำไม
        </p>
      </AdminCard>

      <AdminCard
        title="ทะเบียนแอป"
        description={`ประกาศแล้ว ${announced.length} จาก ${registry.entries.length} แอปในแพลตฟอร์ม แก้คำประกาศได้จากการ์ดด้านล่างตาราง`}
      >
        <AdminTable
          columns={[
            {
              key: "app",
              header: "แอป",
              render: (row: RegistryEntry) => (
                <>
                  {row.name}
                  <span className="admin-registry-status">ค่าตั้งต้น {accessLabel[row.seededAccess]}</span>
                </>
              )
            },
            {
              key: "announced",
              header: "สถานะทะเบียน",
              render: (row) =>
                row.announced ? (
                  <span className="admin-pill admin-pill--announced">ประกาศแล้ว</span>
                ) : (
                  <>
                    <span className="admin-pill">ยังไม่ประกาศ</span>
                    <span className="admin-registry-status">ไม่ถูกเอ่ยชื่อบนหน้าราคา</span>
                  </>
                )
            },
            {
              key: "access",
              header: "สิทธิ์ที่ประกาศ",
              render: (row) =>
                row.access ? (
                  <>
                    {accessLabel[row.access]}
                    {row.conflictsWithSeed ? (
                      <span className="admin-registry-status">
                        <span className="admin-pill admin-pill--conflict">ขัดกับค่าตั้งต้น</span>
                      </span>
                    ) : null}
                  </>
                ) : (
                  "—"
                )
            },
            {
              key: "open",
              header: "การเปิดใช้",
              render: (row) => (!row.announced ? "—" : row.open ? "เปิดใช้แล้ว" : "กำลังเตรียมระบบ")
            },
            {
              key: "when",
              header: "ประกาศเมื่อ",
              render: (row) =>
                row.announcedAt ? (
                  <>
                    {formatThaiDateTime(row.announcedAt) ?? "—"}
                    <span className="admin-registry-status">{row.announcedByEmail ?? "ไม่ทราบผู้ประกาศ"}</span>
                  </>
                ) : (
                  "—"
                )
            }
          ]}
          rows={registry.entries}
          rowKey={(row) => row.slug}
          empty="ไม่มีแอปในแคตตาล็อก"
        />
      </AdminCard>

      <AdminGrid columns={2}>
        {registry.entries.map((entry) => (
          <AdminCard
            key={entry.slug}
            title={entry.name}
            tone={entry.conflictsWithSeed ? "warning" : "default"}
            description={
              entry.announced
                ? `ประกาศไว้เป็น ${entry.access ? accessLabel[entry.access] : "—"} · ${entry.open ? "เปิดใช้แล้ว" : "กำลังเตรียมระบบ"}`
                : "ยังไม่เคยประกาศ หน้าราคาจึงไม่เอ่ยชื่อแอปนี้"
            }
          >
            <AppRegistryForm entry={entry} />
          </AdminCard>
        ))}
      </AdminGrid>

      <AdminCard
        title="คำประกาศล่าสุด"
        description="ทุกการประกาศและทุกการถอนมีผู้ทำ เวลา และเหตุผลติดอยู่ เหตุการณ์เหล่านี้ขึ้นบนแดชบอร์ดด้วย เพราะเป็นเหตุการณ์ระดับแพลตฟอร์ม ไม่ใช่งานของลูกค้ารายใด"
      >
        <AdminTable
          columns={[
            {
              key: "event",
              header: "เหตุการณ์",
              render: (row: RecentAnnouncement) =>
                row.eventType === "app.announcement_revoked_by_administrator" ? "ถอนคำประกาศ" : "ประกาศ"
            },
            { key: "app", header: "แอป", render: (row) => <code>{row.slug}</code> },
            { key: "reason", header: "เหตุผลที่ระบุ", render: (row) => row.reason || "—" },
            {
              key: "when",
              header: "เมื่อ",
              render: (row) => (
                <>
                  {formatThaiDateTime(row.createdAt) ?? "—"}
                  <span className="admin-registry-status">{row.actorEmail ?? "ไม่ทราบผู้ดำเนินการ"}</span>
                </>
              )
            }
          ]}
          rows={recent}
          rowKey={(row) => row.id}
          empty="ยังไม่มีการประกาศหรือถอนคำประกาศ"
        />
      </AdminCard>
    </>
  );
}
