import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set("portal_token", "", { path: "/", maxAge: 0 });
  return NextResponse.json({ success: true, message: "Logged out" });
}
