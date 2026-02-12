import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Resolves a record ID to its display name.
 * GET /api/resolve-record?type=organization&id=123
 *
 * Supported types (case-insensitive): organization, hiring-manager, job, job-seeker, lead, placement, task
 * Plural forms also accepted: organizations, hiring-managers, jobs, job-seekers, leads, placements, tasks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json(
        { success: false, message: "Both type and id are required" },
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

    const normalizedType = type.toLowerCase().replace(/\s+/g, "-").trim();
    // Map both hyphenated and non-hyphenated forms (e.g. jobSeeker → "jobseeker")
    const apiPathMap: Record<string, string> = {
      organization: "/api/organizations",
      organizations: "/api/organizations",
      "hiring-manager": "/api/hiring-managers",
      "hiring-managers": "/api/hiring-managers",
      hiringmanager: "/api/hiring-managers",
      hiringmanagers: "/api/hiring-managers",
      job: "/api/jobs",
      jobs: "/api/jobs",
      "job-seeker": "/api/job-seekers",
      "job-seekers": "/api/job-seekers",
      jobseeker: "/api/job-seekers",
      jobseekers: "/api/job-seekers",
      lead: "/api/leads",
      leads: "/api/leads",
      placement: "/api/placements",
      placements: "/api/placements",
      task: "/api/tasks",
      tasks: "/api/tasks",
      owner: "/api/users/active",
    };

    const basePath = apiPathMap[normalizedType];
    if (!basePath) {
      return NextResponse.json(
        {
          success: false,
          message: `Unknown type: "${type}". Supported: organization, hiring-manager, job, job-seeker, lead, placement, task, owner`,
        },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
    
    // Owner type uses /api/users/active endpoint and finds user by ID
    if (normalizedType === "owner") {
      const url = `${apiUrl}${basePath}`;
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return NextResponse.json(
          {
            success: false,
            message: data.message || "Failed to fetch users",
          },
          { status: response.status }
        );
      }

      const users = data.users || [];
      const user = users.find((u: any) => String(u.id) === String(id));
      const name = user ? (user.name || user.email || "") : "";

      return NextResponse.json({
        success: true,
        name: (name || "").trim() || `User #${id}`,
        id: String(id),
        type: normalizedType,
      });
    }

    const url = `${apiUrl}${basePath}/${id}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data.message || "Record not found",
        },
        { status: response.status }
      );
    }

    let name = "";

    const record =
      data.organization ??
      data.hiringManager ??
      data.job ??
      data.jobSeeker ??
      data.lead ??
      data.placement ??
      data.task ??
      data;

    const isJobSeeker =
      normalizedType.includes("job-seeker") ||
      normalizedType === "jobseeker" ||
      normalizedType === "jobseekers";
    const isJob = normalizedType === "job" || normalizedType === "jobs";

    if (record) {
      if (normalizedType.includes("organization")) {
        name = record.name || "";
      } else if (
        normalizedType.includes("hiring-manager") ||
        normalizedType === "hiringmanager" ||
        normalizedType === "hiringmanagers"
      ) {
        name =
          record.full_name ||
          [record.first_name, record.last_name].filter(Boolean).join(" ") ||
          "";
      } else if (isJobSeeker) {
        name =
          record.full_name ||
          [record.first_name, record.last_name].filter(Boolean).join(" ") ||
          "";
      } else if (isJob) {
        name = record.job_title || record.title || "";
      } else if (normalizedType.includes("lead")) {
        name =
          record.full_name ||
          [record.first_name, record.last_name].filter(Boolean).join(" ") ||
          record.name ||
          record.organization_name ||
          record.company_name ||
          "";
      } else if (normalizedType.includes("placement")) {
        const jsName =
          record.jobSeekerName ||
          record.job_seeker_name ||
          [record.first_name, record.last_name].filter(Boolean).join(" ");
        const jobTitle =
          record.jobTitle || record.job_title || record.job_name || "";
        name = [jsName, jobTitle].filter(Boolean).join(" - ") || `Placement #${id}`;
      } else if (normalizedType.includes("task")) {
        name = record.title || record.subject || "";
      }
    }

    return NextResponse.json({
      success: true,
      name: (name || "").trim() || `#${id}`,
      id: String(id),
      type: normalizedType,
    });
  } catch (error) {
    console.error("Error resolving record:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
