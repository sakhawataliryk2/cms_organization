import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const ALLOWED_ROOTS = ["monster.com", "monster.io", "ziprecruiter.com"];
const STRIP_HEADERS = [
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "cross-origin-embedder-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "set-cookie",
  "set-cookie2",
];
const MAX_REDIRECTS = 5;
const MAX_BYTES = 4 * 1024 * 1024;

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) {
    return false;
  }
  return ALLOWED_ROOTS.some((root) => host === root || host.endsWith(`.${root}`));
}

function parseTarget(raw: string | null) {
  if (!raw) return { error: "Missing url" as const };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: "Invalid url" as const };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: "Only http(s) urls are allowed" as const };
  }
  if (!isAllowedHost(parsed.hostname)) {
    return { error: "Host is not on the Monster / ZipRecruiter allowlist" as const };
  }
  return { url: parsed };
}

function proxyHref(absoluteUrl: string) {
  return `/api/sourcing-proxy?url=${encodeURIComponent(absoluteUrl)}`;
}

function rewriteValue(value: string, pageUrl: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return value;
  }
  try {
    const absolute = new URL(trimmed, pageUrl);
    if (!isAllowedHost(absolute.hostname)) return value;
    return proxyHref(absolute.href);
  } catch {
    return value;
  }
}

function rewriteHtml(html: string, pageUrl: string) {
  let out = html.replace(
    /\b(href|src|action|formaction|poster)\s*=\s*(["'])([^"']*)\2/gi,
    (_m, attr, quote, value) => `${attr}=${quote}${rewriteValue(value, pageUrl)}${quote}`,
  );
  out = out.replace(/url\((['"]?)([^'")]+)\1\)/gi, (_m, quote, value) => {
    const next = rewriteValue(value, pageUrl);
    return `url(${quote}${next}${quote})`;
  });
  return out;
}

function rewriteCss(css: string, pageUrl: string) {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/gi, (_m, quote, value) => {
    const next = rewriteValue(value, pageUrl);
    return `url(${quote}${next}${quote})`;
  });
}

function htmlNotice(title: string, detail: string, status: number) {
  return new NextResponse(
    `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family:Arial,sans-serif;padding:32px;color:#111;background:#f8fafc">
    <p style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#b45309">Proxy demo</p>
    <h1 style="font-size:22px;margin:8px 0 12px">${title}</h1>
    <p style="max-width:42rem;line-height:1.5;color:#334155">${detail}</p>
    <p style="margin-top:24px;font-size:13px;color:#64748b">HTTP ${status}. This is what a server-side proxy can show the client — not a real in-app browser.</p>
  </body>
</html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );
}

async function requireCmsUser() {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get("token")?.value);
}

async function proxyRequest(request: NextRequest, method: "GET" | "POST") {
  if (!(await requireCmsUser())) {
    return htmlNotice(
      "Sign in required",
      "The sourcing proxy only runs for a logged-in CMS user. It is not an open public proxy.",
      401,
    );
  }

  const parsed = parseTarget(request.nextUrl.searchParams.get("url"));
  if ("error" in parsed && parsed.error) {
    return htmlNotice("Proxy rejected this URL", parsed.error, 400);
  }

  let current = parsed.url;
  let currentMethod: "GET" | "POST" = method;
  let upstream: Response | null = null;
  const body =
    method === "POST" ? Buffer.from(await request.arrayBuffer()) : undefined;
  const contentType = request.headers.get("content-type");

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: request.headers.get("accept") || "*/*",
    };
    if (contentType && currentMethod === "POST") headers["Content-Type"] = contentType;

    try {
      upstream = await fetch(current, {
        method: currentMethod,
        headers,
        body: currentMethod === "POST" ? body : undefined,
        redirect: "manual",
        cache: "no-store",
      });
    } catch (error) {
      return htmlNotice(
        "Upstream request failed",
        error instanceof Error ? error.message : "Could not reach the job board from our server.",
        502,
      );
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) break;
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, current);
      } catch {
        break;
      }
      if (!isAllowedHost(nextUrl.hostname)) {
        return htmlNotice(
          "Redirect left the allowlist",
          `The site sent the browser to ${nextUrl.origin}, which this demo proxy will not follow. Login/OAuth hops often do this — that is why a proxy is not a real Monster window.`,
          502,
        );
      }
      current = nextUrl;
      currentMethod = "GET";
      continue;
    }
    break;
  }

  if (!upstream) {
    return htmlNotice("No response", "The job board did not return a page.", 502);
  }

  const incomingType = upstream.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await upstream.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (buffer.length > MAX_BYTES) {
    return htmlNotice(
      "Page too large to proxy",
      "The demo proxy caps responses so it cannot be used as a general web browser.",
      413,
    );
  }

  let payload: Buffer | string = buffer;
  if (incomingType.includes("text/html")) {
    payload = rewriteHtml(buffer.toString("utf8"), current.href);
  } else if (incomingType.includes("text/css")) {
    payload = rewriteCss(buffer.toString("utf8"), current.href);
  }

  const headers = new Headers();
  headers.set("Content-Type", incomingType);
  headers.set("Cache-Control", "no-store");
  const length = typeof payload === "string" ? Buffer.byteLength(payload) : payload.length;
  headers.set("Content-Length", String(length));
  upstream.headers.forEach((value, key) => {
    if (STRIP_HEADERS.includes(key.toLowerCase())) return;
    if (["content-type", "content-length", "content-encoding", "transfer-encoding"].includes(key.toLowerCase())) {
      return;
    }
    headers.set(key, value);
  });

  const body: BodyInit =
    typeof payload === "string" ? payload : new Uint8Array(payload);
  return new NextResponse(body, { status: upstream.status, headers });
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "POST");
}
