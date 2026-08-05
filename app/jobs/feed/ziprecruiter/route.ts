import { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

    const response = await fetch(`${apiUrl}/api/jobs/xml/ziprecruiter`, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "Backend returned error for ZipRecruiter XML feed:",
        response.status,
        response.statusText
      );
      return new Response("Failed to generate ZipRecruiter XML feed", {
        status: response.status,
      });
    }

    const xmlText = await response.text();

    return new Response(xmlText, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error proxying ZipRecruiter jobs XML feed:", error);
    return new Response("Failed to generate ZipRecruiter XML feed", {
      status: 500,
    });
  }
}
