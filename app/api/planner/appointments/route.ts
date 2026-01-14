import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Test route to verify it's accessible
export async function OPTIONS(request: NextRequest) {
    return NextResponse.json({ success: true, message: 'Route is accessible' });
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validate required fields
        if (!body.date || !body.time || !body.type) {
            return NextResponse.json(
                { success: false, message: 'Date, time, and type are required' },
                { status: 400 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        
        // Prepare appointment data for backend
        const appointmentData = {
            date: body.date,
            time: body.time,
            type: body.type,
            client: body.client || '',
            job: body.job || '',
            job_seeker_id: body.jobSeekerId || null,
            hiring_manager_id: body.hiringManagerId || null,
            organization_id: body.organizationId || null,
            references: body.references || [],
            owner: body.owner || '',
            description: body.description || '',
            location: body.location || '',
            duration: body.duration || 30, // Default 30 minutes
            attendees: body.attendees || [], // Array of user IDs/emails
            send_invites: body.sendInvites !== false, // Default to true
        };

        console.log('Creating appointment with data:', appointmentData);

        // Create appointment in backend
        const response = await fetch(`${apiUrl}/api/planner/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(appointmentData),
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            console.error('Error parsing response JSON:', jsonError);
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid response from server',
                    raw: responseText,
                },
                { status: 500 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to create appointment' },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Appointment created successfully',
            appointment: data.appointment || data,
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { success: false, message: errorMessage },
            { status: 500 }
        );
    }
}

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
        const date = searchParams.get('date');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        let url = `${apiUrl}/api/planner/appointments`;

        // Build query string
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            console.error('Error parsing response JSON:', jsonError);
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid response from server',
                    raw: responseText,
                },
                { status: 500 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch appointments' },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            appointments: data.appointments || data.data || [],
        });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
