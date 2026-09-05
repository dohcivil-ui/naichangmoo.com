"use client";

import { useActionState, useState } from "react";
import { accessLabel, availabilityNotePresets, type AppAccess } from "@/lib/platform";
import { declareApp, withdrawApp, type AppRegistryFormState } from "@/server/actions/admin-apps";
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
 * One app's announcement. The reason is required in the markup and again on the server: the
 * browser requirement only saves a round trip, it is not where the rule lives.
 *
 * The two warnings below are shown as the administrator types rather than after they submit. Both
 * are things ADR 0014 permits or forbids for reasons a person cannot be expected to remember while
 * looking at a dropdown, and a rule explained only by a rejection is a rule learned by annoyance.
 */
export function AppRegistryForm({ entry }: { entry: RegistryEntry }) {
  const [state, formAction, pending] = useActionState(declareApp, initial);
  const [withdrawState, withdrawAction, withdrawing] = useActionState(withdrawApp, initial);
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
