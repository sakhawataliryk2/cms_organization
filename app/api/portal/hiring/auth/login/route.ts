import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiBaseUrl } from "@/app/api/portal/_utils";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${getApiBaseUrl()}/api/hiring-manager-portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.token) {
    const cookieStore = await cookies();
    cookieStore.set("portal_token", data.token, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
    });
    cookieStore.set("portal_role", "HIRING_MANAGER", { path: "/", sameSite: "lax" });
  }
  return NextResponse.json(data, { status: res.status });
}