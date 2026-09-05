/**
 * กางวิธีคิดของรายการวัดหนึ่งรายการออกมาเป็นบรรทัดที่คนตรวจตามได้ (IP-242)
 *
 * **คำสั่งของเจ้าของงาน** "ทำเป็นหลักฐานการคิดคำนวณไว้ในแอป ฝังไว้เลยนะวิธีการคิดคำนวณ
 * แบบนี้ ไม่ว่าจะเป็นงานไหนก็ให้ใช้หลักการนี้ ลากเส้นทาบวัด เทียบบัญญัติไตรยางศ์ เทียบสเกล
 * มีข้อมูลที่ตอบได้จริง แบบนี้ user ก็จะได้คำตอบ ไม่คาใจ"
 * (`docs/plans/2026-09-05-every-number-shows-its-working.md`)
 *
 * **ไฟล์นี้ไม่คำนวณตัวเลขที่รายงานใหม่** ตัวเลขทุกตัวรับเข้ามาจาก `measure()` ที่เดียว
 * เหมือนเดิม · ถ้ามันคิดเอง จะกลายเป็นเลขที่สองที่อาจไม่ตรงกับเลขแรก ซึ่งแย่กว่าไม่มี
 * คำอธิบายเลย · เหตุผลเดียวกับที่เขียนไว้หัว `room-area-explained.ts`
 *
 * **เรียงตามลำดับที่คนอ่านจะถาม ไม่ใช่ลำดับที่โปรแกรมคำนวณ** สี่คำถามในแผนคือ
 * เส้นที่วัดอยู่ตรงไหนของแบบ · จุดบนกระดาษกลายเป็นเมตรได้ยังไง · สเกลเชื่อได้แค่ไหน
 * · ตัวเลขนี้วัดถึงตรงไหน
 *
 * **สิ่งที่ยังตอบไม่ได้ต้องขึ้นให้เห็น** หลักฐานที่แสร้งว่ารู้ทุกอย่างคือหลักฐานที่เชื่อไม่ได้
 * จึงมี `openQuestions` แยกออกมาต่างหาก ไม่ใช่เงียบหรือเดาแทน
 *
 * ไฟล์นี้ไม่รู้จัก React และไม่รู้จักฐานข้อมูล
 */

import { calibrationMethodKind, type CalibrationMethod } from "@/lib/drawing-calibration-method";
import {
  measurementKindLabel,
  type Measurement,
  type MeasurementValue
} from "@/lib/drawing-measurement";
import {
  dimensionDisagreement,
  type PageScale,
  type StatedDimension
} from "@/lib/drawing-scale";

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

  // หนึ่ง — เส้นที่วัดอยู่ตรงไหนของแบบ
  const bounds = boundsOf(measurement.points);
  steps.push({
    question: "รูปที่วัดอยู่ตรงไหนของแบบ",
    answer: `หน้า ${measurement.page} · ${measurementKindLabel[measurement.kind]} ${measurement.points.length} จุด`,
    working:
      `กรอบบนหน้ากระดาษ x ${pointsText(bounds.minX)} ถึง ${pointsText(bounds.maxX)} · ` +
      `y ${pointsText(bounds.minY)} ถึง ${pointsText(bounds.maxY)} จุด`
  });

  // สอง — จุดบนกระดาษกลายเป็นเมตรได้ยังไง
  if (!scale) {
    openQuestions.push("หน้านี้ยังไม่ได้ตั้งสเกล จุดบนกระดาษจึงยังแปลงเป็นเมตรไม่ได้");
  } else {
    const widthPoints = bounds.maxX - bounds.minX;
    const depthPoints = bounds.maxY - bounds.minY;
    const widthM = widthPoints * scale.metresPerPoint;
    const depthM = depthPoints * scale.metresPerPoint;
    steps.push({
      question: "จุดบนกระดาษกลายเป็นเมตรได้ยังไง",
      answer: `คูณด้วย ${metresPerPointText(scale.metresPerPoint)} เมตรต่อจุด ซึ่งเป็นตัวคูณเดียวของทั้งหน้า`,
      working:
        `กว้าง ${pointsText(widthPoints)} จุด × ${metresPerPointText(scale.metresPerPoint)} = ${metresText(widthM)} ม.\n` +
        `ลึก ${pointsText(depthPoints)} จุด × ${metresPerPointText(scale.metresPerPoint)} = ${metresText(depthM)} ม.`
    });

    // สาม — สเกลที่ใช้เชื่อได้แค่ไหน
    const gap = worstScaleGap(dimensions, scale);
    const source = method ? calibrationMethodKind(method).label : null;
    if (!source) openQuestions.push("ยังไม่รู้ว่าสเกลของหน้านี้ถูกตั้งขึ้นด้วยวิธีไหน");
    if (gap) {
      steps.push({
        question: "สเกลที่ใช้เชื่อได้แค่ไหน",
        answer: `1:${scale.ratio.toFixed(2)}${source ? ` ตั้งจาก${source}` : ""}`,
        working:
          `เทียบกับระยะที่แบบเขียนไว้ ${dimensions.length} เส้น เส้นที่คลาดมากที่สุดคือ ` +
          `${metresText(gap.statedM)} ม. ซึ่งวัดได้ ${metresText(gap.measuredM)} ม. ` +
          `คลาด ${gap.percent >= 0 ? "+" : ""}${gap.percent.toFixed(2)}%`
      });
    } else {
      steps.push({
        question: "สเกลที่ใช้เชื่อได้แค่ไหน",
        answer: `1:${scale.ratio.toFixed(2)}${source ? ` ตั้งจาก${source}` : ""}`,
        working: null
      });
      openQuestions.push(
        "หน้านี้ยังไม่มีระยะที่แบบเขียนให้เทียบ จึงยังบอกไม่ได้ว่าสเกลคลาดกี่เปอร์เซ็นต์"
      );
    }
  }

  // สี่ — ตัวเลขนี้วัดถึงตรงไหน
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
