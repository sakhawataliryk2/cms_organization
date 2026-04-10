import { NextResponse } from "next/server";
import { getApiBaseUrl, getPortalToken } from "@/app/api/portal/_utils";

export async function POST(req: Request, ctx: { params: Promise<{ itemId: string }> }) {
    const token = await getPortalToken();
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const { itemId } = await ctx.params;
    const body = await req.formData().catch(() => null);
    const res = await fetch(`${getApiBaseUrl()}/api/jobseeker-portal/documents/${itemId}/attach`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: body ?? undefined,
        cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}
