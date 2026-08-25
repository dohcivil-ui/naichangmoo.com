import { WEIGHT_SCALE } from "./work-plan";
import type { MilestoneRow } from "./payment-milestone";

/**
 * บันทึกจริงต่องวด: สามยอด สามวัน และวันตัดข้อมูล
 *
 * โมดูลนี้เปลี่ยนเส้นเงินบนกราฟจาก "แผน" เป็น "สิ่งที่เกิดขึ้นจริง" กฎทุกข้อมาจากการเข้าไปใช้
 * ระบบที่ผู้รับเหมาไทยใช้จริงเมื่อ 2026-08-26 บันทึกไว้ใน
 * `docs/research/changkid-easy-planning-hands-on-2026-08-26.md`
 *
 * สี่ข้อที่กำหนดรูปร่างของโมดูลนี้ และห้ามพัง:
 *
 * หนึ่ง — **สามยอดเป็นสามเหตุการณ์อิสระ แต่ละอันมีวันของตัวเอง** ยื่นขอเบิก · ที่ปรึกษารับรอง ·
 * เงินเข้าบัญชี ไม่ใช่ยอดเดียวที่เปลี่ยนสถานะไปเรื่อย ๆ เพราะยอดที่ยื่นกับยอดที่รับรองต่างกันได้จริง
 * และมักต่างกัน ("ขอ 21 ล้าน รับรอง 19 ล้าน ก็กรอกตามจริง" เป็นคำที่ระบบที่เราไปดูเขียนไว้เอง)
 *
 * สอง — **ตัดที่วันตัดข้อมูลทีละเหตุการณ์ ไม่ใช่ตัดทั้งงวด** งวดเดียวอาจมียอดขอเบิกขึ้นกราฟแล้ว
 * ขณะที่เงินเข้ายังไม่ขึ้น เพราะเงินเข้าลงวันที่หลังวันตัดข้อมูล ข้อนี้ตรวจกับของจริงมาแล้ว:
 * งวดที่มีเงินเข้า 30 ส.ค. เมื่อวันตัดข้อมูลคือ 25 ส.ค. เส้นเงินรับจริงต้องเป็นศูนย์
 * ขณะที่ยอดขอเบิก 19 ส.ค. และยอดรับรอง 23 ส.ค. ขึ้นเต็มจำนวน
 *
 * สาม — **ยอดขอเบิกและยอดรับรองเป็นมูลค่างานก่อนหัก ส่วนเงินเข้าจริงเป็นยอดสุทธิ**
 * กรรมการตรวจการจ้างรับรองเนื้องาน ไม่ได้รับรองยอดสุทธิ ส่วนที่เข้าบัญชีคือยอดหลังหักแล้ว
 * ระบบที่เราไปดูใช้ฟอร์มเดียวปนสองระดับโดยไม่มีป้าย จนข้อมูลตัวอย่างของเขาเองขัดกับ
 * ปุ่มเติมอัตโนมัติของเขาเอง — เราจึงแยกให้ชัดที่ชนิดข้อมูล ไม่ใช่แค่ที่ป้ายบนหน้าจอ
 *
 * สี่ — **เงินเป็นจำนวนเต็มสตางค์ตลอด** ไม่มี float แม้แต่จุดเดียว
 */

/** วันที่แบบ `YYYY-MM-DD` ตามที่ช่องกรอกวันของเบราว์เซอร์คืนมา */
export type IsoDate = string;

/** เหตุการณ์เงินหนึ่งครั้ง: ยอดกับวันต้องมาคู่กันเสมอ ยอดที่ไม่มีวันเอาไปวางบนแกนเวลาไม่ได้ */
export type MoneyEvent = {
  satang: bigint;
  date: IsoDate;
};

/**
 * บันทึกจริงของงวดหนึ่ง ทุกช่องเป็นทางเลือก เพราะงวดที่ยังไม่ถึงคิวย่อมไม่มีอะไรเลย
 *
 * `requested` และ `certified` เป็น **มูลค่างานก่อนหัก** ส่วน `received` เป็น **ยอดสุทธิที่เข้าบัญชี**
 */
export type MilestoneActual = {
  milestoneId: string;
  /** ยอดที่ยื่นขอเบิก เป็นมูลค่างานก่อนหัก */
  requested?: MoneyEvent;
  /** ยอดที่ที่ปรึกษาหรือกรรมการตรวจการจ้างรับรอง เป็นมูลค่างานก่อนหัก */
  certified?: MoneyEvent;
  /** เงินที่เข้าบัญชีจริง เป็นยอดสุทธิหลังหักทุกรายการแล้ว */
  received?: MoneyEvent;
  note?: string;
  /** อ้างอิงเอกสารที่ทำให้งวดนี้เปลี่ยน เช่น สัญญาแก้ไขเพิ่มเติมครั้งที่ 2 */
  reference?: string;
};

/**
 * สถานะของงวด อนุมานจากข้อมูลที่กรอก ไม่ใช่ช่องให้เลือกเอง
 *
 * สถานะที่เก็บแยกจากข้อมูลคือสถานะที่จะเพี้ยนวันหนึ่งแน่นอน เพราะผู้ใช้กรอกเงินเข้าแล้วลืมเปลี่ยนป้าย
 * ให้สถานะเป็นผลลัพธ์ของความจริง แล้วมันจะไม่มีวันขัดกับตัวเลขบนแถวเดียวกัน
 */
export type MilestoneStage = "planned" | "requested" | "certified" | "paid";

export type ActualStatus = {
  milestoneId: string;
  stage: MilestoneStage;
  /** จำนวนวันนับจากวันที่รับรอง ถึงวันตัดข้อมูล สำหรับงวดที่รับรองแล้วแต่เงินยังไม่เข้า */
  awaitingPaymentDays: number | null;
  /** ยอดที่รับรองแล้วแต่ยังไม่ได้รับเป็นเงิน คิดเป็นมูลค่างานก่อนหัก */
  certifiedNotPaidSatang: bigint;
  /** ยอดที่ยื่นไปแล้วแต่ยังไม่มีใครรับรอง */
  requestedNotCertifiedSatang: bigint;
};

export const stageOf = (actual: MilestoneActual | undefined): MilestoneStage => {
  if (actual?.received) return "paid";
  if (actual?.certified) return "certified";
  if (actual?.requested) return "requested";
  return "planned";
};

/** จำนวนวันระหว่างสองวัน คิดแบบวันปฏิทิน คืนค่าลบเมื่อวันหลังมาก่อนวันแรก */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** เหตุการณ์นี้เกิดขึ้นแล้ว ณ วันตัดข้อมูลหรือยัง — วันเดียวกับวันตัดข้อมูลถือว่าเกิดแล้ว */
export const hasHappened = (event: MoneyEvent | undefined, dataDate: IsoDate): boolean =>
  event !== undefined && event.date !== "" && daysBetween(event.date, dataDate) >= 0;

/**
 * วันตัดข้อมูลที่ควรใช้เป็นค่าตั้งต้น คือวันล่าสุดในบรรดาบันทึกทั้งหมด
 *
 * ตอบโจทย์เกือบทุกครั้งโดยผู้ใช้ไม่ต้องกรอก แต่ผู้ใช้ต้องแก้ทับได้เสมอ เพราะเวลาทำรายงาน
 * ส่งกรรมการ ผู้ใช้ต้องการตรึงไว้ที่ "ณ วันที่ 31 ก.ค." แม้จะมีบันทึกของเดือนถัดไปแล้วก็ตาม
 */
export function latestRecordedDate(actuals: readonly MilestoneActual[]): IsoDate | null {
  let latest: IsoDate | null = null;
  for (const actual of actuals) {
    for (const event of [actual.requested, actual.certified, actual.received]) {
      if (!event || !event.date) continue;
      if (latest === null || daysBetween(latest, event.date) > 0) latest = event.date;
    }
  }
  return latest;
}

/** บันทึกที่ลงวันที่หลังวันตัดข้อมูล ต้องนับให้ได้เพื่อบอกผู้ใช้ว่าซ่อนไปกี่รายการ */
export function countHiddenEvents(actuals: readonly MilestoneActual[], dataDate: IsoDate): number {
  let hidden = 0;
  for (const actual of actuals) {
    for (const event of [actual.requested, actual.certified, actual.received]) {
      if (event && event.date && !hasHappened(event, dataDate)) hidden += 1;
    }
  }
  return hidden;
}

export type ActualPoint = {
  date: IsoDate;
  /** ยอดสะสมถึงเหตุการณ์นี้ */
  cumulativeSatang: bigint;
};

export type ActualSeries = {
  requested: ActualPoint[];
  certified: ActualPoint[];
  received: ActualPoint[];
};

/**
 * สามเส้นเงินจากบันทึกจริง เรียงตามวันของเหตุการณ์ และตัดที่วันตัดข้อมูล
 *
 * เรียงตามวันที่ของเหตุการณ์ ไม่ใช่ตามลำดับงวด เพราะงวดที่ 5 อาจได้เงินก่อนงวดที่ 4
 * ซึ่งเกิดขึ้นจริงเมื่อเอกสารงวดหนึ่งติดปัญหา
 */
export function buildActualSeries(
  actuals: readonly MilestoneActual[],
  dataDate: IsoDate
): ActualSeries {
  const collect = (pick: (actual: MilestoneActual) => MoneyEvent | undefined): ActualPoint[] => {
    const events = actuals
      .map(pick)
      .filter((event): event is MoneyEvent => hasHappened(event, dataDate))
      .sort((a, b) => daysBetween(b.date, a.date));

    let running = 0n;
    return events.map((event) => {
      running += event.satang;
      return { date: event.date, cumulativeSatang: running };
    });
  };

  return {
    requested: collect((actual) => actual.requested),
    certified: collect((actual) => actual.certified),
    received: collect((actual) => actual.received)
  };
}

/** ยอดสะสมล่าสุดของเส้นหนึ่ง ณ วันตัดข้อมูล */
export const latestOf = (points: readonly ActualPoint[]): bigint =>
  points.length === 0 ? 0n : points[points.length - 1]!.cumulativeSatang;

export type CashPosition = {
  requestedSatang: bigint;
  certifiedSatang: bigint;
  receivedSatang: bigint;
  /** รับรองแล้วแต่ยังไม่ได้เป็นเงิน — ตัวเลขที่ผู้รับเหมาต้องดูทุกเดือน */
  certifiedNotPaidSatang: bigint;
  /** ยื่นไปแล้วแต่ยังไม่มีใครรับรอง */
  requestedNotCertifiedSatang: bigint;
};

export function cashPosition(series: ActualSeries): CashPosition {
  const requestedSatang = latestOf(series.requested);
  const certifiedSatang = latestOf(series.certified);
  const receivedSatang = latestOf(series.received);
  return {
    requestedSatang,
    certifiedSatang,
    receivedSatang,
    certifiedNotPaidSatang: certifiedSatang - receivedSatang,
    requestedNotCertifiedSatang: requestedSatang - certifiedSatang
  };
}

/**
 * ยอดสุทธิที่ควรได้ ถ้าที่ปรึกษารับรองมาเท่านี้ — ใช้เทียบกับเงินที่เข้าจริงว่าถูกหักเกินหรือเปล่า
 *
 * คิดตามสัดส่วนของยอดที่รับรอง เทียบกับมูลค่างานของงวดนั้นตามแผน แล้วเอาสัดส่วนเดียวกัน
 * ไปคิดกับทุกบรรทัดการหักที่ระบบคำนวณไว้แล้ว เพื่อไม่ให้ต้องคำนวณสายการหักซ้ำสองที่
 *
 * ระบบที่เราไปดูเก็บตัวเลขครบทั้งสามยอดแต่ไม่เคยเอามาเทียบกันเลย นี่คือช่องที่เรานำได้ทันที
 */
export function expectedNetForCertified(row: MilestoneRow, certifiedSatang: bigint): bigint {
  if (row.periodWorkSatang <= 0n) return 0n;
  const scaled = (value: bigint) => (value * certifiedSatang) / row.periodWorkSatang;
  return (
    certifiedSatang +
    scaled(row.vatSatang) -
    scaled(row.retentionSatang) -
    scaled(row.advanceRecoverySatang) -
    scaled(row.withholdingSatang)
  );
}

export type DeductionCheck = {
  milestoneId: string;
  expectedNetSatang: bigint;
  receivedSatang: bigint;
  /** บวกคือได้น้อยกว่าที่ควรได้ ลบคือได้มากกว่า */
  shortfallSatang: bigint;
};

/**
 * เทียบยอดสุทธิที่ควรได้กับเงินที่เข้าจริง แล้วคืนเฉพาะงวดที่ต่างกันเกินเกณฑ์
 *
 * เกณฑ์เป็นสตางค์ เพราะการปัดเศษของฝ่ายการเงินผู้ว่าจ้างต่างจากเราได้ไม่กี่สตางค์
 * แต่ถ้าต่างกันเป็นบาทขึ้นไปแปลว่ามีบรรทัดการหักที่เราไม่รู้ และผู้ใช้ต้องไปถาม
 */
export function checkDeductions(
  rows: readonly MilestoneRow[],
  actuals: readonly MilestoneActual[],
  dataDate: IsoDate,
  toleranceSatang = 100n
): DeductionCheck[] {
  const byId = new Map(actuals.map((actual) => [actual.milestoneId, actual]));
  const out: DeductionCheck[] = [];

  for (const row of rows) {
    const actual = byId.get(row.milestoneId);
    if (!actual?.certified || !hasHappened(actual.received, dataDate)) continue;
    if (!hasHappened(actual.certified, dataDate)) continue;

    const expectedNetSatang = expectedNetForCertified(row, actual.certified.satang);
    const receivedSatang = actual.received!.satang;
    const shortfallSatang = expectedNetSatang - receivedSatang;
    if (shortfallSatang > toleranceSatang || shortfallSatang < -toleranceSatang) {
      out.push({ milestoneId: row.milestoneId, expectedNetSatang, receivedSatang, shortfallSatang });
    }
  }

  return out;
}

/** สถานะรายงวด ณ วันตัดข้อมูล สำหรับแสดงบนตารางและให้ผู้ช่วยเอาไปเรียบเรียง */
export function milestoneStatuses(
  actuals: readonly MilestoneActual[],
  dataDate: IsoDate
): ActualStatus[] {
  return actuals.map((actual) => {
    const requested = hasHappened(actual.requested, dataDate) ? actual.requested! : undefined;
    const certified = hasHappened(actual.certified, dataDate) ? actual.certified! : undefined;
    const received = hasHappened(actual.received, dataDate) ? actual.received! : undefined;

    const stage: MilestoneStage = received ? "paid" : certified ? "certified" : requested ? "requested" : "planned";

    return {
      milestoneId: actual.milestoneId,
      stage,
      awaitingPaymentDays: certified && !received ? daysBetween(certified.date, dataDate) : null,
      certifiedNotPaidSatang: certified && !received ? certified.satang : 0n,
      requestedNotCertifiedSatang: requested && !certified ? requested.satang : 0n
    };
  });
}

/** เปอร์เซ็นต์ของมูลค่าสัญญาที่รับรองแล้ว เป็น ppm เพื่อไม่ให้ผ่าน float */
export const certifiedPpm = (certifiedSatang: bigint, contractSatang: bigint): bigint =>
  contractSatang <= 0n ? 0n : (certifiedSatang * WEIGHT_SCALE) / contractSatang;
