import type { PlanActivity } from "./work-plan";
import type { IsoDate } from "./work-plan-actuals";
import {
  endOfWorkingDays,
  rainAllowanceDays,
  shiftDays,
  withRainAllowance,
  workingDaysBetween,
  type WorkCalendar
} from "./work-calendar";

/**
 * ตัวแปลงหน่วยเวลาระหว่างสิ่งที่ผู้ใช้พิมพ์ กับแกนเวลาที่ชั้นคำนวณแผนเดินอยู่
 *
 * เหตุผลของโมดูลนี้อยู่ใน `docs/adr/0017-the-plan-axis-stays-on-the-calendar.md` เต็ม ๆ
 * ย่อได้สามบรรทัด:
 *
 * หนึ่ง — **แกนเวลาของแผนเป็นวันตามสัญญาเสมอ** `PERIOD_DAYS = 15` คือครึ่งเดือนตามปฏิทิน
 * เพราะงวดงานและงวดจ่ายเงินของราชการนับแบบนั้น และค่าปรับตามสัญญาก็คิดจากวันตามปฏิทิน
 * ย้ายแกนไปเป็นวันทำงานเมื่อไร ยอดเบิกจ่ายต่องวดจะเลื่อนออกจากสัญญาทันที
 *
 * สอง — **หน่วยระยะเวลาเป็นการตีความขาเข้า ไม่ใช่หน่วยของแกน** โมดูลนี้อ่านเลขที่ผู้ใช้พิมพ์
 * เดินปฏิทินของโครงการ แล้วคืนกิจกรรมชุดเดิมที่แปลงเป็นวันตามสัญญาแล้ว ชั้นคำนวณแผนจึงไม่รู้เลย
 * ว่ามีสวิตช์นี้อยู่ และเทสต์ทั้งหมดของมันยังคุมของเดิมได้
 *
 * สาม — **ตัวเลขที่ผู้ใช้พิมพ์ไม่เคยถูกเขียนทับ** ผลของการตีความคือวันที่ ไม่ใช่ตัวเลขชุดใหม่
 * สลับสวิตช์กลับไปกลับมากี่รอบก็ได้เลขเดิมเสมอ
 */

/** หน่วยของตัวเลขระยะเวลาที่ผู้ใช้พิมพ์ลงตารางรายการงาน */
export type DurationUnit = "contract" | "working";

/** โครงการที่สร้างใหม่ตั้งต้นเป็นวันทำงาน ซึ่งตรงกับที่ผู้รับเหมาคิด */
export const DEFAULT_DURATION_UNIT: DurationUnit = "working";

/**
 * แผนที่บันทึกไว้ก่อนมีสวิตช์นี้ต้องได้วันตามสัญญาเสมอ
 *
 * ไฟล์รุ่นก่อน 4 ถูกกรอกในตอนที่ทั้งระบบนับเป็นวันตามสัญญาล้วน ให้ค่าอื่นแปลว่าแผนที่พิมพ์
 * ส่งราชการไปแล้วจะยาวขึ้นเองเพราะการอัปเกรด ซึ่งเป็นการเปลี่ยนคำตอบของงานที่ปิดไปแล้ว
 */
export const LEGACY_DURATION_UNIT: DurationUnit = "contract";

export const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  contract: "วันตามสัญญา",
  working: "วันทำงาน"
};

/** จำนวนวันตามปฏิทินจากวันหนึ่งถึงอีกวันหนึ่ง นับ from ถึง to เป็นระยะห่าง ไม่ใช่จำนวนวัน */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export type ScheduledActivity = {
  /** กิจกรรมตามที่ผู้ใช้พิมพ์ ไม่ถูกแตะ */
  typed: PlanActivity;
  /** กิจกรรมเดียวกันที่แปลงเป็นวันตามสัญญาแล้ว พร้อมส่งให้ `activityWeights` และ `buildPlanCurve` */
  onCalendar: PlanActivity;
  startDate: IsoDate;
  endDate: IsoDate;
  /** วันเริ่มถ้าอ่านเลขเดียวกันเป็นวันตามสัญญา ใช้บอกผู้ใช้ว่าหน่วยพาไปคนละวันอย่างไร */
  contractStartDate: IsoDate;
  /** จริงเมื่อวันเริ่มจริงไม่ตรงกับวันเริ่มตามปฏิทินล้วน */
  shifted: boolean;
};

/**
 * วางกิจกรรมลงบนปฏิทินจริงของโครงการ แล้วคืนทั้งวันที่และกิจกรรมที่แปลงหน่วยแล้ว
 *
 * โหมดวันตามสัญญาคือพฤติกรรมเดิมทุกประการ ไม่มีการเลื่อนวันเริ่มและไม่มีการข้ามวันหยุด
 * เพราะแผนที่กรอกไว้แบบนั้นตั้งใจให้เป็นแบบนั้น
 *
 * โหมดวันทำงานอ่าน `startOffsetDays` เป็นจำนวนวันทำงานที่ผ่านไปก่อนกิจกรรมจะเริ่ม
 * กิจกรรมจึงเริ่มที่วันทำงานลำดับที่ `startOffsetDays + 1` ของโครงการ และไม่มีทางตกบนวันหยุด
 */
export function scheduleActivities(
  activities: readonly PlanActivity[],
  options: { startDate: IsoDate; unit: DurationUnit; calendar: WorkCalendar }
): ScheduledActivity[] {
  const { startDate, unit, calendar } = options;
  if (!startDate) return [];

  return activities.map((activity) => {
    const offset = Math.max(0, Math.trunc(activity.startOffsetDays));
    const span = Math.max(1, Math.trunc(activity.durationDays));
    const contractStartDate = shiftDays(startDate, offset);

    if (unit === "contract") {
      const endDate = shiftDays(contractStartDate, span - 1);
      return {
        typed: activity,
        onCalendar: activity,
        startDate: contractStartDate,
        endDate,
        contractStartDate,
        shifted: false
      };
    }

    const actualStart = endOfWorkingDays(calendar, startDate, offset + 1);
    const endDate = endOfWorkingDays(calendar, actualStart, span);
    return {
      typed: activity,
      onCalendar: {
        ...activity,
        startOffsetDays: daysBetween(startDate, actualStart),
        durationDays: daysBetween(actualStart, endDate) + 1
      },
      startDate: actualStart,
      endDate,
      contractStartDate,
      shifted: actualStart !== contractStartDate
    };
  });
}

/** กิจกรรมที่แปลงเป็นวันตามสัญญาแล้ว ซึ่งเป็นสิ่งเดียวที่ชั้นคำนวณแผนควรได้เห็น */
export const activitiesOnCalendar = (scheduled: readonly ScheduledActivity[]): PlanActivity[] =>
  scheduled.map((entry) => entry.onCalendar);

export type ProjectDemand = {
  /** วันทำงานที่มีอยู่จริงในช่วงสัญญา */
  available: number;
  /** วันทำงานที่แผนนี้กินไป นับจากวันเริ่มโครงการถึงวันที่กิจกรรมสุดท้ายจบ */
  required: number;
  /** วันทำงานที่ต้องการหลังบวกค่าเผื่อฝนแล้ว */
  requiredWithRain: number;
  /** วันที่บวกเพิ่มเข้ามาจากค่าเผื่อฝน */
  rainDays: number;
  /** เกินสัญญาไปกี่วันทำงาน ศูนย์เมื่อยังอยู่ในสัญญา */
  overrun: number;
  /** วันสุดท้ายของแผน ว่างเมื่อยังไม่มีกิจกรรม */
  planEndDate: IsoDate | "";
  /** วันสุดท้ายตามสัญญา นับวันเริ่มเป็นวันที่หนึ่ง */
  contractEndDate: IsoDate | "";
};

/**
 * เทียบสิ่งที่แผนต้องการกับสิ่งที่สัญญาให้ ในหน่วยวันทำงานทั้งคู่
 *
 * ค่าเผื่อฝนบวกที่ระดับโครงการ ไม่ไปยืดระยะเวลาของกิจกรรมรายตัว เพราะฝนไม่ได้ทำให้
 * วันนั้นทำงานไม่ได้ทั้งวันเสมอไป มันทำให้งานทั้งโครงการเสร็จช้าลง และการไปบวกใส่ทุกกิจกรรม
 * คือการเขียนทับตัวเลขที่ผู้ใช้พิมพ์เอง
 *
 * เกินสัญญาไม่ใช่ข้อผิดพลาดที่ห้ามบันทึก ผู้รับเหมาตั้งใจทำแผนที่เกินไว้ดูก่อนได้
 * หน้าที่ของฟังก์ชันนี้คือบอกว่าเกินไปเท่าไร ไม่ใช่ห้าม
 */
export function projectDemand(options: {
  scheduled: readonly ScheduledActivity[];
  startDate: IsoDate;
  contractDays: number;
  calendar: WorkCalendar;
  rainPercent: number;
}): ProjectDemand {
  const { scheduled, startDate, contractDays, calendar, rainPercent } = options;
  const empty: ProjectDemand = {
    available: 0,
    required: 0,
    requiredWithRain: 0,
    rainDays: 0,
    overrun: 0,
    planEndDate: "",
    contractEndDate: ""
  };
  if (!startDate || contractDays <= 0) return empty;

  const contractEndDate = shiftDays(startDate, contractDays - 1);
  const available = workingDaysBetween(calendar, startDate, contractEndDate);

  const planEndDate = scheduled.reduce<IsoDate | "">(
    (latest, entry) => (latest === "" || entry.endDate > latest ? entry.endDate : latest),
    ""
  );
  if (planEndDate === "") return { ...empty, available, contractEndDate };

  const required = workingDaysBetween(calendar, startDate, planEndDate);
  const requiredWithRain = withRainAllowance(required, rainPercent);

  return {
    available,
    required,
    requiredWithRain,
    rainDays: rainAllowanceDays(required, rainPercent),
    overrun: Math.max(0, requiredWithRain - available),
    planEndDate,
    contractEndDate
  };
}

/**
 * วันสิ้นสุดของแผนถ้าอ่านเลขชุดเดียวกันด้วยอีกหน่วยหนึ่ง
 *
 * มีไว้ให้หน้าจอเอาไปวางข้างกันก่อนผู้ใช้ยืนยันการสลับสวิตช์ เพราะการสลับหน่วยไม่ได้แตะตัวเลข
 * แต่เปลี่ยนวันที่แผนจบ ซึ่งเป็นสิ่งที่ผู้ใช้ต้องเห็นก่อนตัดสิน ไม่ใช่หลังจากนั้น
 */
export function planEndUnder(
  activities: readonly PlanActivity[],
  options: { startDate: IsoDate; unit: DurationUnit; calendar: WorkCalendar }
): IsoDate | "" {
  return scheduleActivities(activities, options).reduce<IsoDate | "">(
    (latest, entry) => (latest === "" || entry.endDate > latest ? entry.endDate : latest),
    ""
  );
}
