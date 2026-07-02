import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_FETCH_TIMEOUT_MS = 20_000;

function isBackendUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  if (
    message.includes("econnrefused") ||
    message.includes("fetch failed") ||
    message.includes("network")
  ) {
    return true;
  }

  const cause = error.cause as { code?: string } | undefined;
  return cause?.code === "ECONNREFUSED" || cause?.code === "ENOTFOUND";
}

export async function GET(_request: NextRequest) {
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
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      BACKEND_FETCH_TIMEOUT_MS
    );

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/api/users/me/permissions`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            message: "Permission service timeout",
          },
          { status: 504 }
        );
      }

      if (isBackendUnavailableError(error)) {
        return NextResponse.json(
          {
            success: false,
            message: "Permission service unavailable",
          },
          { status: 503 }
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to fetch permissions",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
