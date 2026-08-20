import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_ROOTS = ["monster.com", "monster.io", "ziprecruiter.com", "newjobs.com"];

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  ) {
    return false;
  }
  return ALLOWED_ROOTS.some((root) => host === root || host.endsWith(`.${root}`));
}

function demoPage(title: string, detail: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; background: #f8fafc; color: #111; }
      .kicker { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #b45309; }
      h1 { font-size: 22px; margin: 8px 0 12px; }
      p { max-width: 42rem; line-height: 1.5; color: #334155; }
    </style>
  </head>
  <body>
    <p class="kicker">Proxy demo</p>
    <h1>${title}</h1>
    <p>${detail}</p>
    <p>This is what we can show a client inside the dashboard. It is not a real in-app Monster/ZipRecruiter browser.</p>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Sourcing-Proxy": "1",
      },
    },
  );
}

function injectBase(html: string, pageUrl: string) {
  const banner = `
    <div style="position:sticky;top:0;z-index:2147483647;background:#fff7ed;color:#9a3412;border-bottom:1px solid #fdba74;padding:10px 16px;font:13px/1.4 Arial,sans-serif">
      CMS proxy demo — this HTML was fetched by our server so it can sit in the dashboard.
      Login, search, and cookies will not work like a real browser. Use Open in new tab for actual sourcing.
    </div>`;
  const base = `<base href="${pageUrl}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${base}`).replace(/<body[^>]*>/i, (m) => `${m}${banner}`);
  }
  return `${base}${banner}${html}`;
}

export async function GET(request: NextRequest) {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return demoPage(
      "Sign in required",
      "The sourcing proxy only runs for a logged-in CMS user.",
    );
  }

  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return demoPage("Missing url", "Open Monster or ZipRecruiter from the Sourcing page.");
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return demoPage("Invalid url", "The proxy could not parse that address.");
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return demoPage("Blocked url", "Only http(s) job-board URLs are allowed.");
  }
  if (!isAllowedHost(target.hostname)) {
    return demoPage(
      "Host not allowed",
      `${target.hostname} is outside the Monster / ZipRecruiter demo allowlist.`,
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (error) {
    return demoPage(
      "Could not reach the job board",
      error instanceof Error ? error.message : "Our server never got a response.",
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  const finalUrl = upstream.url || target.href;
  const text = await upstream.text();

  if (!contentType.includes("text/html")) {
    return demoPage(
      `Upstream returned ${upstream.status}`,
      `Content-Type was ${contentType || "unknown"}. A proxy only helps when we get HTML back.`,
    );
  }

  if (upstream.status >= 400) {
    return demoPage(
      `The job board returned HTTP ${upstream.status}`,
      `Final URL: ${finalUrl}. This is the site refusing or blocking our server, not a missing CMS page.`,
    );
  }

  return new NextResponse(injectBase(text, finalUrl), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Sourcing-Proxy": "1",
    },
  });
}
