import { describe, expect, it } from "vitest";
import { describeReadiness, formatExpectedMonth, isMonthStillAhead, splitExpectedMonth } from "./app-readiness";

/**
 * แถบความพร้อมสามขั้น — ADR 0025
 *
 * **ข้อที่ต้องมีตามที่ ADR สั่งไว้** เดือนในอนาคตอยู่ขั้นกลาง · เดือนที่เลยมาแล้วตกกลับ
 * ขั้นที่หนึ่ง · ยังไม่กรอกอยู่ขั้นที่หนึ่ง · เปิดแล้วอยู่ขั้นที่สามไม่ว่าเดือนคาดจะเป็นอะไร ·
 * ข้อที่ห้าคือลบเดือนออกแล้วต้องมีแถวใน `auditEvents` ซึ่งอยู่กับทางเขียนหลังบ้าน
 * ไม่ใช่กับฟังก์ชันนี้ เพราะฟังก์ชันนี้ไม่เขียนอะไรลงฐานเลย
 *
 * **ทุกข้อรับเวลาเข้ามา ไม่มีข้อไหนอ่านนาฬิกาจริง** ไม่งั้นเทสต์วันหมดอายุจะเขียนไม่ได้
 * จนกว่าจะถึงวันนั้นจริง และจะเปลี่ยนคำตอบเองเมื่อเวลาผ่านไป
 */
describe("แถบความพร้อมสามขั้น", () => {
  const announced = { announced: true, open: false, expectedOpenMonth: null as string | null };
  /**
   * **ทุกเวลาในไฟล์นี้เขียนเป็น UTC ชัด ๆ ห้ามใช้ `new Date(2026, 9, 15)`**
   *
   * คอนสตรักเตอร์แบบนั้นสร้างเวลาตามเขตเวลาของเครื่องที่รัน · เทสต์ชุดแรกของไฟล์นี้ใช้มัน
   * ทั้งสิบเอ็ดข้อ แล้วโค้ดก็อ่านเดือนตามเขตเวลาเครื่องเหมือนกัน · **สองข้อผิดหักล้างกันพอดี
   * เทสต์จึงเขียวในทุกเขตเวลา ทั้งที่ของจริงพังบนเซิร์ฟเวอร์ UTC** · เขียนเป็น `Z`
   * บังคับให้เทสต์ตอบคำถามว่า "ณ เวลานี้ ที่กรุงเทพเป็นเดือนอะไร" ซึ่งเป็นคำถามจริง
   */
  const october = new Date("2026-10-15T05:00:00Z");

  it("เดือนในอนาคตทำให้อยู่ขั้นกลาง", () => {
    const readiness = describeReadiness({ ...announced, expectedOpenMonth: "2026-12" }, october);
    expect(readiness).toEqual({ stage: "expected", label: "คาดว่าเปิด ธ.ค. 69" });
  });

  it("เดือนที่เลยมาแล้วตกกลับขั้นที่หนึ่ง ไม่ใช่ค้างแสดงเดือนเดิม", () => {
    const readiness = describeReadiness({ ...announced, expectedOpenMonth: "2026-08" }, october);
    expect(readiness).toEqual({ stage: "announced", label: "ประกาศแล้ว" });
  });

  it("ยังไม่กรอกอยู่ขั้นที่หนึ่ง", () => {
    expect(describeReadiness(announced, october)).toEqual({ stage: "announced", label: "ประกาศแล้ว" });
  });

  it("เปิดแล้วอยู่ขั้นที่สาม ไม่ว่าเดือนคาดจะเป็นอะไร", () => {
    const withFutureMonth = { announced: true, open: true, expectedOpenMonth: "2026-12" };
    const withPastMonth = { announced: true, open: true, expectedOpenMonth: "2020-01" };
    const withNoMonth = { announced: true, open: true, expectedOpenMonth: null };
    for (const claim of [withFutureMonth, withPastMonth, withNoMonth]) {
      expect(describeReadiness(claim, october)).toEqual({ stage: "open", label: "เปิดใช้แล้ว" });
    }
  });

  /**
   * **เดือนที่กำลังอยู่ยังไม่ผ่าน** ตุลาคมใช้ได้ตลอดเดือนตุลาคม และหมดอายุเมื่อขึ้นพฤศจิกายน
   * ถ้าตัดตั้งแต่วันแรกของเดือนนั้น คำแถลงจะตายก่อนถึงกำหนดของตัวเอง
   */
  it("เดือนปัจจุบันยังอยู่ขั้นกลางจนหมดเดือน ตามนาฬิกากรุงเทพ", () => {
    const claim = { ...announced, expectedOpenMonth: "2026-10" };
    /* 1 ต.ค. 00:00 กรุงเทพ = 30 ก.ย. 17:00 UTC — วันแรกของเดือนต้องยังอยู่ */
    expect(describeReadiness(claim, new Date("2026-09-30T17:00:00Z"))?.stage).toBe("expected");
    /* 31 ต.ค. 23:59 กรุงเทพ = 31 ต.ค. 16:59 UTC — วินาทีสุดท้ายก็ยังอยู่ */
    expect(describeReadiness(claim, new Date("2026-10-31T16:59:59Z"))?.stage).toBe("expected");
    /* 1 พ.ย. 00:00 กรุงเทพ = 31 ต.ค. 17:00 UTC — พ้นเดือนเมื่อไรต้องตกทันที */
    expect(describeReadiness(claim, new Date("2026-10-31T17:00:00Z"))?.stage).toBe("announced");
  });

  /**
   * **ข้อนี้คือข้อที่เทสต์ชุดแรกมองไม่เห็น** เพราะมันเขียนด้วยคอนสตรักเตอร์เวลาท้องถิ่น
   * เหมือนที่โค้ดอ่านเวลาท้องถิ่น · ของจริงรันบนเซิร์ฟเวอร์ที่เป็น UTC ซึ่งช้ากว่าไทยเจ็ดชั่วโมง
   * ถ้าอ่านเดือนจากเขตเวลาเครื่อง การ์ดจะพูดว่า "คาดว่าเปิด ต.ค." ต่อไปอีกเจ็ดชั่วโมง
   * หลังตุลาคมจบแล้วในเขตเวลาเดียวที่กิจการนี้อยู่ ซึ่งชน ADR 0025 ข้อ 4 ตรง ๆ
   */
  it("พ้นเดือนตามเวลากรุงเทพ ไม่ใช่ตามเขตเวลาของเครื่องที่รัน", () => {
    const claim = { ...announced, expectedOpenMonth: "2026-10" };
    /* 1 พ.ย. 05:00 กรุงเทพ ซึ่งยังเป็น 31 ต.ค. 22:00 ที่ UTC */
    const fiveAmInBangkok = new Date("2026-10-31T22:00:00Z");
    expect(describeReadiness(claim, fiveAmInBangkok)).toEqual({ stage: "announced", label: "ประกาศแล้ว" });
    expect(isMonthStillAhead("2026-10", fiveAmInBangkok)).toBe(false);
  });

  /**
   * ทางกลับกันก็ต้องถูก — ต้นเดือนที่กรุงเทพยังเป็นเดือนก่อนหน้าที่ UTC
   * ถ้าอ่านผิดเขต เดือนที่เพิ่งเริ่มจะถูกนับว่ายังไม่เริ่ม
   */
  it("เข้าเดือนใหม่ตามเวลากรุงเทพ ไม่ใช่ตามเขตเวลาของเครื่อง", () => {
    /* 1 พ.ย. 03:00 กรุงเทพ = 31 ต.ค. 20:00 UTC · เดือน พ.ย. คือเดือนปัจจุบัน ยังไม่ผ่าน */
    const inNovember = new Date("2026-10-31T20:00:00Z");
    expect(isMonthStillAhead("2026-11", inNovember)).toBe(true);
    expect(describeReadiness({ ...announced, expectedOpenMonth: "2026-11" }, inNovember)).toEqual({
      stage: "expected",
      label: "คาดว่าเปิด พ.ย. 69"
    });
  });

  /**
   * ADR 0015 §3 — แอปที่ยังไม่ถูกประกาศต้องเงียบเรื่องความพร้อม ไม่ใช่แสดงแถบที่ว่างเปล่า
   * คืน null เพื่อให้หน้าเลือกได้ว่าจะไม่วาดอะไรเลย ไม่ใช่ให้มันวาดขั้นที่หนึ่ง
   */
  it("ยังไม่ประกาศคือไม่มีแถบ ไม่ใช่แถบขั้นที่หนึ่ง", () => {
    expect(describeReadiness({ announced: false, open: false, expectedOpenMonth: "2026-12" }, october)).toBeNull();
    expect(describeReadiness({ announced: false, open: true, expectedOpenMonth: null }, october)).toBeNull();
  });

  /**
   * **ค่าที่อ่านไม่สำเร็จให้ผลเหมือนกันทุกประการกับยังไม่กรอก** ตาม §3 ของ ADR 0015
   * ที่ ADR 0025 ข้อ 5 อ้างถึง · ฐานมี CHECK กันรูปแบบไว้แล้ว แต่ฟังก์ชันนี้ต้องไม่พัง
   * ถ้าวันหนึ่งมีค่าที่ผิดรูปหลุดเข้ามา เช่นจากการกู้คืนข้อมูลเก่า
   */
  it("ค่าที่ผิดรูปให้ผลเท่ากับยังไม่กรอก", () => {
    for (const bad of ["2026-13", "2026-00", "202610", "2026-1", "ตุลาคม", "2026-10-01", ""]) {
      expect(describeReadiness({ ...announced, expectedOpenMonth: bad }, october)).toEqual({
        stage: "announced",
        label: "ประกาศแล้ว"
      });
    }
  });
});

/**
 * เก็บเป็น ค.ศ. แสดงเป็น พ.ศ. — เจ้าของงานเคาะ 2026-09-07
 *
 * เก็บ ค.ศ. เพราะต้องเทียบกับนาฬิกาและกับ `announced_at` ซึ่งเป็น timestamp ปกติ
 * ส่วนหน้าจอเป็น พ.ศ. ทั้งเว็บตามคำสั่ง 2026-08-28 · **การแปลงอยู่ที่เดียว**
 * ถ้ามีที่สอง วันหนึ่งจะมีที่หนึ่งลืมบวก 543 แล้วไม่มีอะไรบอก
 */
describe("การแสดงเดือนที่คาดว่าเปิด", () => {
  it("แปลงเป็น พ.ศ. และย่อชื่อเดือน", () => {
    expect(formatExpectedMonth("2026-10")).toBe("ต.ค. 69");
    expect(formatExpectedMonth("2026-01")).toBe("ม.ค. 69");
    expect(formatExpectedMonth("2027-12")).toBe("ธ.ค. 70");
  });

  it("ค่าที่ผิดรูปไม่ถูกแสดง", () => {
    expect(formatExpectedMonth("2026-13")).toBeNull();
    expect(formatExpectedMonth("202610")).toBeNull();
  });

  it("แยกเดือนได้ตรงตามที่เก็บ", () => {
    expect(splitExpectedMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(splitExpectedMonth(null)).toBeNull();
  });

  it("เดือนว่างไม่นับว่าอยู่ข้างหน้า", () => {
    expect(isMonthStillAhead(null, new Date("2026-01-01T00:00:00Z"))).toBe(false);
  });
});
