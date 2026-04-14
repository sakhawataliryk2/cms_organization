import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function normalizePlacementCustomFields(
    customFields: Record<string, unknown>,
    token: string
) {
    if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) {
        return {};
    }

    try {
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const defsResponse = await fetch(`${apiUrl}/api/custom-fields/entity/placements`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!defsResponse.ok) {
            return customFields;
        }

        const defsData = await defsResponse.json();
        const defs = Array.isArray(defsData?.customFields) ? defsData.customFields : [];
        const labelByName = new Map<string, string>();
        const canonicalLabelByLower = new Map<string, string>();

        defs.forEach((field: { field_name?: string; field_label?: string }) => {
            const fieldName = String(field.field_name || '').trim();
            const fieldLabel = String(field.field_label || '').trim();
            if (!fieldName || !fieldLabel) return;
            labelByName.set(fieldName, fieldLabel);
            canonicalLabelByLower.set(fieldName.toLowerCase(), fieldLabel);
            canonicalLabelByLower.set(fieldLabel.toLowerCase(), fieldLabel);
        });

        const normalized: Record<string, unknown> = {};
        Object.entries(customFields).forEach(([rawKey, value]) => {
            const key = String(rawKey || '').trim();
            if (!key) return;
            const mappedKey =
                labelByName.get(key) ||
                canonicalLabelByLower.get(key.toLowerCase()) ||
                key;
            normalized[mappedKey] = value;
        });

        return normalized;
    } catch (error) {
        console.error('Error normalizing placement custom fields:', error);
        return customFields;
    }
}

// Get all placements
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

        // Forward pagination/sorting/search params to backend when provided
        const incomingParams = request.nextUrl.searchParams;
        const passthroughKeys = ["page", "limit", "offset", "q", "search", "sort", "order"];
        const qs = new URLSearchParams();
        for (const key of passthroughKeys) {
            const value = incomingParams.get(key);
            if (value !== null && value !== "") qs.set(key, value);
        }
        const queryString = qs.toString();

        // Make a request to your backend API
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/placements${queryString ? `?${queryString}` : ""}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to fetch placements' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching placements:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Create a placement
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Get the token from cookies
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Authentication required' },
                { status: 401 }
            );
        }

        // Build payload with explicit custom_fields (like organizations/tasks API)
        const customFields = body.custom_fields ?? body.customFields ?? {};
        const normalizedCustomFields = await normalizePlacementCustomFields(
            typeof customFields === 'object' && customFields !== null && !Array.isArray(customFields)
                ? customFields as Record<string, unknown>
                : {},
            token
        );
        const apiData = {
            ...body,
            custom_fields: normalizedCustomFields,
        };
        delete (apiData as Record<string, unknown>).customFields;

        console.log('Creating placement with data:', apiData);

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/placements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiData)
        });

        // Log the response status
        console.log('Backend response status:', response.status);

        // Get response as text first for debugging
        const responseText = await response.text();
        console.log('Raw response:', responseText);

        // Try to parse the response
        let data;
        try {
            data = JSON.parse(responseText);
            console.log('Parsed response data:', data);
        } catch (jsonError) {
            console.error('Error parsing response JSON:', jsonError);
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid response from server',
                    raw: responseText
                },
                { status: 500 }
            );
        }

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || 'Failed to create placement' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating placement:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
