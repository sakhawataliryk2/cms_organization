import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get all jobs
export async function GET(request: NextRequest) {
    try {
        // Get the token from cookies
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/jobs`, {
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

// Create a job
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
  
      // ✅ Normalize custom fields key (support both)
      const custom_fields = body.custom_fields || body.customFields || {};
  
      // ✅ Clean payload (Organizations pattern)
      const apiData = {
        jobTitle: body.jobTitle || "",
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
  
        // ✅ CRITICAL
        custom_fields,
        // ✅ ALSO send camelCase for your current Job model (until you fix backend)
        customFields: custom_fields,
      };
  
      console.log("Creating job payload being sent to backend:", apiData);
  
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
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {}
  
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
  

// Create a job
// export async function POST(request: NextRequest) {
//     try {
//         const body = await request.json();

//         // Get the token from cookies
//         const cookieStore = await cookies();
//         const token = cookieStore.get('token')?.value;

//         if (!token) {
//             return NextResponse.json(
//                 { success: false, message: 'Authentication required' },
//                 { status: 401 }
//             );
//         }

//         // Log the request data for debugging
//         console.log('Creating job with data:', body);

//         // Make a request to your backend API
//         const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
//         const response = await fetch(`${apiUrl}/api/jobs`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`
//             },
//             body: JSON.stringify(body)
//         });

//         // Log the response status
//         console.log('Backend response status:', response.status);

//         // Get response as text first for debugging
//         const responseText = await response.text();
//         console.log('Raw response:', responseText);

//         // Try to parse the response
//         let data;
//         try {
//             data = JSON.parse(responseText);
//             console.log('Parsed response data:', data);
//         } catch (jsonError) {
//             console.error('Error parsing response JSON:', jsonError);
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: 'Invalid response from server',
//                     raw: responseText
//                 },
//                 { status: 500 }
//             );
//         }

//         if (!response.ok) {
//             return NextResponse.json(
//                 { success: false, message: data.message || 'Failed to create job' },
//                 { status: response.status }
//             );
//         }

//         return NextResponse.json(data);
//     } catch (error) {
//         console.error('Error creating job:', error);
//         return NextResponse.json(
//             { success: false, message: 'Internal server error' },
//             { status: 500 }
//         );
//     }
// }