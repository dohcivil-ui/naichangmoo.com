import { NextResponse } from "next/server";
import { visualAssetFiles, type VisualAssetKey } from "@/lib/visual-assets";

const fallbackOrigin = "http://localhost:3000";

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(key in visualAssetFiles)) return NextResponse.json({ error: "Unknown visual asset" }, { status: 404 });

  const file = visualAssetFiles[key as VisualAssetKey];
  const origin = (process.env.STATIC_ASSET_ORIGIN || fallbackOrigin).replace(/\/+$/, "");
  const upstream = await fetch(`${origin}/manus-storage/${file}`, { redirect: "follow", next: { revalidate: 86_400 } });

  if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/")) {
    return NextResponse.json({ error: "Visual asset temporarily unavailable" }, { status: 502 });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
    }
  });
}
