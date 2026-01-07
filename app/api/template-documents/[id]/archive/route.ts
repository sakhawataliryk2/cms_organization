import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json(
    { success: false, message: "Invalid document id" },
    { status: 400 }
  );
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    // doc id validation (number)
    const docId = Number(id);
    if (!Number.isFinite(docId) || docId <= 0) return badId();

     const cookieStore = await cookies();
     const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    // body: { archive: true/false }
    let archive = true;
    try {
      const body = await req.json();
      archive = body?.archive !== false;
    } catch {
      archive = true;
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

    const response = await fetch(
      `${apiUrl}/api/template-documents/${docId}/archive`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ archive }),
        cache: "no-store",
      }
    );

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Backend returned non-JSON:", text.substring(0, 200));
      return NextResponse.json(
        {
          success: false,
          message: `Backend error: ${response.status} ${response.statusText}`,
        },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data?.message || "Archive failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error archiving document:", error?.message || error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
