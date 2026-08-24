import dataset from "@/data/escalation-k/cabinet-w109-be2532.json";

/**
 * ค่า K — เงินชดเชยค่างานก่อสร้างตามสัญญาแบบปรับราคาได้
 *
 * ตัวเลขที่โมดูลนี้คืนออกไปถูกนำไปใส่ในเอกสารที่ผูกกับสัญญาราชการ ผิดแล้วมีคนต้องรับผิดชอบ
 * จึงเดินตามแนวเดียวกับ `factor-f.ts` คือ ปฏิเสธพร้อมเหตุผลเมื่อข้อมูลไม่พอ ไม่มีการเดาแทน
 *
 * สามข้อที่ ว 109 กำหนดไว้เองและถ้าไม่อ่านจะเขียนผิดแบบดูน่าเชื่อ
 *
 *   1. ทศนิยม 3 ตำแหน่ง **ตัดทิ้ง ไม่ปัดเศษ** ทุกขั้นตอน
 *   2. ต้องทำ "เลขสัมพันธ์" (It/Io) ให้เป็นผลสำเร็จก่อน แล้วจึงคูณสัมประสิทธิ์ สลับลำดับได้คนละคำตอบ
 *   3. เกณฑ์ส่วนต่างเป็น "ส่วนที่ไม่คิดให้" ไม่ใช่แค่ด่านผ่าน เงินจึงคิดจาก K − เกณฑ์ ไม่ใช่ K − 1
 *
 * ข้อ 1 บวกกับทศนิยมลอยตัวเป็นกับดักที่วัดได้จริง: `Math.trunc((1.045 - 0.04) * 1000)` ให้ 1004
 * เพราะ `1.045 - 0.04` ในเลขทศนิยมลอยตัวคือ 1.0049999999999999 การตัดทิ้งจึงกินไปทั้งหลัก
 * ทุกอย่างในไฟล์นี้จึงเดินบน **จำนวนเต็มหน่วยหนึ่งในพัน** และเงินเดินบน satang แบบ bigint
 */

export type EscalationVariable =
  | "I" | "C" | "M" | "S" | "G" | "A" | "E" | "F" | "AC" | "PVC" | "PE" | "GIP" | "W";

/** ค่าที่ถูกตัดทศนิยมไว้ที่ 3 ตำแหน่งแล้ว เก็บเป็นจำนวนเต็ม เช่น 1.045 คือ 1045 */
export type Milli = number;

export type EscalationGroup = { id: string; no: number; name: string; reviewedBy: string | null };

export type EscalationFormula = {
  id: string;
  groupId: string;
  page: number;
  name: string;
  scope?: string;
  excludes?: string;
  restrictedTo?: string;
  noFormula?: boolean;
  rule?: string;
  base?: number;
  terms?: Partial<Record<EscalationVariable, number>>;
};

export type ThresholdRule = {
  id: string;
  label: string;
  thresholdMilli: Milli;
  effectiveFromBE: string | null;
  effectiveToBE: string | null;
  sourceRef: string;
  verified: boolean;
};

export type BaseMonthRule = {
  id: string;
  label: string;
  field: string;
  effectiveFromBE: string | null;
  effectiveToBE: string | null;
  sourceRef: string;
  verified: boolean;
};

const groups = dataset.groups as EscalationGroup[];
const formulas = dataset.formulas as EscalationFormula[];
const thresholdRules = dataset.rulebook.thresholds as ThresholdRule[];
const baseMonthRules = dataset.rulebook.baseMonth as BaseMonthRule[];

export const escalationSource = dataset.source;
export const escalationMethod = dataset.method;
export const escalationVariables = dataset.variables as Record<EscalationVariable, { label: string; note: string; indexId: string | null }>;
export const escalationGroups = groups;
export const escalationFormulas = formulas;

/* ------------------------------------------------------------------ */
/* เลขคณิตหน่วยหนึ่งในพัน                                              */
/* ------------------------------------------------------------------ */

/**
 * ตัดทศนิยมทิ้งที่ตำแหน่งที่ 3 ตามข้อ ค.3 ของ ว 109
 *
 * ปัดเศษที่ตำแหน่งที่ 9 ก่อนตัด เพื่อล้าง noise ของทศนิยมลอยตัวออกก่อน มิฉะนั้นค่าที่ควรเป็น
 * 1.030 พอดีอาจมาถึงในรูป 1029.9999999998 แล้วถูกตัดเหลือ 1.029 ซึ่งผิดไปทั้งหลัก
 */
export function toMilli(value: number): Milli {
  return Math.trunc(Number((value * 1000).toFixed(9)));
}

export function fromMilli(value: Milli): number {
  return value / 1000;
}

/** แสดงผลที่ 3 ตำแหน่งเสมอ เพราะเอกสารกำหนดจำนวนตำแหน่งไว้ ไม่ใช่แค่ความสวยงาม */
export function formatMilli(value: Milli): string {
  return (value / 1000).toFixed(3);
}

/**
 * เลขสัมพันธ์ของดัชนีหนึ่งคู่ ตัดทิ้งที่ 3 ตำแหน่ง
 *
 * ทำบนจำนวนเต็มล้วน โดยยกดัชนีทั้งสองขึ้นหนึ่งพันเท่าก่อนหาร ผลลัพธ์จึงไม่ขึ้นกับว่าดัชนี
 * ต้นทางมีทศนิยมกี่ตำแหน่ง และไม่มีโอกาสที่ noise ของทศนิยมลอยตัวจะเปลี่ยนหลักสุดท้าย
 */
export function ratioMilli(current: number, base: number): Milli {
  const c = Math.round(current * 1000);
  const b = Math.round(base * 1000);
  return Math.trunc((c * 1000) / b);
}

/**
 * ค่าของพจน์หนึ่ง = สัมประสิทธิ์ x เลขสัมพันธ์ที่ทำเสร็จแล้ว ตัดทิ้งที่ 3 ตำแหน่ง
 *
 * แยกออกมาเป็นฟังก์ชันของตัวเองเพราะลำดับ "หารก่อน คูณทีหลัง" เป็นข้อกำหนดของเอกสาร
 * ไม่ใช่รายละเอียดการเขียนโปรแกรม จึงต้องมีเทสต์จับมันไว้ตรง ๆ
 */
export function termMilli(coefficient: number, ratio: Milli): Milli {
  return Math.trunc((toMilli(coefficient) * ratio) / 1000);
}

/* ------------------------------------------------------------------ */
/* การเลือกหลักเกณฑ์ตามวันที่                                          */
/* ------------------------------------------------------------------ */

/** วันที่แบบพุทธศักราชรูป YYYY-MM-DD เรียงตามลำดับพจนานุกรมได้ตรงกับลำดับเวลา */
export type BuddhistDate = string;

const withinWindow = (date: BuddhistDate, from: string | null, to: string | null) =>
  (from === null || date >= from) && (to === null || date <= to);

/**
 * หลักเกณฑ์ที่ 1 ของมาตรการชั่วคราว — ตัดสินที่ **วันที่ส่งมอบงวดงาน**
 *
 * กฎที่มีช่วงบังคับใช้ชนะกฎที่ไม่มี เพราะกฎไม่มีช่วงคือกฎตั้งต้นที่ใช้เมื่อไม่มีอะไรมาแทน
 */
export function resolveThresholdRule(periodDeliveredOn: BuddhistDate): ThresholdRule {
  const dated = thresholdRules.find(
    (rule) => rule.effectiveFromBE !== null && withinWindow(periodDeliveredOn, rule.effectiveFromBE, rule.effectiveToBE)
  );
  if (dated) return dated;
  const fallback = thresholdRules.find((rule) => rule.effectiveFromBE === null);
  if (!fallback) throw new Error("ชุดข้อมูลไม่มีหลักเกณฑ์ตั้งต้นของเกณฑ์ส่วนต่าง");
  return fallback;
}

/**
 * หลักเกณฑ์ที่ 2 ของมาตรการชั่วคราว — ตัดสินที่ **วันที่ลงนามในสัญญา**
 *
 * คนละวันกับข้อบน และนี่คือจุดที่พลาดกันมากที่สุด สัญญาเดียวเข้าข้อหนึ่งแต่ไม่เข้าอีกข้อได้
 */
export function resolveBaseMonthRule(contractSignedOn: BuddhistDate): BaseMonthRule {
  const dated = baseMonthRules.find(
    (rule) => rule.effectiveFromBE !== null && withinWindow(contractSignedOn, rule.effectiveFromBE, rule.effectiveToBE)
  );
  if (dated) return dated;
  const fallback = baseMonthRules.find((rule) => rule.effectiveFromBE === null);
  if (!fallback) throw new Error("ชุดข้อมูลไม่มีหลักเกณฑ์ตั้งต้นของเดือนฐาน");
  return fallback;
}

/* ------------------------------------------------------------------ */
/* การคำนวณค่า K                                                       */
/* ------------------------------------------------------------------ */

export type IndexReading = { base: number; current: number };

export type EscalationTerm = {
  variable: EscalationVariable | null;
  coefficientMilli: Milli;
  ratioMilli: Milli | null;
  valueMilli: Milli;
};

export type EscalationRefusal =
  | "formula_not_in_dataset"
  | "formula_has_no_k"
  | "group_not_reviewed"
  | "index_reading_missing"
  | "index_reading_invalid";

export type ComputeKResult =
  | { ok: true; formula: EscalationFormula; terms: EscalationTerm[]; kMilli: Milli }
  | { ok: false; reason: EscalationRefusal; detail: string };

export function findFormula(id: string): EscalationFormula | undefined {
  return formulas.find((item) => item.id === id);
}

export function findGroup(id: string): EscalationGroup | undefined {
  return groups.find((item) => item.id === id);
}

/**
 * คำนวณค่า K ของสูตรหนึ่งจากดัชนีที่ให้มา
 *
 * ปฏิเสธเมื่อหมวดยังไม่มีผู้รับรอง เพราะการถอดสูตรจากเอกสารสแกนเป็นงานที่ผิดได้ และตัวเลขที่
 * ออกจากสูตรที่ยังไม่มีใครตรวจ จะดูเหมือนตัวเลขที่ตรวจแล้วทุกประการเมื่ออยู่ในเอกสาร
 */
export function computeK(formulaId: string, readings: Partial<Record<EscalationVariable, IndexReading>>): ComputeKResult {
  const formula = findFormula(formulaId);
  if (!formula) {
    return { ok: false, reason: "formula_not_in_dataset", detail: `ไม่มีสูตร ${formulaId} ในชุดข้อมูล ${escalationSource.documentNumber}` };
  }
  if (formula.noFormula || formula.base === undefined || !formula.terms) {
    return {
      ok: false,
      reason: "formula_has_no_k",
      detail: `${formula.id} ${formula.name} ไม่มีสูตร K ในเอกสาร ${formula.rule ?? ""}`.trim()
    };
  }

  const group = findGroup(formula.groupId);
  if (!group || group.reviewedBy === null) {
    return {
      ok: false,
      reason: "group_not_reviewed",
      detail: `หมวด ${group?.name ?? formula.groupId} ยังไม่มีผู้รับรองการถอดสูตรเทียบเอกสารต้นฉบับ จึงยังใช้คำนวณไม่ได้`
    };
  }

  const terms: EscalationTerm[] = [
    { variable: null, coefficientMilli: toMilli(formula.base), ratioMilli: null, valueMilli: toMilli(formula.base) }
  ];
  let kMilli = toMilli(formula.base);

  for (const [key, coefficient] of Object.entries(formula.terms)) {
    const variable = key as EscalationVariable;
    const reading = readings[variable];
    if (!reading) {
      return {
        ok: false,
        reason: "index_reading_missing",
        detail: `สูตร ${formula.id} ต้องใช้ ${variable} (${escalationVariables[variable].label}) แต่ไม่ได้รับค่าดัชนีของตัวแปรนี้`
      };
    }
    if (!(reading.base > 0) || !(reading.current > 0)) {
      return {
        ok: false,
        reason: "index_reading_invalid",
        detail: `ดัชนีของ ${variable} ต้องมากกว่าศูนย์ทั้งเดือนฐานและเดือนส่งมอบ ได้รับ ${reading.base} และ ${reading.current}`
      };
    }

    // ทำเลขสัมพันธ์ให้เป็นผลสำเร็จก่อน แล้วจึงคูณสัมประสิทธิ์ — ลำดับนี้เอกสารกำหนดไว้เอง
    const ratio = ratioMilli(reading.current, reading.base);
    const value = termMilli(coefficient, ratio);
    terms.push({ variable, coefficientMilli: toMilli(coefficient), ratioMilli: ratio, valueMilli: value });
    kMilli += value;
  }

  return { ok: true, formula, terms, kMilli };
}

/* ------------------------------------------------------------------ */
/* เงินชดเชย                                                           */
/* ------------------------------------------------------------------ */

export type SettlementAction = "add" | "recover" | "none";

export type Settlement = {
  rule: ThresholdRule;
  action: SettlementAction;
  driftMilli: Milli;
  /** ค่า K หลังหักเกณฑ์แล้ว คือตัวที่นำไปคูณค่างาน */
  appliedKMilli: Milli;
  paySatang: bigint;
  deltaSatang: bigint;
};

/**
 * คิดเงินของงวดหนึ่ง
 *
 * `P = Po x K` โดย K ในสมการนี้คือ K ที่หักเกณฑ์แล้ว ไม่ใช่ K ดิบ เพราะเอกสารเขียนว่า
 * "นำเฉพาะส่วนที่เกิน 4% มาคำนวณ (โดยไม่คิด 4% แรกให้)" คิดจาก K − 1 จะได้เงินเกินความจริงทุกงวด
 *
 * เงินเดินบน satang แบบ bigint ตลอด และตัดเศษที่ต่ำกว่าหนึ่งสตางค์ทิ้ง เอกสารไม่ได้กำหนด
 * วิธีปัดเศษของเงินไว้ จึงเลือกตัดทิ้งให้เป็นแนวเดียวกับที่เอกสารกำหนดไว้สำหรับค่า K
 */
export function settlePeriod(kMilli: Milli, amountSatang: bigint, periodDeliveredOn: BuddhistDate): Settlement {
  const rule = resolveThresholdRule(periodDeliveredOn);
  const driftMilli = kMilli - 1000;

  if (Math.abs(driftMilli) <= rule.thresholdMilli) {
    return { rule, action: "none", driftMilli, appliedKMilli: 1000, paySatang: amountSatang, deltaSatang: 0n };
  }

  const appliedKMilli = driftMilli > 0 ? kMilli - rule.thresholdMilli : kMilli + rule.thresholdMilli;
  const paySatang = (amountSatang * BigInt(appliedKMilli)) / 1000n;

  return {
    rule,
    action: driftMilli > 0 ? "add" : "recover",
    driftMilli,
    appliedKMilli,
    paySatang,
    deltaSatang: paySatang - amountSatang
  };
}

/**
 * ผลที่จะได้ถ้าใช้อีกหลักเกณฑ์หนึ่ง — มีไว้ให้หน้าจอบอกผู้ใช้ได้ว่าเลือกผิดแล้วต่างเท่าไร
 * ไม่ได้มีไว้ให้เลือกใช้ ตัวที่ถูกต้องคือตัวที่ `settlePeriod` เลือกจากวันที่ส่งมอบ
 */
export function settlementUnderOtherRule(kMilli: Milli, amountSatang: bigint, periodDeliveredOn: BuddhistDate) {
  const applied = resolveThresholdRule(periodDeliveredOn);
  const other = thresholdRules.find((rule) => rule.id !== applied.id);
  if (!other) return null;

  const driftMilli = kMilli - 1000;
  if (Math.abs(driftMilli) <= other.thresholdMilli) {
    return { rule: other, deltaSatang: 0n };
  }
  const appliedKMilli = driftMilli > 0 ? kMilli - other.thresholdMilli : kMilli + other.thresholdMilli;
  return { rule: other, deltaSatang: (amountSatang * BigInt(appliedKMilli)) / 1000n - amountSatang };
}

/**
 * สิทธิ์เรียกร้องเงินเพิ่มมีอายุ 90 วันนับจากวันส่งมอบงานงวดสุดท้าย
 * รับเป็นจำนวนวันที่ผ่านไปแล้ว เพราะการแปลงวันที่พุทธศักราชเป็นวันปฏิทินเป็นคนละเรื่องกับการคำนวณ
 */
export function claimWindowState(daysSinceFinalDelivery: number): "open" | "expired" {
  return daysSinceFinalDelivery <= escalationMethod.claimWindowDays ? "open" : "expired";
}
