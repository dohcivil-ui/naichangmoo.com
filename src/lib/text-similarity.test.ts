import { describe, expect, it } from "vitest";
import { buildIdf, cosineSimilarity, tokenize } from "@/lib/text-similarity";

const similarityIn = (corpus: string[], left: string, right: string) => {
  const idf = buildIdf(corpus.map(tokenize));
  return cosineSimilarity(tokenize(left), tokenize(right), idf);
};

describe("การแตกชื่อรายการเป็น token", () => {
  it("ตัวเลขเป็น token ของตัวเอง เพราะมันคือชั้นคุณภาพและขนาด", () => {
    expect(tokenize("คอนกรีต 240")).toContain("n:240");
  });

  it("ศูนย์ท้ายทศนิยมไม่ทำให้เลขเดียวกันกลายเป็นคนละตัว", () => {
    expect(tokenize("ท่อ 6.00 นิ้ว")).toContain("n:6");
    expect(tokenize("ท่อ 6 นิ้ว")).toContain("n:6");
  });

  it("อังกฤษไม่แยกตัวพิมพ์ใหญ่เล็ก", () => {
    expect(tokenize("Portland Cement")).toEqual(expect.arrayContaining(["portland", "cement"]));
  });

  it("ภาษาไทยแตกเป็น n-gram สามตัวอักษร ไม่ได้แกล้งตัดคำ", () => {
    expect(tokenize("ฐานราก")).toEqual(["ฐาน", "านร", "นรา", "ราก"]);
  });

  it("คำไทยที่สั้นกว่าสาม เก็บทั้งคำ ไม่ทิ้ง", () => {
    expect(tokenize("ดิน")).toEqual(["ดิน"]);
    expect(tokenize("ไม้")).toEqual(["ไม้"]);
  });
});

describe("คะแนนความเหมือน", () => {
  const catalogue = [
    "คอนกรีตผสมเสร็จรูปลูกบาศก์ 180 กก./ตร.ซม.",
    "คอนกรีตผสมเสร็จรูปลูกบาศก์ 240 กก./ตร.ซม.",
    "คอนกรีตผสมเสร็จรูปลูกบาศก์ 280 กก./ตร.ซม.",
    "อิฐมอญ ขนาด 6.5x14x3 ซม.",
    "เหล็กเส้นกลมผิวเรียบ SR24 ขนาด 9 มม."
  ];

  it("ชื่อเดียวกันได้หนึ่ง", () => {
    const idf = buildIdf(catalogue.map(tokenize));
    const tokens = tokenize(catalogue[1]);
    expect(cosineSimilarity(tokens, tokens, idf)).toBeCloseTo(1, 10);
  });

  it("ชื่อว่างได้ศูนย์ ไม่ใช่ NaN", () => {
    const idf = buildIdf(catalogue.map(tokenize));
    expect(cosineSimilarity([], tokenize("คอนกรีต"), idf)).toBe(0);
    expect(cosineSimilarity([], [], idf)).toBe(0);
  });

  /**
   * ข้อที่เป็นเหตุผลของการใช้ TF-IDF แทนการนับคำที่ตรงกัน
   *
   * ทั้งสามบรรทัดในบัญชีมีคำว่า คอนกรีตผสมเสร็จรูปลูกบาศก์ เหมือนกันหมด สิ่งเดียวที่แยก
   * มันออกจากกันคือตัวเลข ถ้าน้ำหนักของคำสามัญไม่ถูกกดลง คะแนนของทั้งสามจะเกือบเท่ากัน
   * แล้วการจับคู่จะกลายเป็นการเดา
   */
  it("ตัวเลขที่ต่างกันแยกของที่ชื่อเหมือนกันเกือบทั้งบรรทัดออกจากกันได้", () => {
    const to240 = similarityIn(catalogue, "คอนกรีตโครงสร้างฐานราก กำลังอัด 240 กก./ตร.ซม.", catalogue[1]);
    const to280 = similarityIn(catalogue, "คอนกรีตโครงสร้างฐานราก กำลังอัด 240 กก./ตร.ซม.", catalogue[2]);
    expect(to240).toBeGreaterThan(to280);
  });

  it("ของคนละชนิดได้คะแนนต่ำกว่าของชนิดเดียวกันเสมอ", () => {
    const toConcrete = similarityIn(catalogue, "คอนกรีตโครงสร้างฐานราก 240", catalogue[1]);
    const toBrick = similarityIn(catalogue, "คอนกรีตโครงสร้างฐานราก 240", catalogue[3]);
    expect(toConcrete).toBeGreaterThan(toBrick);
  });

  it("ไม่มี token ร่วมกันเลยได้ศูนย์", () => {
    expect(similarityIn(catalogue, "abc", "xyz")).toBe(0);
  });
});
