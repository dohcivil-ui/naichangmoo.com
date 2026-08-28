"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import {
  ASSISTANT_DOCK_STORAGE_KEY,
  parseDockState,
  toggleDockState,
  type AssistantDockState
} from "@/lib/assistant-dock-state";

/**
 * Assistant Dock (แผงผู้ช่วยกลาง) — IP-185
 *
 * แผงผู้ช่วยกลางมีช่องเดียวใน AppShell ไม่ใช่เจ็ดช่องเจ็ดแบบ (บทเรียน gl-platbar ใน
 * ai-assistant-design.md ข้อ 5) — แอปเสียบเนื้อหาผู้ช่วยของตัวเองผ่าน <AppAssistant>
 * ตัวเดียว แผงกลางจงใจ "โง่": กรอบ ตำแหน่ง ย่อ/กาง ป้ายสถานะ เท่านั้น ไม่รู้จักชื่อแอป
 * ไม่แตะฝั่งเซิร์ฟเวอร์ กฎ ADR 0019 (ผู้ช่วยเสนอ คนตัดสิน) เป็นเรื่องของเนื้อหาที่แอปเสียบ
 *
 * คำเคาะเจ้าของงาน 2026-08-28: เดสก์ท็อปแผงตรึงริมขวาเต็มความสูง **ดันเนื้องานหลบ ไม่บัง**
 * มือถือเป็นแผ่นเลื่อนจากขอบล่าง · เริ่มแบบกาง (Default State: Expanded — คำชี้ขาด 2026-08-28
 * ให้คนเห็นทันทีว่ามีผู้ช่วยอะไรให้ใช้) แล้วจำที่ผู้ใช้เลือกต่อเครื่องคีย์เดียวทั้งแพลตฟอร์ม
 * (Global preference) · หน้าที่ไม่มีผู้ช่วยต้องไม่มี DOM ของแผงเลยแม้แต่ปุ่ม
 */

export type AssistantDockMeta = {
  /** ชื่อหัวแผง เช่น "ผู้ช่วยวางแผน" */
  title: string;
  /** ป้ายสถานะมุมหัวแผง — แอปเป็นคนกำหนดคำ */
  status?: { label: string; tone: "ready" | "attention" };
  /** true = กำลังคิด (aria-busy + ขอบเน้น — นิ่งสนิทใต้ prefers-reduced-motion) */
  busy?: boolean;
};

type DockRegistry = {
  register: (id: number, meta: AssistantDockMeta) => void;
  update: (id: number, meta: AssistantDockMeta) => void;
  unregister: (id: number) => void;
  bodyEl: HTMLDivElement | null;
};

const DockContext = createContext<DockRegistry | null>(null);

/** ยิงบนแท็บที่เขียนเอง เพราะ storage event ไปถึงเฉพาะแท็บอื่น (แบบแผนเดียวกับ cookie-notice) */
const DOCK_CHANGED = "naichangmoo:assistant-dock-changed";

function subscribeDockState(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DOCK_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DOCK_CHANGED, onChange);
  };
}

function readDockSnapshot(): string {
  try {
    return window.localStorage.getItem(ASSISTANT_DOCK_STORAGE_KEY) ?? "";
  } catch {
    // หน้าต่างส่วนตัว/บล็อกข้อมูลไซต์ โยน error จริง — ถือเป็นค่าเริ่มต้น
    return "";
  }
}

function writeDockState(state: AssistantDockState) {
  try {
    window.localStorage.setItem(ASSISTANT_DOCK_STORAGE_KEY, state);
  } catch {
    // เขียนไม่ได้ก็แค่ไม่จำข้ามหน้า — สถานะในหน้านี้ยังเปลี่ยนผ่าน event ตามปกติ
  }
  window.dispatchEvent(new Event(DOCK_CHANGED));
}

let nextRegistrationId = 1;

/**
 * ระยะที่แผงหยุดเหนือท้ายเว็บ — เท่ากับอากาศที่เนื้อหาฝั่งซ้ายเว้นไว้ก่อนถึงท้ายเว็บ
 *
 * วัดของจริง 2026-08-28: การ์ดสุดท้ายในหน้า work-plan จบที่ 369 ท้ายเว็บเริ่มที่ 465
 * ช่องว่างตรงกลาง 96px มาจาก padding-bottom 80px ของ section บวกระยะท้าย container
 * แผงจบที่ระดับเดียวกันจึงอ่านเป็นสองคอลัมน์ที่จบพร้อมกัน ไม่ใช่แผงยาวลงไปทับท้ายเว็บ
 * เจ้าของงานเคาะให้เสมอกับการ์ดสุดท้ายฝั่งซ้าย 2026-08-28
 */
const FOOTER_GAP = 96;

/**
 * เปลือกที่ AppShell ใช้ห่อเนื้อหา — เมื่อไม่มีแอปไหนลงทะเบียนผู้ช่วย จะเป็นแค่ div เปล่า
 * ไม่มี DOM ของแผงเลย (ของที่ไม่มีจริงไม่ขึ้น) เมื่อมีการลงทะเบียนและผู้ใช้กางแผง
 * เนื้อหาถูกดันหลบด้วย padding ผ่านคลาส --pushed ไม่ใช่ถูกบัง
 */
export function AssistantDockHost({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<{ id: number; meta: AssistantDockMeta }[]>([]);
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  const bodyRef = useCallback((node: HTMLDivElement | null) => setBodyEl(node), []);

  const storedState = useSyncExternalStore(subscribeDockState, readDockSnapshot, () => "");
  const dockState: AssistantDockState = parseDockState(storedState || null);

  /**
   * แผงตรึงเต็มความสูงต้องเริ่มใต้แถบนำทาง ซึ่งความสูงไม่คงที่ — จอแคบเมนูห่อหลายแถว
   * (วัดจริง: เดสก์ท็อป 85px มือถือ 206px) ค่าคงที่เดาผิดเสมอ วัดของจริงแบบ gl-floatbar
   */
  const [navHeight, setNavHeight] = useState(84);
  const active = entries.length > 0 ? entries[entries.length - 1] : null;
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const nav = document.querySelector(".site-nav");
      setNavHeight(nav ? Math.round(nav.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  /**
   * แผงตรึงต้องจบเหนือท้ายเว็บ ไม่ใช่ยาวลงไปทับ — ท้ายเว็บอยู่นอกกรอบที่แผงดัน จึงกว้างเต็มจอ
   * ตำแหน่งบนสุดของมันเลื่อนตลอดเวลาที่คนเลื่อนจอ ค่าคงที่ตอบไม่ได้ ต้องวัดของจริงเหมือน navHeight
   *
   * ค่าที่ได้คือระยะที่แผงต้องยกขึ้นจากขอบล่างจอ: ท้ายเว็บยังไม่โผล่ = 0 (แผงยาวเต็มจอตามเดิม)
   * พอท้ายเว็บใกล้เข้ามาในระยะ FOOTER_GAP ค่าจะค่อย ๆ โตขึ้นเอง แผงจึงยกตัวแบบลื่น ไม่กระตุก
   */
  const [dockLift, setDockLift] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      if (!footer) {
        setDockLift(0);
        return;
      }
      const lift = window.innerHeight - footer.getBoundingClientRect().top + FOOTER_GAP;
      setDockLift(Math.max(0, Math.round(lift)));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [active]);

  const registry = useMemo<DockRegistry>(
    () => ({
      register: (id, meta) =>
        setEntries((current) => {
          if (process.env.NODE_ENV !== "production" && current.length > 0) {
            console.warn("AssistantDock: มีการลงทะเบียนผู้ช่วยซ้อนกัน — เปลือกเดียวมีแผงเดียว จะแสดงตัวล่าสุด");
          }
          return [...current, { id, meta }];
        }),
      update: (id, meta) =>
        setEntries((current) => current.map((entry) => (entry.id === id ? { id, meta } : entry))),
      unregister: (id) => setEntries((current) => current.filter((entry) => entry.id !== id)),
      bodyEl
    }),
    [bodyEl]
  );

  const open = dockState === "open";

  return (
    <DockContext.Provider value={registry}>
      <div className={active && open ? "assistant-dock-push assistant-dock-push--active" : "assistant-dock-push"}>
        {children}
      </div>
      {active ? (
        <aside
          className={`assistant-dock${open ? "" : " assistant-dock--collapsed"}${active.meta.busy ? " is-busy" : ""}`}
          style={{ "--dock-top": `${navHeight}px`, "--dock-bottom": `${dockLift}px` } as React.CSSProperties}
          role="complementary"
          aria-label={active.meta.title}
          aria-busy={active.meta.busy || undefined}
        >
          <div className="assistant-dock__panel" id="assistant-dock-panel" hidden={!open}>
            <div className="assistant-dock__head">
              <span className="assistant-dock__title">{active.meta.title}</span>
              {active.meta.status ? (
                <span className={`status-chip status-chip--${active.meta.status.tone}`}>{active.meta.status.label}</span>
              ) : null}
              <button
                type="button"
                className="assistant-dock__toggle"
                aria-expanded={open}
                aria-controls="assistant-dock-panel"
                onClick={() => writeDockState(toggleDockState(dockState))}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
                ย่อแผง
              </button>
            </div>
            {/* จุดปลาย portal — ต้องอยู่ใน DOM เสมอแม้ตอนย่อ (ซ่อนด้วย CSS ที่ระดับ panel)
                ถอดออกเมื่อไหร่ state ของเนื้อหาผู้ช่วยหายเกลี้ยง เช่นคำสั่งที่ผู้ใช้พิมพ์ค้าง */}
            <div className="assistant-dock__body" ref={bodyRef} />
          </div>
          <button
            type="button"
            className="assistant-dock__pill"
            hidden={open}
            aria-expanded={open}
            aria-controls="assistant-dock-panel"
            onClick={() => writeDockState(toggleDockState(dockState))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a7 7 0 0 1 7 7v3a7 7 0 0 1-14 0v-3a7 7 0 0 1 7-7Z" />
              <path d="M9 11h.01M15 11h.01" />
              <path d="M8 21h8" />
            </svg>
            {active.meta.title}
          </button>
        </aside>
      ) : null}
    </DockContext.Provider>
  );
}

/**
 * ตัวที่แอปเรียกจาก workspace ของตัวเอง — เนื้อหา (children) เป็นของแอป 100% และถูก
 * portal เข้าแผงกลาง เพื่อให้ closure/state/handler ของ workspace ทำงานตามปกติ
 * โดย DOM ย้ายที่ไปอยู่ในแผง (IP-184 จะเสียบผู้ช่วย work-plan ผ่านตัวนี้เป็นรายแรก)
 */
export function AppAssistant({ title, status, busy, children }: AssistantDockMeta & { children: ReactNode }) {
  const registry = useContext(DockContext);
  // id คงที่ตลอดชีวิตคอมโพเนนต์ — ใช้ useState initializer เพราะ React ห้ามแตะ ref ระหว่าง render
  const [id] = useState(() => nextRegistrationId++);

  const registerRef = useRef(false);
  useEffect(() => {
    if (!registry) return;
    if (!registerRef.current) {
      registry.register(id, { title, status, busy });
      registerRef.current = true;
    } else {
      registry.update(id, { title, status, busy });
    }
  }, [registry, id, title, status, busy]);

  useEffect(() => {
    if (!registry) return;
    return () => {
      registry.unregister(id);
      registerRef.current = false;
    };
  }, [registry, id]);

  if (!registry?.bodyEl) return null;
  return createPortal(children, registry.bodyEl);
}
