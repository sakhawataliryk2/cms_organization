import { NextResponse } from "next/server";

function getApiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await req.json().catch(() => ({}));
    const backendRes = await fetch(
      `${getApiBase()}/api/onboarding/public/${encodeURIComponent(token)}/draft`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
