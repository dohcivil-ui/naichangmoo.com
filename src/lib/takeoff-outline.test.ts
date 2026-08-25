import { describe, expect, it } from "vitest";
import { buildOutline, outlineNumber, type OutlineGroupInput } from "@/lib/takeoff-outline";

function group(id: string, parentId: string | null, title: string, sortOrder: number): OutlineGroupInput {
  return { id, parentId, title, sortOrder };
}

/** The heading structure of the ปร.4 for อาคารฟอกไต ปุญโญภาส. */
const referenceSheet = [
  group("s1", null, "งานส่วนที่ 1", 0),
  group("g1", "s1", "งานดินขุด-ดินถม", 0),
  group("g2", "s1", "งานโครงสร้าง คอนกรีตเสริมเหล็ก", 1),
  group("g3", "s1", "งานโครงหลังคา", 2),
  group("g4", "s1", "งานสถาปัตยกรรม", 3),
  group("g5", "s1", "งานประตู-หน้าต่าง", 4),
  group("g6", "s1", "งานไฟฟ้า", 5),
  group("g7", "s1", "งานสุขภัณฑ์-สุขาภิบาล", 6),
  group("g8", "s1", "งานอื่นๆ", 7)
];

describe("reference sheet numbering", () => {
  it("numbers the headings the way the real sheet prints them", () => {
    const outline = buildOutline(referenceSheet);

    expect(outline.map((node) => `${node.number} ${node.title}`)).toEqual([
      "1 งานส่วนที่ 1",
      "1.1 งานดินขุด-ดินถม",
      "1.2 งานโครงสร้าง คอนกรีตเสริมเหล็ก",
      "1.3 งานโครงหลังคา",
      "1.4 งานสถาปัตยกรรม",
      "1.5 งานประตู-หน้าต่าง",
      "1.6 งานไฟฟ้า",
      "1.7 งานสุขภัณฑ์-สุขาภิบาล",
      "1.8 งานอื่นๆ"
    ]);
  });

  it("renumbers what follows when a heading is removed", () => {
    const withoutRoofing = referenceSheet.filter((entry) => entry.id !== "g3");
    const outline = buildOutline(withoutRoofing);

    // งานสถาปัตยกรรม was 1.4 and is now 1.3, with nothing stored that has to be corrected.
    expect(outlineNumber(outline, "g4")).toBe("1.3");
    expect(outlineNumber(outline, "g8")).toBe("1.7");
  });
});

describe("outline construction", () => {
  it("orders by position and breaks ties by id so a read never shuffles", () => {
    const outline = buildOutline([
      group("b", null, "second", 0),
      group("a", null, "first", 0),
      group("c", null, "third", 1)
    ]);

    expect(outline.map((node) => node.title)).toEqual(["first", "second", "third"]);
  });

  it("reports depth so a caller can indent without parsing the number", () => {
    const outline = buildOutline(referenceSheet);

    expect(outline[0]).toMatchObject({ depth: 1, parentId: null });
    expect(outline[1]).toMatchObject({ depth: 2, parentId: "s1" });
  });

  it("treats a heading whose parent is missing as top level rather than hiding it", () => {
    const outline = buildOutline([group("orphan", "gone", "งานที่หลุดหมวด", 0)]);

    expect(outline).toHaveLength(1);
    expect(outline[0]).toMatchObject({ number: "1", depth: 1 });
  });

  it("does not hang on a heading that is its own parent", () => {
    const outline = buildOutline([group("loop", "loop", "วน", 0)]);

    expect(outline.map((node) => node.number)).toEqual(["1"]);
  });

  it("returns nothing for no headings, and no number for an unfiled item", () => {
    expect(buildOutline([])).toEqual([]);
    expect(outlineNumber(buildOutline(referenceSheet), null)).toBeNull();
    expect(outlineNumber(buildOutline(referenceSheet), "missing")).toBeNull();
  });
});
