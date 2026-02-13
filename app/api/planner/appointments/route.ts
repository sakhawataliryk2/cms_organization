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
        // Support both new format (participant_type/participant_id) and legacy format (job_seeker_id, etc.)
        const appointmentData: any = {
            date: body.date,
            time: body.time,
            type: body.type,
            duration: body.duration || 30, // Default 30 minutes
            description: body.description || null,
        };

        // New format: participant_type and participant_id
        if (body.participant_type && body.participant_id) {
            appointmentData.participant_type = body.participant_type;
            appointmentData.participant_id = body.participant_id;
        }
        // Legacy format: support for backward compatibility
        else if (body.job_seeker_id) {
            appointmentData.job_seeker_id = body.job_seeker_id;
        } else if (body.jobSeekerId) {
            appointmentData.job_seeker_id = body.jobSeekerId;
        } else if (body.hiring_manager_id) {
            appointmentData.hiring_manager_id = body.hiring_manager_id;
        } else if (body.hiringManagerId) {
            appointmentData.hiring_manager_id = body.hiringManagerId;
        } else if (body.organization_id) {
            appointmentData.organization_id = body.organization_id;
        } else if (body.organizationId) {
            appointmentData.organization_id = body.organizationId;
        }

        // Job ID (optional)
        if (body.job_id) {
            appointmentData.job_id = body.job_id;
        } else if (body.jobId) {
            appointmentData.job_id = body.jobId;
        }

        // Legacy fields for backward compatibility (if provided)
        if (body.client) {
            appointmentData.client = body.client;
        }
        if (body.job && typeof body.job === 'string') {
            appointmentData.job = body.job;
        }
        if (body.location) {
            appointmentData.location = body.location;
        }
        if (body.owner) {
            appointmentData.owner = body.owner;
        }
        if (body.references && Array.isArray(body.references)) {
            appointmentData.references = body.references;
        }
        if (body.attendees && Array.isArray(body.attendees)) {
            appointmentData.attendees = body.attendees;
        }
        if (body.sendInvites !== undefined) {
            appointmentData.send_invites = body.sendInvites;
        }

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
        const status = searchParams.get('status');
        const ownerId = searchParams.get('ownerId');
        const participantType = searchParams.get('participantType');
        const participantId = searchParams.get('participantId');

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        let url = `${apiUrl}/api/planner/appointments`;

        // Build query string
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (status) params.append('status', status);
        if (ownerId) params.append('ownerId', ownerId);
        if (participantType) params.append('participantType', participantType);
        if (participantId) params.append('participantId', participantId);
        
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
