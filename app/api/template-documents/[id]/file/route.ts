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
    const id = String(context?.params?.id || "");

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

    // 1) get doc (to read file_url / file_path)
    const docRes = await fetch(`${base}/api/template-documents/${id}`, {
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

    // ✅ NEW: blob URL (preferred)
    const fileUrl: string | null = doc?.file_url || null;
    if (fileUrl) {
      return NextResponse.redirect(fileUrl);
    }

    // fallback (old local path)
    const filePath: string | null = doc?.file_path || null;
    if (!filePath) {
      return NextResponse.json(
        { success: false, message: "file_url/file_path missing" },
        { status: 404 }
      );
    }

    const url = filePath.startsWith("/")
      ? `${base}${filePath}`
      : `${base}/${filePath}`;

    const pdfRes = await fetch(url, {
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
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
