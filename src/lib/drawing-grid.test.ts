import { describe, expect, it } from "vitest";
import {
  classifyGridLine,
  gridIntersections,
  gridLabelForIndex,
  nameGridLines,
  nearestIntersection,
  segmentIntersection,
  type DraftedGridLine
} from "@/lib/drawing-grid";

/** เส้นตั้งที่พิกัดแนวนอน x */
const vertical = (id: string, x: number): DraftedGridLine => ({
  id,
  page: 7,
  a: { x, y: 100 },
  b: { x, y: 700 }
});

/** เส้นนอนที่พิกัดแนวตั้ง y */
const horizontal = (id: string, y: number): DraftedGridLine => ({
  id,
  page: 7,
  a: { x: 100, y },
  b: { x: 700, y }
});

describe("จำแนกแนวเสา", () => {
  it("เส้นที่ตั้งกว่านอนเป็นแนวตัวเลข", () => {
    expect(classifyGridLine(vertical("v", 200))).toBe("number");
  });

  it("เส้นที่นอนกว่าตั้งเป็นแนวตัวอักษร", () => {
    expect(classifyGridLine(horizontal("h", 200))).toBe("letter");
  });

  it("เส้นเฉียง 45 องศาพอดีนับเป็นแนวตัวอักษร เพื่อให้ผลออกมาค่าเดียวเสมอ", () => {
    expect(classifyGridLine({ a: { x: 0, y: 0 }, b: { x: 100, y: 100 } })).toBe("letter");
  });
});

describe("ชื่อของแนวตามลำดับ", () => {
  it("แนวตัวเลขเริ่มที่ 1", () => {
    expect(gridLabelForIndex("number", 0)).toBe("1");
    expect(gridLabelForIndex("number", 5)).toBe("6");
  });

  it("แนวตัวอักษรเริ่มที่ A และตัวที่ยี่สิบหกคือ Z", () => {
    expect(gridLabelForIndex("letter", 0)).toBe("A");
    expect(gridLabelForIndex("letter", 25)).toBe("Z");
  });

  it("เกิน Z ต่อด้วย AA แบบชื่อคอลัมน์ของโปรแกรมตาราง", () => {
    expect(gridLabelForIndex("letter", 26)).toBe("AA");
    expect(gridLabelForIndex("letter", 27)).toBe("AB");
  });
});

describe("ไล่ชื่อให้เส้นที่ร่างไว้", () => {
  it("ไล่ชื่อตามตำแหน่งจริง ไม่ใช่ตามลำดับที่ลาก", () => {
    // ลากเส้นขวาสุดก่อน แล้วค่อยลากซ้ายสุด ชื่อต้องยังไล่จากซ้ายไปขวา
    const named = nameGridLines([vertical("c", 404.47), vertical("a", 177.84), vertical("b", 291.15)]);
    expect(named.find((line) => line.id === "a")?.label).toBe("1");
    expect(named.find((line) => line.id === "b")?.label).toBe("2");
    expect(named.find((line) => line.id === "c")?.label).toBe("3");
  });

  it("ลบเส้นกลางแล้วชื่อไล่ใหม่เอง ไม่เหลือช่องว่าง", () => {
    const named = nameGridLines([vertical("a", 177.84), vertical("c", 404.47)]);
    expect(named.map((line) => line.label)).toEqual(["1", "2"]);
  });

  it("แนวตัวอักษรไล่จากบนลงล่าง", () => {
    const named = nameGridLines([horizontal("low", 600), horizontal("high", 200)]);
    expect(named.find((line) => line.id === "high")?.label).toBe("A");
    expect(named.find((line) => line.id === "low")?.label).toBe("B");
  });

  it("นับสองตระกูลแยกกัน เส้นตั้งกับเส้นนอนไม่แย่งลำดับกัน", () => {
    const named = nameGridLines([vertical("v1", 100), horizontal("h1", 100), vertical("v2", 300)]);
    expect(named.find((line) => line.id === "v1")?.label).toBe("1");
    expect(named.find((line) => line.id === "v2")?.label).toBe("2");
    expect(named.find((line) => line.id === "h1")?.label).toBe("A");
  });

  it("ชื่อที่คนพิมพ์ทับชนะชื่อที่ระบบไล่ให้ แต่ยังบอกได้ว่าระบบไล่ให้เป็นอะไร", () => {
    const named = nameGridLines([{ ...vertical("a", 177.84), label: "C" }, vertical("b", 291.15)]);
    const overridden = named.find((line) => line.id === "a");
    expect(overridden?.label).toBe("C");
    expect(overridden?.autoLabel).toBe("1");
  });

  it("พิมพ์ทับเส้นหนึ่งแล้วเส้นอื่นยังไล่ชื่อเองต่อไป ไม่กลายเป็นค่าค้าง", () => {
    const named = nameGridLines([{ ...vertical("a", 100), label: "C" }, vertical("b", 300), vertical("c", 500)]);
    expect(named.find((line) => line.id === "b")?.label).toBe("2");
    expect(named.find((line) => line.id === "c")?.label).toBe("3");
  });

  it("ชื่อที่พิมพ์ทับเป็นช่องว่างล้วนไม่นับ ให้กลับไปใช้ชื่อที่ไล่ให้", () => {
    const named = nameGridLines([{ ...vertical("a", 100), label: "   " }]);
    expect(named[0].label).toBe("1");
  });
});

describe("จุดตัดของเส้น", () => {
  it("หาจุดตัดที่อยู่บนตัวเส้นทั้งคู่", () => {
    const point = segmentIntersection(vertical("v", 200), horizontal("h", 400));
    expect(point).toEqual({ x: 200, y: 400 });
  });

  it("ไม่นับจุดตัดที่อยู่บนเส้นต่อออกไปนอกช่วง", () => {
    const short = { a: { x: 200, y: 100 }, b: { x: 200, y: 150 } };
    expect(segmentIntersection(short, horizontal("h", 400))).toBeNull();
  });

  it("เส้นขนานไม่มีจุดตัด", () => {
    expect(segmentIntersection(vertical("v1", 200), vertical("v2", 300))).toBeNull();
  });
});

describe("จุดตัดของแนวเสาทั้งหน้า", () => {
  const lines = nameGridLines([
    vertical("v1", 200),
    vertical("v2", 400),
    vertical("v3", 600),
    horizontal("h1", 200),
    horizontal("h2", 600)
  ]);

  it("กริดสามตั้งสองนอนได้หกจุด ป้ายเป็นเลขก่อนตัวอักษร", () => {
    const found = gridIntersections(lines);
    expect(found).toHaveLength(6);
    expect(found.map((entry) => entry.label).sort()).toEqual([
      "1-A",
      "1-B",
      "2-A",
      "2-B",
      "3-A",
      "3-B"
    ]);
  });

  it("จุดตัดอยู่ตรงตำแหน่งจริง", () => {
    const found = gridIntersections(lines);
    expect(found.find((entry) => entry.label === "2-B")?.point).toEqual({ x: 400, y: 600 });
  });

  it("เส้นตระกูลเดียวกันไม่จับคู่กัน แม้จะลากตัดกันเองก็ตาม", () => {
    const crossed = nameGridLines([
      { id: "a", page: 7, a: { x: 100, y: 100 }, b: { x: 100, y: 700 } },
      { id: "b", page: 7, a: { x: 300, y: 100 }, b: { x: 300, y: 700 } }
    ]);
    expect(gridIntersections(crossed)).toHaveLength(0);
  });

  it("มีแต่แนวเดียวยังไม่มีจุดตัด", () => {
    expect(gridIntersections(nameGridLines([vertical("v", 200)]))).toHaveLength(0);
  });

  it("ใช้ชื่อที่คนพิมพ์ทับในป้ายจุดตัดด้วย", () => {
    const renamed = nameGridLines([{ ...vertical("v", 200), label: "5" }, horizontal("h", 400)]);
    expect(gridIntersections(renamed)[0].label).toBe("5-A");
  });
});

describe("จุดตัดที่ใกล้ที่สุด", () => {
  const found = gridIntersections(
    nameGridLines([vertical("v1", 200), vertical("v2", 400), horizontal("h1", 300)])
  );

  it("ตอบชื่อจุดตัดที่หมุดปักอยู่ ทำให้เขียนลงเอกสารได้แทนพิกัดดิบ", () => {
    expect(nearestIntersection(found, { x: 205, y: 297 }, 20)?.label).toBe("1-A");
  });

  it("เลือกจุดที่ใกล้กว่าเมื่อมีหลายจุดอยู่ในระยะ", () => {
    expect(nearestIntersection(found, { x: 390, y: 300 }, 500)?.label).toBe("2-A");
  });

  it("คืน null เมื่อไม่มีจุดตัดไหนอยู่ในระยะ เพราะฐานรากนอกแนวเสาก็มีจริง", () => {
    expect(nearestIntersection(found, { x: 205, y: 297 }, 2)).toBeNull();
    expect(nearestIntersection([], { x: 0, y: 0 }, 100)).toBeNull();
  });
});
