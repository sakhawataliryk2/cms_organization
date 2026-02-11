// app/api/admin/field-management/[entityType]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ entityType: string }> }
) {
    try {
        const { entityType } = await params;

        // Validate entity type
        const validEntityTypes = ['job-seekers', 'hiring-managers', 'organizations', 'jobs', 'jobs-direct-hire', 'jobs-executive-search', 'placements', 'placements-direct-hire', 'placements-executive-search', 'tasks', 'planner', 'leads', 'tearsheets', 'goals-quotas'];
        if (!validEntityTypes.includes(entityType)) {
            return NextResponse.json(
                { success: false, message: 'Invalid entity type' },
                { status: 400 }
            );
        }

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
        // jobs-direct-hire and jobs-executive-search are separate entities that behave like jobs
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/custom-fields/entity/${entityType}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch custom fields' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching custom fields:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Create a new custom field
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ entityType: string }> }
) {
    try {
        const { entityType } = await params;
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

        // Add entity type to the body
        // jobs-direct-hire and jobs-executive-search are separate entities that behave like jobs
        body.entityType = entityType;

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/custom-fields`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to create custom field' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating custom field:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}