import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * ตรวจว่าบันไดของเลขรุ่นยังเรียงตรงกันอยู่
 *
 * มีอยู่เพราะวินัยเรื่องรุ่นของโปรเจกต์นี้เคยครบแล้วพังไปเงียบ ๆ เมื่อ 2026-08-24
 * ตอนที่ตรวจย้อนหลังพบว่าบันไดห้าขั้นหลุดกันคนละจุด:
 *
 *   GitHub Release หยุดที่ v0.20.0 · git tag หยุดที่ v0.34.0 ·
 *   CHANGELOG หยุดที่ v0.33.0 · package.json หยุดที่ 0.33.0 · roadmap เดินถึง v0.45.0
 *
 * ไม่มีใครรู้เพราะ `check-roadmap.mjs` ตรวจแค่ว่า roadmap pointer ตรงกับไฟล์รุ่น
 * ส่วนอีกสามอย่างไม่มีอะไรตรวจเลย ไฟล์นี้ปิดช่องว่างนั้น
 *
 * แยกจาก `check-roadmap.mjs` เพราะทำคนละหน้าที่: อันนั้นตรวจว่าแผนตรงกับสำเนาของแผน
 * อันนี้ตรวจว่าสิ่งที่ประกาศออกไปข้างนอกตรงกับแผน
 *
 * เรื่อง tag เป็นคำเตือนไม่ใช่ข้อผิดพลาด เพราะธงปักหลัง commit เสมอ
 * ถ้าทำให้ล้ม จะ commit รุ่นใหม่ไม่ได้เลยสักครั้ง
 */

const root = process.argv[2] ?? process.cwd();
const problems = [];
const warnings = [];

const read = (relative) => {
  const full = path.join(root, relative);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
};

const roadmapText = read("docs/roadmap/roadmap.json");
if (!roadmapText) {
  console.error("ไม่พบ docs/roadmap/roadmap.json — ให้ check-roadmap.mjs รายงานก่อน");
  process.exit(1);
}

let roadmapVersion;
try {
  roadmapVersion = JSON.parse(roadmapText).version;
} catch {
  console.error("docs/roadmap/roadmap.json อ่านเป็น JSON ไม่ได้ — ให้ check-roadmap.mjs รายงานก่อน");
  process.exit(1);
}

if (!roadmapVersion) {
  console.error("docs/roadmap/roadmap.json ไม่มีช่อง version");
  process.exit(1);
}

// หนึ่ง — เลขรุ่นใน package.json ต้องเท่ากับ roadmap
const packageText = read("package.json");
if (packageText) {
  const packageVersion = JSON.parse(packageText).version;
  if (packageVersion !== roadmapVersion) {
    problems.push(
      `package.json อยู่ที่ ${packageVersion} แต่ roadmap อยู่ที่ ${roadmapVersion} — สองเลขนี้ต้องตรงกันเสมอ`
    );
  }
}

// สอง — CHANGELOG ต้องมีบรรทัดของรุ่นปัจจุบัน ไม่ใช่ตามหลังอยู่หลายรุ่น
const changelog = read("docs/roadmap/CHANGELOG.md");
if (changelog === null) {
  problems.push("ไม่พบ docs/roadmap/CHANGELOG.md");
} else if (!changelog.includes(`## v${roadmapVersion} `)) {
  problems.push(
    `CHANGELOG.md ยังไม่มีบรรทัดของ v${roadmapVersion} — รุ่นที่ไม่มีคำอธิบายคือรุ่นที่ย้อนกลับมาแล้วไม่รู้ว่าคืออะไร`
  );
}

// สาม — ธงของรุ่นปัจจุบัน เตือนอย่างเดียว เพราะธงปักหลัง commit เสมอ
try {
  const tags = execFileSync("git", ["tag", "--list", `v${roadmapVersion}-*`], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  if (tags === "") {
    warnings.push(
      `ยังไม่มีธงของ v${roadmapVersion} — เมื่อ commit เสร็จแล้วให้รัน pnpm release เพื่อปักธงและ push`
    );
  }
} catch {
  // ไม่ใช่ที่เก็บ git หรือไม่มี git ก็ไม่ใช่เรื่องที่จะห้าม commit
}

for (const warning of warnings) console.warn(`เตือน: ${warning}`);

if (problems.length > 0) {
  console.error("บันไดของเลขรุ่นไม่ตรงกัน:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`บันไดของเลขรุ่นตรงกันที่ ${roadmapVersion}`);
