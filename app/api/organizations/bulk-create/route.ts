import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BULK_CREATE_TIMEOUT_MS = 45_000;

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
        const { items, maxBatch } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { success: false, message: 'items must be a non-empty array' },
                { status: 400 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), BULK_CREATE_TIMEOUT_MS);
        let response: Response;
        try {
            response = await fetch(`${apiUrl}/api/organizations/bulk-create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ items, maxBatch }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: data.message || 'Failed to bulk create organizations',
                },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error bulk creating organizations:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
