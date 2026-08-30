import { registerSkills } from "@/server/ai/skill-registry";
import { escalationKSkills } from "@/server/ai/skills/escalation-k";
import { estimeterSkills } from "@/server/ai/skills/estimeter";
import { workPlanSkills } from "@/server/ai/skills/work-plan";

/**
 * จุดเดียวที่ทะเบียนถูกเติม
 *
 * ทุกอย่างที่ต้องรู้ว่าแพลตฟอร์มมีผู้ช่วยอะไรบ้าง — ประตู เทสต์กฎร่วม และวันหนึ่งคือคำแถลง
 * บนทะเบียนแอปตาม IP-190 — import ไฟล์นี้ไฟล์เดียว ไม่ต้องรู้ว่าทักษะอยู่ไฟล์ไหน
 *
 * ลงทะเบียนตอน import ไม่ใช่ตอนเรียกใช้ครั้งแรก เพราะทะเบียนที่เติมแบบขี้เกียจจะทำให้เทสต์
 * ที่เดินไล่ทั้งทะเบียนเห็นรายการว่างแล้วผ่านฉลุย ซึ่งเป็นการผ่านที่แย่ที่สุดแบบหนึ่ง
 */
registerSkills([...workPlanSkills, ...escalationKSkills, ...estimeterSkills]);

export { findSkill, listSkills, appsWithAssistant } from "@/server/ai/skill-registry";
