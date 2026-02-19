import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const ONBOARDING_EMAIL = "Onboarding@completestaffingsolutions.com";
const EXTRA_EMAIL = "nt50616849@gmail.com";

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

function getJobSeekerEmail(data: any): string | null {
  const email =
    data.data?.email ||
    data.jobSeeker?.email ||
    data.email ||
    data.job_seeker?.email ||
    null;
  if (!email || email === "No email provided" || String(email).trim() === "")
    return null;
  return String(email).trim();
}

function getRecordOwnerEmail(data: any): string | null {
  const owner =
    data.data?.record_owner ||
    data.jobSeeker?.record_owner ||
    data.record_owner ||
    data.owner;
  if (!owner) return null;
  const email =
    typeof owner === "string"
      ? null
      : owner?.email ?? null;
  if (!email || String(email).trim() === "") return null;
  return String(email).trim();
}

function getJobSeekerUserId(data: any): string | null {
  const raw =
    data.data?.user_id ??
    data.jobSeeker?.user_id ??
    data.job_seeker?.user_id ??
    data.user_id ??
    data.data?.userId ??
    data.jobSeeker?.userId ??
    null;
  if (raw == null || raw === "") return null;
  return String(raw).trim();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobSeekerId } = await params;
    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    // 1) Fetch job seeker
    const jobSeekerResponse = await fetch(
      `${apiUrl}/api/job-seekers/${jobSeekerId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!jobSeekerResponse.ok) {
      throw new Error("Failed to fetch job seeker details");
    }

    const jobSeekerData = await jobSeekerResponse.json();
    const jobSeekerEmail = getJobSeekerEmail(jobSeekerData);
    const recordOwnerEmail = getRecordOwnerEmail(jobSeekerData);

    if (!jobSeekerEmail) {
      return NextResponse.json(
        {
          message: "Job seeker email not available",
          debug: {
            dataEmail: jobSeekerData.data?.email,
            jobSeekerEmail: jobSeekerData.jobSeeker?.email,
            rootEmail: jobSeekerData.email,
          },
        },
        { status: 400 }
      );
    }

    // 2) Generate temporary password
    const temporaryPassword = generateTemporaryPassword(12);

    // 3) Backend: set temporary password — try admin-set-password first, then PUT users/:userId/password
    let passwordSet = false;

    const setPasswordUrl = `${apiUrl}/api/jobseeker-portal/auth/admin-set-password`;
    const setPasswordResponse = await fetch(setPasswordUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: jobSeekerEmail,
        temporaryPassword,
        jobSeekerId,
      }),
      cache: "no-store",
    });

    if (setPasswordResponse.ok) {
      passwordSet = true;
    } else if (setPasswordResponse.status === 404) {
      // Fallback: if backend has no admin-set-password, try PUT users/:userId/password
      const userId = getJobSeekerUserId(jobSeekerData);
      if (userId) {
        const putRes = await fetch(`${apiUrl}/api/users/${userId}/password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newPassword: temporaryPassword }),
          cache: "no-store",
        });
        if (putRes.ok) passwordSet = true;
        else {
          const putData = await putRes.json().catch(() => ({}));
          return NextResponse.json(
            {
              message:
                putData.message ||
                "Backend rejected password update. Job seeker may need a linked user account (user_id) and the backend must allow admin to set password via PUT /api/users/:userId/password with body { newPassword }.",
            },
            { status: putRes.status }
          );
        }
      } else {
        return NextResponse.json(
          {
            message:
              "Backend has no endpoint /api/jobseeker-portal/auth/admin-set-password (404). Either add that endpoint (POST, body: { email, temporaryPassword, jobSeekerId }) or ensure the job seeker record has a user_id and the backend allows PUT /api/users/:userId/password with { newPassword } for admin.",
          },
          { status: 404 }
        );
      }
    } else {
      const errData = await setPasswordResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          message:
            errData.message ||
            "Backend could not set password.",
        },
        { status: setPasswordResponse.status }
      );
    }

    if (!passwordSet) {
      return NextResponse.json(
        { message: "Could not set temporary password on backend." },
        { status: 500 }
      );
    }

    // 4) Build login URL (job seeker portal)
    const origin =
      process.env.NEXTAUTH_URL ||
      (req.headers.get("x-forwarded-proto") && req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
        : null) ||
      (req.url ? new URL(req.url).origin : "https://app.completestaffingsolutions.com");
    const loginUrl =
      process.env.JOBSEEKER_PORTAL_LOGIN_URL ||
      `${origin}/job-seeker-portal`;

    const emailBody = `
<p><strong>Job Seeker Login Credentials</strong></p>
<p>Please use the following credentials to sign in. You will be prompted to change your password after first login.</p>
<table style="border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 6px 12px; border: 1px solid #ddd;"><strong>Portal URL</strong></td><td style="padding: 6px 12px; border: 1px solid #ddd;"><a href="${loginUrl}">${loginUrl}</a></td></tr>
  <tr><td style="padding: 6px 12px; border: 1px solid #ddd;"><strong>Email</strong></td><td style="padding: 6px 12px; border: 1px solid #ddd;">${jobSeekerEmail}</td></tr>
  <tr><td style="padding: 6px 12px; border: 1px solid #ddd;"><strong>Temporary Password</strong></td><td style="padding: 6px 12px; border: 1px solid #ddd;">${temporaryPassword}</td></tr>
</table>
<p><strong>Important:</strong> For security, please change your password after your first login.</p>
<p>This is an automated message from Complete Staffing Solutions.</p>
    `.trim();

    const toAddresses: string[] = [
      recordOwnerEmail,
      ONBOARDING_EMAIL,
      EXTRA_EMAIL,
      jobSeekerEmail,
    ].filter(Boolean) as string[];

    const uniqueTo = Array.from(new Set(toAddresses));

    if (uniqueTo.length === 0) {
      return NextResponse.json(
        { message: "No valid recipient addresses (record owner, onboarding, or job seeker)." },
        { status: 400 }
      );
    }

    // 5) Send email via app's Office365 API (uses same token)
    const emailApiOrigin = req.url ? new URL(req.url).origin : origin;
    const emailResponse = await fetch(`${emailApiOrigin}/api/office365/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subject: "Job Seeker Login Credentials",
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
            "Password was reset but sending login credentials by email failed. Please share the temporary password with the job seeker manually.",
          emailError: emailErr?.error || emailErr?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        "Password reset successfully. Login credentials have been sent to the Record Owner, Onboarding@completestaffingsolutions.com, nt50616849@gmail.com, and the Job Seeker.",
    });
  } catch (error: unknown) {
    console.error("Password reset error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ message }, { status: 500 });
  }
}
