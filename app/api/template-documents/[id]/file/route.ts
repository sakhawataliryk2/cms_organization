import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const apiUrl = process.env.API_BASE_URL;

function requireApiUrl() {
  if (!apiUrl) throw new Error("API_BASE_URL is not set");
  return apiUrl;
}

async function getToken() {
  const cookieStore = await cookies(); 
  return cookieStore.get("token")?.value || "";
}

export async function GET(_req: NextRequest, context: any) {
  try {
    
    const p = await context?.params;
    const id = p?.id;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing document id" },
        { status: 400 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const base = requireApiUrl();

    // 1) Get document to read file_path
    const docRes = await fetch(`${base}/api/template-documents/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!docRes.ok) {
      const err = await docRes.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, message: err?.message || "Failed to load document" },
        { status: docRes.status }
      );
    }

    const docData = await docRes.json().catch(() => ({}));
    const doc = docData?.document || docData;

    const filePath: string | null = doc?.file_path || null;
    if (!filePath) {
      return NextResponse.json(
        { success: false, message: "file_path missing" },
        { status: 404 }
      );
    }

    const fileUrl = filePath.startsWith("/")
      ? `${base}${filePath}`
      : `${base}/${filePath}`;

    // 2) Fetch the actual PDF bytes
    const pdfRes = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!pdfRes.ok) {
      const err = await pdfRes.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, message: err?.message || "Failed to fetch PDF file" },
        { status: pdfRes.status }
      );
    }

    const bytes = await pdfRes.arrayBuffer();

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="template-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Error fetching template PDF:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
