import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get a specific task
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`Fetching task with ID: ${id}`);

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
        const response = await fetch(`${apiUrl}/api/tasks/${id}`, {
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
                { success: false, message: data.message || 'Failed to fetch task' },
                { status: response.status }
            );
        }

        // For debugging, log the parsed data structure
        console.log("Successfully parsed task data:", JSON.stringify(data).substring(0, 200) + "...");

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching task:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Update a task
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`Updating task with ID: ${id}`);

        const body = await request.json();
        console.log("Update request body:", body);

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const customFields = body.custom_fields ?? body.customFields ?? {};
        const apiData = {
            ...body,
            custom_fields: typeof customFields === 'object' && customFields !== null && !Array.isArray(customFields)
                ? customFields
                : {},
        };
        delete (apiData as Record<string, unknown>).customFields;

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        console.log(`Making PUT request to: ${apiUrl}/api/tasks/${id}`);

        const response = await fetch(`${apiUrl}/api/tasks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiData)
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
            return NextResponse.json(
                {
                    success: false,
                    message: data.message || 'Failed to update task',
                    error: data
                },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error updating task:', error);
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

// Delete a task
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`DELETE request received for task ID: ${id}`);

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
        console.log(`Making DELETE request to backend at: ${apiUrl}/api/tasks/${id}`);

        const response = await fetch(`${apiUrl}/api/tasks/${id}`, {
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
                    message: data.message || 'Failed to delete task',
                    error: data
                },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting task:', error);
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