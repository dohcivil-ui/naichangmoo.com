import { MODELS, askForJson, configuredModels, type ModelId } from "../src/server/ai/provider.ts";
import { WORK_PLAN_SYSTEM, buildWorkPlanTask, workPlanSchema } from "../src/server/ai/work-plan-prompt.ts";

/**
 * เทียบแบบจำลองด้วยโจทย์จริงของเรา
 *
 * มีอยู่เพราะ benchmark สาธารณะวัดงานโค้ดกับคณิตศาสตร์ ไม่ได้วัดว่าเขียนศัพท์ก่อสร้างไทย
 * ได้ถูกหรือไม่ ซึ่งเป็นสิ่งเดียวที่งานนี้ต้องการ และเพราะช่องว่างราคาระหว่างค่ายกว้างถึง 60 เท่า
 * การเลือกโดยไม่วัดจึงเท่ากับตัดสินใจเรื่องต้นทุนตลอดอายุแอปด้วยความรู้สึก
 *
 * สคริปต์นี้ใช้ prompt และ schema ตัวเดียวกับที่แอปเรียกจริง ไม่ใช่สำเนา
 *
 * รัน: node --experimental-strip-types --env-file=.env scripts/compare-work-plan-models.ts
 */

const PROJECT = {
  projectName: "อาคารเรียน 4 ชั้น 12 ห้องเรียน โรงเรียนบ้านหนองแสง",
  contractBaht: "12500000",
  durationDays: 300,
  templateLabel: "อาคารทั่วไป"
};

const TRAP = {
  projectName: "รั้วคอนกรีตสำเร็จรูป ยาว 200 เมตร",
  contractBaht: "850000",
  durationDays: 30,
  templateLabel: "อาคารทั่วไป"
};

type Row = {
  model: ModelId;
  task: string;
  ok: boolean;
  detail: string;
  activities: number;
  milestones: number;
  weightGap: number;
  overrun: number;
  orphans: number;
  seconds: number;
  baht: number;
};

/** ตรวจสิ่งที่เครื่องตรวจได้ ส่วนคุณภาพภาษาไทยต้องให้วิศวกรอ่านเอง */
const inspect = (draft: ReturnType<typeof workPlanSchema.parse>, durationDays: number) => {
  const weightGap = Math.abs(draft.activities.reduce((sum, a) => sum + a.weightPpm, 0) - 1_000_000);
  const overrun = draft.activities.filter((a) => a.startOffsetDays + a.durationDays > durationDays).length;
  const bound = new Set(draft.milestones.flatMap((m) => m.activityNumbers));
  const orphans = draft.activities.filter((a) => !bound.has(a.number)).length;
  return { weightGap, overrun, orphans };
};

const run = async (model: ModelId, label: string, input: typeof PROJECT, instruction?: string): Promise<Row> => {
  const started = Date.now();
  const result = await askForJson(
    model,
    {
      system: WORK_PLAN_SYSTEM,
      user: buildWorkPlanTask({ ...input, instruction }),
      schema: workPlanSchema,
      schemaName: "work_plan"
    },
    started
  );

  if (!result.ok) {
    return { model, task: label, ok: false, detail: result.message, activities: 0, milestones: 0, weightGap: 0, overrun: 0, orphans: 0, seconds: (Date.now() - started) / 1000, baht: 0 };
  }

  const checks = inspect(result.data, input.durationDays);
  return {
    model,
    task: label,
    ok: true,
    detail: result.data.note,
    activities: result.data.activities.length,
    milestones: result.data.milestones.length,
    ...checks,
    seconds: result.elapsedMs / 1000,
    baht: result.costBaht
  };
};

const only = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const available = configuredModels().filter((id) => only.length === 0 || only.includes(id));

if (available.length === 0) {
  console.error("ยังไม่มีแบบจำลองที่เรียกได้ ตรวจว่ามีคีย์ใน .env แล้วหรือยัง");
  console.error("คีย์ที่แต่ละค่ายต้องใช้:", [...new Set(Object.values(MODELS).map((m) => m.apiKeyEnv))].join(" "));
  process.exit(1);
}

console.log(`เทียบ ${available.length} แบบจำลอง: ${available.map((id) => MODELS[id].label).join(" · ")}\n`);

const rows: Row[] = [];
for (const model of available) {
  process.stdout.write(`${MODELS[model].label} ... `);
  const draft = await run(model, "ร่างแผน", PROJECT);
  rows.push(draft);
  const trap = await run(model, "โครงการสั้น", TRAP);
  rows.push(trap);
  console.log(draft.ok ? `เสร็จ ${draft.seconds.toFixed(1)} วิ` : `ล้มเหลว ${draft.detail}`);
}

const pad = (value: string | number, width: number) => String(value).padEnd(width);
console.log("\n" + pad("แบบจำลอง", 20) + pad("โจทย์", 14) + pad("งาน", 6) + pad("งวด", 6) + pad("น้ำหนักคลาด", 13) + pad("เลยเวลา", 9) + pad("งานลอย", 8) + pad("วินาที", 8) + "บาท/ครั้ง");
console.log("-".repeat(100));
for (const row of rows) {
  if (!row.ok) {
    console.log(pad(MODELS[row.model].label, 20) + pad(row.task, 14) + row.detail.slice(0, 60));
    continue;
  }
  console.log(
    pad(MODELS[row.model].label, 20) + pad(row.task, 14) + pad(row.activities, 6) + pad(row.milestones, 6) +
    pad(row.weightGap.toLocaleString("th-TH"), 13) + pad(row.overrun, 9) + pad(row.orphans, 8) +
    pad(row.seconds.toFixed(1), 8) + row.baht.toFixed(3)
  );
}

console.log("\nหมายเหตุ น้ำหนักคลาดและงานลอยไม่ทำให้ยอดเงินผิด เพราะโค้ดเกลี่ยให้เองก่อนคิดเงิน");
console.log("ตัวเลขพวกนี้บอกว่าแบบจำลองตัวไหนตามคำสั่งได้แม่นกว่ากัน ไม่ได้บอกว่าเงินจะผิด\n");

console.log("=== ตัวอย่างรายการงานที่แต่ละตัวร่างมา ให้อ่านเทียบศัพท์ภาษาไทย ===");
for (const model of available) {
  const started = Date.now();
  const result = await askForJson(
    model,
    { system: WORK_PLAN_SYSTEM, user: buildWorkPlanTask(PROJECT), schema: workPlanSchema, schemaName: "work_plan" },
    started
  );
  console.log(`\n--- ${MODELS[model].label} ---`);
  if (!result.ok) {
    console.log(result.message);
    continue;
  }
  console.log(`หมายเหตุจากแบบจำลอง: ${result.data.note}`);
  for (const activity of result.data.activities.slice(0, 12)) {
    console.log(`  ${activity.number.padEnd(6)} ${activity.title.padEnd(38)} ${(activity.weightPpm / 10000).toFixed(2)}%  วันที่ ${activity.startOffsetDays}-${activity.startOffsetDays + activity.durationDays}`);
  }
  if (result.data.activities.length > 12) console.log(`  ... อีก ${result.data.activities.length - 12} รายการ`);
  console.log(`  งวดงาน: ${result.data.milestones.map((m) => `${m.title} (${m.activityNumbers.length} งาน)`).join(" · ")}`);
}

