import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// ✅ Server-side base URL (NO localhost fallback in prod)
const apiUrl = process.env.API_BASE_URL; // set this in env

function requireApiUrl() {
  if (!apiUrl) throw new Error("API_BASE_URL is not set");
  return apiUrl;
}

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value || "";
}

/**
 * ✅ GET single document (needed for internal PDF viewer)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const base = requireApiUrl();

    const response = await fetch(`${base}/api/template-documents/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "Failed to fetch document" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching template document:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const base = requireApiUrl();

    // Parse multipart form data (same pattern as organization/jobs document upload)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const document_name = (formData.get("document_name") as string) || "";
    const category = (formData.get("category") as string) || "";
    const description = (formData.get("description") as string) || "";
    const approvalRequired = (formData.get("approvalRequired") as string) || "";
    const additionalDocsRequired = (formData.get("additionalDocsRequired") as string) || "";
    const notification_user_idsRaw = formData.get("notification_user_ids") as string | null;

    const payload: Record<string, unknown> = {
      document_name,
      category,
      description,
      approvalRequired,
      additionalDocsRequired,
      notification_user_ids: notification_user_idsRaw ?? "[]",
    };

    if (file && file instanceof File && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      payload.file = {
        name: file.name,
        type: file.type || "application/pdf",
        data: buffer.toString("base64"),
      };
    }

    const response = await fetch(`${base}/api/template-documents/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to update document",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating template document:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const base = requireApiUrl();

    const response = await fetch(`${base}/api/template-documents/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to delete document",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting template document:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
