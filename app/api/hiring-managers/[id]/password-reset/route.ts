import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const PAYROLL_EMAIL = "payroll@completestaffingsolutions.com";

function generateTemporaryPassword(length = 12): string {
  const charset =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

function getHiringManagerEmail(data: any): string | null {
  const email =
    data.data?.email ||
    data.hiringManager?.email ||
    data.hiring_manager?.email ||
    data.email ||
    null;
  if (!email || email === "No email provided" || String(email).trim() === "")
    return null;
  return String(email).trim();
}

function getRecordOwnerEmail(data: any): string | null {
  const owner =
    data.data?.record_owner ||
    data.hiringManager?.record_owner ||
    data.hiring_manager?.record_owner ||
    data.record_owner ||
    data.owner;
  if (!owner) return null;
  const email = typeof owner === "string" ? null : owner?.email ?? null;
  if (!email || String(email).trim() === "") return null;
  return String(email).trim();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hiringManagerId } = await params;
    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    // 1) Fetch hiring manager
    const hmResponse = await fetch(
      `${apiUrl}/api/hiring-managers/${hiringManagerId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!hmResponse.ok) {
      throw new Error("Failed to fetch hiring manager details");
    }

    const hmData = await hmResponse.json();
    const hmEmail = getHiringManagerEmail(hmData);
    const recordOwnerEmail = getRecordOwnerEmail(hmData);

    if (!hmEmail) {
      return NextResponse.json(
        {
          message: "Hiring manager email not available",
        },
        { status: 400 }
      );
    }

    // 2) Generate temporary password
    const temporaryPassword = generateTemporaryPassword(12);

    // 3) Backend: set temporary password
    const setPasswordUrl = `${apiUrl}/api/hiring-manager-portal/auth/admin-set-password`;
    const setPasswordResponse = await fetch(setPasswordUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: hmEmail,
        temporaryPassword,
        hiringManagerId,
      }),
      cache: "no-store",
    });

    if (!setPasswordResponse.ok) {
      const errData = await setPasswordResponse.json().catch(() => ({}));
      const msg =
        errData.message ||
        "Backend could not set password. Ensure the API implements POST /api/hiring-manager-portal/auth/admin-set-password (body: { email, temporaryPassword, hiringManagerId }).";
      return NextResponse.json(
        { message: msg },
        { status: setPasswordResponse.status }
      );
    }

    // 4) Build login URL (hiring manager / CMS login)
    const origin =
      process.env.NEXTAUTH_URL ||
      (req.headers.get("x-forwarded-proto") && req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
        : null) ||
      (req.url ? new URL(req.url).origin : "https://app.completestaffingsolutions.com");
    const loginUrl =
      process.env.HIRING_MANAGER_PORTAL_LOGIN_URL ||
      `${origin}/dashboard` ||
      `${origin}/login`;

    const emailBody = `
<p><strong>Hiring Manager Login Credentials</strong></p>
<p>Please use the following credentials to sign in. You will be prompted to change your password after first login.</p>
<table style="border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 6px 12px; border: 1px solid #ddd;"><strong>Portal URL</strong></td><td style="padding: 6px 12px; border: 1px solid #ddd;"><a href="${loginUrl}">${loginUrl}</a></td></tr>
  <tr><td style="padding: 6px 12px; border: 1px solid #ddd;"><strong>Email</strong></td><td style="padding: 6px 12px; border: 1px solid #ddd;">${hmEmail}</td></tr>
  <tr><td style="padding: 6px 12px; border: 1px solid #ddd;"><strong>Temporary Password</strong></td><td style="padding: 6px 12px; border: 1px solid #ddd;">${temporaryPassword}</td></tr>
</table>
<p><strong>Important:</strong> For security, please change your password after your first login.</p>
<p>This is an automated message from Complete Staffing Solutions.</p>
    `.trim();

    const toAddresses: string[] = [
      recordOwnerEmail,
      PAYROLL_EMAIL,
      hmEmail,
    ].filter(Boolean) as string[];

    const uniqueTo = Array.from(new Set(toAddresses));

    if (uniqueTo.length === 0) {
      return NextResponse.json(
        {
          message:
            "No valid recipient addresses (record owner, payroll, or hiring manager).",
        },
        { status: 400 }
      );
    }

    // 5) Send email via app's Office365 API
    const emailApiOrigin = req.url ? new URL(req.url).origin : origin;
    const emailResponse = await fetch(`${emailApiOrigin}/api/office365/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subject: "Hiring Manager Login Credentials",
        body: emailBody,
        bodyType: "html",
        to: uniqueTo,
      }),
    });

    if (!emailResponse.ok) {
      const emailErr = await emailResponse.json().catch(() => ({}));
      console.error("Email send failed:", emailErr);
      return NextResponse.json(
        {
          message:
            "Password was reset but sending login credentials by email failed. Please share the temporary password with the hiring manager manually.",
          emailError: emailErr?.error || emailErr?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        "Password reset successfully. Login credentials have been sent to the Record Owner, payroll@completestaffingsolutions.com, and the Hiring Manager.",
    });
  } catch (error: unknown) {
    console.error("Hiring manager password reset error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ message }, { status: 500 });
  }
}
