import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json(
    { success: false, message: "Invalid packet id" },
    { status: 400 }
  );
}

export async function GET(_: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const packetId = Number(id);
    if (!Number.isFinite(packetId) || packetId <= 0) return badId();

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/packets/${packetId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

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
        { success: false, message: data?.message || "Failed to fetch packet" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching packet:", error?.message || error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const packetId = Number(id);
    if (!Number.isFinite(packetId) || packetId <= 0) return badId();

    const body = await request.json();

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/packets/${packetId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

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
        { success: false, message: data?.message || "Failed to update packet" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating packet:", error?.message || error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const packetId = Number(id);
    if (!Number.isFinite(packetId) || packetId <= 0) return badId();

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/packets/${packetId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

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
        { success: false, message: data?.message || "Failed to delete packet" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting packet:", error?.message || error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
