"use client";

import { useEffect, useRef } from "react";
import {
  HERO_DEMO_CYCLE_MS,
  HERO_DEMO_TIMES,
  heroDemoBeatAt,
  heroDemoPhaseClasses
} from "@/lib/hero-demo-script";

/**
 * IP-197: หน้าต่างสาธิตสดใน hero — ฉากผู้ช่วยสร้างแผนงานวนสี่จังหวะ
 *
 * คอมโพเนนต์นี้ถือนาฬิกา (requestAnimationFrame เดียว) แล้วถาม src/lib/hero-demo-script.ts
 * ว่าอยู่จังหวะไหน งานเคลื่อนไหวจริงเป็น CSS transition ใน globals.css ทั้งหมด
 *
 * - SSR มาเป็นเฟรมสุดท้าย (is-static + จังหวะ 1+3+4) — บอทและผู้ปิดการเคลื่อนไหวเห็นฉากจบ
 *   ที่เล่าข้อความหลักครบ ไม่ใช่กล่องเปล่า แบบเดียวกับ doc-compare
 * - ลูปหยุดจริง (ยกเลิก rAF) เมื่อกรอบพ้นจอหรือสลับแท็บ แล้วเล่นต่อจากจุดเดิม
 * - ทั้งกรอบ aria-hidden: ปุ่มในฉากเป็นภาพประกอบ (div) กดไม่ได้ โปรแกรมอ่านหน้าจอได้
 *   ข้อความสรุปจาก .hero-demo__sr แทน — เทสต์ src/hero-demo-fence.test.ts คุมทั้งสองข้อ
 */

/** บทของฉาก — ข้อความและตัวเลขทั้งหมดแก้ที่ก้อนเดียวนี้โดยไม่ต้องแตะจังหวะเวลา
 *  ที่มา: docs/research/s-curve-rules-2026-08-25.md (กฎที่ 1–2, หน้า 92–94 ของหลักสูตร วสท.)
 *  ผิวทาง 52% ÷ 4 ช่องเวลา = 13%/ช่อง · รายช่องที่ 3: ผิด 8+7+52 = 67 → ถูก 8+7+13 = 28 */
const SCRIPT = {
  title: "แผนงาน-ถนนตัวอย่าง.plan — ผู้ช่วยสร้างแผนงาน",
  tag: "ภาพสาธิต",
  tasksTitle: "รายการงาน",
  tasks: [
    { name: "งานดินถมคันทาง", meta: "45 วัน · น้ำหนัก 24%", width: "41%" },
    { name: "ท่อระบายน้ำ คสล.", meta: "30 วัน · น้ำหนัก 14%", width: "24%" },
    { name: "ผิวทางแอสฟัลต์คอนกรีต", meta: "60 วัน · น้ำหนัก 52%", width: "88%" },
    { name: "เครื่องหมายจราจร", meta: "15 วัน · น้ำหนัก 10%", width: "17%" }
  ],
  assistTag: "ผู้ช่วย AI · เสนอ — คุณตัดสิน",
  assistBody: (
    <>
      งานผิวทางแอสฟัลต์ฯ กินเวลา <b>4 ช่องเวลา</b> แต่แผนนี้ลงน้ำหนักทั้ง <b>52%</b> ไว้ช่องเดียว
      เส้นสะสมจึงกระโดดไป 90% แล้วนิ่งสองช่อง — กฎการกระจายน้ำหนักให้เกลี่ยเท่ากันทุกช่อง คือช่องละ <b>13%</b>
    </>
  ),
  actOk: "ปรับตามข้อเสนอ",
  actNo: "ปฏิเสธ",
  assistSource: "ขอดูที่มา — การบริหารโครงการด้วย S-Curve (หลักสูตร วสท.)",
  question: "13% ต่อช่องเวลา มาจากไหน",
  answer: (
    <>
      52% ÷ 4 ช่องเวลา = <b>13%</b> ตามกฎการกระจายน้ำหนัก ส่วน 52% คือค่างานผิวทาง ÷ ค่างานรวม
      เวลาไม่มีผลต่อน้ำหนัก — <b>ระบบคำนวณเอง</b> ผู้ช่วยเพียงชี้ว่ากระจายไม่ตรงกฎ
    </>
  ),
  cite: "อ้างอิง · การบริหารโครงการด้วย S-Curve (หลักสูตร วสท.) หน้า 92–94",
  note: "ระบบคำนวณเอง — AI ไม่แตะเงิน",
  stamp: "ตรวจย้อนได้",
  caption: "ตัวเลขในหน้าต่างสาธิตเป็นตัวอย่างประกอบเพื่อสาธิตวิธีทำงานของผู้ช่วย",
  screenReaderSummary:
    "ฉากสาธิตวิธีทำงานของผู้ช่วยสร้างแผนงาน: ผู้ช่วย AI พบว่าแผนลงน้ำหนักงานผิวทาง 52% " +
    "ไว้ช่องเวลาเดียวทั้งที่งานกินเวลา 4 ช่องเวลา จึงเสนอเกลี่ยเป็นช่องละ 13% " +
    "ตามหลักสูตรการบริหารโครงการด้วย S-Curve ของ วสท. ผู้ใช้เป็นคนกดรับ " +
    "แล้วระบบคำนวณเส้นความก้าวหน้าสะสมใหม่เอง ตัวเลขทั้งหมดเป็นตัวอย่างประกอบ"
} as const;

/** พิกัดกราฟ (viewBox 360×210): x ช่องเวลา 1–6 = 86..344 · y = 172 − (%สะสม × 1.52)
 *  เส้นสะสมผิด 8·23·90·90·90·100 เป็นขั้นบันได · เส้นถูก 8·23·51·64·77·100 เป็นตัว S
 *  เส้นตรงต่อจุดตามเอกสาร — รูปโค้งต้องเกิดจากข้อมูล ไม่ใช่สูตรตกแต่ง */
const CURVE_WRONG = "M34 172 L86 160 L137 137 L189 35 L241 35 L292 35 L344 20";
const CURVE_RIGHT = "M34 172 L86 160 L137 137 L189 94 L241 75 L292 55 L344 20";
const PINS_WRONG = [
  { cx: 86, cy: 160 },
  { cx: 137, cy: 137 },
  { cx: 189, cy: 35 },
  { cx: 344, cy: 20 }
];
const PINS_RIGHT = [
  { cx: 189, cy: 94 },
  { cx: 241, cy: 75 },
  { cx: 292, cy: 55 },
  { cx: 344, cy: 20 }
];

export function HeroLiveDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const okRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // ผู้ปิดการเคลื่อนไหวคงอยู่กับเฟรมสุดท้ายจาก SSR — ไม่ตั้งนาฬิกา ไม่ตั้งผู้สังเกตใดเลย
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let rafId = 0;
    let cycleStart = 0;
    let pausedElapsed = 0;
    let running = false;
    let started = false;
    let inView = false;
    let pageVisible = !document.hidden;
    let lastClasses = "";
    let cursorPlaced = false;

    const placeCursorOnAccept = () => {
      const ok = okRef.current;
      const cursor = cursorRef.current;
      const ring = ringRef.current;
      if (!ok || !cursor || !ring) return;
      // วัดสดทุกรอบ — ตำแหน่งปุ่มเปลี่ยนตามความกว้างจอ
      const frame = root.getBoundingClientRect();
      const box = ok.getBoundingClientRect();
      const x = box.left - frame.left + box.width * 0.55;
      const y = box.top - frame.top + box.height * 0.6;
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
      ring.style.left = `${x - 17}px`;
      ring.style.top = `${y - 17}px`;
    };

    const applyBeat = (elapsedInCycle: number) => {
      const beat = heroDemoBeatAt(elapsedInCycle);
      const classes = ["hero-demo", ...heroDemoPhaseClasses(beat)].join(" ");
      if (classes !== lastClasses) {
        root.className = classes;
        lastClasses = classes;
      }
      if (badgeRef.current) badgeRef.current.textContent = String(beat.badgePercent);
      if (beat.phase === 2) {
        if (!cursorPlaced && elapsedInCycle >= HERO_DEMO_TIMES.cursorToButton) {
          placeCursorOnAccept();
          cursorPlaced = true;
        }
      } else {
        cursorPlaced = false;
      }
    };

    /** ตัด transition ชั่วขณะแล้วล้างสถานะ เพื่อให้รอบใหม่เริ่มจากศูนย์โดยไม่เล่นย้อน */
    const resetRound = () => {
      root.className = "hero-demo no-anim";
      lastClasses = "";
      const cursor = cursorRef.current;
      if (cursor) {
        cursor.style.left = "";
        cursor.style.top = "";
      }
      root.getBoundingClientRect(); // บังคับ reflow ให้ no-anim มีผลก่อนถอด
      root.classList.remove("no-anim");
    };

    const tick = (now: number) => {
      const total = now - cycleStart;
      if (total >= HERO_DEMO_CYCLE_MS) {
        resetRound();
        cycleStart = now;
        applyBeat(0);
      } else {
        applyBeat(total);
      }
      rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      pausedElapsed = performance.now() - cycleStart;
      cancelAnimationFrame(rafId);
    };

    const play = () => {
      if (running || !inView || !pageVisible) return;
      if (!started) {
        // ถอดเฟรมสุดท้ายของ SSR ใต้ no-anim แล้วเริ่มรอบแรก
        started = true;
        resetRound();
      }
      running = true;
      cycleStart = performance.now() - pausedElapsed;
      rafId = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false;
        if (inView) play();
        else stop();
      },
      { threshold: 0.2 }
    );
    observer.observe(root);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) play();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <p className="hero-demo__sr">{SCRIPT.screenReaderSummary}</p>
      <div ref={rootRef} className="hero-demo is-static is-phase1 is-phase3 is-phase4" aria-hidden="true">
        <div className="hero-demo__bar">
          <span className="hero-demo__dots"><i /><i /><i /></span>
          <span className="hero-demo__title">{SCRIPT.title}</span>
          <span className="hero-demo__tag">{SCRIPT.tag}</span>
        </div>

        <div className="hero-demo__body">
          <div className="hero-demo__tasks">
            <h3 className="hero-demo__tasks-title">{SCRIPT.tasksTitle}</h3>
            {SCRIPT.tasks.map((task) => (
              <div className="hero-demo__task" key={task.name} style={{ "--w": task.width } as React.CSSProperties}>
                <b>{task.name}</b>
                <small>{task.meta}</small>
                <span className="hero-demo__task-bar"><i /></span>
              </div>
            ))}
          </div>

          <div className="hero-demo__chart">
            <svg viewBox="0 0 360 210">
              <g className="hero-demo__grid">
                <line x1="34" y1="20" x2="34" y2="172" />
                <line x1="34" y1="172" x2="344" y2="172" />
                <line x1="34" y1="96" x2="344" y2="96" strokeDasharray="3 4" />
                <line x1="34" y1="20" x2="344" y2="20" strokeDasharray="3 4" />
              </g>
              <g className="hero-demo__axis">
                <text x="6" y="176">0%</text>
                <text x="4" y="100">50%</text>
                <text x="2" y="25">100%</text>
                {[86, 137, 189, 241, 292, 344].map((x, index) => (
                  <text key={x} x={x - 2} y="188">{index + 1}</text>
                ))}
                <text x="160" y="203">ช่องเวลาที่</text>
              </g>
              <path className="hero-demo__curve hero-demo__curve--wrong" pathLength={1} d={CURVE_WRONG} />
              <path className="hero-demo__curve hero-demo__curve--right" pathLength={1} d={CURVE_RIGHT} />
              {PINS_WRONG.map((pin) => (
                <circle className="hero-demo__pin hero-demo__pin--wrong" key={`w${pin.cx}`} cx={pin.cx} cy={pin.cy} r="3.4" />
              ))}
              {PINS_RIGHT.map((pin) => (
                <circle className="hero-demo__pin hero-demo__pin--right" key={`r${pin.cx}`} cx={pin.cx} cy={pin.cy} r="3.4" />
              ))}
            </svg>
            <div className="hero-demo__badge">ช่องเวลาที่ 3 · <span ref={badgeRef}>28</span>%<span className="hero-demo__badge-tail"> ของงานรายช่อง</span></div>
          </div>
        </div>

        <div className="hero-demo__assist">
          <span className="hero-demo__assist-tag"><i />{SCRIPT.assistTag}</span>
          <p>{SCRIPT.assistBody}</p>
          <div className="hero-demo__assist-acts">
            <div className="hero-demo__act hero-demo__act--ok" ref={okRef}>{SCRIPT.actOk}</div>
            <div className="hero-demo__act hero-demo__act--no">{SCRIPT.actNo}</div>
          </div>
          <div className="hero-demo__assist-src">{SCRIPT.assistSource}</div>
        </div>

        <div className="hero-demo__qa">
          <div className="hero-demo__qa-q">{SCRIPT.question}</div>
          <div className="hero-demo__qa-a">
            <p>{SCRIPT.answer}</p>
            <span className="hero-demo__qa-cite">{SCRIPT.cite}</span>
            <div className="hero-demo__qa-row">
              <span className="hero-demo__qa-note">{SCRIPT.note}</span>
              <span className="hero-demo__stamp">{SCRIPT.stamp}</span>
            </div>
          </div>
        </div>

        <svg ref={cursorRef} className="hero-demo__cursor" viewBox="0 0 24 24">
          <path d="M5 3l14 9-6.5 1.5L16 20l-3 1.4-3.4-6.6L5 19z" />
        </svg>
        <span ref={ringRef} className="hero-demo__ring" />

        <div className="hero-demo__caption">{SCRIPT.caption}</div>
      </div>
    </>
  );
}
