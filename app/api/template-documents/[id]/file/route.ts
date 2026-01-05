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


export async function GET(
  _request: NextRequest,
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

    // 1) Fetch document to get file_path
    const docRes = await fetch(`${base}/api/template-documents/${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const docJson = await docRes.json().catch(() => ({}));

    if (!docRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: docJson?.message || "Failed to fetch document",
        },
        { status: docRes.status }
      );
    }

    const doc = docJson?.document || docJson;
    const filePath: string | null = doc?.file_path || null;

    if (!filePath) {
      return NextResponse.json(
        { success: false, message: "file_path missing" },
        { status: 404 }
      );
    }

    // 2) Build absolute URL for file
    const fileUrl = filePath.startsWith("/")
      ? `${base}${filePath}`
      : `${base}/${filePath}`;

    // 3) Fetch PDF bytes
    const pdfRes = await fetch(fileUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!pdfRes.ok) {
      // try to parse backend error if it's JSON
      const err = await pdfRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message: err?.message || "Failed to fetch PDF file",
        },
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
