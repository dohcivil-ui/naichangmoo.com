import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADR 0025 ข้อ 3 — เดือนที่คาดว่าเปิด เลื่อนเงียบไม่ได้
 *
 * **ข้อที่ห้าของ ADR อยู่ในไฟล์นี้ อีกสี่ข้ออยู่ที่ `app-readiness.test.ts`** เพราะสี่ข้อนั้น
 * ถามว่าอ่านค่าแล้วได้ขั้นไหน ส่วนไฟล์นี้ถามว่าเขียนค่าแล้วเหลือร่องรอยอะไรไว้
 *
 * **ทำไมการลบเดือนออกเป็นแถวที่ต้องเฝ้าที่สุด** มันทำให้แอปถอยกลับขั้นที่หนึ่งทันที
 * และเป็นการถอยขั้นที่จะเงียบได้ง่ายที่สุดถ้าไม่มีใครเฝ้า · ADR 0025 อ้างการลงบันทึก
 * ทุกครั้งเป็นเหตุขออนุญาตให้มีคอลัมน์นี้ **ถ้าการลงบันทึกหายไป ข้ออนุญาตหมดอายุพร้อมกัน**
 * ด่านชุดนี้จึงเฝ้าเงื่อนไขของข้ออนุญาต ไม่ได้เฝ้าฟีเจอร์
 *
 * **และมันต้องไม่ผ่านด้วยเหตุผลผิด** เทสต์ที่ถามแค่ว่ามีแถวใน `auditEvents` ไหม จะเขียว
 * เท่ากันทั้งตอนที่โค้ดเขียน `after` ว่าเดือนถูกลบ และตอนที่โค้ดลืมเขียน `after` ไปเลย ·
 * ทุกข้อในไฟล์นี้จึงตรวจถึงรูปของก้อน ไม่ใช่แค่การมีอยู่ของแถว
 */

type AppRow = { slug: string; expectedOpenMonth: string | null; announcedAt: Date | null };

let appRows: AppRow[] = [];
let updates: Array<Record<string, unknown>> = [];
let audits: Array<Record<string, unknown>> = [];
let transactionRan = false;

function selectBuilder(rows: AppRow[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    then: (resolve: (value: AppRow[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject)
  };
  return chain;
}

/**
 * `tx` ที่จดว่ามีอะไรถูกเขียนบ้าง แทนที่จะเขียนจริง
 *
 * **การปฏิเสธต้องเกิดก่อนแตะฐาน** ข้อที่ควรถูกปฏิเสธจึงยืนยันว่า `transactionRan` ยังเป็นเท็จ ·
 * เทสต์ที่ดูแต่ค่าที่คืนกลับจะเขียวเท่ากัน แม้ในวันที่โค้ดเขียนลงฐานไปแล้วค่อยรายงานว่าล้มเหลว
 */
const getDb = vi.fn(() => ({
  select: () => selectBuilder(appRows),
  transaction: async (run: (tx: unknown) => Promise<void>) => {
    transactionRan = true;
    const tx = {
      update: () => ({ set: (values: Record<string, unknown>) => ({ where: () => { updates.push(values); } }) }),
      insert: () => ({ values: (row: Record<string, unknown>) => { audits.push(row); } })
    };
    await run(tx);
  }
}));

vi.mock("@/db", () => ({ getDb: () => getDb() }));

const ANNOUNCED = new Date("2026-09-01T00:00:00.000Z");

/** ตรึงเวลาไว้ที่ 2026-09-09 ตามเวลากรุงเทพ ช่วงปีที่รับได้จึงเป็น ค.ศ. 2026 ถึง 2030 */
const NOW = new Date("2026-09-09T03:00:00.000Z");

async function setMonth(input: { month: string | null; reason?: string; slug?: string; now?: Date }) {
  const { setExpectedOpenMonth } = await import("@/server/app-registry");
  return setExpectedOpenMonth({
    slug: input.slug ?? "rcopt",
    month: input.month,
    reason: input.reason ?? "ทีมยืนยันกำหนดเปิดแล้ว",
    actorId: "admin-1",
    now: input.now ?? NOW
  });
}

beforeEach(() => {
  vi.resetModules();
  getDb.mockClear();
  appRows = [{ slug: "rcopt", expectedOpenMonth: null, announcedAt: ANNOUNCED }];
  updates = [];
  audits = [];
  transactionRan = false;
});

describe("ทุกการเขียนเดือนที่คาดว่าเปิด ต้องเหลือร่องรอย", () => {
  it("กรอกครั้งแรก — before ว่าง after เป็นเดือนใหม่", async () => {
    const result = await setMonth({ month: "2026-10" });

    expect(result).toEqual({ ok: true });
    expect(updates).toEqual([expect.objectContaining({ expectedOpenMonth: "2026-10" })]);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      eventType: "app.expected_open_month_set_by_administrator",
      resourceType: "app",
      resourceId: "rcopt",
      actorId: "admin-1",
      metadata: {
        reason: "ทีมยืนยันกำหนดเปิดแล้ว",
        before: { expectedOpenMonth: null },
        after: { expectedOpenMonth: "2026-10" }
      }
    });
  });

  it("เลื่อนเดือน — before เป็นเดือนเดิม after เป็นเดือนใหม่", async () => {
    appRows = [{ slug: "rcopt", expectedOpenMonth: "2026-10", announcedAt: ANNOUNCED }];

    const result = await setMonth({ month: "2026-12", reason: "เลื่อนเพราะรอผลทดสอบ" });

    expect(result).toEqual({ ok: true });
    expect(audits[0]).toMatchObject({
      metadata: {
        reason: "เลื่อนเพราะรอผลทดสอบ",
        before: { expectedOpenMonth: "2026-10" },
        after: { expectedOpenMonth: "2026-12" }
      }
    });
  });

  /**
   * **ข้อที่ห้าของ ADR 0025** — และเป็นข้อที่เขียนละเอียดที่สุดโดยตั้งใจ
   *
   * การลบเดือนออกทำให้แอปถอยกลับขั้นที่หนึ่ง ซึ่ง ADR เรียกว่า "การเลื่อนเงียบในทิศกลับกัน"
   * และบอกว่ามันไม่ใช่เรื่องเล็กกว่าเพราะมันลดค่าลง
   */
  it("ลบเดือนออก — ต้องมีแถวในบันทึก และ after ต้องเป็นช่องที่มีอยู่จริงซึ่งมีค่าว่าง", async () => {
    appRows = [{ slug: "rcopt", expectedOpenMonth: "2026-10", announcedAt: ANNOUNCED }];

    const result = await setMonth({ month: null, reason: "ยังตอบกำหนดเปิดไม่ได้" });

    expect(result).toEqual({ ok: true });
    expect(updates).toEqual([expect.objectContaining({ expectedOpenMonth: null })]);
    expect(audits).toHaveLength(1);

    const metadata = audits[0]?.metadata as {
      reason: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    };

    expect(metadata.reason).toBe("ยังตอบกำหนดเปิดไม่ได้");
    expect(metadata.before).toEqual({ expectedOpenMonth: "2026-10" });

    /**
     * **สามบรรทัดข้างล่างนี้คือหัวใจของข้อนี้ และมันไม่ซ้ำกัน**
     *
     * บรรทัดแรกกันไม่ให้ `after` หายไปทั้งก้อน ซึ่งเป็นวิธีที่ข้อนี้จะผ่านด้วยเหตุผลผิด
     * บรรทัดที่สองยืนยันว่า **ช่องมีอยู่จริง** แยก "ไม่มีค่า" ออกจาก "ไม่ได้เขียน"
     * บรรทัดที่สามยืนยันว่าค่าในช่องเป็น `null` ไม่ใช่สตริงว่าง ซึ่งเป็นค่าที่ฐานเก็บคนละอย่าง
     */
    expect(metadata.after).not.toBeNull();
    expect(Object.hasOwn(metadata.after, "expectedOpenMonth")).toBe(true);
    expect(metadata.after.expectedOpenMonth).toBeNull();
  });

  it("ช่องว่างจากฟอร์มแปลว่าลบเดือน ไม่ใช่ค่าผิดรูปแบบ", async () => {
    appRows = [{ slug: "rcopt", expectedOpenMonth: "2026-10", announcedAt: ANNOUNCED }];

    const result = await setMonth({ month: "   " });

    expect(result).toEqual({ ok: true });
    expect(audits[0]).toMatchObject({ metadata: { after: { expectedOpenMonth: null } } });
  });
});

describe("การปฏิเสธเกิดก่อนแตะฐาน", () => {
  it("ไม่มีเหตุผลก็เขียนไม่ได้ แม้เดือนจะถูกรูปแบบ", async () => {
    const result = await setMonth({ month: "2026-10", reason: "ok" });

    expect(result).toEqual({ ok: false, reason: "reason_required" });
    expect(transactionRan).toBe(false);
    expect(audits).toHaveLength(0);
  });

  /** เหตุผลบังคับกับการลบด้วย เพราะการถอยขั้นที่ไม่ต้องอธิบายคือสิ่งที่ ADR กลัวที่สุด */
  it("การลบเดือนก็ต้องมีเหตุผล ไม่ใช่ทางลัดที่ไม่ต้องอธิบาย", async () => {
    appRows = [{ slug: "rcopt", expectedOpenMonth: "2026-10", announcedAt: ANNOUNCED }];

    const result = await setMonth({ month: null, reason: "" });

    expect(result).toEqual({ ok: false, reason: "reason_required" });
    expect(transactionRan).toBe(false);
  });

  it("เดือนผิดรูปแบบถูกปฏิเสธที่แอป ไม่ปล่อยให้ CHECK ที่ฐานเป็นคนตอบ", async () => {
    for (const month of ["2026-13", "2026-00", "10-2026", "2026-1", "ตุลาคม", "2026-10-01"]) {
      updates = [];
      audits = [];
      transactionRan = false;

      const result = await setMonth({ month });

      expect(result, `${month} ต้องถูกปฏิเสธ`).toEqual({ ok: false, reason: "invalid_month" });
      expect(transactionRan, `${month} ต้องไม่แตะฐาน`).toBe(false);
    }
  });

  it("แอปที่ยังไม่ถูกประกาศ กรอกเดือนไม่ได้ เพราะขั้นกลางคือประกาศแล้วบวกเดือน", async () => {
    appRows = [{ slug: "rcopt", expectedOpenMonth: null, announcedAt: null }];

    const result = await setMonth({ month: "2026-10" });

    expect(result).toEqual({ ok: false, reason: "not_announced" });
    expect(transactionRan).toBe(false);
  });

  /**
   * **เซิร์ฟเวอร์ต้องไม่รับค่าที่หน้าจอของตัวเองสร้างไม่ได้** — เจ้าของงานเคาะ 2026-09-09
   *
   * ก่อนหน้านี้ฝั่งเซิร์ฟเวอร์รับเลขสี่หลักอะไรก็ได้ เท่ากับ CHECK ที่ฐานพอดี · `2569-10`
   * จึงผ่านทั้งสองด่าน แล้วการ์ดจะขึ้นว่า "ต.ค. 12" เพราะถูกบวก 543 อีกรอบ ·
   * **มันตกเพราะไกลเกินขอบ ไม่ใช่เพราะเราเดาว่ามันเป็น พ.ศ.** ซึ่งเป็นเหตุผลที่ตรวจสอบได้
   */
  it("ปีในช่วงผ่าน ทั้งปลายต้นและปลายท้ายของช่วง", async () => {
    for (const month of ["2026-10", "2030-01"]) {
      updates = [];
      audits = [];

      expect(await setMonth({ month }), `${month} ต้องผ่าน`).toEqual({ ok: true });
      expect(audits, `${month} ต้องลงบันทึก`).toHaveLength(1);
    }
  });

  it("ปีเกินช่วงตก ทั้งไกลไปข้างหน้าและย้อนไปข้างหลัง", async () => {
    for (const month of ["2031-01", "2025-12"]) {
      transactionRan = false;

      expect(await setMonth({ month }), `${month} ต้องตก`).toEqual({ ok: false, reason: "year_out_of_range" });
      expect(transactionRan, `${month} ต้องไม่แตะฐาน`).toBe(false);
    }
  });

  it("ปีพุทธศักราชตก และตกด้วยเหตุผลว่าไกลเกินขอบ ไม่ใช่ว่ารูปแบบผิด", async () => {
    const result = await setMonth({ month: "2569-10" });

    /* **เหตุผลที่คืนกลับสำคัญเท่าการตก** `invalid_month` จะพาผู้ดูแลไปแก้รูปแบบ
       ซึ่งเขาพิมพ์ถูกอยู่แล้ว · `year_out_of_range` พาไปที่ปี ซึ่งเป็นที่ที่ผิดจริง */
    expect(result).toEqual({ ok: false, reason: "year_out_of_range" });
    expect(transactionRan).toBe(false);
  });

  /** ช่วงเดินตามนาฬิกา ไม่ใช่ตรึงไว้ที่ปีที่เขียนโค้ด · ปีเดียวกันจึงตกได้เมื่อเวลาผ่านไป */
  it("ช่วงปีขยับตามนาฬิกากรุงเทพ ไม่ใช่ตามปีที่พิมพ์ไว้ในโค้ด", async () => {
    const later = new Date("2031-01-01T03:00:00.000Z");

    expect(await setMonth({ month: "2026-10", now: later })).toEqual({ ok: false, reason: "year_out_of_range" });

    updates = [];
    audits = [];
    expect(await setMonth({ month: "2035-01", now: later })).toEqual({ ok: true });
  });

  /** การลบไม่ผ่านด่านช่วงปี เพราะไม่มีปีให้ตรวจ · ค่าที่หลุดช่วงจึงลบออกได้เสมอ */
  it("ลบเดือนออกได้แม้ค่าเดิมจะหลุดช่วงไปแล้ว", async () => {
    appRows = [{ slug: "rcopt", expectedOpenMonth: "2569-10", announcedAt: ANNOUNCED }];

    const result = await setMonth({ month: null, reason: "ลบค่าที่กรอกผิดปีออก" });

    expect(result).toEqual({ ok: true });
    expect(audits[0]).toMatchObject({
      metadata: { before: { expectedOpenMonth: "2569-10" }, after: { expectedOpenMonth: null } }
    });
  });

  it("แอปที่ไม่มีในสารบบถูกปฏิเสธ", async () => {
    const result = await setMonth({ month: "2026-10", slug: "ไม่มีแอปนี้" });

    expect(result).toEqual({ ok: false, reason: "unknown_app" });
    expect(transactionRan).toBe(false);
  });
});
