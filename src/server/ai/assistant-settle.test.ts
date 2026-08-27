import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROPOSAL_TTL_MS } from "@/server/ai/assistant-contract";

/**
 * คนตัดสิน ไม่ใช่ระบบ
 *
 * สิ่งที่เทสต์ชุดนี้เฝ้าคือ **ไม่มีทางที่ค่าจากแบบจำลองจะเข้าไปนั่งในข้อมูลจริงโดยไม่มีคนกด**
 * และร่างเก่าที่ค้างข้ามวันจะกดรับทับงานที่แก้ไปแล้วไม่ได้ ซึ่งเป็นการย้อนเวลาที่คนกดมองไม่เห็น
 */

const loadProposal = vi.fn();
const recordDecision = vi.fn();

vi.mock("@/server/ai/assistant-audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/ai/assistant-audit")>();
  return { ...actual, loadProposal, recordDecision };
});

vi.mock("@/db", () => ({ getDb: () => ({}) }));

const { settleProposal } = await import("@/server/ai/assistant");

const ACTOR = { id: "user_1" };
const NOW = new Date(Date.UTC(2026, 7, 27, 3, 0, 0));

const stored = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "prop_1",
  actorId: "user_1",
  organizationId: "org_1",
  appSlug: "work-plan",
  verb: "critique",
  subject: "project:demo",
  decision: "proposed",
  createdAt: new Date(NOW.getTime() - 60_000),
  ...overrides
});

describe("การตัดสินข้อเสนอ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordDecision.mockResolvedValue(undefined);
  });

  it("บันทึกการรับพร้อมรหัสอ้างอิงเดียวกับข้อเสนอ", async () => {
    loadProposal.mockResolvedValue(stored());
    const result = await settleProposal(ACTOR, { proposalId: "prop_1", decision: "accepted" }, NOW);

    expect(result.ok).toBe(true);
    expect(recordDecision).toHaveBeenCalledTimes(1);
    expect(recordDecision.mock.calls[0]![0].decision).toBe("accepted");
  });

  it("บันทึกการปฏิเสธเท่ากับการรับ เพราะอัตราการถูกปฏิเสธคือมาตรวัดของผู้ช่วย", async () => {
    loadProposal.mockResolvedValue(stored());
    const result = await settleProposal(ACTOR, { proposalId: "prop_1", decision: "rejected" }, NOW);

    expect(result.ok).toBe(true);
    expect(recordDecision.mock.calls[0]![0].decision).toBe("rejected");
  });

  it("เก็บรายชื่อช่องที่ผู้ใช้เลือกไว้เมื่อรับบางส่วน", async () => {
    loadProposal.mockResolvedValue(stored());
    await settleProposal(
      ACTOR,
      { proposalId: "prop_1", decision: "partially_accepted", changedFields: ["งวดที่ 1", "งวดที่ 3"] },
      NOW
    );
    expect(recordDecision.mock.calls[0]![0].changedFields).toEqual(["งวดที่ 1", "งวดที่ 3"]);
  });

  it("ส่งรหัสย่อของสถานะก่อนและหลังลง audit ซึ่งเป็นการใช้สองช่องนี้ครั้งแรกในรีโป", async () => {
    loadProposal.mockResolvedValue(stored());
    await settleProposal(
      ACTOR,
      { proposalId: "prop_1", decision: "accepted", beforeHash: "a".repeat(64), afterHash: "b".repeat(64) },
      NOW
    );
    const call = recordDecision.mock.calls[0]![0];
    expect(call.beforeHash).toBe("a".repeat(64));
    expect(call.afterHash).toBe("b".repeat(64));
  });

  it("ปฏิเสธคนที่ไม่ได้เข้าสู่ระบบ", async () => {
    const result = await settleProposal(null, { proposalId: "prop_1", decision: "accepted" }, NOW);
    expect(result.ok).toBe(false);
    expect(recordDecision).not.toHaveBeenCalled();
  });

  it("ปฏิเสธข้อเสนอของบัญชีอื่น", async () => {
    loadProposal.mockResolvedValue(stored({ actorId: "user_2" }));
    const result = await settleProposal(ACTOR, { proposalId: "prop_1", decision: "accepted" }, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_yours");
    expect(recordDecision).not.toHaveBeenCalled();
  });

  it("ปฏิเสธข้อเสนอที่ถูกตัดสินไปแล้ว ไม่ให้กดซ้ำเปลี่ยนคำตัดสิน", async () => {
    loadProposal.mockResolvedValue(stored({ decision: "rejected" }));
    const result = await settleProposal(ACTOR, { proposalId: "prop_1", decision: "accepted" }, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already_settled");
    expect(recordDecision).not.toHaveBeenCalled();
  });

  it("ไม่พบข้อเสนอก็บอกตรง ๆ", async () => {
    loadProposal.mockResolvedValue(null);
    const result = await settleProposal(ACTOR, { proposalId: "prop_x", decision: "accepted" }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("ร่างที่เกินหนึ่งวันหมดอายุ และถูกปั๊มสถานะไว้ในประวัติ ไม่ใช่หายเงียบ", async () => {
    loadProposal.mockResolvedValue(stored({ createdAt: new Date(NOW.getTime() - PROPOSAL_TTL_MS - 1_000) }));
    const result = await settleProposal(ACTOR, { proposalId: "prop_1", decision: "accepted" }, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
    expect(recordDecision).toHaveBeenCalledTimes(1);
    expect(recordDecision.mock.calls[0]![0].decision).toBe("expired");
  });

  it("ร่างที่อายุยังไม่ถึงหนึ่งวันยังกดรับได้ตามปกติ", async () => {
    loadProposal.mockResolvedValue(stored({ createdAt: new Date(NOW.getTime() - PROPOSAL_TTL_MS + 1_000) }));
    const result = await settleProposal(ACTOR, { proposalId: "prop_1", decision: "accepted" }, NOW);
    expect(result.ok).toBe(true);
  });
});
