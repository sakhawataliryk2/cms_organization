import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/** Dual-read allowlist: Vercel Blob (legacy) + our private S3 bucket host. */
const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";
const S3_BUCKET = (process.env.S3_BUCKET || "css-ats-resumes").toLowerCase();

function isBlobHost(host: string): boolean {
  return host === "blob.vercel-storage.com" || host.endsWith(BLOB_HOST_SUFFIX);
}

function isOurS3Host(host: string): boolean {
  if (host === `${S3_BUCKET}.s3.amazonaws.com`) return true;
  if (host.startsWith(`${S3_BUCKET}.s3.`) && host.endsWith(".amazonaws.com")) {
    return true;
  }
  return false;
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return isBlobHost(host) || isOurS3Host(host);
  } catch {
    return false;
  }
}

function getApiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
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

    const host = new URL(url).hostname.toLowerCase();
    let res: Response;

    const disposition =
      req.nextUrl.searchParams.get("disposition") === "attachment"
        ? "attachment"
        : "inline";
    const filenameParam = req.nextUrl.searchParams.get("filename");
    const safeFilename = String(filenameParam || "document")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/["\r\n]/g, "")
      .slice(0, 180) || "document";

    if (isOurS3Host(host)) {
      // Private bucket: stream via Express (EC2 IAM / default credential chain)
      const upstream = new URL(`${getApiBase()}/api/storage/proxy`);
      upstream.searchParams.set("url", url);
      upstream.searchParams.set("disposition", disposition);
      upstream.searchParams.set("filename", safeFilename);
      res = await fetch(upstream.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "CMS-Organization/1.0",
        },
        cache: "no-store",
      });
    } else {
      const headers: Record<string, string> = {
        "User-Agent": "CMS-Organization/1.0",
      };
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      if (blobToken) {
        headers.Authorization = `Bearer ${blobToken}`;
      }
      res = await fetch(url, {
        headers,
        cache: "no-store",
        redirect: "follow",
      });
    }

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
        "Content-Disposition": `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
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
