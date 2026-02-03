'use client'

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { FiX, FiDownload } from 'react-icons/fi';
import LoadingScreen from '@/components/LoadingScreen';

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

const RECORD_TYPE_TO_ENTITY_TYPE: Record<string, string> = {
    'Contact': 'organizations',
    'Organization': 'organizations',
    'Job Seeker': 'job-seekers',
    'Job': 'jobs',
    'Hiring Manager': 'hiring-managers',
    'Placement': 'placements',
    'Lead': 'leads'
};

export default function DataUploader() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [recordType, setRecordType] = useState('Job Seeker');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const recordTypes = [
        'Contact',
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

    const getStandardFields = (entityType: string): CustomFieldDefinition[] => {
        const standardFieldsMap: Record<string, CustomFieldDefinition[]> = {
            'job-seekers': [
                { id: 'std_first_name', field_name: 'first_name', field_label: 'First Name', field_type: 'text', is_required: true, is_hidden: false, sort_order: 1 },
                { id: 'std_last_name', field_name: 'last_name', field_label: 'Last Name', field_type: 'text', is_required: true, is_hidden: false, sort_order: 2 },
                { id: 'std_email', field_name: 'email', field_label: 'Email', field_type: 'email', is_required: false, is_hidden: false, sort_order: 3 },
                { id: 'std_phone', field_name: 'phone', field_label: 'Phone', field_type: 'phone', is_required: false, is_hidden: false, sort_order: 4 },
                { id: 'std_status', field_name: 'status', field_label: 'Status', field_type: 'text', is_required: false, is_hidden: false, sort_order: 5 },
            ],
            'organizations': [
                { id: 'std_name', field_name: 'name', field_label: 'Company Name', field_type: 'text', is_required: true, is_hidden: false, sort_order: 1 },
                { id: 'std_contact_phone', field_name: 'contact_phone', field_label: 'Phone', field_type: 'phone', is_required: false, is_hidden: false, sort_order: 2 },
                { id: 'std_website', field_name: 'website', field_label: 'Website', field_type: 'text', is_required: false, is_hidden: false, sort_order: 3 },
                { id: 'std_status', field_name: 'status', field_label: 'Status', field_type: 'text', is_required: false, is_hidden: false, sort_order: 4 },
            ],
            'leads': [
                { id: 'std_first_name', field_name: 'first_name', field_label: 'First Name', field_type: 'text', is_required: true, is_hidden: false, sort_order: 1 },
                { id: 'std_last_name', field_name: 'last_name', field_label: 'Last Name', field_type: 'text', is_required: true, is_hidden: false, sort_order: 2 },
                { id: 'std_email', field_name: 'email', field_label: 'Email', field_type: 'email', is_required: false, is_hidden: false, sort_order: 3 },
                { id: 'std_phone', field_name: 'phone', field_label: 'Phone', field_type: 'phone', is_required: false, is_hidden: false, sort_order: 4 },
                { id: 'std_title', field_name: 'title', field_label: 'Title', field_type: 'text', is_required: false, is_hidden: false, sort_order: 5 },
                { id: 'std_status', field_name: 'status', field_label: 'Status', field_type: 'text', is_required: false, is_hidden: false, sort_order: 6 },
            ],
            'jobs': [
                { id: 'std_title', field_name: 'title', field_label: 'Job Title', field_type: 'text', is_required: true, is_hidden: false, sort_order: 1 },
                { id: 'std_organization_id', field_name: 'organization_id', field_label: 'Organization ID', field_type: 'text', is_required: false, is_hidden: false, sort_order: 2 },
                { id: 'std_status', field_name: 'status', field_label: 'Status', field_type: 'text', is_required: false, is_hidden: false, sort_order: 3 },
            ],
            'hiring-managers': [
                { id: 'std_first_name', field_name: 'first_name', field_label: 'First Name', field_type: 'text', is_required: true, is_hidden: false, sort_order: 1 },
                { id: 'std_last_name', field_name: 'last_name', field_label: 'Last Name', field_type: 'text', is_required: true, is_hidden: false, sort_order: 2 },
                { id: 'std_email', field_name: 'email', field_label: 'Email', field_type: 'email', is_required: false, is_hidden: false, sort_order: 3 },
                { id: 'std_phone', field_name: 'phone', field_label: 'Phone', field_type: 'phone', is_required: false, is_hidden: false, sort_order: 4 },
            ],
            'placements': [
                { id: 'std_job_seeker_id', field_name: 'job_seeker_id', field_label: 'Job Seeker ID', field_type: 'text', is_required: true, is_hidden: false, sort_order: 1 },
                { id: 'std_job_id', field_name: 'job_id', field_label: 'Job ID', field_type: 'text', is_required: true, is_hidden: false, sort_order: 2 },
                { id: 'std_status', field_name: 'status', field_label: 'Status', field_type: 'text', is_required: false, is_hidden: false, sort_order: 3 },
            ],
        };

        return standardFieldsMap[entityType] || [];
    };

    const fetchAvailableFields = async () => {
        const entityType = RECORD_TYPE_TO_ENTITY_TYPE[recordType];
        if (!entityType) return;

        setIsLoadingFields(true);
        try {
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );
            const response = await fetch(`/api/admin/field-management/${entityType}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const standardFields = getStandardFields(entityType);
            let customFields: CustomFieldDefinition[] = [];

            if (response.ok) {
                const data = await response.json();
                const fields = data.customFields || data.fields || [];
                // Filter out hidden fields
                const visibleFields = fields.filter((f: CustomFieldDefinition) => !f.is_hidden);
                // Sort by sort_order
                visibleFields.sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => 
                    (a.sort_order || 0) - (b.sort_order || 0)
                );
                customFields = visibleFields;
            }

            // Combine standard and custom fields, ensuring no duplicates
            const allFields = [...standardFields];
            const standardFieldNames = new Set(standardFields.map(f => f.field_name));
            customFields.forEach(field => {
                if (!standardFieldNames.has(field.field_name)) {
                    allFields.push(field);
                }
            });

            // Sort all fields by sort_order
            allFields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            setAvailableFields(allFields);
        } catch (err) {
            console.error('Error fetching available fields:', err);
            // Fallback to standard fields only
            if (entityType) {
                setAvailableFields(getStandardFields(entityType));
            }
        } finally {
            setIsLoadingFields(false);
        }
    };

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

        // Parse rows
        const rows: CSVRow[] = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
            const row: CSVRow = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            rows.push(row);
        }

        return { headers, rows };
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (!file.name.endsWith('.csv')) {
                toast.error('Please select a CSV file');
                return;
            }

            setSelectedFile(file);

            // Parse CSV
            const text = await file.text();
            const { headers, rows } = parseCSV(text);

            if (headers.length === 0) {
                toast.error('CSV file appears to be empty or invalid');
                return;
            }

            setCsvHeaders(headers);
            setCsvRows(rows);
            setFieldMappings({});
            setValidationErrors([]);
        }
    };

    const handleChooseFile = () => {
        fileInputRef.current?.click();
    };

    const handleNext = () => {
        if (currentStep === 1) {
            // Step 1: Record type selection - no file required yet
            setCurrentStep(2);
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
            setCurrentStep(3);
            return;
        }
        if (currentStep === 3) {
            // Validate mappings before proceeding
            const requiredFields = availableFields.filter(f => f.is_required);
            const unmappedRequired = requiredFields.filter(f => !fieldMappings[f.field_name]);
            if (unmappedRequired.length > 0) {
                toast.error(`Please map all required fields: ${unmappedRequired.map(f => f.field_label).join(', ')}`);
                return;
            }
            // Run validation
            validateData();
            // Move to next step after validation
            setCurrentStep(4);
            return;
        }
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
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
                    if (field.is_required) {
                        errors.push({
                            row: actualRowNumber,
                            field: field.field_label,
                            message: `Required field "${field.field_label}" is not mapped`,
                        });
                    }
                    return;
                }

                const value = row[csvColumn]?.trim() || '';

                // Check required fields
                if (field.is_required && !value) {
                    errors.push({
                        row: actualRowNumber,
                        field: field.field_label,
                        message: `Required field "${field.field_label}" is empty`,
                    });
                }

                // Validate email format
                if (field.field_type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errors.push({
                        row: actualRowNumber,
                        field: field.field_label,
                        message: `Invalid email format: "${value}"`,
                    });
                }

                // Validate phone format (basic validation)
                if (field.field_type === 'phone' && value) {
                    // Remove common phone formatting characters for validation
                    const cleaned = value.replace(/[\s\-\(\)\.]/g, '');
                    if (!/^\+?[\d]{10,15}$/.test(cleaned)) {
                        errors.push({
                            row: actualRowNumber,
                            field: field.field_label,
                            message: `Invalid phone format: "${value}"`,
                        });
                    }
                }

                // Validate date format (accepts multiple formats)
                if (field.field_type === 'date' && value) {
                    const dateFormats = [
                        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
                        /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
                        /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
                    ];
                    const isValidFormat = dateFormats.some(regex => regex.test(value));
                    if (!isValidFormat) {
                        // Try parsing as date
                        const parsedDate = new Date(value);
                        if (isNaN(parsedDate.getTime())) {
                            errors.push({
                                row: actualRowNumber,
                                field: field.field_label,
                                message: `Invalid date format: "${value}". Expected YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY`,
                            });
                        }
                    }
                }

                // Validate number format
                if (field.field_type === 'number' && value && isNaN(Number(value))) {
                    errors.push({
                        row: actualRowNumber,
                        field: field.field_label,
                        message: `Invalid number format: "${value}"`,
                    });
                }
            });
        });

        setValidationErrors(errors);
    };

    const handleImport = async () => {
        setIsImporting(true);
        try {
            const entityType = RECORD_TYPE_TO_ENTITY_TYPE[recordType];
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );

            // Prepare import data
            const importData = csvRows.map((row) => {
                const record: Record<string, any> = {};
                Object.keys(fieldMappings).forEach((fieldName) => {
                    const csvColumn = fieldMappings[fieldName];
                    record[fieldName] = row[csvColumn]?.trim() || '';
                });
                return record;
            });

            const response = await fetch('/api/admin/data-uploader/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    entityType,
                    records: importData,
                    options: importOptions,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Import failed');
            }

            setImportSummary(data.summary || {
                totalRows: csvRows.length,
                successful: 0,
                failed: csvRows.length,
                errors: [],
            });
            setCurrentStep(6);
        } catch (err) {
            console.error('Error importing data:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to import data');
        } finally {
            setIsImporting(false);
        }
    };

    const handleReset = () => {
        setCurrentStep(1);
        setSelectedFile(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setFieldMappings({});
        setValidationErrors([]);
        setImportSummary(null);
        setImportOptions({
            skipDuplicates: false,
            updateExisting: false,
            importNewOnly: false,
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClose = () => {
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

            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );

            let fields: CustomFieldDefinition[] = [];
            try {
                const response = await fetch(`/api/admin/field-management/${entityType}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const standardFields = getStandardFields(entityType);
                let customFields: CustomFieldDefinition[] = [];

                if (response.ok) {
                    const data = await response.json();
                    const fetchedFields = data.customFields || data.fields || [];
                    // Filter out hidden fields for template
                    const visibleFields = fetchedFields.filter((f: CustomFieldDefinition) => !f.is_hidden);
                    visibleFields.sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => 
                        (a.sort_order || 0) - (b.sort_order || 0)
                    );
                    customFields = visibleFields;
                }

                // Combine standard and custom fields
                const allFields = [...standardFields];
                const standardFieldNames = new Set(standardFields.map(f => f.field_name));
                customFields.forEach(field => {
                    if (!standardFieldNames.has(field.field_name)) {
                        allFields.push(field);
                    }
                });

                // Sort all fields by sort_order
                allFields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                fields = allFields;
            } catch (err) {
                console.error('Error fetching fields for template:', err);
                // Fallback to standard fields only
                fields = getStandardFields(entityType);
            }

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
                <h1 className="text-2xl font-semibold mb-6 pr-10">CSV Data Upload</h1>

                {/* Step Indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        {[1, 2, 3, 4, 5, 6].map((step) => (
                            <div key={step} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                                            currentStep === step
                                                ? 'bg-blue-500 text-white'
                                                : currentStep > step
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-300 text-gray-600'
                                        }`}
                                    >
                                        {currentStep > step ? '✓' : step}
                                    </div>
                                    <div className="mt-2 text-xs text-center text-gray-600">
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
                                        className={`h-1 flex-1 mx-2 ${
                                            currentStep > step ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="min-h-[400px]">
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
                                <h2 className="text-xl font-semibold mb-4">Step 2: Upload CSV File</h2>
                                <p className="text-gray-600 mb-4">
                                    Select the .csv file containing the data you would like to import.
                                </p>
                                <div className="flex items-center space-x-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={handleChooseFile}
                                        className="bg-gray-100 border border-gray-300 rounded px-4 py-2 hover:bg-gray-200"
                                    >
                                        Choose File
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        {selectedFile ? selectedFile.name : 'No file chosen'}
                                    </span>
                                </div>
                                {csvHeaders.length > 0 && (
                                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                                        <p className="text-green-800">
                                            ✓ CSV file loaded successfully. Found {csvHeaders.length} columns and {csvRows.length} rows.
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
                                        {/* Validation Warning */}
                                        {(() => {
                                            const requiredFields = availableFields.filter(f => f.is_required);
                                            const unmappedRequired = requiredFields.filter(f => !fieldMappings[f.field_name]);
                                            return unmappedRequired.length > 0 && (
                                                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                                                    <p className="text-yellow-800 font-semibold mb-2">
                                                        ⚠️ {unmappedRequired.length} required field(s) not mapped:
                                                    </p>
                                                    <ul className="list-disc list-inside text-sm text-yellow-700">
                                                        {unmappedRequired.map(f => (
                                                            <li key={f.id}>{f.field_label}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            );
                                        })()}
                                        <div className="space-y-4">
                                            {availableFields.map((field) => {
                                                const isRequired = field.is_required;
                                                const isMapped = !!fieldMappings[field.field_name];
                                                const isRequiredAndUnmapped = isRequired && !isMapped;
                                                
                                                return (
                                                    <div 
                                                        key={field.id} 
                                                        className={`flex items-center space-x-4 p-3 border rounded ${
                                                            isRequiredAndUnmapped ? 'border-red-300 bg-red-50' : ''
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
                                                                className={`w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                                    isRequiredAndUnmapped 
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
                                    <button
                                        onClick={validateData}
                                        className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200"
                                    >
                                        Re-validate
                                    </button>
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
                                    <div className="overflow-x-auto border rounded">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Row
                                                    </th>
                                                    {availableFields
                                                        .filter((f) => fieldMappings[f.field_name])
                                                        .map((field) => (
                                                            <th
                                                                key={field.id}
                                                                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                                            >
                                                                {field.field_label}
                                                            </th>
                                                        ))}
                                                    {validationErrors.length > 0 && (
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-red-500 uppercase">
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
                                                            className={rowErrors.length > 0 ? 'bg-red-50' : ''}
                                                        >
                                                            <td className="px-4 py-2 text-sm text-gray-500">
                                                                {rowIndex + 2}
                                                            </td>
                                                            {availableFields
                                                                .filter((f) => fieldMappings[f.field_name])
                                                                .map((field) => {
                                                                    const csvColumn = fieldMappings[field.field_name];
                                                                    return (
                                                                        <td
                                                                            key={field.id}
                                                                            className="px-4 py-2 text-sm text-gray-900"
                                                                        >
                                                                            {row[csvColumn] || '-'}
                                                                        </td>
                                                                    );
                                                                })}
                                                            {validationErrors.length > 0 && (
                                                                <td className="px-4 py-2 text-sm text-red-600">
                                                                    {rowErrors.length > 0 ? (
                                                                        <ul className="list-disc list-inside">
                                                                            {rowErrors.map((err, idx) => (
                                                                                <li key={idx}>{err.message}</li>
                                                                            ))}
                                                                        </ul>
                                                                    ) : (
                                                                        <span className="text-green-600">✓</span>
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
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t">
                    <div>
                        {currentStep > 1 && (
                            <button
                                onClick={handleBack}
                                className="px-6 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                            >
                                Back
                            </button>
                        )}
                    </div>
                    <div className="flex space-x-4">
                        {currentStep < totalSteps && (
                            <>
                                {currentStep === 5 ? (
                                    <button
                                        onClick={handleImport}
                                        disabled={isImporting || validationErrors.length > 0}
                                        className={`px-6 py-2 rounded text-white ${
                                            isImporting || validationErrors.length > 0
                                                ? 'bg-gray-400 cursor-not-allowed'
                                                : 'bg-blue-500 hover:bg-blue-600'
                                        }`}
                                    >
                                        {isImporting ? 'Importing...' : 'Start Import'}
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
                        {currentStep === totalSteps && (
                            <button
                                onClick={handleReset}
                                className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                Upload Another File
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
