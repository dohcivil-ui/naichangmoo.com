import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * อ่านบัญชีค่าแรงงาน/ดำเนินการสำหรับถอดแบบคำนวณราคากลางงานก่อสร้าง ของกรมบัญชีกลาง
 *
 * ฉบับที่อ่านคือ ว809 ลงวันที่ 14 พฤศจิกายน 2568 ซึ่งยกเลิกฉบับเดิมตามหนังสือ ว135 ทิ้งไปแล้ว
 * นี่คือค่าแรงที่หน่วยงานรัฐต้องใช้คำนวณราคากลาง ไม่ใช่ค่าแรงที่ผู้ประมาณตั้งเอง และไม่ใช่
 * ค่าแรงในเล่ม สพฐ. ซึ่งเป็นคู่มือเบื้องต้นของสถานศึกษาและอ้างอิงในสัญญาไม่ได้
 *
 * **หนึ่งรายการมีได้หลายอัตรา** เพราะค่าแรงผูกกับปริมาณงาน เช่น ตอกเสาเข็มต้นละ 2,691 บาท
 * เมื่อมี 100 ต้นขึ้นไป แต่เป็น 3,326 บาท เมื่อมี 25 ถึง 50 ต้น การเก็บแค่ตัวเดียวคือการทิ้ง
 * เงื่อนไขที่ทำให้ตัวเลขนั้นถูกต้อง ที่นี่จึงเก็บทุกอัตราพร้อมเงื่อนไขของมันเสมอ
 *
 * ใช้:
 *   node scripts/extract-cgd-labour.mjs <out.json> [fromPage] [toPage]
 */

const [out = "cgd-labour.json", fromPage = "2", toPage = "45"] = process.argv.slice(2);
const SOURCE = "km/กรมบัญชีกลาง ว809 ลว.14 พ.ย. 68 การปรับปรุงบัญชีค่าแรงสำหรับถอดแบบงานก่อสร้าง.pdf";

/** ขอบคอลัมน์ วัดจากหัวตาราง ลำดับที่ 49 · รายการ 176 · หน่วย 314 · ค่าแรง/หน่วย 352 · หมายเหตุ 468 */
const COLUMNS = [
  { key: "ordinal", from: 0, to: 74 },
  { key: "name", from: 74, to: 312 },
  { key: "unit", from: 312, to: 350 },
  { key: "rate", from: 350, to: 392 },
  { key: "note", from: 392, to: Infinity }
];

const GLUE = /^[.,()%/:\-–—+"]+$/;
const COMBINING = "\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E";

function repairThai(text) {
  return text
    .replace(new RegExp(`\\s+([${COMBINING}])`, "g"), "$1")
    .replace(/ํา/g, "ำ")
    .replace(/ํ\s*้า/g, "้ำ")
    .replace(/สาเร็จ/g, "สำเร็จ")
    .replace(/จานวน/g, "จำนวน")
    .replace(/ดาเนินการ/g, "ดำเนินการ")
    .replace(/น้าหนัก/g, "น้ำหนัก");
}

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
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const doc = await getDocument({ data: new Uint8Array(readFileSync(SOURCE)), useSystemFonts: true }).promise;
const last = Math.min(Number(toPage), doc.numPages);
const items = [];
let section = "";
let current = null;
let variant = null;

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

    const ordinal = joinCell(bucket.ordinal);
    const name = joinCell(bucket.name);
    const unit = joinCell(bucket.unit);
    const rate = toNumber(joinCell(bucket.rate));
    const note = joinCell(bucket.note);

    // หัวหมวดใหญ่ เช่น "1 งานโครงสร้างวิศวกรรม" — มีลำดับหลักเดียวและไม่มีหน่วยกับค่าแรง
    if (/^\d+$/.test(ordinal) && name && !unit && rate === null) {
      section = name;
      current = null;
      variant = null;
      continue;
    }

    // แถวที่มีลำดับ เริ่มรายการใหม่เสมอ
    if (/^\d+(\.\d+)*$/.test(ordinal) && name) {
      current = { code: ordinal, title: name, section, variants: [] };
      items.push(current);
      variant = null;
      if (rate !== null && unit) {
        variant = { name: "", rates: [] };
        current.variants.push(variant);
        variant.rates.push({ unit, baht: rate, condition: note, page: n });
      }
      continue;
    }

    if (!current) continue;

    /**
     * แถวต่อเนื่องมีสามแบบ และแยกแบบผิดคือแยกตัวเลขผิด
     *
     * หนึ่ง ชื่อในวงเล็บ เช่น "(เสาเข็ม คอร. รูปกลมกลวง)" เป็นคำขยายของรายการเดิม ไม่ใช่ของใหม่
     * สอง ชื่อที่ไม่ได้อยู่ในวงเล็บและมีอัตราติดมาด้วย เช่น "เสาเข็ม ขนาด ศก. 5" x 5.00 ม."
     *     เป็นรายการย่อยตัวใหม่ใต้ลำดับเดิม รอบแรกผมรวมมันเข้ากับตัวก่อนหน้า ผลคือเสาเข็มสามขนาด
     *     กลายเป็นรายการเดียวที่มีเก้าอัตรา ซึ่งอ่านแล้วไม่รู้ว่าอัตราไหนของขนาดไหน
     * สาม แถวที่มีแต่หน่วยกับอัตรา เป็นช่วงปริมาณอีกช่วงของรายการย่อยตัวล่าสุด
     */
    const isQualifier = name.startsWith("(");

    if (name && !isQualifier && rate !== null && unit) {
      variant = { name, rates: [] };
      current.variants.push(variant);
      variant.rates.push({ unit, baht: rate, condition: note, page: n });
      continue;
    }

    if (name && isQualifier) {
      if (variant) variant.name = `${variant.name} ${name}`.trim();
      else current.title = `${current.title} ${name}`.trim();
      if (rate !== null && unit) {
        if (!variant) {
          variant = { name: "", rates: [] };
          current.variants.push(variant);
        }
        variant.rates.push({ unit, baht: rate, condition: note, page: n });
      }
      continue;
    }

    if (rate !== null && unit) {
      if (!variant) {
        variant = { name: "", rates: [] };
        current.variants.push(variant);
      }
      variant.rates.push({ unit, baht: rate, condition: note, page: n });
      continue;
    }

    if (name && !unit && rate === null) {
      if (variant && variant.rates.length === 0) variant.name = `${variant.name} ${name}`.trim();
      else current.title = `${current.title} ${name}`.trim();
    }
  }
}

const withRates = items.filter((item) => item.variants.some((entry) => entry.rates.length > 0));
withRates.forEach((item) => {
  item.variants = item.variants.filter((entry) => entry.rates.length > 0);
});
writeFileSync(out, JSON.stringify(withRates, null, 1));
const rateCount = withRates.reduce((total, item) => total + item.variants.reduce((sum, entry) => sum + entry.rates.length, 0), 0);
console.log("items", withRates.length, "of", items.length, "pages", fromPage, "-", last);
console.log("variants", withRates.reduce((total, item) => total + item.variants.length, 0));
console.log("rate rows", rateCount);
console.log("sections", [...new Set(withRates.map((item) => item.section))].join(" | "));
console.log(JSON.stringify(withRates.slice(0, 1), null, 1));
