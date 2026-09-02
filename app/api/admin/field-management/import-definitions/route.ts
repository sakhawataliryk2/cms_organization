import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function getApiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

async function proxy(method: "GET" | "POST") {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  const upstream = await fetch(`${getApiBase()}/api/custom-fields/import-definitions`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export async function GET(_request: NextRequest) {
  try {
    return await proxy("GET");
  } catch (error) {
    console.error("Error previewing field definition import:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    return await proxy("POST");
  } catch (error) {
    console.error("Error importing field definitions:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
