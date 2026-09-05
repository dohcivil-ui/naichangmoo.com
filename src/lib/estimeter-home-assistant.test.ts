import { describe, expect, it } from "vitest";
import { homeAssistantScript, QUOTED_CLAIM_TITLES } from "@/lib/estimeter-home-assistant";
import { nextActionLine, type HomeProgress } from "@/lib/estimeter-home-status";
import { methodClaims } from "@/lib/method-claims";

const progress: HomeProgress = {
  drawing: { documentCount: 1, pageCount: 32, calibratedPages: 1, scaleLabel: "1:125", latestPage: 7 },
  takeoff: { itemCount: 3, confirmedItems: 0, closedRuns: 0 },
  pricing: { priceSetCount: 0, revisionCount: 0 }
};

describe("บทของผู้ช่วยบนหน้าแรก ESTIMETR (IP-235)", () => {
  it("ทุกข้อที่ผู้ช่วยอ้างถึงยังมีอยู่จริงใน method-claims", () => {
    const titles = methodClaims.map((claim) => claim.title);
    for (const title of QUOTED_CLAIM_TITLES) expect(titles).toContain(title);
  });

  it("คำอธิบายวิธีทำงานถูกยกมาทั้งดุ้น ไม่ถูกเขียนใหม่ให้สวยขึ้น", () => {
    const answers = homeAssistantScript({ project: null }).prompts.map((prompt) => prompt.answer);
    for (const title of QUOTED_CLAIM_TITLES) {
      const body = methodClaims.find((claim) => claim.title === title)?.body;
      expect(answers).toContain(body);
    }
  });

  it("ทุกข้อที่ยกมาต้องมีไฟล์เทสต์กำกับ ไม่ใช่คำโฆษณาลอย ๆ", () => {
    for (const title of QUOTED_CLAIM_TITLES) {
      const claim = methodClaims.find((one) => one.title === title);
      expect(claim?.provenBy).toBeTruthy();
      expect(claim?.appliesTo).toContain("estimeter");
    }
  });

  it("เปิดครั้งแรก ทักว่ายังไม่มีโครงการ และไม่มีปุ่มถามเรื่องงานที่ค้าง", () => {
    const script = homeAssistantScript({ project: null });
    expect(script.greeting[0]).toContain("ยังไม่มีโครงการ");
    expect(script.prompts.map((prompt) => prompt.question)).not.toContain("ตอนนี้ค้างอยู่ตรงไหน");
  });

  it("มีงานค้าง ทักด้วยชื่อโครงการจริง และคำตอบเรื่องที่ค้างตรงกับที่การ์ดบอก", () => {
    const script = homeAssistantScript({ project: { name: "อาคารฟอกไต", progress } });
    expect(script.greeting[0]).toBe("วันนี้กลับมาที่ อาคารฟอกไต นะครับ");
    expect(script.greeting[1]).toBe(nextActionLine(progress));
    expect(script.prompts[0]).toEqual({ question: "ตอนนี้ค้างอยู่ตรงไหน", answer: nextActionLine(progress) });
  });

  it("ถามซ้ำได้คำตอบเดิมทุกครั้ง เพราะไม่มีแบบจำลองอยู่ในเส้นทางนี้", () => {
    const once = homeAssistantScript({ project: { name: "อาคารฟอกไต", progress } });
    const twice = homeAssistantScript({ project: { name: "อาคารฟอกไต", progress } });
    expect(twice).toEqual(once);
  });
});
