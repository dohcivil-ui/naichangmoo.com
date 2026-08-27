import {
  escalationMethod,
  escalationSource,
  resolveBaseMonthRule,
  resolveThresholdRule,
  type BaseMonthRule,
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

/** ชุดข้อมูลนี้ยังไม่มีใครเซ็นรับรองการถอด ใช้ได้เฉพาะทักษะที่ไม่คืนตัวเลข */
const W109: Omit<Citation, "clause" | "page" | "verified"> = {
  document: `หนังสือ ${escalationSource.documentNumber} ${escalationSource.subject}`,
  datasetId: "escalation-k/cabinet-w109-be2532",
  datasetSha256: escalationSource.sha256,
  reviewedBy: null
};

const asRecord = (input: unknown): Record<string, unknown> | null =>
  typeof input === "object" && input !== null ? (input as Record<string, unknown>) : null;

/** วันที่แบบพุทธศักราช `2569-06-26` — รูปแบบเดียวที่ `escalation-k.ts` เข้าใจ */
const buddhistDate = (value: unknown): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

type Rules = { threshold: ThresholdRule | null; baseMonth: BaseMonthRule | null };

type EscalationShape = {
  contractSignedOn: string | null;
  periodDeliveredOn: string | null;
  scopeSummary: string | null;
  providedIndexVariables: string[];
  hasPeriodAmount: boolean;
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

  const contractSignedOn = buddhistDate(source.contractSignedOn);
  const periodDeliveredOn = buddhistDate(source.periodDeliveredOn);
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
      question: text(source.question) ?? "สัญญาฉบับนี้ใช้หลักเกณฑ์ใด และต้องระวังอะไร",
      rules: resolveRules(contractSignedOn, periodDeliveredOn)
    }
  };
}

/** ข้อเท็จจริงที่ระบบตัดสินแล้ว ส่งให้แบบจำลอง *อ้าง* ไม่ใช่ให้มันหาเอง */
function derivedFacts(projected: EscalationShape): string[] {
  const facts: string[] = [];
  const { threshold, baseMonth } = projected.rules;

  if (threshold) {
    facts.push(
      `เกณฑ์ส่วนต่างที่ใช้กับงวดนี้คือ ${threshold.label} ที่ร้อยละ ${threshold.thresholdMilli / 10} ` +
        `ตัดสินจากวันส่งมอบงวด ${projected.periodDeliveredOn} อ้างอิง ${threshold.sourceRef}`
    );
  }
  if (baseMonth) {
    facts.push(
      `เดือนฐานที่ใช้กับสัญญานี้คือ ${baseMonth.label} ตัดสินจากวันลงนามสัญญา ` +
        `${projected.contractSignedOn} อ้างอิง ${baseMonth.sourceRef}`
    );
  }
  if (threshold && baseMonth && threshold.id !== baseMonth.id) {
    facts.push(
      "สัญญาฉบับนี้ตกอยู่ใต้หลักเกณฑ์คนละชุดกันสองข้อ เพราะเกณฑ์ส่วนต่างกับเดือนฐานตัดสินด้วยวันคนละวัน"
    );
  }
  facts.push(
    `เกณฑ์ส่วนต่างเป็นส่วนที่ไม่คิดให้ ไม่ใช่ด่านผ่าน และค่า K คิดด้วยทศนิยม ` +
      `${escalationMethod.decimals} ตำแหน่งแบบตัดทิ้งทุกขั้นตอน`
  );
  facts.push(`หน้าต่างเวลายื่นคำขอคือ ${escalationMethod.claimWindowDays} วันนับจากวันส่งมอบงานงวดสุดท้าย`);
  return facts;
}

function ruleCitations(projected: EscalationShape): Citation[] {
  const citations: Citation[] = [];
  const { threshold, baseMonth } = projected.rules;
  if (threshold) {
    citations.push({ ...W109, clause: threshold.sourceRef, page: null, verified: threshold.verified });
  }
  if (baseMonth) {
    citations.push({ ...W109, clause: baseMonth.sourceRef, page: null, verified: baseMonth.verified });
  }
  return citations;
}

/**
 * คำเตือนที่ต้องขึ้นจอเสมอ
 *
 * `verified: false` ของมาตรการปี 2569 หมายความตรงตัวว่า **ยังไม่มีเอกสารต้นฉบับในคลัง**
 * มีแต่บทสรุปอัตโนมัติกับภาพอินโฟกราฟิก ผู้ใช้ที่กำลังจะเอาไปยื่นเรื่องต้องเห็นข้อนี้ก่อน
 * ไม่ใช่รู้ทีหลังตอนกรรมการถาม
 */
function ruleWarnings(projected: EscalationShape): string[] {
  const warnings: string[] = [];
  for (const rule of [projected.rules.threshold, projected.rules.baseMonth]) {
    if (rule && !rule.verified) {
      warnings.push(`หลักเกณฑ์ ${rule.label} ยังไม่ได้ตรวจกับเอกสารต้นฉบับ (${rule.sourceRef}) ต้องเปิดฉบับจริงยืนยันก่อนใช้`);
    }
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
  source: { ...W109, verified: false },
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
  source: { ...W109, verified: false },
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
