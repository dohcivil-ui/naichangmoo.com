import { NextResponse } from "next/server";
import { visualAssets, type VisualAssetKey } from "@/lib/visual-assets";

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(key in visualAssets)) return NextResponse.json({ error: "Unknown visual asset" }, { status: 404 });

  const asset = visualAssets[key as VisualAssetKey];
  const productionOrigin = process.env.VISUAL_ASSET_ORIGIN?.replace(/\/+$/, "");
  const sourceUrl = productionOrigin ? `${productionOrigin}/${asset.file}` : asset.pilotUrl;
  const upstream = await fetch(sourceUrl, { redirect: "follow", next: { revalidate: 86_400 } });

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
