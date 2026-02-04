import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Await params for Next.js 15 compatibility
        const { id } = await params;

        const token = request.cookies.get('token')?.value;
        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(
            `${apiUrl}/api/tearsheets/${id}/placements`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: 'no-store',
            }
        );

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Backend returned non-JSON response:', text.substring(0, 200));
            return NextResponse.json(
                { 
                    success: false, 
                    message: response.status === 404 
                        ? 'Tearsheets placements API endpoint not found. Please restart the backend server.' 
                        : `Backend error: ${response.status} ${response.statusText}` 
                },
                { status: response.status || 500 }
            );
        }

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching tearsheet placements:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch placements' },
            { status: 500 }
        );
    }
}
