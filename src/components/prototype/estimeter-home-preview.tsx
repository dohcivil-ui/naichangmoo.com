"use client";

import { useState } from "react";

/**
 * ต้นแบบเนื้อในของหน้าแรก ESTIMETR (IP-235)
 *
 * **ไม่มีแถบบน ไม่มีกล่องชื่อแอป ไม่มีท้ายเว็บในไฟล์นี้โดยตั้งใจ** — `AppShell` วางให้แล้วทั้งสามอย่าง
 * เจ้าของงานย้ำเมื่อ 2026-09-05 ว่าแถบบนกับท้ายเว็บต้องเป็นของเรา ไฟล์ต้นแบบ HTML ที่เขาเลือก
 * (`.design/estimeter-home/variant-b-ours-dense.html`) วาดแถบปลอมไว้เพื่อให้ดูรูปได้ครบหน้า
 * ของพวกนั้นถูกทิ้งไปทั้งก้อน เอามาเฉพาะเนื้อใน
 *
 * **ผู้ช่วยยังไม่ต่อแบบจำลอง** ปุ่มกับบทสนทนาในนี้เป็นสคริปต์ที่เขียนไว้ ตอบเหมือนเดิมทุกครั้ง
 * และไม่มีค่าใช้จ่ายต่อคลิก ตามคำตัดสินของเจ้าของงานว่าผู้ช่วย "เริ่มด้วยปุ่ม พิมพ์เองก็ได้"
 * ช่องพิมพ์จึงยังปิดอยู่ รอ grill เรื่องผู้ช่วยก่อน
 *
 * ปุ่มสลับสองสถานะมีเพื่อให้ดูของทั้งสองแบบในหน้าเดียว ของจริงเลือกจากจำนวนโครงการที่มี
 * ไม่ใช่จากปุ่ม · ลบทั้งไฟล์ได้เมื่อยกเนื้อในเข้าหน้าจริงแล้ว
 */

type Stage = "first" | "working";

const STEPS = [
  {
    id: 1,
    title: "ตั้งค่าโครงการ",
    note: "ใส่ชื่อโครงการ ชื่อผู้ประมาณราคา และประเภทงาน",
    first: { label: "เริ่มที่นี่", tone: "now" },
    working: { label: "เสร็จแล้ว", tone: "done" }
  },
  {
    id: 2,
    title: "เปิดแบบและยืนยันสเกล",
    note: "เปิดไฟล์แบบ PDF แล้วตั้งสเกลของแต่ละหน้าที่จะวัด",
    first: { label: "ยังไม่เริ่ม", tone: "wait" },
    working: { label: "ค้างอยู่ที่ขั้นนี้", tone: "now" }
  },
  {
    id: 3,
    title: "ถอดปริมาณพร้อมหลักฐาน",
    note: "วัดบนแบบ ระบบจดที่มาของทุกตัวเลขให้เอง",
    first: { label: "ยังไม่เริ่ม", tone: "wait" },
    working: { label: "3 รายการ ยืนยันแล้ว 0", tone: "wait" }
  },
  {
    id: 4,
    title: "ประมาณราคาและสรุป BOQ",
    note: "ดึงราคาจาก price set ที่รับมา แล้วออก BOQ",
    first: { label: "ยังไม่เริ่ม", tone: "wait" },
    working: { label: "รับมาแล้ว 1 บัญชี", tone: "wait" }
  }
] as const;

/** ขั้นที่ไฮไลท์ในแต่ละสถานะ — สถานะแรกยังไม่มีโครงการ จึงเน้นขั้นที่หนึ่ง */
const HERE: Record<Stage, number> = { first: 1, working: 2 };

const CHIPS: Record<Stage, string[]> = {
  first: ["ตั้งค่าโครงการให้ผมเลย", "สอนวิธีถอดปริมาณจากแบบ", "ขอดูตัวอย่าง BOQ ที่ได้"],
  working: ["พาไปตั้งสเกลหน้าที่เหลือ", "ดูวิธีคิดพื้นที่ห้องแบบเต็ม", "เริ่มโครงการใหม่"]
};

export function EstimeterHomePreview() {
  const [stage, setStage] = useState<Stage>("first");

  return (
    <section className="eh">
      <div className="container">
        <div className="eh__switch" role="group" aria-label="สลับสถานะที่จะดู">
          <button type="button" aria-pressed={stage === "first"} onClick={() => setStage("first")}>
            เปิดครั้งแรก ยังไม่มีโครงการ
          </button>
          <button type="button" aria-pressed={stage === "working"} onClick={() => setStage("working")}>
            มีงานค้างอยู่
          </button>
        </div>

        <div className="eh__steps">
          {STEPS.map((step) => {
            const badge = stage === "first" ? step.first : step.working;
            return (
              <article key={step.id} data-here={String(HERE[stage] === step.id)}>
                <span className="eh__n">{step.id}</span>
                <h3>{step.title}</h3>
                <p>{step.note}</p>
                <span className={`eh__badge eh__badge--${badge.tone}`}>{badge.label}</span>
              </article>
            );
          })}
        </div>

        <div className="eh__board">
          <div>
            {stage === "first" ? (
              <section className="eh__card">
                <p className="eh__over">เริ่มต้น</p>
                <h2>เริ่มโครงการแรก</h2>
                <p>
                  ใส่ชื่อโครงการ ชื่อผู้ประมาณราคา และประเภทงาน แล้วเปิดไฟล์แบบ PDF เข้ามา
                  จากนั้นผู้ช่วยจะพาไปทีละขั้นจนได้ BOQ
                </p>
                <div className="eh__row">
                  <button className="eh__go" type="button">ตั้งค่าโครงการ</button>
                  <button className="eh__line" type="button">ดูตัวอย่างการทำงานก่อน</button>
                </div>
              </section>
            ) : (
              <section className="eh__card">
                <p className="eh__over">ทำงานต่อ</p>
                <h2>งานที่ค้างอยู่</h2>
                <div className="eh__resume">
                  <h3>อาคารเรียน <span className="eh__num">4</span> ชั้น โรงเรียนบ้านหนองแวง</h3>
                  <p className="eh__where">
                    ค้างที่ขั้น <span className="eh__num">2</span> จาก <span className="eh__num">4</span> · เปิดแบบและยืนยันสเกล ·
                    แก้ไขล่าสุดวันนี้ <span className="eh__num">21:13</span> น.
                  </p>
                  <p className="eh__todo">
                    หน้า <span className="eh__num">7</span> ตั้งสเกล <span className="eh__num">1:125</span> แล้ว
                    ที่เหลืออีก <span className="eh__num">31</span> หน้ายังไม่ได้ตั้ง
                  </p>
                  <div className="eh__row">
                    <button className="eh__go" type="button">เปิดหน้าแบบ ทำงานต่อ</button>
                    <button className="eh__line" type="button">ดูหน้าโครงการ</button>
                  </div>
                </div>

                <table className="eh__table">
                  <thead>
                    <tr><th>ชื่อโครงการ</th><th>ค้างที่ขั้น</th><th>แก้ไขล่าสุด</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><b>อาคารเรียน <span className="eh__num">4</span> ชั้น โรงเรียนบ้านหนองแวง</b></td>
                      <td><span className="eh__badge eh__badge--now"><span className="eh__num">2</span> · เปิดแบบและยืนยันสเกล</span></td>
                      <td>วันนี้ <span className="eh__num">21:13</span> น.</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )}
          </div>

          <aside className="eh__bot" aria-label="ผู้ช่วยประมาณราคา">
            <div className="eh__bot-head">
              <span className="eh__mark" aria-hidden="true">ผช</span>
              <div>
                <strong>ผู้ช่วยประมาณราคา</strong>
                <span>พาทำทีละขั้น ถามได้ตลอด</span>
              </div>
            </div>

            <div className="eh__thread">
              {stage === "first" ? (
                <>
                  <p className="eh__say">สวัสดีครับคุณสุริยะ ยังไม่มีโครงการในระบบเลย เริ่มใบแรกกันเลยไหมครับ</p>
                  <p className="eh__say">
                    ผมจะถามแค่สามอย่าง ชื่อโครงการ ชื่อผู้ประมาณราคา และประเภทงาน แล้วพาไปเปิดไฟล์แบบต่อเลยครับ
                  </p>
                </>
              ) : (
                <>
                  <p className="eh__say">
                    สวัสดีครับคุณสุริยะ วันนี้กลับมาที่ อาคารเรียน <span className="eh__num">4</span> ชั้น โรงเรียนบ้านหนองแวง นะครับ
                  </p>
                  <p className="eh__say">
                    ค้างที่ขั้นเปิดแบบและยืนยันสเกล หน้า <span className="eh__num">7</span> ตั้งไว้ที่ <span className="eh__num">1:125</span> แล้ว
                    หน้าอื่นยังไม่ได้ตั้ง ถ้ายังไม่ตั้ง เครื่องมือวัดบนหน้านั้นจะกดไม่ได้ครับ
                  </p>
                  <p className="eh__say eh__say--me">
                    พื้นที่ห้องน้ำที่ได้ <span className="eh__num">4.00</span> มันมาจากไหน
                  </p>
                  <p className="eh__say">
                    มาจากการไล่ขอบตามผิวผนังด้านในครับ ได้ <span className="eh__num">2.27 × 1.76 = 4.01</span> ตร.ม.
                    ส่วน <span className="eh__num">2.50 × 2.00</span> ที่แบบเขียนเป็นระยะแนวเสาถึงแนวเสา ได้ <span className="eh__num">5.00</span> ตร.ม.
                    สองเลขนี้วัดคนละที่ ใช้กับงานคนละอย่างครับ
                  </p>
                </>
              )}
            </div>

            <div className="eh__chips">
              {CHIPS[stage].map((chip) => (
                <button className="eh__chip" type="button" key={chip}>{chip}</button>
              ))}
            </div>

            <div className="eh__ask">
              <input
                type="text"
                placeholder="ช่องพิมพ์ยังไม่เปิด รอออกแบบผู้ช่วยก่อน"
                aria-label="ถามผู้ช่วย"
                disabled
              />
              <button type="button" disabled>ส่ง</button>
            </div>

            <div className="eh__scope">
              <strong>ผู้ช่วยตัวนี้ไม่ทำอะไร</strong>
              <ul>
                <li>ไม่ตัดสินตัวเลขแทนคุณ เสนอได้ แต่คนกดรับ</li>
                <li>ไม่เดาระยะที่แบบไม่ได้เขียน อ่านไม่ได้จะบอกว่าอ่านไม่ได้</li>
                <li>ไม่รับรอง BOQ หรือราคาทางวิชาชีพ</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
