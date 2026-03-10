import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobSeekerId, toNumber } = body || {};

    if (!jobSeekerId || !toNumber) {
      return NextResponse.json(
        { success: false, message: "jobSeekerId and toNumber are required" },
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

    const response = await fetch(`${apiUrl}/api/zoom/phone/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jobSeekerId, toNumber }),
    });

    const data = await response.json();

    if (!response.ok || !data?.success) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || "Failed to prepare Zoom Phone call",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error starting Zoom Phone call:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

