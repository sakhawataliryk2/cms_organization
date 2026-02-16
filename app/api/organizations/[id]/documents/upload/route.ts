import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    // Get form data from request
    const formData = await request.formData();

    // Forward the form data to backend API
    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/organizations/${id}/documents/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type header - let fetch set it with boundary for multipart/form-data
      },
      body: formData,
    });

    let data: { success?: boolean; message?: string; document?: unknown };
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      return NextResponse.json(
        {
          success: false,
          message:
            response.status === 404
              ? "Documents upload endpoint not found. Ensure the backend is running and has the upload route registered."
              : text || "Invalid response from server",
        },
        { status: response.status >= 400 ? response.status : 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to upload document",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error uploading document:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, message: "Upload failed. " + message },
      { status: 500 }
    );
  }
}
