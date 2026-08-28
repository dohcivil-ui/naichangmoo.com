import { WEIGHT_SCALE, normaliseWeights, type PlanActivity } from "@/lib/work-plan";
import type { Milestone } from "@/lib/payment-milestone";

/**
 * วงจรของข้อเสนอ (Proposal Lifecycle) ของผู้ช่วยแผนงาน — IP-184
 *
 * เส้นแบ่งหน้าที่เดิมของระบบยังอยู่ครบ: **แบบจำลองเสนอโครงสร้างและสัดส่วน โค้ดของเราคิดเงิน**
 * ร่างที่มาจากสายมีแต่น้ำหนัก ppm กับจำนวนวัน (กฎ G1 — ไม่มีช่องเงินให้โมเดลตอบ)
 * ไฟล์นี้แปลงร่างเป็นเงินสตางค์ bigint ด้วยกฎเดียวกับทั้งระบบ และถือกองประวัติ (snapshot)
 * ให้ปุ่ม "คืนค่า" ถอยกลับได้หลังกดรับ
 *
 * ฟังก์ชันบริสุทธิ์ทั้งไฟล์ — `toPlan` เดิมฝังอยู่ใน server action จึงไม่เคยมีเทสต์
 * การย้ายมาที่นี่คือกำไรที่ทำให้พฤติกรรมทุกข้อถูกพิสูจน์ได้ (work-plan-proposal.test.ts)
 */

/** ร่างแผนที่ข้ามสายมาจากประตูกลาง — ห้ามเชื่อรูปร่างจากสายดิบ ๆ ต้องผ่าน parse ก่อนเสมอ */
export type WorkPlanDraftWire = {
  note: string;
  activities: { number: string; title: string; weightPpm: number; startOffsetDays: number; durationDays: number }[];
  milestones: { title: string; activityNumbers: string[] }[];
};

export type ReviewFinding = { severity: "high" | "medium" | "low"; title: string; detail: string };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const asText = (value: unknown): string | null => (typeof value === "string" ? value : null);
const asInt = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;

/** ร่างจากสาย → โครงที่เชื่อได้ ของเพี้ยนคืน null ไม่พังหน้า */
export function parseWorkPlanDraft(value: unknown): WorkPlanDraftWire | null {
  const source = asRecord(value);
  if (!source) return null;
  const note = asText(source.note);
  if (note === null || !Array.isArray(source.activities) || !Array.isArray(source.milestones)) return null;

  const activities: WorkPlanDraftWire["activities"] = [];
  for (const row of source.activities) {
    const activity = asRecord(row);
    if (!activity) return null;
    const number = asText(activity.number);
    const title = asText(activity.title);
    const weightPpm = asInt(activity.weightPpm);
    const startOffsetDays = asInt(activity.startOffsetDays);
    const durationDays = asInt(activity.durationDays);
    if (number === null || title === null || weightPpm === null || startOffsetDays === null || durationDays === null) return null;
    activities.push({ number, title, weightPpm, startOffsetDays, durationDays });
  }

  const milestones: WorkPlanDraftWire["milestones"] = [];
  for (const row of source.milestones) {
    const milestone = asRecord(row);
    const title = milestone ? asText(milestone.title) : null;
    if (!milestone || title === null || !Array.isArray(milestone.activityNumbers)) return null;
    const activityNumbers = milestone.activityNumbers.filter((entry): entry is string => typeof entry === "string");
    milestones.push({ title, activityNumbers });
  }

  if (activities.length === 0) return null;
  return { note, activities, milestones };
}

export function parseReviewFindings(value: unknown): ReviewFinding[] | null {
  const source = asRecord(value);
  if (!source || !Array.isArray(source.findings)) return null;
  const findings: ReviewFinding[] = [];
  for (const row of source.findings) {
    const finding = asRecord(row);
    const severity = finding ? asText(finding.severity) : null;
    const title = finding ? asText(finding.title) : null;
    const detail = finding ? asText(finding.detail) : null;
    if (!finding || !title || !detail || (severity !== "high" && severity !== "medium" && severity !== "low")) return null;
    findings.push({ severity, title, detail });
  }
  return findings;
}

export type ProposalPlan = {
  note: string;
  activities: PlanActivity[];
  milestones: Milestone[];
};

/**
 * ร่าง (สัดส่วน ppm) → แผนจริง (เงินสตางค์ bigint) — ย้ายจาก server action เดิมทั้งก้อน
 *
 * กติกาที่ต้องคงไว้ทุกข้อ: เกลี่ยน้ำหนักให้รวมเป๊ะก่อนคิดเงิน · แถวสุดท้ายรับเศษให้ผลรวม
 * เท่ามูลค่าสัญญาเสมอ · วันเริ่ม/ระยะเวลาถูกบีบให้อยู่ในช่วงสัญญา · งานที่แบบจำลอง
 * ลืมผูกเข้างวดต่อท้ายงวดสุดท้าย ไม่หายเงียบ · ไม่มีงวดเลยก็สร้างงวดแรกให้
 */
export function draftToPlan(draft: WorkPlanDraftWire, contractSatang: bigint, durationDays: number): ProposalPlan {
  const weights = normaliseWeights(draft.activities.map((activity) => activity.weightPpm));

  let allocated = 0n;
  const activities: PlanActivity[] = draft.activities.map((activity, index) => {
    const isLast = index === draft.activities.length - 1;
    const costSatang = isLast ? contractSatang - allocated : (contractSatang * weights[index]!) / WEIGHT_SCALE;
    allocated += costSatang;

    const start = Math.max(0, Math.min(activity.startOffsetDays, durationDays));
    return {
      id: `ai-${activity.number}-${index}`,
      number: activity.number,
      title: activity.title,
      startOffsetDays: start,
      durationDays: Math.max(1, Math.min(activity.durationDays, durationDays - start || 1)),
      costSatang
    };
  });

  const byNumber = new Map(activities.map((activity) => [activity.number, activity.id]));
  const claimed = new Set<string>();
  const milestones: Milestone[] = draft.milestones.map((milestone, index) => ({
    id: `ai-milestone-${index + 1}`,
    ordinal: index + 1,
    title: milestone.title,
    activityIds: milestone.activityNumbers
      .map((number) => byNumber.get(number))
      .filter((id): id is string => id !== undefined && !claimed.has(id) && (claimed.add(id), true))
  }));

  const orphans = activities.filter((activity) => !claimed.has(activity.id)).map((activity) => activity.id);
  if (orphans.length > 0) {
    if (milestones.length === 0) {
      milestones.push({ id: "ai-milestone-1", ordinal: 1, title: "งวดที่ 1", activityIds: orphans });
    } else {
      const last = milestones[milestones.length - 1]!;
      milestones[milestones.length - 1] = { ...last, activityIds: [...last.activityIds, ...orphans] };
    }
  }

  return { note: draft.note, activities, milestones };
}

/**
 * ข้อเท็จจริงสำหรับจังหวะตรวจแผน — ตัวเลขเสี่ยงคำนวณฝั่งเราจาก BigInt ทั้งหมด (กฎ G3)
 * แบบจำลองได้รับเป็นข้อความสำเร็จรูป มีหน้าที่แค่เรียบเรียงเป็นคำเตือน
 */
export type ReviewFactRow = { title: string; periodWorkSatang: bigint };

const thaiBaht = (satang: bigint) => (satang / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function buildReviewFacts(rows: ReviewFactRow[], contractSatang: bigint): string[] {
  const facts: string[] = [];
  const heaviest = [...rows].sort((a, b) => Number(b.periodWorkSatang - a.periodWorkSatang))[0];
  if (heaviest && contractSatang > 0n) {
    const share = (heaviest.periodWorkSatang * 100n) / contractSatang;
    facts.push(`งวดที่หนักที่สุดคือ ${heaviest.title} คิดเป็น ${share}% ของมูลค่าสัญญา`);
  }
  const first = rows[0];
  if (first) {
    facts.push(
      `เงินงวดแรก ${first.title} มูลค่างาน ${thaiBaht(first.periodWorkSatang)} บาท ` +
        `จะได้รับหลังผ่านการตรวจรับ ผู้รับจ้างต้องสำรองค่าวัสดุและค่าแรงก่อนหน้านั้นเอง`
    );
  }
  facts.push(`มูลค่าสัญญารวม ${thaiBaht(contractSatang)} บาท จำนวนงวด ${rows.length} งวด`);
  return facts;
}

/**
 * กองประวัติของปุ่ม "คืนค่า" — ลึก 5 ชั้นตามคำเคาะเจ้าของงาน เก็บในหน่วยความจำของหน้า
 * (ไม่ลง localStorage — เพดาน ~4MB เป็นของจริง และ undo ถาวรคือ IP-144)
 */
export const SNAPSHOT_DEPTH = 5;

export type PlanRevertSnapshot = {
  activities: PlanActivity[];
  milestones: Milestone[];
  draftedIds: string[];
  takenAtLabel: string;
};

export function pushSnapshot(history: PlanRevertSnapshot[], snapshot: PlanRevertSnapshot): PlanRevertSnapshot[] {
  return [...history, snapshot].slice(-SNAPSHOT_DEPTH);
}

export function popSnapshot(history: PlanRevertSnapshot[]): { rest: PlanRevertSnapshot[]; snapshot: PlanRevertSnapshot | null } {
  if (history.length === 0) return { rest: history, snapshot: null };
  return { rest: history.slice(0, -1), snapshot: history[history.length - 1]! };
}
