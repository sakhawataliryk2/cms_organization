import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await params;

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(
            `${apiUrl}/api/tearsheets/lead/${leadId}`,
            {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            }
        );

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Backend returned non-JSON response:', text.substring(0, 200));
            return NextResponse.json(
                { success: false, message: `Backend error: ${response.status} ${response.statusText}` },
                { status: response.status || 500 }
            );
        }

        const data = await response.json();
        if (!response.ok) return NextResponse.json(data, { status: response.status });
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching tearsheets for lead:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch tearsheets' },
            { status: 500 }
        );
    }
}
