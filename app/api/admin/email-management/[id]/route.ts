import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json(
    { success: false, message: "Invalid email template ID" },
    { status: 400 }
  );
}

export async function GET(_: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const templateId = Number(id);
    if (!Number.isFinite(templateId) || templateId <= 0) return badId();

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/email-templates/templates/${templateId}`, {
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
        { success: false, message: data?.message || "Failed to fetch email template" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching email template:", error?.message || error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const templateId = Number(id);
    if (!Number.isFinite(templateId) || templateId <= 0) return badId();

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
    const response = await fetch(`${apiUrl}/api/email-templates/templates/${templateId}`, {
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
        { success: false, message: data?.message || "Failed to update email template" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating email template:", error?.message || error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const templateId = Number(id);
    if (!Number.isFinite(templateId) || templateId <= 0) return badId();

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/email-templates/templates/${templateId}`, {
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
        { success: false, message: data?.message || "Failed to delete email template" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting email template:", error?.message || error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
