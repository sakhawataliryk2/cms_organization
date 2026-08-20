import { proxyEmailQueue } from "../_proxy";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return await proxyEmailQueue("/api/admin/email-queue/clear-history", {
      method: "POST",
      body: "{}",
    });
  } catch (e: unknown) {
    return Response.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Failed to clear email history",
      },
      { status: 500 },
    );
  }
}
