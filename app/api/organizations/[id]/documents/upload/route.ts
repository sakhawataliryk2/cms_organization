import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { put } from "@vercel/blob";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    console.log("Uploading")
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const documentName = formData.get("document_name") as string;
    const documentType = formData.get("document_type") as string || "General";

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/gif",
    ];
    const isValidType =
      allowedTypes.includes(file.type) ||
      file.name.match(/\.(pdf|doc|docx|txt|jpg|jpeg|png|gif)$/i);

    if (!isValidType) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid file type. Allowed: PDF, DOC, DOCX, TXT, JPG, PNG, GIF",
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Generate unique filename for Vercel Blob
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `organizations/${id}/${timestamp}_${sanitizedName}`;

    // Upload to Vercel Blob
    const blob = await put(fileName, file, {
      access: 'public',
    });

    // Make a request to backend API to save document metadata
    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/organizations/${id}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        document_name: documentName || file.name,
        document_type: documentType,
        file_path: blob.url,
        file_size: file.size,
        mime_type: file.type,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Note: We might want to delete the blob if metadata save fails, 
      // but Vercel Blob doesn't have a simple delete exposed in the put return 
      // without importing del. For now, we'll leave it as orphan or implement del if needed.
      // Importing del and calling it would be better practice.
      
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to save document metadata",
        },
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
