import { NextResponse } from "next/server";
import { answerLedger } from "@/server/price-ledger-query";

/**
 * แผงบัญชีราคาถามที่นี่ที่เดียว เบราว์เซอร์ของผู้ใช้ไม่เคยคุยกับ สนค. โดยตรง
 * เหตุผลอยู่ในหัวไฟล์ของ src/server/tpso-prices.ts ข้อ 1
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const number = (key: string) => {
    const raw = url.searchParams.get(key);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  try {
    const answer = await answerLedger({
      province: url.searchParams.get("province") ?? undefined,
      year: number("year"),
      month: number("month"),
      query: url.searchParams.get("q") ?? undefined,
      cat: url.searchParams.get("cat") ?? undefined,
      sort: (url.searchParams.get("sort") as "name" | "price-desc" | "price-asc" | null) ?? undefined,
      page: number("page")
    });
    return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อ่านราคาไม่สำเร็จ" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
