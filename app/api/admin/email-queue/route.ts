import { NextRequest } from "next/server";
import { proxyEmailQueue } from "./_proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams.toString();
    return await proxyEmailQueue(
      `/api/admin/email-queue${qs ? `?${qs}` : ""}`,
    );
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to list emails",
      },
      { status: 500 },
    );
  }
}
