import { describe, expect, it } from "vitest";
import { currentStage, firstRunStages, homeStages, nextActionLine, type HomeProgress } from "@/lib/estimeter-home-status";
import { platformApps } from "@/lib/platform";

/** โครงการที่เพิ่งสร้าง ยังไม่ได้เปิดแบบ — สถานะของโครงการจริงของเจ้าของงานตอนนี้ */
const fresh: HomeProgress = {
  drawing: { documentCount: 0, pageCount: null, calibratedPages: 0, scaleLabel: null, latestPage: null },
  takeoff: { itemCount: 0, confirmedItems: 0, closedRuns: 0 },
  pricing: { priceSetCount: 0, revisionCount: 0 }
};

function withDrawing(over: Partial<HomeProgress["drawing"]>): HomeProgress {
  return { ...fresh, drawing: { ...fresh.drawing, ...over } };
}

describe("สถานะสี่ขั้นบนหน้าแรก ESTIMETR (IP-235)", () => {
  it("ชื่อสี่ขั้นตรงกับทะเบียนแอป ไม่แตกเป็นคนละชุด", () => {
    const registered = platformApps.find((app) => app.slug === "estimeter")?.marketDetail?.flow;
    expect(homeStages(fresh).map((stage) => stage.label)).toEqual(registered);
  });

  it("ยังไม่มีโครงการสักใบ ขั้นหนึ่งคือสิ่งที่ต้องทำ ไม่ใช่สิ่งที่เสร็จแล้ว", () => {
    const stages = firstRunStages();
    expect(stages.map((stage) => stage.tone)).toEqual(["now", "wait", "wait", "wait"]);
    expect(stages[0].badge).toBe("เริ่มที่นี่");
    // ชื่อขั้นต้องเป็นชุดเดียวกับตอนมีโครงการแล้ว ไม่ใช่คนละชุด
    expect(stages.map((stage) => stage.label)).toEqual(homeStages(fresh).map((stage) => stage.label));
  });

  it("โครงการที่ยังไม่ได้เปิดแบบ ค้างที่ขั้นสอง และขั้นหนึ่งเสร็จแล้ว", () => {
    const stages = homeStages(fresh);
    expect(currentStage(fresh)).toBe(2);
    expect(stages.map((stage) => stage.tone)).toEqual(["done", "now", "wait", "wait"]);
    expect(stages[1].badge).toBe("ยังไม่ได้เปิดแบบ");
  });

  it("เปิดแบบแล้วแต่ยังไม่ตั้งสเกล ยังค้างที่ขั้นสอง เพราะเครื่องมือวัดกดไม่ได้", () => {
    const progress = withDrawing({ documentCount: 1, pageCount: 32 });
    expect(currentStage(progress)).toBe(2);
    expect(homeStages(progress)[1].badge).toBe("เปิดแบบแล้ว ยังไม่ได้ตั้งสเกล");
    expect(nextActionLine(progress)).toContain("ยังไม่ได้ตั้งสเกลสักหน้า");
  });

  it("ตั้งสเกลหน้าเดียวจาก 32 หน้า ถือว่าขั้นสองจบ และป้ายบอกเลขจริงทั้งสองตัว", () => {
    const progress = withDrawing({ documentCount: 1, pageCount: 32, calibratedPages: 1, scaleLabel: "1:125", latestPage: 7 });
    expect(currentStage(progress)).toBe(3);
    expect(homeStages(progress)[1].badge).toBe("ตั้งสเกลแล้ว 1 จาก 32 หน้า");
    expect(nextActionLine(progress)).toBe("หน้า 7 ตั้งสเกล 1:125 แล้ว ที่เหลืออีก 31 หน้ายังไม่ได้ตั้ง");
  });

  it("ไม่รู้จำนวนหน้าของแบบ ป้ายบอกเฉพาะหน้าที่ตั้งแล้ว ไม่เดาว่าเหลือกี่หน้า", () => {
    const progress = withDrawing({ documentCount: 1, pageCount: null, calibratedPages: 2, scaleLabel: "1:100", latestPage: 3 });
    expect(homeStages(progress)[1].badge).toBe("ตั้งสเกลแล้ว 2 หน้า");
    expect(nextActionLine(progress)).toBe("หน้า 3 ตั้งสเกล 1:100 แล้ว");
  });

  it("รายการที่ยังไม่ยืนยันไม่ทำให้ขั้นสามจบ แต่ป้ายบอกทั้งจำนวนรายการและจำนวนที่ยืนยันแล้ว", () => {
    const progress: HomeProgress = {
      ...withDrawing({ documentCount: 1, pageCount: 32, calibratedPages: 1, scaleLabel: "1:125", latestPage: 7 }),
      takeoff: { itemCount: 3, confirmedItems: 0, closedRuns: 0 }
    };
    expect(currentStage(progress)).toBe(3);
    expect(homeStages(progress)[2].badge).toBe("3 รายการ ยืนยันแล้ว 0");
    expect(nextActionLine(progress)).toContain("มี 3 รายการรอยืนยัน");
  });

  it("ยืนยันปริมาณแล้วแต่ยังไม่มีบัญชีราคา ไปค้างที่ขั้นสี่", () => {
    const progress: HomeProgress = {
      ...withDrawing({ documentCount: 1, pageCount: 32, calibratedPages: 1, scaleLabel: "1:125", latestPage: 7 }),
      takeoff: { itemCount: 3, confirmedItems: 3, closedRuns: 0 }
    };
    expect(currentStage(progress)).toBe(4);
    expect(homeStages(progress).map((stage) => stage.tone)).toEqual(["done", "done", "done", "now"]);
    expect(homeStages(progress)[3].badge).toBe("ยังไม่มีบัญชีราคา");
    expect(nextActionLine(progress)).toContain("ยืนยันปริมาณแล้ว 3 รายการ");
  });

  it("รับบัญชีราคาแล้วแต่ยังไม่ออกประมาณราคา ยังอยู่ขั้นสี่", () => {
    const progress: HomeProgress = {
      ...withDrawing({ documentCount: 1, pageCount: 32, calibratedPages: 1, scaleLabel: "1:125", latestPage: 7 }),
      takeoff: { itemCount: 3, confirmedItems: 3, closedRuns: 0 },
      pricing: { priceSetCount: 1, revisionCount: 0 }
    };
    expect(homeStages(progress)[3].badge).toBe("รับมาแล้ว 1 บัญชี");
    expect(nextActionLine(progress)).toBe("รับบัญชีราคามาแล้ว 1 บัญชี ยังไม่ได้ออกประมาณราคา");
  });

  it("ออกประมาณราคาแล้ว ทุกขั้นก่อนหน้าจบ และขั้นสี่ยังเป็นขั้นปัจจุบัน เพราะไม่มีขั้นที่ห้า", () => {
    const progress: HomeProgress = {
      ...withDrawing({ documentCount: 1, pageCount: 32, calibratedPages: 1, scaleLabel: "1:125", latestPage: 7 }),
      takeoff: { itemCount: 3, confirmedItems: 3, closedRuns: 1 },
      pricing: { priceSetCount: 1, revisionCount: 3 }
    };
    expect(currentStage(progress)).toBe(4);
    expect(homeStages(progress)[3].badge).toBe("ออกประมาณราคาแล้ว 3 ครั้ง");
    expect(nextActionLine(progress)).toContain("ออกประมาณราคาแล้ว 3 ครั้ง");
  });

  it("รอบที่ปิดไปแล้วโดยไม่มีรายการค้าง ป้ายขั้นสามบอกจำนวนรอบ", () => {
    const progress: HomeProgress = {
      ...withDrawing({ documentCount: 1, pageCount: 32, calibratedPages: 1, scaleLabel: "1:125", latestPage: 7 }),
      takeoff: { itemCount: 0, confirmedItems: 0, closedRuns: 2 }
    };
    expect(homeStages(progress)[2].badge).toBe("ปิดรอบแล้ว 2 รอบ");
  });
});
