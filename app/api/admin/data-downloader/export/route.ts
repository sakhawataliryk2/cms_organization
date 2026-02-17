import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * BACKEND CONTRACT FOR FULL EXPORT (all columns with values)
 * ----------------------------------------------------------
 * If exports only show 4 columns with data, the backend is likely returning minimal data.
 *
 * Option A - List endpoint returns full records:
 *   GET /api/{organizations|jobs|leads|...}?full=1
 *   When query param full=1 (or expand=all) is present, the list response must include
 *   every field per record (including custom_fields, nicknames, address, etc.), not just
 *   id, name, contact_phone, website, status. custom_fields can be object or JSON string.
 *
 * Option B - Get-by-id returns full records (current fallback):
 *   GET /api/{organizations|jobs|...}/{id}
 *   Must return the full record (same shape as Option A). Response can be:
 *   - { organization: { id, name, contact_phone, ..., custom_fields, ... } } or
 *   - { job: { ... } }, { lead: { ... } }, etc., or
 *   - The record at top level: { id, name, ... } if no wrapper.
 *   The export calls this for each list item when the list did not include full data.
 *
 * Both endpoints must accept: Authorization: Bearer <token> (same token as from login).
 */
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
        
        // Support both new format (module + selectedFields) and legacy format (modules array)
        const { module, modules, selectedFields, filters, format, debug: debugRequested, fieldNameToLabel } = body;
        const moduleId = module || (modules && modules.length > 0 ? modules[0] : null);
        const isDebug = debugRequested === true || process.env.NODE_ENV !== 'production';

        if (!moduleId) {
            return NextResponse.json(
                { success: false, message: 'No module selected for export' },
                { status: 400 }
            );
        }

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';
        const exportData: Record<string, any[]> = {};
        const errors: Record<string, string> = {};
        const debugInfo: Record<string, unknown> = isDebug ? { apiUrl, moduleId, selectedFields: selectedFields?.slice?.(0, 20), selectedFieldsCount: selectedFields?.length } : {};

        // Map module IDs to entity types and API endpoints
        const moduleMap: Record<string, { entityType: string; endpoint: string }> = {
            'organizations': { entityType: 'organizations', endpoint: 'organizations' },
            'jobs': { entityType: 'jobs', endpoint: 'jobs' },
            'leads': { entityType: 'leads', endpoint: 'leads' },
            'job-seekers': { entityType: 'job-seekers', endpoint: 'job-seekers' },
            'hiring-managers': { entityType: 'hiring-managers', endpoint: 'hiring-managers' },
            'placements': { entityType: 'placements', endpoint: 'placements' },
            'tasks': { entityType: 'tasks', endpoint: 'tasks' },
        };

        // For full-record fetch by ID: which field(s) hold the id on list items, and which key in GET-by-id response holds the record
        const fullRecordConfig: Record<string, { idFields: string[]; responseKeys: string[] }> = {
            'organizations': { idFields: ['id', 'organization_id'], responseKeys: ['organization'] },
            'jobs': { idFields: ['id', 'job_id'], responseKeys: ['job'] },
            'leads': { idFields: ['id', 'lead_id'], responseKeys: ['lead'] },
            'job-seekers': { idFields: ['id', 'job_seeker_id'], responseKeys: ['jobSeeker', 'job_seeker'] },
            'hiring-managers': { idFields: ['id', 'hiring_manager_id'], responseKeys: ['hiringManager', 'hiring_manager'] },
            'placements': { idFields: ['id', 'placement_id'], responseKeys: ['placement'] },
            'tasks': { idFields: ['id', 'task_id'], responseKeys: ['task'] },
        };

        const moduleConfig = moduleMap[moduleId];
        if (!moduleConfig) {
            return NextResponse.json(
                { success: false, message: `Unknown module: ${moduleId}` },
                { status: 400 }
            );
        }

        try {
            // Build query parameters for filtering
            const queryParams = new URLSearchParams();
            if (filters?.startDate) {
                queryParams.append('startDate', filters.startDate);
            }
            if (filters?.endDate) {
                queryParams.append('endDate', filters.endDate);
            }
            if (filters?.status) {
                queryParams.append('status', filters.status);
            }
            // Ask backend for full records in one call when user selected fields (backends can support full=1)
            if (selectedFields && Array.isArray(selectedFields) && selectedFields.length > 0) {
                queryParams.append('full', '1');
            }

            const queryString = queryParams.toString();
            const listUrl = `${apiUrl}/api/${moduleConfig.endpoint}${queryString ? `?${queryString}` : ''}`;
            if (isDebug) (debugInfo as any).listUrl = listUrl;

            const response = await fetch(listUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to fetch data' }));
                errors[moduleId] = errorData.message || `Failed to fetch ${moduleId}`;
            } else {
                const data = await response.json();
                
                // Extract data array (handle different response structures)
                let moduleData = data[moduleConfig.endpoint] || 
                               data.data || 
                               data[moduleId] ||
                               (Array.isArray(data) ? data : []);

                if (isDebug) {
                    const first = moduleData[0];
                    (debugInfo as any).listResponseOk = true;
                    (debugInfo as any).listCount = moduleData.length;
                    (debugInfo as any).firstItemKeys = first ? Object.keys(first) : [];
                    (debugInfo as any).firstItemKeyCount = first ? Object.keys(first).length : 0;
                    (debugInfo as any).firstItemHasCustomFields = first && 'custom_fields' in first;
                    (debugInfo as any).firstItemCustomFieldsType = first?.custom_fields != null ? typeof first.custom_fields : 'missing';
                }

                // Apply client-side filtering if backend doesn't support it
                if (filters?.startDate || filters?.endDate) {
                    moduleData = moduleData.filter((item: any) => {
                        const itemDate = item.created_at || item.updated_at || item.date_added;
                        if (!itemDate) return true;
                        
                        const itemDateObj = new Date(itemDate);
                        const startDate = filters.startDate ? new Date(filters.startDate) : null;
                        const endDate = filters.endDate ? new Date(filters.endDate) : null;
                        
                        if (startDate && itemDateObj < startDate) return false;
                        if (endDate && itemDateObj > endDate) return false;
                        return true;
                    });
                }

                if (filters?.status) {
                    moduleData = moduleData.filter((item: any) => {
                        const itemStatus = item.status || item.Status || '';
                        return String(itemStatus).toLowerCase() === filters.status.toLowerCase();
                    });
                }

                // For all modules, list endpoint often returns only a subset of fields. When user
                // selected specific fields for export, fetch full records by ID so custom_fields
                // and all columns are included. Skip per-ID fetch if list already looks full
                // (e.g. backend supports ?full=1 and returned full records).
                const fullCfg = fullRecordConfig[moduleId];
                const wantsFullRecords = fullCfg &&
                    selectedFields &&
                    Array.isArray(selectedFields) &&
                    selectedFields.length > 0 &&
                    moduleData.length > 0;
                const firstItem = moduleData[0];
                const listLooksFull = firstItem && typeof firstItem === 'object' &&
                    (Object.keys(firstItem).length > 8 || 'custom_fields' in firstItem);
                // Always fetch by ID for organizations when exporting selected fields so we get full record + custom_fields from getById
                const forcePerIdForOrganizations = moduleId === 'organizations' && wantsFullRecords;
                const needsFullRecords = wantsFullRecords && (forcePerIdForOrganizations || !listLooksFull);

                if (isDebug) {
                    (debugInfo as any).listLooksFull = listLooksFull;
                    (debugInfo as any).wantsFullRecords = wantsFullRecords;
                    (debugInfo as any).forcePerIdForOrganizations = forcePerIdForOrganizations;
                    (debugInfo as any).didPerIdFetch = needsFullRecords;
                }

                if (needsFullRecords) {
                    const CONCURRENCY = 10;
                    const idFields = fullCfg.idFields;
                    const responseKeys = fullCfg.responseKeys;
                    const fullRecords: any[] = [];
                    let firstGetByIdUrl: string | null = null;
                    let firstGetByIdOk: boolean | null = null;
                    for (let i = 0; i < moduleData.length; i += CONCURRENCY) {
                        const batch = moduleData.slice(i, i + CONCURRENCY);
                        const results = await Promise.all(
                            batch.map(async (item: any) => {
                                const id = idFields.map((f: string) => item[f]).find((v: any) => v != null);
                                if (id == null) return item;
                                const getByIdUrl = `${apiUrl}/api/${moduleConfig.endpoint}/${id}`;
                                if (isDebug && firstGetByIdUrl == null) firstGetByIdUrl = getByIdUrl;
                                try {
                                    const res = await fetch(getByIdUrl, {
                                        method: 'GET',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${token}`,
                                        },
                                    });
                                    if (isDebug && firstGetByIdOk == null) firstGetByIdOk = res.ok;
                                    if (!res.ok) return item;
                                    const full = await res.json();
                                    const record = responseKeys.map((k: string) => full[k]).find((v: any) => v != null);
                                    const singleRecord = record ?? (full && typeof full === 'object' && 'id' in full ? full : null);
                                    return singleRecord ?? full ?? item;
                                } catch (e) {
                                    if (isDebug && firstGetByIdOk == null) firstGetByIdOk = false;
                                    return item;
                                }
                            })
                        );
                        fullRecords.push(...results);
                    }
                    moduleData = fullRecords;
                    if (isDebug) {
                        (debugInfo as any).firstGetByIdUrl = firstGetByIdUrl;
                        (debugInfo as any).firstGetByIdOk = firstGetByIdOk;
                        if (fullRecords[0]) {
                            (debugInfo as any).afterFetchFirstRecordKeys = Object.keys(fullRecords[0]);
                            (debugInfo as any).afterFetchFirstRecordKeyCount = Object.keys(fullRecords[0]).length;
                        }
                    }
                }

                // Helper: get nested value, parsing custom_fields when it's a JSON string.
                // Single-segment paths (e.g. "Industry") are also checked under custom_fields for custom field keys.
                const getNestedValue = (obj: any, path: string): any => {
                    const parts = path.split('.');
                    let current: any = obj;
                    for (let i = 0; i < parts.length; i++) {
                        if (current == null) return undefined;
                        const part = parts[i];
                        let next = current[part];
                        if (part === 'custom_fields' && typeof next === 'string') {
                            try {
                                next = JSON.parse(next) as Record<string, unknown>;
                            } catch {
                                next = undefined;
                            }
                        }
                        current = next;
                    }
                    // Custom fields: stored by field_label (e.g. "Industry") but selectedFields use field_name (e.g. "Field_1").
                    // Try custom_fields[path] then custom_fields[fieldNameToLabel[path]] when the frontend sends the map.
                    if (current === undefined && parts.length === 1 && obj && typeof obj === 'object') {
                        const cf = obj.custom_fields;
                        if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
                            const cfRecord = cf as Record<string, unknown>;
                            current = cfRecord[path];
                            if (current === undefined && fieldNameToLabel && typeof fieldNameToLabel === 'object' && fieldNameToLabel[path]) {
                                current = cfRecord[fieldNameToLabel[path]];
                            }
                        }
                    }
                    return current;
                };

                // Format value for CSV: arrays/objects to string
                const formatForExport = (value: any): string | number => {
                    if (value === undefined || value === null) return '';
                    if (Array.isArray(value)) return value.map(String).join('; ');
                    if (typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value);
                    if (value instanceof Date) return value.toISOString();
                    return value;
                };

                // Filter fields if selectedFields is provided
                if (selectedFields && Array.isArray(selectedFields) && selectedFields.length > 0) {
                    moduleData = moduleData.map((item: any) => {
                        const filteredItem: any = {};
                        selectedFields.forEach((field: string) => {
                            const value = getNestedValue(item, field);
                            filteredItem[field] = formatForExport(value);
                        });
                        return filteredItem;
                    });
                    if (isDebug && moduleData[0]) {
                        const sample = moduleData[0] as Record<string, unknown>;
                        const withValues = Object.entries(sample).filter(([, v]) => v !== '' && v != null);
                        (debugInfo as any).firstFilteredRowKeys = Object.keys(sample);
                        (debugInfo as any).firstFilteredRowKeysWithValues = withValues.map(([k]) => k);
                        (debugInfo as any).firstFilteredRowSample = Object.fromEntries(withValues.slice(0, 10));
                    }
                }

                exportData[moduleId] = moduleData;
            }
        } catch (err) {
            errors[moduleId] = err instanceof Error ? err.message : 'Unknown error';
        }

        // Return data as array for single module (backward compatible format)
        const payload: Record<string, unknown> = {
            success: true,
            data: Object.keys(errors).length === 0 ? exportData[moduleId] || [] : {},
            errors: Object.keys(errors).length > 0 ? errors : undefined,
        };
        if (isDebug && Object.keys(debugInfo).length > 0) payload.debug = debugInfo;
        return NextResponse.json(payload);
    } catch (error) {
        console.error('Error exporting data:', error);
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
