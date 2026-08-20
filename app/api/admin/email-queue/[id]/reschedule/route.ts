import { NextRequest } from "next/server";
import { proxyEmailQueue } from "../../_proxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    return await proxyEmailQueue(`/api/admin/email-queue/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to reschedule email",
      },
      { status: 500 },
    );
  }
}
