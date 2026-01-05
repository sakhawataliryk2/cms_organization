import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

async function getTokenOr401() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return {
      token: null,
      response: NextResponse.json(
        { success: false, message: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }
  return { token, response: null as any };
}

async function safeJson(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      data: null,
      text: text.substring(0, 300),
    };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data, text: "" };
}

function parseId(searchParams: URLSearchParams) {
  const raw = searchParams.get("id");
  if (!raw) return null;

  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return "INVALID";
  return n;
}

/**
 * GET /api/packets              -> list packets
 * GET /api/packets?id=123       -> get single packet (optional)
 */
export async function GET(req: NextRequest) {
  const { token, response } = await getTokenOr401();
  if (!token) return response;

  const id = parseId(req.nextUrl.searchParams);

  // If id is provided and invalid
  if (id === "INVALID") {
    return NextResponse.json(
      { success: false, message: "Invalid packet id" },
      { status: 400 }
    );
  }

  const url = id
    ? `${API_BASE}/api/packets?id=${id}`
    : `${API_BASE}/api/packets`;

  const backendRes = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const parsed = await safeJson(backendRes);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        success: false,
        message:
          backendRes.status === 404
            ? "Packets API endpoint not found. Please restart backend."
            : `Backend error: ${backendRes.status} ${backendRes.statusText}`,
        debug: parsed.text,
      },
      { status: backendRes.status || 500 }
    );
  }

  return NextResponse.json(parsed.data, { status: backendRes.status });
}

/**
 * POST /api/packets
 * body: { packet_name: string, documents: [{document_id:number, sort_order:number}] }
 */
export async function POST(req: NextRequest) {
  const { token, response } = await getTokenOr401();
  if (!token) return response;

  const body = await req.json().catch(() => null);

  if (!body?.packet_name || typeof body.packet_name !== "string") {
    return NextResponse.json(
      { success: false, message: "packet_name is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body?.documents) || body.documents.length === 0) {
    return NextResponse.json(
      { success: false, message: "documents[] is required" },
      { status: 400 }
    );
  }

  // hard guard: avoid NaN going to backend
  for (const d of body.documents) {
    const docId = Number(d?.document_id);
    const order = Number(d?.sort_order);

    if (!Number.isInteger(docId) || docId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid document_id in documents[]" },
        { status: 400 }
      );
    }
    if (!Number.isInteger(order) || order <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid sort_order in documents[]" },
        { status: 400 }
      );
    }
  }

  const backendRes = await fetch(`${API_BASE}/api/packets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const parsed = await safeJson(backendRes);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        success: false,
        message:
          backendRes.status === 404
            ? "Packets API endpoint not found. Please restart backend."
            : `Backend error: ${backendRes.status} ${backendRes.statusText}`,
        debug: parsed.text,
      },
      { status: backendRes.status || 500 }
    );
  }

  return NextResponse.json(parsed.data, { status: backendRes.status });
}

/**
 * PUT /api/packets?id=123
 * body: { packet_name?: string, documents?: [...] }
 */
export async function PUT(req: NextRequest) {
  const { token, response } = await getTokenOr401();
  if (!token) return response;

  const id = parseId(req.nextUrl.searchParams);
  if (!id || id === "INVALID") {
    return NextResponse.json(
      { success: false, message: "Valid id is required in query: ?id=123" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { success: false, message: "Body is required" },
      { status: 400 }
    );
  }

  // Optional validation if documents provided
  if (Array.isArray(body?.documents)) {
    for (const d of body.documents) {
      const docId = Number(d?.document_id);
      const order = Number(d?.sort_order);
      if (!Number.isInteger(docId) || docId <= 0) {
        return NextResponse.json(
          { success: false, message: "Invalid document_id in documents[]" },
          { status: 400 }
        );
      }
      if (!Number.isInteger(order) || order <= 0) {
        return NextResponse.json(
          { success: false, message: "Invalid sort_order in documents[]" },
          { status: 400 }
        );
      }
    }
  }

  const backendRes = await fetch(`${API_BASE}/api/packets?id=${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const parsed = await safeJson(backendRes);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        success: false,
        message: `Backend error: ${backendRes.status} ${backendRes.statusText}`,
        debug: parsed.text,
      },
      { status: backendRes.status || 500 }
    );
  }

  return NextResponse.json(parsed.data, { status: backendRes.status });
}

/**
 * DELETE /api/packets?id=123
 */
export async function DELETE(req: NextRequest) {
  const { token, response } = await getTokenOr401();
  if (!token) return response;

  const id = parseId(req.nextUrl.searchParams);
  if (!id || id === "INVALID") {
    return NextResponse.json(
      { success: false, message: "Valid id is required in query: ?id=123" },
      { status: 400 }
    );
  }

  const backendRes = await fetch(`${API_BASE}/api/packets?id=${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const parsed = await safeJson(backendRes);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        success: false,
        message: `Backend error: ${backendRes.status} ${backendRes.statusText}`,
        debug: parsed.text,
      },
      { status: backendRes.status || 500 }
    );
  }

  return NextResponse.json(parsed.data, { status: backendRes.status });
}
