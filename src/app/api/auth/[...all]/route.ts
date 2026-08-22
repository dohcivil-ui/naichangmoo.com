import { NextResponse } from "next/server";
import { isAuthRuntimeConfigured } from "@/lib/auth-availability";

export const runtime = "nodejs";

async function getAuthHandlers() {
  if (!isAuthRuntimeConfigured()) return null;
  const [{ toNextJsHandler }, { auth }] = await Promise.all([
    import("better-auth/next-js"),
    import("@/lib/auth")
  ]);
  return toNextJsHandler(auth);
}

function previewResponse() {
  return NextResponse.json({ error: "Authentication is not configured for this preview deployment." }, { status: 503 });
}

export async function GET(request: Request) {
  const handlers = await getAuthHandlers();
  return handlers ? handlers.GET(request) : previewResponse();
}

export async function POST(request: Request) {
  const handlers = await getAuthHandlers();
  return handlers ? handlers.POST(request) : previewResponse();
}
