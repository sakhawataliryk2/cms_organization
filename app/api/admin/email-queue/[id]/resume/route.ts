import { NextRequest } from "next/server";
import { proxyEmailQueue } from "../../_proxy";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await proxyEmailQueue(`/api/admin/email-queue/${id}/resume`, {
      method: "POST",
      body: "{}",
    });
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to resume email",
      },
      { status: 500 },
    );
  }
}
