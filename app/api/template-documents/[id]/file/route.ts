import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

  // 1) get document to read file_path
  const docRes = await fetch(`${apiUrl}/api/template-documents/${params.id}`, {
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

  const docData = await docRes.json();
  const doc = docData?.document || docData;

  const filePath: string | null = doc?.file_path || null;
  if (!filePath) {
    return NextResponse.json(
      { success: false, message: "file_path missing" },
      { status: 404 }
    );
  }

  const url = filePath.startsWith("/")
    ? `${apiUrl}${filePath}`
    : `${apiUrl}/${filePath}`;

  // 2) fetch the actual PDF bytes
  const pdfRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!pdfRes.ok) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch PDF file" },
      { status: pdfRes.status }
    );
  }

  const bytes = await pdfRes.arrayBuffer();

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="template-${params.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
