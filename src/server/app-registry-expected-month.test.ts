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

async function setMonth(input: { month: string | null; reason?: string; slug?: string }) {
  const { setExpectedOpenMonth } = await import("@/server/app-registry");
  return setExpectedOpenMonth({
    slug: input.slug ?? "rcopt",
    month: input.month,
    reason: input.reason ?? "ทีมยืนยันกำหนดเปิดแล้ว",
    actorId: "admin-1"
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

  /**
   * **`2569-10` ไม่ได้อยู่ในรายการนี้ และนั่นคือช่องโหว่ที่ยังเปิดอยู่ ไม่ใช่การมองข้าม**
   *
   * ปีพุทธศักราชผ่านทั้งด่านที่แอปและ CHECK ที่ฐาน เพราะทั้งคู่ตรวจแค่ว่าเป็นเลขสี่หลัก ·
   * ถ้ามันหลุดเข้าไป การ์ดจะขึ้นว่า "คาดว่าเปิด ต.ค. 12" เพราะ `formatExpectedMonth`
   * บวก 543 ให้อีกรอบ · **รายงานไว้แล้ว ยังไม่แก้ เพราะการเพิ่มช่วงปีที่ยอมรับเป็นกฎใหม่
   * ที่ ADR 0025 ไม่ได้ตัดสิน** และการเขียนกฎเองเงียบ ๆ คือสิ่งที่ทั้งวันนี้ใช้ไปกับการแก้ ·
   * ทางกันชั้นแรกคือช่องกรอกเป็น `type="month"` ซึ่งคืนค่าเป็น ค.ศ. เสมอ
   */
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

  it("แอปที่ไม่มีในสารบบถูกปฏิเสธ", async () => {
    const result = await setMonth({ month: "2026-10", slug: "ไม่มีแอปนี้" });

    expect(result).toEqual({ ok: false, reason: "unknown_app" });
    expect(transactionRan).toBe(false);
  });
});
