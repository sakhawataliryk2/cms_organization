import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET: Fetch applications for a job.
 * Proxies to the backend /api/jobs/{id}/applications endpoint.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const backendUrl = `${apiUrl}/api/jobs/${id}/applications`;

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const responseText = await response.text();

    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON response from backend",
          rawResponse: responseText.substring(0, 200) + "...",
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to fetch job applications",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

