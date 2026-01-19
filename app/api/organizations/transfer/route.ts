import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
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
    const {
      source_organization_id,
      target_organization_id,
      requested_by,
      requested_by_email,
      source_record_number,
      target_record_number,
    } = body;

    if (!source_organization_id || !target_organization_id) {
      return NextResponse.json(
        { success: false, message: "Source and target organization IDs are required" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/organizations/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        source_organization_id,
        target_organization_id,
        requested_by,
        requested_by_email,
        source_record_number,
        target_record_number,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "Failed to create transfer request" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating transfer request:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create transfer request",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
