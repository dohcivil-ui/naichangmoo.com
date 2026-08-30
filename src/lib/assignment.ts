/**
 * ปัญหาการจับคู่ที่ดีที่สุดทั้งใบ — Hungarian (Kuhn–Munkres) แบบ O(n³)
 *
 * **ทำไมต้องมี** การจับคู่ทีละบรรทัดโดยเลือกคู่ที่คะแนนดีที่สุดของแต่ละแถว (greedy) ให้คำตอบ
 * ที่แย่กว่าความจริงได้เสมอ ตัวอย่างที่เล็กที่สุดคือสองรายการแย่งบรรทัดราคาเดียวกัน
 *
 *   คอนกรีต 240   ->  บรรทัด A คะแนน 0.90 · บรรทัด B คะแนน 0.60
 *   คอนกรีต 280   ->  บรรทัด A คะแนน 0.85 · บรรทัด B คะแนน 0.10
 *
 * greedy หยิบ A ให้ตัวแรกเพราะ 0.90 สูงสุด เหลือ B ให้ตัวที่สองได้ 0.10 รวม 1.00
 * แต่คำตอบที่ดีที่สุดคือให้ A กับตัวที่สอง แล้วตัวแรกได้ B รวม 1.45 **ต่างกันเกือบครึ่ง**
 * และในของจริงคือหยิบราคาผิดบรรทัดโดยที่ทุกคู่ดู "เข้าท่า" เมื่อดูทีละคู่
 *
 * อัลกอริทึมนี้หาคำตอบที่รวมทั้งใบดีที่สุดพร้อมกัน และรับประกัน **หนึ่งต่อหนึ่ง** โดยธรรมชาติ
 * ของตัวมันเอง ไม่ใช่ด้วยการขอให้ใครทำตาม
 *
 * เขียนแบบ shortest augmenting path พร้อม potential ซึ่งเป็นรูปมาตรฐานที่รับเมทริกซ์
 * ผืนผ้า (แถวไม่เท่าคอลัมน์) ได้ตรง ๆ โดยไม่ต้องเติมแถวหลอก
 */

/**
 * ค่าที่แปลว่า "คู่นี้ต้องห้าม" — ใช้เลขใหญ่ที่ยังบวกลบได้ ไม่ใช่ Infinity
 *
 * Infinity ทำให้เลขคณิตของ potential กลายเป็น NaN ตั้งแต่รอบแรก (`Infinity - Infinity`)
 * แล้วคำตอบจะพังเงียบ ๆ แทนที่จะปฏิเสธคู่นั้น
 */
export const FORBIDDEN_COST = 1e9;

export type Assignment = {
  /** ดัชนีคอลัมน์ที่จับคู่กับแต่ละแถว `-1` คือแถวนั้นไม่มีคู่ */
  columnForRow: number[];
  /** ผลรวมต้นทุนของคู่ที่รับไว้ ไม่นับคู่ต้องห้าม */
  totalCost: number;
};

/**
 * หาการจับคู่ที่ผลรวมต้นทุนต่ำที่สุด
 *
 * `cost[i][j]` คือต้นทุนของการจับแถว `i` กับคอลัมน์ `j` ยิ่งต่ำยิ่งดี คู่ที่ห้ามจับให้ใส่
 * `FORBIDDEN_COST` แล้วมันจะไม่ถูกเลือกเว้นแต่ไม่มีทางเลือกอื่น และจะถูกตัดออกตอนคืนค่า
 *
 * เมทริกซ์ที่แถวมากกว่าคอลัมน์ก็รับได้ ในกรณีนั้นบางแถวจะไม่มีคู่ ซึ่งเป็นคำตอบที่ถูก
 * ไม่ใช่ข้อผิดพลาด — รายการที่หาราคาไม่ได้ต้องเหลือไว้ให้คนเห็น ไม่ใช่ยัดคู่ให้ครบ
 */
export function solveAssignment(cost: readonly (readonly number[])[]): Assignment {
  const rows = cost.length;
  const columns = rows === 0 ? 0 : cost[0].length;
  if (rows === 0 || columns === 0) return { columnForRow: new Array(rows).fill(-1), totalCost: 0 };

  // อัลกอริทึมต้องการแถวไม่เกินคอลัมน์ เมทริกซ์ที่สูงกว่ากว้างจึงสลับแกนแล้วแปลงกลับตอนจบ
  if (rows > columns) {
    const transposed = Array.from({ length: columns }, (_, j) => Array.from({ length: rows }, (_, i) => cost[i][j]));
    const solved = solveAssignment(transposed);
    const columnForRow = new Array<number>(rows).fill(-1);
    solved.columnForRow.forEach((row, column) => {
      if (row >= 0) columnForRow[row] = column;
    });
    return { columnForRow, totalCost: solved.totalCost };
  }

  const potentialRow = new Array<number>(rows + 1).fill(0);
  const potentialColumn = new Array<number>(columns + 1).fill(0);
  /** `rowOfColumn[j]` คือแถวที่ถือคอลัมน์ j อยู่ ช่อง 0 เป็นช่องทำงานของอัลกอริทึม */
  const rowOfColumn = new Array<number>(columns + 1).fill(0);
  const previousColumn = new Array<number>(columns + 1).fill(0);

  for (let row = 1; row <= rows; row += 1) {
    rowOfColumn[0] = row;
    let column = 0;
    const minimum = new Array<number>(columns + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array<boolean>(columns + 1).fill(false);

    do {
      used[column] = true;
      const currentRow = rowOfColumn[column];
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;

      for (let candidate = 1; candidate <= columns; candidate += 1) {
        if (used[candidate]) continue;
        const reduced = cost[currentRow - 1][candidate - 1] - potentialRow[currentRow] - potentialColumn[candidate];
        if (reduced < minimum[candidate]) {
          minimum[candidate] = reduced;
          previousColumn[candidate] = column;
        }
        if (minimum[candidate] < delta) {
          delta = minimum[candidate];
          nextColumn = candidate;
        }
      }

      for (let candidate = 0; candidate <= columns; candidate += 1) {
        if (used[candidate]) {
          potentialRow[rowOfColumn[candidate]] += delta;
          potentialColumn[candidate] -= delta;
        } else {
          minimum[candidate] -= delta;
        }
      }

      column = nextColumn;
    } while (rowOfColumn[column] !== 0);

    do {
      const source = previousColumn[column];
      rowOfColumn[column] = rowOfColumn[source];
      column = source;
    } while (column !== 0);
  }

  const columnForRow = new Array<number>(rows).fill(-1);
  let totalCost = 0;
  for (let candidate = 1; candidate <= columns; candidate += 1) {
    const row = rowOfColumn[candidate];
    if (row === 0) continue;
    const value = cost[row - 1][candidate - 1];
    // คู่ต้องห้ามที่หลุดเข้ามาเพราะไม่มีทางเลือกอื่น ต้องถูกตัดทิ้ง ไม่ใช่รายงานว่าจับคู่ได้
    if (value >= FORBIDDEN_COST) continue;
    columnForRow[row - 1] = candidate - 1;
    totalCost += value;
  }

  return { columnForRow, totalCost };
}
