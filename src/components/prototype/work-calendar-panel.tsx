"use client";

import { useMemo, useState } from "react";
import { formatThaiDate } from "@/lib/thai-format";
import { DURATION_UNIT_LABELS, type DurationUnit, type ProjectDemand } from "@/lib/work-plan-schedule";
import { buddhistYearOf, provisionalYears, yearsWithoutData, type ThaiHoliday } from "@/lib/thai-holidays";
import { ThaiDateField } from "@/components/ui/thai-date-field";
import {
  calendarHolidays,
  nonWorkingDaysBetween,
  RAIN_ALLOWANCE_CHOICES,
  shiftDays,
  weekdayOf,
  workingDaysBetween,
  type WorkCalendar
} from "@/lib/work-calendar";

/**
 * ปฏิทินวันทำงานของโครงการ
 *
 * มีอยู่เพราะระบบที่ผู้รับเหมาไทยใช้จริงข้ามวันหยุดให้เงียบ ๆ โดยไม่มีที่ไหนให้ดูหรือแก้
 * รายการวันหยุดเลย ผู้ใช้จึงตรวจไม่ได้ว่าวันที่หายไปจากแผนหายเพราะวันอะไร และแก้ไม่ได้
 * เมื่อหน่วยงานสั่งหยุดเพิ่มหรือโครงการนี้ไม่ได้หยุดตามวันหยุดราชการทุกวัน
 *
 * หน้าจอนี้จึงตอบสามคำถามที่ของเขาตอบไม่ได้: **หายไปกี่วัน · หายวันไหน · หายเพราะวันอะไร**
 * และเปิดให้แก้ทุกวันที่แสดงอยู่
 */
const WEEKDAY_NAMES = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];

export function WorkCalendarPanel({
  calendar,
  onCalendar,
  rainPercent,
  onRainPercent,
  startDate,
  durationDays,
  durationUnit,
  onDurationUnit,
  demand,
  endUnderOtherUnit
}: {
  calendar: WorkCalendar;
  onCalendar: (next: WorkCalendar) => void;
  rainPercent: number;
  onRainPercent: (next: number) => void;
  startDate: string;
  /** ระยะเวลาตามสัญญาเป็นวันปฏิทิน ใช้กำหนดช่วงที่ต้องตรวจ */
  durationDays: number;
  durationUnit: DurationUnit;
  onDurationUnit: (next: DurationUnit) => void;
  demand: ProjectDemand;
  /** วันที่แผนจะจบถ้าอ่านเลขชุดเดิมด้วยอีกหน่วย ว่างแปลว่ายังไม่มีกิจกรรมให้เทียบ */
  endUnderOtherUnit: string;
}) {
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  /**
   * หน่วยที่ผู้ใช้เลือกแต่ยังไม่ได้ยืนยัน
   *
   * การสลับหน่วยไม่แตะตัวเลขที่ผู้ใช้พิมพ์ แต่เปลี่ยนวันที่แผนจบ ซึ่งเป็นผลที่ต้องเห็นก่อนตัดสิน
   * ไม่ใช่หลังจากนั้น แผนที่ยังไม่มีกิจกรรมไม่มีอะไรให้เทียบ จึงเปลี่ยนได้ทันที
   */
  const [pendingUnit, setPendingUnit] = useState<DurationUnit | null>(null);

  const chooseUnit = (next: DurationUnit) => {
    if (next === durationUnit) return;
    if (endUnderOtherUnit === "" || demand.planEndDate === "") {
      onDurationUnit(next);
      return;
    }
    setPendingUnit(next);
  };

  const ready = startDate !== "" && durationDays > 0;
  const endDate = ready ? shiftDays(startDate, durationDays - 1) : "";

  const view = useMemo(() => {
    if (!ready) return null;
    const lost = nonWorkingDaysBetween(calendar, startDate, endDate);
    const working = workingDaysBetween(calendar, startDate, endDate);
    return {
      lost,
      working,
      weekendCount: lost.filter((entry) => entry.reason.kind === "weekend").length,
      holidays: lost.filter((entry) => entry.reason.kind === "holiday"),
      missingYears: yearsWithoutData(startDate, endDate),
      provisional: provisionalYears(startDate, endDate)
    };
  }, [calendar, startDate, endDate, ready]);

  /** วันหยุดของโครงการที่ตกอยู่ในช่วงสัญญา เรียงตามวันที่ */
  const inRange = useMemo(
    () => (ready ? calendarHolidays(calendar).filter((holiday) => holiday.date >= startDate && holiday.date <= endDate) : []),
    [calendar, startDate, endDate, ready]
  );

  const removedInRange = useMemo(
    () => calendar.removed.filter((date) => ready && date >= startDate && date <= endDate),
    [calendar.removed, startDate, endDate, ready]
  );

  const remove = (date: string) =>
    onCalendar({ ...calendar, removed: [...new Set([...calendar.removed, date])] });

  const restore = (date: string) =>
    onCalendar({ ...calendar, removed: calendar.removed.filter((one) => one !== date) });

  const addHoliday = () => {
    const date = newDate.trim();
    const name = newName.trim();
    if (date === "" || name === "") return;
    onCalendar({
      ...calendar,
      // เพิ่มวันที่เคยถูกเอาออก ต้องเอาออกจากรายการที่ถูกตัดด้วย ไม่งั้นเพิ่มแล้วไม่ขึ้น
      removed: calendar.removed.filter((one) => one !== date),
      added: [...calendar.added.filter((one) => one.date !== date), { date, name }]
    });
    setNewDate("");
    setNewName("");
  };

  const status = ready ? (
    <span className="status-chip status-chip--ready">
      ทำงานได้ {view!.working.toLocaleString("th-TH")} วัน จาก {durationDays.toLocaleString("th-TH")} วันตามสัญญา
    </span>
  ) : (
    <span className="status-chip status-chip--attention">กรอกวันเริ่มและระยะเวลาก่อน</span>
  );

  return (
    <div className="workspace-panel">
      <div className="workspace-panel__title">
        <div>
          <p className="eyebrow">ปฏิทินวันทำงาน</p>
          <h2>วันไหนทำงานได้ และวันที่หายไปหายเพราะอะไร</h2>
        </div>
        {status}
      </div>
      <p className="form-note">
        ระยะเวลางานก่อสร้างนับเป็นวันทำงาน ไม่ใช่วันปฏิทิน หน้านี้บอกว่าในช่วงสัญญามีวันทำงานกี่วัน
        วันไหนหายไป และหายเพราะวันอะไร ทุกวันที่แสดงอยู่แก้ได้
      </p>

      <div className="work-plan__calendar-controls">
        <label className="work-plan__switch">
          <input
            type="checkbox"
            checked={calendar.worksSaturday}
            onChange={(event) => onCalendar({ ...calendar, worksSaturday: event.target.checked })}
          />
          ทำงานวันเสาร์
        </label>
        <label className="work-plan__switch">
          <input
            type="checkbox"
            checked={calendar.worksSunday}
            onChange={(event) => onCalendar({ ...calendar, worksSunday: event.target.checked })}
          />
          ทำงานวันอาทิตย์
        </label>
        <label>
          ระยะเวลาที่กรอกในตารางรายการงาน
          <select
            className="work-plan__cell"
            value={durationUnit}
            onChange={(event) => chooseUnit(event.target.value as DurationUnit)}
          >
            <option value="working">นับเป็นวันทำงาน</option>
            <option value="contract">นับเป็นวันตามสัญญา</option>
          </select>
        </label>
        <label>
          เผื่อวันฝนและความเสี่ยง
          <select
            className="work-plan__cell"
            value={String(rainPercent)}
            onChange={(event) => onRainPercent(Number.parseInt(event.target.value, 10))}
          >
            {RAIN_ALLOWANCE_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice === 0 ? "ไม่เผื่อ" : `เผื่อ ${choice}%`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pendingUnit === null ? null : (
        <div className="work-plan__sim-note" role="alert">
          <p>
            เปลี่ยนหน่วยไม่ได้แตะตัวเลขที่กรอกไว้สักตัว แต่เปลี่ยนวันที่แผนจบ
            เพราะเลขเดิมถูกอ่านด้วยหน่วยใหม่
          </p>
          <p>
            ตอนนี้นับเป็น{DURATION_UNIT_LABELS[durationUnit]} แผนจบ {formatThaiDate(demand.planEndDate)} —
            ถ้าเปลี่ยนเป็น{DURATION_UNIT_LABELS[pendingUnit]} แผนจะจบ {formatThaiDate(endUnderOtherUnit)}
          </p>
          <div className="work-plan__calendar-add">
            <button
              type="button"
              className="button button--orange micro-button"
              onClick={() => {
                onDurationUnit(pendingUnit);
                setPendingUnit(null);
              }}
            >
              เปลี่ยนเป็น{DURATION_UNIT_LABELS[pendingUnit]}
            </button>
            <button type="button" className="button button--ghost micro-button" onClick={() => setPendingUnit(null)}>
              ไม่เปลี่ยน
            </button>
          </div>
        </div>
      )}

      {!ready || !view ? null : (
        <>
          <dl className="work-plan__readout">
            <div>
              <dt>ช่วงสัญญา</dt>
              <dd>
                {formatThaiDate(startDate)} ถึง {formatThaiDate(endDate)}
              </dd>
            </div>
            <div>
              <dt>วันทำงานในช่วงสัญญา</dt>
              <dd>{view.working.toLocaleString("th-TH")} วัน</dd>
            </div>
            <div>
              <dt>หายไปเพราะวันหยุดประจำสัปดาห์</dt>
              <dd>{view.weekendCount.toLocaleString("th-TH")} วัน</dd>
            </div>
            <div>
              <dt>หายไปเพราะวันหยุดราชการ</dt>
              <dd>{view.holidays.length.toLocaleString("th-TH")} วัน</dd>
            </div>
            {demand.planEndDate === "" ? null : (
              <div>
                <dt>วันทำงานที่แผนนี้ต้องการ</dt>
                <dd>
                  {demand.required.toLocaleString("th-TH")} วัน ถึง {formatThaiDate(demand.planEndDate)}
                </dd>
              </div>
            )}
            {demand.planEndDate === "" || rainPercent === 0 ? null : (
              <div>
                <dt>เผื่อฝน {rainPercent}% ของ {demand.required.toLocaleString("th-TH")} วันทำงาน</dt>
                <dd>
                  เพิ่มอีก {demand.rainDays.toLocaleString("th-TH")} วัน เป็น{" "}
                  {demand.requiredWithRain.toLocaleString("th-TH")} วัน
                </dd>
              </div>
            )}
          </dl>

          {demand.overrun === 0 ? null : (
            <p className="work-plan__sim-note" role="alert">
              แผนนี้ต้องการ {demand.requiredWithRain.toLocaleString("th-TH")} วันทำงาน
              แต่ช่วงสัญญามีให้ {demand.available.toLocaleString("th-TH")} วัน — เกินอยู่{" "}
              {demand.overrun.toLocaleString("th-TH")} วันทำงาน บันทึกและพิมพ์แผนนี้ได้ตามปกติ
              เพราะการทำแผนที่เกินไว้ดูก่อนเป็นเรื่องที่ตั้งใจทำกัน แต่ถ้าจะยื่นจริงต้องลดงาน
              ขอขยายเวลา หรือลดค่าเผื่อฝนลง
            </p>
          )}

          {view.missingYears.length > 0 ? (
            <p className="work-plan__sim-note" role="alert">
              ยังไม่มีข้อมูลวันหยุดของปี {view.missingYears.map((year) => String(year)).join(" และ ")} —
              วันหยุดราชการของปีนั้นจะไม่ถูกนับ ทำให้แผนสั้นกว่าความจริง ให้เพิ่มวันหยุดเองด้านล่าง
              หรือรอจนกว่าจะมีประกาศ
            </p>
          ) : null}

          {view.provisional.map((year) => (
            <p className="work-plan__sim-note" key={year.buddhistYear}>
              {year.note}
            </p>
          ))}

          <div className="takeoff-table-wrap">
            <table className="takeoff-table work-plan__table work-plan__table--calendar">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>วัน</th>
                  <th>ชื่อวันหยุด</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {inRange.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <span className="form-note">ไม่มีวันหยุดราชการในช่วงสัญญานี้</span>
                    </td>
                  </tr>
                ) : (
                  inRange.map((holiday: ThaiHoliday) => (
                    <tr key={holiday.date}>
                      <td>{formatThaiDate(holiday.date)}</td>
                      <td>{WEEKDAY_NAMES[weekdayOf(holiday.date)] ?? "—"}</td>
                      <td>
                        {holiday.name}
                        {holiday.substitute ? <span className="work-plan__paper-works">วันชดเชย</span> : null}
                        {holiday.disputed ? (
                          <span className="work-plan__paper-works work-plan__calendar-disputed">{holiday.disputed}</span>
                        ) : null}
                      </td>
                      <td>
                        <button type="button" className="button button--ghost micro-button" onClick={() => remove(holiday.date)}>
                          โครงการนี้ไม่หยุด
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {removedInRange.map((date) => (
                  <tr key={date} className="work-plan__calendar-removed">
                    <td>{formatThaiDate(date)}</td>
                    <td>{WEEKDAY_NAMES[weekdayOf(date)] ?? "—"}</td>
                    <td>
                      <span className="form-note">เอาออกจากปฏิทินโครงการนี้แล้ว นับเป็นวันทำงาน</span>
                    </td>
                    <td>
                      <button type="button" className="button button--ghost micro-button" onClick={() => restore(date)}>
                        เอากลับมาเป็นวันหยุด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="work-plan__calendar-add">
            <label>
              เพิ่มวันหยุดของโครงการ
              <ThaiDateField value={newDate} onChange={(iso) => setNewDate(iso)} ariaLabel="เพิ่มวันหยุดของโครงการ" />
            </label>
            <label>
              เหตุผล
              <input
                className="work-plan__cell"
                value={newName}
                placeholder="เช่น หยุดตามคำสั่งผู้ว่าจ้าง"
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addHoliday();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="button button--orange micro-button"
              disabled={newDate.trim() === "" || newName.trim() === ""}
              onClick={addHoliday}
            >
              เพิ่มวันหยุด
            </button>
          </div>
          <p className="form-note">
            {/* เลขปีเป็นชื่อปี ไม่ใช่จำนวน — ห้ามผ่าน toLocaleString ไม่งั้นได้ "2,569" */}
            วันหยุดตั้งต้นมาจากประกาศวันหยุดราชการ ปี {String(buddhistYearOf(startDate))}
            {buddhistYearOf(endDate) !== buddhistYearOf(startDate) ? ` และ ${String(buddhistYearOf(endDate))}` : ""}
            {" "}— ตรวจกับประกาศจริงก่อนใช้ผูกสัญญา
          </p>
        </>
      )}
    </div>
  );
}
