"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  PAGE_CONTENT_HEIGHT_MM,
  PX_PER_MM,
  paginate,
  type PageBlock,
  type PlacedItem
} from "@/lib/paper-pagination";
import { bahtText, formatBaht } from "@/lib/thai-baht";
import { formatThaiDate } from "@/lib/thai-format";
import { formatPercent } from "@/lib/work-plan";
import type { MilestoneSchedule } from "@/lib/payment-milestone";
import { ThaiDateField } from "@/components/ui/thai-date-field";
import {
  acceptLogo,
  logoVisible,
  signatureName,
  signaturePosition,
  type DocumentSignatory,
  type WorkPlanDocumentMeta
} from "@/lib/work-plan-document-meta";
import { Button } from "@/components/platform/button";

/**
 * เอกสารบัญชีงวดงาน–งวดเงิน สำหรับพิมพ์แนบสัญญาจ้าง
 *
 * งานจบที่กระดาษที่ยื่นได้จริง ไม่ใช่จบที่หน้าจอ ค่าหน้ากระดาษทั้งหมดถอดจากไฟล์ต้นแบบ
 * ที่เจ้าของงานชี้ให้ดู `km/แบบฟอร์มเซ็นรับส่งมอบงาน.docx` คือ A4 210x297 มม.
 * ขอบบน 25 ซ้าย 25 ขวา 15 ล่าง 15 มม. และ TH Sarabun New 16 พอยต์ทั้งฉบับ
 * ค่าเหล่านี้อยู่ใน `src/app/document-print.css` ที่เดียว แยกจาก CSS ของหน้าจอ
 *
 * **เอกสารถูกแบ่งเป็นแผ่นจริง ไม่ใช่แผ่นเดียวที่ยืดตามเนื้อหา** ของเดิมประกาศความสูงเป็น
 * `min-height` แล้วปล่อยให้ยืด ผลคือตัวอย่างแสดงแผ่นสูง 411 มม. ซึ่งเป็นกระดาษที่ไม่มีอยู่จริง
 * และไม่ตรงกับ PDF ที่ได้ รอบนี้วัดความสูงของทุกบล็อกก่อน แล้วให้ `paginate` ตัดสินว่าอะไร
 * อยู่หน้าไหน ตารางแตกข้ามหน้าได้ทีละแถวโดยหัวตารางซ้ำทุกหน้า
 *
 * สามอย่างที่แยกเอกสารนี้ออกจากรายงานทั่วไป:
 *
 * หนึ่ง — **หัวกระดาษมีโลโก้ที่เปลี่ยนได้และปิดได้** เพราะผู้รับเหมาแต่ละรายยื่นในนามบริษัทตัวเอง
 * เอกสารที่บังคับโลโก้ของผู้ทำเครื่องมือ คือเอกสารที่เอาไปยื่นไม่ได้
 *
 * สอง — **ช่องลงนามมีวงเล็บเสมอ** แม้ยังไม่ได้กรอกชื่อ เพราะผู้ใช้จำนวนมากพิมพ์ออกมาแล้ว
 * เขียนชื่อด้วยปากกา ถ้าซ่อนวงเล็บตอนยังไม่มีชื่อ ก็เท่ากับบังคับให้กรอกในระบบก่อนถึงจะใช้กระดาษได้
 *
 * สาม — **ยอดทุกช่องมาจาก buildMilestoneSchedule** ซึ่งคิดด้วย BigInt satang ตรวจย้อนได้ทุกบาท
 * และยอดรวมทุกงวดเท่ามูลค่าสัญญาเป๊ะ ท้ายเอกสารพิมพ์ยอดเป็นตัวอักษรตามแบบราชการ
 */
export function WorkPlanDocument({
  projectName,
  schedule,
  activityTitlesByMilestone,
  meta,
  onMeta,
  onClose
}: {
  projectName: string;
  schedule: MilestoneSchedule;
  /** ชื่อกิจกรรมที่ต้องแล้วเสร็จในแต่ละงวด key คือ milestoneId */
  activityTitlesByMilestone: Record<string, string[]>;
  meta: WorkPlanDocumentMeta;
  onMeta: (next: WorkPlanDocumentMeta) => void;
  onClose: () => void;
}) {
  const [pages, setPages] = useState<PlacedItem[][]>([[]]);
  const [overflowing, setOverflowing] = useState<string[]>([]);
  const pageCount = Math.max(1, pages.length);

  const [logoError, setLogoError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState<"fit" | "full">("fit");
  /**
   * อัตราย่อขยายที่ผู้ใช้ตั้งเอง ค่าว่างแปลว่าเดินตามโหมดพอดีหน้าจอหรือขนาดจริง
   *
   * แยกจาก `zoom` เพราะสองอย่างนี้ตอบคนละคำถาม โหมดตอบว่า "ให้ระบบเลือกให้" ส่วนค่านี้
   * ตอบว่า "ฉันเลือกเอง" การกดแว่นขยายจึงเป็นการออกจากโหมดอัตโนมัติ ไม่ใช่การแก้ค่าของโหมด
   */
  const [customScale, setCustomScale] = useState<number | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileId = useId();

  /**
   * ย่อกระดาษให้พอดีความกว้างที่เหลือ เหมือนตัวอย่างก่อนพิมพ์ของโปรแกรมอ่าน PDF
   *
   * กระดาษถูกตั้งเป็นขนาด A4 จริงคือ 210 มิลลิเมตร ซึ่งเบราว์เซอร์แปลงเป็น 793.7 พิกเซล
   * ที่การย่อขยายปกติ (96 พิกเซลต่อนิ้ว) ตัวเลขนี้จึงเป็นค่าคงที่ ไม่ต้องวัดจากหน้าจอ
   * แล้วย่อด้วย transform เพื่อให้ผู้ใช้เห็นสัดส่วนหน้ากระดาษจริง ไม่ใช่กล่องที่ยืดเต็มจอ
   * ซึ่งทำให้ระยะขอบดูไม่ตรงกับที่จะพิมพ์ออกมา
   */
  /** A4 ที่การย่อขยายปกติ 96 จุดต่อนิ้ว เป็นค่าคงที่ ไม่ต้องวัดจากหน้าจอ */
  const A4_WIDTH_PX = 210 * PX_PER_MM;
  const A4_HEIGHT_PX = 297 * PX_PER_MM;
  const PAGE_CONTENT_PX = PAGE_CONTENT_HEIGHT_MM * PX_PER_MM;

  /**
   * พอดีหน้าจอคือเห็นทั้งแผ่น ไม่ใช่พอดีความกว้าง
   *
   * รอบแรกคิดจากความกว้างอย่างเดียว ผลคือบนจอกว้างค่าที่ได้เท่ากับหนึ่งพอดี
   * ปุ่มพอดีหน้าจอกับขนาดจริงจึงให้ผลเหมือนกันเป๊ะ กดแล้วไม่มีอะไรเปลี่ยน
   * ซึ่งอ่านได้อย่างเดียวว่าปุ่มเสีย ตัวอย่างก่อนพิมพ์ของโปรแกรมอ่าน PDF คิดทั้งสองด้าน
   */
  /** ระยะระหว่างแผ่นบนหน้าจอ ต้องตรงกับ gap ของ .doc-deck ใน document-print.css */
  const DECK_GAP_PX = 24;

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // พอดีหน้าจอคือเห็น **ทั้งเอกสาร** ไม่ใช่เห็นแผ่นแรกพอดี เอกสารสองหน้าจึงต้องคิดจากความสูงของทั้งกอง
    const deckHeight = pageCount * A4_HEIGHT_PX + Math.max(0, pageCount - 1) * DECK_GAP_PX;
    /* หักระยะขอบของเวทีตามค่าจริง ไม่ใช่ตัวเลขที่เดาไว้ เคยหักไว้ 60 ทั้งที่ขอบบนล่างรวม 68
       เหลือที่ให้เลื่อน 8 พิกเซลในโหมดที่ชื่อว่าพอดีหน้าจอ ซึ่งพาให้เคอร์เซอร์เป็นรูปมือทั้งที่แทบไม่มีอะไรให้ลาก */
    const box = getComputedStyle(stage);
    const padX = parseFloat(box.paddingLeft) + parseFloat(box.paddingRight);
    const padY = parseFloat(box.paddingTop) + parseFloat(box.paddingBottom);
    const byWidth = (stage.clientWidth - padX) / A4_WIDTH_PX;
    const byHeight = (stage.clientHeight - padY) / deckHeight;
    setFitScale(Math.max(0.1, Math.min(1, byWidth, byHeight)));
  }, [A4_WIDTH_PX, A4_HEIGHT_PX, pageCount]);

  useEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [measure, showSettings, pageCount]);

  /**
   * ขั้นของการย่อขยาย ไล่แบบเดียวกับโปรแกรมอ่าน PDF
   *
   * ใช้บันไดค่าคงที่แทนการคูณหารทีละนิด เพราะกดสิบครั้งแล้วต้องกลับมาที่ 100% ได้เป๊ะ
   * การคูณ 1.2 ไปเรื่อย ๆ จะได้ 99.7% หรือ 100.4% ซึ่งอ่านแล้วเหมือนโปรแกรมเพี้ยน
   */
  const ZOOM_STEPS = [0.25, 0.35, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

  const scale = customScale ?? (zoom === "fit" ? fitScale : 1);

  /** ขั้นถัดไปในทิศที่กด ถ้าอยู่ระหว่างขั้น ให้ไปขั้นที่ใกล้ที่สุดในทิศนั้น */
  const stepZoom = (direction: 1 | -1) => {
    const next =
      direction === 1
        ? ZOOM_STEPS.find((step) => step > scale + 0.001)
        : [...ZOOM_STEPS].reverse().find((step) => step < scale - 0.001);
    if (next !== undefined) setCustomScale(next);
  };

  /**
   * ตัวฟังล้อเมาส์ถูกผูกครั้งเดียวตอน mount จึงจะจำ `scale` ของรอบนั้นไว้ตลอด
   * เก็บฟังก์ชันล่าสุดไว้ใน ref แทน ตัวฟังจึงเห็นค่าปัจจุบันเสมอโดยไม่ต้องผูกใหม่ทุกครั้งที่ย่อขยาย
   */
  const stepZoomRef = useRef(stepZoom);
  useEffect(() => {
    stepZoomRef.current = stepZoom;
  });

  const canZoomIn = scale < ZOOM_STEPS[ZOOM_STEPS.length - 1]! - 0.001;
  const canZoomOut = scale > ZOOM_STEPS[0]! + 0.001;

  /** เลือกโหมดอัตโนมัติ = เลิกใช้ค่าที่ตั้งเอง ไม่งั้นกดปุ่มแล้วไม่มีอะไรเปลี่ยน ซึ่งอ่านว่าปุ่มเสีย */
  const chooseZoom = (mode: "fit" | "full") => {
    setCustomScale(null);
    setZoom(mode);
  };

  /**
   * ลากด้วยเมาส์ซ้ายค้างเพื่อเลื่อนเอกสาร อย่างที่โปรแกรมอ่าน PDF ทำ
   *
   * ระหว่างลาก ตัวฟังอยู่ที่ `window` ไม่ใช่ที่เวที ผู้ใช้จึงลากเลยขอบกรอบออกไปได้โดยการลาก
   * ไม่หลุดกลางคัน และปล่อยเมาส์นอกหน้าต่างก็ยังจบการลางอย่างถูกต้อง
   * เลือกวิธีนี้แทน `setPointerCapture` เพราะการจับ pointer โยน `NotFoundError` ได้เมื่อ
   * pointer หลุดไปก่อนที่ตัวจัดการจะได้ทำงาน ซึ่งเป็นความผิดพลาดที่ไม่มีอะไรให้แก้
   *
   * ไม่เริ่มลากเมื่อไม่มีที่ให้เลื่อน เพราะเคอร์เซอร์รูปมือบนของที่ขยับไม่ได้คือคำสัญญาที่ผิด
   * และระหว่างลาก การเลือกข้อความถูกปิดไว้ ไม่งั้นลากทีเดียวได้ทั้งแพนทั้งไฮไลต์พร้อมกัน
   */
  const panFrom = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  const checkScrollable = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setScrollable(stage.scrollHeight > stage.clientHeight + 1 || stage.scrollWidth > stage.clientWidth + 1);
  }, []);

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage || event.button !== 0) return;
    if (stage.scrollHeight <= stage.clientHeight + 1 && stage.scrollWidth <= stage.clientWidth + 1) return;
    panFrom.current = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    setPanning(true);
  };

  useEffect(() => {
    if (!panning) return;
    const move = (event: PointerEvent) => {
      const stage = stageRef.current;
      const from = panFrom.current;
      if (!stage || !from) return;
      stage.scrollLeft = from.left - (event.clientX - from.x);
      stage.scrollTop = from.top - (event.clientY - from.y);
    };
    const stop = () => {
      panFrom.current = null;
      setPanning(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [panning]);

  /**
   * ล้อเมาส์ย่อขยายเอกสาร โดยเลื่อนไปข้างหน้าคือขยาย เลื่อนไปข้างหลังคือย่อ
   *
   * ตรงกับที่โปรแกรมอ่านเอกสารส่วนใหญ่ทำ เจ้าของงานเคยสั่งกลับทางไว้ตอนแรกเมื่อ 2026-08-26
   * แล้วเปลี่ยนกลับมาเป็นทิศนี้ในวันเดียวกันหลังลองใช้จริง
   *
   * ผูกด้วย `addEventListener` เองแทน `onWheel` ของ React เพราะต้อง `passive: false`
   * ถึงจะ `preventDefault` ได้ ไม่งั้นหน้าเว็บจะเลื่อนตามล้อไปด้วยพร้อมกับการย่อขยาย
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      // deltaY ติดลบคือล้อหมุนไปข้างหน้า ซึ่งคือขยาย
      stepZoomRef.current(event.deltaY < 0 ? 1 : -1);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  /** ตรวจใหม่ทุกครั้งที่ขนาดหรือจำนวนหน้าเปลี่ยน เพราะสองอย่างนั้นเปลี่ยนว่ามีที่ให้เลื่อนหรือไม่ */
  useEffect(() => {
    checkScrollable();
  }, [checkScrollable, scale, pageCount, showSettings]);

  const patch = (next: Partial<WorkPlanDocumentMeta>) => onMeta({ ...meta, ...next });
  const patchSigner = (key: "contractor" | "employer", next: Partial<DocumentSignatory>) =>
    onMeta({ ...meta, [key]: { ...meta[key], ...next } });

  /**
   * อ่านไฟล์ที่ผู้ใช้เลือกเป็น data URI แล้วให้ acceptLogo ตัดสิน
   *
   * ตรวจหลังอ่านเสร็จ ไม่ใช่ตรวจจาก `file.size` ก่อน เพราะสิ่งที่กินที่เก็บของเบราว์เซอร์จริง
   * คือข้อความฐาน 64 ซึ่งใหญ่กว่าไฟล์ต้นทางราวหนึ่งในสาม การตรวจขนาดไฟล์ดิบจึงปล่อยรูป
   * ที่เกินเพดานจริงผ่านเข้ามาได้
   */
  const chooseLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setLogoError("อ่านไฟล์ไม่สำเร็จ ลองเลือกใหม่อีกครั้ง");
    reader.onload = () => {
      const result = acceptLogo(String(reader.result ?? ""));
      if (!result.ok) {
        setLogoError(result.reason);
        return;
      }
      setLogoError(null);
      patch({ logoDataUri: result.dataUri, showLogo: true });
    };
    reader.readAsDataURL(file);
  };

  const assignedPpm = 1_000_000n - schedule.unassignedWeightPpm;

  const blank = <span className="doc-blank" />;

  /**
   * เนื้อหาทั้งฉบับในรูปบล็อก เรียงตามลำดับที่ต้องอ่าน
   *
   * แยกออกมาเป็นข้อมูลแทนที่จะเขียนต่อกันเป็น JSX ก้อนเดียว เพราะตัวแบ่งหน้าต้องวัดทีละชิ้น
   * แล้วประกอบกลับเป็นหน้า ๆ ตารางงวดงานไม่อยู่ในนี้เพราะมันแตกข้ามหน้าได้ จึงมีทางของตัวเอง
   */
  const headBlocks: { id: string; node: ReactNode }[] = [
    {
      id: "masthead",
      node: (
        <header className="doc-masthead">
          {/* ซ้าย: ใครเป็นเจ้าของเรื่อง — ตรา ชื่อหน่วยงาน และสถานที่ */}
          <div className="doc-masthead__org">
            {logoVisible(meta) ? (
              // eslint-disable-next-line @next/next/no-img-element -- รูปเป็น data URI ของผู้ใช้ หรือไฟล์ที่มากับโปรแกรม ไม่ผ่านตัวปรับขนาดของ Next
              <img src={meta.logoDataUri} alt="" />
            ) : null}
            <p><strong>{meta.employerName || blank}</strong></p>
            {meta.siteName ? <p>{meta.siteName}</p> : null}
          </div>
          {/* ขวา: นี่คือเอกสารอะไร แนบท้ายอะไร และข้อมูล ณ วันไหน */}
          <div className="doc-masthead__doc">
            <h1>บัญชีแสดงงวดงานและงวดเงิน</h1>
            <p>แนบท้ายสัญญาจ้าง{meta.contractNumber ? ` เลขที่ ${meta.contractNumber}` : ""}</p>
            <p>ข้อมูล ณ วันที่ {formatThaiDate(meta.documentDate) ?? blank}</p>
          </div>
        </header>
      )
    },
    { id: "h1", node: <h2>1. ข้อมูลสัญญา</h2> },
    {
      id: "facts",
      node: (
        <table className="doc-facts">
          <tbody>
            <tr><th scope="row">โครงการ</th><td>{projectName || blank}</td></tr>
            <tr><th scope="row">เลขที่สัญญา</th><td>{meta.contractNumber || blank}</td></tr>
            <tr><th scope="row">สถานที่ก่อสร้าง</th><td>{meta.siteName || blank}</td></tr>
            <tr><th scope="row">จำนวนงวด</th><td>{schedule.rows.length.toLocaleString("th-TH")} งวด</td></tr>
            <tr><th scope="row">มูลค่างานตามบัญชีนี้</th><td>{formatBaht(schedule.totalWorkSatang)} บาท</td></tr>
          </tbody>
        </table>
      )
    },
    { id: "h2", node: <h2>2. บัญชีงวดงาน–งวดเงิน</h2> }
  ];

  const tailBlocks: { id: string; node: ReactNode }[] = [
    {
      id: "words",
      // ยอดเป็นตัวอักษรอยู่ใต้ตัวเลขที่มันสะกด เพราะหน้าที่ของมันคือยืนยันตัวเลขข้างบน
      node: <p className="doc-words">({bahtText(schedule.totalWorkSatang)})</p>
    },
    { id: "h3", node: <h2>3. หมายเหตุ</h2> },
    {
      id: "notes",
      node: (
        <div className="doc-box">
          <p>
            1. ฐานการหักเงินประกันผลงาน คืนเงินล่วงหน้า ภาษีมูลค่าเพิ่ม และภาษีหัก ณ ที่จ่าย
            เป็นไปตามเงื่อนไขในสัญญาแต่ละฉบับ ให้ตรวจกับสัญญาจริงก่อนใช้ยื่นเบิก
          </p>
          <p style={{ marginBottom: 0 }}>
            2. ยอดทุกช่องคิดด้วยจำนวนเต็มสตางค์ ผลรวมทุกงวดเท่ามูลค่างานตามบัญชีนี้เสมอ
          </p>
        </div>
      )
    },
    { id: "h4", node: <h2>4. ลงนาม</h2> },
    {
      id: "signs",
      node: (
        <div className="doc-signs">
          {(
            [
              ["contractor", "ผู้รับจ้าง"],
              ["employer", "ผู้ว่าจ้าง"]
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <p className="doc-sign-line">ลงชื่อ <span className="doc-line" /></p>
              <p className="doc-sign-name">({signatureName(meta[key])})</p>
              {/*
                บรรทัดตำแหน่งมีเสมอ แม้ยังไม่ได้กรอก เพราะถ้าซ่อนตอนว่าง ช่องลงนามสองฝั่ง
                จะสูงไม่เท่ากันแล้วบรรทัดของแต่ละฝั่งเลื่อนไม่ตรงกันทั้งบล็อก
                ยังไม่กรอกให้ขึ้นคำว่า ตำแหน่ง ไว้ก่อนตามที่เจ้าของงานสั่ง แล้วไปกรอกจริงในแผงตั้งค่าเอกสาร
              */}
              <p className="doc-sign-position">{signaturePosition(meta[key]) || "ตำแหน่ง"}</p>
              <p className="doc-sign-role">{label}</p>
              {/* เอกสารแนบสัญญาต้องตอบได้ว่าลงนามวันไหน ช่องเว้นไว้ให้เขียนด้วยปากกา */}
              <p className="doc-sign-date">
                วันที่ <span className="doc-line" /> / <span className="doc-line" /> / <span className="doc-line" />
              </p>
            </div>
          ))}
        </div>
      )
    }
  ];

  const blockById = new Map([...headBlocks, ...tailBlocks].map((block) => [block.id, block.node]));

  const tableColumns = (
    <colgroup>
      <col style={{ width: "12%" }} />
      <col style={{ width: "48%" }} />
      <col style={{ width: "14%" }} />
      <col style={{ width: "26%" }} />
    </colgroup>
  );

  const tableHead = (
    <tr>
      <th>งวดที่</th>
      <th>งานที่ต้องแล้วเสร็จ</th>
      <th>ร้อยละ</th>
      <th>จำนวนเงิน (บาท)</th>
    </tr>
  );

  const tableFoot = (
    <tr>
      <td colSpan={2}>รวมทั้งสิ้น</td>
      <td className="doc-num">{formatPercent(assignedPpm)}</td>
      <td className="doc-num">{formatBaht(schedule.totalWorkSatang)}</td>
    </tr>
  );

  const milestoneCells = (row: MilestoneSchedule["rows"][number]) => (
    <>
      <td className="doc-mid">{row.ordinal}</td>
      <td>
        {row.title}
        <span className="doc-works">
          {(activityTitlesByMilestone[row.milestoneId] ?? []).join(" · ") || "ยังไม่ได้ผูกงาน"}
        </span>
      </td>
      <td className="doc-num">{formatPercent(row.weightPpm)}</td>
      <td className="doc-num">{formatBaht(row.periodWorkSatang)}</td>
    </>
  );

  /**
   * วัดความสูงจริงของทุกชิ้นแล้วให้ `paginate` ตัดสินว่าอะไรอยู่หน้าไหน
   *
   * รอ `document.fonts.ready` ก่อนวัดเสมอ เพราะความสูงที่วัดด้วยฟอนต์สำรองไม่ใช่ความสูงที่
   * จะได้จริงเมื่อ TH Sarabun New โหลดเสร็จ แล้วหน้าจะแบ่งผิดตำแหน่ง
   */
  const measureRef = useRef<HTMLDivElement>(null);

  /** ลายเซ็นของเนื้อหา ใช้สั่งวัดใหม่เมื่อสิ่งที่พิมพ์เปลี่ยน ไม่ใช่ทุกครั้งที่คอมโพเนนต์เรนเดอร์ */
  const contentKey = JSON.stringify([
    projectName,
    meta,
    schedule.rows.map((row) => [row.milestoneId, row.ordinal, row.title, String(row.periodWorkSatang)]),
    activityTitlesByMilestone
  ]);

  const repaginate = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const heightOf = (selector: string) => {
      const node = root.querySelector<HTMLElement>(selector);
      return node ? node.getBoundingClientRect().height : 0;
    };
    // หัวข้อทุกอันติดธง keepWithNext เพื่อไม่ให้ค้างท้ายหน้าโดยเนื้อหาไปอยู่หน้าถัดไป
    const headings = new Set(["h1", "h2", "h3", "h4"]);
    const atoms = (ids: string[]): PageBlock[] =>
      ids.map((id) => ({
        kind: "atom",
        id,
        height: heightOf('[data-block="' + id + '"]'),
        keepWithNext: headings.has(id)
      }));

    const blocks: PageBlock[] = [
      ...atoms(["masthead", "h1", "facts", "h2"]),
      {
        kind: "rows",
        id: "milestones",
        headerHeight: heightOf('[data-part="thead"]'),
        footerHeight: heightOf('[data-part="tfoot"]'),
        rows: schedule.rows.map((row) => ({
          id: row.milestoneId,
          height: heightOf('[data-row="' + CSS.escape(row.milestoneId) + '"]')
        }))
      },
      ...atoms(["words", "h3", "notes", "h4", "signs"])
    ];

    /* เลขหน้ากินพื้นที่พิมพ์เท่ากับความสูงบวกระยะขอบล่าง ซึ่งติดลบเพราะมันล้ำลงไปในขอบกระดาษ
       หักค่านี้ออกจากงบของแต่ละหน้า ไม่ใช่ปล่อยให้เนื้อหาไหลไปทับเลขหน้าแล้วถูกตัด */
    const folio = root.querySelector<HTMLElement>('[data-part="folio"]');
    const folioCost = folio ? folio.offsetHeight + parseFloat(getComputedStyle(folio).marginBottom) : 0;
    const result = paginate(blocks, PAGE_CONTENT_PX - folioCost);
    setPages(result.pages);
    setOverflowing(result.overflowing);
  }, [schedule.rows, PAGE_CONTENT_PX]);

  useLayoutEffect(() => {
    repaginate();
    if (typeof document === "undefined" || !document.fonts) return;
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) repaginate();
    });
    return () => {
      live = false;
    };
  }, [repaginate, contentKey]);

  /**
   * สั่งพิมพ์หลังฟอนต์โหลดเสร็จเท่านั้น
   *
   * ถ้าสั่งพิมพ์ตอนฟอนต์ยังไม่มา เบราว์เซอร์จะพิมพ์ด้วยฟอนต์สำรอง ได้ PDF ที่ตัวอักษรไม่ใช่
   * TH Sarabun New และตำแหน่งไม่ตรงกับที่เห็นบนหน้าจอ เอกสารที่พิมพ์ไปแล้วแก้ไม่ได้
   */
  const print = useCallback(() => {
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(() => window.print());
      return;
    }
    window.print();
  }, []);

  /** ชิ้นส่วนของตารางงวดงานที่ตกอยู่ในหน้าหนึ่ง หัวตารางซ้ำทุกหน้าที่มันไปโผล่ */
  const renderChunk = (item: Extract<PlacedItem, { kind: "rows" }>, key: string) => (
    <table className="doc-table" key={key}>
      {tableColumns}
      <thead>{tableHead}</thead>
      <tbody>
        {schedule.rows.slice(item.from, item.to).map((row) => (
          <tr key={row.milestoneId}>{milestoneCells(row)}</tr>
        ))}
      </tbody>
      {item.withFooter ? <tfoot>{tableFoot}</tfoot> : null}
    </table>
  );

  return (
    <div className="work-plan__doc-overlay" role="dialog" aria-label="เอกสารบัญชีงวดงาน">
      <div className="work-plan__doc-toolbar">
        <p className="eyebrow">เอกสารพร้อมพิมพ์ · A4 210 x 297 มม. · TH Sarabun New 16 พอยต์</p>
        <div className="work-plan__doc-toolbar-actions">
          <div className="work-plan__view" role="group" aria-label="ขนาดที่แสดง">
            <button
              type="button"
              className={customScale === null && zoom === "fit" ? "is-on" : undefined}
              aria-pressed={customScale === null && zoom === "fit"}
              onClick={() => chooseZoom("fit")}
            >
              พอดีหน้าจอ
            </button>
            <button
              type="button"
              className={customScale === null && zoom === "full" ? "is-on" : undefined}
              aria-pressed={customScale === null && zoom === "full"}
              onClick={() => chooseZoom("full")}
            >
              ขนาดจริง
            </button>
          </div>
          <div className="work-plan__view work-plan__zoom" role="group" aria-label="ย่อขยายเอกสาร">
            <button type="button" onClick={() => stepZoom(-1)} disabled={!canZoomOut} aria-label="ย่อลง">
              <MagnifierIcon sign="minus" />
            </button>
            {/* ตัวเลขเป็นสถานะ ไม่ใช่ปุ่ม แต่ต้องอยู่ในกลุ่มเดียวกันเพื่อให้อ่านคู่กับแว่นขยายได้ */}
            <span className="work-plan__zoom-level" aria-live="polite">
              {Math.round(scale * 100).toLocaleString("th-TH")}%
            </span>
            <button type="button" onClick={() => stepZoom(1)} disabled={!canZoomIn} aria-label="ขยายขึ้น">
              <MagnifierIcon sign="plus" />
            </button>
          </div>
          <Button tone="quiet" type="button" aria-pressed={showSettings} onClick={() => setShowSettings((open) => !open)}
          >
            {showSettings ? "ปิดแผงตั้งค่า" : "ตั้งค่าเอกสาร"}
          </Button>
          <Button tone="primary" type="button" onClick={print}>
            พิมพ์ หรือบันทึกเป็น PDF
          </Button>
          <Button tone="quiet" type="button" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </div>

      <div className={showSettings ? "work-plan__doc-body is-open" : "work-plan__doc-body"}>
      {/*
        แผงตั้งค่าเป็นคอลัมน์ข้างกระดาษ ไม่ใช่แถบพาดขวางด้านบน
        รอบก่อนวางไว้ด้านบนแล้วมันบังหัวกระดาษพอดี ซึ่งเป็นส่วนที่ผู้ใช้กำลังตั้งค่าอยู่
        และปิดไว้เป็นค่าเริ่มต้น เพราะคนเปิดหน้านี้มาเพื่อดูกระดาษก่อน ไม่ได้มาตั้งค่า
      */}
      <aside className="work-plan__doc-settings" hidden={!showSettings}>
        <div className="work-plan__doc-field">
          <span>โลโก้บนหัวกระดาษ</span>
          <div className="work-plan__doc-logo-actions">
            <Button tone="quiet" htmlFor={fileId}>
              {meta.logoDataUri === "" ? "ใส่โลโก้" : "เปลี่ยนโลโก้"}
            </Button>
            <input
              id={fileId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="work-plan__doc-file"
              onChange={(event) => chooseLogo(event.target.files?.[0])}
            />
            {meta.logoDataUri === "" ? null : (
              <>
                <Button tone="quiet" type="button" aria-pressed={meta.showLogo} onClick={() => patch({ showLogo: !meta.showLogo })}
                >
                  {meta.showLogo ? "ไม่แสดงโลโก้" : "แสดงโลโก้"}
                </Button>
                <Button tone="quiet" type="button" onClick={() => {
                    setLogoError(null);
                    patch({ logoDataUri: "", showLogo: true });
                  }}
                >
                  เอาโลโก้ออก
                </Button>
              </>
            )}
          </div>
          {logoError ? (
            <p className="form-error" role="alert">
              {logoError}
            </p>
          ) : (
            <p className="form-note">รับ PNG JPG WEBP ไม่เกิน 200 กิโลไบต์ · พิมพ์ในกรอบ 28 มิลลิเมตร</p>
          )}
        </div>

        <label>
          ผู้ว่าจ้าง
          <input
            className="work-plan__cell"
            value={meta.employerName}
            placeholder="เช่น เทศบาลตำบลหนองแสง"
            onChange={(event) => patch({ employerName: event.target.value })}
          />
        </label>
        <label>
          เลขที่สัญญา
          <input
            className="work-plan__cell"
            value={meta.contractNumber}
            placeholder="เช่น จ.12/2569"
            onChange={(event) => patch({ contractNumber: event.target.value })}
          />
        </label>
        <label>
          สถานที่ก่อสร้าง
          <input
            className="work-plan__cell"
            value={meta.siteName}
            placeholder="เช่น ต.ในเมือง อ.เมือง จ.นครราชสีมา"
            onChange={(event) => patch({ siteName: event.target.value })}
          />
        </label>
        <label>
          วันที่บนเอกสาร
          <ThaiDateField
            value={meta.documentDate}
            onChange={(iso) => patch({ documentDate: iso })}
            ariaLabel="วันที่บนเอกสาร"
          />
        </label>

        {(
          [
            ["contractor", "ผู้รับจ้าง"],
            ["employer", "ผู้ว่าจ้าง"]
          ] as const
        ).map(([key, label]) => (
          <div className="work-plan__doc-field" key={key}>
            <span>ผู้ลงนามฝ่าย{label}</span>
            <div className="work-plan__doc-signer">
              <input
                className="work-plan__cell"
                value={meta[key].name}
                placeholder="ชื่อ-นามสกุล"
                aria-label={`ชื่อผู้ลงนามฝ่าย${label}`}
                onChange={(event) => patchSigner(key, { name: event.target.value })}
              />
              <input
                className="work-plan__cell"
                value={meta[key].position}
                placeholder="ตำแหน่ง"
                aria-label={`ตำแหน่งผู้ลงนามฝ่าย${label}`}
                onChange={(event) => patchSigner(key, { position: event.target.value })}
              />
            </div>
            <p className="form-note">เว้นว่างไว้ได้ วงเล็บบนกระดาษยังอยู่ให้เขียนด้วยปากกา</p>
          </div>
        ))}
      </aside>

      <div
        className={[
          "work-plan__doc-stage",
          panning ? "is-panning" : "",
          scrollable ? "" : "is-still"
        ].filter(Boolean).join(" ")}
        ref={stageRef}
        onPointerDown={startPan}
      >
        {/*
          ตัววัดความสูง มองไม่เห็นแต่ถูกจัดวางจริง เพราะของที่ไม่ได้จัดวางย่อมวัดความสูงไม่ได้
          ความกว้างเท่าพื้นที่พิมพ์จริง ตัวเลขที่วัดได้จึงเป็นตัวเลขเดียวกับที่จะเกิดบนกระดาษ
        */}
        <div className="doc-measure" aria-hidden="true" ref={measureRef}>
          <div className="doc-page">
            <div className="doc-page__inner">
              {headBlocks.map((block) => (
                <div className="doc-block" data-block={block.id} key={block.id}>
                  {block.node}
                </div>
              ))}
              <table className="doc-table">
                {tableColumns}
                <thead data-part="thead">{tableHead}</thead>
                <tbody>
                  {schedule.rows.map((row) => (
                    <tr data-row={row.milestoneId} key={row.milestoneId}>
                      {milestoneCells(row)}
                    </tr>
                  ))}
                </tbody>
                <tfoot data-part="tfoot">{tableFoot}</tfoot>
              </table>
              {tailBlocks.map((block) => (
                <div className="doc-block" data-block={block.id} key={block.id}>
                  {block.node}
                </div>
              ))}
            </div>
            {/* เลขหน้ากินพื้นที่พิมพ์จริง จึงต้องวัดแล้วหักออกจากงบของแต่ละหน้า ไม่ใช่ปล่อยให้ล้นแล้วถูกตัด */}
            <p className="doc-page__folio" data-part="folio">หน้า 1 / 1</p>
          </div>
        </div>

        {/*
          transform ย่อทั้งกองเพื่อดูภาพรวมเท่านั้น ไม่ได้ใช้บีบเนื้อหาให้ลงหน้า
          และไม่กินที่ตามจริง ตัวครอบจึงกำหนดขนาดตามอัตราส่วนที่ย่อไว้เอง
        */}
        <div
          className="doc-deck__fit"
          style={{
            width: `calc(210mm * ${scale})`,
            height: `calc((297mm * ${pages.length} + 24px * ${Math.max(0, pages.length - 1)}) * ${scale})`
          }}
        >
          <div className="doc-deck" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {pages.map((items, index) => (
              <section className="doc-page" key={index} aria-label={`หน้า ${index + 1} จาก ${pages.length}`}>
                <div className="doc-page__inner">
                  {items.map((item, position) =>
                    item.kind === "atom" ? (
                      <div className="doc-block" key={item.id}>
                        {blockById.get(item.id)}
                      </div>
                    ) : (
                      renderChunk(item, `${item.id}-${position}`)
                    )
                  )}
                </div>
                {/*
                  เลขหน้ามีทุกหน้าเสมอ รวมถึงเอกสารหน้าเดียวซึ่งขึ้น 1 / 1
                  ตัวหน้าคือหน้าปัจจุบัน ตัวหลังคือจำนวนหน้าจริงของเอกสารฉบับนั้น
                */}
                <p className="doc-page__folio">
                  หน้า {(index + 1).toLocaleString("th-TH")} / {pages.length.toLocaleString("th-TH")}
                </p>
              </section>
            ))}
          </div>
        </div>

        {/* ของที่สูงเกินหนึ่งหน้าไม่ถูกตัดทิ้งเงียบ ๆ แต่บอกให้ผู้ใช้รู้ว่าจะพิมพ์ออกมาไม่ครบ */}
        {overflowing.length === 0 ? null : (
          <p className="work-plan__doc-overflow" role="alert">
            มีเนื้อหา {overflowing.length.toLocaleString("th-TH")} ชิ้นที่สูงเกินหนึ่งหน้ากระดาษ
            จึงพิมพ์ออกมาไม่ครบ ให้ลดข้อความในช่องนั้นลงก่อนสั่งพิมพ์
          </p>
        )}
      </div>
      </div>
    </div>
  );
}

/**
 * แว่นขยายที่มีเครื่องหมายบวกหรือลบอยู่ข้างใน
 *
 * วาดเองแทนการใช้ชุดไอคอนสำเร็จ เพราะต้องการแค่สองอันและไม่อยากผูกเอกสารพิมพ์
 * เข้ากับไฟล์ไอคอนที่หน้าอื่นเป็นเจ้าของ เส้นใช้ `currentColor` จึงเปลี่ยนสีตามปุ่มที่ครอบอยู่เอง
 */
function MagnifierIcon({ sign }: { sign: "plus" | "minus" }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="6.75" cy="6.75" r="4.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.4 10.4 L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4.4 6.75 H9.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {sign === "plus" ? (
        <path d="M6.75 4.4 V9.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
