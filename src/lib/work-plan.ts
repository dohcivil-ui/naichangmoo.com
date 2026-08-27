/**
 * แผนงานก่อสร้าง: น้ำหนักของงาน การกระจายลงช่วงเวลา และเส้นความก้าวหน้าสะสม
 *
 * กฎทุกข้อในไฟล์นี้ถอดมาจากหนังสือหลักสูตร วางแผนงานและบริหารโครงการด้วย Bar Chart และ S-Curve
 * (ยุทธนา เกาะกิ่ง, เอกสาร วสท.) — `km/การวางแผนงานก่อสร้าง/การบริหารโครงการด้วย-S-Curve-...pdf`
 * sha256 `6e8480c39db5b70f6934147fd0792863521ca989f7fb6c0f1f271daeec83be3e` หน้า 92, 94, 96
 * รายละเอียดและการตรวจเลขย้อนกลับอยู่ใน `docs/research/s-curve-rules-2026-08-25.md`
 *
 * สามข้อที่หนังสือบอกไว้ และเป็นเหตุผลของรูปร่างโมดูลนี้:
 *
 * หนึ่ง — น้ำหนักของกิจกรรมมาจาก **เงิน ไม่ใช่เวลา** งานเตรียมการ 30 วันกับงานฝ้าเพดาน 90 วัน
 * ได้น้ำหนักเท่ากันเพราะค่างานเท่ากัน `durationDays` จึงไม่มีผลต่อ `activityWeights` เลย
 *
 * สอง — กระจายน้ำหนักเท่ากันทุกช่องตลอดช่วงที่ทำงาน ไม่ถ่วงหัวท้าย **รูปตัว S เป็นผลลัพธ์
 * ของการที่กิจกรรมทับซ้อนกันช่วงกลางโครงการ ไม่ใช่สูตรโค้งที่ใส่เข้าไป** ห้ามเติมสูตรโค้ง
 * เพื่อให้กราฟสวย เพราะเส้นจะไม่ตรงกับแผนที่ผู้รับเหมาต้องทำจริง
 *
 * สาม — หนังสือเจอปัญหาเศษการปัดเองและเฉลยไว้: ค่าสะสมช่องรองสุดท้ายพิมพ์ไว้ 99.81%
 * แล้วช่องสุดท้ายเติมอีก 0.19% ให้ครบ 100.00% พอดี ที่นี่จึงคิดด้วยจำนวนเต็ม ppm ตลอด
 * และไม่ปัดระหว่างทางเลย — ผลรวมจึงเท่ากับ 1,000,000 ppm เป๊ะเสมอโดยไม่ต้องแก้ทีหลัง
 */

/** น้ำหนักงานเก็บเป็นส่วนในล้าน ทั้งแผนรวมกันได้ 1,000,000 พอดีเสมอ */
export const WEIGHT_SCALE = 1_000_000n;

/**
 * ช่องเวลาฐานคือครึ่งเดือน เพราะหนังสือใช้หัวคอลัมน์ 15 กับ 30 ตลอดเล่ม และงวดงานราชการไทย
 * ก็นับเป็นครึ่งเดือน ข้างในโมดูลนี้คิดเป็นวันเสมอ แล้วยุบเป็นช่องตอนคำนวณเส้น
 */
export const PERIOD_DAYS = 15;

export type PlanActivity = {
  id: string;
  /** เลขลำดับสองระดับอย่างที่ตารางแผนงานใช้ เช่น `1.1` */
  number: string;
  title: string;
  /** วันที่กิจกรรมเริ่ม นับจากวันเริ่มโครงการ */
  startOffsetDays: number;
  durationDays: number;
  costSatang: bigint;
};

export type ActivityWeight = {
  activityId: string;
  /** ส่วนในล้านของค่างานทั้งโครงการ */
  weightPpm: bigint;
  /** ช่องแรกและช่องสุดท้ายที่กิจกรรมนี้กินเวลา นับจาก 0 */
  firstPeriod: number;
  lastPeriod: number;
};

/** แถวหนึ่งของตารางกระจายน้ำหนัก: กิจกรรมหนึ่งตัว กับน้ำหนักที่ตกในแต่ละช่อง */
export type SpreadRow = {
  activityId: string;
  weightPpm: bigint;
  /** ยาวเท่ากับจำนวนช่องของทั้งแผน ช่องที่กิจกรรมไม่ได้ทำงานเป็น 0n */
  perPeriodPpm: bigint[];
};

export type PlanCurve = {
  periodCount: number;
  rows: SpreadRow[];
  /** น้ำหนักรวมที่ตกในแต่ละช่อง */
  perPeriodPpm: bigint[];
  /** ผลบวกสะสม ช่องสุดท้ายเท่ากับ WEIGHT_SCALE พอดี */
  cumulativePpm: bigint[];
};

export const sumCost = (activities: readonly PlanActivity[]): bigint =>
  activities.reduce((total, activity) => total + activity.costSatang, 0n);

/**
 * แบ่งจำนวนเต็มก้อนหนึ่งตามสัดส่วนที่กำหนด โดยผลรวมต้องเท่ากับก้อนตั้งต้นเป๊ะ
 *
 * หารลงก่อน แล้วแจกเศษที่เหลือทีละหน่วยให้ตัวที่เศษทศนิยมมากที่สุด (largest remainder)
 * เลือกวิธีนี้แทนการโยนเศษทั้งก้อนไปให้ตัวสุดท้าย เพราะเศษของงานสิบห้ารายการรวมกันแล้ว
 * อาจกลายเป็นหลักร้อยบาทที่ไปกองอยู่ในงานเดียว ซึ่งอ่านแล้วเหมือนคิดเลขผิด
 */
const shareByWeight = (total: bigint, weights: readonly bigint[]): bigint[] => {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  if (weightTotal <= 0n) return weights.map(() => 0n);

  const shares = weights.map((weight) => (total * weight) / weightTotal);
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: total * weight - shares[index]! * weightTotal
  }));

  let leftover = total - shares.reduce((sum, share) => sum + share, 0n);
  remainders.sort((a, b) => (b.remainder === a.remainder ? a.index - b.index : b.remainder > a.remainder ? 1 : -1));

  for (const entry of remainders) {
    if (leftover <= 0n) break;
    shares[entry.index] = shares[entry.index]! + 1n;
    leftover -= 1n;
  }

  return shares;
};

/** จำนวนช่องที่กิจกรรมหนึ่งกินเวลา อย่างน้อยหนึ่งช่องเสมอแม้ระยะเวลาจะสั้นกว่าครึ่งเดือน */
const periodSpan = (activity: PlanActivity) => {
  const firstPeriod = Math.floor(activity.startOffsetDays / PERIOD_DAYS);
  const endDay = activity.startOffsetDays + Math.max(activity.durationDays, 1);
  const lastPeriod = Math.max(firstPeriod, Math.ceil(endDay / PERIOD_DAYS) - 1);
  return { firstPeriod, lastPeriod };
};

/**
 * น้ำหนักของทุกกิจกรรม = สัดส่วนค่างานของกิจกรรมนั้นต่อค่างานรวม
 *
 * ผลรวมเท่ากับ WEIGHT_SCALE พอดีเสมอ แม้ค่างานจะหารไม่ลงตัว
 */
export function activityWeights(activities: readonly PlanActivity[]): ActivityWeight[] {
  const shares = shareByWeight(WEIGHT_SCALE, activities.map((activity) => activity.costSatang));
  return activities.map((activity, index) => ({
    activityId: activity.id,
    weightPpm: shares[index]!,
    ...periodSpan(activity)
  }));
}

/** จำนวนช่องของทั้งแผน กว้างพอที่จะครอบทั้งระยะเวลาโครงการและกิจกรรมที่ยาวเลยออกไป */
export function planPeriodCount(activities: readonly PlanActivity[], projectDurationDays: number): number {
  const byProject = Math.ceil(Math.max(projectDurationDays, 1) / PERIOD_DAYS);
  const byActivity = activities.reduce((widest, activity) => Math.max(widest, periodSpan(activity).lastPeriod + 1), 0);
  return Math.max(byProject, byActivity, 1);
}

/**
 * กระจายน้ำหนักของแต่ละกิจกรรมเท่า ๆ กันตลอดช่องที่ทำงาน แล้วบวกสะสม
 *
 * ตรวจกับตัวอย่างในหนังสือได้: งานผนัง PRECAST น้ำหนัก 10.77% ทำ 150 วัน = 10 ช่อง
 * ตกช่องละ 1.08% ตรงกับที่หนังสือพิมพ์ไว้
 */
export function buildPlanCurve(
  activities: readonly PlanActivity[],
  projectDurationDays: number
): PlanCurve {
  const periodCount = planPeriodCount(activities, projectDurationDays);
  const weights = activityWeights(activities);

  const rows = weights.map((weight) => {
    const span = weight.lastPeriod - weight.firstPeriod + 1;
    const slices = shareByWeight(weight.weightPpm, Array.from({ length: span }, () => 1n));
    const perPeriodPpm = Array.from({ length: periodCount }, () => 0n);
    for (let offset = 0; offset < span; offset += 1) {
      const period = weight.firstPeriod + offset;
      if (period < periodCount) perPeriodPpm[period] = perPeriodPpm[period]! + slices[offset]!;
    }
    return { activityId: weight.activityId, weightPpm: weight.weightPpm, perPeriodPpm };
  });

  const perPeriodPpm = Array.from({ length: periodCount }, (_unused, period) =>
    rows.reduce((total, row) => total + row.perPeriodPpm[period]!, 0n)
  );

  let running = 0n;
  const cumulativePpm = perPeriodPpm.map((amount) => {
    running += amount;
    return running;
  });

  return { periodCount, rows, perPeriodPpm, cumulativePpm };
}

/**
 * ppm เป็นข้อความเปอร์เซ็นต์ทศนิยมสองตำแหน่ง อย่างที่ตารางแผนงานพิมพ์
 *
 * ปัดที่ชั้นแสดงผลเท่านั้น ค่าที่เอาไปคำนวณต่อยังเป็น ppm เต็มเสมอ — นี่คือจุดที่หนังสือ
 * ปัดแล้วได้ 99.81% ในช่องรองสุดท้าย ถ้าเราปัดตั้งแต่ชั้นคำนวณก็จะพลาดแบบเดียวกัน
 */
export function formatPercent(ppm: bigint): string {
  const hundredths = (ppm + 50n) / 100n;
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, "0")}`;
}

/**
 * เกลี่ยน้ำหนักที่ผู้ช่วยเสนอมาให้รวมได้ 1,000,000 ppm พอดี โดยรักษาสัดส่วนเดิม
 *
 * อยู่ที่นี่ไม่ใช่ในไฟล์ของผู้ช่วย เพราะนี่คือ **ด่านสุดท้ายก่อนตัวเลขของแบบจำลองกลายเป็นเงิน**
 * และเป็นสิ่งเดียวที่ทำให้ประโยค "เงินทุกบาทระบบเป็นคนคำนวณ ไม่ใช่ AI" เป็นจริงในทางกลไก
 * ไม่ใช่แค่ในคำอธิบาย ทุกแอปที่มีผู้ช่วยเสนอสัดส่วนต้องผ่านฟังก์ชันนี้ตัวเดียวกัน
 *
 * ไม่ปฏิเสธคำตอบที่รวมไม่ครบหรือเกิน เพราะร่างที่ใกล้เคียงแล้วให้คนแก้ต่อ มีประโยชน์กว่า
 * ข้อความว่าล้มเหลว ค่าที่ติดลบ ไม่ใช่จำนวน หรือเป็นศูนย์ ถือเป็นศูนย์ และถ้าทั้งชุดเป็นศูนย์
 * จะแบ่งเท่ากันทุกรายการแทนการหารด้วยศูนย์
 */
export function normaliseWeights(weights: readonly number[]): bigint[] {
  const positive = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? BigInt(Math.round(weight)) : 0n));
  const total = positive.reduce((sum, weight) => sum + weight, 0n);
  if (positive.length === 0) return [];
  if (total === 0n) {
    const even = WEIGHT_SCALE / BigInt(positive.length);
    const shares = positive.map(() => even);
    let leftover = WEIGHT_SCALE - even * BigInt(positive.length);
    for (let index = 0; leftover > 0n; index = (index + 1) % shares.length) {
      shares[index] = shares[index]! + 1n;
      leftover -= 1n;
    }
    return shares;
  }

  const shares = positive.map((weight) => (weight * WEIGHT_SCALE) / total);
  let leftover = WEIGHT_SCALE - shares.reduce((sum, share) => sum + share, 0n);
  for (let index = 0; leftover > 0n; index = (index + 1) % shares.length) {
    shares[index] = shares[index]! + 1n;
    leftover -= 1n;
  }
  return shares;
}
