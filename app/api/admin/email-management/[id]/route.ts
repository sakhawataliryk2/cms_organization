import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

// Shared helper
async function forwardRequest(
  request: NextRequest,
  endpoint: string,
  method: string,
  body?: any
) {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const response = await fetch(`${apiUrl}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

// GET template by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return forwardRequest(request, `/api/email-templates/templates/${params.id}`, "GET");
}

// PUT update template by ID
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  return forwardRequest(request, `/api/email-templates/templates/${params.id}`, "PUT", body);
}

// DELETE template by ID
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return forwardRequest(request, `/api/email-templates/templates/${params.id}`, "DELETE");
}