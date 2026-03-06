import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "Authentication failed" },
        { status: response.status }
      );
    }

    // 2FA step: backend should indicate that an OTP was sent
    if (data.requires2FA) {
      return NextResponse.json({
        success: true,
        requires2FA: true,
        message: data.message || "Verification code sent to your email",
        email,
      });
    }

    // Fallback: if backend still returns a token/user without 2FA, proxy it through
    return NextResponse.json({
      success: true,
      message: data.message || "Login successful",
      user: data.user,
      token: data.token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}