import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Returns the business record_number for a record by id and module.
 * GET /api/record-number?id=123&module=job
 *
 * Supported modules: organization, hiring-manager, job, job-seeker, lead, placement, task
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const module = searchParams.get("module");

    if (!id || !module) {
      return NextResponse.json(
        { success: false, message: "Both id and module are required" },
        { status: 400 }
      );
    }

    const numericId = parseInt(id, 10);
    if (!Number.isInteger(numericId) || numericId < 1) {
      return NextResponse.json(
        { success: false, message: "id must be a positive integer" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const url = `${apiUrl}/api/record-number/${encodeURIComponent(module.trim().toLowerCase())}/${numericId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to get record number",
        },
        { status: response.status }
      );
    }

    const recordNumber = data.recordNumber ?? data.record_number ?? null;
    return NextResponse.json({
      success: true,
      recordNumber: recordNumber != null ? Number(recordNumber) : null,
    });
  } catch (error) {
    console.error("Error fetching record number:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
