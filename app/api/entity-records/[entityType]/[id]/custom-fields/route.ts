import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Proxies to Node: PATCH /api/entity-records/:entityType/:id/custom-fields
 * Merges JSONB custom_fields for supported CRM entities in one backend handler.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; id: string }> }
) {
  try {
    const { entityType, id } = await params;
    const body = await request.json().catch(() => ({}));

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const path = `${apiUrl}/api/entity-records/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}/custom-fields`;

    const response = await fetch(path, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid response from server",
          raw: text.substring(0, 200),
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: (data.message as string) || "Failed to update custom fields",
          ...data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("entity-records custom-fields proxy:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
