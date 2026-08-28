"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import {
  buildMilestoneSchedule,
  percentToPpm,
  type AdvanceRecovery,
  type ContractTerms,
  type Milestone,
  type RetentionMethod
} from "@/lib/payment-milestone";
import { formatBaht, parseBaht } from "@/lib/thai-baht";
import { formatThaiDate } from "@/lib/thai-format";
import { PERIOD_DAYS, WEIGHT_SCALE, activityWeights, buildPlanCurve, formatPercent, sumCost, type PlanActivity } from "@/lib/work-plan";
import { draftActivities, draftMilestones, hasTemplate, templateOptions, templateSource, type TemplateId } from "@/lib/work-plan-template";
import {
  buildActualSeries,
  cashPosition,
  checkDeductions,
  countHiddenEvents,
  daysBetween,
  expectedNetForCertified,
  latestRecordedDate,
  milestoneStatuses,
  type IsoDate,
  type MilestoneActual,
  type MilestoneStage,
  type MoneyEvent
} from "@/lib/work-plan-actuals";
import { newPlanDocumentMeta, type WorkPlanDocumentMeta } from "@/lib/work-plan-document-meta";
import { ThaiDateField } from "@/components/ui/thai-date-field";
import {
  getSaveFailed,
  getSaveFailedOnServer,
  getWorkPlanRaw,
  getWorkPlanServerRaw,
  parseWorkPlan,
  saveWorkPlan,
  subscribeWorkPlanStore,
  type WorkPlanSnapshot
} from "@/lib/work-plan-storage";
import { askWorkPlanAssistant, reviewWorkPlan, type AssistantResult, type ReviewFinding } from "@/server/actions/work-plan-assistant";
import { WorkPlanDocument } from "@/components/prototype/work-plan-document";
import { WorkCalendarPanel } from "@/components/prototype/work-calendar-panel";
import { defaultWorkCalendar, type WorkCalendar } from "@/lib/work-calendar";
import {
  activitiesOnCalendar,
  DEFAULT_DURATION_UNIT,
  DURATION_UNIT_LABELS,
  planEndUnder,
  projectDemand,
  scheduleActivities,
  type DurationUnit,
  type ScheduledActivity
} from "@/lib/work-plan-schedule";

/**
 * ต้นแบบแอปผู้ช่วยสร้างแผนงานและ S-Curve
 *
 * ทุกตัวเลขบนหน้าจอนี้คำนวณจริงจาก src/lib/work-plan.ts และ src/lib/payment-milestone.ts
 * ไม่มีค่าที่พิมพ์ทิ้งไว้ให้ดูเหมือนทำงาน สิ่งเดียวที่เป็นของชั่วคราวคือที่เก็บข้อมูล ซึ่งอยู่ใน
 * หน่วยความจำของเบราว์เซอร์ รีโหลดแล้วหาย เพราะรอบนี้ต้องการคำตอบว่า "ลำดับงานแบบนี้ใช่ไหม"
 * ก่อนจะลงทุนทำ schema
 */

const TABS = [
  { id: 1, label: "โครงการและเงื่อนไขสัญญา" },
  { id: 2, label: "รายการงาน" },
  { id: 3, label: "งวดงาน–งวดเงิน" },
  { id: 4, label: "เส้นความก้าวหน้าสะสม" }
] as const;

type TabId = (typeof TABS)[number]["id"];

type SetupState = {
  projectName: string;
  contract: string;
  startDate: string;
  duration: string;
  templateId: TemplateId;
  advance: string;
  advanceRecovery: AdvanceRecovery;
  retention: string;
  retentionMethod: RetentionMethod;
  vat: string;
  withholding: string;
};

const initialSetup: SetupState = {
  projectName: "",
  contract: "",
  startDate: "",
  duration: "",
  templateId: "general-building",
  advance: "0",
  advanceRecovery: "proportional",
  retention: "5",
  retentionMethod: "each",
  vat: "7",
  withholding: "0"
};

const addDays = (isoDate: string, days: number): string | null => {
  if (!isoDate) return null;
  const start = new Date(`${isoDate}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + days * 86_400_000).toISOString();
};

/**
 * เงินที่ถูกหักหรือบวกเข้ามา ติดเครื่องหมายเฉพาะเมื่อมีจำนวนจริง
 * ช่อง −0.00 อ่านแล้วเหมือนระบบคิดผิด ทั้งที่แปลว่างวดนั้นไม่มีการหัก
 */
const signed = (satang: bigint, sign: "−" | "+") => (satang === 0n ? formatBaht(0n) : `${sign}${formatBaht(satang)}`);

/**
 * ตัวเลขที่กะพริบเมื่อค่าของมันเปลี่ยน
 *
 * ไม่ได้ใส่ไว้ให้สวย แต่ใส่ไว้ตอบคำถามว่า "แก้ช่องนี้แล้วกระทบอะไรบ้าง" ซึ่งเป็นคำถามที่
 * ตารางนิ่ง ๆ ตอบไม่ได้เลย ผู้ใช้แก้ค่างานหนึ่งบรรทัดแล้วจะเห็นน้ำหนัก ยอดงวด และเส้นสะสม
 * ไล่สว่างตามกันเป็นทอด ๆ จึงรู้ว่าการแก้ครั้งนั้นเดินไปถึงไหน
 *
 * ใช้ key บังคับให้ remount เพราะ CSS animation จะเล่นซ้ำก็ต่อเมื่อ element เกิดใหม่
 */
function LiveNumber({ children }: { children: ReactNode }) {
  const [pulse, setPulse] = useState(0);
  const previous = useRef<string>("");
  const text = String(children);

  useEffect(() => {
    if (previous.current !== "" && previous.current !== text) setPulse((count) => count + 1);
    previous.current = text;
  }, [text]);

  return (
    <span key={pulse} className={pulse === 0 ? undefined : "work-plan__live"}>
      {children}
    </span>
  );
}

/** ป้ายช่วงเวลาแบบ ด1/1 คือเดือนที่หนึ่ง ครึ่งแรก ตามหัวคอลัมน์ 15/30 ที่หนังสือใช้ */
const periodLabel = (index: number) => `ด${Math.floor(index / 2) + 1}/${(index % 2) + 1}`;

/**
 * ชั้นนอกทำหน้าที่เดียว คืออ่านงานที่ค้างอยู่ในเบราว์เซอร์ แล้วส่งให้ชั้นในเป็นค่าตั้งต้น
 *
 * แยกออกมาเพราะที่เก็บของเบราว์เซอร์เป็นสิ่งที่เซิร์ฟเวอร์มองไม่เห็น `useSyncExternalStore`
 * จึงจัดการการวาดสองรอบให้ถูกต้องเอง โดยรอบแรกใช้สแนปช็อตฝั่งเซิร์ฟเวอร์ แล้วค่อยสลับเป็นของจริง
 * เป็นแบบแผนเดียวกับ `cookie-notice.tsx` และดีกว่าการอ่านใน effect แล้วเรียก setState
 * ซึ่งทำให้หน้าจอกระพริบและถูกกฎ react-hooks ปฏิเสธ
 *
 * `key` ทำให้ชั้นในเกิดใหม่พร้อมค่าตั้งต้นชุดใหม่เมื่อของจริงมาถึง โดยไม่ต้องมี effect ที่ตั้งค่าย้อนกลับ
 */
export function WorkPlanWorkspace() {
  const raw = useSyncExternalStore(subscribeWorkPlanStore, getWorkPlanRaw, getWorkPlanServerRaw);
  const restored = useMemo(() => parseWorkPlan(raw === "" ? null : raw), [raw]);
  return <WorkPlanBoard key={restored ? "restored" : "fresh"} restored={restored} />;
}

function WorkPlanBoard({ restored }: { restored: WorkPlanSnapshot | null }) {
  const [tab, setTab] = useState<TabId>(1);
  const [setup, setSetup] = useState<SetupState>(() => {
    if (!restored) return initialSetup;
    // ค่าที่เป็นตัวเลือกต้องตรวจก่อนใช้ ไฟล์ที่ถูกแก้เองมาอาจมีคำที่เราไม่รู้จัก
    return {
      ...initialSetup,
      ...restored.setup,
      templateId: hasTemplate(restored.setup.templateId) ? restored.setup.templateId : initialSetup.templateId,
      advanceRecovery: restored.setup.advanceRecovery === "none" ? "none" : "proportional",
      retentionMethod: restored.setup.retentionMethod === "final" ? "final" : "each"
    };
  });
  const [activities, setActivities] = useState<PlanActivity[]>(() => restored?.activities ?? []);
  const [milestones, setMilestones] = useState<Milestone[]>(() => restored?.milestones ?? []);
  const [draftedIds, setDraftedIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [assistantNote, setAssistantNote] = useState<string | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantBusy, startAssistant] = useTransition();
  const [showDocument, setShowDocument] = useState(false);
  const [reviewFindings, setReviewFindings] = useState<ReviewFinding[] | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewBusy, startReview] = useTransition();
  const [actuals, setActuals] = useState<MilestoneActual[]>(() => restored?.actuals ?? []);
  /** ว่างแปลว่ายังไม่เคยตั้งเอง ให้ไปใช้วันล่าสุดที่มีบันทึก หรือวันนี้ */
  const [dataDateOverride, setDataDateOverride] = useState<IsoDate | "">(() => restored?.dataDate ?? "");
  const [documentMeta, setDocumentMeta] = useState<WorkPlanDocumentMeta>(() => restored?.document ?? newPlanDocumentMeta());
  const [workCalendar, setWorkCalendar] = useState<WorkCalendar>(() => restored?.calendar ?? defaultWorkCalendar());
  const [rainPercent, setRainPercent] = useState<number>(() => restored?.rainPercent ?? 0);
  /** แผนที่บันทึกไว้ก่อนมีสวิตช์นี้ถูกอ่านกลับมาเป็น contract เสมอ ค่า working เป็นของโครงการใหม่เท่านั้น */
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(() => restored?.durationUnit ?? DEFAULT_DURATION_UNIT);
  const saveFailed = useSyncExternalStore(subscribeWorkPlanStore, getSaveFailed, getSaveFailedOnServer);

  const contractParse = parseBaht(setup.contract);
  const contractSatang = contractParse.ok ? contractParse.satang : 0n;
  const durationDays = Number.parseInt(setup.duration, 10);
  const durationValid = Number.isFinite(durationDays) && durationDays > 0;
  const canDraft = contractSatang > 0n && durationValid && setup.projectName.trim() !== "" && hasTemplate(setup.templateId);

  const terms: ContractTerms = useMemo(
    () => ({
      contractSatang,
      advancePpm: percentToPpm(setup.advance),
      advanceRecovery: setup.advanceRecovery,
      retentionPpm: percentToPpm(setup.retention),
      retentionMethod: setup.retentionMethod,
      vatPpm: percentToPpm(setup.vat),
      withholdingPpm: percentToPpm(setup.withholding)
    }),
    [contractSatang, setup.advance, setup.advanceRecovery, setup.retention, setup.retentionMethod, setup.vat, setup.withholding]
  );

  /**
   * ชั้นเดียวที่รู้ว่าหน่วยของระยะเวลาคืออะไร ทุกอย่างที่อยู่ใต้บรรทัดนี้เห็นเป็นวันตามสัญญาหมด
   *
   * เหตุผลอยู่ใน ADR 0017: แกนเวลาของแผนผูกกับงวดจ่ายเงินซึ่งนับตามปฏิทิน การย้ายแกน
   * ไปเป็นวันทำงานจะพายอดเบิกจ่ายต่องวดเลื่อนออกจากสัญญา
   */
  const scheduled = useMemo(
    () => scheduleActivities(activities, { startDate: setup.startDate, unit: durationUnit, calendar: workCalendar }),
    [activities, setup.startDate, durationUnit, workCalendar]
  );
  const onCalendar = useMemo(
    () => (scheduled.length === activities.length ? activitiesOnCalendar(scheduled) : activities),
    [scheduled, activities]
  );
  const demand = useMemo(
    () =>
      projectDemand({
        scheduled,
        startDate: setup.startDate,
        contractDays: durationValid ? durationDays : 0,
        calendar: workCalendar,
        rainPercent
      }),
    [scheduled, setup.startDate, durationDays, durationValid, workCalendar, rainPercent]
  );
  /** วันจบของเลขชุดเดิมถ้าอ่านด้วยอีกหน่วย ใช้วางข้างกันก่อนผู้ใช้ยืนยันการสลับ */
  const endUnderOtherUnit = useMemo(
    () =>
      planEndUnder(activities, {
        startDate: setup.startDate,
        unit: durationUnit === "working" ? "contract" : "working",
        calendar: workCalendar
      }),
    [activities, setup.startDate, durationUnit, workCalendar]
  );

  const weights = useMemo(() => activityWeights(onCalendar), [onCalendar]);
  const curve = useMemo(
    () => buildPlanCurve(onCalendar, durationValid ? durationDays : 1),
    [onCalendar, durationDays, durationValid]
  );
  const schedule = useMemo(
    () => buildMilestoneSchedule(weights, milestones, terms),
    [weights, milestones, terms]
  );

  /**
   * วันตัดข้อมูลที่ใช้จริง — ค่าตั้งต้นคือวันล่าสุดที่มีบันทึก ถ้ายังไม่มีเลยก็ใช้วันนี้
   * ผู้ใช้แก้ทับได้เสมอ เพราะเวลาทำรายงานส่งกรรมการต้องตรึงไว้ที่วันที่ระบุในรายงาน
   */
  const todayIso = new Date().toISOString().slice(0, 10);
  const dataDate: IsoDate = dataDateOverride || latestRecordedDate(actuals) || todayIso;

  const actualSeries = useMemo(() => buildActualSeries(actuals, dataDate), [actuals, dataDate]);
  const position = useMemo(() => cashPosition(actualSeries), [actualSeries]);
  const statuses = useMemo(() => milestoneStatuses(actuals, dataDate), [actuals, dataDate]);
  const deductionFindings = useMemo(
    () => checkDeductions(schedule.rows, actuals, dataDate),
    [schedule.rows, actuals, dataDate]
  );
  const hiddenEvents = countHiddenEvents(actuals, dataDate);
  const actualById = new Map(actuals.map((entry) => [entry.milestoneId, entry]));
  const statusById = new Map(statuses.map((entry) => [entry.milestoneId, entry]));

  const updateActual = (milestoneId: string, patch: Partial<MilestoneActual>) =>
    setActuals((current) => {
      const existing = current.find((entry) => entry.milestoneId === milestoneId);
      if (!existing) return [...current, { milestoneId, ...patch }];
      return current.map((entry) => (entry.milestoneId === milestoneId ? { ...entry, ...patch } : entry));
    });

  /**
   * เก็บลงเบราว์เซอร์ทุกครั้งที่มีอะไรเปลี่ยน
   *
   * เขียนอย่างเดียว ไม่ตั้งสถานะใด ๆ ในนี้ ผลของการเขียนอ่านผ่านที่เก็บภายนอกแทน
   * เพราะการเรียก setState ใน effect ทำให้วาดหน้าจอสองรอบทุกครั้งที่พิมพ์หนึ่งตัวอักษร
   */
  useEffect(() => {
    /*
     * กติกาที่ห้ามพัง: **กระดานเปล่าห้ามเขียนทับงานที่ค้างอยู่**
     *
     * เขียนไว้เป็นกติกาของข้อมูล ไม่ใช่ตัวนับรอบ เพราะตัวนับรอบเอาไม่อยู่จริง —
     * โหมดตรวจสอบของ React ในระหว่างพัฒนาเรียก effect สองรอบโดยที่ ref ยังอยู่ค่าเดิม
     * ตัวกันแบบนับรอบจึงถูกข้ามในรอบที่สองแล้วลบงานของผู้ใช้ทิ้ง (เจอจริงตอนทดสอบ)
     *
     * กติกานี้ยังกันอีกกรณีที่เกิดจริง คือเปิดหน้านี้ไว้สองแท็บ แล้วแท็บที่ยังว่าง
     * ไปลบงานที่อีกแท็บกำลังทำอยู่ทิ้ง
     */
    const boardIsEmpty =
      activities.length === 0 &&
      milestones.length === 0 &&
      actuals.length === 0 &&
      setup.projectName.trim() === "" &&
      setup.contract.trim() === "";
    if (boardIsEmpty && getWorkPlanRaw() !== "") return;

    saveWorkPlan({
      setup, activities, milestones, actuals,
      dataDate: dataDateOverride, document: documentMeta,
      calendar: workCalendar, rainPercent, durationUnit
    });
  }, [setup, activities, milestones, actuals, dataDateOverride, documentMeta, workCalendar, rainPercent, durationUnit]);

  const scheduleById = useMemo(
    () => new Map(scheduled.map((entry) => [entry.typed.id, entry])),
    [scheduled]
  );

  const activityCost = sumCost(activities);
  const costGap = activityCost - contractSatang;
  const weightById = new Map(weights.map((weight) => [weight.activityId, weight.weightPpm]));
  const titleById = new Map(activities.map((activity) => [activity.id, activity.title]));
  const milestoneOfActivity = new Map<string, string>();
  for (const milestone of milestones) {
    for (const activityId of milestone.activityIds) {
      if (!milestoneOfActivity.has(activityId)) milestoneOfActivity.set(activityId, milestone.id);
    }
  }

  // ชื่องานที่ต้องแล้วเสร็จในแต่ละงวด ใช้ทั้งในเอกสารพิมพ์และในคำสั่งตรวจแผน
  const activityTitlesByMilestone: Record<string, string[]> = {};
  for (const milestone of milestones) {
    activityTitlesByMilestone[milestone.id] = milestone.activityIds
      .map((id) => titleById.get(id))
      .filter((title): title is string => Boolean(title));
  }

  const canReview = schedule.rows.length > 0 && contractSatang > 0n;

  const runReview = () => {
    setReviewError(null);
    startReview(async () => {
      const result = await reviewWorkPlan({
        projectName: setup.projectName,
        contractBaht: setup.contract,
        durationDays: durationValid ? durationDays : 0,
        milestones: schedule.rows.map((row) => ({
          title: row.title,
          percentOfContract: formatPercent(row.weightPpm),
          periodWorkSatang: row.periodWorkSatang.toString(),
          activityTitles: activityTitlesByMilestone[row.milestoneId] ?? [],
          finishPeriod: 0
        }))
      });
      if (!result.ok) {
        setReviewError(result.message);
        return;
      }
      setReviewFindings(result.findings);
    });
  };

  const touch = (activityId: string) =>
    setDraftedIds((current) => {
      if (!current.has(activityId)) return current;
      const next = new Set(current);
      next.delete(activityId);
      return next;
    });

  const runDraft = () => {
    const drafted = draftActivities(setup.templateId, contractSatang, durationDays);
    setActivities(drafted);
    setMilestones(draftMilestones(drafted, 6));
    setDraftedIds(new Set(drafted.map((activity) => activity.id)));
    setNotice(`ร่างจากแม่แบบแล้ว ${drafted.length} รายการ ตรวจและแก้ได้ทุกช่อง`);
    setTab(2);
  };

  /**
   * เรียกผู้ช่วยจริง ทั้งตอนร่างครั้งแรกและตอนสั่งแก้เป็นภาษาคน
   *
   * ผลที่ได้กลับมาถือเป็นร่างเสมอ ทุกบรรทัดติดป้ายว่ามาจากผู้ช่วย และป้ายจะหายไปทันทีที่คนแก้ค่านั้น
   * เพราะเอกสารที่ออกไปยื่นเบิกต้องตอบได้ว่าตัวเลขไหนคนตัดสิน ตัวเลขไหนเครื่องเสนอ
   */
  const runAssistant = (userInstruction?: string) => {
    setAssistantError(null);
    const templateLabel = templateOptions.find((option) => option.id === setup.templateId)?.label ?? "";

    startAssistant(async () => {
      const result: AssistantResult = await askWorkPlanAssistant(
        {
          projectName: setup.projectName,
          contractBaht: setup.contract,
          durationDays,
          templateLabel,
          instruction: userInstruction,
          current: userInstruction
            ? activities.map((activity) => ({
                number: activity.number,
                title: activity.title,
                weightPpm: (weightById.get(activity.id) ?? 0n).toString(),
                startOffsetDays: activity.startOffsetDays,
                durationDays: activity.durationDays
              }))
            : undefined
        },
        contractSatang.toString()
      );

      if (!result.ok) {
        setAssistantError(result.message);
        return;
      }

      const next = result.plan.activities.map((activity) => ({ ...activity, costSatang: BigInt(activity.costSatang) }));
      setActivities(next);
      setMilestones(result.plan.milestones);
      setDraftedIds(new Set(next.map((activity) => activity.id)));
      setAssistantNote(result.plan.note);
      setNotice(`ผู้ช่วยเสนอแผน ${next.length} รายการ แบ่ง ${result.plan.milestones.length} งวด ตรวจและแก้ได้ทุกช่อง`);
      setInstruction("");
      if (!userInstruction) setTab(2);
    });
  };

  const updateActivity = (id: string, patch: Partial<PlanActivity>) => {
    touch(id);
    setActivities((current) => current.map((activity) => (activity.id === id ? { ...activity, ...patch } : activity)));
  };

  const removeActivity = (id: string) => {
    setActivities((current) => current.filter((activity) => activity.id !== id));
    setMilestones((current) =>
      current.map((milestone) => ({ ...milestone, activityIds: milestone.activityIds.filter((entry) => entry !== id) }))
    );
  };

  const addActivity = () => {
    const id = `manual-${Date.now()}`;
    setActivities((current) => [
      ...current,
      {
        id,
        number: `${current.length + 1}`,
        title: "งานใหม่",
        startOffsetDays: 0,
        durationDays: 15,
        costSatang: 0n
      }
    ]);
  };

  const moveActivity = (activityId: string, milestoneId: string) => {
    setMilestones((current) =>
      current.map((milestone) => ({
        ...milestone,
        activityIds:
          milestone.id === milestoneId
            ? [...milestone.activityIds.filter((entry) => entry !== activityId), activityId]
            : milestone.activityIds.filter((entry) => entry !== activityId)
      }))
    );
  };

  const addMilestone = () =>
    setMilestones((current) => [
      ...current,
      { id: `milestone-${current.length + 1}-${Date.now()}`, ordinal: current.length + 1, title: `งวดที่ ${current.length + 1}`, activityIds: [] }
    ]);

  return (
    <section className="estimation-workspace work-plan">
      <div className="container">
        <header className="estimation-workspace__head">
          <div>
            <p className="eyebrow" style={{ color: "var(--teal)" }}>ต้นแบบ · หมวดการบริหารงานโครงการ</p>
            <h1>
              แอปผู้ช่วยสร้างแผนงาน<span className="work-plan__title-tail">และ S-Curve</span>
            </h1>
            <p className="estimation-workspace__lead">
              กรอกห้าค่า ให้ผู้ช่วยร่างแผนให้ แล้วแก้ได้ทุกช่อง
              ยอดทุกงวดรวมกันต้องเท่ามูลค่าสัญญาเสมอ
            </p>
          </div>
          <div className="estimation-workspace__progress" aria-label={`ขั้นที่ ${tab} จาก 4`}>
            <span>ขั้นตอน</span>
            <strong>{tab} / 4</strong>
            <small>{TABS.find((entry) => entry.id === tab)?.label}</small>
          </div>
        </header>

        <p className="work-plan__disclaimer">
          หน้านี้เป็นต้นแบบสำหรับตัดสินใจ งานที่ทำค้างไว้เก็บในเบราว์เซอร์เครื่องนี้เท่านั้น
          ยังไม่ขึ้นคลาวด์ และเปิดจากเครื่องอื่นไม่เห็น
        </p>

        {saveFailed ? (
          <p className="form-error work-plan__notice" role="alert">
            บันทึกลงเบราว์เซอร์ไม่สำเร็จ อาจเพราะพื้นที่เต็มหรือเบราว์เซอร์ปิดการเก็บข้อมูลเว็บไว้ —
            งานที่ทำอยู่จะหายเมื่อปิดหน้านี้
          </p>
        ) : null}

        <nav className="work-plan__tabs" aria-label="ขั้นตอนการทำงาน">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={tab === entry.id ? "work-plan__tab is-active" : "work-plan__tab"}
              aria-current={tab === entry.id ? "step" : undefined}
              onClick={() => setTab(entry.id)}
            >
              <span className="work-plan__tab-number">{entry.id}</span>
              {entry.label}
            </button>
          ))}
        </nav>

        {notice ? (
          <p className="form-success work-plan__notice" role="status">
            {notice}
          </p>
        ) : null}

        <AssistantBar
          busy={assistantBusy}
          canAsk={canDraft}
          hasPlan={activities.length > 0}
          instruction={instruction}
          setInstruction={setInstruction}
          note={assistantNote}
          error={assistantError}
          onDraft={() => runAssistant()}
          onRevise={() => runAssistant(instruction.trim())}
        />

        {tab === 1 ? (
          <SetupTab
            setup={setup}
            setSetup={setSetup}
            contractSatang={contractSatang}
            contractInvalid={setup.contract.trim() !== "" && !contractParse.ok}
            durationValid={durationValid}
            durationDays={durationDays}
            canDraft={canDraft}
            onDraft={runDraft}
            contractEndDate={demand.contractEndDate}
            calendarPanel={
              <WorkCalendarPanel
                calendar={workCalendar}
                onCalendar={setWorkCalendar}
                rainPercent={rainPercent}
                onRainPercent={setRainPercent}
                startDate={setup.startDate}
                durationDays={durationValid ? durationDays : 0}
                durationUnit={durationUnit}
                onDurationUnit={setDurationUnit}
                demand={demand}
                endUnderOtherUnit={endUnderOtherUnit}
              />
            }
          />
        ) : null}

        {tab === 2 ? (
          <ActivitiesTab
            activities={activities}
            weightById={weightById}
            draftedIds={draftedIds}
            activityCost={activityCost}
            contractSatang={contractSatang}
            costGap={costGap}
            startDate={setup.startDate}
            durationUnit={durationUnit}
            scheduleById={scheduleById}
            onUpdate={updateActivity}
            onRemove={removeActivity}
            onAdd={addActivity}
            onGoSetup={() => setTab(1)}
          />
        ) : null}

        {tab === 3 ? (
          <MilestonesTab
            activities={activities}
            schedule={schedule}
            milestones={milestones}
            milestoneOfActivity={milestoneOfActivity}
            contractSatang={contractSatang}
            onMove={moveActivity}
            onAdd={addMilestone}
            canReview={canReview}
            reviewBusy={reviewBusy}
            reviewFindings={reviewFindings}
            reviewError={reviewError}
            onReview={runReview}
            onPrint={() => setShowDocument(true)}
            actualById={actualById}
            statusById={statusById}
            onUpdateActual={updateActual}
            dataDate={dataDate}
            deductionFindings={deductionFindings}
          />
        ) : null}

        {tab === 4 ? (
          <CurveTab
            curve={curve}
            schedule={schedule}
            contractSatang={contractSatang}
            startDate={setup.startDate}
            actualSeries={actualSeries}
            position={position}
            dataDate={dataDate}
            dataDateOverride={dataDateOverride}
            onDataDate={setDataDateOverride}
            hiddenEvents={hiddenEvents}
            todayIso={todayIso}
          />
        ) : null}
      </div>

      {showDocument ? (
        <WorkPlanDocument
          projectName={setup.projectName}
          schedule={schedule}
          activityTitlesByMilestone={activityTitlesByMilestone}
          meta={documentMeta}
          onMeta={setDocumentMeta}
          onClose={() => setShowDocument(false)}
        />
      ) : null}
    </section>
  );
}

/**
 * แถบผู้ช่วย อยู่ทุกแท็บ ไม่ใช่ปุ่มเดียวที่หน้าแรก
 *
 * เหตุผลที่ไม่ซ่อนไว้ในขั้นตอนเดียว: คำสั่งอย่าง "งวดที่ 3 ขอรวมงานหลังคาเข้าไปด้วย" เกิดตอน
 * ผู้ใช้กำลังดูตารางงวดอยู่ ไม่ใช่ตอนกรอกข้อมูลโครงการ ถ้าต้องเดินกลับไปแท็บแรกเพื่อสั่งแก้
 * ก็เท่ากับผิดกติกาที่ว่าทำงานให้จบในแท็บเดียว
 */
function AssistantBar({
  busy,
  canAsk,
  hasPlan,
  instruction,
  setInstruction,
  note,
  error,
  onDraft,
  onRevise
}: {
  busy: boolean;
  canAsk: boolean;
  hasPlan: boolean;
  instruction: string;
  setInstruction: (value: string) => void;
  note: string | null;
  error: string | null;
  onDraft: () => void;
  onRevise: () => void;
}) {
  return (
    <section className={busy ? "work-plan__assistant is-busy" : "work-plan__assistant"} aria-busy={busy}>
      <div className="work-plan__assistant-head">
        <p className="eyebrow">ผู้ช่วยวางแผน</p>
        <span className={busy ? "status-chip status-chip--attention" : "status-chip status-chip--ready"}>
          {busy ? "กำลังคิด" : hasPlan ? "พร้อมรับคำสั่งแก้" : "พร้อมร่างแผน"}
        </span>
      </div>

      {hasPlan ? (
        <div className="work-plan__assistant-row">
          <input
            className="work-plan__cell work-plan__assistant-input"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="สั่งเป็นภาษาคน เช่น งวดที่ 3 ขอรวมงานหลังคาเข้าไปด้วย หรือ เพิ่มงานลิฟต์ 2 ตัว"
            disabled={busy}
            onKeyDown={(event) => {
              if (event.key === "Enter" && instruction.trim() !== "" && !busy) onRevise();
            }}
          />
          <button
            type="button"
            className="button button--orange micro-button"
            onClick={onRevise}
            disabled={busy || instruction.trim() === ""}
          >
            {busy ? "กำลังคำนวณใหม่..." : "สั่งแก้"}
          </button>
        </div>
      ) : (
        <div className="work-plan__assistant-row">
          <p className="work-plan__assistant-lead">
            ป้อนห้าค่าในแท็บแรกให้ครบ แล้วให้ผู้ช่วยอ่านชื่อโครงการและร่างรายการงาน ค่างาน
            ช่วงเวลา และการแบ่งงวดให้ทั้งชุด
          </p>
          <button type="button" className="button button--orange micro-button" onClick={onDraft} disabled={busy || !canAsk}>
            {busy ? "กำลังร่าง..." : "ให้ผู้ช่วยร่างแผน"}
          </button>
        </div>
      )}

      {error ? (
        <p className="form-error work-plan__assistant-message" role="alert">
          {error}
        </p>
      ) : note ? (
        <p className="form-note work-plan__assistant-message">
          <strong>สมมติฐานที่ผู้ช่วยตั้งไว้</strong> {note}
        </p>
      ) : null}
    </section>
  );
}

function Panel({ eyebrow, title, status, children }: { eyebrow: string; title: string; status?: ReactNode; children: ReactNode }) {
  return (
    <div className="workspace-panel">
      <div className="workspace-panel__title">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {status}
      </div>
      {children}
    </div>
  );
}

function SetupTab({
  setup,
  setSetup,
  contractSatang,
  contractInvalid,
  durationValid,
  durationDays,
  canDraft,
  onDraft,
  contractEndDate,
  calendarPanel
}: {
  setup: SetupState;
  setSetup: (updater: (current: SetupState) => SetupState) => void;
  contractSatang: bigint;
  contractInvalid: boolean;
  durationValid: boolean;
  durationDays: number;
  canDraft: boolean;
  onDraft: () => void;
  /** วันสุดท้ายตามสัญญา คำนวณที่เดียวกับที่แผงปฏิทินใช้ ว่างแปลว่ายังกรอกไม่ครบ */
  contractEndDate: string;
  /** แผงปฏิทินวันทำงาน ส่งมาจากผู้เรียกเพราะสถานะของมันอยู่ระดับเดียวกับที่เก็บข้อมูล */
  calendarPanel: ReactNode;
}) {
  const set = <K extends keyof SetupState>(key: K, value: SetupState[K]) =>
    setSetup((current) => ({ ...current, [key]: value }));

  const source = templateSource(setup.templateId);
  /**
   * วันสุดท้ายตามสัญญามาจาก `projectDemand` ที่เดียว ไม่คำนวณซ้ำที่นี่
   *
   * ที่นี่เคยคำนวณเองเป็น `addDays(startDate, durationDays)` ซึ่งให้วันที่ 211 ของสัญญา 210 วัน
   * แล้วขัดกับแผงปฏิทินที่อยู่บนจอเดียวกันมาตั้งแต่ v0.52.0 — โครงการ 1 ส.ค. 210 วัน
   * การ์ดบอก 27 ก.พ. แต่แผงบอก 26 ก.พ. เลขสองตัวที่ตอบคำถามเดียวกันต้องมาจากที่เดียวกัน
   */
  const finishDate = contractEndDate === "" ? null : contractEndDate;

  return (
    <>
      <Panel
        eyebrow="ห้าค่าที่ต้องกรอก"
        title="ข้อมูลโครงการ"
        status={
          <span className={canDraft ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>
            {canDraft ? "พร้อมร่างแผน" : "ยังกรอกไม่ครบ"}
          </span>
        }
      >
        <div className="quote-form work-plan__form">
          <label className="work-plan__form-wide">
            ชื่อโครงการ
            <input
              value={setup.projectName}
              onChange={(event) => set("projectName", event.target.value)}
              placeholder="เช่น อาคารเรียน 4 ชั้น โรงเรียนบ้านหนองแสง"
              autoComplete="off"
            />
          </label>

          <label>
            มูลค่าสัญญา (บาท)
            <input
              value={setup.contract}
              onChange={(event) => set("contract", event.target.value)}
              inputMode="decimal"
              placeholder="12500000"
              aria-invalid={contractInvalid ? true : undefined}
            />
          </label>

          <label>
            วันเริ่มสัญญา
            <ThaiDateField value={setup.startDate} onChange={(iso) => set("startDate", iso)} ariaLabel="วันเริ่มสัญญา" />
          </label>

          <label>
            ระยะเวลา (วัน)
            <input
              value={setup.duration}
              onChange={(event) => set("duration", event.target.value)}
              inputMode="numeric"
              placeholder="300"
              aria-invalid={setup.duration.trim() !== "" && !durationValid ? true : undefined}
            />
          </label>

          <label>
            ประเภทงาน
            <select value={setup.templateId} onChange={(event) => set("templateId", event.target.value as TemplateId)}>
              {templateOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={!hasTemplate(option.id)}>
                  {option.label}
                  {hasTemplate(option.id) ? "" : " — ยังไม่มีแม่แบบ"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="form-note work-plan__source">
          {source
            ? `แม่แบบนี้ถอดจาก ${source} ไม่ใช่สัดส่วนที่โปรแกรมเดาขึ้นเอง`
            : "ประเภทนี้ยังไม่มีแม่แบบ ต้องถอดสัดส่วนค่างานจากเอกสารงวดงานของแบบมาตรฐานก่อน"}
        </p>

        <dl className="work-plan__readout">
          <div>
            <dt>มูลค่าสัญญาที่อ่านได้</dt>
            <dd>{contractSatang > 0n ? `${formatBaht(contractSatang)} บาท` : "—"}</dd>
          </div>
          <div>
            <dt>วันสิ้นสุดตามระยะเวลา</dt>
            <dd>{formatThaiDate(finishDate) ?? "—"}</dd>
          </div>
          <div>
            <dt>จำนวนช่วงครึ่งเดือน</dt>
            <dd>{durationValid ? `${Math.ceil(durationDays / 15).toLocaleString("th-TH")} ช่วง` : "—"}</dd>
          </div>
        </dl>
      </Panel>

      <Panel eyebrow="เงื่อนไขการจ่ายเงิน" title="เงื่อนไขสัญญา">
        <p className="form-note">
          ทุกการหักคิดจากมูลค่างานงวดนั้น ฐานคิดต่างกันได้ตามสัญญาแต่ละฉบับ
          หน้าจอจึงแสดงครบทุกบรรทัดให้ตรวจกับสัญญาจริงก่อนใช้ยื่นเบิก
        </p>
        <div className="quote-form work-plan__form">
          <label>
            เงินล่วงหน้า (%)
            <input value={setup.advance} onChange={(event) => set("advance", event.target.value)} inputMode="decimal" />
          </label>
          <label>
            การหักคืนเงินล่วงหน้า
            <select
              value={setup.advanceRecovery}
              onChange={(event) => set("advanceRecovery", event.target.value as AdvanceRecovery)}
            >
              <option value="proportional">หักคืนตามสัดส่วนทุกงวด</option>
              <option value="none">ไม่หักคืน</option>
            </select>
          </label>
          <label>
            เงินประกันผลงาน (%)
            <input value={setup.retention} onChange={(event) => set("retention", event.target.value)} inputMode="decimal" />
          </label>
          <label>
            วิธีหักเงินประกัน
            <select
              value={setup.retentionMethod}
              onChange={(event) => set("retentionMethod", event.target.value as RetentionMethod)}
            >
              <option value="each">หักทุกงวด</option>
              <option value="final">หักรวมในงวดสุดท้าย</option>
            </select>
          </label>
          <label>
            ภาษีมูลค่าเพิ่ม (%)
            <input value={setup.vat} onChange={(event) => set("vat", event.target.value)} inputMode="decimal" />
          </label>
          <label>
            ภาษีหัก ณ ที่จ่าย (%)
            <select value={setup.withholding} onChange={(event) => set("withholding", event.target.value)}>
              <option value="0">ไม่หัก</option>
              <option value="1">1% งานราชการและรัฐวิสาหกิจ</option>
              <option value="3">3% เอกชน จ้างทำของ</option>
            </select>
          </label>
        </div>

        <div className="workspace-callout">
          <div>
            <strong>ให้ผู้ช่วยร่างแผนจากแม่แบบ</strong>
            <p>
              ร่างรายการงาน ค่างานรายกิจกรรม ช่วงเวลา และการแบ่งงวดให้ทั้งชุด
              แล้วแก้ต่อได้ทุกช่อง
            </p>
          </div>
          <button type="button" className="button button--orange" onClick={onDraft} disabled={!canDraft}>
            ร่างแผนจากแม่แบบ
          </button>
        </div>
      </Panel>

      {calendarPanel}
    </>
  );
}

function ActivitiesTab({
  activities,
  weightById,
  draftedIds,
  activityCost,
  contractSatang,
  costGap,
  startDate,
  durationUnit,
  scheduleById,
  onUpdate,
  onRemove,
  onAdd,
  onGoSetup
}: {
  activities: PlanActivity[];
  weightById: Map<string, bigint>;
  draftedIds: ReadonlySet<string>;
  activityCost: bigint;
  contractSatang: bigint;
  costGap: bigint;
  startDate: string;
  durationUnit: DurationUnit;
  /** วันที่จริงของแต่ละกิจกรรมหลังอ่านด้วยหน่วยที่โครงการตั้งไว้ */
  scheduleById: Map<string, ScheduledActivity>;
  onUpdate: (id: string, patch: Partial<PlanActivity>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onGoSetup: () => void;
}) {
  if (activities.length === 0) {
    return (
      <Panel eyebrow="รายการงาน" title="ยังไม่มีรายการงาน">
        <p className="form-note">กลับไปกรอกข้อมูลโครงการแล้วกดร่างแผนจากแม่แบบ หรือเพิ่มรายการเอง</p>
        <div className="work-plan__row-actions">
          <button type="button" className="button button--ghost micro-button" onClick={onGoSetup}>
            ← ไปกรอกข้อมูลโครงการ
          </button>
          <button type="button" className="button button--orange micro-button" onClick={onAdd}>
            เพิ่มรายการเอง
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      eyebrow="รายการงาน"
      title={`${activities.length.toLocaleString("th-TH")} รายการ`}
      status={
        <span className={costGap === 0n ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>
          {costGap === 0n
            ? "ค่างานรวมตรงกับมูลค่าสัญญา"
            : `ต่างจากมูลค่าสัญญา ${formatBaht(costGap < 0n ? -costGap : costGap)} บาท`}
        </span>
      }
    >
      <div className="takeoff-table-wrap">
        <table className="takeoff-table work-plan__table">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th className="work-plan__col-title">รายการงาน</th>
              <th className="number-cell">เริ่มวันที่ (นับจากวันแรก)</th>
              <th className="number-cell">ระยะเวลา ({DURATION_UNIT_LABELS[durationUnit]})</th>
              <th className="number-cell">ค่างาน (บาท)</th>
              <th className="number-cell">น้ำหนัก</th>
              <th>ที่มา</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => {
              const placed = scheduleById.get(activity.id);
              return (
              <tr key={activity.id}>
                <td>
                  <input
                    className="work-plan__cell work-plan__cell--tiny"
                    value={activity.number}
                    onChange={(event) => onUpdate(activity.id, { number: event.target.value })}
                  />
                </td>
                <td className="work-plan__col-title">
                  <input
                    className="work-plan__cell"
                    value={activity.title}
                    onChange={(event) => onUpdate(activity.id, { title: event.target.value })}
                  />
                </td>
                <td className="number-cell">
                  <input
                    className="work-plan__cell work-plan__cell--number"
                    value={activity.startOffsetDays}
                    inputMode="numeric"
                    onChange={(event) =>
                      onUpdate(activity.id, { startOffsetDays: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })
                    }
                  />
                  <em className="quantity-note">
                    {placed ? formatThaiDate(placed.startDate) : formatThaiDate(addDays(startDate, activity.startOffsetDays)) ?? "ยังไม่ตั้งวันเริ่ม"}
                  </em>
                  {placed?.shifted ? (
                    <em className="quantity-note">
                      นับเป็นวันตามสัญญาจะเป็น {formatThaiDate(placed.contractStartDate)}
                    </em>
                  ) : null}
                </td>
                <td className="number-cell">
                  <input
                    className="work-plan__cell work-plan__cell--number"
                    value={activity.durationDays}
                    inputMode="numeric"
                    onChange={(event) =>
                      onUpdate(activity.id, { durationDays: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })
                    }
                  />
                  {placed ? <em className="quantity-note">ถึง {formatThaiDate(placed.endDate)}</em> : null}
                </td>
                <td className="number-cell">
                  <input
                    className="work-plan__cell work-plan__cell--number"
                    value={formatBaht(activity.costSatang)}
                    inputMode="decimal"
                    onChange={(event) => {
                      const parsed = parseBaht(event.target.value);
                      if (parsed.ok) onUpdate(activity.id, { costSatang: parsed.satang });
                    }}
                  />
                </td>
                <td className="number-cell"><LiveNumber>{`${formatPercent(weightById.get(activity.id) ?? 0n)}%`}</LiveNumber></td>
                <td>
                  {draftedIds.has(activity.id) ? (
                    <span className="status-chip status-chip--attention">ร่างจากแม่แบบ</span>
                  ) : (
                    <span className="status-chip status-chip--ready">แก้โดยผู้ใช้</span>
                  )}
                </td>
                <td>
                  <button type="button" className="button button--ghost micro-button" onClick={() => onRemove(activity.id)}>
                    ลบ
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>รวมค่างานทุกรายการ</td>
              <td className="number-cell">{formatBaht(activityCost)}</td>
              <td className="number-cell">{formatPercent(WEIGHT_SCALE)}%</td>
              <td colSpan={2}>มูลค่าสัญญา {formatBaht(contractSatang)} บาท</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="workspace-callout">
        <div>
          <strong>น้ำหนักมาจากค่างาน ไม่ใช่ระยะเวลา</strong>
          <p>
            งานที่ใช้เวลานานแต่ค่างานน้อย จะมีน้ำหนักน้อยกว่างานราคาสูงที่ทำไม่กี่วัน
            น้ำหนักคิดจากสัดส่วนค่างานต่อค่างานรวมของทั้งโครงการ
          </p>
        </div>
        <button type="button" className="button button--ghost micro-button" onClick={onAdd}>
          เพิ่มรายการ
        </button>
      </div>
    </Panel>
  );
}

function MilestonesTab({
  activities,
  schedule,
  milestones,
  milestoneOfActivity,
  contractSatang,
  onMove,
  onAdd,
  canReview,
  reviewBusy,
  reviewFindings,
  reviewError,
  onReview,
  onPrint,
  actualById,
  statusById,
  onUpdateActual,
  dataDate,
  deductionFindings
}: {
  activities: PlanActivity[];
  schedule: ReturnType<typeof buildMilestoneSchedule>;
  milestones: Milestone[];
  milestoneOfActivity: Map<string, string>;
  contractSatang: bigint;
  onMove: (activityId: string, milestoneId: string) => void;
  onAdd: () => void;
  canReview: boolean;
  reviewBusy: boolean;
  reviewFindings: ReviewFinding[] | null;
  reviewError: string | null;
  onReview: () => void;
  onPrint: () => void;
  actualById: Map<string, MilestoneActual>;
  statusById: Map<string, ReturnType<typeof milestoneStatuses>[number]>;
  onUpdateActual: (milestoneId: string, patch: Partial<MilestoneActual>) => void;
  dataDate: IsoDate;
  deductionFindings: ReturnType<typeof checkDeductions>;
}) {
  const balanced = schedule.totalWorkSatang === contractSatang && contractSatang > 0n;

  if (milestones.length === 0) {
    return (
      <Panel eyebrow="งวดงาน–งวดเงิน" title="ยังไม่มีงวด">
        <p className="form-note">ร่างแผนจากแม่แบบจะสร้างงวดให้ หรือเพิ่มงวดเองแล้วย้ายงานเข้ามา</p>
        <button type="button" className="button button--orange micro-button" onClick={onAdd}>
          เพิ่มงวด
        </button>
      </Panel>
    );
  }

  const severityLabel: Record<ReviewFinding["severity"], string> = {
    high: "เสี่ยงสูง",
    medium: "ควรระวัง",
    low: "ข้อสังเกต"
  };

  return (
    <>
      <Panel eyebrow="ตรวจและออกเอกสาร" title="ผู้ช่วยตรวจแผน และเอกสารแนบสัญญา">
        <p className="form-note">
          ให้ผู้ช่วยตรวจแผนก่อนยื่น หรือพิมพ์บัญชีงวดงานเป็นเอกสารแนบท้ายสัญญา
          ยอดทุกช่องคิดด้วยจำนวนเต็มสตางค์ ตรวจย้อนได้ทุกบาท
        </p>
        <div className="work-plan__row-actions">
          <button type="button" className="button button--orange micro-button" onClick={onReview} disabled={reviewBusy || !canReview}>
            {reviewBusy ? "กำลังตรวจ..." : "ให้ผู้ช่วยตรวจแผน"}
          </button>
          <button type="button" className="button button--ghost micro-button" onClick={onPrint} disabled={!balanced && contractSatang > 0n ? false : schedule.rows.length === 0}>
            พิมพ์บัญชีงวดงาน
          </button>
        </div>

        {reviewError ? (
          <p className="form-error work-plan__assistant-message" role="alert">
            {reviewError}
          </p>
        ) : reviewFindings ? (
          reviewFindings.length === 0 ? (
            <p className="form-success work-plan__assistant-message" role="status">
              ผู้ช่วยตรวจแล้ว ไม่พบจุดเสี่ยงที่ต้องแก้
            </p>
          ) : (
            <ul className="work-plan__findings">
              {reviewFindings.map((finding, index) => (
                <li key={index} className={`work-plan__finding work-plan__finding--${finding.severity}`}>
                  <span className="work-plan__finding-tag">{severityLabel[finding.severity]}</span>
                  <div>
                    <strong>{finding.title}</strong>
                    <p>{finding.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Panel>

      <Panel
        eyebrow="งวดงาน–งวดเงิน"
        title={`${milestones.length.toLocaleString("th-TH")} งวด`}
        status={
          <span className={balanced ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>
            {balanced
              ? "ยอดทุกงวดรวมเท่ามูลค่าสัญญา"
              : `ยังไม่ได้ผูกงาน ${formatPercent(schedule.unassignedWeightPpm)}%`}
          </span>
        }
      >
        <div className="takeoff-table-wrap">
          <table className="takeoff-table work-plan__table">
            <thead>
              <tr>
                <th>งวด</th>
                <th className="number-cell">งาน</th>
                <th className="number-cell">น้ำหนัก</th>
                <th className="number-cell">สะสมถึงงวดนี้</th>
                <th className="number-cell">หักสะสมงวดก่อน</th>
                <th className="number-cell">มูลค่างานงวดนี้</th>
                <th className="number-cell">หักประกัน</th>
                <th className="number-cell">หักคืนล่วงหน้า</th>
                <th className="number-cell">บวก VAT</th>
                <th className="number-cell">หัก ณ ที่จ่าย</th>
                <th className="number-cell">เงินรับจริง</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((row) => (
                <tr key={row.milestoneId}>
                  <td>{row.title}</td>
                  <td className="number-cell">{row.activityCount.toLocaleString("th-TH")}</td>
                  <td className="number-cell">{formatPercent(row.weightPpm)}%</td>
                  <td className="number-cell">{formatBaht(row.cumulativeWorkSatang)}</td>
                  <td className="number-cell">{signed(row.previousCumulativeSatang, "−")}</td>
                  <td className="number-cell">
                    <strong><LiveNumber>{formatBaht(row.periodWorkSatang)}</LiveNumber></strong>
                  </td>
                  <td className="number-cell">{signed(row.retentionSatang, "−")}</td>
                  <td className="number-cell">{signed(row.advanceRecoverySatang, "−")}</td>
                  <td className="number-cell">{signed(row.vatSatang, "+")}</td>
                  <td className="number-cell">{signed(row.withholdingSatang, "−")}</td>
                  <td className="number-cell">
                    <strong><LiveNumber>{formatBaht(row.netSatang)}</LiveNumber></strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>รวมทุกงวด</td>
                <td className="number-cell">
                  <strong>{formatBaht(schedule.totalWorkSatang)}</strong>
                </td>
                <td className="number-cell">{signed(schedule.totalRetentionSatang, "−")}</td>
                <td colSpan={3} />
                <td className="number-cell">
                  <strong>{formatBaht(schedule.totalNetSatang)}</strong>
                </td>
              </tr>
              <tr>
                <td colSpan={5}>มูลค่าสัญญา</td>
                <td className="number-cell">{formatBaht(contractSatang)}</td>
                <td colSpan={5}>
                  {balanced ? "ตรงกันทุกบาท" : "ยังไม่ตรง เพราะยังมีงานที่ไม่ได้ผูกเข้างวด"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <ActualsPanel
        rows={schedule.rows}
        actualById={actualById}
        statusById={statusById}
        onUpdateActual={onUpdateActual}
        dataDate={dataDate}
        deductionFindings={deductionFindings}
      />

      <Panel eyebrow="ผูกงานเข้างวด" title="งวดตัดด้วยงาน ไม่ใช่ด้วยเวลา">
        <p className="form-note">
          งวดงานราชการเขียนว่างานใดต้องแล้วเสร็จ ไม่ได้เขียนว่าครบกี่เปอร์เซ็นต์
          ย้ายงานเข้างวดที่ตรงกับสัญญา แล้วยอดเงินจะคำนวณตามให้เอง
        </p>
        <div className="takeoff-table-wrap">
          <table className="takeoff-table work-plan__table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>รายการงาน</th>
                <th className="number-cell">ค่างาน</th>
                <th>อยู่ในงวด</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.id}>
                  <td>{activity.number}</td>
                  <td>{activity.title}</td>
                  <td className="number-cell">{formatBaht(activity.costSatang)}</td>
                  <td>
                    <select
                      className="work-plan__cell"
                      value={milestoneOfActivity.get(activity.id) ?? ""}
                      onChange={(event) => onMove(activity.id, event.target.value)}
                    >
                      <option value="">ยังไม่ผูก</option>
                      {milestones.map((milestone) => (
                        <option key={milestone.id} value={milestone.id}>
                          {milestone.title}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="work-plan__row-actions">
          <button type="button" className="button button--ghost micro-button" onClick={onAdd}>
            เพิ่มงวด
          </button>
        </div>
      </Panel>
    </>
  );
}

const STAGE_LABEL: Record<MilestoneStage, string> = {
  planned: "ยังไม่ยื่น",
  requested: "ยื่นขอเบิกแล้ว",
  certified: "รับรองแล้ว",
  paid: "เงินเข้าแล้ว"
};

/**
 * บันทึกจริงต่องวด — สามยอด สามวัน
 *
 * รูปร่างของหน้าจอนี้ถอดมาจากของจริงที่ผู้รับเหมาไทยใช้ แล้วแก้จุดที่ของเขาสับสนเอง:
 *
 * หนึ่ง — **ทุกช่องเงินติดป้ายว่าเป็นยอดก่อนหักหรือยอดสุทธิ** ฟอร์มของเขาปนสองระดับในฟอร์มเดียว
 * จนข้อมูลตัวอย่างของเขาเองกรอกเป็นมูลค่างาน ขณะที่ปุ่มเติมอัตโนมัติของเขาเติมยอดสุทธิ
 *
 * สอง — **สถานะอนุมานจากข้อมูล ไม่ใช่ช่องให้เลือก** ของเขาเป็นช่องเลือกที่เพี้ยนได้เมื่อผู้ใช้
 * กรอกเงินเข้าแล้วลืมเปลี่ยนป้าย
 *
 * สาม — **เทียบยอดที่ควรได้กับเงินที่เข้าจริง แล้วทักเมื่อไม่ตรง** ของเขาเก็บตัวเลขครบทั้งสามยอด
 * แต่ไม่เคยเอามาเทียบกันเลยสักครั้ง
 */
function ActualsPanel({
  rows,
  actualById,
  statusById,
  onUpdateActual,
  dataDate,
  deductionFindings
}: {
  rows: ReturnType<typeof buildMilestoneSchedule>["rows"];
  actualById: Map<string, MilestoneActual>;
  statusById: Map<string, ReturnType<typeof milestoneStatuses>[number]>;
  onUpdateActual: (milestoneId: string, patch: Partial<MilestoneActual>) => void;
  dataDate: IsoDate;
  deductionFindings: ReturnType<typeof checkDeductions>;
}) {
  if (rows.length === 0) return null;

  const findingById = new Map(deductionFindings.map((entry) => [entry.milestoneId, entry]));

  /** แก้ยอดหรือวันของเหตุการณ์หนึ่ง โดยเก็บอีกช่องไว้เหมือนเดิม */
  const patchEvent = (
    milestoneId: string,
    key: "requested" | "certified" | "received",
    current: MoneyEvent | undefined,
    next: Partial<MoneyEvent>
  ) => {
    const merged: MoneyEvent = {
      satang: next.satang ?? current?.satang ?? 0n,
      date: next.date ?? current?.date ?? ""
    };
    onUpdateActual(milestoneId, { [key]: merged.satang === 0n && merged.date === "" ? undefined : merged });
  };

  const MoneyCell = ({
    milestoneId,
    field,
    event,
    hint
  }: {
    milestoneId: string;
    field: "requested" | "certified" | "received";
    event: MoneyEvent | undefined;
    hint: string;
  }) => {
    const future = event?.date !== undefined && event.date !== "" && daysBetween(event.date, dataDate) < 0;
    // คิดนอก JSX เพราะตัวตรวจ a11y พยายามคำนวณค่าของแอตทริบิวต์เอง แล้วพังเมื่อเจอ BigInt
    const bahtText = event && event.satang !== 0n ? (event.satang / 100n).toString() : "";
    return (
      <td className="number-cell">
        <input
          className="work-plan__cell work-plan__cell--number"
          inputMode="numeric"
          aria-label={hint}
          value={bahtText}
          placeholder="ยอดบาท"
          onChange={(changed) => {
            const digits = changed.target.value.replace(/[^\d]/g, "");
            patchEvent(milestoneId, field, event, { satang: digits === "" ? 0n : BigInt(digits) * 100n });
          }}
        />
        <ThaiDateField
          className={future ? "thai-date--future" : undefined}
          ariaLabel={`วันที่ของ${hint}`}
          value={event?.date ?? ""}
          onChange={(iso) => patchEvent(milestoneId, field, event, { date: iso })}
        />
      </td>
    );
  };

  return (
    <Panel
      eyebrow="บันทึกจริงต่องวด"
      title="สามยอด สามวัน — ยื่นขอเบิก · ที่ปรึกษารับรอง · เงินเข้าบัญชี"
      status={
        <span className="status-chip status-chip--ready">
          วันตัดข้อมูล {formatThaiDate(dataDate) ?? dataDate}
        </span>
      }
    >
      <p className="form-note">
        <strong>ยอดที่ขอเบิกและยอดที่รับรองเป็นมูลค่างานก่อนหัก</strong> เพราะกรรมการตรวจการจ้างรับรองเนื้องาน
        ไม่ได้รับรองยอดสุทธิ ส่วน <strong>เงินเข้าจริงเป็นยอดสุทธิที่เข้าบัญชี</strong> หลังหักทุกรายการแล้ว
        ระบบคำนวณยอดที่ควรได้จากยอดที่รับรองให้ แล้วเทียบกับเงินที่เข้าจริงเพื่อทักเมื่อถูกหักเกิน
      </p>

      {deductionFindings.length > 0 ? (
        <ul className="work-plan__findings">
          {deductionFindings.map((finding) => {
            const row = rows.find((entry) => entry.milestoneId === finding.milestoneId);
            const short = finding.shortfallSatang > 0n;
            return (
              <li key={finding.milestoneId} className="work-plan__finding work-plan__finding--high">
                <span className="work-plan__finding-tag">{short ? "ได้น้อยกว่าที่ควร" : "ได้เกินที่ควร"}</span>
                <div>
                  <strong>
                    {row?.title ?? finding.milestoneId} ต่างจากที่ควรได้{" "}
                    {formatBaht(finding.shortfallSatang < 0n ? -finding.shortfallSatang : finding.shortfallSatang)}
                  </strong>
                  <p>
                    จากยอดที่รับรอง ระบบคำนวณว่าควรได้ {formatBaht(finding.expectedNetSatang)} แต่เงินเข้าจริง{" "}
                    {formatBaht(finding.receivedSatang)} — ตรวจกับหนังสือแจ้งการหักของผู้ว่าจ้างก่อนรับ
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="takeoff-table-wrap">
        <table className="takeoff-table work-plan__table">
          <thead>
            <tr>
              <th>งวด</th>
              <th>สถานะ</th>
              <th className="number-cell">ยอดที่ขอเบิก (ก่อนหัก)</th>
              <th className="number-cell">ยอดที่รับรอง (ก่อนหัก)</th>
              <th className="number-cell">เงินเข้าจริง (สุทธิ)</th>
              <th className="number-cell">ควรได้จากยอดที่รับรอง</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const actual = actualById.get(row.milestoneId);
              const status = statusById.get(row.milestoneId);
              const stage = status?.stage ?? "planned";
              const expected = actual?.certified ? expectedNetForCertified(row, actual.certified.satang) : null;
              const finding = findingById.get(row.milestoneId);
              return (
                <tr key={row.milestoneId}>
                  <td>
                    {row.title}
                    <br />
                    <small className="form-note">มูลค่างานงวดนี้ {formatBaht(row.periodWorkSatang)}</small>
                  </td>
                  <td>
                    <span className={`status-chip ${stage === "paid" ? "status-chip--ready" : "status-chip--attention"}`}>
                      {STAGE_LABEL[stage]}
                    </span>
                    {status?.awaitingPaymentDays !== null && status?.awaitingPaymentDays !== undefined ? (
                      <>
                        <br />
                        <small className="form-note">รับรองแล้ว {status.awaitingPaymentDays.toLocaleString("th-TH")} วัน ยังไม่ได้เงิน</small>
                      </>
                    ) : null}
                  </td>
                  <MoneyCell milestoneId={row.milestoneId} field="requested" event={actual?.requested} hint={`ยอดที่ขอเบิกของ${row.title}`} />
                  <MoneyCell milestoneId={row.milestoneId} field="certified" event={actual?.certified} hint={`ยอดที่รับรองของ${row.title}`} />
                  <MoneyCell milestoneId={row.milestoneId} field="received" event={actual?.received} hint={`เงินเข้าจริงของ${row.title}`} />
                  <td className="number-cell">
                    {expected === null ? (
                      <small className="form-note">รอยอดที่รับรอง</small>
                    ) : (
                      <>
                        <LiveNumber>{formatBaht(expected)}</LiveNumber>
                        {finding ? (
                          <>
                            <br />
                            <small className="form-error">ต่าง {formatBaht(finding.shortfallSatang < 0n ? -finding.shortfallSatang : finding.shortfallSatang)}</small>
                          </>
                        ) : null}
                        {!actual?.received ? (
                          <>
                            <br />
                            <button
                              type="button"
                              className="button button--ghost micro-button"
                              onClick={() =>
                                patchEvent(row.milestoneId, "received", actual?.received, {
                                  satang: expected,
                                  date: actual?.received?.date || dataDate
                                })
                              }
                            >
                              เติมยอดนี้เป็นเงินเข้า
                            </button>
                          </>
                        ) : null}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

type Series = {
  id: "plan" | "cash" | "certified" | "requested";
  label: string;
  /**
   * เส้นโค้งทั้งหมดตามมติของเจ้าของงานเมื่อ 2026-08-26 (เดิมเส้นเงินเป็นขั้นบันได)
   *
   * เงื่อนไขที่ตามมาและห้ามละเลย: พอเป็นเส้นโค้ง รูปทรงจะไม่บอกอีกต่อไปว่าเงินเข้าเป็นก้อนกี่ครั้ง
   * **จึงต้องมีหมุดจุดที่ทุกเหตุการณ์เงินเสมอ** เพราะหมุดคือสิ่งเดียวที่เหลืออยู่ซึ่งบอกว่า
   * ค่าระหว่างสองหมุดเป็นการลากเส้นเชื่อม ไม่ใช่เงินที่ไหลเข้าทุกวัน
   */
  shape: "curve" | "step";
  points: { period: number; satang: bigint }[];
};

/**
 * เส้นความก้าวหน้าสะสม
 *
 * เขียนใหม่หลังเข้าไปดูเครื่องมือที่ผู้รับเหมาไทยใช้จริง สิ่งที่ยกมาไม่ใช่ความสวย แต่เป็นสามข้อที่
 * เปลี่ยนความหมายของกราฟ: **เส้นเงินต้องเป็นขั้นบันได** เพราะเงินเข้าเป็นก้อนเมื่อวางบิลผ่าน
 * ไม่ได้ไหลต่อเนื่องเหมือนเนื้องาน · **แกนตั้งเป็นบาท** เพราะผู้รับเหมาคิดเป็นเงินไม่ใช่เปอร์เซ็นต์ ·
 * และ **ช่องว่างระหว่างเส้นงานกับเส้นเงินคือเงินที่ทำไปแล้วแต่ยังไม่ได้รับ** ซึ่งเป็นสิ่งที่
 * ผู้รับเหมาต้องดูทุกเดือนและกราฟเส้นเดียวบอกไม่ได้เลย
 *
 * หมุดงวดใช้เลขในวงกลมแทนชื่อเต็ม เพราะรอบก่อนพิมพ์ชื่องวดลงบนกราฟแล้วมันทับกันจนอ่านไม่ออก
 * ชื่อเต็มย้ายไปอยู่ใต้กราฟเป็นรายการที่อ่านได้จริง
 */
function CurveTab({
  curve,
  schedule,
  contractSatang,
  startDate,
  actualSeries,
  position,
  dataDate,
  dataDateOverride,
  onDataDate,
  hiddenEvents,
  todayIso
}: {
  curve: ReturnType<typeof buildPlanCurve>;
  schedule: ReturnType<typeof buildMilestoneSchedule>;
  contractSatang: bigint;
  startDate: string;
  actualSeries: ReturnType<typeof buildActualSeries>;
  position: ReturnType<typeof cashPosition>;
  dataDate: IsoDate;
  dataDateOverride: IsoDate | "";
  onDataDate: (value: IsoDate | "") => void;
  hiddenEvents: number;
  todayIso: string;
}) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [grouping, setGrouping] = useState<"half" | "month">("half");

  if (curve.rows.length === 0) {
    return (
      <Panel eyebrow="เส้นความก้าวหน้าสะสม" title="ยังไม่มีแผนให้วาด">
        <p className="form-note">ร่างแผนหรือเพิ่มรายการงานก่อน แล้วเส้นสะสมจะขึ้นเอง</p>
      </Panel>
    );
  }

  /**
   * วางเหตุการณ์จริงลงแกนเวลาด้วย **วันที่ของเหตุการณ์นั้น** ไม่ใช่ด้วยลำดับงวด
   *
   * รอบก่อนใช้ตำแหน่งจากน้ำหนักงานสะสม ซึ่งเป็นการเดาจากแผน ไม่ใช่ของจริง
   * เส้นเงินจึงไปโผล่ผิดเดือนเสมอเมื่อการเบิกจริงเร็วหรือช้ากว่าแผน
   */
  /** ตำแหน่งของหมุดงวดบนเส้นแผน — งวดเป็นของแผน จึงวางด้วยน้ำหนักงานสะสม ไม่ใช่ด้วยวันจริง */
  const periodOf = (weightPpm: bigint) => {
    const found = curve.cumulativePpm.findIndex((ppm) => ppm >= weightPpm);
    return Math.min(curve.periodCount - 1, found < 0 ? curve.periodCount - 1 : found);
  };

  const periodOfDate = (date: IsoDate) => {
    if (!startDate || !date) return 0;
    const offset = daysBetween(startDate, date);
    return Math.max(0, Math.min(curve.periodCount - 1, Math.floor(offset / PERIOD_DAYS)));
  };

  /**
   * ยึดเส้นเงินไว้ที่ศูนย์ตรงวันเริ่มสัญญาเสมอ
   *
   * เพราะยอดสะสมย่อมเริ่มจากศูนย์จริง ๆ และถ้าไม่ยึด งวดแรกที่มีเหตุการณ์เดียวจะได้จุดเดียว
   * ซึ่งวาดเป็นเส้นไม่ได้เลย ผู้ใช้จึงเห็นแค่จุดลอย ๆ โดยไม่รู้ว่าเส้นนั้นมีอยู่ (เจอตอนทดสอบจริง)
   */
  const pointsFrom = (points: ReturnType<typeof buildActualSeries>["requested"]) => {
    const mapped = points.map((point) => ({ period: periodOfDate(point.date), satang: point.cumulativeSatang }));
    if (mapped.length === 0) return mapped;
    return mapped[0]!.period === 0 ? mapped : [{ period: 0, satang: 0n }, ...mapped];
  };

  /** ช่วงที่วันตัดข้อมูลตกอยู่ — ทุกอย่างหลังจากนี้คืออนาคต ไม่ใช่ข้อมูล */
  const dataDatePeriod = periodOfDate(dataDate);

  const series: Series[] = [
    {
      id: "plan",
      label: "มูลค่างานสะสมตามแผน",
      shape: "curve",
      points: curve.cumulativePpm.map((ppm, period) => ({ period, satang: (contractSatang * ppm) / WEIGHT_SCALE }))
    },
    { id: "requested", label: "ยอดที่ขอเบิกสะสม", shape: "curve", points: pointsFrom(actualSeries.requested) },
    { id: "certified", label: "มูลค่างานที่รับรองสะสม", shape: "curve", points: pointsFrom(actualSeries.certified) },
    { id: "cash", label: "เงินรับจริงสะสม", shape: "curve", points: pointsFrom(actualSeries.received) }
  ];

  const visible = series.filter((entry) => !hidden.has(entry.id));
  const ceiling = visible.reduce(
    (top, entry) => entry.points.reduce((inner, point) => (point.satang > inner ? point.satang : inner), top),
    contractSatang > 0n ? contractSatang : 1n
  );

  const width = 980;
  const height = 380;
  const padLeft = 78;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 40;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const x = (period: number) => padLeft + (plotWidth * period) / Math.max(curve.periodCount - 1, 1);
  const y = (satang: bigint) => padTop + plotHeight - (plotHeight * Number(satang)) / Number(ceiling);

  const pathOf = (entry: Series) => {
    if (entry.points.length === 0) return "";
    if (entry.shape === "curve") {
      return entry.points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.period)},${y(point.satang)}`).join(" ");
    }
    const first = entry.points[0]!;
    let path = `M${x(0)},${y(0n)} L${x(first.period)},${y(0n)} L${x(first.period)},${y(first.satang)}`;
    for (let index = 1; index < entry.points.length; index += 1) {
      const point = entry.points[index]!;
      path += ` L${x(point.period)},${y(entry.points[index - 1]!.satang)} L${x(point.period)},${y(point.satang)}`;
    }
    return path;
  };

  const planSeries = series[0]!;
  const certifiedSeries = series[2]!;
  const cashSeries = series[3]!;
  /** ยอดที่ทำแล้วยังไม่ได้รับ ติดลบไม่ได้ในความเป็นจริง */
  const clampZero = (satang: bigint) => (satang < 0n ? 0n : satang);

  /**
   * เดือนปฏิทินไทยย่อของช่วงที่ระบุ เช่น "ต.ค. 69" คิดจากวันเริ่มสัญญาบวกจำนวนวันของช่วงนั้น
   * ถอดวันที่ทิ้ง เหลือแค่เดือนกับปีสองหลัก เพื่อให้แกนเวลาอ่านเป็นปฏิทินจริง ไม่ใช่รหัสช่วง
   * คืน null เมื่อยังไม่กรอกวันเริ่มสัญญา ให้ผู้เรียกถอยไปใช้ป้ายรหัสช่วงแทน
   */
  const calendarMonth = (period: number): string | null => {
    const full = formatThaiDate(addDays(startDate, period * PERIOD_DAYS));
    if (!full) return null;
    const parts = full.split(" ");
    if (parts.length < 3) return full;
    return `${parts[parts.length - 2]} ${parts[parts.length - 1]!.slice(-2)}`;
  };
  /** ป้ายเวลาของช่วง: ใช้เดือนปฏิทินเมื่อมีวันเริ่มสัญญา ไม่งั้นถอยไปรหัสช่วงเดิม */
  const timeLabel = (period: number) => calendarMonth(period) ?? periodLabel(period);

  const toggle = (id: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** ค่าล่าสุดที่เส้นนั้นไปถึง ณ ช่วงที่ชี้ — เส้นขั้นบันไดต้องอ่านค่าเดิมค้างไว้จนกว่าจะมีขั้นใหม่ */
  const valueAt = (entry: Series, period: number) => {
    const passed = entry.points.filter((point) => point.period <= period);
    return passed.length === 0 ? 0n : passed[passed.length - 1]!.satang;
  };

  /**
   * ไม่ชี้อะไรอยู่ ให้อ่านค่าที่วันตัดข้อมูล ไม่ใช่ช่วงสุดท้ายของโครงการ
   * เพราะช่วงสุดท้ายเป็นแผนล้วน ส่วนวันตัดข้อมูลคือจุดที่ของจริงกับแผนมาบรรจบกัน
   * ซึ่งเป็นตัวเลขที่ผู้ใช้เปิดหน้านี้มาเพื่อดู
   */
  const readPeriod = hover ?? dataDatePeriod;

  /**
   * ขั้นของแกนตั้งเป็นเลขกลมเสมอ เช่นทีละหนึ่งล้านหรือสองล้าน
   * ขั้นที่หารจากค่าสูงสุดตรง ๆ ให้เลขอย่าง 8,032,500 ซึ่งตาอ่านแล้วต้องหยุดคิด
   */
  const niceStep = (() => {
    const target = Number(ceiling / 100n) / 7;
    const power = 10 ** Math.floor(Math.log10(Math.max(target, 1)));
    const unit = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= target) ?? 10;
    return BigInt(Math.round(unit * power)) * 100n;
  })();
  const gridValues: bigint[] = [];
  for (let value = 0n; value <= ceiling; value += niceStep) gridValues.push(value);

  /** เขียนบาทเต็มจำนวน ไม่ย่อเป็น "ล." เพราะผู้รับเหมาอ่านยอดจริงเทียบกับสัญญา ไม่ได้อ่านสเกล */
  const axisLabel = (satang: bigint) => {
    const baht = satang / 100n;
    return baht === 0n ? "0" : baht.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  /**
   * คอลัมน์ของตารางกระจายน้ำหนัก โหมด "รายเดือน" ยุบสองช่วงครึ่งเดือนเป็นหนึ่งเดือนจริง:
   * ผลงานรายช่วงบวกกันสองช่วง ส่วนผลงานสะสมใช้ค่าท้ายเดือน ไม่ใช่บวกซ้ำ
   * แต่ละคอลัมน์จำช่วงที่มันครอบไว้ เพื่อให้ hover บนกราฟไฮไลต์คอลัมน์ที่ตรงกันได้
   */
  type SpreadColumn = { key: string; label: string; perPeriodPpm: bigint; cumulativePpm: bigint; periods: number[] };
  const spreadColumns: SpreadColumn[] =
    grouping === "month"
      ? Array.from({ length: Math.ceil(curve.periodCount / 2) }, (_unused, month) => {
          const first = month * 2;
          const periods = first + 1 < curve.periodCount ? [first, first + 1] : [first];
          const last = periods[periods.length - 1]!;
          return {
            key: `m${month}`,
            label: timeLabel(first),
            perPeriodPpm: periods.reduce((sum, period) => sum + curve.perPeriodPpm[period]!, 0n),
            cumulativePpm: curve.cumulativePpm[last]!,
            periods
          };
        })
      : curve.perPeriodPpm.map((ppm, period) => ({
          key: `p${period}`,
          label: timeLabel(period),
          perPeriodPpm: ppm,
          cumulativePpm: curve.cumulativePpm[period]!,
          periods: [period]
        }));

  /** คอลัมน์ที่ครอบช่วงที่กำลัง hover บนกราฟ ให้สว่างขึ้น กราฟกับตารางจะได้เป็นเครื่องมือชิ้นเดียวกัน */
  const colClass = (column: SpreadColumn) =>
    hover !== null && column.periods.includes(hover) ? "number-cell work-plan__period-col--active" : "number-cell";

  return (
    <>
      <Panel
        eyebrow="เส้นความก้าวหน้าสะสม"
        title="แผนงานเทียบเงินที่เบิกได้จริง (บาท)"
        status={<span className="status-chip status-chip--ready">{curve.periodCount} ช่วงครึ่งเดือน</span>}
      >
        <div className="work-plan__legend">
          <div className="work-plan__view" role="group" aria-label="มุมมองแกนเวลา">
            <button type="button" className={grouping === "half" ? "is-on" : undefined} onClick={() => setGrouping("half")} aria-pressed={grouping === "half"}>
              ครึ่งเดือน
            </button>
            <button type="button" className={grouping === "month" ? "is-on" : undefined} onClick={() => setGrouping("month")} aria-pressed={grouping === "month"}>
              รายเดือน
            </button>
          </div>
          {series.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`work-plan__chip work-plan__chip--${entry.id}${hidden.has(entry.id) ? " is-off" : ""}`}
              onClick={() => toggle(entry.id)}
              aria-pressed={!hidden.has(entry.id)}
            >
              <span className="work-plan__chip-swatch" />
              {entry.label}
            </button>
          ))}
        </div>

        <div className="work-plan__datadate">
          <label htmlFor="work-plan-data-date">
            วันตัดข้อมูล
            <ThaiDateField
              id="work-plan-data-date"
              value={dataDate}
              max={todayIso}
              onChange={(iso) => onDataDate(iso)}
              ariaLabel="วันตัดข้อมูล"
            />
          </label>
          <p className="form-note">
            เส้นข้อมูลจริงหยุดที่วันนี้ ไม่ลากต่อเป็นแผน — งวดที่เงินเข้าหลังวันตัดข้อมูลจะยังไม่ขึ้นบนเส้นเงินรับจริง
            แม้ยอดขอเบิกของงวดเดียวกันจะขึ้นไปแล้วก็ตาม
            {dataDateOverride === "" ? " ตอนนี้ใช้วันล่าสุดที่มีบันทึกให้อัตโนมัติ" : null}
          </p>
          {dataDateOverride !== "" ? (
            <button type="button" className="button button--ghost micro-button" onClick={() => onDataDate("")}>
              กลับไปใช้วันล่าสุดที่มีบันทึก
            </button>
          ) : null}
        </div>

        <dl className="work-plan__readout">
          <div>
            <dt>ยื่นขอเบิกแล้ว (ก่อนหัก)</dt>
            <dd><LiveNumber>{formatBaht(position.requestedSatang)}</LiveNumber></dd>
          </div>
          <div>
            <dt>รับรองแล้ว (ก่อนหัก)</dt>
            <dd><LiveNumber>{formatBaht(position.certifiedSatang)}</LiveNumber></dd>
          </div>
          <div>
            <dt>เงินเข้าบัญชีแล้ว (สุทธิ)</dt>
            <dd><LiveNumber>{formatBaht(position.receivedSatang)}</LiveNumber></dd>
          </div>
          <div>
            <dt>ทำแล้วยังไม่ได้รับ</dt>
            <dd><LiveNumber>{formatBaht(clampZero(position.certifiedNotPaidSatang))}</LiveNumber></dd>
          </div>
          <div>
            <dt>ยื่นแล้วยังไม่มีใครรับรอง</dt>
            <dd><LiveNumber>{formatBaht(clampZero(position.requestedNotCertifiedSatang))}</LiveNumber></dd>
          </div>
        </dl>

        <p className="form-note work-plan__chart-note">
          หมุดบนเส้นเงินคือเหตุการณ์จริงแต่ละครั้ง เส้นระหว่างหมุดเป็นการลากเชื่อม ไม่ใช่เงินที่ไหลเข้าทุกวัน
          ระยะห่างระหว่างเส้นรับรองกับเส้นเงินเข้าคือเงินที่ทำงานไปแล้วแต่ยังไม่ได้รับ
        </p>

        {hiddenEvents > 0 ? (
          <p className="work-plan__sim-note">
            ซ่อน {hiddenEvents.toLocaleString("th-TH")} บันทึกที่ลงวันที่หลังวันตัดข้อมูล
            ข้อมูลยังอยู่ครบ เลื่อนวันตัดข้อมูลไปข้างหน้าแล้วจะเห็น
          </p>
        ) : null}

        <div className="work-plan__chart-wrap">
          <svg
            className="work-plan__chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="มูลค่างานสะสมตามแผน เทียบกับเงินรับจริงสะสม"
            onPointerLeave={() => setHover(null)}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const inside = ((event.clientX - box.left) / box.width) * width;
              const period = Math.round(((inside - padLeft) / plotWidth) * Math.max(curve.periodCount - 1, 1));
              setHover(Math.max(0, Math.min(curve.periodCount - 1, period)));
            }}
          >
            {gridValues.map((value) => {
              const ty = y(value);
              return (
                <g key={value.toString()}>
                  <line className="work-plan__grid" x1={padLeft} y1={ty} x2={width - padRight} y2={ty} />
                  <text className="work-plan__axis" x={padLeft - 10} y={ty + 4} textAnchor="end">
                    {axisLabel(value)}
                  </text>
                </g>
              );
            })}

            {curve.cumulativePpm.map((_unused, period) => {
              const month = calendarMonth(period);
              const show = month ? period === 0 || month !== calendarMonth(period - 1) : period % 2 === 0;
              return show ? (
                <text key={period} className="work-plan__axis" x={x(period)} y={height - 14} textAnchor="middle">
                  {month ?? periodLabel(period)}
                </text>
              ) : null;
            })}

            {/* แถบอนาคตหลังวันตัดข้อมูล เห็นทันทีว่าตรงไหนคือของจริง ตรงไหนคือแผน */}
            {dataDatePeriod < curve.periodCount - 1 ? (
              <>
                <rect
                  className="work-plan__future"
                  x={x(dataDatePeriod)}
                  y={padTop}
                  width={x(curve.periodCount - 1) - x(dataDatePeriod)}
                  height={plotHeight}
                />
                <line className="work-plan__datadate-line" x1={x(dataDatePeriod)} y1={padTop} x2={x(dataDatePeriod)} y2={padTop + plotHeight} />
                <text className="work-plan__datadate-tag" x={x(dataDatePeriod)} y={padTop - 5} textAnchor="middle">
                  วันตัดข้อมูล
                </text>
              </>
            ) : null}

            {visible.map((entry) => (
              <path key={entry.id} className={`work-plan__line work-plan__line--${entry.id}`} d={pathOf(entry)} />
            ))}

            {/* หมุดเหตุการณ์เงิน — สิ่งเดียวที่บอกว่าเงินเข้าเป็นก้อนกี่ครั้ง หลังเปลี่ยนเส้นเป็นเส้นโค้ง */}
            {visible
              .filter((entry) => entry.id !== "plan")
              .flatMap((entry) =>
                entry.points.map((point) => (
                  <circle
                    key={`${entry.id}-${point.period}-${point.satang}`}
                    className={`work-plan__event work-plan__event--${entry.id}`}
                    cx={x(point.period)}
                    cy={y(point.satang)}
                    r={4}
                  />
                ))
              )}

            {hidden.has("plan")
              ? null
              : planSeries.points
                  .filter((point) => grouping === "half" || point.period % 2 === 1 || point.period === curve.periodCount - 1)
                  .map((point) => (
                    <circle key={point.period} className="work-plan__point" cx={x(point.period)} cy={y(point.satang)} r={2.4} />
                  ))}

            {schedule.rows.map((row, index) => {
              const period = periodOf(row.cumulativeWeightPpm);
              const top = y((contractSatang * row.cumulativeWeightPpm) / WEIGHT_SCALE);
              return (
                <g key={row.milestoneId}>
                  <circle className="work-plan__marker-dot" cx={x(period)} cy={top} r={6.5} />
                  <text className="work-plan__marker-number" x={x(period)} y={top + 2.5} textAnchor="middle">
                    {index + 1}
                  </text>
                </g>
              );
            })}

            {hover === null ? null : (
              <g>
                <line className="work-plan__hover-line" x1={x(hover)} y1={padTop} x2={x(hover)} y2={padTop + plotHeight} />
                {visible.map((entry) => (
                  <circle key={entry.id} className={`work-plan__hover-dot work-plan__hover-dot--${entry.id}`} cx={x(hover)} cy={y(valueAt(entry, hover))} r={4.5} />
                ))}
              </g>
            )}
          </svg>

        </div>

        <dl className="work-plan__readbar">
          <div>
            <dt>ช่วงเวลา</dt>
            <dd>{timeLabel(readPeriod)}{hover === null ? " (ณ วันตัดข้อมูล)" : ""}</dd>
          </div>
          {visible.map((entry) => (
            <div key={entry.id}>
              <dt>{entry.label}</dt>
              <dd>{formatBaht(valueAt(entry, readPeriod))}</dd>
            </div>
          ))}
          {hidden.has("certified") || hidden.has("cash") ? null : (
            <div className="work-plan__readbar-gap">
              <dt>ทำแล้วยังไม่ได้รับ</dt>
              <dd>{formatBaht(clampZero(valueAt(certifiedSeries, readPeriod) - valueAt(cashSeries, readPeriod)))}</dd>
            </div>
          )}
          {hidden.has("plan") || hidden.has("certified") ? null : (
            <div className="work-plan__readbar-gap">
              <dt>งานตามแผนที่ยังไม่ได้รับรอง</dt>
              <dd>{formatBaht(clampZero(valueAt(planSeries, readPeriod) - valueAt(certifiedSeries, readPeriod)))}</dd>
            </div>
          )}
        </dl>

        <ol className="work-plan__marker-key">
          {schedule.rows.map((row, index) => (
            <li key={row.milestoneId}>
              <span className="work-plan__marker-badge">{index + 1}</span>
              <span>{row.title}</span>
              <em>{formatPercent(row.cumulativeWeightPpm)}%</em>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel eyebrow="ตารางกระจายน้ำหนัก" title="ผลงานรายช่วงและสะสม">
        <div className="takeoff-table-wrap">
          <table className="takeoff-table work-plan__table work-plan__table--periods">
            <thead>
              <tr>
                <th>รายการ</th>
                {spreadColumns.map((column) => (
                  <th key={column.key} className={colClass(column)}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ผลงานรายช่วง</td>
                {spreadColumns.map((column) => (
                  <td key={column.key} className={colClass(column)}>
                    {column.perPeriodPpm === 0n ? "—" : `${formatPercent(column.perPeriodPpm)}%`}
                  </td>
                ))}
              </tr>
              <tr>
                <td>
                  <strong>ผลงานสะสม</strong>
                </td>
                {spreadColumns.map((column) => (
                  <td key={column.key} className={colClass(column)}>
                    <strong><LiveNumber>{`${formatPercent(column.cumulativePpm)}%`}</LiveNumber></strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="form-note">
          ช่องสุดท้ายต้องได้ 100.00% พอดี ไม่ใช่ 99.99% — คิดด้วยจำนวนเต็มตลอด
          และปัดเฉพาะตอนแสดงผล ตามที่ตรวจไว้กับตัวอย่างในหนังสือ
        </p>
      </Panel>
    </>
  );
}
