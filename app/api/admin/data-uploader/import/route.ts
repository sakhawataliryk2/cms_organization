import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
        const { entityType, records, options } = body;

        if (!entityType || !records || !Array.isArray(records)) {
            return NextResponse.json(
                { success: false, message: 'Invalid request data' },
                { status: 400 }
            );
        }

        // Map entity types to backend endpoints
        const entityEndpointMap: Record<string, string> = {
            'organizations': 'organizations',
            'job-seekers': 'job-seekers',
            'jobs': 'jobs',
            'hiring-managers': 'hiring-managers',
            'placements': 'placements',
            'leads': 'leads',
        };

        const endpoint = entityEndpointMap[entityType];
        if (!endpoint) {
            return NextResponse.json(
                { success: false, message: `Unsupported entity type: ${entityType}` },
                { status: 400 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const summary: {
            totalRows: number;
            successful: number;
            failed: number;
            errors: Array<{ row: number; errors: string[] }>;
        } = {
            totalRows: records.length,
            successful: 0,
            failed: 0,
            errors: [],
        };

        // Process each record
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const rowNumber = i + 1;
            const errors: string[] = [];

            try {
                // Prepare the payload based on entity type
                let payload: Record<string, any> = {
                    ...record,
                };

                // Determine unique identifier field based on entity type
                let uniqueField = 'email';
                if (entityType === 'organizations') {
                    uniqueField = 'name';
                } else if (entityType === 'jobs') {
                    uniqueField = 'title';
                } else if (entityType === 'placements') {
                    uniqueField = 'job_seeker_id'; // Would need job_id too for uniqueness
                }

                // Check for duplicates if needed
                if (options.skipDuplicates || options.importNewOnly || options.updateExisting) {
                    if (record[uniqueField]) {
                        // Try to find existing record
                        try {
                            const searchResponse = await fetch(
                                `${apiUrl}/api/${endpoint}?${uniqueField}=${encodeURIComponent(record[uniqueField])}`,
                                {
                                    method: 'GET',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                }
                            );

                            if (searchResponse.ok) {
                                const searchData = await searchResponse.json();
                                const existingRecords = searchData[endpoint] || searchData.data || [];

                                if (existingRecords.length > 0) {
                                    const existingRecord = existingRecords[0];

                                    if (options.skipDuplicates || options.importNewOnly) {
                                        // Skip this record
                                        summary.failed++;
                                        summary.errors.push({
                                            row: rowNumber,
                                            errors: [`Record already exists (${uniqueField}: ${record[uniqueField]})`],
                                        });
                                        continue;
                                    }

                                    if (options.updateExisting) {
                                        // Update existing record
                                        const updateResponse = await fetch(`${apiUrl}/api/${endpoint}/${existingRecord.id}`, {
                                            method: 'PUT',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`,
                                            },
                                            body: JSON.stringify(payload),
                                        });

                                        const updateData = await updateResponse.json();

                                        if (!updateResponse.ok) {
                                            errors.push(updateData.message || 'Failed to update record');
                                            summary.failed++;
                                            summary.errors.push({ row: rowNumber, errors });
                                        } else {
                                            summary.successful++;
                                        }
                                        continue;
                                    }
                                }
                            }
                        } catch (searchErr) {
                            // If search fails, proceed with create
                            console.warn('Could not check for existing record:', searchErr);
                        }
                    }
                }

                // Create new record
                const response = await fetch(`${apiUrl}/api/${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                });

                const data = await response.json();

                if (!response.ok) {
                    errors.push(data.message || 'Failed to create record');
                    summary.failed++;
                    summary.errors.push({ row: rowNumber, errors });
                } else {
                    summary.successful++;
                }
            } catch (err) {
                errors.push(err instanceof Error ? err.message : 'Unknown error occurred');
                summary.failed++;
                summary.errors.push({ row: rowNumber, errors });
            }
        }

        return NextResponse.json({
            success: true,
            summary,
        });
    } catch (error) {
        console.error('Error processing CSV import:', error);
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
