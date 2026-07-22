import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function proxyZoomInfo(
  request: NextRequest,
  backendPath: string,
  method: "GET" | "POST" = "GET"
) {
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
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    let body: string | undefined;
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      try {
        const json = await request.json();
        body = JSON.stringify(json ?? {});
      } catch {
        body = "{}";
      }
    }

    const response = await fetch(`${apiUrl}/api/zoominfo/${backendPath}`, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({
      success: false,
      message: "Invalid response from ZoomInfo API",
    }));

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`ZoomInfo BFF /${backendPath} error:`, error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
