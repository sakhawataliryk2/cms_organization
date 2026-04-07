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

    // Create a reverse mapping of labels to backend keys for standard fields
    // This handles cases where Field Management uses "Field_N" but the label matches a standard field
    const labelToBackendKey: Record<string, string> = {};
    for (const [fieldName, backendKey] of Object.entries(mapping)) {
        // Map common snake_case names and their probable labels
        labelToBackendKey[fieldName.toLowerCase().replace(/_/g, ' ')] = backendKey;
        labelToBackendKey[fieldName.toLowerCase()] = backendKey;
    }

    for (const [key, value] of Object.entries(record)) {
        if (value === undefined || value === '') continue;
        
        const label = fieldNameToLabel?.[key] || key;
        const normalizedLabel = label.toLowerCase().trim();
        
        // Try mapping by field_name first, then by normalized label
        let backendKey = mapping[key] || labelToBackendKey[normalizedLabel];
        
        // Additional common label mappings if not found
        if (!backendKey) {
            if (normalizedLabel === 'first name') backendKey = mapping['first_name'];
            else if (normalizedLabel === 'last name') backendKey = mapping['last_name'];
            else if (normalizedLabel === 'email' || normalizedLabel === 'email address') backendKey = mapping['email'];
            else if (normalizedLabel === 'phone' || normalizedLabel === 'phone number' || normalizedLabel === 'contact phone') backendKey = mapping['phone'] || mapping['contact_phone'];
            else if (normalizedLabel === 'mobile' || normalizedLabel === 'mobile phone') backendKey = mapping['mobile_phone'];
            else if (normalizedLabel === 'status') backendKey = mapping['status'];
            else if (normalizedLabel === 'address' || normalizedLabel === 'street address') backendKey = mapping['address'];
            else if (normalizedLabel === 'website' || normalizedLabel === 'organization website') backendKey = mapping['website'];
            else if (normalizedLabel === 'company' || normalizedLabel === 'organization' || normalizedLabel === 'company name' || normalizedLabel === 'organization name') backendKey = mapping['name'] || mapping['organization_name'];
        }

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

                // ----- Entity-specific normalization (mirrors organization robustness) -----
                // Jobs: ensure we always have some jobTitle value if possible
                if (entityType === 'jobs') {
                    const rawTitle =
                        payload.jobTitle ??
                        record.job_title ??
                        record.title ??
                        record.JobTitle ??
                        record.Title;
                    if (typeof rawTitle === 'string' && rawTitle.trim() !== '') {
                        payload.jobTitle = rawTitle.trim();
                    }
                }

                // Job seekers: enforce firstName/lastName like organizations enforce "name"
                if (entityType === 'job-seekers') {
                    // Try to derive from full name if mapping didn't give us both
                    const existingFirst = typeof payload.firstName === 'string' ? payload.firstName.trim() : '';
                    const existingLast = typeof payload.lastName === 'string' ? payload.lastName.trim() : '';

                    if (!existingFirst || !existingLast) {
                        const fullNameSource =
                            record.full_name ??
                            record.FullName ??
                            record.name ??
                            record.Name ??
                            '';
                        if (typeof fullNameSource === 'string' && fullNameSource.trim() !== '') {
                            const parts = fullNameSource.trim().split(/\s+/);
                            if (!existingFirst && parts[0]) {
                                payload.firstName = parts[0];
                            }
                            if (!existingLast && parts.length > 1) {
                                payload.lastName = parts.slice(1).join(' ') || existingLast;
                            }
                        }
                    }

                    // If we still don't have both names, fail this row with a clear, per-row error
                    const finalFirst = typeof payload.firstName === 'string' ? payload.firstName.trim() : '';
                    const finalLast = typeof payload.lastName === 'string' ? payload.lastName.trim() : '';
                    if (!finalFirst || !finalLast) {
                        errors.push('First name and last name are required for job seekers');
                        summary.failed++;
                        summary.errors.push({ row: rowNumber, errors });
                        continue;
                    }
                }

                // Normalize custom_fields for all entity types: CSV may send a JSON string
                if (payload.custom_fields && typeof payload.custom_fields === 'string') {
                    try {
                        const parsed = JSON.parse(payload.custom_fields);
                        payload.custom_fields =
                            parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                    } catch {
                        // If the string isn't valid JSON, drop it so backend models don't throw
                        payload.custom_fields = {};
                    }
                }

                // Determine unique identifier field(s) (backend key) for find-existing
                let uniqueChecks: Array<{ field: string; value: any }> = [];
                if (entityType === 'organizations') {
                    // Unique fields for Organizations: Field_6 (Phone) and Field_5 (Website)
                    const phone = record['Field_6'];
                    const website = record['Field_5'];
                    if (phone) uniqueChecks.push({ field: 'contact_phone', value: phone });
                    if (website) uniqueChecks.push({ field: 'website', value: website });
                    // Fallback to name if neither is present
                    if (uniqueChecks.length === 0 && payload['name']) {
                        uniqueChecks.push({ field: 'name', value: payload['name'] });
                    }
                } else if (entityType === 'job-seekers') {
                    // Unique fields for Job Seeker: Field_11 (Phone) and Field_8 (Email)
                    const phone = record['Field_11'];
                    const email = record['Field_8'];
                    if (phone) uniqueChecks.push({ field: 'phone', value: phone });
                    if (email) uniqueChecks.push({ field: 'email', value: email });
                } else if (entityType === 'jobs') {
                    // Unique field for Jobs: Field_3 (Reference Number)
                    const ref = record['Field_3'];
                    if (ref) uniqueChecks.push({ field: 'reference_number', value: ref });
                    else if (payload['jobTitle']) uniqueChecks.push({ field: 'jobTitle', value: payload['jobTitle'] });
                } else if (entityType === 'hiring-managers') {
                    // Unique field for Hiring Manager: Field_7 (Email)
                    const email = record['Field_7'];
                    if (email) uniqueChecks.push({ field: 'email', value: email });
                } else if (entityType === 'placements') {
                    uniqueChecks.push({ field: 'jobSeekerId', value: payload['jobSeekerId'] });
                } else {
                    // Default to email for others
                    if (payload['email']) uniqueChecks.push({ field: 'email', value: payload['email'] });
                }

                // Check for duplicates if needed
                const opts = options || {};
                let foundDuplicate = false;

                if (opts.skipDuplicates || opts.importNewOnly || opts.updateExisting) {
                    for (const check of uniqueChecks) {
                        if (!check.value) continue;

                        try {
                            const searchResponse = await fetch(
                                `${apiUrl}/api/${endpoint}?${check.field}=${encodeURIComponent(String(check.value))}`,
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
                                
                                // Filter client-side by exact match on the unique field
                                existingRecords = existingRecords.filter((r: any) => {
                                    const val = r[check.field] ?? r['Field_' + check.field.split('_').pop()]; // Try both backend name and Field_X if needed
                                    return val != null && String(val).toLowerCase().trim() === String(check.value).toLowerCase().trim();
                                });

                                if (existingRecords.length > 0) {
                                    const existingRecord = existingRecords[0];
                                    foundDuplicate = true;

                                    if (opts.skipDuplicates || opts.importNewOnly) {
                                        // Skip this record
                                        summary.failed++;
                                        summary.errors.push({
                                            row: rowNumber,
                                            errors: [`Record already exists (${check.field}: ${check.value})`],
                                        });
                                        break; // Found duplicate, move to next row
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
                                        break; // Done with this row
                                    }
                                }
                            }
                        } catch (searchErr) {
                            console.warn(`Could not check for existing record by ${check.field}:`, searchErr);
                        }
                    }
                }

                if (foundDuplicate) continue; // Skip creating if duplicate was found and handled


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
