import { defineSkill, type AssistantSkill } from "@/server/ai/skill-registry";
import {
  BOQ_MATCH_SYSTEM,
  boqMatchSchema,
  buildBoqMatchTask,
  type BoqMatchDraft,
  type BoqMatchInput
} from "@/server/ai/estimeter-prompt";

/**
 * ผู้ช่วย ESTIMETR — จับคู่ปริมาณที่ถอดไว้กับชุดราคาที่โครงการรับมา
 *
 * ก่อนหน้านี้ ESTIMETR ไม่มีผู้ช่วยเลยสักตัว ทั้งที่เป็นแอปที่มีข้อมูลจริงมากที่สุด
 * ปริมาณอยู่แผงหนึ่ง ชุดราคาอยู่อีกแผงหนึ่ง บนหน้าเดียวกัน และไม่เคยเจอกัน คนต้องไล่จับคู่
 * เองทีละบรรทัด ซึ่งเป็นงานที่กินเวลาที่สุดของการปิดหนึ่งงาน และเป็นงานที่แบบจำลองทำได้ดี
 * เพราะมันคือการเทียบชื่อกับหน่วย ไม่ใช่การตัดสินใจทางวิศวกรรม
 *
 * **แบบจำลองไม่เห็นเงินเลย** โจทย์ส่งไปแค่ชื่อกับหน่วยทั้งสองฝั่ง เงินคำนวณที่เซิร์ฟเวอร์จาก
 * ราคาที่เก็บไว้ในชุดราคาซึ่งนิ่งแล้ว การจับคู่ผิดจึงทำให้ **หยิบราคาผิดบรรทัด** ได้
 * ซึ่งเป็นเหตุผลที่คู่ทุกคู่ต้องผ่านคนกดยืนยันก่อน ไม่ใช่ไหลเข้าเอกสารเอง
 */

const MODEL = "gpt-5.4-mini" as const;
/** ช้ากว่าราวสิบเท่าแต่ไม่ดับพร้อมกับ OpenAI ใช้เฉพาะตอนค่ายหลักล้ม ไม่ใช่ตอนมันปฏิเสธ */
const FALLBACK = "deepseek-v4-flash" as const;

/** เพดานที่กันโจทย์บวมจนราคาต่อครั้งพุ่ง และกันหน้าจอที่คนตรวจไม่ไหวในรอบเดียว */
const MAX_ITEMS = 60;
const MAX_LINES = 80;

const asRecord = (input: unknown): Record<string, unknown> | null =>
  typeof input === "object" && input !== null ? (input as Record<string, unknown>) : null;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * ตัดทุกอย่างที่ไม่ใช่ชื่อ หน่วย ปริมาณ และรหัสอ้างอิง ทิ้งก่อนเข้า prompt
 *
 * รายการที่ส่งเข้ามามีทั้งรหัสผู้ใช้ รหัสองค์กร และคีย์ไฟล์แบบติดมาด้วยเสมอ เพราะมันมาจาก
 * แถวในฐานข้อมูลตรง ๆ ตัวคัดนี้คือที่เดียวที่กันของพวกนั้นไม่ให้เดินทางออกไปกับโจทย์
 */
function projectMatch(input: unknown): { ok: true; value: BoqMatchInput } | { ok: false; message: string } {
  const record = asRecord(input);
  if (!record) return { ok: false, message: "ไม่มีข้อมูลโครงการให้จับคู่" };

  const projectName = text(record.projectName);
  if (!projectName) return { ok: false, message: "ยังไม่รู้ว่าเป็นโครงการไหน" };

  const items = (Array.isArray(record.items) ? record.items : []).flatMap((raw) => {
    const row = asRecord(raw);
    if (!row) return [];
    const ref = text(row.ref);
    const description = text(row.description);
    const unit = text(row.unit);
    const quantity = text(row.quantity);
    if (!ref || !description || !unit || !quantity) return [];
    return [{ ref, description, unit, quantity }];
  });

  const lines = (Array.isArray(record.lines) ? record.lines : []).flatMap((raw) => {
    const row = asRecord(raw);
    if (!row) return [];
    const ref = text(row.ref);
    const name = text(row.name);
    const unit = text(row.unit);
    if (!ref || !name || !unit) return [];
    return [{ ref, name, unit }];
  });

  if (items.length === 0) return { ok: false, message: "ยังไม่มีรายการปริมาณที่ยืนยันแล้วให้จับคู่" };
  if (lines.length === 0) return { ok: false, message: "โครงการนี้ยังไม่มีชุดราคาที่รับมา" };

  return {
    ok: true,
    value: { projectName, items: items.slice(0, MAX_ITEMS), lines: lines.slice(0, MAX_LINES) }
  };
}

const boqMatchSkill = defineSkill<BoqMatchInput, BoqMatchDraft>({
  app: "estimeter",
  verb: "draft",
  label: "จับคู่ปริมาณกับชุดราคา",
  system: BOQ_MATCH_SYSTEM,
  schema: boqMatchSchema,
  schemaName: "boq_match",
  model: MODEL,
  fallbackModel: FALLBACK,
  /**
   * คู่ที่มันเลือกตัดสินว่าจะหยิบราคาบรรทัดไหนมาคูณ คำตอบจึงไหลเข้าการคำนวณ
   * แม้ตัวคำตอบจะไม่มีตัวเลขเงินสักตัว การประกาศว่าไม่ไหลจะเป็นการเลี่ยงกฎด้วยถ้อยคำ
   */
  returnsNumbers: true,
  /** ไม่ได้อ้างเอกสารฉบับใด ที่มาของราคาติดมากับบรรทัดในชุดราคาอยู่แล้ว */
  source: null,
  project: projectMatch,
  buildTask: (projected, facts) => buildBoqMatchTask(projected, [...facts]),
  citations: () => [],
  assumptions: (draft) => {
    const notes = draft.note.trim() === "" ? [] : [draft.note.trim()];
    const weak = draft.matches.filter((match) => match.confidence !== "สูง").length;
    if (weak > 0) notes.push(`มีคู่ที่ยังไม่มั่นใจเต็มที่ ${weak} คู่ ควรเปิดดูทีละคู่ก่อนกดรับ`);
    if (draft.unmatched.length > 0) {
      notes.push(`มีรายการที่ยังหาคู่ไม่ได้ ${draft.unmatched.length} รายการ ต้องหยิบราคาเพิ่มหรือจับคู่เอง`);
    }
    return notes;
  },
  warnings: () => [
    "คู่ที่เสนอยังไม่ถูกนำไปใช้จนกว่าจะกดรับทีละคู่ และการจับคู่ผิดทำให้หยิบราคาผิดบรรทัด"
  ]
});

export const estimeterSkills: AssistantSkill[] = [boqMatchSkill];
