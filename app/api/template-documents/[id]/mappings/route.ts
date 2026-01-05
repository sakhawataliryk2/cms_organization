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
    const res = await fetch(`${base}/api/template-documents/${id}/mappings`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Internal server error" },
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
    const body = await request.json();

    const res = await fetch(`${base}/api/template-documents/${id}/mappings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
