import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function getApiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

async function proxyJson(path: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 },
    );
  }

  const upstream = await fetch(`${getApiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export async function GET() {
  try {
    return await proxyJson("/api/admin/smart-match-migration/status");
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to load status",
      },
      { status: 500 },
    );
  }
}
