import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendFetch, readBackendJson } from "@/lib/backendFetch";

export async function proxyAuthedBackend(
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 },
    );
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const upstream = await backendFetch(path, { ...init, headers });
  const data = await readBackendJson(upstream);
  return NextResponse.json(data, { status: upstream.status });
}
