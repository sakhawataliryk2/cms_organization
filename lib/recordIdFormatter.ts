// Utility functions for formatting record IDs with prefixes

export const RECORD_PREFIXES = {
    organization: 'O',
    job: 'J',
    jobSeeker: 'JS',
    lead: 'L',
    hiringManager: 'HM',
    task: 'T',
    placement: 'P'
} as const;

export type RecordType = keyof typeof RECORD_PREFIXES;

/**
 * Format a record ID with its type prefix (uses primary key id).
 * @param id - The numeric ID
 * @param type - The record type
 * @returns Formatted ID string (e.g., "J8" for job ID 8)
 */
export function formatRecordId(id: number | string | null | undefined, type: RecordType): string {
    if (!id && id !== 0) return '';
    const prefix = RECORD_PREFIXES[type];
    return `${prefix} ${id}`;
}

/** Types that use business record_number for display (prefix + '-' + number) */
const DISPLAY_RECORD_NUMBER_TYPES: RecordType[] = ['task', 'job', 'organization'];

/**
 * Display format for task/job/organization: prefix + '-' + record_number (e.g. T-15, J-4, O-22).
 * Use when the API returns record_number. For other types, falls back to formatRecordId(id, type).
 */
export function formatDisplayRecordNumber(
    type: RecordType,
    recordNumber: number | string | null | undefined,
    fallbackId?: number | string | null
): string {
    if (DISPLAY_RECORD_NUMBER_TYPES.includes(type) && recordNumber !== null && recordNumber !== undefined && recordNumber !== '') {
        const prefix = RECORD_PREFIXES[type];
        return `${prefix}-${recordNumber}`;
    }
    if (fallbackId !== null && fallbackId !== undefined && fallbackId !== '') return formatRecordId(fallbackId, type);
    return '';
}

/**
 * Parse a prefixed ID to extract the numeric ID and type
 * @param prefixedId - The prefixed ID (e.g., "J8", "JS123")
 * @returns Object with numeric ID and type, or null if invalid
 */
export function parseRecordId(prefixedId: string): { id: number; type: RecordType } | null {
    if (!prefixedId || typeof prefixedId !== 'string') return null;
    
    const trimmed = prefixedId.trim().toUpperCase();
    
    // Try to match each prefix
    for (const [type, prefix] of Object.entries(RECORD_PREFIXES)) {
        if (trimmed.startsWith(prefix)) {
            const numericPart = trimmed.substring(prefix.length);
            const id = parseInt(numericPart, 10);
            if (!isNaN(id)) {
                return { id, type: type as RecordType };
            }
        }
    }
    
    // If no prefix matches, try to parse as plain number
    const plainId = parseInt(trimmed, 10);
    if (!isNaN(plainId)) {
        return { id: plainId, type: 'job' }; // Default to job for backward compatibility
    }
    
    return null;
}

/**
 * Check if a search query matches a record ID (with or without prefix)
 * @param query - The search query
 * @param id - The numeric ID to check
 * @param type - The record type
 * @returns true if the query matches the ID
 */
export function matchesRecordId(query: string, id: number | string | null | undefined, type: RecordType): boolean {
    if (!id && id !== 0) return false;
    
    const queryLower = query.toLowerCase().trim();
    const idStr = String(id);
    const prefixedId = formatRecordId(id, type).toLowerCase();
    
    // Match plain ID
    if (idStr.includes(queryLower)) return true;
    
    // Match prefixed ID
    if (prefixedId.includes(queryLower)) return true;
    
    // Match if query is just the prefix (e.g., "J" matches all jobs)
    const prefix = RECORD_PREFIXES[type].toLowerCase();
    if (queryLower === prefix) return true;
    
    return false;
}

