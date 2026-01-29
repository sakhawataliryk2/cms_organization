// Modify app/api/jobs/[id]/route.ts
// Add better error handling and response formatting

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get a specific job
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`Fetching job with ID: ${id}`);

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
        const response = await fetch(`${apiUrl}/api/jobs/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        // Log response status for debugging
        console.log(`Backend response status: ${response.status} ${response.statusText}`);

        // Get the response text first to debug non-JSON responses
        const responseText = await response.text();

        // Check if response starts with HTML (indicates an error page)
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            console.error("Received HTML instead of JSON:", responseText.substring(0, 100) + "...");
            return NextResponse.json(
                {
                    success: false,
                    message: 'Backend returned HTML instead of JSON. Check server logs.'
                },
                { status: 500 }
            );
        }

        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (error) {
            console.error("Failed to parse response as JSON:", error);
            console.error("Raw response:", responseText.substring(0, 200) + "...");
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid JSON response from backend',
                    rawResponse: responseText.substring(0, 200) + "..."
                },
                { status: 500 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch job' },
                { status: response.status }
            );
        }

        // For debugging, log the parsed data structure
        console.log("Successfully parsed job data:", JSON.stringify(data).substring(0, 200) + "...");

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching job:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Update a job - ENHANCED WITH DEBUGGING AND ERROR HANDLING
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`Updating job with ID: ${id}`);

        // Get the request body
        const body = await request.json();
        console.log("Update request body:", body);

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
        console.log(`Making PUT request to: ${apiUrl}/api/jobs/${id}`);

        const response = await fetch(`${apiUrl}/api/jobs/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        // Log response status
        console.log(`Backend response status: ${response.status} ${response.statusText}`);

        // Get the response as text first for debugging
        const responseText = await response.text();
        console.log("Raw response:", responseText);

        // Parse the response as JSON if possible
        let data;
        try {
            data = JSON.parse(responseText);
            console.log("Parsed response data:", data);
        } catch (jsonError) {
            console.error("Error parsing response JSON:", jsonError);
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid response from server',
                    raw: responseText.substring(0, 200) + "..."
                },
                { status: 500 }
            );
        }

        if (!response.ok) {
            // Forward backend's actual error message when present (e.g. from catch block in dev)
            const message = (data.error && typeof data.error === 'string')
                ? data.error
                : (data.message || 'Failed to update job');
            return NextResponse.json(
                {
                    success: false,
                    message,
                    error: data.error ?? data.message
                },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error updating job:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                success: false,
                message: 'Internal server error',
                error: errorMessage
            },
            { status: 500 }
        );
    }
}

// Delete a job
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`DELETE request received for job ID: ${id}`);

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
        console.log(`Making DELETE request to backend at: ${apiUrl}/api/jobs/${id}`);

        const response = await fetch(`${apiUrl}/api/jobs/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`Backend response status: ${response.status} ${response.statusText}`);

        // Get the response text for more detailed error handling
        const responseText = await response.text();

        // Try to parse as JSON
        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            console.error("Error parsing DELETE response:", e);
            data = { message: responseText || 'Unknown error' };
        }

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: data.message || 'Failed to delete job',
                    error: data
                },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Job deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting job:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                success: false,
                message: 'Internal server error during deletion',
                error: errorMessage
            },
            { status: 500 }
        );
    }
}