"use client";

import { useState } from "react";
import { AppAssistant } from "@/components/platform/assistant-dock";
import { formatPrice } from "@/lib/price-catalogue";
import { requestAssistant, settleAssistantProposal } from "@/server/actions/assistant";
import { acceptBoqMatches, loadBoqMatchInput } from "@/server/actions/estimeter-boq";

/**
 * ผู้ช่วย ESTIMETR บนหน้าโครงการ — จับคู่ปริมาณกับชุดราคาแล้วให้คนติ๊กรับทีละคู่ (IP-217)
 *
 * อยู่ในแผงผู้ช่วยกลางเหมือนทุกแอปตาม IP-184 ไม่ได้สร้างแผงใหม่ซ้อนของกลาง
 *
 * **ยอดเงินที่แสดงคำนวณจากราคาที่เก็บไว้ ไม่ได้มาจากผู้ช่วย** ผู้ช่วยคืนแค่คู่ ระบบเป็นผู้คูณ
 * ตัวเลขบนจอนี้จึงตรวจย้อนได้ถึงบรรทัดในชุดราคาเสมอ ไม่ใช่ตัวเลขที่แบบจำลองเขียนมา
 *
 * **ทุกคู่เริ่มต้นที่ไม่ติ๊ก** คนต้องเลือกเอง ไม่ใช่ระบบติ๊กให้แล้วรอคนเอาออก การตั้งค่าเริ่มต้น
 * เป็นรับทั้งหมดคือการทำให้การยืนยันของคนกลายเป็นพิธี ซึ่งขัดกับ ADR 0019
 */

type Proposal = {
  id: string;
  matches: { itemRef: string; lineRef: string; confidence: string; reason: string }[];
  unmatched: { itemRef: string; why: string }[];
  note: string;
  assumptions: string[];
  warnings: string[];
};

type Row = {
  itemRef: string;
  lineRef: string;
  confidence: string;
  reason: string;
  itemDescription: string;
  itemUnit: string;
  quantity: string;
  priceName: string;
  amountSatang: bigint;
};

export function BoqAssistant({
  projectId,
  revisionId,
  revisionLabel,
  canEdit,
  unitSatangByRef
}: {
  projectId: string;
  revisionId: string | null;
  revisionLabel: string | null;
  canEdit: boolean;
  /** ราคาต่อหน่วยของแต่ละบรรทัดในชุดราคา ส่งมาจากเซิร์ฟเวอร์เพื่อให้จอคูณให้ดูได้ทันที */
  unitSatangByRef: Record<string, string>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const canAsk = canEdit && revisionId !== null && !busy;

  async function ask() {
    setBusy(true);
    setMessage(null);
    try {
      const loaded = await loadBoqMatchInput(projectId);
      if (!loaded.ok) {
        setMessage(loaded.message);
        return;
      }

      const result = await requestAssistant({
        app: "estimeter",
        verb: "draft",
        subject: `project:${projectId}`,
        input: loaded.input,
        facts: [
          `รายการปริมาณที่ยืนยันแล้ว ${loaded.input.items.length} รายการ`,
          `บรรทัดในชุดราคาที่โครงการรับมาแล้ว ${loaded.input.lines.length} บรรทัด`
        ]
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      // ประตูคืน draft เป็น unknown เพราะมันไม่รู้จักแอปไหนเลย ชนิดจริงถูกบังคับด้วย zod
      // ที่ฝั่งเซิร์ฟเวอร์ไปแล้วก่อนถึงตรงนี้ การอ่านค่าที่นี่จึงอ่านตามรูปที่ schema รับประกัน
      const draft = result.proposal.draft as {
        matches: Proposal["matches"];
        unmatched: Proposal["unmatched"];
        note: string;
      };

      const byItemRef = new Map(loaded.input.items.map((item) => [item.ref, item]));
      const byLineRef = new Map(loaded.input.lines.map((line) => [line.ref, line]));

      const built = draft.matches.flatMap((match) => {
        const item = byItemRef.get(match.itemRef);
        const line = byLineRef.get(match.lineRef);
        if (!item || !line) return [];
        const unit = BigInt(unitSatangByRef[match.lineRef] ?? "0");
        return [
          {
            itemRef: match.itemRef,
            lineRef: match.lineRef,
            confidence: match.confidence,
            reason: match.reason,
            itemDescription: item.description,
            itemUnit: item.unit,
            quantity: item.quantity,
            priceName: line.name,
            amountSatang: BigInt(Math.round(Number(unit) * Number(item.quantity)))
          }
        ];
      });

      setProposal({
        id: result.proposal.proposalId,
        matches: draft.matches,
        unmatched: draft.unmatched,
        note: draft.note,
        assumptions: result.proposal.assumptions,
        warnings: result.proposal.warnings
      });
      setRows(built);
      setPicked(new Set());
      setMessage(built.length === 0 ? "ผู้ช่วยยังจับคู่ไม่ได้สักคู่" : null);
    } catch {
      setMessage("เรียกผู้ช่วยไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  function toggle(itemRef: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(itemRef)) next.delete(itemRef);
      else next.add(itemRef);
      return next;
    });
  }

  async function accept() {
    if (!proposal || !revisionId || picked.size === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const chosen = rows.filter((row) => picked.has(row.itemRef));
      const result = await acceptBoqMatches({
        projectId,
        revisionId,
        matches: chosen.map((row) => ({ itemRef: row.itemRef, lineRef: row.lineRef, confidence: row.confidence }))
      });
      setMessage(result.message);
      if (!result.ok) return;

      // บันทึกว่าคนตัดสินอย่างไรกับข้อเสนอนี้ รับบางส่วนก็คือรับบางส่วน ไม่ใช่รับทั้งชุด
      await settleAssistantProposal({
        proposalId: proposal.id,
        decision: "accepted",
        before: { accepted: 0 },
        after: { accepted: chosen.map((row) => `${row.itemRef}->${row.lineRef}`) }
      });
      setProposal(null);
      setRows([]);
      setPicked(new Set());
    } catch {
      setMessage("รับคู่เข้า BOQ ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!proposal) return;
    await settleAssistantProposal({ proposalId: proposal.id, decision: "rejected" });
    setProposal(null);
    setRows([]);
    setPicked(new Set());
    setMessage("ไม่รับข้อเสนอชุดนี้แล้ว");
  }

  const total = rows
    .filter((row) => picked.has(row.itemRef))
    .reduce((sum, row) => sum + row.amountSatang, 0n);

  return (
    <AppAssistant
      title="ผู้ช่วยจัดทำ BOQ"
      busy={busy}
      status={
        busy
          ? { label: "กำลังคิด", tone: "attention" }
          : proposal
            ? { label: "มีข้อเสนอรอตัดสิน", tone: "attention" }
            : revisionId
              ? { label: "พร้อมจับคู่", tone: "ready" }
              : { label: "ต้องออกฉบับคำนวณก่อน", tone: "attention" }
      }
    >
      <div className="boq-assistant">
        <p className="boq-assistant__lead">
          ผู้ช่วยดูรายการปริมาณที่ยืนยันแล้ว แล้วบอกว่าแต่ละรายการตรงกับบรรทัดไหนในชุดราคา
          <strong> คู่ที่เสนอยังไม่ถูกใช้จนกว่าจะติ๊กรับทีละคู่</strong>
        </p>

        {revisionId ? (
          <p className="boq-assistant__target">รับเข้าฉบับ {revisionLabel}</p>
        ) : (
          <p className="boq-assistant__target">ยังไม่มีฉบับคำนวณให้รับเข้า ออกฉบับที่แผงชุดราคาก่อน</p>
        )}

        <button className="button button--orange micro-button" type="button" disabled={!canAsk} onClick={ask}>
          {busy ? "กำลังจับคู่..." : "ให้ผู้ช่วยจับคู่ปริมาณกับชุดราคา"}
        </button>

        {message ? (
          <p className="boq-assistant__message" role="status">
            {message}
          </p>
        ) : null}

        {proposal?.warnings.map((warning) => (
          <p key={warning} className="boq-assistant__warning">
            {warning}
          </p>
        ))}

        {rows.length > 0 ? (
          <>
            <ul className="boq-assistant__matches">
              {rows.map((row) => (
                <li key={row.itemRef}>
                  <label>
                    <input type="checkbox" checked={picked.has(row.itemRef)} onChange={() => toggle(row.itemRef)} />
                    <span>
                      <strong>{row.itemDescription}</strong>
                      <small>
                        คู่กับ {row.priceName} · ความมั่นใจ {row.confidence} · {row.reason}
                      </small>
                      <small>
                        {row.quantity} {row.itemUnit} · เป็นเงิน {formatPrice(row.amountSatang)} บาท
                      </small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <p className="boq-assistant__total">
              ติ๊กไว้ {picked.size} คู่ · รวม {formatPrice(total)} บาท
            </p>

            <div className="boq-assistant__actions">
              <button
                className="button button--orange micro-button"
                type="button"
                disabled={busy || picked.size === 0}
                onClick={accept}
              >
                รับคู่ที่ติ๊กไว้เข้า BOQ
              </button>
              <button className="button button--ghost micro-button" type="button" disabled={busy} onClick={reject}>
                ไม่รับชุดนี้
              </button>
            </div>
          </>
        ) : null}

        {proposal && proposal.unmatched.length > 0 ? (
          <div className="boq-assistant__unmatched">
            <strong>ยังหาคู่ไม่ได้ {proposal.unmatched.length} รายการ</strong>
            <ul>
              {proposal.unmatched.map((row) => (
                <li key={row.itemRef}>{row.why}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {proposal?.assumptions.map((assumption) => (
          <p key={assumption} className="boq-assistant__note">
            {assumption}
          </p>
        ))}
      </div>
    </AppAssistant>
  );
}
