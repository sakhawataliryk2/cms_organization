import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Proxies to Express: GET /api/custom-fields/field-label?entity_type=&field_name=
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const entityType = searchParams.get('entity_type') ?? searchParams.get('entityType');
        const fieldName = searchParams.get('field_name') ?? searchParams.get('fieldName');

        if (!entityType?.trim() || !fieldName?.trim()) {
            return NextResponse.json(
                { success: false, message: 'entity_type and field_name are required' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const qs = new URLSearchParams({
            entity_type: entityType.trim(),
            field_name: fieldName.trim()
        });

        const response = await fetch(`${apiUrl}/api/custom-fields/field-label?${qs.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            cache: 'no-store'
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: data.message || 'Failed to resolve field label'
                },
                { status: response.status }
            );
        }

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'private, max-age=120'
            }
        });
    } catch (error) {
        console.error('custom-fields/field-label proxy error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
