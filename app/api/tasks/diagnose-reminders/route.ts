import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Diagnostic endpoint to check why tasks aren't matching reminder criteria
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

        // Get optional dueDate query parameter
        const { searchParams } = new URL(request.url);
        const dueDate = searchParams.get('dueDate');

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const url = `${apiUrl}/api/tasks/diagnose-reminders${dueDate ? `?dueDate=${dueDate}` : ''}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to diagnose reminders' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error diagnosing reminders:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
