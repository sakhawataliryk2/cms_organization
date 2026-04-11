import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Click-to-call: proxy to backend POST /api/calls/start.
 * Backend creates a pending call and returns dialUrl (zoomphonecall://call?number=...).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateId, phoneNumber, fieldName } = body || {};

    if (!candidateId || !phoneNumber) {
      return NextResponse.json(
        { success: false, message: "candidateId and phoneNumber are required" },
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

    const response = await fetch(`${apiUrl}/api/calls/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ candidateId, phoneNumber, fieldName: fieldName || null }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || "Failed to start call",
        },
        { status: response.status }
      );
    }

    if (!data?.dialUrl) {
      return NextResponse.json(
        { success: false, message: "No dial URL returned" },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error starting call:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
