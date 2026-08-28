import { AdminCard, AdminEmpty, AdminGrid } from "@/components/admin/admin-card";
import { ChannelForm } from "@/components/admin/channel-form";
import { formatThaiDateTime } from "@/lib/thai-format";
import { readChannelsForAdmin } from "@/server/platform-channels";
import { resolvePlatformAdmin } from "@/server/platform-admin";

/**
 * ช่องทางติดต่อของแพลตฟอร์ม — สิ่งที่กรอกที่นี่ขึ้นท้ายเว็บทุกหน้าทันที ช่องที่ยังไม่กรอกถูกซ่อน
 * (คำวินิจฉัยเจ้าของงาน 2026-08-28) ตรวจสิทธิ์ซ้ำแม้ layout จะกันแล้ว ด้วยเหตุผลเดียวกับทุกหน้าหลังบ้าน:
 * หน้าเป็นประตูของตัวเอง
 */
export default async function AdminChannelsPage() {
  const auth = await resolvePlatformAdmin();
  if (!auth.ok) return <AdminCard title="ไม่มีสิทธิ์เข้าถึงหน้านี้" tone="warning" />;

  const result = await readChannelsForAdmin();

  if (!result.ok) {
    return (
      <AdminCard title="อ่านช่องทางติดต่อไม่ได้" tone="warning">
        <AdminEmpty>
          ระบบเชื่อมต่อฐานข้อมูลไม่สำเร็จ ระหว่างนี้ท้ายเว็บจะไม่แสดงช่องทางติดต่อใดเลย
          ซึ่งเป็นพฤติกรรมที่ตั้งใจ ดีกว่าแสดงค่าเก่าที่ไม่แน่ใจว่ายังจริง
        </AdminEmpty>
      </AdminCard>
    );
  }

  const filled = result.channels.filter((channel) => channel.value !== null);

  return (
    <>
      <AdminCard title="ช่องที่กรอกแล้วขึ้นท้ายเว็บทุกหน้า ช่องที่ว่างถูกซ่อน" tone="note">
        <p>
          ท้ายเว็บของทุกหน้าและทุกแอปอ่านค่าจากหน้านี้ <strong>ช่องที่ยังไม่กรอกจะไม่ปรากฏบนเว็บเลย</strong>{" "}
          ไม่มีการแสดงค่าชั่วคราวหรือค่าปลอมให้ลูกค้าเห็น กรอกเมื่อบัญชีนั้นพร้อมให้ลูกค้าทักจริงเท่านั้น
        </p>
      </AdminCard>

      <AdminGrid columns={2}>
        {result.channels.map((channel) => (
          <AdminCard
            key={channel.key}
            title={channel.label}
            description={
              channel.value
                ? `กำลังแสดงบนท้ายเว็บ · แก้ล่าสุด ${formatThaiDateTime(channel.updatedAt) ?? "—"} โดย ${channel.updatedByEmail ?? "ไม่ทราบผู้แก้"}`
                : "ยังไม่กรอก — ช่องนี้ถูกซ่อนจากท้ายเว็บ"
            }
          >
            <ChannelForm channel={channel} />
          </AdminCard>
        ))}
      </AdminGrid>

      <AdminCard
        title="สรุปที่ลูกค้าเห็นตอนนี้"
        description={
          filled.length === 0
            ? "ยังไม่มีช่องทางติดต่อใดแสดงบนท้ายเว็บ"
            : `แสดงอยู่ ${filled.length} ช่องทาง: ${filled.map((channel) => channel.label).join(" · ")}`
        }
      />
    </>
  );
}
