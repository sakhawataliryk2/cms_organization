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

    // 4) Email sending is handled in the Node backend via sendMail
    // (see jobseekerPortalAuthController.adminSetPassword). At this
    // point the portal account has been created/updated and the
    // backend has dispatched the credentials email.

    return NextResponse.json({
      message:
        "Password reset successfully. Login credentials email has been sent from the backend.",
    });
  } catch (error: unknown) {
    console.error("Password reset error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ message }, { status: 500 });
  }
}
