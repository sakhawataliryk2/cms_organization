import { NextRequest } from "next/server";
import { proxyEmailQueue } from "../_proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    return await proxyEmailQueue("/api/admin/email-queue/batch-resume", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to resume emails",
      },
      { status: 500 },
    );
  }
}
