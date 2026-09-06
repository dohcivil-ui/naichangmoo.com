/**
 * กางวิธีคิดของรายการวัดหนึ่งรายการออกมาเป็นบรรทัดที่คนตรวจตามได้ (IP-243)
 *
 * **คำสั่งของเจ้าของงาน** "ทำเป็นหลักฐานการคิดคำนวณไว้ในแอป ฝังไว้เลยนะวิธีการคิดคำนวณ
 * แบบนี้ ไม่ว่าจะเป็นงานไหนก็ให้ใช้หลักการนี้ ลากเส้นทาบวัด เทียบบัญญัติไตรยางศ์ เทียบสเกล
 * มีข้อมูลที่ตอบได้จริง แบบนี้ user ก็จะได้คำตอบ ไม่คาใจ"
 * (`docs/plans/2026-09-05-every-number-shows-its-working.md`)
 *
 * **ไฟล์นี้ไม่คำนวณตัวเลขที่รายงานใหม่** ตัวเลขทุกตัวรับเข้ามาจาก `measure()` ที่เดียว
 * เหมือนเดิม · ถ้ามันคิดเอง จะกลายเป็นเลขที่สองที่อาจไม่ตรงกับเลขแรก ซึ่งแย่กว่าไม่มี
 * คำอธิบายเลย · เหตุผลเดียวกับที่เขียนไว้หัว `room-area-explained.ts`
 * · ที่นี่ถึงกับเดินย้อน คือเอาเลขเมตรที่รายงานหารด้วยตัวคูณเพื่อได้จำนวนจุดกลับมา
 * แทนที่จะไล่วัดจุดเอง เพราะเลขที่ได้จากการหารกลับไม่มีทางขัดกับเลขที่รายงานได้เลย
 *
 * **เรียงตามลำดับที่คนอ่านจะถาม ไม่ใช่ลำดับที่โปรแกรมคำนวณ** รูปอยู่ตรงไหนของแบบ
 * · จุดบนกระดาษกลายเป็นเมตรได้ยังไง · สเกลเชื่อได้แค่ไหน · เลขที่รายงานคิดออกมาได้ยังไง
 * · ตัวเลขนี้วัดถึงตรงไหน
 *
 * **ข้อสี่คือข้อที่เจ้าของงานสั่งเพิ่มเมื่อ 2026-09-06** ของเดิมกางแค่สี่ข้อแล้วจบโดยที่
 * เลขที่แถวรายงาน (เช่น 4.02) ไม่เคยโผล่ในแผงเลย คนอ่านต้องคูณเองแล้วเดาเองว่าต้องได้เท่าไร
 * · หลักฐานที่ไม่พากลับมาที่เลขที่มันกำลังอธิบาย คือหลักฐานที่ยังไม่จบ
 *
 * **และทุกบรรทัดต้องแยกตามชนิดของการวัด** ของเดิมยิงบรรทัด "กว้าง × ลึก" ของกรอบที่ครอบรูป
 * ออกมาทุกชนิด · เส้นระยะสองจุดที่ลากเฉียงจึงได้บรรทัดกว้างกับลึกที่ไม่ใช่คำตอบ ส่วนคำตอบจริง
 * คือด้านตรงข้ามมุมฉากกลับไม่มีในแผง · การนับจำนวนยิ่งหนัก เพราะกรอบที่ครอบจุดที่นับ
 * ไม่ได้แปลว่าอะไรเลย และมันยังขึ้นป้ายทวงสเกลทั้งที่การนับไม่ใช้สเกล
 *
 * **กรอบที่ครอบรูปไม่ใช่ด้านของห้อง** ห้องรูปตัว L จะมีกรอบใหญ่กว่าตัวห้องเสมอ
 * ตัวคูณกลับที่ปิดช่องว่างนั้นคือ `fillRatio` ซึ่ง `room-area-explained.ts` เตรียมไว้ให้แล้ว
 * ตั้งแต่ IP-238 · ไฟล์นี้เรียกใช้ของตัวนั้น ไม่คิดพื้นที่กรอบเองซ้ำอีกชุด
 *
 * **สิ่งที่ยังตอบไม่ได้ต้องขึ้นให้เห็น** หลักฐานที่แสร้งว่ารู้ทุกอย่างคือหลักฐานที่เชื่อไม่ได้
 * จึงมี `openQuestions` แยกออกมาต่างหาก ไม่ใช่เงียบหรือเดาแทน · แต่ข้อที่เป็นคำตอบของ
 * คำถามในแผงโดยตรงต้องอยู่ในช่องคำตอบของคำถามนั้น ไม่ใช่ไปโผล่ในกล่องข้างล่าง
 * เพราะคำถามที่ดูเหมือนถูกตอบแล้วทั้งที่ยังไม่ถูกตอบ อ่านแล้วเข้าใจผิดกว่าไม่ตอบเลย
 *
 * ไฟล์นี้ไม่รู้จัก React และไม่รู้จักฐานข้อมูล
 */

import { calibrationMethodKind, type CalibrationMethod } from "@/lib/drawing-calibration-method";
import {
  measurementKindLabel,
  needsScale,
  outlinePoints,
  type Measurement,
  type MeasurementValue
} from "@/lib/drawing-measurement";
import {
  dimensionDisagreement,
  type PageScale,
  type StatedDimension
} from "@/lib/drawing-scale";
import { explainRoomArea } from "@/lib/room-area-explained";

export type EvidenceStep = {
  /** คำถามของคนที่ท้วงตัวเลข ไม่ใช่ชื่อขั้นตอนของโปรแกรม */
  question: string;
  /** คำตอบสั้น ๆ ที่อ่านจบในบรรทัดเดียว */
  answer: string;
  /** บรรทัดคำนวณเต็ม ที่หยิบเครื่องคิดเลขมากดตามได้ · null เมื่อขั้นนั้นไม่มีการคูณหาร */
  working: string | null;
};

export type MeasurementEvidence = {
  steps: EvidenceStep[];
  /** สิ่งที่ยังตอบไม่ได้ ณ ตอนนี้ · ต้องขึ้นบนจอ ไม่ใช่ซ่อน */
  openQuestions: string[];
};

/** ทศนิยมสี่ตำแหน่งสำหรับเมตรต่อจุด เพราะสามตำแหน่งทำให้บรรทัดคูณกลับแล้วไม่ลงตัว */
const metresPerPointText = (value: number) => value.toFixed(4);
const metresText = (value: number) => value.toFixed(3);
const pointsText = (value: number) => value.toFixed(1);
/** สัดส่วนที่รูปกินในกรอบ · ทศนิยมหนึ่งตำแหน่งพอให้คูณกลับแล้วคลาดไม่ถึงครึ่งหลักสุดท้าย */
const percentText = (ratio: number) => (ratio * 100).toFixed(1);

/**
 * ตัวเลขนี้วัดถึงตรงไหน — สามคำตอบนี้ให้เลขคนละค่าสำหรับห้องเดียวกัน
 *
 * เจ้าของงานเคาะเมื่อ 2026-09-05 ว่าค่าที่แอปตอบคือ**ผิวในของผนัง** ไม่ใช่กึ่งกลางผนัง
 * และไม่ใช่หมุดของเส้นบอกระยะ · ห้องน้ำผู้ป่วยชายหน้า 7 ให้ 4.17 กับ 4.56 กับ 5.00
 * ตามลำดับ ซึ่งทุกค่าถูกในนิยามของมันเอง — ข้อนี้คือข้อที่ทำให้เรื่องวันนั้นยาว
 */
export const MEASURED_TO_LABEL: Record<Measurement["origin"], string> = {
  region_trace: "ผิวผนังด้านใน — ระบบไล่ขอบให้จากหมึกในแบบ แล้วคนกดยืนยัน",
  pointer: "จุดที่คนชี้เอง — ความเที่ยงเท่ากับความเที่ยงของมือที่คลิก"
};

/**
 * กรอบที่ครอบรูปในหน่วยจุดกระดาษ · ใช้ตอบว่ารูปอยู่ตรงไหนของแบบเท่านั้น
 *
 * ข้อนี้ต้องตอบได้ทุกชนิดของการวัดและตอบได้แม้หน้ายังไม่มีสเกล จึงคิดที่นี่
 * ส่วนการแปลงกรอบเป็นเมตรกับการเทียบกรอบกับพื้นที่จริงเป็นงานของ `explainRoomArea`
 * ทั้งสองที่ไล่ค่าน้อยสุดมากสุดจากรูปเดียวกัน ค่าจึงตรงกันเสมอโดยโครงสร้าง
 */
function boundsOf(points: readonly { x: number; y: number }[]) {
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * เทียบสเกลที่ตั้งไว้กับระยะที่แบบเขียนทุกเส้นบนหน้านั้น แล้วคืนเส้นที่คลาดมากที่สุด
 *
 * เอาเส้นที่แย่ที่สุด ไม่ใช่ค่าเฉลี่ย เพราะคนที่ท้วงตัวเลขจะชี้ไปที่เส้นที่แย่ที่สุดเสมอ
 * · เส้นที่แบบเขียนไว้สั้นมากถูกข้าม เพราะเปอร์เซ็นต์ของระยะสั้นแกว่งจนไม่มีความหมาย
 */
const SHORTEST_COMPARABLE_METRES = 0.5;

export function worstScaleGap(
  dimensions: readonly StatedDimension[],
  scale: PageScale | null
): { statedM: number; measuredM: number; percent: number } | null {
  if (!scale) return null;
  let worst: { statedM: number; measuredM: number; percent: number } | null = null;
  for (const dimension of dimensions) {
    if (dimension.valueM < SHORTEST_COMPARABLE_METRES) continue;
    const gap = dimensionDisagreement(dimension, scale);
    if (!gap) continue;
    const percent = (gap.differenceM / gap.statedM) * 100;
    if (!worst || Math.abs(percent) > Math.abs(worst.percent)) {
      worst = { statedM: gap.statedM, measuredM: gap.measuredM, percent };
    }
  }
  return worst;
}

export function explainMeasurement(input: {
  measurement: Measurement;
  value: MeasurementValue;
  scale: PageScale | null;
  /** วิธีที่สเกลของหน้านั้นถูกตั้งขึ้น · null เมื่อยังไม่รู้ */
  method: CalibrationMethod | null;
  /** ระยะที่แบบเขียนไว้บนหน้าเดียวกัน ใช้เทียบว่าสเกลคลาดกี่เปอร์เซ็นต์ */
  dimensions: readonly StatedDimension[];
}): MeasurementEvidence | null {
  const { measurement, value, scale, method, dimensions } = input;
  if (measurement.points.length === 0) return null;

  const steps: EvidenceStep[] = [];
  const openQuestions: string[] = [];

  // รูปที่คำนวณจริงคือ outline ไม่ใช่จุดที่เก็บ · สี่เหลี่ยมเก็บสองมุมแต่มีสี่ด้าน
  const outline = outlinePoints(measurement);
  const usesScale = needsScale(measurement.kind);
  const isArea = measurement.kind === "area" || measurement.kind === "rect";

  // หนึ่ง — รูปที่วัดอยู่ตรงไหนของแบบ · ตอบได้ทุกชนิด และตอบได้แม้ยังไม่มีสเกล
  const bounds = boundsOf(outline);
  steps.push({
    question: "รูปที่วัดอยู่ตรงไหนของแบบ",
    answer: `หน้า ${measurement.page} · ${measurementKindLabel[measurement.kind]} ${outline.length} จุด`,
    working:
      `กรอบบนหน้ากระดาษ x ${pointsText(bounds.minX)} ถึง ${pointsText(bounds.maxX)} · ` +
      `y ${pointsText(bounds.minY)} ถึง ${pointsText(bounds.maxY)} จุด`
  });

  // กรอบที่ครอบรูปคิดเป็นเมตร และสัดส่วนที่รูปจริงกินในกรอบ · null เมื่อไม่ใช่พื้นที่หรือไม่มีสเกล
  const box = isArea ? explainRoomArea(outline, scale, value.areaSquareMetres) : null;

  if (!usesScale) {
    // การนับจำนวนไม่ใช้สเกล จึงไม่ถามสองข้อกลาง และต้องไม่ขึ้นป้ายทวงสเกลให้เสียเวลาเปล่า
  } else if (!scale) {
    openQuestions.push("หน้านี้ยังไม่ได้ตั้งสเกล จุดบนกระดาษจึงยังแปลงเป็นเมตรไม่ได้");
  } else {
    // สอง — จุดบนกระดาษกลายเป็นเมตรได้ยังไง · บรรทัดที่กางต้องเป็นบรรทัดที่พาไปสู่เลขที่รายงาน
    const conversion = conversionWorking({ box, value, scale, isArea });
    steps.push({
      question: "จุดบนกระดาษกลายเป็นเมตรได้ยังไง",
      answer: `คูณด้วย ${metresPerPointText(scale.metresPerPoint)} เมตรต่อจุด ซึ่งเป็นตัวคูณเดียวของทั้งหน้า`,
      working: conversion
    });

    // สาม — สเกลที่ใช้เชื่อได้แค่ไหน
    const gap = worstScaleGap(dimensions, scale);
    const source = method ? calibrationMethodKind(method).label : null;
    if (!source) openQuestions.push("ยังไม่รู้ว่าสเกลของหน้านี้ถูกตั้งขึ้นด้วยวิธีไหน");
    const setFrom = `สเกล 1:${scale.ratio.toFixed(2)}${source ? ` ตั้งจาก${source}` : ""}`;
    if (gap) {
      steps.push({
        question: "สเกลที่ใช้เชื่อได้แค่ไหน",
        answer: `คลาดมากที่สุด ${gap.percent >= 0 ? "+" : ""}${gap.percent.toFixed(2)}% · ${setFrom}`,
        working:
          `เทียบกับระยะที่แบบเขียนไว้ ${dimensions.length} เส้น เส้นที่คลาดมากที่สุดคือ ` +
          `${metresText(gap.statedM)} ม. ซึ่งวัดได้ ${metresText(gap.measuredM)} ม. ` +
          `คลาด ${gap.percent >= 0 ? "+" : ""}${gap.percent.toFixed(2)}%`
      });
    } else {
      /**
       * ยังตอบไม่ได้ต้องอยู่ในช่องคำตอบ ไม่ใช่ในกล่องข้างล่าง (เจ้าของงานเคาะ 2026-09-06)
       * ของเดิมเขียนคำตอบว่า "1:125.29 ตั้งจาก..." ซึ่งตอบคนละคำถามกับที่ถาม แล้วเอา
       * คำตอบจริงไปวางไว้ใน `openQuestions` · คำถามจึงดูเหมือนถูกตอบแล้วทั้งที่ยังไม่ถูกตอบ
       */
      steps.push({
        question: "สเกลที่ใช้เชื่อได้แค่ไหน",
        answer: `ยังบอกไม่ได้ — หน้านี้ไม่มีระยะที่แบบเขียนให้เทียบ · ${setFrom}`,
        working: null
      });
    }

  }

  /**
   * สี่ — เลขที่รายงานคิดออกมาได้ยังไง · ข้อที่พาวงกลับมาปิดที่เลขบนแถว
   *
   * เรียกครั้งเดียวนอกทุกกิ่ง เพราะการนับจำนวนก็ต้องปิดวงเหมือนกันทั้งที่ไม่ผ่านสองข้อกลาง
   * · ชนิดที่ต้องใช้สเกลแต่หน้ายังไม่มีสเกลจะได้ค่าที่รายงานเป็น `null` อยู่แล้ว
   * `closingStep` จึงคืน `null` เอง ไม่ต้องมีเงื่อนไขซ้ำตรงนี้
   */
  const closing = closingStep({ measurement, value, box, isArea });
  if (closing) steps.push(closing);

  // ห้า — ตัวเลขนี้วัดถึงตรงไหน · ขยายความเลขที่เพิ่งปิดวงไป จึงต้องอยู่หลังข้อสี่
  steps.push({
    question: "ตัวเลขนี้วัดถึงตรงไหน",
    answer: MEASURED_TO_LABEL[measurement.origin],
    working:
      measurement.origin === "region_trace"
        ? "ไม่ใช่กึ่งกลางผนัง และไม่ใช่หมุดของเส้นบอกระยะ สามอย่างนี้ให้เลขคนละค่าสำหรับห้องเดียวกัน"
        : null
  });

  if (value.blockedByScale) {
    openQuestions.push("รายการนี้ยังไม่ถูกนับเข้ายอดรวม เพราะหน้าของมันยังไม่มีสเกล");
  }

  return { steps, openQuestions };
}

/**
 * บรรทัดที่แปลงจุดกระดาษเป็นเมตร · ต่างกันตามชนิด เพราะเลขที่รายงานของแต่ละชนิดคนละตัว
 *
 * พื้นที่กางกรอบที่ครอบรูปสองด้าน เพราะเป็นเลขที่เทียบกับเส้นบอกระยะบนแบบได้ตรง ๆ
 * ส่วนความยาวกางระยะรวมเส้นเดียว เพราะกรอบที่ครอบเส้นเฉียงไม่ใช่คำตอบของอะไรเลย
 */
function conversionWorking(input: {
  box: ReturnType<typeof explainRoomArea>;
  value: MeasurementValue;
  scale: PageScale;
  isArea: boolean;
}): string | null {
  const { box, value, scale, isArea } = input;
  const perPoint = metresPerPointText(scale.metresPerPoint);

  if (isArea) {
    if (!box) return null;
    const widthPoints = box.bounds.maxX - box.bounds.minX;
    const depthPoints = box.bounds.maxY - box.bounds.minY;
    return (
      `กรอบที่ครอบรูป กว้าง ${pointsText(widthPoints)} จุด × ${perPoint} = ${metresText(box.widthMetres)} ม.\n` +
      `กรอบที่ครอบรูป ลึก ${pointsText(depthPoints)} จุด × ${perPoint} = ${metresText(box.depthMetres)} ม.`
    );
  }

  if (value.lengthMetres === null) return null;
  // หารกลับจากเลขที่รายงาน ไม่ไล่วัดเอง · เลขที่ได้จึงขัดกับเลขที่รายงานไม่ได้
  const lengthPoints = value.lengthMetres / scale.metresPerPoint;
  return `ความยาวที่ไล่ได้ ${pointsText(lengthPoints)} จุด × ${perPoint} = ${metresText(value.lengthMetres)} ม.`;
}

/**
 * ข้อที่พาวงกลับมาปิดที่เลขบนแถว — ของเดิมไม่มีข้อนี้ เลขที่รายงานจึงไม่เคยโผล่ในแผงเลย
 *
 * พื้นที่ต้องบอกด้วยว่ากรอบที่ครอบรูปกับพื้นที่จริงต่างกันตรงไหน มิฉะนั้นคนที่คูณ
 * กว้างกับลึกตามบรรทัดข้างบนจะได้เลขใหญ่กว่าที่รายงานทุกครั้งที่ห้องไม่ใช่สี่เหลี่ยม
 * แล้วสรุปว่าแอปคิดผิด · ห้องรูปตัว L คือกรณีที่เจอบ่อยที่สุดในผังพื้นจริง
 */
function closingStep(input: {
  measurement: Measurement;
  value: MeasurementValue;
  box: ReturnType<typeof explainRoomArea>;
  isArea: boolean;
}): EvidenceStep | null {
  const { measurement, value, box, isArea } = input;
  const question = "เลขที่รายงานคิดออกมาได้ยังไง";

  if (measurement.kind === "count") {
    if (value.count === null) return null;
    return {
      question,
      answer: `นับได้ ${value.count} จุด`,
      working: null
    };
  }

  if (isArea) {
    if (value.areaSquareMetres === null || !box) return null;
    const area = metresText(value.areaSquareMetres);
    return {
      question,
      answer:
        `พื้นที่ ${area} ตร.ม.` +
        (value.perimeterMetres === null
          ? ""
          : ` · เส้นรอบรูป ${metresText(value.perimeterMetres)} ม.`),
      working:
        `กรอบที่ครอบรูป ${metresText(box.widthMetres)} × ${metresText(box.depthMetres)} = ` +
        `${metresText(box.boundingAreaSquareMetres)} ตร.ม.\n` +
        `รูปมี ${box.sideCount} ด้าน กินในกรอบ ${percentText(box.fillRatio)}% จึงได้ ${area} ตร.ม.`
    };
  }

  if (value.lengthMetres === null) return null;
  const length = metresText(value.lengthMetres);
  // ด้านเดียวไม่มีอะไรให้บวก บรรทัดกางจึงเป็น null แทนที่จะเขียนบรรทัดที่มีเลขตัวเดียว
  const working =
    value.segmentsMetres.length > 1
      ? `${value.segmentsMetres.map(metresText).join(" + ")} = ${length} ม.`
      : null;
  return {
    question,
    answer: `ความยาว ${length} ม.${value.segmentsMetres.length > 1 ? ` จาก ${value.segmentsMetres.length} ด้าน` : ""}`,
    working
  };
}
