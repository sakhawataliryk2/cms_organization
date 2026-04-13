import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Proxies to Express: GET /api/custom-fields/check-label-unique?entity_type=&field_label=&exclude_id=
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const entityType = searchParams.get('entity_type') ?? searchParams.get('entityType');
        const fieldLabel = searchParams.get('field_label') ?? searchParams.get('fieldLabel');
        const excludeId = searchParams.get('exclude_id') ?? searchParams.get('excludeId');

        if (!entityType?.trim() || fieldLabel === null || fieldLabel === undefined) {
            return NextResponse.json(
                { success: false, message: 'entity_type and field_label are required' },
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
            field_label: fieldLabel
        });
        if (excludeId?.trim()) {
            qs.set('exclude_id', excludeId.trim());
        }

        const response = await fetch(
            `${apiUrl}/api/custom-fields/check-label-unique?${qs.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                cache: 'no-store'
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: data.message || 'Failed to check field label'
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
        console.error('custom-fields/check-label-unique proxy error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
