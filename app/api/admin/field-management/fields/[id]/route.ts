// app/api/admin/field-management/fields/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get custom field by ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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
        const response = await fetch(`${apiUrl}/api/custom-fields/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch custom field' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching custom field:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Update custom field
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        console.log('PUT request received for field ID:', id);
        console.log('Request body:', body);

        // Get the token from cookies
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        console.log('Token found:', !!token);

        if (!token) {
            console.log('No token found, returning 401');
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const backendUrl = `${apiUrl}/api/custom-fields/${id}`;
        
        console.log('Making request to backend:', backendUrl);
        console.log('Request headers:', {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        });

        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        console.log('Backend response status:', response.status);
        console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.json();
        console.log('Backend response data:', data);

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to update custom field' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error updating custom field:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Delete custom field
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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
        const response = await fetch(`${apiUrl}/api/custom-fields/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to delete custom field' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error deleting custom field:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}