import { describe, expect, it } from "vitest";
import { planMatches, type MatchItem, type MatchLine } from "@/lib/boq-matching";

const item = (ref: string, description: string, unit = "ลบ.ม."): MatchItem => ({ ref, description, unit });
const line = (ref: string, name: string, unit = "ลบ.ม."): MatchLine => ({ ref, name, unit });

describe("แผนการจับคู่", () => {
  it("ไม่มีบรรทัดราคา ทุกรายการไม่มีคู่ ไม่ใช่โยน", () => {
    const plan = planMatches([item("Q1", "คอนกรีตฐานราก")], []);
    expect(plan.matched).toEqual([]);
    expect(plan.unmatched).toHaveLength(1);
  });

  it("หน่วยคนละอย่างจับคู่กันไม่ได้ แม้ชื่อจะเหมือนกันทุกตัวอักษร", () => {
    const plan = planMatches(
      [item("Q1", "อิฐมอญก่อผนัง", "ตร.ม.")],
      [line("P1", "อิฐมอญก่อผนัง", "ก้อน")]
    );
    expect(plan.matched).toEqual([]);
    expect(plan.unmatched[0].reason).toContain("ตร.ม.");
  });

  /**
   * ข้อที่รับประกันสิ่งที่ผู้ช่วยรุ่นก่อนหน้าได้แค่ขอไว้ในคำสั่ง
   *
   * รุ่นแรกบอกแบบจำลองว่า "ห้ามใช้บรรทัดเดิมซ้ำสองรายการ" แต่ไม่มีอะไรบังคับ
   * ตรงนี้บังคับด้วยตัวอัลกอริทึม สองรายการจึงชี้บรรทัดเดียวกันไม่ได้เลย
   */
  it("บรรทัดราคาหนึ่งบรรทัดถูกใช้ได้ครั้งเดียว", () => {
    const plan = planMatches(
      [item("Q1", "คอนกรีตหยาบรองพื้น 180"), item("Q2", "คอนกรีตโครงสร้าง 240")],
      [line("P1", "คอนกรีตผสมเสร็จ 180"), line("P2", "คอนกรีตผสมเสร็จ 240")]
    );
    const used = plan.matched.map((match) => match.lineRef);
    expect(new Set(used).size).toBe(used.length);
  });

  /**
   * ข้อที่พิสูจน์ว่าการคิดทั้งใบพร้อมกันให้คำตอบดีกว่าการเลือกทีละแถว
   *
   * ถ้าเลือกทีละแถว Q1 จะคว้า P2 ไปเพราะชื่อมันใกล้กว่า แล้ว Q2 จะเหลือ P1 ซึ่งผิดทั้งคู่
   */
  it("ยอมให้รายการแรกได้คู่ที่แย่ลง ถ้าทำให้ทั้งใบดีขึ้น", () => {
    const plan = planMatches(
      [item("Q1", "คอนกรีตโครงสร้าง 240 ฐานราก"), item("Q2", "คอนกรีตโครงสร้าง 240 เสา")],
      [line("P1", "คอนกรีตผสมเสร็จ 240 สำหรับฐานราก"), line("P2", "คอนกรีตผสมเสร็จ 240 สำหรับเสา")]
    );
    const byItem = new Map(plan.matched.map((match) => [match.itemRef, match.lineRef]));
    expect(byItem.get("Q1")).toBe("P1");
    expect(byItem.get("Q2")).toBe("P2");
  });

  /**
   * ข้อที่บันทึกข้อจำกัดที่วัดมาแล้ว ไม่ใช่ข้อที่ทดสอบว่ามันเก่ง
   *
   * ชื่อในบัญชี สนค. มีกำลังอัดสองค่าในบรรทัดเดียว บรรทัดของ 280 จึงมีเลข 240 อยู่ด้วย
   * การนับคำแยกสองบรรทัดนี้ไม่ออก และต้องรายงานว่าไม่ชัด ไม่ใช่เดาแล้วบอกว่ามั่นใจ
   *
   * ถ้าวันหนึ่งมีคนทำให้ข้อนี้ตกเพราะมันแยกออกแล้ว นั่นคือข่าวดี ให้แก้เทสต์พร้อมแนบผลวัดใหม่
   */
  it("ชื่อที่มีเลขสองค่าในบรรทัดเดียว ต้องถูกรายงานว่าไม่ชัด", () => {
    const plan = planMatches(
      [item("Q1", "คอนกรีตโครงสร้างฐานราก กำลังอัด 240 กก./ตร.ซม.")],
      [
        line("P1", "คอนกรีตผสมเสร็จรูปลูกบาศก์ 240 กก./ตร.ซม. และรูปทรงกระบอก 210 กก./ตร.ซม. ตราซีแพค"),
        line("P2", "คอนกรีตผสมเสร็จรูปลูกบาศก์ 280 กก./ตร.ซม. และรูปทรงกระบอก 240 กก./ตร.ซม. ตราซีแพค")
      ]
    );
    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0].band).toBe("ไม่ชัด");
    expect(plan.matched[0].margin).toBeLessThan(0.05);
    // ตัวเลือกทั้งสองต้องถูกส่งต่อให้คนหรือแบบจำลองดู ไม่ใช่ตัดเหลือตัวเดียวแล้วบอกว่าเลือกแล้ว
    expect(plan.matched[0].shortlist).toHaveLength(2);
  });

  it("ของที่ไม่เกี่ยวกันเลยไม่ถูกยัดคู่ให้ครบ", () => {
    const plan = planMatches(
      [item("Q1", "คอนกรีตโครงสร้างฐานราก 240")],
      [line("P1", "สีน้ำอะครีลิคทาภายนอก ชนิดกึ่งเงา")]
    );
    expect(plan.matched).toEqual([]);
    expect(plan.unmatched[0].reason).toContain("ใกล้เคียง");
  });

  it("อินพุตเดียวกันให้ผลเดิมทุกครั้ง ซึ่งเป็นเงื่อนไขของการตรวจซ้ำ", () => {
    const items = [item("Q1", "คอนกรีตโครงสร้าง 240"), item("Q2", "คอนกรีตหยาบ 180")];
    const lines = [line("P1", "คอนกรีตผสมเสร็จ 180"), line("P2", "คอนกรีตผสมเสร็จ 240")];
    const first = planMatches(items, lines);
    for (let round = 0; round < 5; round += 1) {
      expect(planMatches(items, lines)).toEqual(first);
    }
  });
});
