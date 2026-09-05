import { AdminCard, AdminEmpty, AdminTable } from "@/components/admin/admin-card";
import { EntitlementForm } from "@/components/admin/entitlement-form";
import { entitlementStateLabel } from "@/lib/platform-admin-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai-format";
import {
  ADMIN_SETTABLE_STATES,
  findCustomers,
  readCustomerEntitlements,
  readRecentEntitlementChanges,
  type CustomerMatch
} from "@/server/admin/entitlement-admin";
import { resolvePlatformAdmin } from "@/server/platform-admin";
import { Button } from "@/components/platform/button";

/**
 * Finds a customer by the two things a person asking for help can say about themselves: an email
 * or an organization name. Project names would identify them too, and ADR 0013 keeps those closed.
 *
 * The layout already guards this route. The check is repeated because a page is its own entry
 * point, and a guard that exists in exactly one place is a guard somebody will route around.
 */
export default async function AdminEntitlementsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; org?: string }>;
}) {
  const auth = await resolvePlatformAdmin();
  if (!auth.ok) return <AdminCard title="ไม่มีสิทธิ์เข้าถึงหน้านี้" tone="warning" />;

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const selectedOrganizationId = params.org?.trim() ?? "";

  let matches: CustomerMatch[] = [];
  let lookupFailed = false;
  try {
    matches = query ? await findCustomers(query) : [];
  } catch {
    lookupFailed = true;
  }

  const selected = matches.find((match) => match.organizationId === selectedOrganizationId) ?? null;
  const entitlements = selected ? await readCustomerEntitlements(selected.organizationId).catch(() => []) : [];
  const recent = await readRecentEntitlementChanges().catch(() => []);

  return (
    <>
      <AdminCard
        title="ค้นหาลูกค้า"
        description="ค้นจากอีเมลสมาชิกหรือชื่อองค์กร ชื่อโครงการค้นไม่ได้และไม่แสดง เพราะเป็นงานของลูกค้าตาม ADR 0013"
      >
        <form className="admin-search" method="get">
          <label>
            <span className="visually-hidden">คำค้น</span>
            <input type="search" name="q" defaultValue={query} placeholder="อีเมล หรือ ชื่อองค์กร" minLength={2} />
          </label>
          <Button tone="quiet" type="submit">
            ค้นหา
          </Button>
        </form>

        {lookupFailed ? (
          <AdminEmpty>ค้นหาไม่สำเร็จเพราะอ่านฐานข้อมูลไม่ได้ ยังไม่มีผลลัพธ์ใดถูกแสดง</AdminEmpty>
        ) : query.length > 0 && query.length < 2 ? (
          <AdminEmpty>พิมพ์อย่างน้อย 2 ตัวอักษร</AdminEmpty>
        ) : query ? (
          <AdminTable
            columns={[
              {
                key: "org",
                header: "องค์กร",
                render: (row: CustomerMatch) => (
                  <a className="text-link" href={`/admin/entitlements?q=${encodeURIComponent(query)}&org=${row.organizationId}`}>
                    {row.organizationName}
                  </a>
                )
              },
              { key: "kind", header: "ประเภท", render: (row) => row.organizationKind },
              { key: "emails", header: "อีเมลสมาชิก", render: (row) => row.memberEmails.join(", ") || "—" }
            ]}
            rows={matches}
            rowKey={(row) => row.organizationId}
            empty="ไม่พบองค์กรหรืออีเมลที่ตรงกับคำค้นนี้"
          />
        ) : (
          <AdminEmpty>พิมพ์คำค้นเพื่อเริ่ม การเปิดหน้านี้เฉย ๆ ไม่แสดงรายชื่อลูกค้าทั้งหมด</AdminEmpty>
        )}
      </AdminCard>

      {selected ? (
        <AdminCard
          title={`สิทธิ์การใช้งานของ ${selected.organizationName}`}
          description="แก้ได้เฉพาะสถานะและวันหมดอายุ ทุกการเปลี่ยนแปลงต้องระบุเหตุผลและถูกบันทึกไว้"
        >
          {entitlements.length === 0 ? (
            <AdminEmpty>องค์กรนี้ยังไม่มีสิทธิ์ในแอปใด</AdminEmpty>
          ) : (
            <div className="admin-entitlements">
              {entitlements.map((entitlement) => (
                <article className="admin-entitlement" key={entitlement.entitlementId}>
                  <header>
                    <h3>{entitlement.appName}</h3>
                    <dl>
                      <div>
                        <dt>สถานะปัจจุบัน</dt>
                        <dd>{entitlementStateLabel[entitlement.state] ?? entitlement.state}</dd>
                      </div>
                      <div>
                        <dt>เริ่ม</dt>
                        <dd>{formatThaiDate(entitlement.startsAt) ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>หมดอายุ</dt>
                        <dd>{entitlement.endsAt ? formatThaiDate(entitlement.endsAt) : "ไม่มีกำหนด"}</dd>
                      </div>
                    </dl>
                  </header>
                  <EntitlementForm
                    entitlement={entitlement}
                    organizationId={selected.organizationId}
                    states={ADMIN_SETTABLE_STATES}
                  />
                </article>
              ))}
            </div>
          )}
        </AdminCard>
      ) : null}

      <AdminCard
        title="ประวัติการแก้สิทธิ์ล่าสุด"
        description="ทุกแถวมีผู้ดำเนินการ เหตุผล และสถานะก่อนหลัง การต่ออายุที่ไม่มีเหตุผลกำกับเกิดขึ้นไม่ได้"
      >
        <AdminTable
          columns={[
            { key: "when", header: "เมื่อ", render: (row: (typeof recent)[number]) => formatThaiDateTime(row.createdAt) ?? "—" },
            { key: "actor", header: "ผู้ดำเนินการ", render: (row) => row.actorEmail ?? "—" },
            {
              key: "change",
              header: "เปลี่ยนเป็น",
              render: (row) => {
                const meta = row.metadata as { before?: { state?: string }; after?: { state?: string } };
                const before = meta.before?.state ? entitlementStateLabel[meta.before.state] ?? meta.before.state : "—";
                const after = meta.after?.state ? entitlementStateLabel[meta.after.state] ?? meta.after.state : "—";
                return `${before} → ${after}`;
              }
            },
            {
              key: "reason",
              header: "เหตุผล",
              render: (row) => (row.metadata as { reason?: string }).reason ?? "—"
            }
          ]}
          rows={recent}
          rowKey={(row) => row.id}
          empty="ยังไม่มีการแก้สิทธิ์โดยผู้ดูแล"
        />
      </AdminCard>
    </>
  );
}
