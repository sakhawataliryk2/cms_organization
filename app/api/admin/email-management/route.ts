import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

// Shared helper for forwarding requests
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

// GET all templates
export async function GET(request: NextRequest) {
  return forwardRequest(request, "/api/email-templates/templates", "GET");
}

// POST new template
export async function POST(request: NextRequest) {
  const body = await request.json();
  return forwardRequest(request, "/api/email-templates/templates", "POST", body);
}