import type { z } from "zod";
import type { AssistantVerb, Citation } from "@/server/ai/assistant-contract";
import { TEXT_ONLY_VERBS } from "@/server/ai/assistant-contract";
import type { ModelId } from "@/server/ai/provider";

/**
 * ทะเบียนทักษะ — ความรู้รายแอปเป็นข้อมูลที่ลงทะเบียน ไม่ใช่ `if` ที่แตกสาขาในประตู
 *
 * เหตุผลของรูปทรงนี้: ถ้าประตูรู้จักชื่อแอป ประตูจะโตขึ้นทุกครั้งที่เพิ่มแอป และกฎร่วมอย่าง
 * "schema ห้ามมีช่องเงิน" จะต้องเขียนเทสต์ซ้ำต่อแอป ซึ่งเป็นงานที่คนลืมทำในวันที่รีบ
 * พอความรู้รายแอปเป็น *แถวข้อมูล* เทสต์ตัวเดียวเดินไล่ทั้งทะเบียนได้ และแอปที่เพิ่มพรุ่งนี้
 * ก็ถูกตรวจด้วยกฎเดียวกันทันทีโดยไม่มีใครต้องจำ
 *
 * เพิ่มผู้ช่วยให้แอปใหม่ = เพิ่มแถวที่นี่ ไม่ต้องแก้ `assistant.ts` เลยสักบรรทัด
 */

/** ชุดข้อมูลที่ทักษะนี้อ้างอิง `null` เมื่อทักษะไม่ได้อ้างเอกสารใดเลย */
export type SkillSource = {
  /** ชื่อที่คนเรียกกันจริง เช่น "หนังสือ ว 109" */
  document: string;
  datasetId: string;
  /** sha256 ของไฟล์ต้นฉบับ ไม่ใช่ของ JSON ที่ถอดออกมา */
  datasetSha256: string;
  /** ชื่อผู้รับรองว่าถอดข้อมูลตรงกับต้นฉบับ `null` แปลว่ายังไม่มีใครเซ็น */
  reviewedBy: string | null;
  /** ธงของชุดข้อมูลเองว่าหลักเกณฑ์ตรวจกับฉบับจริงแล้วหรือยัง */
  verified: boolean;
};

export type ProjectResult<T> = { ok: true; value: T } | { ok: false; message: string };

export type SkillSpec<TProjected, TDraft> = {
  /** slug ของแอปใน `platformApps` เท่านั้น */
  app: string;
  verb: AssistantVerb;
  /** ชื่อไทยของทักษะ ขึ้นจอได้และลง audit ได้ */
  label: string;
  system: string;
  schema: z.ZodType<TDraft>;
  schemaName: string;
  model: ModelId;
  /** ตัวสำรองเมื่อค่ายหลักล้ม `null` แปลว่าไม่มีตัวสำรอง */
  fallbackModel: ModelId | null;
  maxTokens?: number;
  /**
   * คำตอบของแบบจำลองไหลเข้าการคำนวณต่อหรือไม่
   *
   * `false` คือคืนข้อความล้วนให้คนอ่าน `true` คือมีตัวเลขที่ระบบเอาไปคิดต่อ เช่น สัดส่วนน้ำหนัก
   * ค่านี้ผูกกับกฎที่เทสต์บังคับว่า **ทักษะที่คืนตัวเลขต้องอ้างชุดข้อมูลที่มีผู้รับรองเท่านั้น**
   * นี่คือที่ที่การอนุโลม `reviewedBy` ของ ว 109 มีขอบเขต — อนุโลมได้เพราะทักษะไม่คืนตัวเลข
   * ไม่ใช่เพราะเราตัดสินใจจะยอมในกรณีนี้
   */
  returnsNumbers: boolean;
  source: SkillSource | null;
  /** ตัดข้อมูลส่วนเกินก่อนเข้า prompt และปฏิเสธเมื่ออินพุตไม่ครบ */
  project: (input: unknown) => ProjectResult<TProjected>;
  /** ประกอบโจทย์ ต้องใส่ข้อเท็จจริงผ่าน `factsBlock` เสมอ */
  buildTask: (projected: TProjected, facts: readonly string[]) => string;
  /** ประกอบจากชุดข้อมูลเท่านั้น ห้ามให้แบบจำลองเขียนเลขข้อ */
  citations: (projected: TProjected) => Citation[];
  /** สมมติฐานที่ผู้ใช้ควรตรวจ ดึงจากคำตอบของแบบจำลอง */
  assumptions: (draft: TDraft) => string[];
  /** คำเตือนที่ต้องขึ้นจอเสมอ เช่น หลักเกณฑ์ยังไม่ตรวจกับฉบับจริง */
  warnings: (projected: TProjected) => string[];
};

/**
 * ทักษะที่ลบชนิดภายในออกแล้ว เพื่อให้ทะเบียนเก็บทุกทักษะไว้ในรายการเดียวกันได้
 *
 * ความปลอดภัยของชนิดยังอยู่ครบข้างในไฟล์ของแต่ละทักษะ เพราะ `defineSkill` เป็นตัวเดียว
 * ที่ลบชนิด และมันรับ spec ที่ผูกชนิดกันแน่นแล้วเท่านั้น
 */
export type AssistantSkill = SkillSpec<unknown, unknown>;

export function defineSkill<TProjected, TDraft>(spec: SkillSpec<TProjected, TDraft>): AssistantSkill {
  return {
    ...spec,
    schema: spec.schema as z.ZodType<unknown>,
    project: (input) => spec.project(input),
    buildTask: (projected, facts) => spec.buildTask(projected as TProjected, facts),
    citations: (projected) => spec.citations(projected as TProjected),
    assumptions: (draft) => spec.assumptions(draft as TDraft),
    warnings: (projected) => spec.warnings(projected as TProjected)
  };
}

/**
 * ชุดข้อมูลที่ยังไม่มีใครเซ็นรับรอง ใช้ได้เฉพาะกับทักษะที่ไม่คืนตัวเลข
 *
 * เส้นแบ่งอยู่ตรงที่ **ตัวเลขที่ถอดมาจากเอกสารต้นฉบับ** ไม่ใช่ตัวเลขทุกชนิด ผู้ช่วยแผนงาน
 * เสนอสัดส่วนน้ำหนักที่มันคิดขึ้นเองและผู้ใช้ตรวจต่อ ไม่ได้อ้างว่าถอดมาจากหนังสือเล่มไหน
 * มันจึงไม่ต้องรอลายเซ็นใคร ส่วนผู้ช่วยที่หยิบสัมประสิทธิ์จากตารางที่ถอดด้วย OCR แล้วส่งต่อ
 * ไปคิดเงิน กำลังยืมความน่าเชื่อถือของเอกสารราชการมาใช้ ซึ่งต้องมีคนรับรองว่าถอดไม่ผิดก่อน
 *
 * นี่คือขอบเขตของการอนุโลม ว 109 ที่เจ้าของงานเคาะไว้ เขียนเป็นกฎที่เทสต์เดินไล่ทั้งทะเบียน
 * ไม่ใช่ข้อยกเว้นที่คนต้องจำ วันที่มีใครเพิ่มทักษะซึ่งคืนตัวเลขจากชุดข้อมูลที่ยังไม่มีผู้รับรอง
 * เทสต์จะตกทันทีโดยไม่ต้องมีใครสังเกตเห็น
 */
export function skillNeedsReviewedSource(skill: AssistantSkill): boolean {
  return skill.returnsNumbers && skill.source !== null;
}

export function skillSourceIsUsable(skill: AssistantSkill): boolean {
  if (!skillNeedsReviewedSource(skill)) return true;
  return skill.source?.reviewedBy != null;
}

/** จริงเมื่อจังหวะนี้ไม่มีทางคืนตัวเลขได้เลยตามนิยามของสัญญา */
export function verbIsTextOnly(verb: AssistantVerb): boolean {
  return TEXT_ONLY_VERBS.includes(verb);
}

const registry = new Map<string, AssistantSkill>();
const key = (app: string, verb: AssistantVerb) => `${app}:${verb}`;

export function registerSkills(skills: readonly AssistantSkill[]): void {
  for (const skill of skills) {
    const id = key(skill.app, skill.verb);
    if (registry.has(id)) throw new Error(`Assistant skill "${id}" is registered twice.`);
    registry.set(id, skill);
  }
}

export function findSkill(app: string, verb: AssistantVerb): AssistantSkill | undefined {
  return registry.get(key(app, verb));
}

export function listSkills(): AssistantSkill[] {
  return [...registry.values()];
}

/** แอปที่มีผู้ช่วยจริงอย่างน้อยหนึ่งจังหวะ — สิ่งที่ IP-190 จะใช้ตอบว่าแอปไหนพูดเรื่อง AI ได้ */
export function appsWithAssistant(): string[] {
  return [...new Set(listSkills().map((skill) => skill.app))].sort();
}
