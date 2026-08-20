import { NextRequest } from "next/server";
import { proxyEmailQueue } from "../../_proxy";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await _request.json().catch(() => ({}));
    return await proxyEmailQueue(`/api/admin/email-queue/${id}/stop`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to stop email",
      },
      { status: 500 },
    );
  }
}
