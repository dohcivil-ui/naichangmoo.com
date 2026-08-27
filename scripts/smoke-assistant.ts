/**
 * ยิงผู้ช่วยจริงหนึ่งครั้ง ผ่านประตูเดียวกับที่แอปจะใช้
 *
 * มีเพราะรอยต่อที่ไม่เคยยิงจริงคือรอยต่อที่ยังไม่รู้ว่าใช้ได้ เทสต์ที่เขียนไว้ทั้งหมดยืนบนของปลอม
 * ทั้งฝั่งแบบจำลองและฝั่งฐานข้อมูล มันพิสูจน์ได้ว่ากฎถูก แต่พิสูจน์ไม่ได้ว่าค่ายแบบจำลองยอมรับ
 * schema ที่เราส่ง ว่าคำตอบผ่าน zod ได้ และว่าค่าใช้จ่ายที่บันทึกตรงกับที่เกิดขึ้นจริง
 *
 * เสียเงินราว 0.22 บาทต่อครั้ง จึงต้องเปิดด้วยธงเสมอ ไม่ใช่ของที่รันโดยบังเอิญ
 *
 *   $env:ASSISTANT_SMOKE=1 ; npx tsx scripts/smoke-assistant.ts
 *
 * สร้างสมาชิกชั่วคราวพร้อมสิทธิ์ผู้ดูแลแพลตฟอร์ม เพราะแอปแผนงานยังไม่เปิดใช้งานในทะเบียน
 * แล้วเก็บกวาดทุกแถวที่สร้างขึ้นก่อนจบเสมอ ไม่ว่าจะสำเร็จหรือล้ม
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

function loadLocalEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();

if (process.env.ASSISTANT_SMOKE !== "1") {
  console.log("ตั้ง ASSISTANT_SMOKE=1 ก่อน สคริปต์นี้เรียก API จริงและมีค่าใช้จ่าย");
  process.exit(0);
}

const { getDb } = await import("@/db");
const { assistantProposals, auditEvents, organizationMembers, organizations, platformAdministrators, users } =
  await import("@/db/schema");
const { runAssistant, settleProposal } = await import("@/server/ai/assistant");

const db = getDb();
const userId = `user_smoke_${randomUUID()}`;
const organizationId = `org_smoke_${userId}`;
const adminId = `admin_smoke_${userId}`;
let proposalId: string | null = null;

const cleanUp = async () => {
  if (proposalId) {
    await db.delete(auditEvents).where(eq(auditEvents.correlationId, proposalId));
    await db.delete(assistantProposals).where(eq(assistantProposals.id, proposalId));
  }
  await db.delete(platformAdministrators).where(eq(platformAdministrators.id, adminId));
  await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, organizationId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  await db.delete(users).where(eq(users.id, userId));
};

try {
  await db.insert(users).values({ id: userId, name: "ผู้ทดสอบผู้ช่วย", email: `${userId}@example.test` });
  await db.insert(organizations).values({ id: organizationId, kind: "personal", name: "ผู้ทดสอบผู้ช่วย" });
  await db
    .insert(organizationMembers)
    .values({ id: `member_${organizationId}_${userId}`, organizationId, userId, role: "owner" });
  await db.insert(platformAdministrators).values({ id: adminId, userId, note: "smoke test" });

  console.log("เรียกผู้ช่วยตรวจแผนงานด้วยแบบจำลองจริง...");
  const started = Date.now();

  const result = await runAssistant(
    { id: userId },
    {
      app: "work-plan",
      verb: "critique",
      subject: "project:smoke",
      input: {
        projectName: "อาคารเรียน 4 ชั้น 12 ห้องเรียน",
        contractBaht: "18,500,000",
        durationDays: 300,
        milestones: [
          { title: "งวดที่ 1", percentOfContract: "45.00", activityTitles: ["งานเตรียมการ", "งานฐานราก", "งานโครงสร้าง"] },
          { title: "งวดที่ 2", percentOfContract: "50.00", activityTitles: ["งานสถาปัตยกรรม", "งานระบบ"] },
          { title: "งวดที่ 3", percentOfContract: "5.00", activityTitles: ["งานเก็บรายละเอียด"] }
        ]
      },
      facts: [
        "งวดที่หนักที่สุดคือ งวดที่ 2 คิดเป็น 50 เปอร์เซ็นต์ของมูลค่าสัญญา",
        "มูลค่าสัญญารวม 18,500,000 บาท จำนวนงวด 3 งวด",
        "เงินประกันผลงานที่หักสะสมไว้มากกว่ายอดรับของงวดสุดท้าย"
      ]
    }
  );

  if (!result.ok) {
    console.error(`ปฏิเสธ: ${result.reason} — ${result.message}`);
    process.exitCode = 1;
  } else {
    proposalId = result.proposal.proposalId;
    const { proposal } = result;
    console.log(`สำเร็จใน ${Date.now() - started} มิลลิวินาที`);
    console.log(`  รหัสข้อเสนอ  ${proposal.proposalId}`);
    console.log(`  รุ่นที่ตอบ    ${proposal.modelId}`);
    console.log(`  token       เข้า ${proposal.usage.inputTokens} ออก ${proposal.usage.outputTokens}`);
    console.log(`  ค่าใช้จ่าย    ${proposal.usage.costMicroUsd} micro USD (${((proposal.usage.costMicroUsd / 1_000_000) * 35).toFixed(3)} บาท)`);
    console.log(`  โควตา       ใช้ไป ${proposal.quota.used} จาก ${proposal.quota.limit} คืนวันที่ ${proposal.quota.resetsAtIso}`);
    console.log(`  คำเตือน     ${proposal.warnings.length} ข้อ · ที่มา ${proposal.citations.length} รายการ`);
    console.log("");
    console.log(JSON.stringify(proposal.draft, null, 2));

    const [row] = await db.select().from(assistantProposals).where(eq(assistantProposals.id, proposal.proposalId));
    console.log("");
    console.log(`แถวในฐานข้อมูล: decision=${row?.decision} cost_micro_usd=${row?.costMicroUsd} elapsed_ms=${row?.elapsedMs}`);

    const settled = await settleProposal({ id: userId }, { proposalId: proposal.proposalId, decision: "rejected" });
    console.log(`กดปฏิเสธแล้ว: ${JSON.stringify(settled)}`);

    const events = await db.select().from(auditEvents).where(eq(auditEvents.correlationId, proposal.proposalId));
    console.log(`เหตุการณ์ในประวัติ: ${events.map((event) => event.eventType).join(", ")}`);
  }
} finally {
  await cleanUp();
  console.log("เก็บกวาดข้อมูลทดสอบเรียบร้อย");
  process.exit(process.exitCode ?? 0);
}
