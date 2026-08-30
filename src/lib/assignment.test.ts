import { describe, expect, it } from "vitest";
import { FORBIDDEN_COST, solveAssignment } from "@/lib/assignment";

/** ต้นทุนของคำตอบหนึ่งชุด คิดจากเมทริกซ์ตรง ๆ เพื่อไม่ให้เชื่อยอดที่อัลกอริทึมรายงานเอง */
const costOf = (matrix: number[][], columnForRow: number[]) =>
  columnForRow.reduce((sum, column, row) => (column < 0 ? sum : sum + matrix[row][column]), 0);

describe("การจับคู่ที่ดีที่สุดทั้งใบ", () => {
  it("เมทริกซ์ว่างคืนคำตอบว่าง ไม่ใช่โยน", () => {
    expect(solveAssignment([])).toEqual({ columnForRow: [], totalCost: 0 });
    expect(solveAssignment([[]])).toEqual({ columnForRow: [-1], totalCost: 0 });
  });

  it("คู่เดียวก็จับ", () => {
    expect(solveAssignment([[5]])).toEqual({ columnForRow: [0], totalCost: 5 });
  });

  /**
   * ข้อที่เป็นเหตุผลของไฟล์ทั้งไฟล์
   *
   * greedy จะหยิบคู่ที่ถูกที่สุดของแถวแรกก่อน ซึ่งคือ (0,0) ที่ราคา 10 แล้วเหลือ (1,1)
   * ที่ราคา 90 รวมเป็น 100 ส่วนคำตอบที่ดีที่สุดคือ 15 + 20 = 35
   */
  it("ไม่ตกหลุมของการเลือกคู่ที่ดีที่สุดทีละแถว", () => {
    const matrix = [
      [10, 15],
      [10, 90]
    ];
    const solved = solveAssignment(matrix);
    expect(solved.totalCost).toBe(25);
    expect(solved.columnForRow).toEqual([1, 0]);
    expect(costOf(matrix, solved.columnForRow)).toBe(25);
  });

  it("รายการมากกว่าบรรทัดราคา รายการที่เหลือไม่มีคู่ ไม่ใช่ถูกยัดคู่ให้ครบ", () => {
    const matrix = [[1, 9], [2, 8], [3, 7]];
    const solved = solveAssignment(matrix);
    expect(solved.columnForRow.filter((column) => column >= 0)).toHaveLength(2);
    expect(solved.columnForRow.filter((column) => column === -1)).toHaveLength(1);
    // ทุกคอลัมน์ถูกใช้ได้ครั้งเดียว
    const used = solved.columnForRow.filter((column) => column >= 0);
    expect(new Set(used).size).toBe(used.length);
  });

  it("บรรทัดราคามากกว่ารายการ ทุกรายการได้คู่และไม่มีบรรทัดไหนถูกใช้ซ้ำ", () => {
    const matrix = [
      [4, 1, 9],
      [5, 8, 2]
    ];
    const solved = solveAssignment(matrix);
    expect(solved.columnForRow).toEqual([1, 2]);
    expect(solved.totalCost).toBe(3);
  });

  it("คู่ต้องห้ามไม่ถูกเลือก แม้จะเป็นทางเดียวที่เหลือ", () => {
    const matrix = [
      [FORBIDDEN_COST, 2],
      [FORBIDDEN_COST, FORBIDDEN_COST]
    ];
    const solved = solveAssignment(matrix);
    expect(solved.columnForRow[0]).toBe(1);
    expect(solved.columnForRow[1]).toBe(-1);
    expect(solved.totalCost).toBe(2);
  });

  /**
   * ข้อที่พิสูจน์ว่า "ดีที่สุด" เป็นคำที่จริง ไม่ใช่คำโฆษณา
   *
   * สุ่มเมทริกซ์เล็กแล้วไล่ทุกการจับคู่ที่เป็นไปได้ด้วยมือ เทียบกับที่อัลกอริทึมตอบ
   * ถ้ามันแพ้การไล่ทั้งหมดแม้ครั้งเดียว แปลว่ามันไม่ได้หาคำตอบที่ดีที่สุดจริง
   */
  it("ตรงกับการไล่ทุกความเป็นไปได้ ในเมทริกซ์เล็กที่ไล่ไหว", () => {
    let seed = 20260830;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let round = 0; round < 40; round += 1) {
      const size = 2 + Math.floor(random() * 3);
      const matrix = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => Math.round(random() * 100))
      );

      const permutations: number[][] = [];
      const walk = (current: number[], left: number[]) => {
        if (left.length === 0) permutations.push(current);
        else left.forEach((value, index) => walk([...current, value], left.filter((_, i) => i !== index)));
      };
      walk([], Array.from({ length: size }, (_, index) => index));

      const best = Math.min(...permutations.map((permutation) => costOf(matrix, permutation)));
      expect(solveAssignment(matrix).totalCost).toBe(best);
    }
  });
});
