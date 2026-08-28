import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, platformChannels, users } from "@/db/schema";
import { channelKinds, isChannelKey, validateChannelValue, type ChannelKey } from "@/lib/platform-channels";

/**
 * ประตูเดียวของช่องทางติดต่อ (IP-106) — แบบเดียวกับทะเบียนแอป: ค่าที่ขึ้นหน้าเว็บคือแถวที่
 * ผู้ดูแลกรอก ไม่ใช่ข้อความในโค้ด ทุกการแก้มีคนทำ เวลา และเหตุผลติดในบันทึกการเปลี่ยนแปลง
 */

const channelRowId = (key: ChannelKey) => `channel_${key}`;
const REASON_MIN_LENGTH = 4;

export type PublishedChannel = { key: ChannelKey; label: string; href: string; value: string };

/**
 * เฉพาะช่องที่กรอกแล้ว สำหรับท้ายเว็บ — ฐานข้อมูลอ่านไม่ได้ให้คืนลิสต์ว่าง เพราะช่องทางติดต่อ
 * เป็นของประดับที่หายได้ชั่วคราว ไม่ใช่คำแถลงที่ต้องแยกกรณีอ่านไม่ได้ออกจากกรณีไม่มี
 */
export async function readPublishedChannels(): Promise<PublishedChannel[]> {
  try {
    const db = getDb();
    const rows = await db.select({ key: platformChannels.key, value: platformChannels.value }).from(platformChannels);
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const published: PublishedChannel[] = [];
    for (const kind of channelKinds) {
      const value = byKey.get(kind.key);
      if (!value) continue;
      published.push({ key: kind.key, label: kind.label, href: kind.toHref(value), value });
    }
    return published;
  } catch {
    return [];
  }
}

export type AdminChannel = {
  key: ChannelKey;
  label: string;
  hint: string;
  value: string | null;
  updatedAt: Date | null;
  updatedByEmail: string | null;
};

export type AdminChannelsResult = { ok: true; channels: AdminChannel[] } | { ok: false; reason: "unavailable" };

export async function readChannelsForAdmin(): Promise<AdminChannelsResult> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        key: platformChannels.key,
        value: platformChannels.value,
        updatedAt: platformChannels.updatedAt,
        updatedByEmail: users.email
      })
      .from(platformChannels)
      .leftJoin(users, eq(users.id, platformChannels.updatedBy));
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return {
      ok: true,
      channels: channelKinds.map((kind) => {
        const row = byKey.get(kind.key);
        return {
          key: kind.key,
          label: kind.label,
          hint: kind.hint,
          value: row?.value ?? null,
          updatedAt: row?.updatedAt ?? null,
          updatedByEmail: row?.updatedByEmail ?? null
        };
      })
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type SetChannelInput = {
  key: string;
  /** ค่าใหม่ หรือ null เพื่อล้างค่าและซ่อนช่องนั้นจากหน้าเว็บ */
  value: string | null;
  reason: string;
  actorId: string;
};

export type SetChannelResult =
  | { ok: true }
  | { ok: false; reason: "unknown_channel" | "reason_required" | "invalid_value"; message?: string };

export async function setChannel(input: SetChannelInput): Promise<SetChannelResult> {
  const reason = input.reason.trim();
  if (reason.length < REASON_MIN_LENGTH) return { ok: false, reason: "reason_required" };
  if (!isChannelKey(input.key)) return { ok: false, reason: "unknown_channel" };
  const key = input.key;

  let value: string | null = null;
  if (input.value !== null && input.value.trim() !== "") {
    const validated = validateChannelValue(key, input.value);
    if (!validated.ok) return { ok: false, reason: "invalid_value", message: validated.message };
    value = validated.value;
  }

  const db = getDb();
  const now = new Date();

  const [existing] = await db
    .select({ value: platformChannels.value })
    .from(platformChannels)
    .where(eq(platformChannels.key, key))
    .limit(1);

  await db.transaction(async (tx) => {
    await tx
      .insert(platformChannels)
      .values({ id: channelRowId(key), key, value, updatedBy: input.actorId })
      .onConflictDoUpdate({
        target: platformChannels.key,
        set: { value, updatedBy: input.actorId, updatedAt: now }
      });

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      // ระดับแพลตฟอร์ม: ช่องทางติดต่อเป็นของแพลตฟอร์ม ไม่ใช่ของลูกค้ารายใด
      organizationId: null,
      actorId: input.actorId,
      eventType: "platform.channel_set_by_administrator",
      resourceType: "platform_channel",
      resourceId: key,
      metadata: {
        reason,
        before: { value: existing?.value ?? null },
        after: { value }
      }
    });
  });

  return { ok: true };
}
