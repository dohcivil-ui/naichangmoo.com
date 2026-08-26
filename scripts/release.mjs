import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * ปิดรุ่น: ปักธง push แล้วประกาศออกไปข้างนอก ในคำสั่งเดียว
 *
 * มีอยู่เพราะการปิดรุ่นของโปรเจกต์นี้เป็นงานหลายขั้นที่ต้องทำให้ครบทุกครั้ง และเมื่อ
 * ทำด้วยมือ มันขาดไปทีละขั้นจนบันไดห้าขั้นหลุดกันคนละจุด (ดูเหตุผลเต็มใน check-release.mjs)
 * ขั้นที่หายบ่อยที่สุดคือ **GitHub Release** เพราะมันไม่ใช่สิ่งเดียวกับ git tag
 * ต้องสร้างแยกต่างหาก และเป็นสิ่งที่คนเปิดหน้า repo เห็นเป็นอย่างแรก
 *
 * ตรวจให้ครบก่อนแตะอะไร แล้วค่อยลงมือ ถ้าข้อไหนไม่ผ่านให้หยุดและบอกว่าต้องแก้อะไร
 * ไม่ปักครึ่ง ๆ กลาง ๆ เพราะธงที่ปักผิดลบยากกว่าธงที่ยังไม่ได้ปัก
 *
 *   node scripts/release.mjs                  ปิดรุ่นตามเลขใน roadmap.json
 *   node scripts/release.mjs --dry-run        บอกว่าจะทำอะไรบ้างโดยไม่ทำจริง
 */

const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");

const run = (file, args, options = {}) =>
  execFileSync(file, args, { cwd: root, encoding: "utf8", ...options }).trim();

const fail = (message) => {
  console.error(`ปิดรุ่นไม่ได้: ${message}`);
  process.exit(1);
};

const act = (label, file, args) => {
  if (dryRun) {
    console.log(`[ลองเฉย ๆ] ${label}`);
    return;
  }
  console.log(label);
  run(file, args, { stdio: ["ignore", "inherit", "inherit"] });
};

// ---- อ่านรุ่นที่จะปิด ----
const roadmapPath = path.join(root, "docs/roadmap/roadmap.json");
if (!existsSync(roadmapPath)) fail("ไม่พบ docs/roadmap/roadmap.json");
const roadmap = JSON.parse(readFileSync(roadmapPath, "utf8"));
const version = roadmap.version;
if (!version) fail("docs/roadmap/roadmap.json ไม่มีช่อง version");

/** ชื่อธงมาจากหัวข้อของรุ่น ไม่ตั้งเอง เพื่อให้ธง roadmap และ CHANGELOG เล่าเรื่องเดียวกัน */
const slug = String(roadmap.title ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, "")
  .trim()
  .split(/\s+/)
  .filter((word) => !["a", "an", "the", "and", "of", "that", "is", "to", "in"].includes(word))
  .slice(0, 5)
  .join("-");
if (slug === "") fail("ตั้งชื่อธงจากหัวข้อของรุ่นไม่ได้ — หัวข้อต้องมีตัวอักษรอังกฤษอย่างน้อยหนึ่งคำ");

const tag = `v${version}-${slug}`;

// ---- ตรวจให้ครบก่อนแตะอะไร ----
console.log(`กำลังจะปิดรุ่น ${version} ด้วยธง ${tag}`);

run("node", ["scripts/check-roadmap.mjs"]);
run("node", ["scripts/check-release.mjs"]);

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
const trunk = run("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, "");
if (branch !== trunk) {
  fail(`ตอนนี้อยู่บนสาขา ${branch} แต่รุ่นต้องปิดบนสายหลัก ${trunk} — merge เข้าสายหลักก่อน`);
}

if (run("git", ["status", "--porcelain"]).split("\n").filter((line) => line && !line.startsWith("??")).length > 0) {
  fail("ยังมีไฟล์ที่แก้แล้วไม่ได้ commit — ปิดรุ่นบนของที่ยังไม่นิ่งไม่ได้");
}

if (run("git", ["tag", "--list", tag]) !== "") {
  fail(`ธง ${tag} มีอยู่แล้ว — ถ้าจะออกใหม่ให้ขึ้นเลขรุ่นก่อน ไม่ใช่ปักทับ`);
}

const behind = run("git", ["rev-list", "--count", `HEAD..origin/${trunk}`]);
if (behind !== "0") fail(`สายหลักบน origin นำหน้าอยู่ ${behind} commit — ให้ pull ก่อน`);

// ---- ลงมือ ----
const title = `v${version} — ${roadmap.title}`;
act(`ปักธง ${tag}`, "git", ["tag", "-a", tag, "-m", title]);
act("push สายหลัก", "git", ["push", "origin", trunk]);
act(`push ธง ${tag}`, "git", ["push", "origin", tag]);

/**
 * GitHub Release เป็นคนละอย่างกับธง คนที่เปิดหน้า repo เห็นอันนี้ ไม่ได้เห็นธง
 * ขั้นนี้จึงห้ามข้าม และถ้า gh ใช้ไม่ได้ก็ต้องบอกให้ไปสร้างเอง ไม่ใช่เงียบ
 */
const notes = String(roadmap.description ?? "").trim();
try {
  run("gh", ["--version"]);
  act(`สร้าง GitHub Release ${tag}`, "gh", [
    "release", "create", tag, "--title", title, "--notes", notes || title
  ]);
} catch {
  console.warn(
    `เตือน: เรียก gh ไม่ได้ จึงยังไม่มี GitHub Release ของ ${tag} — ` +
    `สร้างเองที่หน้า Releases ของ repo แล้วเลือกธง ${tag}`
  );
}

console.log(dryRun ? "ลองเฉย ๆ จบแล้ว ไม่มีอะไรถูกเปลี่ยน" : `ปิดรุ่น ${version} เรียบร้อย`);
