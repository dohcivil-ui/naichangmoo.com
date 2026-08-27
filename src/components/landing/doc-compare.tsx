"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * IP-192 v2 (Fable spec, 2026-08-27): one application window on a dark desktop stage.
 *
 * The owner's own idea set the frame — a real program window with the three traffic lights —
 * and the show became a rename performed in front of the visitor: the file everyone actually
 * owns ("ประมาณการ_v7_final2.xlsx") gets inspected (a red badge counts the faults, the window
 * jolts), a glowing scan line sweeps the mess away stamping sources as it passes, and at the
 * seal the title bar crossfades to "BOQ_F1_นายช่างหมู.xlsx" with a green badge. The lights are
 * generic window chrome — no Apple marks, no system UI.
 *
 * Mechanics carried over from v1 unchanged: one rAF clock, the proven timeline (flags 100-740ms,
 * sweep 1000-2700ms easeInOutCubic 94->30, stamps at fixed sweep progress), interrupt-anywhere,
 * replay under a no-anim reset, and the SSR/no-JS/reduced-motion default being the finished
 * document. Content is an illustration, labelled on the page; it claims nothing (ADR 0015).
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
const BADGE_CLEAR = "ตรวจแล้ว 5 รายการ";

const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOutQuad = (p: number) => 1 - (1 - p) * (1 - p);

export function DocCompare() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  /** Cached at pointerdown so the drag geometry survives the window tilt transform. */
  const dragRect = useRef<DOMRect | null>(null);
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
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!stage || !root) return;
    const win = stage.querySelector<HTMLElement>(".doc-window");
    const badge = stage.querySelector<HTMLElement>(".doc-window__badge");
    const fix = root.querySelector<HTMLElement>(".doc-compare__fix");
    const rows = Array.from(root.querySelectorAll<HTMLElement>(".doc-compare__row"));
    const strikes = Array.from(root.querySelectorAll<HTMLElement>(".doc-compare__pane--before s"));
    const handle = root.querySelector<HTMLElement>(".doc-compare__handle");
    const hint = root.querySelector<HTMLElement>(".doc-compare__hint");
    const before = root.querySelector<HTMLElement>(".doc-compare__before");
    const fixTarget = fix?.dataset.target ?? "12.500";

    const settle = (clearHint = false) => {
      cancelAnimationFrame(rafRef.current);
      stage.dataset.state = "done";
      stage.classList.add("is-finished");
      win?.classList.add("is-sealed");
      if (badge) {
        badge.classList.add("is-clear");
        badge.textContent = BADGE_CLEAR;
      }
      if (fix) fix.textContent = fixTarget;
      // A natural finish leaves the hint to its own 4s timeout; a person taking over clears it.
      if (clearHint) hint?.classList.remove("is-on");
      if (before) before.style.willChange = "";
    };
    finish.current = () => settle(true);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      // The finished window, immediately — new filename, green badge, every stamp shown.
      settle();
      played.current = true;
      return;
    }

    // The block sits below the fold, so this switch is never seen happening.
    stage.dataset.state = "idle";
    setPos(SWEEP_FROM, false);

    const tickBadge = (text: string) => {
      if (!badge) return;
      badge.textContent = text;
      badge.classList.remove("is-tick");
      void badge.offsetWidth; // restart the pop animation
      badge.classList.add("is-tick");
    };
    const jolt = (cls: string, ms: number) => {
      if (!win) return;
      win.classList.add(cls);
      window.setTimeout(() => win.classList.remove(cls), ms);
    };

    const play = () => {
      if (played.current) return;
      played.current = true;
      stage.dataset.state = "playing";
      if (badge) {
        badge.classList.remove("is-clear");
        badge.textContent = "0 จุดพลาด";
      }
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
            tickBadge(`${i + 1} จุดพลาด`);
            // One light jolt when the first fault lands, one big one on the fifth — five shakes
            // in six hundred milliseconds would read as a bug, not drama.
            if (i === 0) jolt("is-jolt", 160);
            if (i === 4) jolt("is-jolt-big", 220);
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
              if (i < 4) tickBadge(`เหลือ ${4 - i} จุด`);
              if (i === 4) {
                // The seal beat: the file is renamed in front of the visitor.
                win?.classList.add("is-sealed");
                jolt("is-thunk", 200);
                if (badge) {
                  badge.classList.add("is-clear");
                  badge.textContent = BADGE_CLEAR;
                }
              }
            }
          }
          if (p >= 1) {
            handle?.setAttribute("aria-valuenow", String(SWEEP_TO));
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
          stage.classList.add("is-finished");
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
    observer.observe(stage);

    // The window leans toward the pointer once the show is over — same trick as .app-card,
    // capped at 2.5deg, and only on devices that actually hover.
    const canTilt = window.matchMedia("(hover: hover)").matches;
    const onTilt = (event: PointerEvent) => {
      if (!win || !canTilt || stage.dataset.state !== "done") return;
      const rect = win.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      win.style.setProperty("--tilt-x", `${(-y * 2.5).toFixed(2)}deg`);
      win.style.setProperty("--tilt-y", `${(x * 2.5).toFixed(2)}deg`);
    };
    const offTilt = () => {
      win?.style.setProperty("--tilt-x", "0deg");
      win?.style.setProperty("--tilt-y", "0deg");
    };
    stage.addEventListener("pointermove", onTilt);
    stage.addEventListener("pointerleave", offTilt);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      stage.removeEventListener("pointermove", onTilt);
      stage.removeEventListener("pointerleave", offTilt);
    };
  }, [setPos]);

  const posFromClientX = useCallback((clientX: number) => {
    const rect = dragRect.current ?? rootRef.current?.getBoundingClientRect();
    if (!rect) return 50;
    return ((clientX - rect.left) / rect.width) * 100;
  }, []);

  /** A person taking over ends the show instantly — never fight the visitor for the handle. */
  const interrupt = useCallback(() => {
    const stage = stageRef.current;
    if (stage && stage.dataset.state !== "done") finish.current();
  }, []);

  const replay = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    cancelAnimationFrame(rafRef.current);
    stage.classList.add("no-anim");
    stage.classList.remove("is-finished");
    stage.querySelector(".doc-window")?.classList.remove("is-sealed", "is-jolt", "is-jolt-big", "is-thunk");
    for (const el of stage.querySelectorAll(".is-stamped, .is-flagged, .is-nudge")) {
      el.classList.remove("is-stamped", "is-flagged", "is-nudge");
    }
    const badge = stage.querySelector<HTMLElement>(".doc-window__badge");
    badge?.classList.remove("is-clear", "is-tick");
    stage.dataset.state = "idle";
    setPos(SWEEP_FROM, false);
    void stage.offsetWidth; // force reflow so the reset lands before animations resume
    stage.classList.remove("no-anim");
    played.current = false;
    playRef.current();
  }, [setPos]);

  /**
   * The red and yellow lights cannot close work that has to stay auditable — the window just
   * shakes its head. A tiny joke that lands with anyone who ever tried to close v7_final2.
   */
  const refuse = useCallback(() => {
    const win = stageRef.current?.querySelector<HTMLElement>(".doc-window");
    if (!win || win.classList.contains("is-jolt")) return;
    win.classList.add("is-jolt");
    window.setTimeout(() => win.classList.remove("is-jolt"), 180);
  }, []);

  const endDrag = useCallback(() => {
    dragging.current = false;
    dragRect.current = null;
    stageRef.current?.querySelector(".doc-window")?.classList.remove("is-scrubbing");
  }, []);

  return (
    <div className="doc-stage" ref={stageRef} data-state="done">
      <div className="doc-stage__wall" aria-hidden="true" />
      <div className="doc-window" style={{ "--tilt-x": "0deg", "--tilt-y": "0deg" } as React.CSSProperties}>
        <div className="doc-window__bar">
          <span className="doc-window__lights" onClick={refuse} aria-hidden="true">
            <i className="doc-window__light doc-window__light--red" />
            <i className="doc-window__light doc-window__light--yellow" />
          </span>
          <button
            type="button"
            className="doc-window__light doc-window__light--green"
            aria-label="เล่นซ้ำ"
            onClick={replay}
          />
          <span className="doc-window__title">
            <span className="doc-window__name doc-window__name--old">ประมาณการ_v7_final2.xlsx</span>
            <span className="doc-window__name doc-window__name--new">BOQ_F1_นายช่างหมู.xlsx</span>
          </span>
          <span className="doc-window__badge is-clear" aria-hidden="true">{BADGE_CLEAR}</span>
        </div>
        <div
          className="doc-compare"
          ref={rootRef}
          style={{ "--pos": "56%" } as React.CSSProperties}
          onPointerDown={(event) => {
            interrupt();
            dragging.current = true;
            stageRef.current?.querySelector(".doc-window")?.classList.add("is-scrubbing");
            dragRect.current = event.currentTarget.getBoundingClientRect();
            event.currentTarget.setPointerCapture(event.pointerId);
            setPos(posFromClientX(event.clientX));
          }}
          onPointerMove={(event) => {
            if (dragging.current) setPos(posFromClientX(event.clientX));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
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
              {"\n"}<b className="doc-compare__row"><span className="doc-compare__stamp doc-compare__stamp--seal">ตรวจย้อนได้</span></b>
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
          <div className="doc-compare__line" aria-hidden="true"><i className="doc-compare__beam-trail" /></div>
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
      </div>
    </div>
  );
}
