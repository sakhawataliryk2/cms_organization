import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
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
    const response = await fetch(`${apiUrl}/api/job-seekers/${id}/applications`, {
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
        { success: false, message: data.message || "Failed to fetch applications" },
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json();

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/job-seekers/${id}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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
        { success: false, message: data.message || "Failed to add application" },
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
