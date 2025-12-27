import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const configType = searchParams.get("configType");

    if (!entityType) {
      return NextResponse.json(
        { success: false, message: "Entity type is required" },
        { status: 400 }
      );
    }

    if (!configType || !["header", "columns"].includes(configType)) {
      return NextResponse.json(
        {
          success: false,
          message: "configType is required (header | columns)",
        },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const backendUrl = `${apiUrl}/api/header-config?entityType=${encodeURIComponent(
      entityType
    )}&configType=${encodeURIComponent(configType)}`;

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(
        "Backend returned non-JSON response:",
        text.substring(0, 200)
      );
      return NextResponse.json(
        {
          success: false,
          message:
            response.status === 404
              ? "Header config API endpoint not found. Please restart the backend server."
              : `Backend error: ${response.status} ${response.statusText}`,
        },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to fetch header configuration",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching header configuration:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const configType = searchParams.get("configType");

    if (!entityType) {
      return NextResponse.json(
        { success: false, message: "Entity type is required" },
        { status: 400 }
      );
    }

    if (!configType || !["header", "columns"].includes(configType)) {
      return NextResponse.json(
        {
          success: false,
          message: "configType is required (header | columns)",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request body" },
        { status: 400 }
      );
    }

    const headerFields = body.headerFields || body.fields || [];

    if (!Array.isArray(headerFields)) {
      return NextResponse.json(
        { success: false, message: "headerFields must be an array" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const backendUrl = `${apiUrl}/api/header-config?entityType=${encodeURIComponent(
      entityType
    )}&configType=${encodeURIComponent(configType)}`;

    const response = await fetch(backendUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields: headerFields }),
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(
        "Backend returned non-JSON response:",
        text.substring(0, 200)
      );
      return NextResponse.json(
        {
          success: false,
          message:
            response.status === 404
              ? "Header config API endpoint not found. Please restart the backend server."
              : `Backend error: ${response.status} ${response.statusText}`,
        },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to save header configuration",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error saving header configuration:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}
