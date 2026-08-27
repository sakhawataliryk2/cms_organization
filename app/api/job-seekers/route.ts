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

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const { searchParams } = new URL(request.url);
        const queryString = buildListQueryString(searchParams);
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

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
            custom_fields: body.custom_fields || {},
        };

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/job-seekers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiData)
        });

        const responseText = await response.text();

        let data: { message?: string };
        try {
            data = JSON.parse(responseText);
        } catch {
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
