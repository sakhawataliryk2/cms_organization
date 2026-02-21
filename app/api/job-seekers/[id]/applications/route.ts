import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/job-seekers/${id}/applications`, {
      method: "GET",  
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const responseText = await response.text();

    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON response from backend",
          rawResponse: responseText.substring(0, 200) + "...",
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "Failed to fetch applications" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobSeekerId } = await params;

    const body = await request.json();
    const submittedByName = body.submitted_by_name ?? body.submittedBy ?? "";
    const submittedByEmail = body.submitted_by_email ?? body.submittedByEmail ?? "";

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${apiUrl}/api/job-seekers/${jobSeekerId}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON response from backend",
          rawResponse: responseText.substring(0, 200) + "...",
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "Failed to add application" },
        { status: response.status }
      );
    }

    const jobId = body.job_id ?? data.application?.job_id ?? data.job_id;
    const jobTitle =
      data.application?.job_title ?? data.job_title ?? data.application?.job?.job_title ?? `Job #${jobId}`;

    try {
      const noteRes = await fetch(`${apiUrl}/api/job-seekers/${jobSeekerId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: `Candidate submitted to ${jobTitle} by ${submittedByName || "Recruiter"}.`,
          note_type: "Client Submission",
          action: "Client Submission",
        }),
      });
      if (!noteRes.ok) {
        console.error("Submission note failed:", await noteRes.text());
      }
    } catch (noteErr) {
      console.error("Error logging submission note:", noteErr);
    }

    const toEmails: string[] = [];
    if (submittedByEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedByEmail)) {
      toEmails.push(submittedByEmail);
    }

    try {
      const jsRes = await fetch(`${apiUrl}/api/job-seekers/${jobSeekerId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (jsRes.ok) {
        const jsData = await jsRes.json();
        const js = jsData.jobSeeker ?? jsData.job_seeker ?? jsData.data ?? jsData;
        const ownerEmail = js.owner_email ?? js.owner?.email ?? js.created_by_email;
        if (ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) && !toEmails.includes(ownerEmail)) {
          toEmails.push(ownerEmail);
        }
      }
    } catch (_) {}

    if (jobId) {
      try {
        const jobRes = await fetch(`${apiUrl}/api/jobs/${jobId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (jobRes.ok) {
          const jobData = await jobRes.json();
          const job = jobData.job ?? jobData.data ?? jobData;
          const jobOwnerEmail = job.owner_email ?? job.owner?.email ?? job.account_manager_email ?? job.hiring_manager_email;
          if (jobOwnerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(jobOwnerEmail) && !toEmails.includes(jobOwnerEmail)) {
            toEmails.push(jobOwnerEmail);
          }
        }
      } catch (_) {}
    }

    if (toEmails.length > 0) {
      const origin = request.nextUrl?.origin ?? request.headers.get("x-forwarded-host") ? `https://${request.headers.get("x-forwarded-host")}` : "http://localhost:3000";
      try {
        const emailRes = await fetch(`${origin}/api/office365/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            to: toEmails,
            subject: `Submission: Candidate submitted to ${jobTitle}`,
            body: `A candidate has been submitted to ${jobTitle} by ${submittedByName || "Recruiter"}.\n\nThis is an automated notification from the ATS.`,
            bodyType: "text",
          }),
        });
        if (!emailRes.ok) {
          console.error("Submission notification email failed:", await emailRes.text());
        }
      } catch (emailErr) {
        console.error("Error sending submission emails:", emailErr);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
