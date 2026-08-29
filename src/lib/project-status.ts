export type RoadmapItem = {
  id: string;
  title: string;
  status: "done" | "planned" | "in_progress";
  phase: string;
  /**
   * Which app (or platform area) the item belongs to, so /roadmap can answer "how far along is
   * this app" the way the owner reads progress. Optional because item files older than v0.66.0
   * predate the field; an item without one is grouped under "platform".
   */
  app?: string;
};

export type RoadmapStatus = {
  version: string;
  title: string;
  description: string;
  scope: string[];
  updatedAt: string;
  status: string;
  verification: string[];
  rollback: string;
  items: RoadmapItem[];
};

export type HandoffStatus = {
  /**
   * รุ่นที่บันทึกฉบับนี้ปิด มีเฉพาะเมื่อเซสชันนั้นปิดรุ่นจริง
   *
   * ไม่ใช่ทุกบันทึกส่งงานจะปิดรุ่น บางเซสชันตัดสินใจอย่างเดียว บางเซสชันวางรากฐานโดยไม่แตะโค้ด
   * และบางเซสชันจบลงด้วยงานที่ยังไม่ได้ commit บันทึกพวกนั้นต้องอยู่ในบัญชีเหมือนกัน
   * เพราะบัญชีนี้คือบัญชีของบันทึกส่งงาน ไม่ใช่บัญชีของรุ่น การบังคับให้มีเลขรุ่นทำให้ต้องกรอกเลขปลอม
   * หรือทิ้งบันทึกไว้นอกบัญชี ซึ่งเป็นสิ่งที่เกิดขึ้นจริงมาแล้วกับสิบเอ็ดฉบับ
   */
  version?: string;
  title: string;
  description: string;
  scope: string[];
  verification: string[];
  rollback: string;
  path: string;
};

export type ProjectStatus = { roadmap: RoadmapStatus; handoffs: HandoffStatus[]; generatedAt: string };
