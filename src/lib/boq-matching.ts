import { FORBIDDEN_COST, solveAssignment } from "@/lib/assignment";
import { buildIdf, cosineSimilarity, tokenize } from "@/lib/text-similarity";

/**
 * แผนการจับคู่ปริมาณกับบรรทัดราคา ที่คิดด้วยอัลกอริทึมก่อนถามแบบจำลอง (IP-219)
 *
 * **หน้าที่ของอัลกอริทึมคือคัดกรองและรับประกัน ไม่ใช่ตัดสิน** สามอย่างที่มันทำได้ดีกว่า
 * แบบจำลองแน่นอน และทำได้ฟรี
 *
 *   หนึ่ง **ตัดของที่เป็นไปไม่ได้ทิ้งก่อน** หน่วยคนละอย่างคือคนละของ ไม่ต้องถามใคร
 *   สอง  **รับประกันหนึ่งต่อหนึ่ง** ด้วย Hungarian ไม่ใช่ด้วยการขอในคำสั่งให้แบบจำลองทำตาม
 *   สาม  **ให้ผลเดิมทุกครั้ง** อินพุตเดียวกันได้คำตอบเดียวกันเสมอ ตรวจซ้ำได้จริง
 *
 * **สิ่งที่มันทำไม่ได้ และวัดมาแล้วว่าทำไม่ได้** วัดกับบัญชีจริงเมื่อ 2026-08-30 พบว่า
 * "คอนกรีตโครงสร้างฐานราก กำลังอัด 240" ได้คะแนนกับบรรทัดที่ถูก **0.2927** และกับบรรทัด
 * ที่ผิด **0.2919** ห่างกัน 0.0008 ซึ่งเท่ากับแยกไม่ออก สาเหตุคือชื่อในบัญชี สนค. มีกำลังอัด
 * สองค่าอยู่ในบรรทัดเดียว — "ลูกบาศก์ 240 และรูปทรงกระบอก 210" — บรรทัดของ 280 จึงมีเลข
 * 240 อยู่ด้วย การนับคำจึงไม่มีทางรู้ว่าเลขไหนคือค่าที่ใช้เทียบ ต้องเข้าใจความหมายของประโยค
 *
 * ผลคือกติกาการแบ่งระดับที่นี่ตัดสินด้วย **ระยะห่างจากอันดับสอง ไม่ใช่คะแนนดิบ** คู่ที่นำ
 * อันดับสองไม่ขาดคือคู่ที่ต้องให้คนหรือแบบจำลองดู ต่อให้คะแนนดิบจะสูงแค่ไหนก็ตาม
 */

export type MatchItem = { ref: string; description: string; unit: string };
export type MatchLine = { ref: string; name: string; unit: string };

/**
 * เกณฑ์สองตัวที่ตั้งจากการวัดกับข้อมูลจริงหนึ่งชุด ไม่ใช่จากความรู้สึก
 *
 * `MIN_SCORE` — ต่ำกว่านี้ถือว่าไม่เกี่ยวข้องกันเลย ในตารางที่วัด ของที่ไม่เกี่ยวกันได้ 0.0000
 * ส่วนของที่เกี่ยวกันจริงอยู่ราว 0.23 ถึง 0.29 ค่านี้จึงกันเฉพาะขยะออก ไม่ได้ตัดของที่ใช้ได้
 *
 * `CLEAR_MARGIN` — ต้องนำอันดับสองเท่านี้ถึงจะเรียกว่าชัด กรณี 240 กับ 280 ที่วัดได้ห่างกัน
 * 0.0008 จึงตกเป็นไม่ชัดตามที่ควรเป็น
 *
 * **ทั้งสองค่าต้องวัดใหม่เมื่อบัญชีราคาโตขึ้นหรือเปลี่ยนแหล่ง** ค่าที่ตั้งจากข้อมูลชุดเดียว
 * คือค่าที่ถูกกับข้อมูลชุดนั้น ไม่ใช่ค่าที่ถูกตลอดไป
 */
export const MIN_SCORE = 0.1;
export const CLEAR_MARGIN = 0.05;

/** จำนวนตัวเลือกต่อรายการที่ส่งต่อให้แบบจำลองดู มากกว่านี้คือจ่าย token โดยไม่ได้ความแม่นเพิ่ม */
export const SHORTLIST_SIZE = 5;

export type Candidate = { lineRef: string; score: number };

export type PlannedMatch = {
  itemRef: string;
  /** คู่ที่ดีที่สุดเมื่อคิดทั้งใบพร้อมกัน ไม่ใช่ที่ดีที่สุดของแถวนี้เดี่ยว ๆ */
  lineRef: string;
  score: number;
  /** ระยะห่างจากตัวเลือกอันดับสองของรายการนี้ ตัวเลขที่ตัดสินว่าชัดหรือไม่ชัด */
  margin: number;
  /** `ชัด` ไม่ต้องถามใครต่อ · `ไม่ชัด` ต้องให้แบบจำลองหรือคนดูตัวเลือกทั้งหมด */
  band: "ชัด" | "ไม่ชัด";
  /** ตัวเลือกที่เหลือของรายการนี้ เรียงจากคะแนนมากไปน้อย */
  shortlist: Candidate[];
};

export type MatchPlan = {
  matched: PlannedMatch[];
  /** รายการที่ไม่มีบรรทัดไหนผ่านทั้งด่านหน่วยและคะแนนขั้นต่ำ */
  unmatched: { itemRef: string; reason: string }[];
};

/**
 * คิดแผนการจับคู่ทั้งใบ
 *
 * ไม่แตะฐานข้อมูลและไม่เรียกแบบจำลอง เป็นฟังก์ชันบริสุทธิ์ล้วน จึงทดสอบได้ตรง ๆ และให้ผลเดิม
 * ทุกครั้ง ซึ่งเป็นคุณสมบัติที่การตรวจซ้ำต้องการ
 */
export function planMatches(items: readonly MatchItem[], lines: readonly MatchLine[]): MatchPlan {
  if (items.length === 0 || lines.length === 0) {
    return {
      matched: [],
      unmatched: items.map((item) => ({ itemRef: item.ref, reason: "ยังไม่มีบรรทัดราคาให้เทียบ" }))
    };
  }

  // คลังอ้างอิงของ idf คือชื่อทั้งสองฝั่งรวมกัน คำที่สามัญในบัญชีราคาก็สามัญในรายการถอดปริมาณ
  const corpus = [...items.map((item) => item.description), ...lines.map((line) => line.name)].map(tokenize);
  const idf = buildIdf(corpus);
  const itemTokens = items.map((item) => tokenize(item.description));
  const lineTokens = lines.map((line) => tokenize(line.name));

  const score = items.map((item, row) =>
    lines.map((line, column) => {
      // ด่านหน่วย ตัดก่อนคิดคะแนน หน่วยคนละอย่างคือคนละของ แม้ชื่อจะเหมือนกันทุกตัวอักษร
      if (item.unit !== line.unit) return 0;
      return cosineSimilarity(itemTokens[row], lineTokens[column], idf);
    })
  );

  const cost = score.map((row) => row.map((value) => (value < MIN_SCORE ? FORBIDDEN_COST : 1 - value)));
  const { columnForRow } = solveAssignment(cost);

  const matched: PlannedMatch[] = [];
  const unmatched: MatchPlan["unmatched"] = [];

  items.forEach((item, row) => {
    const ranked = lines
      .map((line, column) => ({ lineRef: line.ref, score: score[row][column] }))
      .filter((candidate) => candidate.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    const column = columnForRow[row];
    if (column < 0 || ranked.length === 0) {
      unmatched.push({
        itemRef: item.ref,
        reason:
          lines.every((line) => line.unit !== item.unit)
            ? `ไม่มีบรรทัดราคาที่หน่วยเป็น ${item.unit}`
            : "ไม่มีบรรทัดราคาที่ชื่อใกล้เคียงพอ"
      });
      return;
    }

    const chosen = score[row][column];
    const runnerUp = ranked.find((candidate) => candidate.lineRef !== lines[column].ref)?.score ?? 0;
    const margin = chosen - runnerUp;

    matched.push({
      itemRef: item.ref,
      lineRef: lines[column].ref,
      score: chosen,
      margin,
      band: margin >= CLEAR_MARGIN ? "ชัด" : "ไม่ชัด",
      shortlist: ranked.slice(0, SHORTLIST_SIZE)
    });
  });

  return { matched, unmatched };
}
