import { NextResponse } from "next/server";

function getApiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const backendRes = await fetch(
      `${getApiBase()}/api/onboarding/public/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
