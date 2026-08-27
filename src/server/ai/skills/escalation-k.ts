import {
  escalationMethod,
  escalationSource,
  resolveBaseMonthRule,
  resolveThresholdRule,
  type BaseMonthRule,
  type RuleDocument,
  type ThresholdRule
} from "@/lib/escalation-k";
import type { Citation } from "@/server/ai/assistant-contract";
import {
  ESCALATION_EXPLAIN_SYSTEM,
  ESCALATION_PREFLIGHT_SYSTEM,
  buildEscalationExplainTask,
  buildEscalationPreflightTask,
  escalationExplainSchema,
  escalationPreflightSchema,
  type EscalationExplain,
  type EscalationPreflight
} from "@/server/ai/escalation-k-prompt";
import { defineSkill, type AssistantSkill } from "@/server/ai/skill-registry";

/**
 * ผู้ช่วยค่า K — อะแดปเตอร์ตัวที่สองที่ทำให้รอยต่อเป็นของจริง
 *
 * "หนึ่ง adapter คือรอยต่อสมมติ สอง adapter คือรอยต่อจริง" ตัวนี้ต่างจากผู้ช่วยแผนงาน
 * ในสามเรื่องที่สำคัญ และนั่นคือเหตุผลที่เลือกมันเป็นตัวที่สอง ไม่ใช่ตัวที่ใกล้เคียงกัน
 *
 *   1. **อ้างชุดข้อมูลจริง** ในขณะที่ผู้ช่วยแผนงานไม่อ้างเอกสารฉบับใดเลย — รอยต่อจึงถูกบังคับ
 *      ให้รองรับที่มาของข้อมูลตั้งแต่วันแรก ไม่ใช่ต่อเติมทีหลัง
 *   2. **มีคำเตือนที่ต้องขึ้นจอเสมอ** เพราะหลักเกณฑ์ปี 2569 ยัง `verified: false` — วันนี้ยัง
 *      ไม่มีโค้ดไหนในรีโปอ่านธงนี้เลย ที่นี่เป็นที่แรก
 *   3. **ไม่คืนตัวเลขเลย** ทั้งสองจังหวะ ซึ่งเป็นเงื่อนไขที่ทำให้อนุโลม `reviewedBy` ของ ว 109 ได้
 *
 * สิ่งที่ผู้ช่วยตัวนี้ **ไม่ทำ**: เลือกสูตรจาก 35 สูตร คำนวณค่า K และแตะเงินชดเชย
 * `computeK` ยังปฏิเสธทุกสูตรอยู่เพราะหมวดงานทั้งห้ายังไม่มีผู้รับรอง และมันควรปฏิเสธต่อไป
 * จนกว่า IP-097 จะมีคนนั่งเทียบสัมประสิทธิ์กับหน้าสแกนทีละแถว
 */

const MODEL = "gpt-5.4-mini" as const;
const FALLBACK = "deepseek-v4-flash" as const;

/**
 * ชุดข้อมูลอ้างอิงของทักษะนี้ ยังไม่มีใครเซ็นรับรองการถอด ใช้ได้เฉพาะทักษะที่ไม่คืนตัวเลข
 *
 * ใช้บอกว่า *ทักษะนี้พึ่งชุดข้อมูลไหน* เท่านั้น **ห้ามเอาไปประกอบเป็นที่มาของกฎรายข้อ**
 * เพราะ `rulebook` ซ้อนหลักเกณฑ์จากคนละฉบับไว้ด้วยกัน กฎแต่ละข้อจึงพกเอกสารของตัวเองมา
 */
const W109_DATASET = {
  document: `หนังสือ ${escalationSource.documentNumber} ${escalationSource.subject}`,
  datasetId: "escalation-k/cabinet-w109-be2532",
  datasetSha256: escalationSource.sha256,
  reviewedBy: null
};

/**
 * ที่มาของกฎหนึ่งข้อ ประกอบจากเอกสารที่กฎข้อนั้นบอกเอง
 *
 * ก่อนหน้านี้ทุกกฎถูกแปะชื่อและรหัสย่อของ ว 109 เหมือนกันหมด รวมถึงมาตรการปี 2569
 * ที่ไม่ได้อยู่ในหนังสือฉบับนั้น ผู้ใช้ที่เปิดไฟล์ตามรหัสย่อที่เราให้ จะหาข้อความไม่เจอ
 */
const citationOf = (rule: { sourceRef: string; verified: boolean; document: RuleDocument }): Citation => ({
  document: rule.document.title,
  datasetId: rule.document.datasetId,
  datasetSha256: rule.document.sha256,
  clause: rule.sourceRef,
  page: rule.document.page,
  reviewedBy: null,
  verified: rule.verified
});

const asRecord = (input: unknown): Record<string, unknown> | null =>
  typeof input === "object" && input !== null ? (input as Record<string, unknown>) : null;

/**
 * วันที่แบบพุทธศักราช `2569-06-26` — รูปแบบเดียวที่ `escalation-k.ts` เข้าใจ
 *
 * ตรวจช่วงปีด้วย ไม่ใช่แค่รูปทรง เพราะ `2026-06-30` มีรูปทรงเดียวกันเป๊ะ แล้วมันจะไม่เข้า
 * ช่วงบังคับใช้ของกฎใด ๆ ระบบก็จะถอยไปใช้กฎตั้งต้นอย่างเงียบ ๆ ผู้ใช้ได้คำอธิบายที่หนักแน่น
 * และผิด — คนกรอกปี ค.ศ. ในงานราชการไทยเป็นเรื่องที่เกิดทุกวัน ไม่ใช่กรณีมุม
 *
 * ช่วงที่รับ: 2500 ถึง 2699 ครอบอายุสัญญาที่เป็นไปได้ทั้งหมด และตัดปี ค.ศ. ออกทั้งช่วง
 */
const BUDDHIST_YEAR_MIN = 2500;
const BUDDHIST_YEAR_MAX = 2699;

type DateReading = { ok: true; value: string | null } | { ok: false; message: string };

const readBuddhistDate = (value: unknown, label: string): DateReading => {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, message: `${label} ต้องเป็นวันที่แบบ พ.ศ. เช่น 2569-06-30` };

  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return { ok: false, message: `${label} ต้องอยู่ในรูป ปี-เดือน-วัน แบบ พ.ศ. เช่น 2569-06-30` };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < BUDDHIST_YEAR_MIN || year > BUDDHIST_YEAR_MAX) {
    return { ok: false, message: `${label} ต้องเป็นปี พ.ศ. ไม่ใช่ ค.ศ. เช่น 2569-06-30 ไม่ใช่ ${trimmed}` };
  }
  if (month < 1 || month > 12) return { ok: false, message: `${label} มีเดือนที่ไม่มีอยู่จริง` };
  if (day < 1 || day > 31) return { ok: false, message: `${label} มีวันที่ไม่มีอยู่จริง` };

  return { ok: true, value: trimmed };
};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

type Rules = { threshold: ThresholdRule | null; baseMonth: BaseMonthRule | null };

type EscalationShape = {
  contractSignedOn: string | null;
  periodDeliveredOn: string | null;
  scopeSummary: string | null;
  providedIndexVariables: string[];
  hasPeriodAmount: boolean;
  /** ผู้ใช้ระบุว่างวดนี้ส่งมอบหลังพ้นอายุสัญญา ซึ่งเปลี่ยนว่าจะใช้ค่า K ของเดือนไหน */
  deliveredAfterContractPeriod: boolean;
  question: string;
  rules: Rules;
};

/**
 * หาหลักเกณฑ์ที่ใช้กับสัญญาฉบับนี้ **ด้วยโค้ด ไม่ใช่ด้วยแบบจำลอง**
 *
 * นี่คือกับดักสองวัน: เกณฑ์ส่วนต่างตัดสินด้วยวันส่งมอบงวด แต่กฎเดือนฐานตัดสินด้วยวันลงนาม
 * สัญญาเดียวจึงเข้ากฎหนึ่งแต่ไม่เข้าอีกกฎได้ การเลือกกฎเป็นเรื่องที่ผิดไม่ได้จึงเป็นโค้ด
 * ส่วนแบบจำลองได้ผลลัพธ์ของการเลือกไปอธิบายให้คนฟังเข้าใจเท่านั้น
 */
function resolveRules(contractSignedOn: string | null, periodDeliveredOn: string | null): Rules {
  return {
    threshold: periodDeliveredOn ? resolveThresholdRule(periodDeliveredOn) : null,
    baseMonth: contractSignedOn ? resolveBaseMonthRule(contractSignedOn) : null
  };
}

function projectEscalation(input: unknown): { ok: true; value: EscalationShape } | { ok: false; message: string } {
  const source = asRecord(input);
  if (!source) return { ok: false, message: "ไม่ได้รับข้อมูลสัญญา" };

  const signed = readBuddhistDate(source.contractSignedOn, "วันลงนามสัญญา");
  if (!signed.ok) return { ok: false, message: signed.message };
  const delivered = readBuddhistDate(source.periodDeliveredOn, "วันส่งมอบงวด");
  if (!delivered.ok) return { ok: false, message: delivered.message };

  const contractSignedOn = signed.value;
  const periodDeliveredOn = delivered.value;
  const scopeSummary = text(source.scopeSummary);

  /*
   * ยังไม่กรอกอะไรเลย ตอบได้เองโดยไม่ต้องเรียกแบบจำลอง
   *
   * ผู้ช่วยตรวจความพร้อมมีไว้ชี้ว่า *อะไรที่กรอกแล้วยังไม่พอ* ไม่ใช่ไว้บอกว่าฟอร์มยังว่าง
   * ซึ่งระบบเห็นเองอยู่แล้ว การยิงคำขอไปถามเรื่องที่รู้คำตอบอยู่แล้วคือการจ่ายเงินฟรี
   */
  if (!contractSignedOn && !periodDeliveredOn && !scopeSummary) {
    return { ok: false, message: "ยังไม่ได้กรอกวันลงนามสัญญา วันส่งมอบงวด หรือขอบเขตงานเลยสักอย่าง" };
  }

  return {
    ok: true,
    value: {
      contractSignedOn,
      periodDeliveredOn,
      scopeSummary,
      providedIndexVariables: Array.isArray(source.providedIndexVariables)
        ? source.providedIndexVariables.flatMap((item) => {
            const value = text(item);
            return value ? [value] : [];
          })
        : [],
      hasPeriodAmount: source.hasPeriodAmount === true,
      deliveredAfterContractPeriod: source.deliveredAfterContractPeriod === true,
      question: text(source.question) ?? "สัญญาฉบับนี้ใช้หลักเกณฑ์ใด และต้องระวังอะไร",
      rules: resolveRules(contractSignedOn, periodDeliveredOn)
    }
  };
}

/**
 * ข้อเท็จจริงที่ระบบตัดสินแล้ว ส่งให้แบบจำลอง *อ้าง* ไม่ใช่ให้มันหาเอง
 *
 * ส่ง **ข้อความจากหนังสือคำต่อคำ** ไม่ใช่คำสรุปที่เราเขียนเอง เพราะรอบก่อนคำสรุปที่เขียนเอง
 * ตกขาที่เป็นโทษกับผู้ใช้ไปทั้งขา — มันบอกแต่ว่าเกณฑ์ส่วนต่างคือส่วนที่ไม่คิดให้เวลาจ่ายเพิ่ม
 * แต่ไม่บอกเลยว่ากฎข้อเดียวกันนี้ **เรียกเงินคืน** ได้เมื่อดัชนีลง ซึ่งชุดข้อมูลเขียนไว้ชัดทั้งสองกฎ
 * ข้อความจากเอกสารย่อมปลอดภัยกว่าคำสรุปของเรา และตัดปัญหาทั้งชั้นนี้ทิ้งไปเลย
 */
function derivedFacts(projected: EscalationShape): string[] {
  const facts: string[] = [];
  const { threshold, baseMonth } = projected.rules;

  if (threshold) {
    facts.push(
      `เกณฑ์ส่วนต่างที่ใช้กับงวดนี้คือ ${threshold.label} ที่ร้อยละ ${threshold.thresholdMilli / 10} ` +
        `ตัดสินจากวันส่งมอบงวด ${projected.periodDeliveredOn} อ้างอิง ${threshold.sourceRef}`
    );
    facts.push(`ข้อความตามเอกสารของเกณฑ์ส่วนต่างข้อนี้: "${threshold.quote}"`);
  }
  if (baseMonth) {
    facts.push(
      `เดือนฐานที่ใช้กับสัญญานี้คือ ${baseMonth.label} ตัดสินจากวันลงนามสัญญา ` +
        `${projected.contractSignedOn} อ้างอิง ${baseMonth.sourceRef}`
    );
  }

  /*
   * กับดักสองวัน — และกรณีที่อันตรายกว่าคือ *มีวันเดียว*
   *
   * คนที่กรอกวันเดียวคือคนที่ยังไม่รู้ว่ามีสองวันให้ระวัง จึงเป็นคนที่ต้องการคำเตือนนี้ที่สุด
   * ก่อนหน้านี้เขากลับเป็นคนเดียวที่ไม่ได้รับมันเลย เพราะ fact ถูกสร้างเมื่อครบทั้งคู่เท่านั้น
   */
  if (threshold && baseMonth) {
    facts.push(
      threshold.id === baseMonth.id
        ? "เกณฑ์ส่วนต่างกับเดือนฐานของสัญญานี้มาจากหลักเกณฑ์ชุดเดียวกัน แต่ตัดสินด้วยวันคนละวัน"
        : "สัญญาฉบับนี้ตกอยู่ใต้หลักเกณฑ์คนละชุดกันสองข้อ เพราะเกณฑ์ส่วนต่างกับเดือนฐานตัดสินด้วยวันคนละวัน"
    );
  } else {
    const missing = threshold ? "วันลงนามสัญญา" : "วันส่งมอบงวด";
    facts.push(
      `ยังบอกไม่ได้ว่าสัญญานี้ตกหลักเกณฑ์คนละชุดกันสองข้อหรือไม่ เพราะยังไม่มี${missing} ` +
        "ซึ่งเป็นตัวตัดสินอีกข้อหนึ่ง"
    );
  }

  // เทียบวันสองวันเป็นข้อเท็จจริง ไม่ใช่วิจารณญาณ จึงเป็นงานของโค้ด ไม่ใช่ของแบบจำลอง
  if (projected.contractSignedOn && projected.periodDeliveredOn && projected.periodDeliveredOn < projected.contractSignedOn) {
    facts.push("วันส่งมอบงวดที่กรอกมา อยู่ก่อนวันลงนามสัญญา ซึ่งเป็นไปไม่ได้ ต้องให้ผู้ใช้ตรวจวันที่ทั้งสองก่อน");
  }

  if (projected.deliveredAfterContractPeriod) {
    facts.push(`ผู้ใช้ระบุว่างวดนี้ส่งมอบหลังพ้นอายุสัญญา ข้อความตามเอกสาร: "${escalationMethod.lateWorkRule}"`);
  }
  if (projected.scopeSummary) {
    facts.push(`ข้อความตามเอกสารเรื่องสัญญาที่มีงานหลายประเภท: "${escalationMethod.multiTypeRule}"`);
  }

  facts.push(
    `ค่า K คิดด้วยทศนิยม ${escalationMethod.decimals} ตำแหน่งแบบตัดทิ้งทุกขั้นตอน ` +
      `ข้อความตามเอกสาร: "${escalationMethod.roundingQuote}"`
  );
  facts.push(
    `หน้าต่างเวลายื่นคำขอคือ ${escalationMethod.claimWindowDays} วัน ข้อความตามเอกสาร: ` +
      `"${escalationMethod.claimWindowNote}" อ้างอิง ${escalationMethod.provenance.sourceRef}`
  );
  return facts;
}

function ruleCitations(projected: EscalationShape): Citation[] {
  const citations: Citation[] = [];
  const { threshold, baseMonth } = projected.rules;
  if (threshold) citations.push(citationOf(threshold));
  if (baseMonth) citations.push(citationOf(baseMonth));

  // หน้าต่างเวลายื่นคำขอเดินเข้า prompt ทุกครั้ง จึงต้องมีที่มาทุกครั้งเหมือนกฎข้ออื่น
  citations.push({
    document: W109_DATASET.document,
    datasetId: W109_DATASET.datasetId,
    datasetSha256: W109_DATASET.datasetSha256,
    clause: escalationMethod.provenance.sourceRef,
    page: null,
    reviewedBy: null,
    verified: escalationMethod.provenance.verified
  });
  return citations;
}

/**
 * คำเตือนที่ต้องขึ้นจอเสมอ
 *
 * `verified: false` มีสองความหมายที่ปิดคนละวิธี และคอมเมนต์เดิมรวบไว้เป็นเหตุเดียวจนคนรุ่นถัดไป
 * จะปิดผิดทาง
 *
 *   **มาตรการปี 2569** — ยังไม่มีเอกสารต้นฉบับในคลังเลย มีแต่บทสรุปอัตโนมัติกับภาพอินโฟกราฟิก
 *   ปิดได้ด้วยการ *หาเอกสาร* (IP-096)
 *   **กฎของ ว 109** — ไฟล์มีอยู่และรหัสย่อตรง แต่ยังไม่มีใครนั่งเทียบข้อความทีละบรรทัด
 *   ปิดได้ด้วยการ *ให้คนเซ็นรับรอง* (IP-097)
 */
function ruleWarnings(projected: EscalationShape): string[] {
  const warnings: string[] = [];
  for (const rule of [projected.rules.threshold, projected.rules.baseMonth]) {
    if (!rule || rule.verified) continue;
    warnings.push(
      rule.document.sha256 === null
        ? `หลักเกณฑ์ ${rule.label} ยังไม่มีเอกสารต้นฉบับในคลัง (${rule.sourceRef}) ต้องหาฉบับจริงมายืนยันก่อนใช้`
        : `หลักเกณฑ์ ${rule.label} ยังไม่มีผู้รับรองการถอดข้อความเทียบต้นฉบับ (${rule.sourceRef}) ต้องเปิดฉบับจริงตรวจก่อนใช้`
    );
  }

  /*
   * กำหนดเวลายื่นคำขอ ต้องมีคำเตือนของตัวเองเสมอ
   *
   * ตัวเลขอื่นถอดผิด = คิดเงินคลาด ตัวเลขนี้ถอดผิด = สิทธิ์หมดทั้งเรื่อง และมันถอดมาจาก
   * ภาพสแกนชุดเดียวกับสัมประสิทธิ์ที่ `computeK` ไม่ยอมใช้ ก่อนหน้านี้มันเป็นตัวเลขเดียวที่
   * เดินทางถึงผู้ใช้โดยไม่มีอะไรคุ้มกันเลยสักชั้น
   */
  if (!escalationMethod.provenance.verified) {
    warnings.push(
      `กำหนดเวลายื่นคำขอ ${escalationMethod.claimWindowDays} วัน เป็นข้อที่พลาดแล้วสิทธิ์หมดทั้งเรื่อง ` +
        "และยังไม่มีผู้รับรองการถอดข้อความเทียบต้นฉบับ ต้องเปิดหนังสือฉบับจริงยืนยันก่อนถือตามนี้"
    );
  }

  warnings.push("ผู้ช่วยตัวนี้อธิบายหลักเกณฑ์เท่านั้น ไม่ได้เลือกสูตรและไม่ได้คำนวณค่า K หรือเงินชดเชย");
  return [...new Set(warnings)];
}

const escalationPreflightSkill = defineSkill<EscalationShape, EscalationPreflight>({
  app: "escalation-k",
  verb: "preflight",
  label: "ตรวจความพร้อมก่อนคิดค่า K",
  system: ESCALATION_PREFLIGHT_SYSTEM,
  schema: escalationPreflightSchema,
  schemaName: "escalation_preflight",
  model: MODEL,
  fallbackModel: FALLBACK,
  returnsNumbers: false,
  source: { ...W109_DATASET, verified: false },
  project: projectEscalation,
  buildTask: (projected, facts) =>
    buildEscalationPreflightTask(
      {
        contractSignedOn: projected.contractSignedOn,
        periodDeliveredOn: projected.periodDeliveredOn,
        scopeSummary: projected.scopeSummary,
        providedIndexVariables: projected.providedIndexVariables,
        hasPeriodAmount: projected.hasPeriodAmount
      },
      [...derivedFacts(projected), ...facts]
    ),
  citations: ruleCitations,
  assumptions: (draft) => draft.conflicts.map((conflict) => `${conflict.title}: ${conflict.detail}`),
  warnings: ruleWarnings
});

const escalationExplainSkill = defineSkill<EscalationShape, EscalationExplain>({
  app: "escalation-k",
  verb: "explain",
  label: "อธิบายหลักเกณฑ์ที่ใช้กับสัญญานี้",
  system: ESCALATION_EXPLAIN_SYSTEM,
  schema: escalationExplainSchema,
  schemaName: "escalation_explain",
  model: MODEL,
  fallbackModel: FALLBACK,
  returnsNumbers: false,
  source: { ...W109_DATASET, verified: false },
  project: (input) => {
    const projected = projectEscalation(input);
    if (!projected.ok) return projected;
    if (!projected.value.periodDeliveredOn && !projected.value.contractSignedOn) {
      return { ok: false, message: "ต้องมีอย่างน้อยวันลงนามสัญญาหรือวันส่งมอบงวด จึงจะบอกได้ว่าใช้หลักเกณฑ์ใด" };
    }
    return projected;
  },
  buildTask: (projected, facts) =>
    buildEscalationExplainTask(
      {
        contractSignedOn: projected.contractSignedOn,
        periodDeliveredOn: projected.periodDeliveredOn,
        question: projected.question
      },
      [...derivedFacts(projected), ...facts]
    ),
  citations: ruleCitations,
  assumptions: (draft) => draft.checkAgainstDocument,
  warnings: ruleWarnings
});

export const escalationKSkills: AssistantSkill[] = [escalationPreflightSkill, escalationExplainSkill];
