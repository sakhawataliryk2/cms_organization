import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function normalizeRecordNumber(value: string): number | null {
    if (!value || String(value).trim() === '') return null;
    const str = String(value).trim();
    const match = str.match(/\d+/);
    if (!match) return null;
    const num = parseInt(match[0], 10);
    return Number.isFinite(num) && num >= 0 ? num : null;
}

const ENTITY_ENDPOINT_MAP: Record<string, string> = {
    'organizations': 'organizations',
    'job-seekers': 'job-seekers',
    'jobs': 'jobs',
    'hiring-managers': 'hiring-managers',
    'placements': 'placements',
    'leads': 'leads',
};

const ENTITY_LIST_KEY_MAP: Record<string, string> = {
    'organizations': 'organizations',
    'job-seekers': 'jobSeekers',
    'hiring-managers': 'hiringManagers',
    'jobs': 'jobs',
    'leads': 'leads',
    'placements': 'placements',
};

const PAGE_SIZE = 500;

async function fetchAllRecordNumbers(
    apiUrl: string,
    token: string,
    endpoint: string,
    listKey: string
): Promise<Set<number>> {
    const existingRecordNumbers = new Set<number>();
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
        const qs = new URLSearchParams({
            limit: String(PAGE_SIZE),
            offset: String(offset),
        });
        const res = await fetch(`${apiUrl}/api/${endpoint}?${qs}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) break;

        const data = await res.json();
        const existingRecords = data[listKey] ?? data.data ?? [];

        for (const record of existingRecords) {
            const rn = record.record_number;
            if (rn != null) {
                const num = normalizeRecordNumber(String(rn));
                if (num !== null) {
                    existingRecordNumbers.add(num);
                }
            }
        }

        if (typeof data.total === 'number' && data.total >= 0) {
            total = data.total;
        } else if (existingRecords.length < PAGE_SIZE) {
            break;
        }

        offset += existingRecords.length;
        if (existingRecords.length === 0) break;
    }

    return existingRecordNumbers;
}

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
        const { entityType, recordNumbers } = body;

        if (!entityType || !recordNumbers || !Array.isArray(recordNumbers)) {
            return NextResponse.json(
                { success: false, message: 'Invalid request data' },
                { status: 400 }
            );
        }

        const endpoint = ENTITY_ENDPOINT_MAP[entityType];
        if (!endpoint) {
            return NextResponse.json(
                { success: false, message: `Unsupported entity type: ${entityType}` },
                { status: 400 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const listKey = ENTITY_LIST_KEY_MAP[endpoint] ?? endpoint;

        const existingRecordNumbers = await fetchAllRecordNumbers(
            apiUrl,
            token,
            endpoint,
            listKey
        );

        const inputNormalized = recordNumbers
            .map((rn: string) => normalizeRecordNumber(String(rn)))
            .filter((n: number | null) => n !== null && n > 0) as number[];

        const existingInDb: number[] = [];
        for (const num of inputNormalized) {
            if (existingRecordNumbers.has(num)) {
                existingInDb.push(num);
            }
        }

        return NextResponse.json({
            success: true,
            existingRecordNumbers: existingInDb,
            allDbRecordNumbers: Array.from(existingRecordNumbers),
        });
    } catch (error) {
        console.error('Error checking record numbers:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
