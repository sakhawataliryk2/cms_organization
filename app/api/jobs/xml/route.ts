import { NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

    const response = await fetch(`${apiUrl}/api/jobs/xml`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // Do not cache the XML feed
      cache: "no-store",
    });

    const xmlText = await response.text();

    return new Response(xmlText, {
      status: response.status,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="jobs-xml-feed.xml"',
      },
    });
  } catch (error) {
    console.error("Error proxying jobs XML feed:", error);
    return new Response("Failed to generate XML feed", { status: 500 });
  }
}

