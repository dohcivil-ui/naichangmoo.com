import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { escalationSource } from "@/lib/escalation-k";
import { WEIGHT_SCALE, normaliseWeights } from "@/lib/work-plan";
import { TEXT_ONLY_VERBS, type AssistantVerb } from "@/server/ai/assistant-contract";
import { FACTS_HEADING, stripFactsBlock } from "@/server/ai/facts-block";
import { cleanForDisplay, collectStrings, findFieldNames, stripEmoji } from "@/server/ai/output-filter";
import { listSkills, skillSourceIsUsable, type AssistantSkill } from "@/server/ai/skill-registry";
import "@/server/ai/skills";

/**
 * กฎร่วมของผู้ช่วยทุกแอป — เดินไล่ทะเบียนทักษะ ไม่ใช่เขียนซ้ำต่อแอป
 *
 * เหตุผลที่ต้องเป็นแบบนี้: กฎอย่าง "schema ห้ามมีช่องเงิน" ถ้าเขียนเป็นเทสต์รายแอป
 * มันจะครอบเฉพาะแอปที่มีคนนึกได้ตอนนั้น แอปที่แปดจะเกิดขึ้นในวันที่รีบ และไม่มีใครกลับมาเขียน
 * เทสต์ให้มัน พอเดินไล่ทะเบียน ทักษะที่เพิ่มพรุ่งนี้ก็ถูกตรวจด้วยกฎเดียวกันโดยไม่ต้องมีใครจำ
 *
 * `SAMPLES` มีเทสต์บังคับว่าต้องครบทุกทักษะ ทักษะใหม่ที่ไม่มีตัวอย่างจึงทำให้ชุดนี้ตกทันที
 * แทนที่จะผ่านฉลุยเพราะไม่มีอะไรให้ตรวจ
 */

const skillId = (skill: AssistantSkill) => `${skill.app}:${skill.verb}`;

/**
 * อินพุตตัวอย่าง — จงใจใส่ข้อมูลส่วนบุคคลลงไปด้วย
 *
 * อีเมล รหัสผู้ใช้ รหัสองค์กร และคีย์ไฟล์ในที่เก็บ อยู่ในนี้เพื่อให้กฎ G15 พิสูจน์ได้ว่า
 * `project()` ของทุกทักษะตัดมันทิ้งจริง ไม่ใช่เพราะบังเอิญไม่มีใครใส่มาให้
 */
const PRIVATE_FIELDS = {
  email: "someone@example.com",
  userId: "user_0193abc",
  organizationId: "org_personal_0193abc",
  storage_key: "r2://drawings/0193abc/plan.pdf"
};

const SAMPLES: Record<string, unknown> = {
  "work-plan:draft": {
    ...PRIVATE_FIELDS,
    projectName: "อาคารเรียน 4 ชั้น 12 ห้องเรียน",
    contractBaht: "18,500,000",
    durationDays: 300,
    templateLabel: "งานอาคารทั่วไป"
  },
  "work-plan:revise": {
    ...PRIVATE_FIELDS,
    projectName: "อาคารเรียน 4 ชั้น 12 ห้องเรียน",
    contractBaht: "18,500,000",
    durationDays: 300,
    templateLabel: "งานอาคารทั่วไป",
    instruction: "งวดที่ 3 ให้รวมงานหลังคาด้วย",
    current: [{ number: "1.1", title: "งานเตรียมการ", weightPpm: "40000", startOffsetDays: 0, durationDays: 30 }]
  },
  "work-plan:critique": {
    ...PRIVATE_FIELDS,
    projectName: "อาคารเรียน 4 ชั้น 12 ห้องเรียน",
    contractBaht: "18,500,000",
    durationDays: 300,
    milestones: [
      { title: "งวดที่ 1", percentOfContract: "35.00", activityTitles: ["งานเตรียมการ", "งานฐานราก"] },
      { title: "งวดที่ 2", percentOfContract: "65.00", activityTitles: ["งานสถาปัตยกรรม"] }
    ]
  },
  "escalation-k:preflight": {
    ...PRIVATE_FIELDS,
    contractSignedOn: "2569-01-15",
    periodDeliveredOn: "2569-06-30",
    scopeSummary: "งานอาคารคอนกรีตเสริมเหล็ก",
    providedIndexVariables: ["C", "M"],
    hasPeriodAmount: true
  },
  "escalation-k:explain": {
    ...PRIVATE_FIELDS,
    contractSignedOn: "2569-01-15",
    periodDeliveredOn: "2569-06-30",
    question: "งวดนี้ใช้เกณฑ์ส่วนต่างเท่าไร"
  }
};

const SYSTEM_FACTS = ["มูลค่างานงวดที่หนักที่สุดคิดเป็น 35 เปอร์เซ็นต์ของมูลค่าสัญญา"];

const projected = (skill: AssistantSkill) => {
  const result = skill.project(SAMPLES[skillId(skill)]);
  if (!result.ok) throw new Error(`ตัวอย่างของ ${skillId(skill)} ผ่าน project() ไม่ได้: ${result.message}`);
  return result.value;
};

const builtTask = (skill: AssistantSkill) => skill.buildTask(projected(skill), SYSTEM_FACTS);

const skills = listSkills();

describe("ทะเบียนทักษะพร้อมให้ตรวจ", () => {
  it("มีทักษะจากอย่างน้อยสองแอป เพราะรอยต่อที่มีอะแดปเตอร์ตัวเดียวคือรอยต่อสมมติ", () => {
    expect(new Set(skills.map((skill) => skill.app)).size).toBeGreaterThanOrEqual(2);
  });

  it("ทุกทักษะที่ลงทะเบียนมีอินพุตตัวอย่างให้กฎร่วมเดินตรวจ", () => {
    expect(skills.map(skillId).sort()).toEqual(Object.keys(SAMPLES).sort());
  });
});

describe("G1 schema ของผู้ช่วยห้ามมีช่องเงิน", () => {
  const MONEY_WORDS = new Set(["satang", "baht", "price", "prices", "cost", "costs", "amount", "amounts", "total", "totals", "sum", "sums"]);
  const MONEY_THAI = /เงิน|ราคา|บาท|สตางค์/;

  /**
   * แยกคำก่อนเทียบ ไม่ใช่เทียบด้วยการค้นหาข้อความย่อย
   *
   * `summary` มีคำว่า sum อยู่ข้างใน และ `customer` มี cost ไม่ครบแต่คำอื่นก็ชนได้ทำนองนี้
   * การจับด้วยข้อความย่อยจะทำให้เทสต์ตกด้วยเหตุที่ไม่ใช่ความผิด แล้วคนจะเริ่มปิดเทสต์
   * ซึ่งอันตรายกว่าการไม่มีเทสต์ตั้งแต่แรก
   */
  const isMoneyKey = (key: string): boolean =>
    MONEY_THAI.test(key) || key.split(/(?=[A-Z])|[_\-\s]+/).some((word) => MONEY_WORDS.has(word.toLowerCase()));

  const keysOf = (schema: unknown, found: string[] = []): string[] => {
    if (!schema || typeof schema !== "object") return found;
    const node = schema as Record<string, unknown>;
    const properties = node.properties;
    if (properties && typeof properties === "object") {
      for (const [key, child] of Object.entries(properties as Record<string, unknown>)) {
        found.push(key);
        keysOf(child, found);
      }
    }
    if (node.items) keysOf(node.items, found);
    for (const branch of ["anyOf", "allOf", "oneOf"]) {
      const list = node[branch];
      if (Array.isArray(list)) for (const child of list) keysOf(child, found);
    }
    return found;
  };

  it.each(skills.map((skill) => [skillId(skill), skill] as const))(
    "%s ไม่มีคีย์ที่เกี่ยวกับเงินสักคีย์เดียว",
    (_id, skill) => {
      const offenders = keysOf(z.toJSONSchema(skill.schema)).filter(isMoneyKey);
      expect(offenders).toEqual([]);
    }
  );
});

describe("G2 เงินที่ระบบคำนวณต้องลงตัวเป๊ะทุกคำตอบที่แบบจำลองส่งมา", () => {
  const cases: [string, number[]][] = [
    ["รวมไม่ครบล้าน", [100, 200, 300]],
    ["รวมเกินล้าน", [900_000, 900_000]],
    ["มีค่าติดลบ", [500_000, -200_000, 700_000]],
    ["มีศูนย์ปน", [0, 1_000_000, 0]],
    ["ศูนย์ทั้งชุด", [0, 0, 0]],
    ["ค่าที่ไม่ใช่จำนวน", [Number.NaN, Number.POSITIVE_INFINITY, 10]],
    ["รายการเดียว", [7]],
    ["เศษหารไม่ลงตัวสามส่วน", [1, 1, 1]]
  ];

  it.each(cases)("%s แล้วน้ำหนักยังรวมได้หนึ่งล้าน ppm พอดี", (_name, weights) => {
    const shares = normaliseWeights(weights);
    expect(shares.reduce((sum, share) => sum + share, 0n)).toBe(WEIGHT_SCALE);
  });

  it("แจกเงินตามน้ำหนักแล้วยอดรวมเท่ามูลค่าสัญญาเป๊ะ ไม่มีเศษหาย", () => {
    const contractSatang = 1_850_000_000n;
    const shares = normaliseWeights([333, 333, 334, 1]);
    let allocated = 0n;
    const costs = shares.map((share, index) =>
      index === shares.length - 1 ? contractSatang - allocated : ((allocated += (contractSatang * share) / WEIGHT_SCALE), (contractSatang * share) / WEIGHT_SCALE)
    );
    expect(costs.reduce((sum, cost) => sum + cost, 0n)).toBe(contractSatang);
  });

  it("รายการว่างคืนรายการว่าง ไม่ใช่หารด้วยศูนย์", () => {
    expect(normaliseWeights([])).toEqual([]);
  });
});

describe("G3 โจทย์จริงไม่เคยขอให้แบบจำลองคำนวณเงิน", () => {
  const ASKS_FOR_MONEY = /(คำนวณ|คิด|หา|ประมาณ)\s*(เงิน|ราคา|ค่างาน|บาท|satang)/;

  it.each(skills.map((skill) => [skillId(skill), skill] as const))(
    "%s มีบรรทัดห้ามเรื่องเงินอยู่ในคำสั่งระบบ",
    (_id, skill) => {
      const prohibition = skill.system.split("\n").filter((line) => /ห้าม/.test(line) && /(เงิน|บาท)/.test(line));
      expect(prohibition.length).toBeGreaterThan(0);
    }
  );

  it.each(skills.map((skill) => [skillId(skill), skill] as const))(
    "%s ไม่มีประโยคสั่งให้คำนวณเงินอยู่ในโจทย์",
    (_id, skill) => {
      expect(ASKS_FOR_MONEY.test(builtTask(skill))).toBe(false);
    }
  );

  it.each(skills.map((skill) => [skillId(skill), skill] as const))(
    "%s ส่งข้อเท็จจริงที่ระบบคำนวณแล้วผ่านบล็อกมาตรฐานเสมอ",
    (_id, skill) => {
      const task = builtTask(skill);
      expect(task).toContain(FACTS_HEADING);
      expect(task).toContain(SYSTEM_FACTS[0]);
      // ตัดบล็อกออกแล้วข้อเท็จจริงต้องหายไปกับมัน ไม่ใช่กระจายอยู่ที่อื่นด้วย
      expect(stripFactsBlock(task)).not.toContain(SYSTEM_FACTS[0]);
    }
  );
});

describe("G6 ชุดข้อมูลที่ยังไม่มีผู้รับรอง ใช้ได้เฉพาะทักษะที่ไม่คืนตัวเลข", () => {
  it.each(skills.map((skill) => [skillId(skill), skill] as const))("%s ผ่านกฎแหล่งข้อมูล", (_id, skill) => {
    expect(skillSourceIsUsable(skill)).toBe(true);
  });

  it("ทักษะที่คืนตัวเลขจากชุดข้อมูลที่ไม่มีผู้รับรอง ถูกปฏิเสธ", () => {
    const offender = {
      ...skills[0]!,
      returnsNumbers: true,
      source: { document: "เอกสารสมมติ", datasetId: "x/y", datasetSha256: "0".repeat(64), reviewedBy: null, verified: false }
    };
    expect(skillSourceIsUsable(offender)).toBe(false);
  });

  it("ทักษะเดียวกันนั้นผ่านทันทีเมื่อมีผู้รับรอง", () => {
    const signed = {
      ...skills[0]!,
      returnsNumbers: true,
      source: { document: "เอกสารสมมติ", datasetId: "x/y", datasetSha256: "0".repeat(64), reviewedBy: "วิศวกรผู้ตรวจ", verified: true }
    };
    expect(skillSourceIsUsable(signed)).toBe(true);
  });

  it("จังหวะที่นิยามว่าไม่คืนตัวเลข ต้องไม่มีทักษะไหนประกาศว่าคืนตัวเลข", () => {
    const contradictions = skills
      .filter((skill) => TEXT_ONLY_VERBS.includes(skill.verb as AssistantVerb) && skill.returnsNumbers)
      .map(skillId);
    expect(contradictions).toEqual([]);
  });
});

describe("G7 ที่มาของข้อมูลประกอบจากชุดข้อมูล ไม่ใช่จากแบบจำลอง", () => {
  it.each(skills.map((skill) => [skillId(skill), skill] as const))(
    "%s คืนที่มาที่มีรหัสย่อไฟล์ครบรูปแบบทุกรายการ",
    (_id, skill) => {
      for (const citation of skill.citations(projected(skill))) {
        expect(citation.datasetSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(citation.datasetId).not.toBe("");
        expect(citation.document).not.toBe("");
      }
    }
  );

  it("ที่มาของผู้ช่วยค่า K อ้างรหัสย่อของ ว 109 ตัวเดียวกับที่ชุดข้อมูลประกาศ", () => {
    const skill = skills.find((item) => item.app === "escalation-k");
    const citations = skill ? skill.citations(projected(skill)) : [];
    expect(citations.length).toBeGreaterThan(0);
    for (const citation of citations) {
      expect(citation.datasetSha256).toBe(escalationSource.sha256);
      expect(citation.reviewedBy).toBeNull();
    }
  });

  /**
   * ตรวจกับไฟล์จริงเมื่อมีอยู่ — `km/` ไม่ได้อยู่ในการควบคุมเวอร์ชัน เทสต์จึงข้ามได้บนเครื่องที่
   * ไม่มีเอกสาร แต่บนเครื่องที่มี มันคือด่านที่จับได้ว่าเราอ้างรหัสย่อของไฟล์คนละไฟล์กับที่ถอดมา
   */
  it("รหัสย่อของ ว 109 ตรงกับไฟล์ต้นฉบับบนดิสก์", () => {
    const file = path.join(process.cwd(), "km", escalationSource.fileName);
    if (!existsSync(file)) return;
    expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(escalationSource.sha256);
  });
});

describe("G8 หลักเกณฑ์ที่ยังไม่ตรวจกับฉบับจริง ต้องขึ้นคำเตือนเสมอ", () => {
  it("ผู้ช่วยค่า K เตือนเรื่องหลักเกณฑ์ที่ยังไม่ยืนยัน", () => {
    const skill = skills.find((item) => item.app === "escalation-k" && item.verb === "explain")!;
    const warnings = skill.warnings(projected(skill));
    expect(warnings.some((warning) => /ยังไม่ได้ตรวจกับเอกสารต้นฉบับ/.test(warning))).toBe(true);
  });

  it("ผู้ช่วยค่า K บอกเสมอว่าตัวเองไม่ได้คำนวณค่า K หรือเงิน", () => {
    const skill = skills.find((item) => item.app === "escalation-k" && item.verb === "preflight")!;
    expect(skill.warnings(projected(skill)).some((warning) => /ไม่ได้คำนวณค่า K/.test(warning))).toBe(true);
  });
});

describe("G13 อีโมจิถูกตัดก่อนถึงหน้าจอ แม้ prompt จะขอไว้แล้ว", () => {
  it("ตัดอีโมจิออกจากข้อความ", () => {
    expect(stripEmoji("งานเสร็จแล้ว ✅ พร้อมส่ง 🎉")).toBe("งานเสร็จแล้ว พร้อมส่ง");
  });

  it("ไม่ตัดตัวเลข เลขข้อ หรือเครื่องหมายที่ใช้จริงในเอกสารไทย", () => {
    expect(stripEmoji("ข้อ ค.4 หน้า 9 คิดเป็น 4% ของสัญญา")).toBe("ข้อ ค.4 หน้า 9 คิดเป็น 4% ของสัญญา");
  });

  it("ตัดทั่วทั้งโครงสร้างที่ซ้อนกัน โดยรูปทรงไม่เปลี่ยน", () => {
    const cleaned = cleanForDisplay({ note: "ตรวจแล้ว 👍", items: [{ title: "งานฐานราก 🏗️" }], days: 30 });
    expect(cleaned).toEqual({ note: "ตรวจแล้ว", items: [{ title: "งานฐานราก" }], days: 30 });
  });
});

describe("G14 ไม่มีชื่อฟิลด์ภาษาอังกฤษในข้อความที่ผู้ใช้อ่าน", () => {
  it("จับชื่อฟิลด์ที่หลุดมาได้", () => {
    expect(findFieldNames("ปรับ startOffsetDays และ weightPpm ใหม่")).toEqual(["startOffsetDays", "weightPpm"]);
  });

  it("ไม่จับชื่อแบรนด์หรือคำไทยล้วนเป็นชื่อฟิลด์", () => {
    expect(findFieldNames("ESTIMETR กับ PRICEMETR ใช้ราคากลางคนละชุด")).toEqual([]);
  });

  it("เดินเก็บข้อความได้ทั่วโครงสร้าง เพื่อให้ประตูตรวจคำตอบทั้งชุดได้", () => {
    expect(collectStrings({ a: "หนึ่ง", b: [{ c: "สอง" }], d: 3 })).toEqual(["หนึ่ง", "สอง"]);
  });
});

describe("G15 ข้อมูลส่วนบุคคลไม่เดินทางออกไปกับ prompt", () => {
  it.each(skills.map((skill) => [skillId(skill), skill] as const))(
    "%s ตัดอีเมล รหัสผู้ใช้ รหัสองค์กร และคีย์ไฟล์ทิ้งก่อนประกอบโจทย์",
    (_id, skill) => {
      const task = builtTask(skill);
      for (const secret of Object.values(PRIVATE_FIELDS)) {
        expect(task).not.toContain(secret);
      }
    }
  );

  it.each(skills.map((skill) => [skillId(skill), skill] as const))(
    "%s ไม่พาข้อมูลส่วนบุคคลติดไปกับผลของ project ด้วย",
    (_id, skill) => {
      const carried = JSON.stringify(projected(skill));
      for (const secret of Object.values(PRIVATE_FIELDS)) {
        expect(carried).not.toContain(secret);
      }
    }
  );
});

describe("อินพุตที่ไม่ครบถูกปฏิเสธก่อนเสียเงิน", () => {
  it.each(skills.map((skill) => [skillId(skill), skill] as const))("%s ปฏิเสธอินพุตว่าง", (_id, skill) => {
    const result = skill.project({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it("ผู้ช่วยแก้แผนปฏิเสธเมื่อไม่มีคำสั่งว่าจะแก้อะไร", () => {
    const skill = skills.find((item) => item.verb === "revise")!;
    const result = skill.project({ ...(SAMPLES["work-plan:draft"] as object) });
    expect(result.ok).toBe(false);
  });
});
