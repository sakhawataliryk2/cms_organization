import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type RouteContext = { params: Promise<{ entityType: string }> };

async function proxyRequest(
  request: NextRequest,
  entityType: string,
  method: "GET" | "PUT" | "PATCH" | "POST"
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  if (!entityType) {
    return NextResponse.json(
      { success: false, message: "Entity type is required" },
      { status: 400 }
    );
  }

  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
  const backendUrl = `${apiUrl}/api/user-view-config/${encodeURIComponent(entityType)}`;

  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  };

  if (method !== "GET") {
    const body = await request.json();
    init.body = JSON.stringify(body);
  }

  const response = await fetch(backendUrl, init);

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
            ? "User view config API endpoint not found. Please restart the backend server."
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
        message: data.message || "Failed to process user view configuration",
      },
      { status: response.status }
    );
  }

  return NextResponse.json(data);
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { entityType } = await context.params;
    return proxyRequest(request, entityType, "GET");
  } catch (error) {
    console.error("Error fetching user view configuration:", error);
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

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { entityType } = await context.params;
    return proxyRequest(request, entityType, "PUT");
  } catch (error) {
    console.error("Error saving user view configuration:", error);
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

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  return PUT(request, context);
}
