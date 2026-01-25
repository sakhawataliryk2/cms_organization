import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';

        console.log(`Proxying association request for tearsheet ${id} to ${apiUrl}`);

        const response = await fetch(`${apiUrl}/api/tearsheets/${id}/associate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in tearsheet association proxy:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error in association proxy', error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
