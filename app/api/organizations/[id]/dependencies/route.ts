import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const { id } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(
      `${apiUrl}/api/organizations/${id}/dependencies`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "Failed to fetch dependencies" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching dependencies:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch dependencies",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
