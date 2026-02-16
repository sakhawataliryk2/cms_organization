import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get all job seekers
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

        // Make a request to your backend API (forward query params for archived filter - like jobs)
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const { searchParams } = new URL(request.url);
        const queryString = searchParams.toString();
        const url = `${apiUrl}/api/job-seekers${queryString ? `?${queryString}` : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch job seekers' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching job seekers:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Create a job seeker
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Get the token from cookies
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        // ✅ Clean payload (same pattern as Organizations)
        const apiData = {
            firstName: body.firstName || "",
            lastName: body.lastName || "",
            email: body.email || "",
            phone: body.phone || "",
            mobilePhone: body.mobilePhone || "",
            address: body.address || "",
            city: body.city || "",
            state: body.state || "",
            zip: body.zip || "",
            status: body.status || "New lead",
            currentOrganization: body.currentOrganization || "",
            title: body.title || "",
            resumeText: body.resumeText || "",
            skills: body.skills || "",
            desiredSalary: body.desiredSalary || "",
            owner: body.owner || "",
            dateAdded: body.dateAdded || null,
            lastContactDate: body.lastContactDate || null,
            custom_fields: body.custom_fields || {}, // ✅ CRITICAL: Include custom_fields like Organizations
        };

        console.log('Creating job seeker with data:', apiData);

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/job-seekers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiData)
        });

        // Log the response status
        console.log('Backend response status:', response.status);

        // Get response as text first for debugging
        const responseText = await response.text();
        console.log('Raw response:', responseText);

        // Try to parse the response
        let data;
        try {
            data = JSON.parse(responseText);
            console.log('Parsed response data:', data);
        } catch (jsonError) {
            console.error('Error parsing response JSON:', jsonError);
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid response from server',
                    raw: responseText
                },
                { status: 500 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to create job seeker' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating job seeker:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}