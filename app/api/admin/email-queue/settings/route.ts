import { NextRequest } from "next/server";
import { proxyEmailQueue } from "../_proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await proxyEmailQueue("/api/admin/email-queue/settings");
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to load settings",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    return await proxyEmailQueue("/api/admin/email-queue/settings", {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    });
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to update settings",
      },
      { status: 500 },
    );
  }
}
