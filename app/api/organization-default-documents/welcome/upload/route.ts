import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentName = (formData.get("documentName") as string)?.trim();

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { success: false, message: "File is required" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    const displayName = documentName
      ? (documentName.endsWith(".pdf") ? documentName : `${documentName}.pdf`)
      : file.name;

    const payload = {
      file: {
        name: displayName,
        type: file.type || "application/pdf",
        data: base64Data,
      },
    };

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(
      `${apiUrl}/api/organization-default-documents/welcome/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Failed to upload Welcome document",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error uploading Welcome document:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
