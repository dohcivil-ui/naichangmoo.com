/**
 * ตรวจว่าสำเนาผืนในเครื่องยังตรงกับผืนฉบับที่เผยแพร่ไว้หรือยัง
 *
 * **ทำไมต้องมีตัวนี้** สำเนาที่ `redesign/V3/Home Redesign v3.dc.html` ไม่มีอะไรผูกกับ
 * ต้นทางเลย และ `redesign/` ถูก gitignore · ถ้าเจ้าของงานแก้ผืนที่ Claude Design
 * สำเนาจะเก่าเงียบ ๆ แล้ว `compare.mjs` จะรายงานว่าหน้าจริงตรงผืน **ทั้งที่มันตรงกับ
 * ผืนฉบับเก่า** · ตัวเทียบตัวนั้นตรวจเรื่องนี้ไม่ได้เพราะมันอ่านได้แค่สำเนา
 *
 * **บทเรียนที่ทำให้ไฟล์นี้เกิด 2026-09-07** รอบแรกตรวจด้วย regex ที่จับเฉพาะกฎที่ขึ้นต้น
 * ด้วยคลาสเดี่ยว ๆ (`.foo{...}`) ได้ 22 กฎ แล้วรายงานว่า "ตรงกัน 22 จาก 22" ·
 * ของจริงมี 36 กฎ · ที่หายไปคือ `:root` · `body` · `h1,h2,h3,h4,.hd` · `a:hover`
 * และกฎลูกหลานทั้งหมด · **ตัวตรวจที่มองไม่เห็นของครึ่งหนึ่ง ยังรายงานว่าผ่านได้เต็มปาก**
 * และที่หนักกว่าคือ `@keyframes` ไม่ถูกตรวจเลยสักตัว ทั้งที่ `badgePop` กับ `badgeGlow`
 * เป็นต้นเหตุของเรื่อง 36.43 กับ 32.00 ที่กินเวลาไปทั้งรอบมาแล้ว
 *
 * ## วิธีใช้
 *
 * ```
 * node scripts/v3-spec/canvas-provenance.mjs <ไฟล์ artifact ที่บันทึกไว้> [สำเนาผืน]
 * ```
 *
 * ไฟล์ artifact ได้มาจากการอ่าน artifact ของผืนแล้วบันทึกลงไฟล์ ที่
 * `https://claude.ai/code/artifact/1f9829cd-b5b3-46fe-848b-b16682e5b04d`
 * ("นายช่างหมู หน้าแรก Redesign") · สคริปต์นี้ดาวน์โหลดเองไม่ได้ เพราะ artifact
 * ต้องอ่านผ่านเครื่องมือที่มีสิทธิ์ของผู้ใช้ ไม่ใช่ผ่าน http เปล่า ๆ
 *
 * คืนรหัสออก 1 เมื่อชุดใดชุดหนึ่งที่เป็น **งานออกแบบ** ไม่ตรงกัน จึงใส่ในลูกโซ่คำสั่งได้
 */
import { readFile } from "node:fs/promises";

const ARTIFACT = process.argv[2];
const CANVAS = process.argv[3] ?? "redesign/V3/Home Redesign v3.dc.html";

if (!ARTIFACT) {
  console.error(`ใช้: node scripts/v3-spec/canvas-provenance.mjs <ไฟล์ artifact> [สำเนาผืน]

ไฟล์ artifact คือหน้าที่อ่านมาจาก artifact ของผืนแล้วบันทึกไว้ ดูหัวไฟล์นี้`);
  process.exit(2);
}

/**
 * **เอกสารในไฟล์ artifact ถูกฝังเป็นสตริงใน JavaScript ช่วงท้ายไฟล์ แบบ minify และ escape**
 * ต้องคลาย escape ก่อนจึงจะอ่านเป็น HTML ได้ · `/` มาจากการที่ตัวห่อไม่ยอมให้มี
 * `</script>` ตรง ๆ อยู่ในสตริง
 */
function unescapeEmbedded(text) {
  return text
    .replaceAll("\\u002F", "/")
    .replaceAll("\\u003C", "<")
    .replaceAll("\\u003E", ">")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\u0027", "'")
    .replaceAll("\\\\n", "\n")
    .replaceAll("\\n", "\n")
    .replaceAll("\\\\t", "\t")
    .replaceAll("\\t", "\t")
    .replaceAll('\\\\"', '"')
    .replaceAll('\\"', '"')
    .replaceAll("\\'", "'");
}

/** ตัดหัวของตัวห่อทิ้ง เอาเฉพาะตั้งแต่ helmet ของผืนเป็นต้นไป */
function canvasInsideArtifact(raw) {
  const doc = unescapeEmbedded(raw);
  const at = doc.indexOf("design_doc_mode");
  if (at < 0) throw new Error("หา helmet ของผืนในไฟล์ artifact ไม่เจอ — ไฟล์นี้ใช่ผืนหรือเปล่า");
  return doc.slice(at);
}

const collapse = (s) => s.replace(/\s+/g, " ").trim();
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ");

/**
 * แยก CSS เป็นก้อนโดยจับคู่ปีกกาเอง **ห้ามใช้ regex `\{[^}]*\}`**
 * เพราะ `@keyframes` กับ `@media` ซ้อนชั้น แล้ว regex จะตัดกลางก้อน
 */
function splitRules(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const selector = css.slice(i, open);
    let depth = 1;
    let k = open + 1;
    while (k < css.length && depth > 0) {
      if (css[k] === "{") depth += 1;
      else if (css[k] === "}") depth -= 1;
      k += 1;
    }
    const selectorClean = collapse(stripComments(selector));
    if (selectorClean) out.push(`${selectorClean}{${collapse(css.slice(open + 1, k - 1))}}`);
    i = k;
  }
  return out;
}

const styleBlocks = (doc) => [...doc.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const hasThai = (s) => /[฀-๿]/.test(s);

function buckets(doc) {
  const fontFace = [];
  const keyframes = [];
  const design = [];
  const branding = [];

  for (const block of styleBlocks(doc)) {
    for (const rule of splitRules(block)) {
      const selector = rule.slice(0, rule.indexOf("{"));
      if (selector.startsWith("@font-face")) fontFace.push(rule);
      else if (selector.startsWith("@keyframes")) keyframes.push(rule);
      else if (rule.includes("__claude_design_branding")) branding.push(rule);
      else design.push(rule);
    }
  }

  const withoutCode = doc
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, " ");
  const textNodes = [...withoutCode.matchAll(/>([^<>]+)</g)].map((m) => collapse(m[1])).filter(hasThai);

  /**
   * **ข้อความไทยใน `<script>` เป็นคำที่ผู้ใช้เห็น ไม่ใช่โค้ด** ชื่อแอป ชื่อกลุ่มงาน
   * และถ้อยคำบนปุ่มของการ์ดโปรโมชั่นกับการ์ดแอปมาใหม่ อยู่ในนั้นทั้งหมด
   */
  const code = [...doc.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(" ");
  const scriptStrings = [...code.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)]
    .map((m) => collapse(m[1] ?? m[2] ?? m[3] ?? ""))
    .filter(hasThai);

  return { fontFace, keyframes, design, branding, textNodes, scriptStrings };
}

/** น้ำหนักฟอนต์ที่ผืนขอ — ฝั่งสำเนาอ่านจาก `<link>` ฝั่ง artifact อ่านจาก `@font-face` */
function fontWeights(doc, fontFace) {
  const weights = new Set();
  for (const rule of fontFace) {
    const w = rule.match(/font-weight:\s*(\d+)/);
    if (w) weights.add(w[1]);
  }
  for (const link of doc.matchAll(/fonts\.googleapis\.com\/css2\?[^"']*/g)) {
    const wght = link[0].match(/wght@([\d;]+)/);
    if (wght) for (const w of wght[1].split(";")) weights.add(w);
  }
  return [...weights].sort();
}

const artifactRaw = await readFile(ARTIFACT, "utf8");
const published = buckets(canvasInsideArtifact(artifactRaw));
const localRaw = await readFile(CANVAS, "utf8");
const copy = buckets(localRaw);

/**
 * **สองชุดที่ต่างโดยไม่ได้แปลว่าผืนขยับ** · `@font-face` ต่างเพราะสำเนาดึงฟอนต์ด้วย
 * `<link>` ส่วนตอนเผยแพร่ระบบฝังไฟล์ฟอนต์มาให้ · วิดเจ็ต branding เป็นของ
 * Claude Design เอง ไม่ใช่ของงานออกแบบ · **สองชุดนี้จึงรายงานแต่ไม่ทำให้ตก**
 * แต่ `@font-face` ไม่ได้ถูกปล่อยผ่านเฉย ๆ — น้ำหนักฟอนต์ที่ทั้งสองฝั่งขอ ต้องเท่ากัน
 */
const CHECKS = [
  { key: "design", label: "กฎ CSS ของงาน", fatal: true },
  { key: "keyframes", label: "@keyframes", fatal: true },
  { key: "textNodes", label: "ข้อความไทยที่ผู้ใช้เห็น", fatal: true },
  { key: "scriptStrings", label: "ข้อความไทยใน <script>", fatal: true },
  { key: "fontFace", label: "@font-face", fatal: false },
  { key: "branding", label: "วิดเจ็ต branding", fatal: false }
];

let failed = 0;
const detail = [];

console.log(`ผืนที่เผยแพร่ : ${ARTIFACT}`);
console.log(`สำเนาในเครื่อง : ${CANVAS}`);
console.log("");
console.log("ชุดที่เทียบ                  เผยแพร่  ในเครื่อง  ผล");
console.log("-".repeat(58));

for (const check of CHECKS) {
  const pub = new Set(published[check.key]);
  const loc = new Set(copy[check.key]);
  const onlyPub = [...pub].filter((x) => !loc.has(x));
  const onlyLoc = [...loc].filter((x) => !pub.has(x));
  const same = onlyPub.length === 0 && onlyLoc.length === 0;
  if (!same && check.fatal) failed += 1;
  const verdict = same ? "ตรงกัน" : check.fatal ? `ต่าง ${onlyPub.length}/${onlyLoc.length}` : `ต่างตามคาด ${onlyPub.length}/${onlyLoc.length}`;
  console.log(`${check.label.padEnd(26)}${String(pub.size).padStart(7)}${String(loc.size).padStart(10)}  ${verdict}`);
  if (!same && check.fatal) detail.push([check.label, onlyPub, onlyLoc]);
}

const wPub = fontWeights("", published.fontFace);
const wLoc = fontWeights(localRaw, copy.fontFace);
const weightsMatch = wPub.join(",") === wLoc.join(",");
if (!weightsMatch) failed += 1;
console.log("");
console.log(`น้ำหนักฟอนต์ที่ผืนขอ · เผยแพร่ ${wPub.join(" ")} · สำเนา ${wLoc.join(" ")} · ${weightsMatch ? "ตรงกัน" : "ต่าง"}`);

for (const [label, onlyPub, onlyLoc] of detail) {
  console.log("");
  console.log(`== ${label} ==`);
  for (const x of onlyPub.slice(0, 8)) console.log("  มีแต่ในผืนที่เผยแพร่ :", x.slice(0, 160));
  for (const x of onlyLoc.slice(0, 8)) console.log("  มีแต่ในสำเนา         :", x.slice(0, 160));
}

console.log("");
if (failed === 0) {
  console.log("สำเนาในเครื่องตรงกับผืนที่เผยแพร่ ทุกชุดที่เป็นงานออกแบบ");
} else {
  console.log(`สองฉบับไม่ตรงกัน ${failed} ชุด — **ตรวจก่อนว่าฝั่งไหนเก่ากว่า อย่าเพิ่งทับ**`);
  console.log("ไม่ใช่ว่าสำเนาเก่าเสมอ · artifact ถูกปักหมุดไว้ที่เวอร์ชันหนึ่ง ไม่ใช่กระจกของงานออกแบบ");
  console.log("มันจึงเก่ากว่าสำเนาได้ ถ้าเจ้าของงานแก้ผืนแล้วยังไม่ได้เผยแพร่ซ้ำ — เกิดมาแล้ว 2026-09-07");
  console.log("ถ้าสำเนาเป็นฝ่ายเก่า ทุกเลขที่ compare.mjs รายงานเป็นเลขของผืนฉบับเก่าจนกว่าจะแก้");
}
process.exit(failed === 0 ? 0 : 1);
