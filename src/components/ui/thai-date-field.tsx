"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  formatThaiDateLong,
  formatThaiDateShort,
  monthGrid,
  parseThaiDateInput,
  shiftDays,
  shiftMonth,
  splitIso,
  THAI_MONTH_FULL,
  THAI_WEEKDAY_SHORT,
  toBuddhistYear,
  todayIsoBangkok
} from "@/lib/thai-date";

/**
 * ปฏิทินเลือกวันที่ (Date Picker) แบบไทย — IP-202
 *
 * เดือนไทยเต็ม ปี พ.ศ. ทั้งช่องพิมพ์และปฏิทิน แทน native date input ที่โชว์ ค.ศ.
 * ตามภาษาเครื่อง (เจ้าของงานสั่ง 2026-08-28 — กรอก ค.ศ. แต่อ่าน พ.ศ. ทำให้มั่วตอนทำแผนงาน)
 * ค่าที่ไหลเข้า/ออกคอมโพเนนต์ยังเป็น ISO ค.ศ. เหมือน native เดิมทุกจุด
 *
 * - พิมพ์เองได้ (วว/ดด/ปปปป พ.ศ.) parse ตอน blur/Enter — ตารางเงินมีช่องเยอะ พิมพ์เร็วกว่ากด
 * - ปฏิทินเป็น popover แบบ fixed (ช่องอยู่ในตารางที่ overflow ถ้า absolute จะโดน clip)
 *   ปิดเมื่อ scroll/resize/Escape/คลิกนอก ตามแบบ account-menu
 * - ห้าม focus trap เต็มรูป — เป็น popover ไม่ใช่ modal
 * - โหมด uncontrolled (defaultValue + name) มี input hidden ส่งค่า ISO ให้ FormData
 */

export type ThaiDateFieldProps = {
  value?: string;
  onChange?: (iso: string) => void;
  defaultValue?: string;
  name?: string;
  max?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
};

export function ThaiDateField({ value, onChange, defaultValue, name, max, ariaLabel, className, disabled, id }: ThaiDateFieldProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const iso = controlled ? value : inner;

  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange]
  );

  const [text, setText] = useState(() => (iso ? formatThaiDateShort(iso) ?? "" : ""));
  const [error, setError] = useState<string | null>(null);
  // ค่าจากข้างนอกเปลี่ยน (เช่นผู้ช่วยร่างแผน) → ช่องพิมพ์ตามไปด้วย
  const lastIsoRef = useRef(iso);
  useEffect(() => {
    if (lastIsoRef.current === iso) return;
    lastIsoRef.current = iso;
    setText(iso ? formatThaiDateShort(iso) ?? "" : "");
    setError(null);
  }, [iso]);

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number; up: boolean }>({ left: 0, top: 0, up: false });
  const today = todayIsoBangkok();
  const seed = splitIso(iso || "") ?? splitIso(today)!;
  const [view, setView] = useState({ year: seed.year, month: seed.month });

  const rootRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();

  const openCalendar = () => {
    const button = toggleRef.current;
    if (!button) return;
    const box = button.getBoundingClientRect();
    const POP_H = 372;
    const up = box.bottom + POP_H > window.innerHeight && box.top > POP_H;
    setAnchor({
      left: Math.max(10, Math.min(box.right - 300, window.innerWidth - 310)),
      top: up ? box.top - 6 : box.bottom + 6,
      up
    });
    const from = splitIso(iso || "") ?? splitIso(today)!;
    setView({ year: from.year, month: from.month });
    setCursor(iso || today);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || rootRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const overMax = useCallback((candidate: string) => Boolean(max && candidate > max), [max]);

  const applyTyped = () => {
    if (text.trim() === "") {
      commit("");
      setError(null);
      return;
    }
    const parsed = parseThaiDateInput(text);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    if (overMax(parsed.iso)) {
      setError(`เลือกได้ไม่เกิน ${formatThaiDateLong(max as string)}`);
      return;
    }
    setError(null);
    lastIsoRef.current = parsed.iso;
    setText(formatThaiDateShort(parsed.iso) ?? "");
    commit(parsed.iso);
  };

  const pick = (candidate: string) => {
    if (overMax(candidate)) return;
    setError(null);
    lastIsoRef.current = candidate;
    setText(formatThaiDateShort(candidate) ?? "");
    commit(candidate);
    setOpen(false);
    toggleRef.current?.focus();
  };

  /** roving focus ในตาราง: ลูกศรเลื่อนวัน (ใช้ shiftDays กันเขตเวลา) Enter เลือก
   *  สถานะเปลี่ยนใน event handler เท่านั้น — effect เหลือแค่งาน DOM (โฟกัส) */
  const [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !cursor) return;
    popRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${cursor}"]`)?.focus();
  }, [open, cursor, view.year, view.month]);

  const moveCursor = (next: string) => {
    setCursor(next);
    const parts = splitIso(next);
    if (parts && (parts.year !== view.year || parts.month !== view.month)) {
      setView({ year: parts.year, month: parts.month });
    }
  };

  const onGridKey = (event: React.KeyboardEvent) => {
    if (!cursor) return;
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const delta = moves[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      moveCursor(shiftDays(cursor, delta));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(cursor);
    }
  };

  const cells = monthGrid(view.year, view.month);

  return (
    <span className={className ? `thai-date ${className}` : "thai-date"} ref={rootRef}>
      {name ? <input type="hidden" name={name} value={iso ?? ""} /> : null}
      <input
        id={id ?? fieldId}
        className="thai-date__input"
        type="text"
        inputMode="numeric"
        placeholder="วว/ดด/ปปปป (พ.ศ.)"
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={applyTyped}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyTyped();
          }
        }}
      />
      <button
        type="button"
        ref={toggleRef}
        className="thai-date__toggle"
        aria-label="เปิดปฏิทิน"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openCalendar())}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {error ? <span className="thai-date__error" role="alert">{error}</span> : null}
      {open ? (
        <div
          ref={popRef}
          className="thai-date__popover"
          role="dialog"
          aria-label="ปฏิทินเลือกวันที่"
          style={{ left: anchor.left, top: anchor.up ? undefined : anchor.top, bottom: anchor.up ? window.innerHeight - anchor.top : undefined }}
        >
          <div className="thai-date__nav">
            <button type="button" aria-label="ปีก่อน" onClick={() => setView((current) => shiftMonth(current.year, current.month, -12))}>«</button>
            <button type="button" aria-label="เดือนก่อน" onClick={() => setView((current) => shiftMonth(current.year, current.month, -1))}>‹</button>
            <span className="thai-date__title" aria-live="polite">{THAI_MONTH_FULL[view.month - 1]} {toBuddhistYear(view.year)}</span>
            <button type="button" aria-label="เดือนถัดไป" onClick={() => setView((current) => shiftMonth(current.year, current.month, 1))}>›</button>
            <button type="button" aria-label="ปีถัดไป" onClick={() => setView((current) => shiftMonth(current.year, current.month, 12))}>»</button>
          </div>
          <div className="thai-date__weekdays" aria-hidden="true">
            {THAI_WEEKDAY_SHORT.map((label) => <span key={label} className="thai-date__weekday">{label}</span>)}
          </div>
          <div className="thai-date__grid" role="grid" onKeyDown={onGridKey}>
            {cells.map((cell, index) =>
              cell ? (
                <button
                  key={cell}
                  type="button"
                  data-iso={cell}
                  tabIndex={cell === (cursor ?? "") ? 0 : -1}
                  className={[
                    "thai-date__day",
                    cell === today ? "thai-date__day--today" : "",
                    cell === iso ? "thai-date__day--selected" : "",
                    index % 7 === 0 ? "thai-date__day--sunday" : "",
                    overMax(cell) ? "thai-date__day--disabled" : ""
                  ].filter(Boolean).join(" ")}
                  aria-label={formatThaiDateLong(cell) ?? cell}
                  aria-current={cell === today ? "date" : undefined}
                  aria-pressed={cell === iso}
                  disabled={overMax(cell)}
                  onClick={() => pick(cell)}
                >
                  {Number(cell.slice(8))}
                </button>
              ) : (
                <span key={`gap-${index}`} className="thai-date__day thai-date__day--outside" />
              )
            )}
          </div>
          <div className="thai-date__foot">
            <button type="button" onClick={() => pick(today)} disabled={overMax(today)}>วันนี้</button>
            <button
              type="button"
              onClick={() => {
                setText("");
                setError(null);
                commit("");
                setOpen(false);
                toggleRef.current?.focus();
              }}
            >
              ล้างค่า
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
