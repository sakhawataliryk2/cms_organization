import { NextRequest, NextResponse } from 'next/server';
import { buildListQueryString } from '@/lib/apiListParams';
import { proxyAuthedBackend } from '@/lib/proxyAuthedBackend';

// Get all hiring managers (with optional organization_id filter)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const organizationIdRaw = searchParams.get('organization_id')?.trim() ?? '';
        const organizationIdNumeric =
            organizationIdRaw && /^\d+$/.test(organizationIdRaw)
                ? organizationIdRaw
                : null;

        let path = '/api/hiring-managers';
        if (organizationIdNumeric) {
            path = `/api/hiring-managers/organization/${organizationIdNumeric}`;
        }

        const queryString = buildListQueryString(searchParams);
        if (queryString) {
            path = `${path}?${queryString}`;
        }

        return proxyAuthedBackend(path, { method: 'GET' });
    } catch (error) {
        console.error('Error fetching hiring managers:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Create a hiring manager
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

        // Log the request data for debugging
        console.log('Creating hiring manager with data:', body);

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/hiring-managers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
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
                { success: false, message: data.message || 'Failed to create hiring manager' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating hiring manager:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}