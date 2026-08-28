import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_DEPTH,
  buildReviewFacts,
  draftToPlan,
  parseReviewFindings,
  parseWorkPlanDraft,
  popSnapshot,
  pushSnapshot,
  type WorkPlanDraftWire,
  type PlanRevertSnapshot
} from "./work-plan-proposal";

const draft = (over: Partial<WorkPlanDraftWire> = {}): WorkPlanDraftWire => ({
  note: "สมมติฐานทดสอบ",
  activities: [
    { number: "1", title: "งานดิน", weightPpm: 240_000, startOffsetDays: 0, durationDays: 45 },
    { number: "2", title: "งานท่อ", weightPpm: 140_000, startOffsetDays: 15, durationDays: 30 },
    { number: "3", title: "ผิวทาง", weightPpm: 520_000, startOffsetDays: 30, durationDays: 60 },
    { number: "4", title: "เครื่องหมาย", weightPpm: 100_000, startOffsetDays: 75, durationDays: 15 }
  ],
  milestones: [
    { title: "งวดที่ 1", activityNumbers: ["1", "2"] },
    { title: "งวดที่ 2", activityNumbers: ["3"] }
  ],
  ...over
});

describe("วงจรของข้อเสนอผู้ช่วยแผนงาน (IP-184)", () => {
  it("ผลรวมสตางค์เท่ามูลค่าสัญญาเป๊ะ — แถวสุดท้ายรับเศษ", () => {
    const contract = 12_345_679n; // หารไม่ลงตัวแน่นอน
    const plan = draftToPlan(draft(), contract, 90);
    const total = plan.activities.reduce((sum, activity) => sum + activity.costSatang, 0n);
    expect(total).toBe(contract);
  });

  it("น้ำหนักรวมขาด/เกินถูกเกลี่ยตามสัดส่วน ไม่ปฏิเสธทั้งคำตอบ", () => {
    const skewed = draft({
      activities: [
        { number: "1", title: "ก", weightPpm: 300, startOffsetDays: 0, durationDays: 10 },
        { number: "2", title: "ข", weightPpm: 100, startOffsetDays: 0, durationDays: 10 }
      ],
      milestones: [{ title: "งวดที่ 1", activityNumbers: ["1", "2"] }]
    });
    const plan = draftToPlan(skewed, 1_000_00n, 30);
    expect(plan.activities[0]!.costSatang + plan.activities[1]!.costSatang).toBe(1_000_00n);
    // สัดส่วน 3:1 คงเดิมแม้ผลรวม ppm ไม่ใช่ล้าน
    expect(plan.activities[0]!.costSatang).toBe(75_000n);
  });

  it("แถวเดียวได้ทั้งก้อน และวันเริ่ม/ระยะเวลาถูกบีบเข้าช่วงสัญญา", () => {
    const single = draft({
      activities: [{ number: "1", title: "งานเดียว", weightPpm: 1_000_000, startOffsetDays: 120, durationDays: 999 }],
      milestones: []
    });
    const plan = draftToPlan(single, 500_00n, 90);
    expect(plan.activities[0]!.costSatang).toBe(500_00n);
    expect(plan.activities[0]!.startOffsetDays).toBe(90);
    expect(plan.activities[0]!.durationDays).toBe(1);
  });

  it("งานกำพร้าต่อท้ายงวดสุดท้าย และไม่มีงวดเลยก็สร้างงวดแรกให้", () => {
    const plan = draftToPlan(draft(), 100_000n, 90);
    const last = plan.milestones[plan.milestones.length - 1]!;
    expect(last.activityIds).toContain(plan.activities[3]!.id); // "4" ไม่ถูกผูกในร่าง

    const noMilestones = draftToPlan(draft({ milestones: [] }), 100_000n, 90);
    expect(noMilestones.milestones).toHaveLength(1);
    expect(noMilestones.milestones[0]!.activityIds).toHaveLength(4);
  });

  it("parse ร่างจากสาย: ของครบผ่าน ของเพี้ยนคืน null ไม่พังหน้า", () => {
    expect(parseWorkPlanDraft(draft())).not.toBeNull();
    expect(parseWorkPlanDraft(null)).toBeNull();
    expect(parseWorkPlanDraft({ note: "x", activities: [], milestones: [] })).toBeNull();
    expect(parseWorkPlanDraft({ note: "x", activities: [{ number: 5 }], milestones: [] })).toBeNull();
  });

  it("parse ผลตรวจ: ระดับความเสี่ยงต้องเป็นค่าที่รู้จักเท่านั้น", () => {
    expect(parseReviewFindings({ findings: [{ severity: "high", title: "ก", detail: "ข" }] })).toHaveLength(1);
    expect(parseReviewFindings({ findings: [{ severity: "urgent", title: "ก", detail: "ข" }] })).toBeNull();
    expect(parseReviewFindings({})).toBeNull();
  });

  it("ข้อเท็จจริงจังหวะตรวจ: งวดหนักสุดกับยอดสัญญาคิดจาก BigInt ฝั่งเรา", () => {
    const facts = buildReviewFacts(
      [
        { title: "งวดที่ 1", periodWorkSatang: 25_000_00n },
        { title: "งวดที่ 2", periodWorkSatang: 75_000_00n }
      ],
      100_000_00n
    );
    expect(facts[0]).toContain("งวดที่ 2");
    expect(facts[0]).toContain("75%");
    expect(facts[facts.length - 1]).toContain("2 งวด");
  });

  it("กองประวัติ: ตัดที่ 5 ชั้น pop คืนค่าเดิมเป๊ะระดับ bigint และปฏิเสธข้อเสนอไม่แตะกอง", () => {
    const snapshotOf = (label: number): PlanRevertSnapshot => ({
      activities: [{ id: `a${label}`, number: "1", title: "งาน", startOffsetDays: 0, durationDays: 1, costSatang: BigInt(label) }],
      milestones: [],
      draftedIds: [`a${label}`],
      takenAtLabel: `รอบ ${label}`
    });
    let history: PlanRevertSnapshot[] = [];
    for (let round = 1; round <= 7; round++) history = pushSnapshot(history, snapshotOf(round));
    expect(history).toHaveLength(SNAPSHOT_DEPTH);
    expect(history[0]!.takenAtLabel).toBe("รอบ 3");

    const { rest, snapshot } = popSnapshot(history);
    expect(snapshot!.activities[0]!.costSatang).toBe(7n);
    expect(rest).toHaveLength(4);
    expect(popSnapshot([]).snapshot).toBeNull();
  });
});
