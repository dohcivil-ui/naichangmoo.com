"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * IP-192: the before/after comparison, upgraded per the approved motion spec into a short piece
 * of theatre — "inspect, sweep, stamp". On first scroll into view the block reads the old file
 * (red flags walk down the rows), the teal line sweeps the mess away, and every repaired row is
 * stamped with its source as the sweep passes; the concrete quantity counts into place. Then the
 * handle pulses once and the control is handed to the visitor.
 *
 * Design rules the spec pins down:
 * - One rAF clock drives the whole timeline; interrupting = cancel it and set data-state="done",
 *   which CSS resolves to the finished document instantly. The visitor never fights the machine.
 * - The stamps hide only under data-state idle/playing, so SSR, no-JS and reduced-motion all see
 *   the complete document — the version the owner already approved.
 * - Content is an illustration and labelled as one on the page; it claims nothing (ADR 0015).
 */

const FLAG_TIMES = [100, 260, 420, 580, 740];
/** Rows own their strikes: [คอนกรีต], [เผื่อวัสดุ ×2], [ค่าแรง ×2], [Factor F ×2], [สรุป]. */
const FLAG_GROUPS = [[0], [1, 2], [3, 4], [5, 6], [7]];
const SWEEP_START = 1000;
const SWEEP_MS = 1700;
const SWEEP_FROM = 94;
const SWEEP_TO = 30;
const STAMP_AT = [0.22, 0.42, 0.6, 0.78, 0.96];
const NUDGE_AT = 2800;
const HINT_AT = 3000;
const DONE_AT = 3400;
const COUNT_MS = 400;

const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOutQuad = (p: number) => 1 - (1 - p) * (1 - p);

export function DocCompare() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const rafRef = useRef(0);
  const played = useRef(false);
  const finish = useRef<() => void>(() => {});
  const playRef = useRef<() => void>(() => {});

  const setPos = useCallback((percent: number, updateAria = true) => {
    const root = rootRef.current;
    if (!root) return;
    const clamped = Math.max(6, Math.min(94, percent));
    root.style.setProperty("--pos", `${clamped}%`);
    if (updateAria) {
      root.querySelector(".doc-compare__handle")?.setAttribute("aria-valuenow", String(Math.round(clamped)));
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fix = root.querySelector<HTMLElement>(".doc-compare__fix");
    const rows = Array.from(root.querySelectorAll<HTMLElement>(".doc-compare__row"));
    const strikes = Array.from(root.querySelectorAll<HTMLElement>(".doc-compare__pane--before s"));
    const handle = root.querySelector<HTMLElement>(".doc-compare__handle");
    const hint = root.querySelector<HTMLElement>(".doc-compare__hint");
    const before = root.querySelector<HTMLElement>(".doc-compare__before");
    const fixTarget = fix?.dataset.target ?? "12.500";

    const settle = (clearHint = false) => {
      cancelAnimationFrame(rafRef.current);
      root.dataset.state = "done";
      root.classList.add("is-finished");
      if (fix) fix.textContent = fixTarget;
      // A natural finish leaves the hint to its own 4s timeout; a person taking over clears it.
      if (clearHint) hint?.classList.remove("is-on");
      if (before) before.style.willChange = "";
    };
    finish.current = () => settle(true);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      // The finished document, immediately — the exact layout the owner approved before motion.
      root.dataset.state = "done";
      played.current = true;
      return;
    }

    // The block sits below the fold, so this switch is never seen happening.
    root.dataset.state = "idle";
    setPos(SWEEP_FROM, false);

    const play = () => {
      if (played.current) return;
      played.current = true;
      root.dataset.state = "playing";
      if (fix) fix.textContent = "00.000";
      if (before) before.style.willChange = "clip-path";
      const flagged = new Set<number>();
      const stamped = new Set<number>();
      let nudged = false;
      let hinted = false;
      let countStart = 0;
      const t0 = performance.now();

      const tick = (now: number) => {
        const t = now - t0;

        for (let i = 0; i < FLAG_TIMES.length; i++) {
          if (t >= FLAG_TIMES[i] && !flagged.has(i)) {
            flagged.add(i);
            for (const s of FLAG_GROUPS[i]) strikes[s]?.classList.add("is-flagged");
          }
        }

        if (t >= SWEEP_START) {
          const p = Math.min(1, (t - SWEEP_START) / SWEEP_MS);
          setPos(SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * easeInOutCubic(p), false);
          for (let i = 0; i < STAMP_AT.length; i++) {
            if (p >= STAMP_AT[i] && !stamped.has(i)) {
              stamped.add(i);
              rows[i]?.classList.add("is-stamped");
              if (i === 0) countStart = now;
            }
          }
          if (p >= 1) {
            root.querySelector(".doc-compare__handle")?.setAttribute("aria-valuenow", String(SWEEP_TO));
          }
        }

        if (fix && countStart) {
          const cp = Math.min(1, (now - countStart) / COUNT_MS);
          fix.textContent = (Number(fixTarget) * easeOutQuad(cp)).toFixed(3).padStart(6, "0");
          if (cp >= 1) countStart = 0;
        }

        if (t >= NUDGE_AT && !nudged) {
          nudged = true;
          handle?.classList.add("is-nudge");
        }
        if (t >= HINT_AT && !hinted) {
          hinted = true;
          hint?.classList.add("is-on");
          root.classList.add("is-finished");
          window.setTimeout(() => hint?.classList.remove("is-on"), 4000);
        }
        if (t >= DONE_AT) {
          settle();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    playRef.current = play;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            play();
          }
        }
      },
      { threshold: 0.55 }
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [setPos]);

  const posFromEvent = useCallback((event: React.PointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return 50;
    return ((event.clientX - rect.left) / rect.width) * 100;
  }, []);

  /** A person taking over ends the show instantly — never fight the visitor for the handle. */
  const interrupt = useCallback(() => {
    const root = rootRef.current;
    if (root && root.dataset.state !== "done") finish.current();
  }, []);

  const replay = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    cancelAnimationFrame(rafRef.current);
    root.classList.add("no-anim");
    root.classList.remove("is-finished");
    for (const el of root.querySelectorAll(".is-stamped, .is-flagged, .is-nudge")) {
      el.classList.remove("is-stamped", "is-flagged", "is-nudge");
    }
    root.dataset.state = "idle";
    setPos(SWEEP_FROM, false);
    void root.offsetWidth; // force reflow so the reset lands before animations resume
    root.classList.remove("no-anim");
    played.current = false;
    playRef.current();
  }, [setPos]);

  return (
    <div
      className="doc-compare"
      ref={rootRef}
      data-state="done"
      style={{ "--pos": "56%" } as React.CSSProperties}
      onPointerDown={(event) => {
        interrupt();
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setPos(posFromEvent(event));
      }}
      onPointerMove={(event) => {
        if (dragging.current) setPos(posFromEvent(event));
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <div className="doc-compare__pane doc-compare__pane--after">
        <pre className="doc-compare__doc">
          <b>BOQ — งานคอนกรีตฐานราก F1</b>
          {"\n"}รายการ      ปริมาณ   ที่มา
          {"\n"}<span className="doc-compare__row">คอนกรีต     <span className="doc-compare__fix" data-target="12.500">12.500</span>   <i className="doc-compare__stamp">2.50×2.50×2.00 ×1 จากแบบ S-02</i></span>
          {"\n"}<span className="doc-compare__row">เผื่อวัสดุ    3%      <i className="doc-compare__stamp">หลักเกณฑ์เผื่อฯ ข้อ 4.1</i></span>
          {"\n"}<span className="doc-compare__row">ค่าแรง      459 อัตรา <i className="doc-compare__stamp">ว 809 ลว. 14 พ.ย. 68</i></span>
          {"\n"}<span className="doc-compare__row">Factor F    1.2731   <i className="doc-compare__stamp">อ้างหนังสือ แถวพิมพ์</i></span>
          {"\n"}
          {"\n"}<b className="doc-compare__row"><span className="doc-compare__stamp doc-compare__stamp--seal">ทุกบรรทัดชี้เอกสารต้นทางได้</span></b>
        </pre>
      </div>
      <div className="doc-compare__before">
        <div className="doc-compare__pane doc-compare__pane--before">
          <pre className="doc-compare__doc">
            <b>ประมาณการ (ไฟล์เดิม v7_final2)</b>
            {"\n"}รายการ      ปริมาณ   ที่มา
            {"\n"}คอนกรีต     <s>1.25</s>     -
            {"\n"}เผื่อวัสดุ    <s>7%</s>      <s>ใครใส่ไว้ไม่รู้</s>
            {"\n"}ค่าแรง      <s>ว 480</s>    <s>ฉบับที่ถูกยกเลิกแล้ว</s>
            {"\n"}Factor F    <s>1.305</s>   <s>ก๊อปจากไฟล์เก่า</s>
            {"\n"}
            {"\n"}<s>ถูกซักเมื่อไหร่ ยืนไม่ได้</s>
          </pre>
        </div>
      </div>
      <span className="doc-compare__label doc-compare__label--l">ก่อน — ไฟล์เดิม</span>
      <span className="doc-compare__label doc-compare__label--r">หลัง — นายช่างหมู</span>
      <div className="doc-compare__line" aria-hidden="true" />
      <div
        className="doc-compare__handle"
        tabIndex={0}
        role="slider"
        aria-label="เทียบเอกสารก่อนและหลัง ลากหรือใช้ปุ่มลูกศร"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={56}
        onKeyDown={(event) => {
          interrupt();
          const current = parseFloat(rootRef.current?.style.getPropertyValue("--pos") ?? "56");
          if (event.key === "ArrowLeft") {
            setPos(current - 4);
            event.preventDefault();
          }
          if (event.key === "ArrowRight") {
            setPos(current + 4);
            event.preventDefault();
          }
        }}
      />
      <span className="doc-compare__hint" aria-hidden="true">ลากเทียบเองได้</span>
      <button type="button" className="doc-compare__replay" onClick={replay}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
        ดูอีกครั้ง
      </button>
    </div>
  );
}
