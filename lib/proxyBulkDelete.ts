import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function proxyBulkDelete(request: NextRequest, entityPath: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entity_type, record_ids, record_labels, reason } = body;

    if (!record_ids || !Array.isArray(record_ids) || record_ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "record_ids array is required and must not be empty" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/${entityPath}/bulk-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ entity_type, record_ids, record_labels, reason }),
    });

    const text = await response.text();
    let data: { success?: boolean; message?: string; batchId?: number } = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { success: false, message: text || "Invalid response from server" };
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "Failed to create bulk delete request" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error bulk deleting ${entityPath}:`, error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
