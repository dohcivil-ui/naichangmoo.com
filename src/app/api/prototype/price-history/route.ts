import { NextResponse } from "next/server";
import { readHistory, readMaster } from "@/server/tpso-prices";

/**
 * ประวัติราคาของรายการที่อยู่บนจอ ขอทีเดียวหลายรหัส
 *
 * รับเป็น POST เพราะรหัสสินค้าของ สนค. ยาวสิบหกหลัก สามสิบรหัสจึงเกินความยาว URL ที่ปลอดภัย
 */
export const dynamic = "force-dynamic";

const MAX_CODES = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { province?: string; codes?: string[]; year?: number; month?: number; months?: number };
    const codes = (body.codes ?? []).filter((code) => /^\d{6,20}$/.test(code)).slice(0, MAX_CODES);
    if (codes.length === 0) return NextResponse.json({ series: [] }, { headers: { "Cache-Control": "no-store" } });

    const master = await readMaster();
    const end = body.year && body.month ? { year: body.year, month: body.month } : master.period.end;
    const series = await readHistory(body.province || "10", codes, end, body.months ?? 24);
    return NextResponse.json({ series }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อ่านประวัติราคาไม่สำเร็จ", series: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
