import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type Params = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const { organizationId } = await params;
  if (!organizationId) {
    return NextResponse.json(
      { success: false, message: "Organization ID is required" },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(
      `${apiUrl}/api/placements/organization/${organizationId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      console.error("Error parsing placements response:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid response from server",
          raw: text,
        },
        { status: 500 }
      );
    }

    if (!response.ok || !data || typeof data !== "object") {
      const message =
        (data as { message?: string } | null)?.message ??
        "Failed to fetch placements for organization";
      return NextResponse.json(
        { success: false, message },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Error fetching placements for organization:",
      (error as Error).message
    );
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
