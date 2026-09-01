#!/usr/bin/env node
/**
 * ตรวจว่ากุญแจ R2 ที่เพิ่งตั้งใช้งานได้จริง
 *
 * รับค่าจาก environment ไม่รับจาก argument เพราะ argument มองเห็นได้จากรายการโพรเซส
 * และไม่พิมพ์ค่ากุญแจออกหน้าจอเลยสักตัว บอกแค่ว่าแต่ละด่านผ่านหรือไม่ผ่าน
 *
 * เรียกจาก scripts/setup-r2.sh หรือเรียกเองด้วย
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... node scripts/check-r2.mjs
 */

import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";

const need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
const missing = need.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`ยังไม่มีค่าเหล่านี้ใน environment: ${missing.join(" ")}`);
  process.exit(1);
}

const bucket = process.env.R2_BUCKET;
const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const probeKey = `_probe/${Date.now()}.txt`;
const probeBody = "naichangmoo r2 probe";

const pass = (label) => console.log(`  ผ่าน   ${label}`);
const fail = (label, error) => {
  console.error(`  ไม่ผ่าน ${label}`);
  console.error(`         ${error?.name ?? "Error"}: ${error?.message ?? String(error)}`);
};

let ok = true;

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  pass(`มองเห็นถังเก็บไฟล์ ${bucket}`);
} catch (error) {
  fail(`มองเห็นถังเก็บไฟล์ ${bucket}`, error);
  console.error("\nสาเหตุที่พบบ่อย: ชื่อถังพิมพ์ผิด หรือกุญแจไม่ได้ผูกกับถังใบนี้");
  process.exit(1);
}

try {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: probeKey, Body: probeBody }));
  pass("เขียนไฟล์ทดสอบขึ้นถังได้");
} catch (error) {
  fail("เขียนไฟล์ทดสอบขึ้นถังได้", error);
  console.error("\nสาเหตุที่พบบ่อย: กุญแจออกมาเป็นแบบอ่านอย่างเดียว ต้องเป็น Object Read & Write");
  process.exit(1);
}

try {
  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: probeKey }));
  const body = await got.Body.transformToString();
  if (body !== probeBody) throw new Error("เนื้อไฟล์ที่อ่านกลับมาไม่ตรงกับที่เขียนไป");
  pass("อ่านไฟล์ทดสอบกลับมาได้");
} catch (error) {
  fail("อ่านไฟล์ทดสอบกลับมาได้", error);
  ok = false;
}

try {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));
  pass("ลบไฟล์ทดสอบทิ้งได้ ไม่มีขยะค้างในถัง");
} catch (error) {
  fail("ลบไฟล์ทดสอบทิ้งได้", error);
  console.error(`         ลบเองภายหลังได้ที่คีย์ ${probeKey}`);
  ok = false;
}

process.exit(ok ? 0 : 1);
