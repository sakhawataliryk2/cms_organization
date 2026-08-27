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

        const { searchParams } = new URL(request.url);
        const organizationIdRaw = searchParams.get('organization_id')?.trim() ?? '';
        const organizationIdNumeric =
            organizationIdRaw && /^\d+$/.test(organizationIdRaw)
                ? organizationIdRaw
                : null;

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        let backendUrl = `${apiUrl}/api/hiring-managers`;

        if (organizationIdNumeric) {
            backendUrl = `${apiUrl}/api/hiring-managers/organization/${organizationIdNumeric}`;
        }

        const queryString = buildListQueryString(searchParams);
        if (queryString) {
            backendUrl = `${backendUrl}?${queryString}`;
        }

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch hiring managers' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching hiring managers:', error);
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

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/hiring-managers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
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
