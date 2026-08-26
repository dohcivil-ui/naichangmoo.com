/**
 * ข้อมูลประกอบเอกสารที่พิมพ์ออกไปใช้จริง — โลโก้ หัวเอกสาร และผู้ลงนาม
 *
 * แยกออกมาจากคอมโพเนนต์เพราะสองเรื่องนี้ผิดแล้วเสียหายจริง และต้องมีเทสต์คุม:
 *
 * หนึ่ง — **ขนาดไฟล์โลโก้** เก็บรูปเป็น data URI ลงในที่เก็บของเบราว์เซอร์ซึ่งมีเพดานราว 5 MB
 * ระบบที่เราไปดูมาแสดงบนหน้าจอตัวเองว่าใช้ไปแล้ว 2.02 MB จากเพดานราว 4 MB ด้วยข้อมูลแค่
 * สามโครงการ (`docs/research/changkid-easy-planning-hands-on-2026-08-26.md`)
 * ถ้าปล่อยให้ยัดรูปเต็มความละเอียดเข้าไป งานทั้งใบจะเซฟไม่ได้ทันทีและผู้ใช้จะไม่รู้ว่าเพราะอะไร
 *
 * สอง — **ช่องลงนาม** เอกสารราชการไทยใช้วงเล็บใต้เส้นลายเซ็นเพื่อพิมพ์ชื่อเต็มของผู้แทน
 * วงเล็บต้องมีเสมอแม้ยังไม่ได้กรอกชื่อ เพราะผู้ใช้จำนวนมากพิมพ์เอกสารออกมาแล้วเขียนชื่อด้วยปากกา
 * ถ้าซ่อนวงเล็บตอนยังไม่มีชื่อ ก็เท่ากับบังคับให้ต้องกรอกในระบบก่อนถึงจะใช้กระดาษได้
 */

/** ชนิดรูปที่รับเป็นโลโก้ได้ ไม่รับ SVG เพราะ SVG พาสคริปต์เข้ามาในเอกสารได้ */
export const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * เพดานขนาดโลโก้ 200 กิโลไบต์
 *
 * เลือกจากของจริง: โลโก้ที่พิมพ์ในกรอบ 28 มิลลิเมตรที่ 300 จุดต่อนิ้ว ต้องการภาพราว 330 พิกเซล
 * ซึ่ง PNG ที่ความละเอียดนั้นอยู่ราวไม่กี่สิบกิโลไบต์ เพดานนี้จึงเผื่อไว้หลายเท่าแล้ว
 * และยังกินที่เก็บของเบราว์เซอร์ไม่ถึงหนึ่งในยี่สิบของเพดาน
 */
export const MAX_LOGO_BYTES = 200 * 1024;

/** ด้านกว้างและสูงของกรอบโลโก้บนหัวกระดาษ หน่วยมิลลิเมตร */
export const LOGO_BOX_MM = 28;

/**
 * โลโก้ตั้งต้นของโครงการที่สร้างใหม่ เก็บเป็นเส้นทางไฟล์ ไม่ใช่ data URI
 *
 * เป็นตราตัวอย่างที่เขียนคำว่า COMPANY ไว้บนตัวมันเอง จึงอ่านออกว่าเป็นช่องรอใส่ตราจริง
 * ไม่ใช่การอ้างว่าเอกสารนี้เป็นของใคร
 *
 * เก็บเป็นเส้นทางเพราะที่เก็บของเบราว์เซอร์มีเพดานราว 5 MB และรูปเดียวกันฝังซ้ำลงทุกโครงการ
 * เป็น base64 ราว 150 กิโลไบต์ต่อใบ คือการกินโควตาของผู้ใช้ไปกับข้อมูลที่โปรแกรมมีอยู่แล้ว
 */
export const DEFAULT_LOGO_SRC = "/brand/work-plan-default-logo.png";

/**
 * รูปที่มากับโปรแกรมเอง แยกจากรูปที่ผู้ใช้อัปโหลด
 *
 * รับเฉพาะรูปแบบที่ตรงตามนี้เท่านั้น ไม่ใช่เส้นทางอะไรก็ได้ที่ขึ้นต้นด้วยทับ เพราะค่านี้ถูกอ่าน
 * กลับมาจากที่เก็บของเบราว์เซอร์ซึ่งผู้ใช้แก้เองได้ แล้วเอาไปใส่ `src` ของรูปโดยตรง
 */
export const isBundledLogo = (src: string): boolean => /^\/brand\/[a-z0-9-]+\.(png|jpg|webp)$/.test(src);

export type DocumentSignatory = {
  name: string;
  position: string;
};

export type WorkPlanDocumentMeta = {
  /** data URI ของโลโก้ ค่าว่างแปลว่ายังไม่เคยใส่ */
  logoDataUri: string;
  /** ใส่โลโก้ไว้แล้วแต่สั่งไม่ให้แสดง ต่างจากไม่มีโลโก้ */
  showLogo: boolean;
  employerName: string;
  contractNumber: string;
  /** วันที่บนหัวเอกสาร ค่าว่างแปลว่าให้เว้นไว้เขียนมือ */
  documentDate: string;
  siteName: string;
  contractor: DocumentSignatory;
  employer: DocumentSignatory;
};

export const emptySignatory = (): DocumentSignatory => ({ name: "", position: "" });

export const defaultDocumentMeta = (): WorkPlanDocumentMeta => ({
  logoDataUri: "",
  showLogo: true,
  employerName: "",
  contractNumber: "",
  documentDate: "",
  siteName: "",
  contractor: emptySignatory(),
  employer: emptySignatory()
});

/**
 * ข้อมูลเอกสารของโครงการที่เพิ่งสร้าง ต่างจาก `defaultDocumentMeta` ตรงโลโก้ตั้งต้น
 *
 * แผนที่บันทึกไว้ก่อนรุ่นนี้ต้องไม่มีตราโผล่ขึ้นมาเอง เพราะเอกสารที่พิมพ์ส่งราชการไปแล้ว
 * ห้ามเปลี่ยนหน้าตาเพราะการอัปเกรด ตัวอ่านไฟล์เก่าจึงใช้ `defaultDocumentMeta` ต่อไป
 * และค่าตั้งต้นที่มีตราใช้เฉพาะกระดานที่ยังไม่เคยมีอะไรอยู่เลย
 */
export const newPlanDocumentMeta = (): WorkPlanDocumentMeta => ({
  ...defaultDocumentMeta(),
  logoDataUri: DEFAULT_LOGO_SRC
});

/**
 * ขนาดจริงเป็นไบต์ของ data URI ฐาน 64
 *
 * คิดจากความยาวของข้อความ ไม่ใช่ถอดรหัสออกมาทั้งก้อนแล้ววัด เพราะการถอดรหัสไฟล์สองร้อยกิโลไบต์
 * ทุกครั้งที่ผู้ใช้พิมพ์หนึ่งตัวอักษรเป็นงานที่ไม่จำเป็น สูตรคือทุกสี่ตัวอักษรได้สามไบต์
 * แล้วหักตัวเติมท้าย (`=`) ออก
 */
export function dataUriBytes(dataUri: string): number {
  const comma = dataUri.indexOf(",");
  if (comma < 0) return 0;
  const payload = dataUri.slice(comma + 1);
  if (payload === "") return 0;
  if (!dataUri.slice(0, comma).includes(";base64")) return payload.length;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

export const mimeOfDataUri = (dataUri: string): string => {
  if (!dataUri.startsWith("data:")) return "";
  const end = dataUri.search(/[;,]/);
  return end < 0 ? "" : dataUri.slice(5, end);
};

export type LogoRejection =
  | { ok: true; dataUri: string; bytes: number }
  | { ok: false; reason: string };

/**
 * รับหรือปฏิเสธรูปที่ผู้ใช้เลือก พร้อมเหตุผลเป็นภาษาที่ผู้ใช้เข้าใจ
 *
 * คืนเหตุผลเป็นข้อความ ไม่ใช่รหัสข้อผิดพลาด เพราะปลายทางเดียวของค่านี้คือข้อความบนหน้าจอ
 * และการแปลรหัสเป็นข้อความที่หน้าจออีกทีคือที่ที่ข้อความหายบ่อยที่สุด
 */
export function acceptLogo(dataUri: string): LogoRejection {
  if (!dataUri.startsWith("data:")) {
    return { ok: false, reason: "อ่านไฟล์รูปไม่ได้ ลองเลือกไฟล์ใหม่อีกครั้ง" };
  }

  const mime = mimeOfDataUri(dataUri);
  if (!(ACCEPTED_LOGO_TYPES as readonly string[]).includes(mime)) {
    return {
      ok: false,
      reason: `รับเฉพาะไฟล์ PNG JPG และ WEBP — ไฟล์ที่เลือกเป็น ${mime || "ชนิดที่ไม่รู้จัก"}`
    };
  }

  const bytes = dataUriBytes(dataUri);
  if (bytes === 0) return { ok: false, reason: "ไฟล์รูปว่างเปล่า" };
  if (bytes > MAX_LOGO_BYTES) {
    // ปัดขนาดจริงขึ้นและปัดเพดานลง เพราะปัดแบบปกติทั้งคู่แล้วรูปที่เกินมาไม่กี่ไบต์
    // จะขึ้นข้อความว่า "รูปนี้ 200 กิโลไบต์ ใหญ่กว่าเพดาน 200 กิโลไบต์" ซึ่งอ่านแล้วงง
    const kb = Math.ceil(bytes / 1024);
    const cap = Math.floor(MAX_LOGO_BYTES / 1024);
    return {
      ok: false,
      reason: `รูปนี้ ${kb.toLocaleString("th-TH")} กิโลไบต์ ใหญ่กว่าเพดาน ${cap} กิโลไบต์ — ` +
        `ย่อรูปก่อนแล้วลองใหม่ เพราะที่เก็บของเบราว์เซอร์มีจำกัด ถ้าใส่รูปใหญ่เกินไปงานทั้งใบจะเซฟไม่ได้`
    };
  }

  return { ok: true, dataUri, bytes };
}

/**
 * ข้อความที่อยู่ในวงเล็บใต้เส้นลายเซ็น
 *
 * ยังไม่กรอกชื่อก็คืนช่องว่างที่กว้างพอจะเขียนด้วยปากกาได้ ไม่คืนขีดหรือคำว่าไม่ระบุ
 * เพราะเอกสารที่พิมพ์ออกไปแล้วต้องยังกรอกด้วยมือได้
 */
export const signatureName = (signatory: DocumentSignatory): string =>
  signatory.name.trim() === "" ? " ".repeat(24) : signatory.name.trim();

/** ตำแหน่งใต้วงเล็บ ถ้ายังไม่กรอกให้เว้นบรรทัดไว้ ไม่ต้องขึ้นคำแทน */
export const signaturePosition = (signatory: DocumentSignatory): string => signatory.position.trim();

/** โลโก้จะขึ้นบนกระดาษก็ต่อเมื่อมีรูปจริงและไม่ได้สั่งซ่อน */
export const logoVisible = (meta: WorkPlanDocumentMeta): boolean =>
  meta.showLogo && meta.logoDataUri !== "";
