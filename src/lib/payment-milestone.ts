import { WEIGHT_SCALE, type ActivityWeight } from "./work-plan";

/**
 * งวดงาน–งวดเงิน: แปลงงานที่ทำได้ในแต่ละงวดเป็นเงินที่ผู้รับจ้างได้รับจริง
 *
 * กฎทั้งหมดบันทึกไว้ใน `docs/research/changkid-easy-planning-2026-08-25.md` ซึ่งอ่านมาจาก
 * ระบบที่ใช้งานจริงและตรวจเลขย้อนกลับได้ทุกบรรทัด สามข้อที่กำหนดรูปร่างของโมดูลนี้:
 *
 * หนึ่ง — **งวดตัดด้วยงาน ไม่ใช่ด้วยเวลา** ผู้ใช้ผูกกิจกรรมเข้ากลุ่มงวดเอง แล้วเงินจึงไหลออกมา
 * ไม่ใช่ให้โปรแกรมตัดเส้นสะสมที่เปอร์เซ็นต์ เพราะเปอร์เซ็นต์ที่โปรแกรมตัดเองจะไม่มีวันตรงกับ
 * งวดงานที่หน่วยงานอนุมัติ และงวดงานราชการเขียนว่า "เมื่องานฐานรากแล้วเสร็จ" ไม่ได้เขียนว่า "เมื่อครบ 15%"
 *
 * สอง — **คิดจากยอดสะสมแล้วลบงวดก่อน** ไม่ใช่บวกทีละงวด ผลคือย้ายกิจกรรมข้ามงวดแล้ว
 * งวดหลัง ๆ ไม่เพี้ยน และผลรวมทุกงวดเท่ากับมูลค่าสัญญาเป๊ะเสมอเพราะยอดมันหักล้างกันเอง
 *
 * สาม — **ฐานของทุกการหักคือมูลค่างานงวดนั้น** ทั้งเงินประกัน คืนเงินล่วงหน้า VAT และภาษีหัก ณ ที่จ่าย
 * และหน้าจอต้องแสดงครบทุกบรรทัด เพราะฐานคิดต่างกันได้ตามสัญญาแต่ละฉบับ ผู้ใช้ต้องเห็นเพื่อเทียบ
 * กับสัญญาจริงก่อนใช้ยื่นเบิก
 *
 * เงินเป็น satang ใน bigint ตลอด ตาม `src/lib/thai-baht.ts` — ระบบที่เราไปดูมาแสดงยอด
 * 305,000 บาทเป็น 305,000,000,000 บาทบนการ์ดงวดงาน เพราะถือเงินเป็นตัวเลขลอย ๆ
 */

export type RetentionMethod = "each" | "final";
export type AdvanceRecovery = "proportional" | "none";

export type ContractTerms = {
  contractSatang: bigint;
  /** เงินล่วงหน้า/มัดจำ เป็นส่วนในล้านของมูลค่าสัญญา */
  advancePpm: bigint;
  advanceRecovery: AdvanceRecovery;
  /** เงินประกันผลงาน เป็นส่วนในล้านของมูลค่างานงวดนั้น */
  retentionPpm: bigint;
  retentionMethod: RetentionMethod;
  vatPpm: bigint;
  /** ภาษีหัก ณ ที่จ่าย 1% งานราชการ 3% เอกชน หรือ 0 เมื่อไม่หัก */
  withholdingPpm: bigint;
};

export type Milestone = {
  id: string;
  ordinal: number;
  title: string;
  activityIds: readonly string[];
};

export type MilestoneRow = {
  milestoneId: string;
  ordinal: number;
  title: string;
  activityCount: number;
  weightPpm: bigint;
  cumulativeWeightPpm: bigint;
  cumulativeWorkSatang: bigint;
  previousCumulativeSatang: bigint;
  /** มูลค่างานงวดนี้ = สะสมถึงงวดนี้ ลบ สะสมงวดก่อน */
  periodWorkSatang: bigint;
  retentionSatang: bigint;
  advanceRecoverySatang: bigint;
  vatSatang: bigint;
  withholdingSatang: bigint;
  /** เงินรับจริง = มูลค่างานงวดนี้ + VAT − ประกัน − คืนล่วงหน้า − ภาษีหัก ณ ที่จ่าย */
  netSatang: bigint;
};

export type MilestoneSchedule = {
  rows: MilestoneRow[];
  /** น้ำหนักงานที่ยังไม่ได้ผูกเข้างวดใดเลย ต้องแสดงบนหน้าจอ ไม่ใช่ซ่อนไว้ */
  unassignedWeightPpm: bigint;
  advanceSatang: bigint;
  totalWorkSatang: bigint;
  totalRetentionSatang: bigint;
  totalNetSatang: bigint;
};

const share = (base: bigint, ppm: bigint): bigint => (base * ppm) / WEIGHT_SCALE;

/**
 * คำนวณเงินของทุกงวดจากกิจกรรมที่ผูกไว้
 *
 * กิจกรรมที่อยู่ในหลายงวดจะถูกนับที่งวดแรกที่พบ เพื่อไม่ให้ค่างานถูกเบิกซ้ำ — ตัวป้องกันนี้อยู่ที่นี่
 * ไม่ใช่ที่หน้าจอ เพราะหน้าจอเป็นสิ่งที่เลี่ยงได้ ส่วนยอดเงินเป็นสิ่งที่เลี่ยงไม่ได้
 */
export function buildMilestoneSchedule(
  weights: readonly ActivityWeight[],
  milestones: readonly Milestone[],
  terms: ContractTerms
): MilestoneSchedule {
  const weightById = new Map(weights.map((weight) => [weight.activityId, weight.weightPpm]));
  const claimed = new Set<string>();

  const ordered = [...milestones].sort((a, b) => a.ordinal - b.ordinal);
  const advanceSatang = share(terms.contractSatang, terms.advancePpm);

  let cumulativeWeightPpm = 0n;
  let previousCumulativeSatang = 0n;
  let advanceOutstanding = advanceSatang;

  const rows: MilestoneRow[] = ordered.map((milestone, index) => {
    const isLast = index === ordered.length - 1;

    let weightPpm = 0n;
    let activityCount = 0;
    for (const activityId of milestone.activityIds) {
      if (claimed.has(activityId)) continue;
      const weight = weightById.get(activityId);
      if (weight === undefined) continue;
      claimed.add(activityId);
      weightPpm += weight;
      activityCount += 1;
    }

    cumulativeWeightPpm += weightPpm;
    const cumulativeWorkSatang = share(terms.contractSatang, cumulativeWeightPpm);
    const periodWorkSatang = cumulativeWorkSatang - previousCumulativeSatang;

    const retentionSatang =
      terms.retentionMethod === "each"
        ? share(periodWorkSatang, terms.retentionPpm)
        : isLast
          ? share(cumulativeWorkSatang, terms.retentionPpm)
          : 0n;

    // หักคืนเงินล่วงหน้าตามสัดส่วนของงานที่ทำได้ และหยุดเมื่อคืนครบยอดที่รับมาแล้ว
    const advanceRecoverySatang =
      terms.advanceRecovery === "none"
        ? 0n
        : (() => {
            const due = share(periodWorkSatang, terms.advancePpm);
            const recovered = due > advanceOutstanding ? advanceOutstanding : due;
            advanceOutstanding -= recovered;
            return recovered;
          })();

    const vatSatang = share(periodWorkSatang, terms.vatPpm);
    const withholdingSatang = share(periodWorkSatang, terms.withholdingPpm);

    const row: MilestoneRow = {
      milestoneId: milestone.id,
      ordinal: milestone.ordinal,
      title: milestone.title,
      activityCount,
      weightPpm,
      cumulativeWeightPpm,
      cumulativeWorkSatang,
      previousCumulativeSatang,
      periodWorkSatang,
      retentionSatang,
      advanceRecoverySatang,
      vatSatang,
      withholdingSatang,
      netSatang: periodWorkSatang + vatSatang - retentionSatang - advanceRecoverySatang - withholdingSatang
    };

    previousCumulativeSatang = cumulativeWorkSatang;
    return row;
  });

  const assignedWeightPpm = rows.reduce((sum, row) => sum + row.weightPpm, 0n);
  const totalWeightPpm = weights.reduce((sum, weight) => sum + weight.weightPpm, 0n);

  return {
    rows,
    unassignedWeightPpm: totalWeightPpm - assignedWeightPpm,
    advanceSatang,
    totalWorkSatang: rows.reduce((sum, row) => sum + row.periodWorkSatang, 0n),
    totalRetentionSatang: rows.reduce((sum, row) => sum + row.retentionSatang, 0n),
    totalNetSatang: rows.reduce((sum, row) => sum + row.netSatang, 0n)
  };
}

/** เปอร์เซ็นต์ที่หน้าจอใช้กรอกและแสดง แปลงเป็น ppm โดยไม่ผ่าน float */
export function percentToPpm(percent: string): bigint {
  const cleaned = percent.trim();
  if (!/^\d*(\.\d{0,4})?$/.test(cleaned) || cleaned === "" || cleaned === ".") return 0n;
  const [integerPart = "0", decimalPart = ""] = cleaned.split(".");
  const hundredThousandths = BigInt(integerPart || "0") * 10_000n + BigInt(decimalPart.padEnd(4, "0"));
  return hundredThousandths;
}
