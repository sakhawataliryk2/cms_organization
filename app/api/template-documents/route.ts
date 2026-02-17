import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
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

    const response = await fetch(`${apiUrl}/api/template-documents`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to fetch documents",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching template documents:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Parse multipart form data (same pattern as organization/jobs document upload)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const document_name = (formData.get("document_name") as string) || "";
    const category = (formData.get("category") as string) || "";
    const description = (formData.get("description") as string) || "";
    const approvalRequired = (formData.get("approvalRequired") as string) || "";
    const additionalDocsRequired = (formData.get("additionalDocsRequired") as string) || "";
    const notification_user_idsRaw = formData.get("notification_user_ids") as string | null;

    let filePayload: { name: string; type: string; data: string } | undefined;
    if (file && file instanceof File && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      filePayload = {
        name: file.name,
        type: file.type || "application/pdf",
        data: buffer.toString("base64"),
      };
    }

    const payload: Record<string, unknown> = {
      document_name,
      category,
      description,
      approvalRequired,
      additionalDocsRequired,
      notification_user_ids: notification_user_idsRaw ?? "[]",
    };
    if (filePayload) payload.file = filePayload;

    const response = await fetch(`${apiUrl}/api/template-documents`, {
      method: "POST",
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
          message: data.message || "Failed to create document",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating template document:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
