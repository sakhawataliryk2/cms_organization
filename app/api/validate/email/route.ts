import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Proxies to Express: POST /api/validate/email
 * NeverBounce API key stays on the Node server.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const email = typeof body?.email === "string" ? body.email : "";

        if (!email.trim()) {
            return NextResponse.json(
                { success: false, message: "Email is required" },
                { status: 400 }
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

        const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
        const response = await fetch(`${apiUrl}/api/validate/email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email: email.trim() }),
        });

        const text = await response.text();
        let data: Record<string, unknown> = {};
        try {
            data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid response from server" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: data.success !== false,
                ...data,
            },
            { status: response.status }
        );
    } catch (error) {
        console.error("Email validation error:", error);
        return NextResponse.json(
            {
                success: false,
                isValid: false,
                message: "Email validation service error",
            },
            { status: 500 }
        );
    }
}
