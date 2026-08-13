import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const apiUrl = process.env.API_BASE_URL;

function requireApiUrl() {
  if (!apiUrl) throw new Error("API_BASE_URL is not set");
  return apiUrl;
}

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value || "";
}

function isRemoteStorageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".blob.vercel-storage.com") || host === "blob.vercel-storage.com") {
      return true;
    }
    if (host.endsWith(".amazonaws.com") && host.includes(".s3.")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(_req: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params);
    const id = String(params?.id || "");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing document id" },
        { status: 400 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const base = requireApiUrl();

    const docRes = await fetch(`${base}/api/template-documents/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const docJson = await docRes.json().catch(() => ({}));
    if (!docRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: docJson?.message || "Failed to fetch document",
        },
        { status: docRes.status }
      );
    }

    const doc = docJson?.document || docJson;
    const fileUrl: string | null = doc?.file_url || null;
    const filePath: string | null = doc?.file_path || null;
    const remoteUrl =
      (fileUrl && isRemoteStorageUrl(fileUrl) && fileUrl) ||
      (filePath && isRemoteStorageUrl(filePath) && filePath) ||
      null;

    // Private S3 / Blob: never redirect the browser — proxy bytes via Express.
    if (remoteUrl) {
      const proxyRes = await fetch(
        `${base}/api/storage/proxy?url=${encodeURIComponent(remoteUrl)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "CMS-Organization/1.0",
          },
          cache: "no-store",
        }
      );

      if (!proxyRes.ok) {
        const err = await proxyRes.json().catch(() => ({}));
        return NextResponse.json(
          {
            success: false,
            message:
              (err as { message?: string })?.message ||
              `Failed to fetch PDF file (${proxyRes.status})`,
          },
          { status: proxyRes.status || 502 }
        );
      }

      const bytes = await proxyRes.arrayBuffer();
      const contentType =
        proxyRes.headers.get("content-type") || "application/pdf";

      return new NextResponse(bytes, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="template-${id}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (fileUrl && /^https?:\/\//i.test(fileUrl)) {
      // Non-S3 remote URL (legacy): still avoid bare redirect when possible
      const pdfRes = await fetch(fileUrl, {
        headers: { "User-Agent": "CMS-Organization/1.0" },
        cache: "no-store",
        redirect: "follow",
      });
      if (!pdfRes.ok) {
        return NextResponse.json(
          { success: false, message: `Failed to fetch PDF file (${pdfRes.status})` },
          { status: 502 }
        );
      }
      const bytes = await pdfRes.arrayBuffer();
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": pdfRes.headers.get("content-type") || "application/pdf",
          "Content-Disposition": `inline; filename="template-${id}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (!filePath) {
      return NextResponse.json(
        { success: false, message: "file_url/file_path missing" },
        { status: 404 }
      );
    }

    const url = filePath.startsWith("/")
      ? `${base}${filePath}`
      : `${base}/${filePath}`;

    const pdfRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!pdfRes.ok) {
      const err = await pdfRes.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, message: err?.message || "Failed to fetch PDF file" },
        { status: pdfRes.status }
      );
    }

    const bytes = await pdfRes.arrayBuffer();

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="template-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
