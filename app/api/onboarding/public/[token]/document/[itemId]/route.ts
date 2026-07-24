import { NextResponse } from "next/server";

function getApiBase() {
  return process.env.API_BASE_URL || "http://localhost:8080";
}

function isAllowedFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string; itemId: string }> }
) {
  try {
    const { token, itemId } = await context.params;
    const apiBase = getApiBase();

    // 1) Ask Express for the source URL (JSON) — avoids broken binary proxy hop
    const metaRes = await fetch(
      `${apiBase}/api/onboarding/public/${encodeURIComponent(token)}/document/${encodeURIComponent(itemId)}?meta=1`,
      { cache: "no-store" }
    );
    const meta = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok || !meta?.file_url) {
      return NextResponse.json(
        {
          success: false,
          message: meta?.message || "Failed to resolve document",
        },
        { status: metaRes.status || 502 }
      );
    }

    const fileUrl = String(meta.file_url);
    if (!isAllowedFileUrl(fileUrl)) {
      return NextResponse.json(
        { success: false, message: "Document URL not allowed" },
        { status: 403 }
      );
    }

    // 2) Fetch the PDF from blob/storage in the Next server
    const headers: Record<string, string> = {
      "User-Agent": "CMS-Organization/1.0",
    };
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken && /blob\.vercel-storage\.com/i.test(fileUrl)) {
      headers.Authorization = `Bearer ${blobToken}`;
    }

    const fileRes = await fetch(fileUrl, {
      headers,
      cache: "no-store",
      redirect: "follow",
    });

    if (!fileRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `Failed to fetch document (${fileRes.status})`,
        },
        { status: 502 }
      );
    }

    const buf = await fileRes.arrayBuffer();
    if (!buf.byteLength) {
      return NextResponse.json(
        { success: false, message: "Document is empty" },
        { status: 502 }
      );
    }

    const bytes = new Uint8Array(buf);
    const looksPdf =
      bytes.length >= 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46;

    if (!looksPdf) {
      // Still return bytes if content-type says pdf; otherwise fail clearly
      const ct = fileRes.headers.get("content-type") || "";
      if (!ct.includes("pdf")) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Remote file is not a PDF (unexpected content). Check the template document upload.",
          },
          { status: 502 }
        );
      }
    }

    const rawName = String(meta.document_name || "document").replace(
      /[^\w.\- ]+/g,
      ""
    );
    const filename = `${rawName || "document"}.pdf`;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
