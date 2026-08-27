import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { buildListQueryString } from '@/lib/apiListParams';

const CREATE_ORGANIZATION_TIMEOUT_MS = 20000;

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
        const response = await fetch(`${apiUrl}/api/organizations${queryString ? `?${queryString}` : ""}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch organizations' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching organizations:', error);
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

        let userId = null;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as jwt.JwtPayload;
            userId = decoded.userId;
        } catch (error) {
            console.error('Error decoding token:', error);
        }

        const apiData = {
            name: body.name,
            nicknames: body.nicknames || null,
            parent_organization: body.parent_organization || null,
            website: body.website || null,
            status: body.status || 'Active',
            contract_on_file: body.contract_on_file || 'No',
            contract_signed_by: body.contract_signed_by || null,
            date_contract_signed: body.date_contract_signed || null,
            year_founded: body.year_founded || null,
            overview: body.overview || null,
            perm_fee: body.perm_fee || null,
            num_employees: body.num_employees || null,
            num_offices: body.num_offices || null,
            contact_phone: body.contact_phone || null,
            address: body.address || null,
            custom_fields: body.custom_fields || {},
            created_by: userId
        };

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CREATE_ORGANIZATION_TIMEOUT_MS);
        let response: Response;
        try {
            response = await fetch(`${apiUrl}/api/organizations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(apiData),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to create organization' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating organization:', error);
        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json(
                { success: false, message: 'Create organization request timed out. Please try again.' },
                { status: 504 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
