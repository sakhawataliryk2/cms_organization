import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function PATCH(
  req: Request,
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

  const { archive } = await req.json().catch(() => ({ archive: true }));
  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

  const backendRes = await fetch(
    `${apiUrl}/api/template-documents/${params.id}/archive`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ archive: archive !== false }),
      cache: "no-store",
    }
  );

  const data = await backendRes.json().catch(() => ({}));

  return NextResponse.json(data, { status: backendRes.status });
}
