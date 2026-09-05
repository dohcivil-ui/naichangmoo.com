import type { EstimeterAccessView } from "@/lib/estimeter-access-view";

const headline: Record<EstimeterAccessView["state"], string> = {
  trial: "ทดลองใช้งาน",
  active: "สิทธิ์ใช้งานเต็มรูปแบบ",
  member_free: "สมาชิกใช้ฟรี",
  doh_staff_only: "สิทธิ์บุคลากรกรมทางหลวง",
  expired_read_only: "สิทธิ์ทดลองใช้หมดอายุแล้ว",
  suspended: "สิทธิ์ถูกระงับ",
  not_started: "สิทธิ์ยังไม่เริ่มใช้งาน",
  not_activated: "ยังไม่ได้เริ่มทดลองใช้"
};

function describe(access: EstimeterAccessView): string {
  if (access.state === "trial") {
    const remaining = access.daysRemaining === null ? "" : `เหลือ ${access.daysRemaining} วัน `;
    const until = access.endsAtLabel ? `ถึง ${access.endsAtLabel}` : "";
    return `${remaining}${until}`.trim();
  }
  if (access.state === "expired_read_only") {
    return "ข้อมูลเดิมยังเปิดดูได้ทั้งหมด แต่การสร้าง แก้ไข AI Takeoff ส่งออกและพิมพ์ถูกล็อกไว้";
  }
  if (access.state === "suspended") {
    return "ติดต่อผู้ดูแลสิทธิ์เพื่อเปิดการใช้งานอีกครั้ง";
  }
  if (access.state === "not_started") {
    return "สิทธิ์นี้จะเริ่มใช้งานได้ตามวันที่กำหนดไว้ในบัญชีของคุณ";
  }
  if (access.state === "not_activated") {
    return "นาฬิกาทดลองใช้ยังไม่เริ่มเดิน กดเริ่มทดลองใช้เมื่อพร้อมใช้งานจริง";
  }
  return "ใช้งาน workflow ได้ครบตามสิทธิ์ที่ได้รับ";
}

function quotaLabel(access: EstimeterAccessView): string {
  return access.projectLimit === null
    ? `ใช้ไปแล้ว ${access.projectCount} โครงการ`
    : `ใช้ไปแล้ว ${access.projectCount} จาก ${access.projectLimit} โครงการ`;
}

function capabilityRows(access: EstimeterAccessView): Array<[string, boolean]> {
  return [
    [`สร้างโครงการ (${quotaLabel(access)})`, access.capabilities.create_project],
    ["AI Takeoff และตรวจหลักฐาน", access.capabilities.run_ai],
    ["แก้ไข BOQ", access.capabilities.edit],
    ["ส่งออกไฟล์", access.capabilities.export],
    ["พิมพ์เอกสาร", access.capabilities.print]
  ];
}

/**
 * แถบสิทธิ์แบบบรรทัดเดียว สำหรับหน้าแรกที่การ์ดสี่ขั้นเป็นเรื่องหลัก (IP-235)
 *
 * บล็อกเต็มด้านล่างเคยกินพื้นที่หนึ่งหน้าจอบนหน้าแรก ทั้งที่คนเปิดแอปมาเพื่อทำงานต่อ
 * ไม่ใช่มาอ่านว่าตัวเองทำอะไรได้บ้าง เจ้าของงานสั่งย่อเมื่อ 2026-09-05 · **ไม่ตัดข้อมูลทิ้ง**
 * ห้าบรรทัดเดิมอยู่ครบใน `<details>` ซึ่งกดแล้วกางออกโดยไม่ต้องพึ่ง JavaScript
 */
export function EntitlementStrip({ access }: { access: EstimeterAccessView }) {
  const note = describe(access);

  return (
    <details className="eh__rights">
      <summary>
        <span className="eh__rights-state">{headline[access.state]}</span>
        <span className="eh__rights-note">{[note, quotaLabel(access)].filter(Boolean).join(" · ")}</span>
        <span className="eh__rights-more">ดูสิทธิ์ทั้งหมด</span>
      </summary>
      <ul>
        {capabilityRows(access).map(([name, enabled]) => (
          <li key={name}>
            <span className={enabled ? "capability capability--on" : "capability capability--off"}>
              {enabled ? "อนุญาต" : "ล็อก"}
            </span>
            {name}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function EntitlementStatus({ access }: { access: EstimeterAccessView }) {
  const rows = capabilityRows(access);

  return (
    <section className="policy-preview" aria-label="สิทธิ์การใช้งาน ESTIMETR ของบัญชีนี้">
      <div>
        <div className="eyebrow" style={{ color: "var(--teal)" }}>สิทธิ์การใช้งานของบัญชีนี้</div>
        <h3>{headline[access.state]}</h3>
        <p>{describe(access)}</p>
      </div>
      <div className="policy-preview__panel">
        <strong>{headline[access.state]}</strong>
        <ul>
          {rows.map(([name, enabled]) => (
            <li key={name}>
              <span className={enabled ? "capability capability--on" : "capability capability--off"}>{enabled ? "อนุญาต" : "ล็อก"}</span>
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
