import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Map Field Management field_name (snake_case) to backend API keys per entity
const FIELD_NAME_TO_BACKEND: Record<string, Record<string, string>> = {
    'job-seekers': {
        first_name: 'firstName',
        last_name: 'lastName',
        email: 'email',
        phone: 'phone',
        mobile_phone: 'mobilePhone',
        address: 'address',
        city: 'city',
        state: 'state',
        zip: 'zip',
        zip_code: 'zip',
        status: 'status',
        current_organization: 'currentOrganization',
        title: 'title',
        resume_text: 'resumeText',
        skills: 'skills',
        desired_salary: 'desiredSalary',
        owner: 'owner',
        date_added: 'dateAdded',
        last_contact_date: 'lastContactDate',
        custom_fields: 'custom_fields',
    },
    'leads': {
        first_name: 'firstName',
        last_name: 'lastName',
        email: 'email',
        phone: 'phone',
        mobile_phone: 'mobilePhone',
        title: 'title',
        status: 'status',
        organization_id: 'organizationId',
        organizationId: 'organizationId',
        address: 'address',
        department: 'department',
        owner: 'owner',
        custom_fields: 'custom_fields',
    },
    'hiring-managers': {
        first_name: 'firstName',
        last_name: 'lastName',
        email: 'email',
        phone: 'phone',
        mobile_phone: 'mobilePhone',
        title: 'title',
        organization_id: 'organizationId',
        organizationId: 'organizationId',
        status: 'status',
        custom_fields: 'custom_fields',
    },
    'jobs': {
        job_title: 'jobTitle',
        title: 'jobTitle',
        organization_id: 'organizationId',
        organizationId: 'organizationId',
        category: 'category',
        status: 'status',
        custom_fields: 'custom_fields',
    },
    'organizations': {
        name: 'name',
        contact_phone: 'contact_phone',
        website: 'website',
        status: 'status',
        address: 'address',
        nicknames: 'nicknames',
        custom_fields: 'custom_fields',
    },
    'placements': {
        job_seeker_id: 'jobSeekerId',
        job_id: 'jobId',
        status: 'status',
        custom_fields: 'custom_fields',
    },
};

// Common keys that may hold org name when Field Management uses custom field_name
const ORGANIZATION_NAME_ALTERNATIVES = [
    'name', 'company_name', 'organization_name', 'org_name', 'company', 'organization',
    'Company Name', 'Organization Name', 'Name', 'field_1', 'Field_1', 'field1', 'Field1',
];

function recordToBackendPayload(
    entityType: string,
    record: Record<string, any>,
    fieldNameToLabel?: Record<string, string>
): Record<string, any> {
    const mapping = FIELD_NAME_TO_BACKEND[entityType];
    if (!mapping) return record;
    const out: Record<string, any> = {};
    const customFields: Record<string, any> = {};

    for (const [key, value] of Object.entries(record)) {
        if (value === undefined || value === '') continue;
        const backendKey = mapping[key];
        if (backendKey !== undefined) {
            // Standard field: put at top level (use backend key, e.g. firstName)
            if (backendKey === 'custom_fields') {
                // Merge existing custom_fields from record into our customFields
                const existing = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
                Object.assign(customFields, existing);
            } else {
                out[backendKey] = value;
            }
        } else {
            // Custom field (not in mapping): store by field_label so DB matches rest of app
            const labelKey = fieldNameToLabel?.[key] ?? key;
            customFields[labelKey] = value;
        }
    }

    if (Object.keys(customFields).length > 0) {
        out.custom_fields = customFields;
    }

    // For organizations: if "name" is missing, try common alternative keys (custom fields may use different names)
    if (entityType === 'organizations') {
        const nameVal = out['name'];
        if (!nameVal || String(nameVal).trim() === '') {
            for (const alt of ORGANIZATION_NAME_ALTERNATIVES) {
                if (alt === 'name') continue;
                const val = record[alt] ?? out[alt];
                if (val != null && String(val).trim() !== '') {
                    out['name'] = String(val).trim();
                    break;
                }
            }
        }
    }
    return out;
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
        const { entityType, records, options, fieldNameToLabel } = body;

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
                // Convert field_name keys to backend-expected keys; custom fields stored by field_label
                const payload = recordToBackendPayload(entityType, record, fieldNameToLabel);

                // Determine unique identifier field (backend key) for find-existing
                let uniqueField = 'email';
                if (entityType === 'organizations') {
                    uniqueField = 'name';
                } else if (entityType === 'jobs') {
                    uniqueField = 'jobTitle';
                } else if (entityType === 'placements') {
                    uniqueField = 'jobSeekerId';
                }
                const uniqueValue = payload[uniqueField] ?? record[uniqueField];

                // Check for duplicates if needed
                const opts = options || {};
                if (opts.skipDuplicates || opts.importNewOnly || opts.updateExisting) {
                    if (uniqueValue) {
                        // Try to find existing record
                        try {
                            const searchResponse = await fetch(
                                `${apiUrl}/api/${endpoint}?${uniqueField}=${encodeURIComponent(String(uniqueValue))}`,
                                {
                                    method: 'GET',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                }
                            );

                            if (searchResponse.ok) {
                                const searchData = await searchResponse.json();
                                const responseListKeys: Record<string, string> = {
                                    'job-seekers': 'jobSeekers',
                                    'hiring-managers': 'hiringManagers',
                                    'organizations': 'organizations',
                                    'jobs': 'jobs',
                                    'leads': 'leads',
                                    'placements': 'placements',
                                };
                                const listKey = responseListKeys[endpoint] || endpoint;
                                let existingRecords: any[] = searchData[listKey] || searchData[endpoint] || searchData.data || [];
                                // Backend may not filter by query; filter client-side by unique field
                                const backendUniqueKey = entityType === 'job-seekers' || entityType === 'leads' || entityType === 'hiring-managers' ? (uniqueField === 'email' ? 'email' : uniqueField) : uniqueField;
                                existingRecords = existingRecords.filter((r: any) => {
                                    const val = r[backendUniqueKey] ?? r[uniqueField];
                                    return val != null && String(val).toLowerCase() === String(uniqueValue).toLowerCase();
                                });

                                if (existingRecords.length > 0) {
                                    const existingRecord = existingRecords[0];

                                    if (opts.skipDuplicates || opts.importNewOnly) {
                                        // Skip this record
                                        summary.failed++;
                                        summary.errors.push({
                                            row: rowNumber,
                                            errors: [`Record already exists (${uniqueField}: ${uniqueValue})`],
                                        });
                                        continue;
                                    }

                                    if (opts.updateExisting) {
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
