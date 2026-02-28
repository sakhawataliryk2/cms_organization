import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET: Fetch applications for a job seeker.
 * Backend reads from job_seeker_applications table (dedicated table), not custom_fields.
 */
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

const DEBUG_TAG = "[Applications POST]";

/**
 * POST: Create a new application for a job seeker.
 * Backend persists to job_seeker_applications table and returns the created row + full list.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobSeekerId } = await params;

    const body = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      console.warn(DEBUG_TAG, "no auth token");
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    const backendUrl = `${apiUrl}/api/job-seekers/${jobSeekerId}/applications`;
    console.log(DEBUG_TAG, "calling backend", { apiUrl, backendUrl });

    const response = await fetch(backendUrl, {
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
      console.error(DEBUG_TAG, "backend response not JSON", { raw: responseText?.substring(0, 300) });
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
      console.warn(DEBUG_TAG, "backend error", { message: data.message ?? data.error, status: response.status });
      return NextResponse.json(
        { success: false, message: data.message || "Failed to add application" },
        { status: response.status }
      );
    }

    console.log(DEBUG_TAG, "backend success", {
      applicationId: data.application?.id ?? data.id,
      job_id: data.application?.job_id ?? data.job_id,
      job_title: data.application?.job_title ?? data.job_title,
    });

    const jobId = body.job_id ?? data.application?.job_id ?? data.job_id;
    const jobTitle =
      data.application?.job_title ?? data.job_title ?? data.application?.job?.job_title ?? `Job #${jobId}`;
    const submittedByName = body.submitted_by_name ?? body.submittedBy ?? "";

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
        console.error(DEBUG_TAG, "submission note failed", { status: noteRes.status, body: await noteRes.text() });
      } else {
        console.log(DEBUG_TAG, "submission note created");
      }
    } catch (noteErr) {
      console.error(DEBUG_TAG, "submission note error", noteErr);
    }

    console.log(
      DEBUG_TAG,
      "done. Submission notification email (if any) is sent by the Node backend sendMail service, not by this route."
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error(DEBUG_TAG, "unexpected error", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
