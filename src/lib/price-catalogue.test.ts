import { describe, expect, it } from "vitest";
import {
  categoryTally,
  formatMonthKey,
  formatPercent,
  formatPrice,
  itemsWithPriceIn,
  latestReading,
  lineCost,
  movement,
  searchCatalogue,
  sparkGeometry,
  sumSatang,
  toSatang,
  withVat,
  type CatalogueItem,
  type PriceCatalogue
} from "@/lib/price-catalogue";

const months = ["2569-01", "2569-02", "2569-03", "2569-04"];

const sand: CatalogueItem = {
  code: "1601010100100000",
  name: "ทรายหยาบ",
  unit: "ลบ.ม.",
  cat: "16",
  catName: "วัสดุผสมคอนกรีต",
  prices: { "10": [508.33, 510, null, null], "50": [null, null, 600, 590] }
};

const cement: CatalogueItem = {
  code: "1501010101100000",
  name: "ปูนซีเมนต์ปอร์ตแลนด์ ปูนถุง ประเภท 1 ตราช้าง",
  unit: "ตัน",
  cat: "15",
  catName: "วัสดุผลิตภัณฑ์",
  prices: { "10": [3800, null, null, 3376.64] }
};

const catalogue: PriceCatalogue = {
  source: {
    publisher: "สนค.",
    dataset: "CMIP",
    endpoint: "https://index.tpso.go.th/api/cmip/filter",
    lastUpdated: "2026-08-12T15:17:21.940918Z",
    latestPeriod: "2569-04",
    vatRate: 0.07,
    retrievedAt: "2026-08-26",
    coverage: { "10": 2, "50": 1 }
  },
  months,
  provinces: [
    { code: "10", name: "ส่วนกลาง" },
    { code: "50", name: "เชียงใหม่" }
  ],
  items: [sand, cement]
};

describe("การแปลงเงิน", () => {
  it("แปลงบาททศนิยมสองตำแหน่งเป็นสตางค์โดยไม่เพี้ยนจากเลขทศนิยมลอย", () => {
    expect(toSatang(508.33)).toBe(50833n);
    expect(toSatang(3376.64)).toBe(337664n);
    expect(toSatang(0.07)).toBe(7n);
  });

  it("คิด VAT ได้ตรงกับ priceVAT ที่ สนค. ส่งมาเอง", () => {
    // ของจริงจากชุดข้อมูล: 3110 -> 3327.70 และ 2543.40 -> 2721.44
    expect(withVat(toSatang(3110), 0.07)).toBe(toSatang(3327.7));
    expect(withVat(toSatang(2543.4), 0.07)).toBe(toSatang(2721.44));
  });
});

describe("ราคาล่าสุดที่มีจริง", () => {
  it("ถอยหลังไปหาเดือนที่มีราคาเมื่อเดือนที่เลือกว่าง และบอกเดือนนั้นกลับมา", () => {
    const reading = latestReading(catalogue, sand, "10", 3);
    expect(reading).not.toBeNull();
    expect(reading?.month).toBe("2569-02");
    expect(reading?.satang).toBe(51000n);
  });

  it("คืน null เมื่อจังหวัดนั้นไม่มีข้อมูลของรายการนี้เลย", () => {
    expect(latestReading(catalogue, cement, "50", 3)).toBeNull();
  });

  it("ไม่มองข้ามเดือนที่เลือกไปข้างหน้า", () => {
    const reading = latestReading(catalogue, sand, "50", 2);
    expect(reading?.month).toBe("2569-03");
    expect(latestReading(catalogue, sand, "50", 1)).toBeNull();
  });
});

describe("การขยับของราคา", () => {
  it("เทียบกับจุดก่อนหน้าที่มีข้อมูล ไม่ใช่เดือนก่อนหน้าตามปฏิทิน", () => {
    const change = movement(catalogue, cement, "10", 3);
    expect(change?.previous.month).toBe("2569-01");
    expect(change?.current.month).toBe("2569-04");
    expect(change?.direction).toBe("fall");
    expect(change?.deltaSatang).toBe(337664n - 380000n);
  });

  it("ราคาขึ้นเป็นบวก", () => {
    const change = movement(catalogue, sand, "10", 3);
    expect(change?.direction).toBe("rise");
    expect(change?.deltaSatang).toBe(167n);
    expect(change?.percent).toBeCloseTo(0.328, 2);
  });

  it("คืน null เมื่อมีจุดเดียว เพราะยังเทียบอะไรไม่ได้", () => {
    expect(movement(catalogue, sand, "50", 2)).toBeNull();
  });
});

describe("การคิดค่างาน", () => {
  it("คูณปริมาณแล้วปัดที่สตางค์", () => {
    expect(lineCost(50833n, 12.5)).toBe(635413n);
    expect(lineCost(50833n, 0)).toBe(0n);
  });

  it("บวกกันได้โดยไม่สะสมความคลาดเคลื่อน", () => {
    const lines = [lineCost(33333n, 3), lineCost(33333n, 3), lineCost(33333n, 3)];
    expect(sumSatang(lines)).toBe(299997n);
  });
});

describe("การค้นหาและการนับ", () => {
  it("ต้องเจอครบทุกคำที่พิมพ์ ไม่ต้องเรียงตามชื่อเต็ม", () => {
    expect(searchCatalogue(catalogue.items, "ปูน ช้าง").map((item) => item.code)).toEqual([cement.code]);
    expect(searchCatalogue(catalogue.items, "ทราย")).toHaveLength(1);
    expect(searchCatalogue(catalogue.items, "ทราย ปูน")).toHaveLength(0);
  });

  it("ค้นด้วยรหัสสินค้าบางส่วนได้", () => {
    expect(searchCatalogue(catalogue.items, "160101")).toHaveLength(1);
  });

  it("คัดเฉพาะรายการที่จังหวัดนั้นมีราคาจริง", () => {
    expect(itemsWithPriceIn(catalogue.items, "50")).toHaveLength(1);
    expect(itemsWithPriceIn(catalogue.items, "10")).toHaveLength(2);
  });

  it("นับรายการต่อหมวดโดยเรียงตามรหัสหมวด", () => {
    expect(categoryTally(catalogue.items)).toEqual([
      { cat: "15", catName: "วัสดุผลิตภัณฑ์", count: 1 },
      { cat: "16", catName: "วัสดุผสมคอนกรีต", count: 1 }
    ]);
  });
});

describe("เส้นแนวโน้ม", () => {
  it("ตัดเส้นเป็นท่อนตามช่องว่าง ไม่ลากเชื่อมข้ามเดือนที่ไม่มีราคา", () => {
    const geometry = sparkGeometry([1, 2, null, 4, 5], 100, 20, 0);
    // สองท่อน ไม่ใช่ท่อนเดียว — เดือนที่สามที่ไม่มีราคาต้องตัดเส้นขาดตรงนั้นจริง ๆ
    expect(geometry.segments).toHaveLength(2);
    expect(geometry.points).toHaveLength(4);
    expect(geometry.min).toBe(1);
    expect(geometry.max).toBe(5);
  });

  it("จุดเดี่ยวที่ไม่มีเพื่อนข้างๆ ไม่กลายเป็นเส้น แต่ยังเป็นจุดที่วาดได้", () => {
    const geometry = sparkGeometry([1, null, 3, null, 5], 100, 20, 0);
    expect(geometry.segments).toHaveLength(0);
    expect(geometry.points).toHaveLength(3);
  });

  it("ชุดที่ราคาคงที่ทั้งเส้นไม่ทำให้หารด้วยศูนย์", () => {
    const geometry = sparkGeometry([5, 5, 5], 100, 20, 0);
    expect(geometry.points.every((point) => Number.isFinite(point.y))).toBe(true);
  });
});

describe("การแสดงผล", () => {
  it("เดือนในชุดข้อมูลเป็น พ.ศ. อยู่แล้ว จึงไม่ถูกแปลงซ้ำ", () => {
    expect(formatMonthKey("2569-07")).toBe("ก.ค. 69");
    expect(formatMonthKey("2567-12")).toBe("ธ.ค. 67");
  });

  it("ตัดทศนิยมทิ้งเมื่อราคาเป็นบาทถ้วน", () => {
    expect(formatPrice(51000n)).toBe("510");
    expect(formatPrice(50833n)).toBe("508.33");
  });

  it("ติดเครื่องหมายบวกให้ราคาที่ขยับขึ้น", () => {
    expect(formatPercent(2.34)).toBe("+2.3%");
    expect(formatPercent(-1.25)).toBe("-1.3%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});
