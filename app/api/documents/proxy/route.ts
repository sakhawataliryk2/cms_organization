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

    const res = await fetch(url, {
      headers: {
        "User-Agent": "CMS-Organization/1.0",
      },
      cache: "no-store",
    });

    if (!res.ok || res.status === 204) {
      return NextResponse.json(
        { success: false, message: "Failed to fetch document" },
        { status: res.status === 204 ? 502 : res.status }
      );
    }

    let contentType = res.headers.get("content-type") || "application/octet-stream";
    let contentDisposition = res.headers.get("content-disposition");

    const body = await res.arrayBuffer();

    if (body.byteLength === 0) {
      return NextResponse.json(
        { success: false, message: "Document is empty" },
        { status: 502 }
      );
    }

    if (contentType.includes("pdf")) {
      contentType = "application/pdf";
      if (!contentDisposition || contentDisposition.toLowerCase().includes("attachment")) {
        contentDisposition = "inline";
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Frame-Options": "SAMEORIGIN",
    };
    if (contentDisposition) {
      headers["Content-Disposition"] =
        typeof contentDisposition === "string"
          ? contentDisposition.replace(/attachment/i, "inline")
          : "inline";
    }

    return new NextResponse(body, { status: 200, headers });
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
