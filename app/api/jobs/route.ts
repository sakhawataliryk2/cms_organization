import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildListQueryString } from '@/lib/apiListParams';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const queryString = buildListQueryString(request.nextUrl.searchParams);
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/jobs${queryString ? `?${queryString}` : ""}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch jobs' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
      const body = await request.json();
  
      const cookieStore = await cookies();
      const token = cookieStore.get("token")?.value;
  
      if (!token) {
        return NextResponse.json(
          { success: false, message: "Authentication required" },
          { status: 401 }
        );
      }
  
      const custom_fields = body.custom_fields || body.customFields || {};
  
      const apiData = {
        jobTitle: body.jobTitle || "",
        jobType: body.jobType || "",
        category: body.category || "",
        organizationId: body.organizationId || "",
        hiringManager: body.hiringManager || "",
        status: body.status || "Open",
        priority: body.priority || "A",
        employmentType: body.employmentType || "",
        startDate: body.startDate || null,
        worksiteLocation: body.worksiteLocation || "",
        remoteOption: body.remoteOption || "",
        jobDescription: body.jobDescription || "",
        salaryType: body.salaryType || "yearly",
        minSalary: body.minSalary || null,
        maxSalary: body.maxSalary || null,
        benefits: body.benefits || "",
        requiredSkills: body.requiredSkills || "",
        jobBoardStatus: body.jobBoardStatus || "Not Posted",
        owner: body.owner || "",
        dateAdded: body.dateAdded || null,
        custom_fields,
        customFields: custom_fields,
      };
  
      const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";
      const response = await fetch(`${apiUrl}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(apiData),
      });
  
      const responseText = await response.text();
      let data: { message?: string } = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        /* ignore */
      }
  
      if (!response.ok) {
        return NextResponse.json(
          { success: false, message: data.message || "Failed to create job" },
          { status: response.status }
        );
      }
  
      return NextResponse.json(data);
    } catch (error) {
      console.error("Error creating job:", error);
      return NextResponse.json(
        { success: false, message: "Internal server error" },
        { status: 500 }
      );
    }
}
