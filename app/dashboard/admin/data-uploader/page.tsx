'use client'

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'nextjs-toploader/app';
import { FiX, FiDownload, FiEye, FiTrash2 } from 'react-icons/fi';

interface CustomFieldDefinition {
    id: string;
    field_name: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    is_hidden: boolean;
    options?: string[] | string | Record<string, unknown> | null;
    placeholder?: string | null;
    default_value?: string | null;
    sort_order: number;
    lookup_type?: string;
}

interface CSVRow {
    [key: string]: string;
}

interface ValidationError {
    row: number;
    field: string;
    message: string;
}

interface ImportSummary {
    totalRows: number;
    successful: number;
    failed: number;
    errors: Array<{
        row: number;
        errors: string[];
    }>;
}

interface ImportHistoryListItem {
    id: number;
    entity_type: string;
    category_label: string;
    file_name: string;
    total_rows: number;
    succeeded: number;
    failed: number;
    duration_ms: number;
    imported_by_user_id: number | null;
    imported_by_name: string | null;
    imported_at: string;
}

interface ImportHistoryDetail extends ImportHistoryListItem {
    first_row_number: number | null;
    last_row_number: number | null;
    first_row_data: Record<string, string> | null;
    last_row_data: Record<string, string> | null;
}

function formatDurationMs(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

type ImportLiveProgress = {
    scanned: number;
    totalInput: number;
    successful: number;
    failed: number;
};

async function consumeImportNdjsonStream(
    response: Response,
    totalInputRows: number,
    onProgress: (p: ImportLiveProgress) => void
): Promise<ImportSummary> {
    if (!response.body) {
        throw new Error('No response body from import');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let summary: ImportSummary | null = null;
    let lastUiMs = 0;
    const maybeProgress = (p: ImportLiveProgress) => {
        const t = Date.now();
        if (t - lastUiMs < 100) return;
        lastUiMs = t;
        onProgress(p);
    };
    const forceProgress = (p: ImportLiveProgress) => {
        lastUiMs = Date.now();
        onProgress(p);
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line) as {
                type: string;
                scanned?: number;
                totalInput?: number;
                successful?: number;
                failed?: number;
                summary?: ImportSummary;
                message?: string;
            };
            if (msg.type === 'progress') {
                maybeProgress({
                    scanned: msg.scanned ?? 0,
                    totalInput: msg.totalInput ?? totalInputRows,
                    successful: msg.successful ?? 0,
                    failed: msg.failed ?? 0,
                });
            } else if (msg.type === 'done' && msg.summary) {
                summary = msg.summary;
                forceProgress({
                    scanned: totalInputRows,
                    totalInput: totalInputRows,
                    successful: msg.summary.successful,
                    failed: msg.summary.failed,
                });
            } else if (msg.type === 'error') {
                throw new Error(msg.message || 'Import failed');
            }
        }
    }

    const tail = buffer.trim();
    if (tail) {
        const msg = JSON.parse(tail) as { type: string; summary?: ImportSummary; message?: string };
        if (msg.type === 'done' && msg.summary) {
            summary = msg.summary;
            forceProgress({
                scanned: totalInputRows,
                totalInput: totalInputRows,
                successful: msg.summary.successful,
                failed: msg.summary.failed,
            });
        } else if (msg.type === 'error') {
            throw new Error(msg.message || 'Import failed');
        }
    }

    if (!summary) {
        throw new Error('Import did not complete');
    }
    return summary;
}

const RECORD_TYPE_TO_ENTITY_TYPE: Record<string, string> = {
    'Contact': 'organizations',
    'Organization': 'organizations',
    'Job Seeker': 'job-seekers',
    'Job': 'jobs',
    'Hiring Manager': 'hiring-managers',
    'Placement': 'placements',
    'Lead': 'leads'
};
const MAX_IMPORT_ROWS_PER_FILE = 1000;

export default function DataUploader() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [maxVisitedStep, setMaxVisitedStep] = useState(1);
    const [recordType, setRecordType] = useState('Job Seeker');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
    const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
    const [availableFields, setAvailableFields] = useState<CustomFieldDefinition[]>([]);
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [importOptions, setImportOptions] = useState({
        skipDuplicates: false,
        updateExisting: false,
        importNewOnly: false,
    });
    const [isImporting, setIsImporting] = useState(false);
    const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
    const [mainTab, setMainTab] = useState<'upload' | 'history'>('upload');
    const [historyItems, setHistoryItems] = useState<ImportHistoryListItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [viewHistoryDetail, setViewHistoryDetail] = useState<ImportHistoryDetail | null>(null);
    const [viewHistoryLoading, setViewHistoryLoading] = useState(false);
    const [importElapsedMs, setImportElapsedMs] = useState(0);
    const [lastImportDurationMs, setLastImportDurationMs] = useState<number | null>(null);
    const [lastImportCompletedAt, setLastImportCompletedAt] = useState<Date | null>(null);
    const [importLiveProgress, setImportLiveProgress] = useState<ImportLiveProgress | null>(null);
    const [lastStreamProgressAt, setLastStreamProgressAt] = useState<number | null>(null);
    const [isLiveStreamPaused, setIsLiveStreamPaused] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const importAbortControllerRef = useRef<AbortController | null>(null);
    const currentImportIdRef = useRef<string | null>(null);
    const currentHistoryIdRef = useRef<number | null>(null);

    const recordTypes = [
        'Organization',
        'Job Seeker',
        'Job',
        'Hiring Manager',
        'Placement',
        'Lead'
    ];

    const totalSteps = 6;

    // Fetch available fields when record type changes
    useEffect(() => {
        if (recordType && currentStep >= 3) {
            fetchAvailableFields();
        }
    }, [recordType, currentStep]);

    // Handle pending file from sidebar
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const pendingFileStr = sessionStorage.getItem('adminParseDataPendingFile');
        if (pendingFileStr) {
            try {
                const pendingData = JSON.parse(pendingFileStr);
                if (pendingData && pendingData.base64 && pendingData.name) {
                    // Convert base64 to File
                    const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
                        const arr = base64.split(',');
                        const mimeMatch = arr[0].match(/:(.*?);/);
                        const mime = mimeMatch ? mimeMatch[1] : mimeType;
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) {
                            u8arr[n] = bstr.charCodeAt(n);
                        }
                        return new File([u8arr], filename, { type: mime });
                    };

                    const file = base64ToFile(pendingData.base64, pendingData.name, pendingData.type || 'text/csv');
                    setSelectedFile(file);
                    setRecordType('Job Seeker'); // Default for admin sidebar upload
                    handleFileSelectForData(file);

                    // Cleanup
                    sessionStorage.removeItem('adminParseDataPendingFile');
                    toast.success(`File "${file.name}" loaded for upload.`);
                }
            } catch (err) {
                console.error('Error loading pending file:', err);
            }
        }
    }, []);

    useEffect(() => {
        return () => {
            if (importTimerRef.current) {
                clearInterval(importTimerRef.current);
                importTimerRef.current = null;
            }
            if (importAbortControllerRef.current) {
                importAbortControllerRef.current.abort();
                importAbortControllerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!isImporting) return;
        const timer = window.setInterval(() => {
            if (!lastStreamProgressAt) return;
            const stalledMs = Date.now() - lastStreamProgressAt;
            setIsLiveStreamPaused(stalledMs > 15000);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [isImporting, lastStreamProgressAt]);

    useEffect(() => {
        if (!isImporting) return;

        const warningMessage = 'Import is currently running in this tab. Leaving this page will stop live updates and may interrupt parsing. Do you want to stop import and leave?';
        const originalPushState = window.history.pushState.bind(window.history);
        const originalReplaceState = window.history.replaceState.bind(window.history);

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (currentImportIdRef.current) {
                const blob = new Blob(
                    [JSON.stringify({ importId: currentImportIdRef.current })],
                    { type: 'application/json' }
                );
                navigator.sendBeacon('/api/admin/data-uploader/import/cancel', blob);
            }
            event.preventDefault();
            event.returnValue = warningMessage;
        };

        const confirmAndMaybeAbort = () => {
            const userConfirmed = window.confirm(warningMessage);
            if (!userConfirmed) return false;
            if (currentImportIdRef.current) {
                fetch('/api/admin/data-uploader/import/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ importId: currentImportIdRef.current }),
                    keepalive: true,
                }).catch(() => undefined);
            }
            importAbortControllerRef.current?.abort();
            return true;
        };

        const onDocumentClickCapture = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            const anchor = target.closest('a') as HTMLAnchorElement | null;
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#')) return;

            if (!confirmAndMaybeAbort()) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        window.history.pushState = function patchedPushState(
            data: any,
            unused: string,
            url?: string | URL | null
        ) {
            if (!confirmAndMaybeAbort()) return;
            return originalPushState(data, unused, url as any);
        };

        window.history.replaceState = function patchedReplaceState(
            data: any,
            unused: string,
            url?: string | URL | null
        ) {
            if (!confirmAndMaybeAbort()) return;
            return originalReplaceState(data, unused, url as any);
        };

        const onPopState = () => {
            if (!confirmAndMaybeAbort()) {
                originalPushState(null, '', window.location.href);
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('click', onDocumentClickCapture, true);
        window.addEventListener('popstate', onPopState);

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('click', onDocumentClickCapture, true);
            window.removeEventListener('popstate', onPopState);
            window.history.pushState = originalPushState;
            window.history.replaceState = originalReplaceState;
        };
    }, [isImporting]);

    const confirmStopImport = (): boolean => {
        if (!isImporting) return true;
        const shouldStop = window.confirm(
            'Import is still running. Stop import in this tab and continue?'
        );
        if (!shouldStop) return false;
        if (currentImportIdRef.current) {
            fetch('/api/admin/data-uploader/import/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ importId: currentImportIdRef.current }),
                keepalive: true,
            }).catch(() => undefined);
        }
        importAbortControllerRef.current?.abort();
        return true;
    };

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/admin/data-upload-import-history?limit=200', {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Failed to load import history');
            }
            setHistoryItems(Array.isArray(data.items) ? data.items : []);
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : 'Failed to load import history');
            setHistoryItems([]);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (mainTab === 'history') {
            void loadHistory();
        }
    }, [mainTab, loadHistory]);

    const buildMappedImportRecord = (row: CSVRow): Record<string, string> => {
        const record: Record<string, string> = {};
        Object.keys(fieldMappings).forEach((fieldName) => {
            const csvColumn = fieldMappings[fieldName];
            record[fieldName] = row[csvColumn]?.trim() || '';
        });
        return record;
    };

    const createImportHistoryEntry = async (params: {
        entityType: string;
        totalRows: number;
    }) => {
        const fileName = selectedFile?.name?.trim() || 'unknown.csv';
        const res = await fetch('/api/admin/data-upload-import-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entity_type: params.entityType,
                category_label: recordType,
                file_name: fileName,
                total_rows: params.totalRows,
                succeeded: 0,
                failed: 0,
                duration_ms: 0,
                first_row_number: null,
                last_row_number: null,
                first_row_data: {},
                last_row_data: {},
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || 'Failed to create import history entry');
        }
        return Number(data?.item?.id || 0) || null;
    };

    const updateImportHistoryEntry = async (historyId: number, params: {
        entityType: string;
        summary: ImportSummary;
        durationMs: number;
        firstRowNumber: number;
        lastRowNumber: number;
        firstRowData: Record<string, string>;
        lastRowData: Record<string, string>;
    }) => {
        const toLabeledRow = (data: Record<string, string>) => {
            const out: Record<string, string> = {};
            Object.entries(data).forEach(([name, val]) => {
                const f = availableFields.find((x) => x.field_name === name);
                const key = f?.field_label || name;
                out[key] = val;
            });
            return out;
        };
        const res = await fetch(`/api/admin/data-upload-import-history/${historyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entity_type: params.entityType,
                total_rows: params.summary.totalRows,
                succeeded: params.summary.successful,
                failed: params.summary.failed,
                duration_ms: params.durationMs,
                first_row_number: params.firstRowNumber,
                last_row_number: params.lastRowNumber,
                first_row_data: toLabeledRow(params.firstRowData),
                last_row_data: toLabeledRow(params.lastRowData),
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || 'Failed to save import history');
        }
    };

    const handleFileSelectForData = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (text) {
                const { headers, rows } = parseCSV(text);
                if (headers.length > 0) {
                    if (rows.length > MAX_IMPORT_ROWS_PER_FILE) {
                        toast.error(
                            `File has ${rows.length} rows. Maximum ${MAX_IMPORT_ROWS_PER_FILE} rows per file are allowed to avoid database timeout.`
                        );
                        setCsvHeaders([]);
                        setCsvRows([]);
                        return;
                    }
                    setCsvHeaders(headers);
                    setCsvRows(rows);
                    setCurrentStep(2);
                }
            }
        };
        reader.readAsText(file);
    };

    const normalizeFieldText = (value: string): string =>
        (value || '').toLowerCase().trim().replace(/\s*\*+\s*$/, '').trim();

    const runAutoMapping = (
        headers: string[],
        fields: CustomFieldDefinition[]
    ): Record<string, string> => {
        if (fields.length === 0 || headers.length === 0) return {};

        const usedHeaders = new Set<string>();
        const autoMappings: Record<string, string> = {};

        const getFieldVariants = (field: CustomFieldDefinition): string[] => {
            const label = field.field_label || '';
            const name = field.field_name || '';
            const normalizedLabel = normalizeFieldText(label);
            const normalizedName = normalizeFieldText(name.replace(/_/g, ' '));
            const nameUnderscore = name.toLowerCase().replace(/\s+/g, '_');
            const labelNoSpaces = normalizedLabel.replace(/\s+/g, '');
            const labelUnderscore = normalizedLabel.replace(/\s+/g, '_');

            return [...new Set([normalizedLabel, normalizedName, nameUnderscore, labelNoSpaces, labelUnderscore].filter(Boolean))];
        };

        fields.forEach((field) => {
            const fieldName = field.field_name || '';
            if (!fieldName) return;

            const variants = getFieldVariants(field);
            const match = headers.find((header) => {
                if (usedHeaders.has(header)) return false;
                const normalizedHeader = normalizeFieldText(header);
                return variants.some((variant) => (
                    variant === normalizedHeader ||
                    normalizedHeader === variant.replace(/_/g, ' ')
                ));
            });

            if (match) {
                autoMappings[fieldName] = match;
                usedHeaders.add(match);
            }
        });

        return autoMappings;
    };

    const fetchVisibleCustomFields = async (entityType: string): Promise<CustomFieldDefinition[]> => {
        const token = document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
        );
        const response = await fetch(`/api/admin/field-management/${entityType}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            throw new Error('Unable to fetch fields');
        }

        const data = await response.json();
        const fields = data.customFields || data.fields || [];
        const visibleFields = fields.filter((f: CustomFieldDefinition) => !f.is_hidden);
        visibleFields.sort((a: CustomFieldDefinition, b: CustomFieldDefinition) =>
            (a.sort_order || 0) - (b.sort_order || 0)
        );
        return visibleFields;
    };

    const fetchAvailableFields = async () => {
        const entityType = RECORD_TYPE_TO_ENTITY_TYPE[recordType];
        if (!entityType) return;

        setIsLoadingFields(true);
        try {
            const customFields = await fetchVisibleCustomFields(entityType);
            setAvailableFields(customFields);
        } catch (err) {
            console.error('Error fetching available fields:', err);
            setAvailableFields([]);
        } finally {
            setIsLoadingFields(false);
        }
    };

    useEffect(() => {
        if (currentStep !== 3) return;
        if (csvHeaders.length === 0 || availableFields.length === 0) return;
        if (Object.keys(fieldMappings).length > 0) return;
        const autoMappings = runAutoMapping(csvHeaders, availableFields);
        setFieldMappings(autoMappings);
    }, [currentStep, csvHeaders, availableFields, fieldMappings]);

    const parseCSV = (text: string): { headers: string[]; rows: CSVRow[] } => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) return { headers: [], rows: [] };

        // Improved CSV parser that handles quoted fields with commas
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        // Escaped quote
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        // Toggle quote state
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // End of field
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }

            // Add last field
            result.push(current.trim());
            return result;
        };

        // Parse headers
        const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));

        // Parse rows — skip completely empty rows (ghost rows)
        const rows: CSVRow[] = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
            // Skip if every cell is empty
            if (values.every(v => v.trim() === '')) continue;
            const row: CSVRow = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            // Skip if every value in the mapped row is empty
            if (Object.values(row).every(v => String(v).trim() === '')) continue;
            rows.push(row);
        }

        return { headers, rows };
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const lowerCaseName = file.name.toLowerCase();
            const isCSV = lowerCaseName.endsWith('.csv');
            const isExcel = lowerCaseName.endsWith('.xlsx') || lowerCaseName.endsWith('.xls');

            if (!isCSV && !isExcel) {
                toast.error('Please select a CSV or Excel file');
                return;
            }

            setSelectedFile(file);

            let parsedHeaders: string[] = [];
            let parsedRows: CSVRow[] = [];

            if (isCSV) {
                const text = await file.text();
                const { headers, rows } = parseCSV(text);
                parsedHeaders = headers;
                parsedRows = rows;
            } else {
                const XLSX = await import('xlsx');
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];

                if (!firstSheetName) {
                    toast.error('Excel file appears to be empty');
                    return;
                }

                const worksheet = workbook.Sheets[firstSheetName];
                const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
                    header: 1,
                    defval: '',
                    raw: false,
                });

                if (!matrix.length) {
                    toast.error('Excel file appears to be empty');
                    return;
                }

                parsedHeaders = (matrix[0] || []).map((cell) => String(cell ?? '').trim()).filter(Boolean);
                const dataRows = matrix.slice(1).filter((row) =>
                    row.some((cell) => String(cell ?? '').trim() !== '')
                );

                parsedRows = dataRows.map((row) => {
                    const csvRow: CSVRow = {};
                    parsedHeaders.forEach((header, index) => {
                        csvRow[header] = String(row[index] ?? '').trim();
                    });
                    return csvRow;
                });
            }

            if (parsedHeaders.length === 0) {
                toast.error('File appears to be empty or invalid');
                return;
            }
            if (parsedRows.length > MAX_IMPORT_ROWS_PER_FILE) {
                toast.error(
                    `File has ${parsedRows.length} rows. Maximum ${MAX_IMPORT_ROWS_PER_FILE} rows per file are allowed to avoid database timeout.`
                );
                setCsvHeaders([]);
                setCsvRows([]);
                setValidationErrors([]);
                setFieldMappings({});
                return;
            }

            setCsvHeaders(parsedHeaders);
            setCsvRows(parsedRows);
            setValidationErrors([]);
            setFieldMappings(runAutoMapping(parsedHeaders, availableFields));
        }
    };

    const handleChooseFile = () => {
        fileInputRef.current?.click();
    };

    const handleDropZoneDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDropZoneDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDropZoneDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        const lowerCaseName = file.name.toLowerCase();
        const isCSV = lowerCaseName.endsWith('.csv');
        const isExcel = lowerCaseName.endsWith('.xlsx') || lowerCaseName.endsWith('.xls');

        if (!isCSV && !isExcel) {
            toast.error('Please drop a CSV or Excel file');
            return;
        }

        // Reuse the same parsing logic as handleFileChange
        const syntheticEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
        await handleFileChange(syntheticEvent);
    };

    const skipDefectiveRows = () => {
        if (validationErrors.length === 0) return;

        const defectiveRows = new Set(validationErrors.map(e => e.row));
        const beforeCount = csvRows.length;
        const newRows = csvRows.filter((_, idx) => !defectiveRows.has(idx + 2));

        setCsvRows(newRows);
        setValidationErrors([]);
        toast.success(`Removed ${beforeCount - newRows.length} rows with validation errors.`);

        // Brief delay before re-validating to ensure state has settled
        setTimeout(() => {
            validateData();
        }, 100);
    };

    const handleNext = () => {
        if (currentStep === 1) {
            // Step 1: Record type selection - no file required yet
            setCurrentStep(2);
            setMaxVisitedStep((prev) => Math.max(prev, 2));
            return;
        }
        if (currentStep === 2) {
            if (!selectedFile) {
                toast.error('Please select a CSV file first');
                return;
            }
            if (csvHeaders.length === 0) {
                toast.error('Please upload a valid CSV file');
                return;
            }
            if (csvRows.length > MAX_IMPORT_ROWS_PER_FILE) {
                toast.error(
                    `This file has ${csvRows.length} rows. Please keep it to ${MAX_IMPORT_ROWS_PER_FILE} rows maximum per import.`
                );
                return;
            }
            setCurrentStep(3);
            setMaxVisitedStep((prev) => Math.max(prev, 3));
            return;
        }
        if (currentStep === 3) {
            // Run validation
            validateData();
            // Move to next step after validation
            setCurrentStep(4);
            setMaxVisitedStep((prev) => Math.max(prev, 4));
            return;
        }
        if (currentStep === 4) {
            // Proceed even with errors, but warn if there are any
            if (validationErrors.length > 0) {
                toast.info(`Proceeding with ${validationErrors.length} validation errors remaining.`);
            }
        }
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
            setMaxVisitedStep((prev) => Math.max(prev, currentStep + 1));
        }
    };

    const handleBack = () => {
        if (!confirmStopImport()) return;
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const validateData = () => {
        const errors: ValidationError[] = [];
        const entityType = RECORD_TYPE_TO_ENTITY_TYPE[recordType];

        csvRows.forEach((row, rowIndex) => {
            const actualRowNumber = rowIndex + 2; // +2 because row 1 is header, and we're 0-indexed

            availableFields.forEach((field) => {
                const csvColumn = fieldMappings[field.field_name];
                if (!csvColumn) {
                    return;
                }

                const value = row[csvColumn]?.trim() || '';

                // Validate email format only — all other type validations removed
                // since fields are not required and data should import as-is
                if (field.field_type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errors.push({
                        row: actualRowNumber,
                        field: field.field_label,
                        message: `Invalid email format: "${value}"`,
                    });
                }
            });
        });

        setValidationErrors(errors);
    };

    const handleImport = async () => {
        setIsImporting(true);
        importAbortControllerRef.current = new AbortController();
        const importId = crypto.randomUUID();
        currentImportIdRef.current = importId;
        setIsLiveStreamPaused(false);
        setLastStreamProgressAt(Date.now());
        const startedAt = Date.now();
        setImportElapsedMs(0);
        if (importTimerRef.current) {
            clearInterval(importTimerRef.current);
        }
        importTimerRef.current = setInterval(() => {
            setImportElapsedMs(Date.now() - startedAt);
        }, 100);

        try {
            const entityType = RECORD_TYPE_TO_ENTITY_TYPE[recordType];
            if (!entityType) {
                throw new Error('Invalid record type');
            }
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );

            // Build fieldNameToLabel mapping for custom fields
            const fieldNameToLabel: Record<string, string> = {};
            availableFields.forEach(f => {
                if (f.field_name && f.field_label) {
                    fieldNameToLabel[f.field_name] = f.field_label;
                }
            });

            // Build fieldDefinitions for lookup resolution on the server
            const fieldDefinitions = availableFields.map(f => ({
                field_name: f.field_name,
                field_label: f.field_label,
                field_type: f.field_type,
                lookup_type: f.lookup_type ?? null,
            }));

            // Prepare import data
            const importData = csvRows.map((row) => {
                const record: Record<string, any> = {};
                Object.keys(fieldMappings).forEach((fieldName) => {
                    const csvColumn = fieldMappings[fieldName];
                    record[fieldName] = row[csvColumn]?.trim() || '';
                });
                return record;
            });

            setImportLiveProgress({
                scanned: 0,
                totalInput: importData.length,
                successful: 0,
                failed: 0,
            });
            try {
                currentHistoryIdRef.current = await createImportHistoryEntry({
                    entityType,
                    totalRows: importData.length,
                });
            } catch (historyErr) {
                console.error('Initial history create failed:', historyErr);
            }

            const response = await fetch('/api/admin/data-uploader/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                signal: importAbortControllerRef.current.signal,
                body: JSON.stringify({
                    entityType,
                    records: importData,
                    importId,
                    options: importOptions,
                    fieldNameToLabel,
                    fieldDefinitions, // Pass full field defs so server can resolve lookup types
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Import failed');
            }

            const summary = await consumeImportNdjsonStream(
                response,
                importData.length,
                (progress) => {
                    setImportLiveProgress(progress);
                    setLastStreamProgressAt(Date.now());
                    setIsLiveStreamPaused(false);
                }
            );

            const durationMs = Date.now() - startedAt;
            setLastImportDurationMs(durationMs);
            setLastImportCompletedAt(new Date());

            setImportSummary(summary);

            const firstIdx = 0;
            const lastIdx = Math.max(0, csvRows.length - 1);
            const firstRowNumber = csvRows.length > 0 ? firstIdx + 2 : 0;
            const lastRowNumber = csvRows.length > 0 ? lastIdx + 2 : 0;
            const firstRowData = csvRows.length > 0 ? buildMappedImportRecord(csvRows[firstIdx]) : {};
            const lastRowData = csvRows.length > 0 ? buildMappedImportRecord(csvRows[lastIdx]) : {};

            if (currentHistoryIdRef.current) {
                try {
                    await updateImportHistoryEntry(currentHistoryIdRef.current, {
                        entityType,
                        summary,
                        durationMs,
                        firstRowNumber,
                        lastRowNumber,
                        firstRowData,
                        lastRowData,
                    });
                } catch (histErr) {
                    console.error('Import history save failed:', histErr);
                    toast.warning(
                        histErr instanceof Error
                            ? `Import finished, but history was not saved: ${histErr.message}`
                            : 'Import finished, but history was not saved.'
                    );
                }
            }

            setCurrentStep(6);
            toast.success(`Import finished in ${formatDurationMs(durationMs)}`);
        } catch (err) {
            console.error('Error importing data:', err);
            if (err instanceof DOMException && err.name === 'AbortError') {
                toast.info('Import was stopped. Already committed rows were kept; remaining rows were not parsed.');
            } else {
                toast.error(err instanceof Error ? err.message : 'Failed to import data');
            }
        } finally {
            if (importTimerRef.current) {
                clearInterval(importTimerRef.current);
                importTimerRef.current = null;
            }
            setImportLiveProgress(null);
            setLastStreamProgressAt(null);
            setIsLiveStreamPaused(false);
            setIsImporting(false);
            importAbortControllerRef.current = null;
            currentImportIdRef.current = null;
            currentHistoryIdRef.current = null;
        }
    };

    const handleReset = () => {
        if (!confirmStopImport()) return;
        setCurrentStep(1);
        setMainTab('upload');
        setSelectedFile(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setFieldMappings({});
        setValidationErrors([]);
        setImportSummary(null);
        setLastImportDurationMs(null);
        setLastImportCompletedAt(null);
        setImportElapsedMs(0);
        setImportLiveProgress(null);
        setLastStreamProgressAt(null);
        setIsLiveStreamPaused(false);
        currentImportIdRef.current = null;
        currentHistoryIdRef.current = null;
        setViewHistoryDetail(null);
        setViewHistoryLoading(false);
        setImportOptions({
            skipDuplicates: false,
            updateExisting: false,
            importNewOnly: false,
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const openHistoryView = async (id: number) => {
        setViewHistoryLoading(true);
        setViewHistoryDetail(null);
        try {
            const res = await fetch(`/api/admin/data-upload-import-history/${id}`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Failed to load entry');
            }
            const item = data.item as ImportHistoryDetail;
            setViewHistoryDetail(item);
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : 'Failed to load entry');
        } finally {
            setViewHistoryLoading(false);
        }
    };

    const handleDeleteHistory = async (id: number) => {
        if (!window.confirm('Delete this import history record?')) return;
        try {
            const res = await fetch(`/api/admin/data-upload-import-history/${id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Delete failed');
            }
            toast.success('History entry deleted');
            setHistoryItems((prev) => prev.filter((h) => h.id !== id));
            if (viewHistoryDetail?.id === id) {
                setViewHistoryDetail(null);
            }
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : 'Delete failed');
        }
    };

    const handleClose = () => {
        if (!confirmStopImport()) return;
        handleReset();
        router.push('/dashboard/admin');
    };

    // Download CSV Template
    const handleDownloadTemplate = async () => {
        try {
            // Fetch available fields for the selected record type
            const entityType = RECORD_TYPE_TO_ENTITY_TYPE[recordType];
            if (!entityType) {
                toast.error('Invalid record type');
                return;
            }
            const fields = await fetchVisibleCustomFields(entityType);

            if (fields.length === 0) {
                toast.error('No fields available for this record type');
                return;
            }

            // Generate CSV header row with proper CSV escaping
            const escapeCSV = (str: string): string => {
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const headers = fields.map(f => escapeCSV(f.field_label));
            const csvContent = headers.join(',') + '\n';

            // Create a blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${recordType.replace(/\s+/g, '_')}_Template.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading template:', err);
            toast.error('Failed to download template. Please try again.');
        }
    };

    const getPreviewRows = () => {
        return csvRows.slice(0, 10);
    };

    const getRowErrors = (rowIndex: number) => {
        const actualRowNumber = rowIndex + 2;
        return validationErrors.filter(e => e.row === actualRowNumber);
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            <div className="max-w-6xl mx-auto bg-white rounded shadow p-6 relative">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label="Close"
                    title="Close"
                >
                    <FiX className="w-6 h-6" />
                </button>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b pb-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <h1 className="text-2xl font-semibold text-gray-800">
                            CSV Data Upload
                        </h1>

                        {mainTab === 'upload' && recordType && currentStep !== 1 && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full font-medium bg-green-100 text-green-700 border border-green-500">
                                {recordType}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col items-stretch sm:items-end gap-2 pr-10">
                        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                            <button
                                type="button"
                                onClick={() => setMainTab('upload')}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${mainTab === 'upload'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                Upload
                            </button>
                            <button
                                type="button"
                                onClick={() => setMainTab('history')}
                                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${mainTab === 'history'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                History
                            </button>
                        </div>
                        {mainTab === 'upload' && (
                            <div className="text-sm text-gray-400 text-right">
                                Step {currentStep} of 6
                            </div>
                        )}
                    </div>
                </div>

                {/* Step Indicator */}
                {mainTab === 'upload' && (
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        {[1, 2, 3, 4, 5, 6].map((step) => {
                            const isCompleted = currentStep > step;
                            const isCurrent = currentStep === step;
                            const isVisited = step <= maxVisitedStep;
                            const isClickable = isVisited && !isCurrent;

                            return (
                                <div key={step} className="flex items-center flex-1">
                                    <div className="flex flex-col items-center flex-1">
                                        <div
                                            onClick={() => isClickable && setCurrentStep(step)}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-opacity ${isCurrent
                                                    ? 'bg-blue-500 text-white'
                                                    : isCompleted
                                                        ? 'bg-green-500 text-white'
                                                        : isVisited
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-gray-300 text-gray-600'
                                                } ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                                        >
                                            {isCompleted ? '✓' : step}
                                        </div>
                                        <div className={`mt-2 text-xs text-center whitespace-nowrap ${isClickable ? 'text-blue-600 cursor-pointer hover:underline' : 'text-gray-600'}`}
                                            onClick={() => isClickable && setCurrentStep(step)}
                                        >
                                            {step === 1 && 'Record Type'}
                                            {step === 2 && 'CSV Upload'}
                                            {step === 3 && 'Field Mapping'}
                                            {step === 4 && 'Validation'}
                                            {step === 5 && 'Import Options'}
                                            {step === 6 && 'Summary'}
                                        </div>
                                    </div>
                                    {step < totalSteps && (
                                        <div
                                            className={`h-1 flex-1 mx-2 ${currentStep > step ? 'bg-green-500' : 'bg-gray-300'}`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* Step Content */}
                <div className="min-h-[400px]">
                    {mainTab === 'history' ? (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-gray-800">Import history</h2>
                            <p className="text-sm text-gray-600">
                                Recent CSV imports (counts and timing). Open an entry to see the first and last file rows that were uploaded.
                            </p>
                            {historyLoading ? (
                                <div className="py-12 text-center text-gray-500">Loading history…</div>
                            ) : historyItems.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg">
                                    No import history yet. Complete an import from the Upload tab to record it here.
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">File Name</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">Total</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">OK</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">Fail</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">Time</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">Imported at</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">By</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600">Category</th>
                                                <th className="px-3 py-2 text-right font-semibold text-gray-600">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {historyItems.map((h) => (
                                                <tr key={h.id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 max-w-[240px] truncate" title={h.file_name}>
                                                        {h.file_name || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{h.total_rows}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-green-700 font-medium">{h.succeeded}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-red-600 font-medium">{h.failed}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{formatDurationMs(h.duration_ms)}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                                        {h.imported_at
                                                            ? new Date(h.imported_at).toLocaleString()
                                                            : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 max-w-[140px] truncate" title={h.imported_by_name || ''}>
                                                        {h.imported_by_name || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{h.category_label}</td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => void openHistoryView(h.id)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded mr-1"
                                                        >
                                                            <FiEye className="w-4 h-4" />
                                                            View
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleDeleteHistory(h.id)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <FiTrash2 className="w-4 h-4" />
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                    <>
                    {/* Step 1: Record Type Selection */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Step 1: Select Record Type</h2>
                                <p className="text-gray-600 mb-4">
                                    Choose which category of records you would like to import.
                                </p>
                                <div className="flex items-center space-x-4 mb-4">
                                    <select
                                        value={recordType}
                                        onChange={(e) => setRecordType(e.target.value)}
                                        className="w-full md:w-64 border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {recordTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        <FiDownload className="w-4 h-4" />
                                        <span>Download Template</span>
                                    </button>
                                </div>
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                                    <p className="text-sm text-blue-800">
                                        <strong>Tip:</strong> Download the CSV template to see the required field structure for {recordType} records.
                                        The template includes all available fields with proper headers.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: CSV Upload */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Step 2: Upload CSV File
                                </h2>
                                <p className="text-gray-600 mb-4">
                                    Select a .csv, .xlsx, or .xls file containing the data you would like to import.
                                </p>
                                <div
                                    onDragOver={handleDropZoneDragOver}
                                    onDragLeave={handleDropZoneDragLeave}
                                    onDrop={handleDropZoneDrop}
                                    onClick={handleChooseFile}
                                    className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-10 cursor-pointer transition-colors ${isDragOver
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40'
                                        }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <svg className={`w-10 h-10 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <div className="text-center">
                                        <p className={`text-sm font-medium ${isDragOver ? 'text-blue-600' : 'text-gray-700'}`}>
                                            {isDragOver ? 'Drop your file here' : 'Drag & drop your file here'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                                    </div>
                                    <p className="text-xs text-gray-400">Supports .csv, .xlsx, .xls (max 1000 data rows per file)</p>
                                    {selectedFile && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 shadow-sm">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {selectedFile.name}
                                        </div>
                                    )}
                                </div>
                                {csvHeaders.length > 0 && (
                                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                                        <p className="text-green-800">
                                            ✓ File loaded successfully. Found {csvHeaders.length} columns and {csvRows.length} rows.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Field Mapping */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Step 3: Map CSV Columns to Fields</h2>
                                <p className="text-gray-600 mb-4">
                                    Map each CSV column to a system field. Required fields are marked with a red asterisk.
                                </p>
                                {isLoadingFields ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="text-gray-400">Loading available fields...</div>
                                    </div>
                                ) : (
                                    <>

                                        <div className="space-y-4">
                                            {availableFields.map((field) => {
                                                const isRequired = field.is_required;
                                                const isMapped = !!fieldMappings[field.field_name];
                                                const isRequiredAndUnmapped = isRequired && !isMapped;

                                                return (
                                                    <div
                                                        key={field.id}
                                                        className={`flex items-center space-x-4 p-3 border rounded ${isRequiredAndUnmapped ? 'border-red-300 bg-red-50' : ''
                                                            }`}
                                                    >
                                                        <div className="w-64">
                                                            <label className="text-sm font-medium text-gray-700">
                                                                {field.field_label}
                                                                {field.is_required && (
                                                                    <span className="text-red-500 ml-1">*</span>
                                                                )}
                                                                <span className="text-xs text-gray-500 ml-2">
                                                                    ({field.field_type})
                                                                </span>
                                                            </label>
                                                        </div>
                                                        <div className="flex-1">
                                                            <select
                                                                value={fieldMappings[field.field_name] || ''}
                                                                onChange={(e) =>
                                                                    setFieldMappings((prev) => ({
                                                                        ...prev,
                                                                        [field.field_name]: e.target.value,
                                                                    }))
                                                                }
                                                                className={`w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRequiredAndUnmapped
                                                                    ? 'border-red-500 bg-white'
                                                                    : 'border-gray-300'
                                                                    }`}
                                                            >
                                                                <option value="">-- Select CSV Column --</option>
                                                                {csvHeaders.map((header) => (
                                                                    <option key={header} value={header}>
                                                                        {header}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Validation & Preview */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold">Step 4: Validation & Preview</h2>
                                    <div className="flex gap-2">
                                        {validationErrors.length > 0 && (
                                            <button
                                                onClick={skipDefectiveRows}
                                                className="px-4 py-2 bg-red-100 border border-red-300 rounded text-sm text-red-700 hover:bg-red-200 transition-colors flex items-center gap-2"
                                            >
                                                <span>Skip {validationErrors.length} Defective Rows</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={validateData}
                                            className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200"
                                        >
                                            Re-validate
                                        </button>
                                    </div>
                                </div>
                                {validationErrors.length > 0 ? (
                                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
                                        <p className="text-red-800 font-semibold mb-2">
                                            Found {validationErrors.length} validation error(s). Please fix these errors before importing.
                                        </p>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-red-700 max-h-40 overflow-y-auto">
                                            {validationErrors.slice(0, 20).map((error, idx) => (
                                                <li key={idx}>
                                                    Row {error.row}, {error.field}: {error.message}
                                                </li>
                                            ))}
                                            {validationErrors.length > 20 && (
                                                <li>... and {validationErrors.length - 20} more errors</li>
                                            )}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
                                        <p className="text-green-800">✓ All validations passed! You can proceed to import.</p>
                                    </div>
                                )}

                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold mb-3">Preview (First 10 Rows)</h3>
                                    <div className="overflow-x-auto border rounded max-h-[600px]">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="w-16 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b whitespace-nowrap">
                                                        Row
                                                    </th>
                                                    {availableFields
                                                        .filter((f) => fieldMappings[f.field_name])
                                                        .map((field) => (
                                                            <th
                                                                key={field.id}
                                                                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b whitespace-nowrap"
                                                            >
                                                                {field.field_label}
                                                            </th>
                                                        ))}
                                                    {validationErrors.length > 0 && (
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-red-500 uppercase tracking-wider bg-gray-50 border-b whitespace-nowrap">
                                                            Errors
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {getPreviewRows().map((row, rowIndex) => {
                                                    const rowErrors = getRowErrors(rowIndex);
                                                    return (
                                                        <tr
                                                            key={rowIndex}
                                                            className={`${rowErrors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}
                                                        >
                                                            <td className="px-4 py-3 text-sm text-gray-500 font-medium border-r">
                                                                {rowIndex + 2}
                                                            </td>
                                                            {availableFields
                                                                .filter((f) => fieldMappings[f.field_name])
                                                                .map((field) => {
                                                                    const csvColumn = fieldMappings[field.field_name];
                                                                    return (
                                                                        <td
                                                                            key={field.id}
                                                                            className="px-4 py-3 text-sm text-gray-900 break-words"
                                                                        >
                                                                            {row[csvColumn] || '-'}
                                                                        </td>
                                                                    );
                                                                })}
                                                            {validationErrors.length > 0 && (
                                                                <td className="px-4 py-3 text-sm text-red-600 border-l">
                                                                    {rowErrors.length > 0 ? (
                                                                        <ul className="list-disc list-inside space-y-0.5">
                                                                            {rowErrors.map((err, idx) => (
                                                                                <li key={idx} className="leading-relaxed">{err.message}</li>
                                                                            ))}
                                                                        </ul>
                                                                    ) : (
                                                                        <div className="flex items-center text-green-600 font-medium">
                                                                            <span className="mr-1.5">✓</span> Valid
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Import Options */}
                    {currentStep === 5 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Step 5: Import Options</h2>
                                {isImporting && (
                                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-sm font-semibold text-blue-900">
                                            Import in progress… elapsed{' '}
                                            <span className="tabular-nums text-base">{formatDurationMs(importElapsedMs)}</span>
                                        </p>
                                        {importLiveProgress && (
                                            <p className="text-sm text-blue-900 mt-2 tabular-nums">
                                                Rows processed:{' '}
                                                <span className="font-semibold">{importLiveProgress.scanned}</span>
                                                {' / '}
                                                <span className="font-semibold">{importLiveProgress.totalInput}</span>
                                                {' · '}
                                                <span className="text-green-800">OK {importLiveProgress.successful}</span>
                                                {' · '}
                                                <span className="text-red-800">Failed {importLiveProgress.failed}</span>
                                            </p>
                                        )}
                                        {isLiveStreamPaused && (
                                            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                                                Resuming from last known progress: parsed{' '}
                                                <span className="font-semibold tabular-nums">
                                                    {importLiveProgress?.scanned ?? 0}
                                                </span>
                                                {' / '}
                                                <span className="font-semibold tabular-nums">
                                                    {importLiveProgress?.totalInput ?? csvRows.length}
                                                </span>
                                                . The import is still running and this view updates automatically when the next server chunk arrives.
                                            </div>
                                        )}
                                        <p className="text-xs text-blue-800 mt-1">
                                            Updates stream over the same request (lightly throttled for smooth UI). Bulk organization imports refresh OK/Failed after each batch is written.
                                        </p>
                                    </div>
                                )}
                                {validationErrors.length > 0 && (
                                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                                        <div className="flex items-center text-yellow-800 font-semibold mb-2">
                                            <span className="mr-2">⚠</span>
                                            Important Warning
                                        </div>
                                        <p className="text-sm text-yellow-700">
                                            There are {validationErrors.length} validation errors found in Step 4. Starting the import with these errors might lead to incomplete or incorrect data in the system. Please ensure you're okay with this before proceeding.
                                        </p>
                                    </div>
                                )}
                                <p className="text-gray-600 mb-4">
                                    Configure how the import should handle existing records.
                                </p>
                                <div className="space-y-4">
                                    <label className="flex items-center space-x-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={importOptions.skipDuplicates}
                                            onChange={(e) =>
                                                setImportOptions((prev) => ({
                                                    ...prev,
                                                    skipDuplicates: e.target.checked,
                                                    updateExisting: e.target.checked ? false : prev.updateExisting,
                                                    importNewOnly: e.target.checked ? false : prev.importNewOnly,
                                                }))
                                            }
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                        />
                                        <div>
                                            <div className="font-medium">Skip Duplicates</div>
                                            <div className="text-sm text-gray-500">
                                                Skip records that already exist in the system
                                            </div>
                                        </div>
                                    </label>

                                    <label className="flex items-center space-x-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={importOptions.updateExisting}
                                            onChange={(e) =>
                                                setImportOptions((prev) => ({
                                                    ...prev,
                                                    updateExisting: e.target.checked,
                                                    skipDuplicates: e.target.checked ? false : prev.skipDuplicates,
                                                    importNewOnly: e.target.checked ? false : prev.importNewOnly,
                                                }))
                                            }
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                        />
                                        <div>
                                            <div className="font-medium">Update Existing Records</div>
                                            <div className="text-sm text-gray-500">
                                                Update existing records with new data from CSV
                                            </div>
                                        </div>
                                    </label>

                                    <label className="flex items-center space-x-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={importOptions.importNewOnly}
                                            onChange={(e) =>
                                                setImportOptions((prev) => ({
                                                    ...prev,
                                                    importNewOnly: e.target.checked,
                                                    skipDuplicates: e.target.checked ? false : prev.skipDuplicates,
                                                    updateExisting: e.target.checked ? false : prev.updateExisting,
                                                }))
                                            }
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                        />
                                        <div>
                                            <div className="font-medium">Import New Records Only</div>
                                            <div className="text-sm text-gray-500">
                                                Only import records that don't exist in the system
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 6: Import Summary */}
                    {currentStep === 6 && importSummary && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Step 6: Import Summary</h2>
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {importSummary.totalRows}
                                        </div>
                                        <div className="text-sm text-gray-600">Total Rows</div>
                                    </div>
                                    <div className="p-4 bg-green-50 border border-green-200 rounded">
                                        <div className="text-2xl font-bold text-green-600">
                                            {importSummary.successful}
                                        </div>
                                        <div className="text-sm text-gray-600">Successfully Imported</div>
                                    </div>
                                    <div className="p-4 bg-red-50 border border-red-200 rounded">
                                        <div className="text-2xl font-bold text-red-600">
                                            {importSummary.failed}
                                        </div>
                                        <div className="text-sm text-gray-600">Failed</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                                        <div className="text-lg font-semibold text-gray-900 tabular-nums">
                                            {lastImportDurationMs != null ? formatDurationMs(lastImportDurationMs) : '—'}
                                        </div>
                                        <div className="text-sm text-gray-600">Time taken</div>
                                    </div>
                                    <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                                        <div className="text-lg font-semibold text-gray-900">
                                            {lastImportCompletedAt ? lastImportCompletedAt.toLocaleString() : '—'}
                                        </div>
                                        <div className="text-sm text-gray-600">Import completed at</div>
                                    </div>
                                </div>

                                {importSummary.errors.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="text-lg font-semibold mb-3">Error Details</h3>
                                        <div className="overflow-x-auto border rounded">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Row
                                                        </th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Errors
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {importSummary.errors.map((error, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-4 py-2 text-sm text-gray-900">
                                                                {error.row}
                                                            </td>
                                                            <td className="px-4 py-2 text-sm text-red-600">
                                                                <ul className="list-disc list-inside">
                                                                    {error.errors.map((err, errIdx) => (
                                                                        <li key={errIdx}>{err}</li>
                                                                    ))}
                                                                </ul>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    </>
                    )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex w-full sticky bottom-0 p-4 justify-between bg-white mt-8 border-t border-gray-300">
                    <div>
                        {mainTab === 'upload' && currentStep > 1 && (
                            <button
                                onClick={handleBack}
                                className="px-6 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                            >
                                Back
                            </button>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {mainTab === 'history' && (
                            <button
                                type="button"
                                onClick={() => setMainTab('upload')}
                                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Return to upload
                            </button>
                        )}
                        {mainTab === 'upload' && currentStep < totalSteps && (
                            <>
                                {currentStep === 5 ? (
                                    <button
                                        onClick={handleImport}
                                        disabled={
                                            isImporting ||
                                            !(importOptions.skipDuplicates || importOptions.updateExisting || importOptions.importNewOnly)
                                        }
                                        className={`px-6 py-2 rounded text-white font-medium transition-colors ${isImporting ||
                                            !(importOptions.skipDuplicates || importOptions.updateExisting || importOptions.importNewOnly)
                                            ? 'bg-gray-400 cursor-not-allowed opacity-70'
                                            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                                            }`}
                                    >
                                        {isImporting
                                            ? `Importing… ${formatDurationMs(importElapsedMs)}${importLiveProgress
                                                ? ` · ${importLiveProgress.successful}/${importLiveProgress.totalInput} OK`
                                                : ''}`
                                            : 'Start Import'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNext}
                                        className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                        Next
                                    </button>
                                )}
                            </>
                        )}
                        {mainTab === 'upload' && currentStep === totalSteps && (
                            <button
                                onClick={handleReset}
                                className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                Upload Another File
                            </button>
                        )}
                    </div>
                </div>

                {(viewHistoryDetail || viewHistoryLoading) && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="history-view-title"
                    >
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setViewHistoryDetail(null);
                                    setViewHistoryLoading(false);
                                }}
                                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 p-1"
                                aria-label="Close"
                            >
                                <FiX className="w-6 h-6" />
                            </button>
                            <h3 id="history-view-title" className="text-lg font-semibold text-gray-900 pr-10 mb-4">
                                Import preview
                            </h3>
                            {viewHistoryLoading ? (
                                <p className="text-gray-600">Loading…</p>
                            ) : viewHistoryDetail ? (
                                <div className="space-y-6 text-sm">
                                    <div>
                                        <span className="text-gray-500">File name</span>
                                        <p className="font-medium text-gray-900 break-all">{viewHistoryDetail.file_name}</p>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-700">
                                            First data row (row {viewHistoryDetail.first_row_number ?? '—'} in file)
                                        </div>
                                        <div className="p-3 max-h-48 overflow-y-auto">
                                            {viewHistoryDetail.first_row_data &&
                                                Object.keys(viewHistoryDetail.first_row_data).length > 0 ? (
                                                <table className="w-full text-left text-xs">
                                                    <tbody>
                                                        {Object.entries(viewHistoryDetail.first_row_data).map(([k, v]) => (
                                                            <tr key={k} className="border-b border-gray-100 last:border-0">
                                                                <td className="py-1 pr-2 font-medium text-gray-600 align-top whitespace-nowrap">{k}</td>
                                                                <td className="py-1 text-gray-900 break-all">{v || '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <p className="text-gray-500">No row data stored.</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-700">
                                            Last data row (row {viewHistoryDetail.last_row_number ?? '—'} in file)
                                        </div>
                                        <div className="p-3 max-h-48 overflow-y-auto">
                                            {viewHistoryDetail.last_row_data &&
                                                Object.keys(viewHistoryDetail.last_row_data).length > 0 ? (
                                                <table className="w-full text-left text-xs">
                                                    <tbody>
                                                        {Object.entries(viewHistoryDetail.last_row_data).map(([k, v]) => (
                                                            <tr key={k} className="border-b border-gray-100 last:border-0">
                                                                <td className="py-1 pr-2 font-medium text-gray-600 align-top whitespace-nowrap">{k}</td>
                                                                <td className="py-1 text-gray-900 break-all">{v || '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <p className="text-gray-500">No row data stored.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
