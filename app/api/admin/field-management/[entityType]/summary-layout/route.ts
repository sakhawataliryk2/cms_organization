import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VALID_ENTITY_TYPES = [
  "job-seekers",
  "hiring-managers",
  "organizations",
  "jobs",
  "jobs-direct-hire",
  "jobs-executive-search",
  "placements",
  "placements-direct-hire",
  "placements-executive-search",
  "tasks",
  "planner",
  "leads",
  "tearsheets",
  "goals-quotas",
];

async function proxy(
  request: NextRequest,
  entityType: string,
  method: "GET" | "PUT"
) {
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json(
      { success: false, message: "Invalid entity type" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (method === "PUT") {
    init.body = JSON.stringify(await request.json());
  }

  const response = await fetch(
    `${apiUrl}/api/custom-fields/entity/${entityType}/summary-layout`,
    init
  );
  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json(
      {
        success: false,
        message: data.message || "Failed to process summary layout",
      },
      { status: response.status }
    );
  }
  return NextResponse.json(data);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entityType: string }> }
) {
  try {
    const { entityType } = await params;
    return await proxy(_request, entityType, "GET");
  } catch (error) {
    console.error("Error fetching summary layout:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string }> }
) {
  try {
    const { entityType } = await params;
    return await proxy(request, entityType, "PUT");
  } catch (error) {
    console.error("Error saving summary layout:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
