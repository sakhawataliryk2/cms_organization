import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get all leads
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
        const response = await fetch(`${apiUrl}/api/leads`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch leads' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching leads:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Create a lead
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

        // ✅ Normalize custom fields key (support both)
        const custom_fields = body.custom_fields || body.customFields || {};

        // ✅ Clean payload (same pattern as jobs)
        const apiData = {
            firstName: body.firstName || "",
            lastName: body.lastName || "",
            status: body.status || "New Lead",
            nickname: body.nickname || "",
            title: body.title || "",
            organizationId: body.organizationId || "",
            organizationName: body.organizationName || body.organizationId || "",
            department: body.department || "",
            reportsTo: body.reportsTo || "",
            owner: body.owner || "",
            secondaryOwners: body.secondaryOwners || "",
            email: body.email || "",
            email2: body.email2 || "",
            phone: body.phone || "",
            mobilePhone: body.mobilePhone || "",
            directLine: body.directLine || "",
            linkedinUrl: body.linkedinUrl || "",
            address: body.address || "",
            // ✅ CRITICAL: Include custom_fields
            custom_fields,
        };

        // Log the request data for debugging
        console.log('Creating lead with data:', apiData);

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/leads`, {
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
                { success: false, message: data.message || 'Failed to create lead' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating lead:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}