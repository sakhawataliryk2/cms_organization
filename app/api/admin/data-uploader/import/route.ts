import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizeDateInputToIso } from '@/lib/dateNormalize';
import { clearImportCancellation, isImportCancelled } from './state';

// Mirror the exact same label→backend-column mappings used by the individual add pages.
// Every field ALWAYS goes into custom_fields (keyed by field_label).
// Fields whose label appears here ALSO get set at the top-level column for API compatibility.

const ORG_BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
    'Name': 'name', 'Organization Name': 'name', 'Organization': 'name', 'Company': 'name',
    'Nicknames': 'nicknames', 'Nickname': 'nicknames',
    'Parent Organization': 'parent_organization',
    'Website': 'website', 'Organization Website': 'website', 'URL': 'website',
    'Contact Phone': 'contact_phone', 'Main Phone': 'contact_phone',
    'Address': 'address',
    'Status': 'status',
    'Contract Signed on File': 'contract_on_file',
    'Contract Signed By': 'contract_signed_by',
    'Date Contract Signed': 'date_contract_signed',
    'Year Founded': 'year_founded',
    'Overview': 'overview', 'Organization Overview': 'overview', 'About': 'overview',
    'Standard Perm Fee (%)': 'perm_fee',
    '# of Employees': 'num_employees',
    '# of Offices': 'num_offices',
};

const JS_BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
    'First Name': 'firstName', 'First': 'firstName', 'FName': 'firstName',
    'Last Name': 'lastName', 'Last': 'lastName', 'LName': 'lastName',
    'Email': 'email', 'Email 1': 'email', 'Email Address': 'email', 'E-mail': 'email',
    'Phone': 'phone', 'Phone Number': 'phone', 'Telephone': 'phone',
    'Mobile Phone': 'mobilePhone', 'Mobile': 'mobilePhone', 'Cell Phone': 'mobilePhone',
    'Address': 'address', 'Street Address': 'address', 'Address 1': 'address',
    'City': 'city',
    'State': 'state',
    'ZIP Code': 'zip', 'ZIP': 'zip', 'ZipCode': 'zip', 'Postal Code': 'zip',
    'Status': 'status', 'Current Status': 'status',
    'Current Organization': 'currentOrganization', 'Organization': 'currentOrganization',
    'Title': 'title', 'Job Title': 'title', 'Position': 'title',
    'Resume Text': 'resumeText', 'Resume': 'resumeText',
    'Skills': 'skills',
    'Desired Salary': 'desiredSalary', 'Salary': 'desiredSalary',
    'Owner': 'owner', 'Assigned To': 'owner', 'Assigned Owner': 'owner',
    'Date Added': 'dateAdded', 'Date Created': 'dateAdded',
};

const LEAD_BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
    'First Name': 'firstName', 'First': 'firstName',
    'Last Name': 'lastName', 'Last': 'lastName',
    'Email': 'email', 'Email Address': 'email',
    'Phone': 'phone', 'Phone Number': 'phone',
    'Mobile Phone': 'mobilePhone', 'Mobile': 'mobilePhone',
    'Title': 'title', 'Job Title': 'title',
    'Status': 'status',
    'Department': 'department',
    'Owner': 'owner',
};

const HM_BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
    'First Name': 'firstName', 'First': 'firstName',
    'Last Name': 'lastName', 'Last': 'lastName',
    'Email': 'email', 'Email Address': 'email',
    'Phone': 'phone', 'Phone Number': 'phone',
    'Mobile Phone': 'mobilePhone', 'Mobile': 'mobilePhone',
    'Title': 'title', 'Job Title': 'title',
    'Status': 'status',
};

const JOB_BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
    'Job Title': 'jobTitle', 'Title': 'jobTitle', 'Position': 'jobTitle',
    'Category': 'category',
    'Status': 'status',
};

const PLACEMENT_BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
    'Status': 'status',
};

const LABEL_MAP_BY_ENTITY: Record<string, Record<string, string>> = {
    'organizations': ORG_BACKEND_COLUMN_BY_LABEL,
    'job-seekers': JS_BACKEND_COLUMN_BY_LABEL,
    'leads': LEAD_BACKEND_COLUMN_BY_LABEL,
    'hiring-managers': HM_BACKEND_COLUMN_BY_LABEL,
    'jobs': JOB_BACKEND_COLUMN_BY_LABEL,
    'placements': PLACEMENT_BACKEND_COLUMN_BY_LABEL,
};

// Maps lookup_type → { endpoint, listKey } for fetching all records of that type
const LOOKUP_TYPE_CONFIG: Record<string, { endpoint: string; listKey: string }> = {
    'organizations': { endpoint: 'organizations', listKey: 'organizations' },
    'job-seekers': { endpoint: 'job-seekers', listKey: 'jobSeekers' },
    'hiring-managers': { endpoint: 'hiring-managers', listKey: 'hiringManagers' },
    'jobs': { endpoint: 'jobs', listKey: 'jobs' },
    'leads': { endpoint: 'leads', listKey: 'leads' },
    'placements': { endpoint: 'placements', listKey: 'placements' },
};

interface FieldDefinition {
    field_name: string;
    field_label: string;
    field_type: string;
    lookup_type?: string | null;
}

const AUTO_DATE_FIELD_NAME = 'Field_69';

function toYmdDate(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (!str) return null;
    const iso = normalizeDateInputToIso(str);
    if (iso) return iso.slice(0, 10);
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
}

async function resolveFieldLabelByFieldName(
    apiUrl: string,
    token: string,
    entityType: string,
    fieldName: string
): Promise<string | null> {
    try {
        const qs = new URLSearchParams({
            entity_type: entityType,
            field_name: fieldName,
        });
        const res = await fetch(`${apiUrl}/api/custom-fields/field-label?${qs.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = await res.json().catch(() => ({}));
        const label = data?.field_label;
        return typeof label === 'string' && label.trim() ? label.trim() : null;
    } catch {
        return null;
    }
}

/**
 * Fetch all records for a lookup type and build a map of record_number → id.
 * Results are cached per lookup_type for the lifetime of a single import request.
 */
async function buildRecordNumberCache(
    lookupType: string,
    apiUrl: string,
    token: string,
    cache: Map<string, Map<number, string>>
): Promise<Map<number, string>> {
    if (cache.has(lookupType)) return cache.get(lookupType)!;

    const config = LOOKUP_TYPE_CONFIG[lookupType];
    if (!config) return new Map();

    const map = new Map<number, string>();
    try {
        const res = await fetch(`${apiUrl}/api/${config.endpoint}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return map;
        const data = await res.json();
        const list: any[] = data[config.listKey] ?? data.data ?? [];
        for (const item of list) {
            const rn = item.record_number;
            const id = item.id;
            if (rn != null && id != null) {
                map.set(Number(rn), String(id));
            }
        }
    } catch (e) {
        console.warn(`Failed to fetch lookup cache for ${lookupType}:`, e);
    }

    cache.set(lookupType, map);
    return map;
}

/**
 * Extract the first contiguous digit sequence from a string.
 * e.g. "O 5" → 5, "JS-12" → 12, "7" → 7, "abc" → null
 */
function extractRecordNumber(value: string): number | null {
    const match = String(value).match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

/**
 * Build the backend payload exactly the same way the individual add pages do:
 *  1. Every field goes into custom_fields keyed by its field_label.
 *  2. Fields whose label appears in the entity's BACKEND_COLUMN_BY_LABEL map
 *     ALSO get set at the top-level column key.
 */
function buildPayload(
    entityType: string,
    record: Record<string, any>,
    fieldNameToLabel: Record<string, string>,
    fieldDefByName?: Map<string, FieldDefinition>
): Record<string, any> {
    // Performance mode for organizations: keep custom_fields as source of truth
    // and only mirror critical top-level columns.
    const orgCustomFieldPrimaryMode = entityType === 'organizations';
    const labelMap = LABEL_MAP_BY_ENTITY[entityType] ?? {};
    const topLevel: Record<string, any> = {};
    const customFields: Record<string, any> = {};

    for (const [fieldName, value] of Object.entries(record)) {
        if (value === undefined || value === null || value === '') continue;

        let v = value;
        if (typeof v === 'string' && fieldDefByName) {
            const def = fieldDefByName.get(fieldName);
            if (def?.field_type === 'date') {
                const iso = normalizeDateInputToIso(v.trim());
                if (iso) v = iso;
            }
        }

        const label = fieldNameToLabel[fieldName] ?? fieldName;
        customFields[label] = v;

        const backendCol = labelMap[label];
        if (backendCol) {
            // Keep only required/critical top-level fields for organizations.
            // This reduces payload size and DB write overhead for bulk imports.
            if (!orgCustomFieldPrimaryMode || backendCol === 'name') {
                topLevel[backendCol] = v;
            }
        }
    }

    return { ...topLevel, custom_fields: customFields };
}

/** Extract a value from the payload by trying multiple possible keys */
function getVal(payload: Record<string, any>, ...keys: string[]): string {
    for (const k of keys) {
        const v = payload[k] ?? payload.custom_fields?.[k];
        if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
}

/** Organizations per backend bulk-create call (backend max is 500). */
const ORG_BULK_CHUNK_SIZE = 500;
/** Parallel organization chunk uploads to improve throughput. */
const ORG_BULK_CONCURRENCY = 3;
/** Timeout for backend import requests. */
const IMPORT_REQUEST_TIMEOUT_MS = 45_000;
/** Retry attempts for transient bulk failures. */
const IMPORT_BULK_RETRIES = 1;

async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number = IMPORT_REQUEST_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    if (size <= 0) return [arr];
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
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
        const { entityType, records, options, fieldNameToLabel = {}, fieldDefinitions = [], importId } = body;

        if (!entityType || !records || !Array.isArray(records)) {
            return NextResponse.json(
                { success: false, message: 'Invalid request data' },
                { status: 400 }
            );
        }

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

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                const writeLine = (obj: object) => {
                    controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
                };
                let lastProgressAt = 0;
                const writeProgress = (
                    scanned: number,
                    successful: number,
                    failed: number,
                    totalInput: number,
                    force = false
                ) => {
                    const now = Date.now();
                    if (!force && now - lastProgressAt < 160) return;
                    lastProgressAt = now;
                    writeLine({ type: 'progress', scanned, totalInput, successful, failed });
                };
                const throwIfAborted = () => {
                    if (request.signal.aborted || isImportCancelled(importId)) {
                        throw new Error('Import cancelled by user');
                    }
                };
                let lastScannedForBulk = 0;

                try {
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:8080';

        // Build a map of field_name → FieldDefinition for quick lookup
        const fieldDefByName = new Map<string, FieldDefinition>();
        for (const fd of (fieldDefinitions as FieldDefinition[])) {
            if (fd.field_name) fieldDefByName.set(fd.field_name, fd);
        }

        // Per-request cache: lookup_type → Map<record_number, id>
        const lookupCache = new Map<string, Map<number, string>>();

        // Pre-fetch all existing records once for duplicate checking (avoids N queries per row)
        type ExistingRecord = { id: string;[key: string]: any };
        let existingRecordsCache: ExistingRecord[] | null = null;

        const getExistingRecords = async (): Promise<ExistingRecord[]> => {
            if (existingRecordsCache !== null) return existingRecordsCache;
            try {
                const res = await fetch(`${apiUrl}/api/${endpoint}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) { existingRecordsCache = []; return []; }
                const data = await res.json();
                const listKeyMap: Record<string, string> = {
                    'job-seekers': 'jobSeekers',
                    'hiring-managers': 'hiringManagers',
                    'organizations': 'organizations',
                    'jobs': 'jobs',
                    'leads': 'leads',
                    'placements': 'placements',
                };
                const listKey = listKeyMap[endpoint] ?? endpoint;
                existingRecordsCache = data[listKey] ?? data.data ?? [];
            } catch {
                existingRecordsCache = [];
            }
            return existingRecordsCache!;
        };

        const summary = {
            totalRows: records.length,
            successful: 0,
            failed: 0,
            errors: [] as Array<{ row: number; errors: string[] }>,
        };
                    writeProgress(0, 0, 0, records.length, true);

        const opts = options ?? {};
        // Duplicate uniqueness checks are currently disabled below (uniqueChecks stays empty),
        // so forcing per-row duplicate mode only slows imports without changing behavior.
        const duplicateChecksEnabled = false;
        const needsDupCheck =
            duplicateChecksEnabled && !!(opts.skipDuplicates || opts.importNewOnly || opts.updateExisting);
        const useEntityBulkCreate = !needsDupCheck;

        const createBulkChunk = async (chunk: Array<{ row: number; payload: Record<string, any> }>) => {
            try {
                let createRes: Response | null = null;
                let createData: any = {};
                let lastErr: unknown = null;

                for (let attempt = 0; attempt <= IMPORT_BULK_RETRIES; attempt++) {
                    try {
                        createRes = await fetchWithTimeout(`${apiUrl}/api/${endpoint}/bulk-create`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                items: chunk.map((c) => c.payload),
                                maxBatch: ORG_BULK_CHUNK_SIZE,
                            }),
                        });
                        createData = await createRes.json().catch(() => ({}));
                        if (createRes.ok) break;
                    } catch (err) {
                        lastErr = err;
                    }
                }

                if (!createRes || !createRes.ok) {
                    const msg =
                        (lastErr instanceof Error ? lastErr.message : undefined) ??
                        createData?.message ??
                        (typeof createData === 'string' ? createData : 'Bulk create failed');
                    for (const c of chunk) {
                        summary.failed++;
                        summary.errors.push({ row: c.row, errors: [String(msg)] });
                    }
                    writeProgress(lastScannedForBulk, summary.successful, summary.failed, records.length, true);
                    return;
                }

                const s = createData.summary as
                    | {
                          successful?: number;
                          failed?: number;
                          errors?: Array<{ rowIndex: number; errors: string[] }>;
                      }
                    | undefined;

                if (s) {
                    summary.successful += s.successful ?? 0;
                    summary.failed += s.failed ?? 0;
                    for (const e of s.errors ?? []) {
                        const mapped = chunk[e.rowIndex];
                        if (mapped) {
                            summary.errors.push({
                                row: mapped.row,
                                errors: e.errors ?? ['Unknown error'],
                            });
                        }
                    }
                } else {
                    for (const c of chunk) {
                        summary.successful++;
                    }
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Bulk create failed';
                for (const c of chunk) {
                    summary.failed++;
                    summary.errors.push({ row: c.row, errors: [msg] });
                }
            }
            writeProgress(lastScannedForBulk, summary.successful, summary.failed, records.length, true);
        };

        const flushBulkChunksConcurrently = async (
            pending: Array<{ row: number; payload: Record<string, any> }>
        ) => {
            if (pending.length === 0) return;
            const chunks = chunkArray(pending, ORG_BULK_CHUNK_SIZE);
            for (let i = 0; i < chunks.length; i += ORG_BULK_CONCURRENCY) {
                throwIfAborted();
                const batch = chunks.slice(i, i + ORG_BULK_CONCURRENCY);
                await Promise.all(batch.map((chunk) => createBulkChunk(chunk)));
            }
        };

        const orgBulkPending: Array<{ row: number; payload: Record<string, any> }> = [];
        const entityLabelMap = LABEL_MAP_BY_ENTITY[entityType] ?? {};
        const lookupFields = (fieldDefinitions as FieldDefinition[]).filter(
            (fd) => fd.field_name && fd.lookup_type && LOOKUP_TYPE_CONFIG[fd.lookup_type]
        );
        // Resolve Field_69 label from admin center/custom-field service once per import request.
        const adminResolvedAutoDateLabel = await resolveFieldLabelByFieldName(
            apiUrl,
            token,
            entityType,
            AUTO_DATE_FIELD_NAME
        );
        const autoDateFieldLabel =
            adminResolvedAutoDateLabel ??
            (fieldDefinitions as FieldDefinition[]).find((fd) => fd.field_name === AUTO_DATE_FIELD_NAME)?.field_label ??
            fieldNameToLabel[AUTO_DATE_FIELD_NAME] ??
            null;

        for (let i = 0; i < records.length; i++) {
            throwIfAborted();
            const record = records[i];
            const rowNumber = i + 1;
            lastScannedForBulk = i + 1;

            if (!record || Object.values(record).every(v => v === null || v === undefined || String(v).trim() === '')) {
                summary.totalRows--;
            } else {
            try {
                // Build payload the same way individual add pages do
                const payload = buildPayload(entityType, record, fieldNameToLabel, fieldDefByName);

                // ── Lookup type resolution (import-only) ─────────────────────────────
                // For every field that has a lookup_type, extract the record_number from
                // the CSV value, find the matching record's PK id, and replace the value
                // in custom_fields (and top-level if applicable) with that id.
                for (const fieldDef of lookupFields) {
                    throwIfAborted();
                    const fieldName = fieldDef.field_name;
                    const rawValue = record[fieldName];
                    if (!rawValue || String(rawValue).trim() === '') continue;

                    const lookupType = fieldDef.lookup_type!;

                    const recordNum = extractRecordNumber(String(rawValue));
                    if (recordNum === null) continue;

                    const rnMap = await buildRecordNumberCache(lookupType, apiUrl, token, lookupCache);
                    const resolvedId = rnMap.get(recordNum);

                    if (resolvedId) {
                        const label = fieldNameToLabel[fieldName] ?? fieldName;
                        // Replace in custom_fields
                        payload.custom_fields[label] = resolvedId;
                        // Also replace at top level if this label maps to a backend column
                        const backendCol = entityLabelMap[label];
                        if (backendCol && payload[backendCol] !== undefined) {
                            payload[backendCol] = resolvedId;
                        }
                    }
                    // If not found, leave the original value as fallback (already set by buildPayload)
                }

                // Ensure custom_fields is always a plain serialisable object
                payload.custom_fields = { ...(payload.custom_fields ?? {}) };

                // Auto-populate Field_69 label if the column was not present in the file.
                // Value source: incoming created_at timestamp when available, else import-time date.
                if (autoDateFieldLabel) {
                    const currentVal = payload.custom_fields[autoDateFieldLabel];
                    const hasCurrentVal =
                        currentVal != null && String(currentVal).trim() !== '';
                    if (!hasCurrentVal) {
                        const createdAtFromRow =
                            record?.created_at ??
                            record?.createdAt ??
                            record?.['Created At'] ??
                            record?.['created at'] ??
                            record?.['Date Created'];
                        const fallbackDate = new Date().toISOString().slice(0, 10);
                        payload.custom_fields[autoDateFieldLabel] =
                            toYmdDate(createdAtFromRow) ?? fallbackDate;
                    }
                }

                // ── Hiring manager model uses camelCase "customFields" not "custom_fields" ──
                // Rename the key so the model picks it up correctly
                if (entityType === 'hiring-managers' && payload.custom_fields) {
                    payload.customFields = payload.custom_fields;
                    delete payload.custom_fields;
                }

                // ── Entity-specific defaults / fallbacks ──────────────────────────────

                if (entityType === 'organizations') {
                    if (!payload.name || String(payload.name).trim() === '') {
                        const fallback = getVal(payload, 'name', 'organization_name', 'company_name', 'company');
                        payload.name = fallback || 'Unnamed Organization';
                    }
                    if (!payload.status) payload.status = 'Active';
                    if (!payload.contract_on_file) payload.contract_on_file = 'No';
                }

                if (entityType === 'job-seekers') {
                    if (!payload.firstName || !payload.lastName) {
                        const full = getVal(payload, 'full_name', 'name', 'Full Name', 'Name');
                        if (full) {
                            const parts = full.trim().split(/\s+/);
                            if (!payload.firstName) payload.firstName = parts[0] ?? '';
                            if (!payload.lastName) payload.lastName = parts.slice(1).join(' ') || '';
                        }
                    }
                    if (!payload.status) payload.status = 'Active';
                }

                if (entityType === 'jobs') {
                    if (!payload.jobTitle) {
                        const t = getVal(payload, 'jobTitle', 'job_title', 'title', 'Job Title', 'Title');
                        if (t) payload.jobTitle = t;
                    }
                }

                // ── Duplicate detection ───────────────────────────────────────────────

                const uniqueChecks: Array<{ field: string; value: string }> = [];
                // ── Uniqueness checks temporarily disabled ────────────────────────────
                // Website, email, phone and job-title uniqueness checks are commented out
                // so all records proceed to import regardless of duplicates on those fields.
                // if (entityType === 'organizations') {
                //     if (payload.contact_phone) uniqueChecks.push({ field: 'contact_phone', value: payload.contact_phone });
                //     if (payload.website) uniqueChecks.push({ field: 'website', value: payload.website });
                //     if (!uniqueChecks.length && payload.name) uniqueChecks.push({ field: 'name', value: payload.name });
                // } else if (entityType === 'job-seekers') {
                //     if (payload.phone) uniqueChecks.push({ field: 'phone', value: payload.phone });
                //     if (payload.email) uniqueChecks.push({ field: 'email', value: payload.email });
                // } else if (entityType === 'hiring-managers') {
                //     if (payload.email) uniqueChecks.push({ field: 'email', value: payload.email });
                // } else if (entityType === 'leads') {
                //     if (payload.email) uniqueChecks.push({ field: 'email', value: payload.email });
                // } else if (entityType === 'jobs') {
                //     if (payload.jobTitle) uniqueChecks.push({ field: 'jobTitle', value: payload.jobTitle });
                // }
                // ─────────────────────────────────────────────────────────────────────

                let foundDuplicate = false;

                if (needsDupCheck) {
                    const allExisting = await getExistingRecords();

                    for (const check of uniqueChecks) {
                        if (!check.value) continue;

                        const match = allExisting.find((r: any) => {
                            const v = r[check.field];
                            return v != null && String(v).toLowerCase().trim() === check.value.toLowerCase().trim();
                        });

                        if (match) {
                            foundDuplicate = true;

                            if (opts.skipDuplicates || opts.importNewOnly) {
                                summary.failed++;
                                summary.errors.push({
                                    row: rowNumber,
                                    errors: [`Record already exists (${check.field}: ${check.value})`],
                                });
                                break;
                            }

                            if (opts.updateExisting) {
                                const updateRes = await fetch(`${apiUrl}/api/${endpoint}/${match.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                    body: JSON.stringify(payload),
                                });
                                const updateData = await updateRes.json();
                                if (!updateRes.ok) {
                                    summary.failed++;
                                    summary.errors.push({ row: rowNumber, errors: [updateData.message ?? 'Failed to update record'] });
                                } else {
                                    summary.successful++;
                                }
                                break;
                            }
                        }
                    }
                }

                if (!foundDuplicate) {
                // ── Create new record ─────────────────────────────────────────────────
                throwIfAborted();
                if (useEntityBulkCreate) {
                    orgBulkPending.push({ row: rowNumber, payload });
                    if (orgBulkPending.length >= ORG_BULK_CHUNK_SIZE * ORG_BULK_CONCURRENCY) {
                        const batchToFlush = orgBulkPending.splice(0, ORG_BULK_CHUNK_SIZE * ORG_BULK_CONCURRENCY);
                        await flushBulkChunksConcurrently(batchToFlush);
                    }
                } else {
                    const createRes = await fetchWithTimeout(`${apiUrl}/api/${endpoint}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(payload),
                    });
                    const createData = await createRes.json();

                    if (!createRes.ok) {
                        summary.failed++;
                        summary.errors.push({
                            row: rowNumber,
                            errors: [createData.message ?? 'Failed to create record'],
                        });
                    } else {
                        summary.successful++;
                    }
                }
                }
            } catch (err) {
                summary.failed++;
                summary.errors.push({
                    row: rowNumber,
                    errors: [err instanceof Error ? err.message : 'Unknown error'],
                });
            }
            }
            writeProgress(i + 1, summary.successful, summary.failed, records.length);
        }

        if (useEntityBulkCreate) {
            await flushBulkChunksConcurrently(orgBulkPending.splice(0, orgBulkPending.length));
        }

        writeProgress(records.length, summary.successful, summary.failed, records.length, true);
                    writeLine({ type: 'done', success: true, summary });
                } catch (streamErr) {
                    console.error('Import stream error:', streamErr);
                    writeLine({
                        type: 'error',
                        success: false,
                        message: streamErr instanceof Error ? streamErr.message : 'Internal server error',
                    });
                } finally {
                    clearImportCancellation(importId);
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('CSV import route setup error:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
