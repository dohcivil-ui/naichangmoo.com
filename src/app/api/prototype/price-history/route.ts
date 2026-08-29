import { NextResponse } from "next/server";
import { readHistory, readMaster } from "@/server/tpso-prices";
import { clampHistoryMonths } from "@/lib/pricemetr-tier";
import { getPricemetrAccess } from "@/server/pricemetr-access";

/**
 * ประวัติราคาของรายการที่อยู่บนจอ ขอทีเดียวหลายรหัส
 *
 * รับเป็น POST เพราะรหัสสินค้าของ สนค. ยาวสิบหกหลัก สามสิบรหัสจึงเกินความยาว URL ที่ปลอดภัย
 *
 * **นี่คือด่านสิทธิ์จริงของ PRICEMETR (IP-164)** ความยาวของกราฟถูกตัดสินที่นี่จากสิทธิ์ของ
 * คนที่ขอ ไม่ใช่จากตัวเลขที่หน้าจอส่งมา หน้าจอส่งอะไรมาก็ได้ ยิงตรงด้วย curl ก็ได้ คำตอบ
 * ยาวเท่าที่สิทธิ์อนุญาตเท่านั้น การซ่อนปุ่มด้วย CSS ไม่ใช่การกั้น — Safety rules ใน AGENTS.md
 *
 * ราคาปัจจุบันไม่ได้ถูกกั้นที่ไหนเลยและจะไม่ถูกกั้น เพราะเป็นข้อมูลเปิดของหน่วยงานรัฐ
 * สิ่งที่ขายคือทางเดินต่อ ไม่ใช่การเลิกบังตัวเลข — docs/requirements/pricemetr-membership.md
 */
export const dynamic = "force-dynamic";

const MAX_CODES = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { province?: string; codes?: string[]; year?: number; month?: number; months?: number };
    const access = await getPricemetrAccess(request.headers);
    const months = clampHistoryMonths(body.months, access);

    const codes = (body.codes ?? []).filter((code) => /^\d{6,20}$/.test(code)).slice(0, MAX_CODES);
    if (codes.length === 0) {
      return NextResponse.json({ series: [], monthsGranted: months, tier: access.tier }, { headers: { "Cache-Control": "no-store" } });
    }

    const master = await readMaster();
    const end = body.year && body.month ? { year: body.year, month: body.month } : master.period.end;
    const series = await readHistory(body.province || "10", codes, end, months);

    // บอกกลับไปด้วยว่าให้มากี่เดือน เพื่อให้หน้าจอพูดความจริงได้ว่ากราฟนี้ยาวเท่าไรและเพราะอะไร
    // ข้อห้ามข้อ 3: หน้าจอพูดได้เฉพาะสิ่งที่เซิร์ฟเวอร์ตอบแล้ว ห้ามขึ้นป้ายสิทธิ์ที่เดาเอง
    return NextResponse.json({ series, monthsGranted: months, tier: access.tier }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อ่านประวัติราคาไม่สำเร็จ", series: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
