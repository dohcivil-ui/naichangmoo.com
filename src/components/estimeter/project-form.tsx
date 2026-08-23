"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PROJECT_NAME_MAX, PROJECT_NAME_MIN, PROJECT_PATHS } from "@/lib/estimeter-project";
import { createEstimeterProject, type ProjectActionState } from "@/server/actions/estimeter-project";

const initialState: ProjectActionState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--orange" type="submit" disabled={pending}>
      {pending ? "กำลังสร้างโครงการ..." : "สร้างโครงการและเริ่มตรวจแบบ"}
    </button>
  );
}

export function ProjectForm() {
  const [state, formAction] = useActionState(createEstimeterProject, initialState);

  return (
    <form className="quote-form" action={formAction}>
      <label>
        ชื่อโครงการ
        <input
          name="name"
          required
          autoFocus
          autoComplete="off"
          minLength={PROJECT_NAME_MIN}
          maxLength={PROJECT_NAME_MAX}
          aria-describedby={state.errors?.name ? "project-name-error" : "project-name-hint"}
          aria-invalid={state.errors?.name ? true : undefined}
          placeholder="เช่น อาคารสำนักงาน 3 ชั้น ต.บางพลี"
        />
      </label>
      {state.errors?.name ? (
        <p className="form-error" id="project-name-error" role="alert">{state.errors.name}</p>
      ) : (
        <p className="form-note" id="project-name-hint">ใช้ชื่อที่ระบุงานได้ชัดเจน เพราะชื่อนี้จะไปปรากฏบนหัวเอกสาร BOQ</p>
      )}

      <fieldset className="project-path" aria-invalid={state.errors?.path ? true : undefined}>
        <legend>สายงาน</legend>
        {PROJECT_PATHS.map((path, index) => (
          <label className="project-path__choice" key={path.code}>
            <input name="path" type="radio" value={path.code} defaultChecked={index === 0} />
            <span>
              <strong>{path.label}</strong>
              <em>{path.hint}</em>
            </span>
          </label>
        ))}
      </fieldset>
      {state.errors?.path ? (
        <p className="form-error" role="alert">{state.errors.path}</p>
      ) : (
        <p className="form-note">
          สายงานกำหนดวิธีคิดราคาของโครงการนี้ และเลือกได้ครั้งเดียวตอนสร้าง เพราะราคากลางกับราคาเสนอของผู้รับเหมาคิดกันคนละวิธี
          ตัวเลขที่ได้จึงเทียบกันตรง ๆ ไม่ได้
        </p>
      )}

      {state.message && !state.errors?.name && !state.errors?.path ? (
        <p className="form-error" role="alert">{state.message}</p>
      ) : null}

      <SubmitButton />
      <p className="form-note">จังหวัดและเดือนราคาอ้างอิงจะระบุในขั้นตอนราคา เมื่อระบบเปิดให้บันทึกข้อมูลเหล่านั้น</p>
    </form>
  );
}
