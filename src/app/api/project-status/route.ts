import { NextResponse } from "next/server";
import { readProjectStatus } from "@/server/project-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readProjectStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read project status." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
