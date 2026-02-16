import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(
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

    // Read multipart form data from the browser
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const document_name = formData.get("document_name") as string | null;
    const document_type =
      (formData.get("document_type") as string | null) ?? "General";

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File is required" },
        { status: 400 }
      );
    }

    if (!document_name || !document_name.trim()) {
      return NextResponse.json(
        { success: false, message: "Document name is required" },
        { status: 400 }
      );
    }

    // Convert file to base64 so backend can avoid multer/busboy
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    const payload = {
      document_name,
      document_type,
      file: {
        name: file.name,
        type: file.type || "application/octet-stream",
        data: base64Data,
      },
    };

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const uploadUrl = `${apiUrl}/api/jobs/${id}/documents/upload`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
        { success: false, message: data.message || "Failed to upload document" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
