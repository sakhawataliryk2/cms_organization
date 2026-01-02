import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  req: NextRequest,
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

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

    
    const metaRes = await fetch(`${apiUrl}/api/template-documents/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const meta = await metaRes.json();
    if (!metaRes.ok || !meta?.success) {
      return NextResponse.json(
        { success: false, message: meta?.message || "Document not found" },
        { status: metaRes.status || 400 }
      );
    }

    const doc = meta.document ?? meta.data ?? meta;
    const filePath: string | null = doc?.file_path ?? null;

    if (!filePath) {
      return NextResponse.json(
        { success: false, message: "No file attached" },
        { status: 404 }
      );
    }

  
    const normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;

    
    const pdfRes = await fetch(`${apiUrl}${normalized}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!pdfRes.ok) {
      return NextResponse.json(
        { success: false, message: "Failed to fetch PDF file" },
        { status: pdfRes.status }
      );
    }

    const arrayBuffer = await pdfRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF proxy error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
