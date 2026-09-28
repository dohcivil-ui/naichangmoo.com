"use client";

import { useActionState, useState } from "react";
import { accessLabel, availabilityNotePresets, type AppAccess } from "@/lib/platform";
import { declareApp, setAppExpectedMonth, withdrawApp, type AppRegistryFormState } from "@/server/actions/admin-apps";
import { expectedMonthYearRange, formatExpectedMonth, splitExpectedMonth } from "@/lib/app-readiness";
import { THAI_MONTH_FULL, toBuddhistYear } from "@/lib/thai-date";
import type { RegistryEntry } from "@/server/app-registry";
import { Button } from "@/components/platform/button";

const initial: AppRegistryFormState = { ok: false, message: "" };

const ACCESS_OPTIONS: readonly AppAccess[] = ["paid_trial", "member_free", "doh_staff_only", "agent_service"];

/** Sentinel select values that are not sentences. Thai strings cannot collide with them. */
const NOTE_NONE = "__none__";
const NOTE_CUSTOM = "__custom__";

/**
 * The availability sentence is picked from the standard set (ADR 0018) so the public wording
 * stays a pattern, per the owner's 2026-08-27 request. "กำหนดเอง" opens a free-text field for
 * the rare sentence with more to say; "ไม่แสดงข้อความ" announces silence, which is valid.
 */
function initialNoteChoice(current: string | null, seeded: string): string {
  const value = current ?? seeded;
  if (!value) return NOTE_NONE;
  return (availabilityNotePresets as readonly string[]).includes(value) ? value : NOTE_CUSTOM;
}

/**
 * ช่องเลือกเดือนที่คาดว่าเปิด — เดือนไทยกับปี พ.ศ. บนจอ แต่ส่งออกเป็น `YYYY-MM` ปี ค.ศ.
 *
 * **ไม่ใช้ช่องเลือกเดือนของเบราว์เซอร์** ด่าน `date-input-fence.test.ts` ห้ามช่องวันที่ทุกชนิด
 * ของเบราว์เซอร์ไว้ตามคำสั่งเจ้าของงาน 2026-08-28 เพราะมันโชว์ ค.ศ. ตามภาษาเครื่อง
 * ทำให้คนทำแผนงานมั่ว · **ด่านนั้นสแกนตัวอักษรตรง ๆ คอมเมนต์ที่พิมพ์ชื่อชนิดช่องก็โดนจับ**
 * ซึ่งเป็นเหตุผลที่ย่อหน้านี้เลี่ยงพิมพ์มันตรง ๆ ·
 * `ThaiDateField` เป็นของกลางสำหรับวันเต็ม ไม่ใช่เดือน จึงทำเป็นสองช่องเลือกที่นี่แทน
 * ไม่ขยายของกลางให้รับโหมดใหม่เพื่อผู้ใช้รายเดียว
 *
 * **ผลข้างเคียงที่ตั้งใจ — ช่องเลือกปิดช่องโหว่ปีพุทธศักราชไปด้วย** ฝั่งเซิร์ฟเวอร์กับ CHECK
 * ที่ฐานตรวจแค่ว่าเป็นเลขสี่หลัก `2569-10` จึงผ่านทั้งคู่และจะทำให้การ์ดขึ้นว่า "ต.ค. 12"
 * เพราะถูกบวก 543 อีกรอบ · ช่องนี้เลือกได้เฉพาะปีที่มีอยู่ในรายการ ซึ่งเป็น ค.ศ. เสมอ
 * **แต่มันปิดแค่ทางเข้าที่เรารู้จัก** ทางเซิร์ฟเวอร์ยังเปิดอยู่ และยังไม่ได้แก้
 */
function ExpectedMonthField({ current }: { current: string | null }) {
  const parts = splitExpectedMonth(current);
  const [month, setMonth] = useState(parts ? String(parts.month).padStart(2, "0") : "");
  const [year, setYear] = useState(parts ? String(parts.year) : "");

  /* **ช่วงปีมาจาก `app-readiness.ts` ที่เดียว** ตัวเดียวกับที่ `setExpectedOpenMonth` บังคับ ·
     ถ้าพิมพ์เลขไว้ทั้งสองที่ วันที่ใครแก้ที่หนึ่ง เซิร์ฟเวอร์จะปฏิเสธค่าที่กล่องนี้เพิ่งยื่นให้
     ซึ่งผู้ใช้แก้เองไม่ได้เลย เพราะเขาเลือกได้เฉพาะสิ่งที่กล่องมี

     **ส่ง `new Date()` ตรง ๆ เหมือนฝั่งเซิร์ฟเวอร์ ไม่แปลงเป็นวันกรุงเทพก่อน**
     `expectedMonthYearRange` แปลงเขตเวลาให้อยู่แล้วข้างใน · เดิมที่นี่แปลงเองก่อนส่ง
     ซึ่งได้ผลเท่ากันแต่เป็นวิธีหา "ตอนนี้" คนละทางกับที่ `admin-apps.ts` ใช้
     หลักการเดียวกับตัวเลข คือเหลือทางเดียว ไม่ใช่สองทางที่บังเอิญตรงกันวันนี้ */
  const { first, last } = expectedMonthYearRange(new Date());
  const years: number[] = [];
  for (let value = first; value <= last; value += 1) years.push(value);
  /* ปีที่เก็บไว้อาจเลยมาแล้วจนหลุดช่วง ต้องคงไว้ให้เห็น ไม่งั้นช่องจะดูเหมือนไม่เคยกรอก ·
     ค่าที่หลุดช่วงยังแสดงได้และแก้ได้ ตามคำสั่งที่ว่าห้ามบังคับช่วงตอนอ่าน */
  if (parts && !years.includes(parts.year)) years.unshift(parts.year);

  const value = month && year ? `${year}-${month}` : "";

  return (
    <>
      <input type="hidden" name="expected_open_month" value={value} />
      <div className="admin-form__row">
        <label>
          <span>เดือนที่คาดว่าจะเปิด</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="">ไม่ระบุเดือน</option>
            {THAI_MONTH_FULL.map((name, index) => (
              <option key={name} value={String(index + 1).padStart(2, "0")}>
                {name}
              </option>
            ))}
          </select>
          <small>
            {current
              ? "เลือก “ไม่ระบุเดือน” แล้วบันทึก คือการลบเดือนออก ซึ่งทำให้แอปถอยกลับไปเป็นประกาศแล้วโดยไม่มีเดือน"
              : "ยังไม่กรอก แอปนี้จึงอยู่ขั้นประกาศแล้ว · เลือกเดือนเพื่อให้การ์ดพูดว่าคาดว่าเปิดเมื่อไร"}
          </small>
        </label>

        <label>
          <span>ปี พ.ศ.</span>
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">ไม่ระบุปี</option>
            {years.map((option) => (
              <option key={option} value={String(option)}>
                {toBuddhistYear(option)}
              </option>
            ))}
          </select>
          <small>เก็บลงฐานเป็น ค.ศ. {value || "—"} แสดงบนจอเป็น พ.ศ. ทั้งเว็บ</small>
        </label>
      </div>
    </>
  );
}

/**
 * One app's announcement. The reason is required in the markup and again on the server: the
 * browser requirement only saves a round trip, it is not where the rule lives.
 *
 * The two warnings below are shown as the administrator types rather than after they submit. Both
 * are things ADR 0014 permits or forbids for reasons a person cannot be expected to remember while
 * looking at a dropdown, and a rule explained only by a rejection is a rule learned by annoyance.
 */
export function AppRegistryForm({ entry, monthExpired }: { entry: RegistryEntry; monthExpired: boolean }) {
  const [state, formAction, pending] = useActionState(declareApp, initial);
  const [withdrawState, withdrawAction, withdrawing] = useActionState(withdrawApp, initial);
  const [monthState, monthAction, savingMonth] = useActionState(setAppExpectedMonth, initial);
  const [access, setAccess] = useState<AppAccess>(entry.access ?? entry.seededAccess);
  const [open, setOpen] = useState(entry.open);
  const [noteChoice, setNoteChoice] = useState(() => initialNoteChoice(entry.availabilityNote, entry.seededNote));

  const conflicts = access !== entry.seededAccess;
  const openRefused = access === "member_free" && open;

  return (
    <div className="admin-form">
      <form action={formAction} className="admin-form" style={{ padding: 0 }}>
        <input type="hidden" name="slug" value={entry.slug} />

        <div className="admin-form__row">
          <label>
            <span>สิทธิ์ที่ประกาศ</span>
            <select name="access" value={access} onChange={(event) => setAccess(event.target.value as AppAccess)}>
              {ACCESS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {accessLabel[option]}
                </option>
              ))}
            </select>
            <small>ค่าตั้งต้นในโค้ดคือ {accessLabel[entry.seededAccess]}</small>
          </label>

          <label>
            <span>การเปิดใช้</span>
            <select name="open" value={open ? "open" : "preparing"} onChange={(event) => setOpen(event.target.value === "open")}>
              <option value="preparing">กำลังเตรียมระบบ</option>
              <option value="open">เปิดใช้แล้ว</option>
            </select>
            <small>เปิดใช้แล้วหมายถึงเปิดหน้าทำงานให้เข้าได้จริง ไม่ใช่แค่คำกำกับบนหน้าราคา</small>
          </label>
        </div>

        {conflicts ? (
          <p className="admin-form__warning" role="status">
            คำประกาศนี้ขัดกับค่าตั้งต้นในโค้ด ซึ่งตั้ง {entry.name} ไว้เป็น {accessLabel[entry.seededAccess]} — ทำได้
            และทะเบียนจะเป็นฝ่ายถูก แต่เหตุผลที่พิมพ์ไว้ข้างล่างคือสิ่งเดียวที่จะอธิบายเรื่องนี้ให้คนอ่านทีหลังเข้าใจ
          </p>
        ) : null}

        {openRefused ? (
          <p className="admin-form__warning" role="status">
            แอปที่ประกาศเป็นสมาชิกใช้ฟรี ยังตั้งเป็นเปิดใช้แล้วไม่ได้ เพราะยังไม่มีเส้นทางใดออกสิทธิ์ให้สมาชิกโดยอัตโนมัติ
            การประกาศว่าฟรีและเปิดใช้แล้วจึงเป็นคำสัญญาที่หน้างานจริงจะปฏิเสธ
          </p>
        ) : null}

        <label>
          <span>ประโยคความพร้อมที่หน้าเว็บจะพูดก่อนเข้าใช้งาน</span>
          <select value={noteChoice} onChange={(event) => setNoteChoice(event.target.value)}>
            {availabilityNotePresets.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
            <option value={NOTE_NONE}>ไม่แสดงข้อความ</option>
            <option value={NOTE_CUSTOM}>กำหนดเอง…</option>
          </select>
          <small>
            แสดงบนหน้ารายละเอียดแอปเฉพาะเมื่อประกาศแล้ว ค่าแนะนำจากโค้ดคือ &ldquo;{entry.seededNote}&rdquo;
          </small>
        </label>

        {noteChoice === NOTE_CUSTOM ? (
          <label>
            <span>ประโยคที่กำหนดเอง</span>
            <input
              type="text"
              name="availability_note"
              required
              defaultValue={entry.availabilityNote ?? entry.seededNote}
              placeholder="พิมพ์ประโยคที่หน้าเว็บจะแสดง"
            />
            <small>ใช้เมื่อประโยคมาตรฐานบอกไม่พอ เช่น เงื่อนไขเปิดใช้เฉพาะแอป</small>
          </label>
        ) : (
          <input type="hidden" name="availability_note" value={noteChoice === NOTE_NONE ? "" : noteChoice} />
        )}

        <label>
          <span>เหตุผล ระบุทุกครั้ง</span>
          <input
            type="text"
            name="reason"
            required
            minLength={4}
            placeholder="เช่น เปิดเป็นแอปฟรีสำหรับสมาชิกตามที่ตกลงไว้ ยังไม่เปิดใช้จนกว่าจะปรับโครงสร้างเสร็จ"
          />
          <small>บันทึกลงประวัติพร้อมชื่อผู้ดำเนินการ สถานะก่อนประกาศ และสถานะหลังประกาศ</small>
        </label>

        <div className="admin-form__foot">
          <Button tone="primary" type="submit" disabled={pending || openRefused}>
            {pending ? "กำลังบันทึก…" : entry.announced ? "บันทึกคำประกาศ" : "ประกาศแอปนี้"}
          </Button>
          {state.message ? (
            <p className={state.ok ? "admin-form__ok" : "admin-form__error"} role="status">
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      {/**
       * เดือนที่คาดว่าเปิด — ADR 0025 · แยกเป็นฟอร์มของตัวเอง ไม่รวมกับคำประกาศ
       *
       * **ขึ้นเฉพาะแอปที่ประกาศแล้ว** เพราะขั้นกลางคือประกาศแล้วบวกเดือน · ช่องที่กรอกแล้ว
       * ถูกปฏิเสธเสมอเป็นช่องที่ไม่ควรมี ผู้ดูแลจะเรียนรู้กฎจากการถูกปฏิเสธ ซึ่งเป็นวิธีเรียนที่แย่ที่สุด
       *
       * เดือนกับปีเป็นช่องเลือก ไม่ใช่ช่องพิมพ์ ดู `ExpectedMonthField` ข้างบนว่าทำไม
       */}
      {entry.announced ? (
        <form action={monthAction} className="admin-form" style={{ padding: 0 }}>
          <input type="hidden" name="slug" value={entry.slug} />

          {monthExpired && entry.expectedOpenMonth ? (
            <p className="admin-form__warning" role="status">
              เดือนที่กรอกไว้คือ {formatExpectedMonth(entry.expectedOpenMonth) ?? entry.expectedOpenMonth}{" "}
              <strong>ซึ่งเลยกำหนดไปแล้ว</strong> การ์ดบนหน้าแรกจึงเลิกพูดถึงเดือนนี้เอง
              และแอปถอยกลับไปเป็น &ldquo;ประกาศแล้ว&rdquo; ตั้งแต่วันแรกของเดือนถัดไป ·
              ค่ายังอยู่ในทะเบียนเพราะระบบไม่ลบสิ่งที่คนเป็นคนเขียนไว้ กรอกเดือนใหม่หรือลบออกได้จากช่องข้างล่าง
            </p>
          ) : null}

          <ExpectedMonthField current={entry.expectedOpenMonth} />

          <label>
            <span>เหตุผล ระบุทุกครั้ง</span>
            <input
              type="text"
              name="reason"
              required
              minLength={4}
              placeholder="เช่น ทีมยืนยันกำหนดเปิดแล้ว หรือ เลื่อนเพราะรอผลทดสอบ"
            />
            <small>
              บังคับทั้งตอนกรอก ตอนเลื่อน และ<strong>ตอนลบ</strong> เพราะการถอยขั้นที่ไม่ต้องอธิบาย
              คือสิ่งเดียวกับการเลื่อนเงียบ แค่คนละทิศ
            </small>
          </label>

          <div className="admin-form__foot">
            <Button tone="quiet" type="submit" disabled={savingMonth}>
              {savingMonth ? "กำลังบันทึก…" : "บันทึกเดือนที่คาดว่าเปิด"}
            </Button>
            {monthState.message ? (
              <p className={monthState.ok ? "admin-form__ok" : "admin-form__error"} role="status">
                {monthState.message}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}

      {entry.announced ? (
        <form action={withdrawAction} className="admin-form" style={{ padding: 0 }}>
          <input type="hidden" name="slug" value={entry.slug} />
          <label>
            <span>ถอนคำประกาศ</span>
            <input type="text" name="reason" required minLength={4} placeholder="เหตุผลที่ถอนออกจากหน้าสาธารณะ" />
            <small>
              ชื่อแอปหายจากหน้าราคาทันที สิทธิ์ของลูกค้าที่ผูกกับแอปนี้ไม่ถูกแตะต้อง เพราะการถอนคำพูดไม่ใช่การยึดของ
            </small>
          </label>
          <div className="admin-form__foot">
            <Button tone="quiet" type="submit" disabled={withdrawing}>
              {withdrawing ? "กำลังถอน…" : "ถอนคำประกาศ"}
            </Button>
            {withdrawState.message ? (
              <p className={withdrawState.ok ? "admin-form__ok" : "admin-form__error"} role="status">
                {withdrawState.message}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
