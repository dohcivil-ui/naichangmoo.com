"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
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
import { askWorkPlanAssistant, reviewWorkPlan, type AssistantResult, type ReviewFinding } from "@/server/actions/work-plan-assistant";
import { WorkPlanDocument } from "@/components/prototype/work-plan-document";

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

export function WorkPlanWorkspace() {
  const [tab, setTab] = useState<TabId>(1);
  const [setup, setSetup] = useState<SetupState>(initialSetup);
  const [activities, setActivities] = useState<PlanActivity[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
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

  const weights = useMemo(() => activityWeights(activities), [activities]);
  const curve = useMemo(
    () => buildPlanCurve(activities, durationValid ? durationDays : 1),
    [activities, durationDays, durationValid]
  );
  const schedule = useMemo(
    () => buildMilestoneSchedule(weights, milestones, terms),
    [weights, milestones, terms]
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
          หน้านี้เป็นต้นแบบสำหรับตัดสินใจ ยังไม่บันทึกข้อมูล รีโหลดแล้วข้อมูลจะหาย
        </p>

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
          />
        ) : null}

        {tab === 4 ? (
          <CurveTab curve={curve} schedule={schedule} contractSatang={contractSatang} startDate={setup.startDate} />
        ) : null}
      </div>

      {showDocument ? (
        <WorkPlanDocument
          projectName={setup.projectName}
          siteName={setup.projectName}
          agencyName=""
          schedule={schedule}
          activityTitlesByMilestone={activityTitlesByMilestone}
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
  onDraft
}: {
  setup: SetupState;
  setSetup: (updater: (current: SetupState) => SetupState) => void;
  contractSatang: bigint;
  contractInvalid: boolean;
  durationValid: boolean;
  durationDays: number;
  canDraft: boolean;
  onDraft: () => void;
}) {
  const set = <K extends keyof SetupState>(key: K, value: SetupState[K]) =>
    setSetup((current) => ({ ...current, [key]: value }));

  const source = templateSource(setup.templateId);
  const finishDate = durationValid ? addDays(setup.startDate, durationDays) : null;

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
            <input type="date" value={setup.startDate} onChange={(event) => set("startDate", event.target.value)} />
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
              <th className="number-cell">ระยะเวลา (วัน)</th>
              <th className="number-cell">ค่างาน (บาท)</th>
              <th className="number-cell">น้ำหนัก</th>
              <th>ที่มา</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
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
                  <em className="quantity-note">{formatThaiDate(addDays(startDate, activity.startOffsetDays)) ?? "ยังไม่ตั้งวันเริ่ม"}</em>
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
            ))}
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
  onPrint
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

type Series = {
  id: "plan" | "cash" | "certified";
  label: string;
  /** ขั้นบันไดใช้กับเงิน เพราะเงินเข้าเป็นก้อนตามงวด ไม่ได้ไหลต่อเนื่องเหมือนเนื้องาน */
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
  startDate
}: {
  curve: ReturnType<typeof buildPlanCurve>;
  schedule: ReturnType<typeof buildMilestoneSchedule>;
  contractSatang: bigint;
  startDate: string;
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

  const periodOf = (weightPpm: bigint) => {
    const found = curve.cumulativePpm.findIndex((ppm) => ppm >= weightPpm);
    return Math.min(curve.periodCount - 1, found < 0 ? curve.periodCount - 1 : found);
  };

  const runningTotals = (pick: (row: (typeof schedule.rows)[number]) => bigint) => {
    let running = 0n;
    return schedule.rows.map((row) => {
      running += pick(row);
      return { period: periodOf(row.cumulativeWeightPpm), satang: running };
    });
  };

  const series: Series[] = [
    {
      id: "plan",
      label: "มูลค่างานสะสมตามแผน",
      shape: "curve",
      points: curve.cumulativePpm.map((ppm, period) => ({ period, satang: (contractSatang * ppm) / WEIGHT_SCALE }))
    },
    { id: "certified", label: "มูลค่างานที่ตรวจรับสะสม", shape: "step", points: runningTotals((row) => row.periodWorkSatang) },
    { id: "cash", label: "เงินรับจริงสะสม", shape: "step", points: runningTotals((row) => row.netSatang) }
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
  const certifiedSeries = series[1]!;
  /** ต้นแบบยังไม่มีบันทึกหน้างาน งวดท้ายจึงตรวจรับครบก่อนแผน ค่าติดลบเล็กน้อยจากตรงนั้นไม่ใช่หนี้ */
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

  const readPeriod = hover ?? curve.periodCount - 1;

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

        <p className="form-note work-plan__chart-note">
          เส้นเงินหักเป็นขั้น เพราะเงินเข้าเป็นก้อนเมื่อวางบิลผ่าน ไม่ได้ไหลต่อเนื่องเหมือนเนื้องาน
          ระยะห่างระหว่างเส้นบนกับเส้นล่างคือเงินที่ทำงานไปแล้วแต่ยังไม่ได้รับ
        </p>

        <p className="work-plan__sim-note">
          เส้น &ldquo;มูลค่างานที่ตรวจรับสะสม&rdquo; และ &ldquo;เงินรับจริงสะสม&rdquo; ตอนนี้จำลองตามแผน
          ยังไม่ใช่ข้อมูลที่บันทึกจากหน้างานจริง
        </p>

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

            {visible.map((entry) => (
              <path key={entry.id} className={`work-plan__line work-plan__line--${entry.id}`} d={pathOf(entry)} />
            ))}

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
            <dd>{timeLabel(readPeriod)}{hover === null ? " (ช่วงสุดท้าย)" : ""}</dd>
          </div>
          {visible.map((entry) => (
            <div key={entry.id}>
              <dt>{entry.label}</dt>
              <dd>{formatBaht(valueAt(entry, readPeriod))}</dd>
            </div>
          ))}
          {hidden.has("plan") || hidden.has("certified") ? null : (
            <div className="work-plan__readbar-gap">
              <dt>งานตามแผนที่ยังไม่ได้ตรวจรับ</dt>
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
