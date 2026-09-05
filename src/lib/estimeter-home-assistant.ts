import { methodClaims } from "@/lib/method-claims";
import { nextActionLine, type HomeProgress } from "@/lib/estimeter-home-status";

/**
 * บทของผู้ช่วยบนหน้าแรก ESTIMETR — เฟสแรก เป็นสคริปต์ล้วน ไม่แตะแบบจำลอง (IP-235)
 *
 * **ทำไมไม่ต่อแบบจำลองตั้งแต่ตอนนี้** เจ้าของงานเคาะไว้ว่าเฟสแรกเป็นปุ่มที่เขียนสคริปต์ไว้
 * ข้อดีที่จับต้องได้คือถามซ้ำกี่ครั้งก็ได้คำตอบเดิม ไม่มีค่าใช้จ่ายต่อคลิก และไม่มีทางที่
 * ผู้ช่วยจะพูดตัวเลขที่ไม่มีใครพิสูจน์ได้ · เฟสสองค่อยเปิดช่องพิมพ์ ซึ่งต้อง grill ก่อน
 *
 * **คำตอบที่เป็นคำอธิบายวิธีทำงาน หยิบจาก `methodClaims` ทั้งดุ้น ห้ามพิมพ์ใหม่**
 * เพราะข้อความในนั้นแต่ละข้อมีไฟล์เทสต์กำกับว่าพิสูจน์แล้ว การพิมพ์ใหม่ให้สวยขึ้นคือการ
 * สร้างคำโฆษณาที่ไม่มีใครพิสูจน์ ซึ่ง ADR 0015 ห้ามไว้ · เทสต์คู่ไฟล์นี้เทียบตัวอักษรให้
 *
 * ส่วนคำตอบที่เป็นสถานะของงาน มาจาก `nextActionLine` ซึ่งอ่านจากฐานข้อมูลจริง
 */

export type AssistantPrompt = { question: string; answer: string };
export type AssistantScript = { greeting: string[]; prompts: AssistantPrompt[] };

/** พาดหัวของข้อใน method-claims ที่ผู้ช่วยหยิบมาตอบ — ชื่อผิดแม้ตัวเดียวคือข้อนั้นหายไปเงียบ ๆ จึงมีเทสต์เฝ้า */
export const QUOTED_CLAIM_TITLES = [
  "สเกลมาจากเลขที่แบบเขียน ไม่ใช่จากตัวเลขใต้รูป",
  "ทุกปริมาณบอกได้ว่าได้มาอย่างไร",
  "ตัวเลขเงินไม่เคยมาจากปัญญาประดิษฐ์",
  "ปิดหน้าเว็บแล้วเปิดใหม่ งานวัดยังอยู่ครบ"
] as const;

function claimBody(title: string): string | null {
  return methodClaims.find((claim) => claim.title === title)?.body ?? null;
}

function quoted(question: string, title: string): AssistantPrompt | null {
  const body = claimBody(title);
  return body ? { question, answer: body } : null;
}

export function homeAssistantScript(input: {
  /** null = เปิดครั้งแรก ยังไม่มีโครงการ */
  project: { name: string; progress: HomeProgress } | null;
}): AssistantScript {
  const explainers = [
    quoted("สเกลของแต่ละหน้าเอามาจากไหน", "สเกลมาจากเลขที่แบบเขียน ไม่ใช่จากตัวเลขใต้รูป"),
    quoted("ปริมาณแต่ละบรรทัดย้อนดูที่มาได้ไหม", "ทุกปริมาณบอกได้ว่าได้มาอย่างไร"),
    quoted("ตัวเลขราคาที่ได้ มาจากปัญญาประดิษฐ์หรือเปล่า", "ตัวเลขเงินไม่เคยมาจากปัญญาประดิษฐ์"),
    quoted("ปิดเว็บแล้วงานที่วัดไว้หายไหม", "ปิดหน้าเว็บแล้วเปิดใหม่ งานวัดยังอยู่ครบ")
  ].filter((prompt): prompt is AssistantPrompt => prompt !== null);

  if (!input.project) {
    return {
      greeting: [
        "ยังไม่มีโครงการในระบบเลยครับ เริ่มใบแรกกันไหม",
        "ผมถามแค่สามอย่าง ชื่อโครงการ ชื่อผู้ประมาณราคา และประเภทงาน แล้วพาไปเปิดไฟล์แบบต่อเลย"
      ],
      prompts: explainers
    };
  }

  const todo = nextActionLine(input.project.progress);
  return {
    greeting: [`วันนี้กลับมาที่ ${input.project.name} นะครับ`, todo],
    prompts: [{ question: "ตอนนี้ค้างอยู่ตรงไหน", answer: todo }, ...explainers]
  };
}
