import { proxyEmailQueue } from "../_proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return await proxyEmailQueue("/api/admin/email-queue/source-controls", {
      method: "GET",
    });
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to load source controls",
      },
      { status: 500 },
    );
  }
}
