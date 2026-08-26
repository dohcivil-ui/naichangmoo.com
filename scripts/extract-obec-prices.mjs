import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * อ่านบัญชีราคาค่าวัสดุและค่าแรงงานของ สพฐ. ออกมาเป็นข้อมูล
 *
 * เล่มนี้เป็นแหล่งเดียวที่ให้ "ค่าวัสดุ + ค่าแรง ต่อหนึ่งหน่วยงาน" มาคู่กันในบรรทัดเดียว
 * ราคาวัสดุของ สนค. บอกราคาของของ แต่ไม่บอกว่าติดตั้งหนึ่งตารางเมตรใช้ค่าแรงเท่าไร
 * ส่วนบัญชีค่าแรงของกรมบัญชีกลางบอกค่าแรงต่อหน่วย แต่ไม่ผูกกับราคาวัสดุของงานนั้น
 *
 * **อ่านด้วยตำแหน่ง ไม่ใช่ด้วยการเดาจากข้อความ** รอบแรกลองประกอบชิ้นข้อความกลับเป็นบรรทัด
 * แล้วจับด้วย regex ผลคือราคา 168 ถูกอ่านเป็น 1 กับ 68 เพราะ PDF ตัดตัวเลขเป็นสองชิ้น
 * หัวตารางของเล่มนี้อยู่ที่ x เดิมทุกหน้า จึงแบ่งคอลัมน์จากหัวตารางแล้วโยนแต่ละชิ้นเข้าคอลัมน์
 * ตามพิกัดของมัน วิธีนี้ไม่มีทางอ่านเลขข้ามคอลัมน์ได้เลย
 *
 * ใช้:
 *   node scripts/extract-obec-prices.mjs <fromPage> <toPage> <out.json>
 */

const [fromPage = "5", toPage = "89", out = "obec-prices.json"] = process.argv.slice(2);
const SOURCE = "km/ราคาค่าวัสดุและค่าแรงงานปี 2569 กลุ่มออกแบบและก่อสร้าง สพฐ.pdf";

/** ขอบคอลัมน์ วัดจากหัวตาราง CODE 91 · รายการ 218 · หน่วย 352 · ค่าวัสดุ 389 · ค่าแรง 433 · หมายเหตุ 495 */
const COLUMNS = [
  { key: "code", from: 0, to: 115 },
  { key: "name", from: 115, to: 345 },
  { key: "unit", from: 345, to: 385 },
  { key: "material", from: 385, to: 428 },
  { key: "labour", from: 428, to: 470 },
  { key: "note", from: 470, to: Infinity }
];

const GLUE = /^[.,()%/:\-–—+]+$/;

/**
 * ซ่อมสระและวรรณยุกต์ที่หลุดออกจากพยัญชนะ
 *
 * ชั้นข้อความของเล่มนี้วางสระบนและวรรณยุกต์เป็นชิ้นแยก ทำให้คำว่า พื้น ออกมาเป็น พื น
 * และ น้ำ ออกมาเป็น นํ ้า ถ้าไม่ซ่อมตรงนี้ ผู้ใช้จะค้นคำว่า พื้น แล้วไม่เจองานพื้นทั้งหมวด
 */
const COMBINING = "\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E";
function repairThai(text) {
  return text
    .replace(new RegExp(`\\s+([${COMBINING}])`, "g"), "$1")
    .replace(/ํา/g, "ำ")
    .replace(/ํ\s*้า/g, "้ำ")
    // คำที่ ํ หายไปทั้งตัวจนเหลือแต่ า — ซ่อมเป็นคำ ๆ เพราะกฎทั่วไปจะไปโดนคำที่ถูกอยู่แล้ว
    .replace(/สาเร็จ/g, "สำเร็จ")
    .replace(/กาแพง/g, "กำแพง")
    .replace(/จานวน/g, "จำนวน")
    .replace(/น้าหนัก/g, "น้ำหนัก")
    .replace(/\s*\.\s*\./g, ".");
}

/** ชิ้นที่เป็นเครื่องหมายวรรคตอนล้วนต้องเกาะกับชิ้นข้างเคียง ไม่งั้น ลบ.ม. จะกลายเป็น ลบ . ม . */
function joinCell(cells) {
  const joined = cells
    .map((cell) => cell.s)
    .reduce((line, token, index, all) => {
      if (index === 0) return token;
      const glued = GLUE.test(token) || GLUE.test(all[index - 1]);
      return glued ? line + token : `${line} ${token}`;
    }, "");
  return repairThai(joined).replace(/\s+/g, " ").trim();
}

const toNumber = (value) => {
  const cleaned = value.replace(/[^\d.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

/** "เผื่อวัสดุ 7 %" ในหมายเหตุคือกฎการเผื่อของแถวนั้น ต้องเป็นตัวเลข ไม่ใช่ข้อความที่ผู้ใช้ต้องอ่านเอง */
function readAllowance(note) {
  const match = note.match(/เผื่อวัสดุ\s*([\d.]+)\s*%/);
  return match ? Number(match[1]) : null;
}

const doc = await getDocument({ data: new Uint8Array(readFileSync(SOURCE)), useSystemFonts: true }).promise;
const last = Math.min(Number(toPage), doc.numPages);
const rows = [];
let section = "";
let group = "";

for (let n = Number(fromPage); n <= last; n += 1) {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  const lines = new Map();
  for (const item of content.items) {
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    const key = [...lines.keys()].find((existing) => Math.abs(existing - y) <= 3) ?? y;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push({ x: item.transform[4], s: item.str.trim() });
  }

  for (const [, cells] of [...lines.entries()].sort((a, b) => b[0] - a[0])) {
    const sorted = cells.sort((a, b) => a.x - b.x);
    const bucket = Object.fromEntries(COLUMNS.map((column) => [column.key, []]));
    for (const cell of sorted) {
      const column = COLUMNS.find((entry) => cell.x >= entry.from && cell.x < entry.to);
      if (column) bucket[column.key].push(cell);
    }
    const code = joinCell(bucket.code);
    const name = joinCell(bucket.name);
    const unit = joinCell(bucket.unit);
    const material = joinCell(bucket.material);
    const labour = joinCell(bucket.labour);
    const note = joinCell(bucket.note).replace(/^\.$/, "").trim();

    // หัวหมวดใหญ่ เช่น A5. 1.5 งานเหล็กเสริมคอนกรีต — รหัสลงท้ายด้วยจุด ไม่ใช่รหัสรายการ
    if (/^[A-Z]\d*\.$/.test(code) && name) {
      section = name;
      group = "";
      continue;
    }
    // หัวกลุ่มย่อยขึ้นต้นด้วย a เดี่ยว ๆ เก็บไว้เป็นบริบทของแถวถัดไป
    if (code === "a" && name) {
      group = name;
      continue;
    }
    if (!/^[A-Z]\d{4}$/.test(code)) continue;
    if (!unit) continue;

    rows.push({
      code,
      name,
      section,
      group,
      unit,
      materialBaht: toNumber(material),
      labourBaht: toNumber(labour),
      allowancePercent: readAllowance(note),
      note,
      page: n
    });
  }
}

writeFileSync(out, JSON.stringify(rows, null, 1));
const both = rows.filter((row) => row.materialBaht !== null && row.labourBaht !== null);
console.log("rows", rows.length, "pages", fromPage, "-", last);
console.log("with both prices", both.length);
console.log("with allowance", rows.filter((row) => row.allowancePercent !== null).length);
console.log(rows.slice(0, 3));
