/**
 * แหล่งอำนาจของชุดราคา และวิธีคิดราคาที่ชุดนั้นรองรับ — ADR 0008 ข้อ 1, 2 และ 5
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูลเลย เพราะกฎที่ตัดสินว่าชุดหนึ่งขึ้นราคากลางได้หรือไม่ ต้องอ่านออกและ
 * ทดสอบได้โดยไม่ต้องมีตารางจริง ส่วนที่แตะฐานข้อมูลอยู่ใน `revision-repository`
 *
 * **แหล่งอำนาจเป็นข้อเท็จจริง ไม่ใช่คะแนนความน่าเชื่อถือ** มันตอบว่าตัวเลขมาจากไหน
 * ไม่ได้ตอบว่าตัวเลขถูกหรือผิด ราคาขององค์กรอาจแม่นกว่าราคาที่รัฐประกาศก็ได้ แต่มันไม่ใช่
 * ราคาทางการ และเอกสารราคากลางอ้างได้เฉพาะราคาทางการ
 */

/** ที่มาของราคาแต่ละบรรทัด ตรงกับที่ PRICEMETR เก็บไว้ใน `price_set_lines.source_key` */
export type PriceSourceKey = "tpso" | "obec" | "cgd";

export type PriceAuthoritySource = "official" | "organization";

export type CostingMethod = "factor_f" | "contractor_cost";

/**
 * บัญชีราคาที่หน่วยงานรัฐเป็นผู้ประกาศ
 *
 * ทั้งสามรายการนี้เป็นคำประกาศของหน่วยงาน ไม่ใช่ราคาที่ใครในระบบพิมพ์เข้ามาเอง วันที่มีราคา
 * ซึ่งองค์กรสืบเองเข้ามาในระบบ คีย์ของมันจะไม่อยู่ในชุดนี้ และชุดราคาที่มีบรรทัดแบบนั้นปนอยู่
 * จะไม่ใช่ราคาทางการทันที
 */
const OFFICIAL_SOURCE_KEYS: ReadonlySet<string> = new Set<PriceSourceKey>(["tpso", "obec", "cgd"]);

export function authorityOfSource(sourceKey: string): PriceAuthoritySource {
  return OFFICIAL_SOURCE_KEYS.has(sourceKey) ? "official" : "organization";
}

/**
 * แหล่งอำนาจของทั้งชุด คิดจากที่มาของทุกบรรทัด
 *
 * ชุดเป็น `official` ก็ต่อเมื่อ**ทุกบรรทัด**มาจากบัญชีที่รัฐประกาศ บรรทัดเดียวที่มาจากราคา
 * ขององค์กรทำให้ทั้งชุดไม่ใช่ราคาทางการ เพราะยอดรวมของใบเดียวแยกกันไม่ได้ว่าส่วนไหนทางการ
 *
 * ชุดที่ไม่มีบรรทัดเลยตอบว่า `organization` ไม่ใช่ `official` เพราะ "ทางการ" เป็นคำกล่าวอ้าง
 * ที่ต้องมีหลักฐานรองรับ ไม่มีบรรทัดคือไม่มีหลักฐาน ไม่ใช่ผ่านโดยปริยาย
 */
export function authorityOfLines(sourceKeys: readonly string[]): PriceAuthoritySource {
  if (sourceKeys.length === 0) return "organization";
  return sourceKeys.every((key) => authorityOfSource(key) === "official") ? "official" : "organization";
}

/**
 * เหตุผลที่วิธีคิดราคานี้ใช้กับชุดราคาชุดนี้ไม่ได้ — `null` คือใช้ได้
 *
 * มีข้อห้ามข้อเดียวและมาจาก ADR 0008 ข้อ 5 คือ **ฉบับแบบ Factor F ต้องใช้ชุดที่มาจาก
 * แหล่งทางการเท่านั้น** ทางกลับกันไม่ห้าม เอาราคาทางการไปคิดต้นทุนผู้รับเหมาได้ตามปกติ
 */
export function costingMethodDenial(method: CostingMethod, authority: PriceAuthoritySource): string | null {
  if (method === "factor_f" && authority !== "official") {
    return "ฉบับที่คิดด้วย Factor F ใช้ได้เฉพาะชุดราคาที่ทุกบรรทัดมาจากบัญชีที่หน่วยงานรัฐประกาศ";
  }
  return null;
}

export const COSTING_METHOD_LABEL: Record<CostingMethod, string> = {
  factor_f: "ราคากลางด้วย Factor F",
  contractor_cost: "ต้นทุนและกำไรของผู้รับเหมา"
};

export const AUTHORITY_LABEL: Record<PriceAuthoritySource, string> = {
  official: "ราคาที่หน่วยงานรัฐประกาศ",
  organization: "ราคาที่องค์กรสืบเอง"
};

export function isCostingMethod(value: unknown): value is CostingMethod {
  return value === "factor_f" || value === "contractor_cost";
}
