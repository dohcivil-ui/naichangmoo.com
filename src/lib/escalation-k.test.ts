import { describe, expect, it } from "vitest";
import dataset from "@/data/escalation-k/cabinet-w109-be2532.json";
import {
  computeK,
  escalationFormulas,
  escalationGroups,
  escalationVariables,
  findFormula,
  formatMilli,
  ratioMilli,
  resolveBaseMonthRule,
  resolveThresholdRule,
  settlePeriod,
  settlementUnderOtherRule,
  termMilli,
  toMilli,
  type EscalationVariable
} from "@/lib/escalation-k";

const baht = (amount: number) => BigInt(Math.round(amount * 100));

describe("การตัดทศนิยมตามข้อ ค.3 ของ ว 109", () => {
  it("ตัดทิ้ง ไม่ปัดขึ้น", () => {
    expect(toMilli(1.0789)).toBe(1078);
    expect(toMilli(1.0301)).toBe(1030);
    expect(toMilli(0.9999)).toBe(999);
  });

  it("ไม่กินหลักสุดท้ายเมื่อค่าลงตัวพอดี", () => {
    // 1.045 * 1000 ในทศนิยมลอยตัวไม่ได้เป็น 1045 พอดีเสมอไป ถ้าตัดตรง ๆ จะเหลือ 1044
    expect(toMilli(1.045)).toBe(1045);
    expect(toMilli(0.29)).toBe(290);
    expect(toMilli(1.005)).toBe(1005);
  });

  it("กับดักทศนิยมลอยตัวที่ทำให้เงินชดเชยเพี้ยนทั้งหลัก", () => {
    // เขียนตรง ๆ แบบนี้จะได้ 1004 ซึ่งผิด — ทั้งไฟล์จึงเดินบนจำนวนเต็มแทน
    expect(Math.trunc((1.045 - 0.04) * 1000)).toBe(1004);
    expect(1045 - 40).toBe(1005);
  });
});

describe("เลขสัมพันธ์และการคูณสัมประสิทธิ์", () => {
  it("หารให้เสร็จก่อนแล้วจึงคูณ ตามลำดับที่เอกสารกำหนด", () => {
    const ratio = ratioMilli(108.4, 105.2);
    expect(ratio).toBe(1030);
    expect(termMilli(0.15, ratio)).toBe(154);
  });

  it("สลับลำดับเป็นคูณก่อนหารได้คนละคำตอบ", () => {
    const correct = termMilli(0.4, ratioMilli(119.3, 110.6));
    const swapped = toMilli((0.4 * 119.3) / 110.6);
    expect(correct).toBe(431);
    expect(swapped).toBe(431);
    // เคสที่เศษตกคนละฝั่งของหลักที่สาม หาได้จากการไล่ค้นจริง ไม่ใช่ยกตัวอย่างลอย ๆ
    // ดัชนี 100.0 เทียบฐาน 105.6 ที่สัมประสิทธิ์ 0.15 — หารก่อนได้ 0.141 คูณก่อนได้ 0.142
    expect(termMilli(0.15, ratioMilli(100.0, 105.6))).toBe(141);
    expect(toMilli((0.15 * 100.0) / 105.6)).toBe(142);
  });

  it("ไม่ขึ้นกับจำนวนทศนิยมของดัชนีต้นทาง", () => {
    expect(ratioMilli(320.5, 311.2)).toBe(ratioMilli(320.5, 311.2));
    expect(ratioMilli(1084, 1052)).toBe(1030);
  });
});

describe("ชุดข้อมูล ว 109", () => {
  it("มี 34 สูตรที่มีค่า K และ 1 รายการที่ไม่มีสูตร รวม 35 รายการ", () => {
    const withK = escalationFormulas.filter((f) => !f.noFormula);
    expect(escalationFormulas).toHaveLength(35);
    expect(withK).toHaveLength(34);
    expect(escalationFormulas.filter((f) => f.noFormula).map((f) => f.id)).toEqual(["4.7"]);
  });

  it("สัมประสิทธิ์ของทุกสูตรบวกได้ 1.000 พอดี", () => {
    const wrong = escalationFormulas
      .filter((f) => !f.noFormula)
      .map((f) => {
        const total = toMilli(f.base ?? 0) + Object.values(f.terms ?? {}).reduce((sum, c) => sum + toMilli(c), 0);
        return { id: f.id, total };
      })
      .filter((row) => row.total !== 1000);
    expect(wrong).toEqual([]);
  });

  it("ทุกตัวแปรที่สูตรใช้มีนิยามอยู่ และทุกหมวดที่อ้างถึงมีอยู่จริง", () => {
    const groupIds = new Set(escalationGroups.map((g) => g.id));
    for (const formula of escalationFormulas) {
      expect(groupIds.has(formula.groupId)).toBe(true);
      for (const key of Object.keys(formula.terms ?? {})) {
        expect(escalationVariables[key as EscalationVariable]).toBeDefined();
      }
    }
  });

  it("รหัสดัชนีของ API ตรงกับตัวอักษรตัวแปรทั้ง 13 ตัว", () => {
    for (const [symbol, variable] of Object.entries(escalationVariables)) {
      expect(variable.indexId).toBe(symbol);
    }
    expect(Object.keys(escalationVariables)).toHaveLength(13);
    expect(dataset.indexApi.baseUrl).toBe("https://index-api.tpso.go.th");
    expect(dataset.method.indexBaseYearBE).toBe(2530);
  });

  it("ยังไม่มีหมวดใดผ่านการรับรอง จึงยังคำนวณจริงไม่ได้", () => {
    expect(escalationGroups.every((g) => g.reviewedBy === null)).toBe(true);
    expect(dataset.reviewedBy).toBeNull();
  });

  it("หลักเกณฑ์ที่ยังไม่มีเอกสารต้นฉบับต้องติดธงไว้ ไม่ใช่ปล่อยผ่าน", () => {
    const temporary = dataset.rulebook.thresholds.find((rule) => rule.id === "temp2569");
    expect(temporary?.verified).toBe(false);
    expect(temporary?.thresholdMilli).toBe(20);
  });
});

describe("การเลือกหลักเกณฑ์ตามวันที่", () => {
  it("เกณฑ์ส่วนต่างตัดสินที่วันส่งมอบงวดงาน", () => {
    expect(resolveThresholdRule("2568-12-18").thresholdMilli).toBe(40);
    expect(resolveThresholdRule("2569-02-27").thresholdMilli).toBe(40);
    expect(resolveThresholdRule("2569-02-28").thresholdMilli).toBe(20);
    expect(resolveThresholdRule("2569-06-20").thresholdMilli).toBe(20);
    expect(resolveThresholdRule("2569-09-30").thresholdMilli).toBe(20);
    expect(resolveThresholdRule("2569-10-01").thresholdMilli).toBe(40);
  });

  it("เดือนฐานตัดสินที่วันลงนามในสัญญา ซึ่งเป็นคนละวันกับข้อบน", () => {
    expect(resolveBaseMonthRule("2568-11-14").field).toBe("bidOpenedOn");
    expect(resolveBaseMonthRule("2569-03-02").field).toBe("medianPriceApprovedOn");
    expect(resolveBaseMonthRule("2569-10-01").field).toBe("bidOpenedOn");
  });

  it("สัญญาเดียวเข้าข้อหนึ่งแต่ไม่เข้าอีกข้อได้", () => {
    const signed = "2568-11-14";
    const delivered = "2569-06-20";
    expect(resolveBaseMonthRule(signed).id).toBe("w109");
    expect(resolveThresholdRule(delivered).id).toBe("temp2569");
  });
});

describe("เงินชดเชยรายงวด", () => {
  const amount = baht(12_824_000);

  it("คิดจาก K ที่หักเกณฑ์แล้ว ไม่ใช่ K ลบหนึ่ง", () => {
    const result = settlePeriod(1045, amount, "2569-06-20");
    expect(result.rule.id).toBe("temp2569");
    expect(formatMilli(result.appliedKMilli)).toBe("1.025");
    expect(result.action).toBe("add");
    expect(result.deltaSatang).toBe(baht(320_600));
    expect(result.paySatang).toBe(baht(13_144_600));
  });

  it("งวดเดียวกันนอกช่วงมาตรการได้คนละจำนวน", () => {
    const result = settlePeriod(1045, amount, "2568-12-18");
    expect(result.rule.id).toBe("w109");
    expect(formatMilli(result.appliedKMilli)).toBe("1.005");
    expect(result.deltaSatang).toBe(baht(64_120));
  });

  it("บอกได้ว่าถ้าใช้อีกเกณฑ์จะต่างเท่าไร", () => {
    const other = settlementUnderOtherRule(1045, amount, "2569-06-20");
    expect(other?.rule.id).toBe("w109");
    expect(other?.deltaSatang).toBe(baht(64_120));
  });

  it("อยู่ในเกณฑ์แล้วไม่ปรับ และไม่ปัดค่างานให้เพี้ยน", () => {
    expect(settlePeriod(1020, amount, "2569-06-20").action).toBe("none");
    expect(settlePeriod(1020, amount, "2569-06-20").paySatang).toBe(amount);
    expect(settlePeriod(1040, amount, "2568-12-18").action).toBe("none");
    expect(settlePeriod(1041, amount, "2568-12-18").action).toBe("add");
  });

  it("ค่า K ต่ำกว่าเกณฑ์คือการเรียกเงินคืน", () => {
    const result = settlePeriod(970, amount, "2569-06-20");
    expect(result.action).toBe("recover");
    expect(formatMilli(result.appliedKMilli)).toBe("0.990");
    expect(result.deltaSatang < 0n).toBe(true);
  });
});

describe("การปฏิเสธ", () => {
  const readings = {
    I: { base: 105.2, current: 108.4 },
    C: { base: 104.9, current: 112.7 },
    M: { base: 110.6, current: 119.3 },
    S: { base: 103.4, current: 106.8 }
  };

  it("ปฏิเสธสูตรที่ไม่มีในชุดข้อมูล", () => {
    const result = computeK("9.9", readings);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("formula_not_in_dataset");
  });

  it("ปฏิเสธรายการ 4.7 ที่ไม่มีสูตร K แทนที่จะบังคับให้เข้าสูตร", () => {
    const result = computeK("4.7", readings);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("formula_has_no_k");
      expect(result.detail).toContain("ซีเมนต์");
    }
  });

  it("ปฏิเสธเมื่อหมวดยังไม่มีผู้รับรอง แม้ดัชนีจะครบ", () => {
    const result = computeK("1", readings);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("group_not_reviewed");
  });

  it("รายการ 4.7 ยังคงบอกกฎของตัวเองไว้ ไม่ได้หายไปจากชุดข้อมูล", () => {
    const formula = findFormula("4.7");
    expect(formula?.noFormula).toBe(true);
    expect(formula?.rule).toContain("ดัชนีราคาของซีเมนต์");
  });
});

describe("ตัวอย่างเดินครบทาง — อาคารที่พักอาศัย 7 ชั้น งวดที่ 3", () => {
  it("ประกอบค่า K จากพจน์ทีละพจน์ได้ 1.045 และเงินเพิ่ม 320,600 บาท", () => {
    const formula = findFormula("1");
    const readings: Record<string, { base: number; current: number }> = {
      I: { base: 105.2, current: 108.4 },
      C: { base: 104.9, current: 112.7 },
      M: { base: 110.6, current: 119.3 },
      S: { base: 103.4, current: 106.8 }
    };

    let kMilli = toMilli(formula!.base!);
    for (const [symbol, coefficient] of Object.entries(formula!.terms!)) {
      kMilli += termMilli(coefficient, ratioMilli(readings[symbol].current, readings[symbol].base));
    }

    expect(formatMilli(kMilli)).toBe("1.045");

    const settlement = settlePeriod(kMilli, baht(12_824_000), "2569-06-20");
    expect(settlement.deltaSatang).toBe(baht(320_600));
  });
});

describe("ตรวจกับดัชนีจริงที่ สนค. เผยแพร่", () => {
  /**
   * ดึงจาก POST https://index-api.tpso.go.th/OpenApi/K/Month ฐานปี 2530 เมื่อ 24 ส.ค. 2569
   * เดือนฐาน กันยายน 2568 เทียบเดือนส่งมอบ มิถุนายน 2569
   * เก็บเป็นค่าคงที่ในเทสต์โดยตั้งใจ เทสต์ที่ยิงเครือข่ายจริงจะแดงเมื่อเน็ตล่ม ไม่ใช่เมื่อโค้ดผิด
   */
  const PUBLISHED = {
    I: { base: 277.1, current: 284.7 },
    C: { base: 211.7, current: 214.1 },
    M: { base: 320.5, current: 348.0 },
    S: { base: 262.0, current: 253.1 }
  };

  const kFromPublished = () => {
    const formula = findFormula("1")!;
    let k = toMilli(formula.base!);
    for (const [symbol, coefficient] of Object.entries(formula.terms!)) {
      const reading = PUBLISHED[symbol as keyof typeof PUBLISHED];
      k += termMilli(coefficient, ratioMilli(reading.current, reading.base));
    }
    return k;
  };

  it("ดัชนีเหล็กลดลงจริงในช่วงนี้ เลขสัมพันธ์จึงต่ำกว่าหนึ่ง", () => {
    expect(ratioMilli(PUBLISHED.S.current, PUBLISHED.S.base)).toBe(966);
  });

  it("งานอาคารได้ K เท่ากับ 1.035", () => {
    expect(formatMilli(kFromPublished())).toBe("1.035");
  });

  it("ค่า K นี้ตกคร่อมเกณฑ์พอดี มาตรการชั่วคราวจึงเป็นตัวชี้ขาดว่าได้เงินหรือไม่ได้เลย", () => {
    const amount = baht(12_824_000);
    const k = kFromPublished();

    const underTemporary = settlePeriod(k, amount, "2569-06-20");
    expect(underTemporary.rule.id).toBe("temp2569");
    expect(underTemporary.deltaSatang).toBe(baht(192_360));

    const underStandard = settlePeriod(k, amount, "2568-12-18");
    expect(underStandard.rule.id).toBe("w109");
    expect(underStandard.action).toBe("none");
    expect(underStandard.deltaSatang).toBe(0n);
  });
});
