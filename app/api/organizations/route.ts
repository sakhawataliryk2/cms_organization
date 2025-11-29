import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';  // Add this import

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
        const response = await fetch(`${apiUrl}/api/organizations`, {
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

// app/api/organizations/route.ts - Update the POST function
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

        // Extract user information from token for created_by field
        let userId = null;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as jwt.JwtPayload;
            userId = decoded.userId;
        } catch (error) {
            console.error('Error decoding token:', error);
        }

        // Log the token and userId for debugging
        console.log('Using token:', token.substring(0, 20) + '...');
        console.log('User ID from token:', userId);

        // Make sure all fields are included in the request to the backend
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
            custom_fields: body.custom_fields || {}, // CRITICAL: Include custom_fields
            created_by: userId
        };

        // Log complete data being sent to backend
        console.log('Data being sent to backend API:', apiData);

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/organizations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiData)
        });

        // Log the response status for debugging
        console.log('Backend response status:', response.status);

        const data = await response.json();

        if (!response.ok) {
            console.error('Backend error response:', data);
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to create organization' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating organization:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}