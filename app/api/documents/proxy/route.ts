import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/** Allowed host suffix for document proxy (prevents SSRF). Vercel Blob: [store-id].public.blob.vercel-storage.com */
const ALLOWED_HOST_SUFFIX = ".blob.vercel-storage.com";

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host.endsWith(ALLOWED_HOST_SUFFIX) || host === "blob.vercel-storage.com";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get("url");
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, message: "Missing url parameter" },
        { status: 400 }
      );
    }

    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        { success: false, message: "URL not allowed" },
        { status: 403 }
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

    const headers: Record<string, string> = {
      "User-Agent": "CMS-Organization/1.0",
    };
    // Do not forward browser Range requests — always fetch the full PDF.
    // pdf.js range probes against a non-range proxy often surface as odd/empty responses.

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      headers.Authorization = `Bearer ${blobToken}`;
    }

    const res = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok || res.status === 204) {
      return NextResponse.json(
        { success: false, message: `Failed to fetch document (${res.status})` },
        { status: 502 }
      );
    }

    const body = await res.arrayBuffer();

    if (!body.byteLength) {
      return NextResponse.json(
        { success: false, message: "Document is empty" },
        { status: 502 }
      );
    }

    const bytes = new Uint8Array(body);
    const looksPdf =
      bytes.length >= 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46;

    let contentType = res.headers.get("content-type") || "application/octet-stream";
    if (looksPdf || contentType.includes("pdf") || url.toLowerCase().includes(".pdf")) {
      contentType = "application/pdf";
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'inline; filename="document.pdf"',
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "none",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    console.error("Document proxy error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
