export type EstimationStage = 1 | 2 | 3 | 4;
export type ProjectPath = "private" | "government";

export type DemoWorkflowReview = {
  reviewed: boolean;
  takeoffReviewed: boolean;
  costReviewed: boolean;
};

export type GuidedWorkflowState = {
  projectPath: ProjectPath | null;
  scaleConfirmed: boolean;
  drawingReviewed: boolean;
  takeoffReviewed: boolean;
  priceSetApproved: boolean;
  costReviewed: boolean;
};

export function resolveDemoWorkflowStage({ reviewed, takeoffReviewed, costReviewed }: DemoWorkflowReview): EstimationStage {
  if (costReviewed) return 4;
  if (takeoffReviewed) return 3;
  if (reviewed) return 2;
  return 1;
}

export function resolveGuidedWorkflowStage(state: GuidedWorkflowState): EstimationStage {
  if (!state.projectPath || !state.scaleConfirmed || !state.drawingReviewed) return 1;
  if (!state.takeoffReviewed) return 2;
  if (!state.priceSetApproved || !state.costReviewed) return 3;
  return 4;
}

export function canOpenWorkflowStage(requested: EstimationStage, unlocked: EstimationStage) {
  return requested <= unlocked;
}

export function getWorkflowBlocker(state: GuidedWorkflowState) {
  if (!state.projectPath) return "เลือกสายงานเอกชนหรือราชการก่อนเริ่มโครงการ";
  if (!state.scaleConfirmed) return "ยืนยันการตั้งสเกลจากระยะอ้างอิงก่อนถอดปริมาณ";
  if (!state.drawingReviewed) return "ตรวจ revision แบบและข้อขัดแย้งก่อนถอดปริมาณ";
  if (!state.takeoffReviewed) return "ทบทวนปริมาณ หน่วย สูตร และหลักฐานจากแบบก่อนตั้งราคา";
  if (!state.priceSetApproved) return "เลือกและอนุมัติ price set ที่มีจังหวัด เดือน และที่มาราคาก่อนคำนวณ";
  if (!state.costReviewed) return "ทบทวนวัสดุ ค่าแรง VAT และต้นทุนต่อหน่วยก่อนสรุป BOQ";
  return "BOQ พร้อมเข้าสู่การทบทวนเอกสาร แต่ยังห้ามส่งออกจน baseline และ approval จริงพร้อม";
}
