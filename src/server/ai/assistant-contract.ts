/**
 * สัญญาของผู้ช่วย AI ทุกแอป
 *
 * ชนิดล้วน ไม่มีตรรกะ ไม่ import อะไรที่ผูกกับ Next หรือฐานข้อมูล เพื่อให้สคริปต์บรรทัดคำสั่ง
 * ที่ใช้เทียบรุ่นแบบจำลอง เรียกชนิดเดียวกับที่แอปใช้จริงได้
 *
 * เส้นแบ่งที่สำคัญที่สุดของทั้งไฟล์นี้อยู่ที่ `input` กับ `facts`
 *
 *   `input` คือโจทย์ที่โมเดลต้องคิด
 *   `facts` คือ **ตัวเลขที่ระบบคำนวณเสร็จแล้ว** ส่งไปให้โมเดล *อ้าง* เฉย ๆ
 *
 * แยกกันไม่ใช่เพื่อความสวยงาม แต่เพื่อให้เทสต์พิสูจน์ได้ว่าโจทย์ที่ส่งออกไปไม่เคยมีการขอให้
 * แบบจำลองคำนวณเงิน (กฎ G3) ถ้าสองอย่างนี้ปนเป็นก้อนเดียว กฎนั้นจะกลายเป็นเรื่องของวินัย
 * ซึ่งวินัยพังเงียบและไม่มีอะไรจับได้
 */

/**
 * เจ็ดจังหวะที่งานวิศวกรรมโยธาไทยเหมือนกันหมด ไม่ว่าจะถอดปริมาณ ค่า K กำแพงกันดิน หรือค่าทดแทน
 * เปลี่ยนแค่ชื่อเอกสารกับสูตร จังหวะไม่เปลี่ยน — ดู `docs/architecture/ai-assistant-design.md` ข้อ 1
 *
 * สี่ในเจ็ดจังหวะ (`preflight` `critique` `explain` `compose`) แบบจำลองไม่คืนตัวเลขเลย
 * ทำผิดทางการเงินจึงไม่ได้ในทางโครงสร้าง ไม่ใช่เพราะเราเขียน prompt ขอไว้ดี ๆ
 */
export type AssistantVerb = "extract" | "preflight" | "draft" | "revise" | "critique" | "explain" | "compose";

/** จังหวะที่แบบจำลองไม่มีทางคืนตัวเลขที่ไหลเข้าการคำนวณได้เลย */
export const TEXT_ONLY_VERBS: readonly AssistantVerb[] = ["preflight", "critique", "explain", "compose"];

/**
 * ที่มาของข้อความหนึ่งบรรทัด
 *
 * ทุกฟิลด์ประกอบจากชุดข้อมูลในรีโป ไม่ใช่จากคำตอบของแบบจำลอง — โดยเฉพาะ `clause`
 * **เลขข้อคือสิ่งที่แบบจำลองแต่งได้เนียนที่สุดและคนตรวจจับได้ยากที่สุด** ใครก็ตรวจไม่ออกว่า
 * "ข้อ 13" ที่มันเขียนมานั้นมีจริงไหม จนกว่าจะเปิดหนังสือ ที่นี่จึงไม่เปิดโอกาสให้มันเขียนเลย
 */
export type Citation = {
  /** ชื่อเอกสารอย่างที่คนเรียกกันจริง เช่น "หนังสือ ว 109" */
  document: string;
  /** รหัสชุดข้อมูลในรีโป เช่น `escalation-k/cabinet-w109-be2532` `null` เมื่อยังไม่มีไฟล์ในคลัง */
  datasetId: string | null;
  /**
   * sha256 ของไฟล์ต้นฉบับ ไม่ใช่ของ JSON ที่ถอดออกมา
   *
   * **`null` ได้ และต้องเป็น `null` เมื่อยังไม่มีไฟล์ต้นฉบับในคลัง** ห้ามยืมรหัสย่อของเอกสาร
   * ฉบับอื่นมาแปะให้ดูครบ เพราะรหัสย่อคือคำสัญญาว่า "เปิดไฟล์นี้แล้วจะเจอข้อความนี้"
   * คำสัญญาที่พิสูจน์ได้ว่าไม่จริง ทำลายความน่าเชื่อของทุกบรรทัดที่ระบบเคยอ้าง ไม่ใช่แค่บรรทัดนั้น
   */
  datasetSha256: string | null;
  clause: string | null;
  page: number | null;
  /** ชื่อผู้รับรองการถอดข้อมูลเทียบต้นฉบับ `null` แปลว่ายังไม่มีใครเซ็น */
  reviewedBy: string | null;
  /** ธงของชุดข้อมูลเองว่าหลักเกณฑ์ข้อนี้ตรวจกับฉบับจริงแล้วหรือยัง */
  verified: boolean;
};

export type AssistantRequest = {
  /** slug จาก `platformApps` เท่านั้น ไม่ใช่ข้อความอิสระ */
  app: string;
  verb: AssistantVerb;
  /** สิ่งที่ผู้ช่วยกำลังทำงานด้วย ลง audit ตรง ๆ เช่น `project:abc123` */
  subject: string;
  /** โจทย์ดิบก่อนตัดข้อมูลส่วนเกิน ผ่าน `project()` ของทักษะก่อนเข้า prompt เสมอ */
  input: unknown;
  /** ตัวเลขที่ระบบคำนวณเสร็จแล้ว ส่งเป็นข้อความให้แบบจำลองอ้าง ห้ามให้มันคำนวณเอง */
  facts?: string[];
  /** คำสั่งภาษาคน ใช้เฉพาะ `revise` */
  instruction?: string;
};

export type AssistantUsage = {
  inputTokens: number;
  outputTokens: number;
  /**
   * ค่าใช้จ่ายเป็นจำนวนเต็ม micro USD ไม่ใช่บาท
   *
   * `costBaht()` คูณด้วยอัตราแลกเปลี่ยนที่ตรึงไว้ที่ 35 การเก็บบาทลงประวัติจึงเท่ากับแช่
   * อัตราแลกเปลี่ยนของวันนี้ไว้ตลอดกาล แล้ววันที่อัตราเปลี่ยน ยอดสะสมย้อนหลังจะผิดทั้งชุด
   */
  costMicroUsd: number;
  elapsedMs: number;
};

export type AssistantQuotaView = {
  /** ใช้ไปแล้วกี่ครั้งในเดือนไทยนี้ นับรวมข้ามทุกแอป */
  used: number;
  limit: number;
  /** เวลาที่โควตาจะคืน คือต้นเดือนไทยถัดไป */
  resetsAtIso: string;
};

export type AssistantProposal<TDraft = unknown> = {
  proposalId: string;
  app: string;
  verb: AssistantVerb;
  /**
   * สิ่งที่แบบจำลองเสนอ **ห้ามมีช่องเงินเด็ดขาด** (กฎ G1 มีเทสต์เดินไล่ทุกทักษะบังคับ)
   * ระบบเป็นคนแปลงสัดส่วนที่เสนอมาเป็น satang ด้วยกฎเดียวกับที่ทั้งแพลตฟอร์มใช้
   */
  draft: TDraft;
  /** สมมติฐานที่ผู้ใช้ควรตรวจ เป็นภาษาไทย */
  assumptions: string[];
  citations: Citation[];
  modelId: string;
  /** เก็บ hash ไม่เก็บข้อความ ตามคำวินิจฉัยเรื่องการเก็บ prompt */
  promptHash: string;
  usage: AssistantUsage;
  quota: AssistantQuotaView;
  /** คำเตือนที่ต้องขึ้นจอเสมอ เช่น หลักเกณฑ์นี้ยังไม่ตรวจกับฉบับจริง (กฎ G8) */
  warnings: string[];
};

export type AssistantRefusalReason =
  | "not_signed_in"
  | "not_entitled"
  | "over_monthly_cap"
  | "source_not_reviewed"
  | "input_incomplete"
  | "no_api_key"
  | "refused"
  | "unparsable"
  | "unavailable";

export type AssistantRefusal = {
  ok: false;
  reason: AssistantRefusalReason;
  /** ข้อความภาษาไทยที่ขึ้นจอได้ทันที บอกว่าเกิดอะไรและผู้ใช้ทำอะไรต่อได้ */
  message: string;
  /** โควตาปัจจุบัน ส่งกลับด้วยเมื่อรู้ เพื่อให้จอบอกได้ว่าเหลือกี่ครั้งโดยไม่ต้องถามซ้ำ */
  quota?: AssistantQuotaView;
};

export type AssistantResult<TDraft = unknown> = { ok: true; proposal: AssistantProposal<TDraft> } | AssistantRefusal;

/** สิ่งที่คนทำกับข้อเสนอหนึ่งอัน `expired` ไม่ใช่การกระทำของคน แต่เป็นผลของเวลา */
export type ProposalDecision = "proposed" | "accepted" | "rejected" | "partially_accepted" | "expired";

/**
 * ข้อเสนอที่ไม่มีใครตัดสินภายในหน้าต่างนี้ถือว่าหมดอายุ ตรวจตอนกดตัดสิน ไม่มีงานเบื้องหลังมากวาด
 *
 * มีเพราะร่างที่ค้างข้ามเดือนแล้วถูกกดรับทีหลัง จะทับงานที่แก้ไปแล้วโดยที่คนกดไม่รู้ว่ากำลัง
 * ย้อนเวลากลับไปเท่าไร
 */
export const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
