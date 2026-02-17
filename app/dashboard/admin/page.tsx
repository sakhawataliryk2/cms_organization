// app/dashboard/admin/page.tsx

'use client'

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    FiGrid,
    FiUpload,
    FiDownload,
    FiArrowRight,
    FiCode,
    FiFileText,
    FiUsers,
    FiChevronDown,
    FiX,
    FiCheck,
    FiMail,
    FiAlertCircle,
    FiActivity
} from 'react-icons/fi';
import { FaRegFolderOpen } from "react-icons/fa";
import { MdDriveFolderUpload } from "react-icons/md";
import { RiFolderDownloadLine } from "react-icons/ri";
import { IoDocumentOutline } from "react-icons/io5";
import { TfiUser } from "react-icons/tfi";
import { FaRegArrowAltCircleRight } from "react-icons/fa";
import { toast } from "sonner";


interface AdminModule {
    id: string;
    name: string;
    icon: React.ReactNode;
    path: string;
}

interface DownloadModule {
    id: string;
    name: string;
    apiEndpoint: string;
    dataKey: string;
}

interface UploadModule {
    id: string;
    name: string;
    apiEndpoint: string;
    requiredFields: string[];
    fieldMappings: Record<string, string[]>; // CSV header -> system field names
}

interface ParsedRow {
    raw: Record<string, string>;
    mapped: Record<string, any>;
    errors: string[];
    rowNumber: number;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

interface CustomFieldDefinition {
    id: string;
    field_name: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    is_hidden: boolean;
    sort_order: number;
}

interface ModuleFieldConfig {
    [moduleId: string]: CustomFieldDefinition[];
}

export default function AdminCenter() {
    const router = useRouter();
    const searchParams = useSearchParams() ?? new URLSearchParams();
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [selectedModule, setSelectedModule] = useState<string>(''); // Single module selection
    const [selectedFields, setSelectedFields] = useState<string[]>([]); // Selected fields for export
    const [statusOptions, setStatusOptions] = useState<{ label: string; value: string }[]>([]); // Dynamic status options
    const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
    const [isExporting, setIsExporting] = useState(false);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [statusFilter, setStatusFilter] = useState('');
    
    // Upload states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedUploadModule, setSelectedUploadModule] = useState<string>('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [currentStep, setCurrentStep] = useState<'select' | 'map' | 'preview' | 'upload'>('select');
    const [moduleFieldConfigs, setModuleFieldConfigs] = useState<ModuleFieldConfig>({});
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, module: '' });

    // Auto-open upload modal if ?upload=true query parameter is present
    useEffect(() => {
        const shouldOpenUpload = searchParams.get('upload') === 'true';
        if (shouldOpenUpload) {
            // Reset upload state
            setUploadFile(null);
            setCsvHeaders([]);
            setParsedData([]);
            setFieldMappings({});
            setUploadProgress({ current: 0, total: 0 });
            setUploadResults(null);
            setValidationErrors([]);
            setCurrentStep('select');
            setShowUploadModal(true);
            // Clean up URL by removing query parameter
            router.replace('/dashboard/admin', { scroll: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Map module IDs to entity types for Field Management
    const moduleToEntityType: Record<string, string> = {
        'organizations': 'organizations',
        'jobs': 'jobs',
        'leads': 'leads',
        'job-seekers': 'job-seekers',
        'hiring-managers': 'hiring-managers',
        'placements': 'placements',
        'tasks': 'tasks',
    };

    // Available modules for download
    const downloadModules: DownloadModule[] = [
        { id: 'organizations', name: 'Organizations', apiEndpoint: '/api/organizations', dataKey: 'organizations' },
        { id: 'jobs', name: 'Jobs', apiEndpoint: '/api/jobs', dataKey: 'jobs' },
        { id: 'leads', name: 'Leads', apiEndpoint: '/api/leads', dataKey: 'leads' },
        { id: 'job-seekers', name: 'Job Seekers', apiEndpoint: '/api/job-seekers', dataKey: 'jobSeekers' },
        { id: 'hiring-managers', name: 'Hiring Managers', apiEndpoint: '/api/hiring-managers', dataKey: 'hiringManagers' },
        { id: 'placements', name: 'Placements', apiEndpoint: '/api/placements', dataKey: 'placements' },
        { id: 'tasks', name: 'Tasks', apiEndpoint: '/api/tasks', dataKey: 'tasks' },
    ];

    // Fetch field configurations and status options for selected module
    useEffect(() => {
        if (!selectedModule || !showDownloadModal) {
            setModuleFieldConfigs({});
            setIsLoadingFields(false);
            setStatusOptions([]);
            return;
        }

        const fetchModuleData = async () => {
            setIsLoadingFields(true);
            const entityType = moduleToEntityType[selectedModule];
            const configs: ModuleFieldConfig = {};
            
            // Fetch fields
            if (!entityType) {
                configs[selectedModule] = getStandardFields(selectedModule);
            } else {
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

                    if (response.ok) {
                        const data = await response.json();
                        const fields = data.customFields || data.fields || [];
                        const visibleFields = fields
                            .filter((f: CustomFieldDefinition) => !f.is_hidden)
                            .sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => 
                                (a.sort_order || 0) - (b.sort_order || 0)
                            );
                        configs[selectedModule] = visibleFields;
                    } else {
                        configs[selectedModule] = getStandardFields(selectedModule);
                    }
                } catch (err) {
                    console.error(`Error fetching fields for ${selectedModule}:`, err);
                    configs[selectedModule] = getStandardFields(selectedModule);
                }
            }

            // Fetch status options
            try {
                const token = document.cookie.replace(
                    /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                    "$1"
                );
                const module = downloadModules.find(m => m.id === selectedModule);
                if (module) {
                    const response = await fetch(module.apiEndpoint, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const items = data[module.dataKey] || data.data || [];
                        // Extract unique status values
                        const statusSet = new Set<string>();
                        items.forEach((item: any) => {
                            if (item.status) {
                                statusSet.add(item.status);
                            }
                        });
                        const statuses = Array.from(statusSet).sort().map(s => ({ label: s, value: s }));
                        setStatusOptions(statuses);
                    }
                }
            } catch (err) {
                console.error(`Error fetching status options for ${selectedModule}:`, err);
                setStatusOptions([]);
            }

            setModuleFieldConfigs(configs);
            setIsLoadingFields(false);
        };

        fetchModuleData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedModule, showDownloadModal]);

    // Available modules for upload with field mappings
    const uploadModules: UploadModule[] = [
        {
            id: 'organizations',
            name: 'Organizations',
            apiEndpoint: '/api/organizations',
            requiredFields: ['name'],
            fieldMappings: {
                'name': ['name', 'organization name', 'company name', 'org name'],
                'nicknames': ['nicknames', 'nickname', 'aliases'],
                'status': ['status'],
                'contact_phone': ['phone', 'contact phone', 'telephone'],
                'address': ['address', 'street address'],
                'website': ['website', 'url', 'web'],
                'email': ['email', 'email address'],
            }
        },
        {
            id: 'leads',
            name: 'Leads',
            apiEndpoint: '/api/leads',
            requiredFields: ['firstName', 'lastName'],
            fieldMappings: {
                'firstName': ['first name', 'firstname', 'fname', 'given name'],
                'lastName': ['last name', 'lastname', 'lname', 'surname', 'family name'],
                'email': ['email', 'email address', 'e-mail'],
                'phone': ['phone', 'telephone', 'phone number'],
                'status': ['status'],
                'title': ['title', 'job title', 'position'],
                'organizationId': ['organization', 'organization id', 'org id', 'company'],
            }
        },
        {
            id: 'job-seekers',
            name: 'Job Seekers',
            apiEndpoint: '/api/job-seekers',
            requiredFields: ['firstName', 'lastName'],
            fieldMappings: {
                'firstName': ['first name', 'firstname', 'fname', 'given name'],
                'lastName': ['last name', 'lastname', 'lname', 'surname', 'family name'],
                'email': ['email', 'email address', 'e-mail'],
                'phone': ['phone', 'telephone', 'phone number'],
                'status': ['status'],
                'title': ['title', 'job title', 'position'],
            }
        },
        {
            id: 'jobs',
            name: 'Jobs',
            apiEndpoint: '/api/jobs',
            requiredFields: ['jobTitle'],
            fieldMappings: {
                'jobTitle': ['job title', 'title', 'position', 'role'],
                'category': ['category', 'job category', 'type'],
                'status': ['status'],
                'organizationId': ['organization', 'organization id', 'org id', 'company'],
            }
        },
    ];

    // Handle module selection (single select)
    const handleModuleSelect = (moduleId: string) => {
        setSelectedModule(moduleId);
        setSelectedFields([]); // Reset field selection when module changes
        setStatusFilter(''); // Reset status filter when module changes
        setStatusOptions([]); // Reset status options
    };

    // Flatten nested objects and arrays for CSV/Excel export
    const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
        const flattened: Record<string, any> = {};
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}_${key}` : key;
                const value = obj[key];
                
                if (value === null || value === undefined) {
                    flattened[newKey] = '';
                } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                    // Recursively flatten nested objects
                    Object.assign(flattened, flattenObject(value, newKey));
                } else if (Array.isArray(value)) {
                    // Convert arrays to comma-separated strings
                    flattened[newKey] = value.map(item => 
                        typeof item === 'object' ? JSON.stringify(item) : String(item)
                    ).join('; ');
                } else if (value instanceof Date) {
                    flattened[newKey] = value.toISOString();
                } else {
                    flattened[newKey] = String(value);
                }
            }
        }
        
        return flattened;
    };

    // Get standard fields for each module
    const getStandardFields = (moduleId: string): CustomFieldDefinition[] => {
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
                { id: 'std_title', field_name: 'job_title', field_label: 'Job Title', field_type: 'text', is_required: true, is_hidden: false, sort_order: 1 },
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
            'tasks': [
                { id: 'std_title', field_name: 'title', field_label: 'Title', field_type: 'text', is_required: true, is_hidden: false, sort_order: 1 },
                { id: 'std_status', field_name: 'status', field_label: 'Status', field_type: 'text', is_required: false, is_hidden: false, sort_order: 2 },
                { id: 'std_priority', field_name: 'priority', field_label: 'Priority', field_type: 'text', is_required: false, is_hidden: false, sort_order: 3 },
            ],
        };

        return standardFieldsMap[moduleId] || [];
    };

    // Get field order and labels from Field Management (includes standard fields)
    const getFieldConfig = (moduleId: string): { fields: string[]; labels: Record<string, string> } => {
        const customConfig = moduleFieldConfigs[moduleId] || [];
        const standardFields = getStandardFields(moduleId);
        
        // Combine standard and custom fields
        const allFields: CustomFieldDefinition[] = [...standardFields];
        const standardFieldNames = new Set(standardFields.map(f => f.field_name));
        
        // Add custom fields that aren't already in standard fields
        customConfig.forEach((field: CustomFieldDefinition) => {
            if (!standardFieldNames.has(field.field_name)) {
                allFields.push(field);
            }
        });
        
        // Sort by sort_order
        allFields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        const fields: string[] = [];
        const labels: Record<string, string> = {};

        allFields.forEach((field: CustomFieldDefinition) => {
            fields.push(field.field_name);
            labels[field.field_name] = field.field_label;
        });

        return { fields, labels };
    };

    // Get all available fields for the selected module
    const getAvailableFields = (): CustomFieldDefinition[] => {
        if (!selectedModule) return [];
        const customConfig = moduleFieldConfigs[selectedModule] || [];
        const standardFields = getStandardFields(selectedModule);
        
        const allFields: CustomFieldDefinition[] = [...standardFields];
        const standardFieldNames = new Set(standardFields.map(f => f.field_name));
        
        customConfig.forEach((field: CustomFieldDefinition) => {
            if (!standardFieldNames.has(field.field_name)) {
                allFields.push(field);
            }
        });
        
        return allFields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    };

    // Handle field selection
    const toggleField = (fieldName: string) => {
        setSelectedFields(prev =>
            prev.includes(fieldName)
                ? prev.filter(f => f !== fieldName)
                : [...prev, fieldName]
        );
    };

    // Select all fields
    const selectAllFields = () => {
        const fields = getAvailableFields();
        setSelectedFields(fields.map(f => f.field_name));
    };

    // Deselect all fields
    const deselectAllFields = () => {
        setSelectedFields([]);
    };

    // Convert data to CSV format with Field Management integration
    const convertToCSV = (data: any[], moduleId: string, moduleName: string, fieldsToInclude?: string[]): string => {
        if (data.length === 0) return '';
        
        // Flatten all objects
        const flattenedData = data.map(item => flattenObject(item));
        
        // Get field configuration
        const { labels } = getFieldConfig(moduleId);
        
        // Use selected fields if provided, otherwise use all fields
        const headers = fieldsToInclude && fieldsToInclude.length > 0 
            ? fieldsToInclude.filter(field => {
                // Verify field exists in at least one data item
                return flattenedData.some(item => item.hasOwnProperty(field));
            })
            : Object.keys(flattenedData[0] || {});
        
        // Create CSV rows with proper escaping and use field labels
        const csvRows = [
            headers.map(h => {
                const label = labels[h] || h;
                return `"${label.replace(/"/g, '""')}"`;
            }).join(','),
            ...flattenedData.map(row =>
                headers.map(header => {
                    const value = row[header] || '';
                    // Convert to string and escape quotes
                    const stringValue = String(value).replace(/"/g, '""');
                    // Always wrap in quotes for consistency and to handle special characters
                    return `"${stringValue}"`;
                }).join(',')
            )
        ];
        
        return csvRows.join('\n');
    };

    // Download CSV file
    const downloadCSV = (csvContent: string, filename: string) => {
        // Use UTF-8 BOM for Excel compatibility when opening CSV files
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Download Excel file with multiple sheets
    const downloadExcel = async (dataByModule: Record<string, any[]>, moduleNames: Record<string, string>, fieldsToInclude?: string[]) => {
        try {
            // Dynamic import of xlsx library
            // @ts-ignore - xlsx is an optional dependency
            const XLSX = await import('xlsx');
            const workbook = XLSX.utils.book_new();

            // Create a sheet for each module
            Object.entries(dataByModule).forEach(([moduleId, data]) => {
                if (data.length === 0) return;

                const moduleName = moduleNames[moduleId] || moduleId;
                const { labels } = getFieldConfig(moduleId);
                
                // Flatten data
                const flattenedData = data.map(item => flattenObject(item));
                
                // Use selected fields if provided, otherwise use all fields
                const headers = fieldsToInclude && fieldsToInclude.length > 0
                    ? fieldsToInclude.filter(field => flattenedData.some(item => item.hasOwnProperty(field)))
                    : Object.keys(flattenedData[0] || {});
                
                // Build header labels
                const headerLabels = headers.map(field => labels[field] || field);
                
                // Create worksheet data with labels as headers
                const worksheetData = [
                    headerLabels,
                    ...flattenedData.map(row =>
                        headers.map(header => row[header] || '')
                    )
                ];
                
                const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
                
                // Set column widths
                const colWidths = headers.map(() => ({ wch: 15 }));
                worksheet['!cols'] = colWidths;
                
                // Add sheet to workbook (limit sheet name to 31 characters for Excel)
                const sheetName = moduleName.substring(0, 31);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            });

            // Generate Excel file
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            
            const filename = `Export_${new Date().toISOString().split('T')[0]}.xlsx`;
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error creating Excel file:', error);
            // Fallback to CSV if xlsx library is not available
            toast.error('Excel export requires xlsx library. Please install it: npm install xlsx');
            // Fallback to individual CSV downloads
            const timestamp = new Date().toISOString().split('T')[0];
            Object.entries(dataByModule).forEach(([moduleId, data]) => {
                if (data.length === 0) return;
                const moduleName = moduleNames[moduleId] || moduleId;
                const csvContent = convertToCSV(data, moduleId, moduleName);
                downloadCSV(csvContent, `${moduleName}_${timestamp}.csv`);
            });
        }
    };

    // Download multiple CSV files as ZIP
    const downloadCSVZip = async (dataByModule: Record<string, any[]>, moduleNames: Record<string, string>) => {
        try {
            // Dynamic import of JSZip
            // @ts-ignore - jszip is an optional dependency
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            const timestamp = new Date().toISOString().split('T')[0];

            Object.entries(dataByModule).forEach(([moduleId, data]) => {
                if (data.length === 0) return;
                const moduleName = moduleNames[moduleId] || moduleId;
                const csvContent = convertToCSV(data, moduleId, moduleName);
                const filename = `${moduleName}_${timestamp}.csv`;
                zip.file(filename, csvContent);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(zipBlob);
            link.setAttribute('href', url);
            link.setAttribute('download', `Export_${timestamp}.zip`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error creating ZIP file:', error);
            // Fallback to individual CSV downloads
            toast.info('ZIP export requires jszip library. Downloading individual CSV files instead.');
            const timestamp = new Date().toISOString().split('T')[0];
            Object.entries(dataByModule).forEach(([moduleId, data]) => {
                if (data.length === 0) return;
                const moduleName = moduleNames[moduleId] || moduleId;
                const csvContent = convertToCSV(data, moduleId, moduleName);
                downloadCSV(csvContent, `${moduleName}_${timestamp}.csv`);
            });
        }
    };

    // Fetch data for a module
    const fetchModuleData = async (module: DownloadModule): Promise<any[]> => {
        try {
            const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
            
            const response = await fetch(module.apiEndpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${module.name}`);
            }

            const data = await response.json();
            // Try multiple possible data keys
            let moduleData = data[module.dataKey] || 
                           data.data || 
                           data[module.dataKey.toLowerCase()] ||
                           (Array.isArray(data) ? data : []);

            // Apply filters
            if (dateRange.start || dateRange.end) {
                moduleData = moduleData.filter((item: any) => {
                    const itemDate = item.created_at || item.date_added || item.created_date;
                    if (!itemDate) return true;
                    
                    const itemDateObj = new Date(itemDate);
                    const startDate = dateRange.start ? new Date(dateRange.start) : null;
                    const endDate = dateRange.end ? new Date(dateRange.end) : null;
                    
                    if (startDate && itemDateObj < startDate) return false;
                    if (endDate && itemDateObj > endDate) return false;
                    return true;
                });
            }

            if (statusFilter) {
                moduleData = moduleData.filter((item: any) => {
                    const itemStatus = item.status || item.Status || '';
                    return String(itemStatus).toLowerCase().includes(statusFilter.toLowerCase());
                });
            }

            return moduleData;
        } catch (error) {
            console.error(`Error fetching ${module.name}:`, error);
            return [];
        }
    };

    // Parse CSV file
    const parseCSV = (csvText: string): string[][] => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;
        
        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentField += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (currentField || currentRow.length > 0) {
                    currentRow.push(currentField.trim());
                    rows.push(currentRow);
                    currentRow = [];
                    currentField = '';
                }
                if (char === '\r' && nextChar === '\n') {
                    i++; // Skip \n after \r
                }
            } else {
                currentField += char;
            }
        }
        
        // Add last field and row
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            rows.push(currentRow);
        }
        
        return rows;
    };

    // Handle file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            toast.error('Please select a CSV file.');
            return;
        }

        setUploadFile(file);

        try {
            const text = await file.text();
            const rows = parseCSV(text);
            
            if (rows.length === 0) {
                toast.error('CSV file is empty.');
                return;
            }

            // First row is headers
            const headers = rows[0].map(h => h.trim());
            setCsvHeaders(headers);

            // Parse data rows
            const dataRows: ParsedRow[] = rows.slice(1).map((row, index) => {
                const raw: Record<string, string> = {};
                headers.forEach((header, colIndex) => {
                    raw[header] = row[colIndex] || '';
                });
                return {
                    raw,
                    mapped: {},
                    errors: [],
                    rowNumber: index + 2 // +2 because index is 0-based and we skip header row
                };
            });

            setParsedData(dataRows);
            
            // Auto-map fields based on module's field mappings
            if (selectedUploadModule) {
                const module = uploadModules.find(m => m.id === selectedUploadModule);
                if (module) {
                    const autoMappings: Record<string, string> = {};
                    headers.forEach(header => {
                        const lowerHeader = header.toLowerCase().trim();
                        for (const [systemField, csvVariants] of Object.entries(module.fieldMappings)) {
                            if (csvVariants.some(variant => lowerHeader === variant.toLowerCase())) {
                                autoMappings[header] = systemField;
                                break;
                            }
                        }
                    });
                    setFieldMappings(autoMappings);
                }
            }

            setCurrentStep('map');
        } catch (error) {
            console.error('Error parsing CSV:', error);
            toast.error('Error reading CSV file. Please check the file format.');
        }
    };

    // Validate parsed data
    const validateData = (): ValidationResult => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!selectedUploadModule) {
            errors.push('Please select a module.');
            return { isValid: false, errors, warnings };
        }

        const module = uploadModules.find(m => m.id === selectedUploadModule);
        if (!module) {
            errors.push('Invalid module selected.');
            return { isValid: false, errors, warnings };
        }

        // Check if required fields are mapped
        const mappedFields = Object.values(fieldMappings);
        const missingRequired = module.requiredFields.filter(req => !mappedFields.includes(req));
        if (missingRequired.length > 0) {
            errors.push(`Required fields not mapped: ${missingRequired.join(', ')}`);
        }

        // Validate each row
        parsedData.forEach((row, index) => {
            const rowErrors: string[] = [];
            
            module.requiredFields.forEach(reqField => {
                const csvHeader = Object.keys(fieldMappings).find(h => fieldMappings[h] === reqField);
                if (csvHeader) {
                    const value = row.raw[csvHeader];
                    if (!value || value.trim() === '') {
                        rowErrors.push(`Row ${row.rowNumber}: Missing required field "${reqField}"`);
                    }
                }
            });

            // Validate email format if email field exists
            const emailField = Object.keys(fieldMappings).find(h => 
                fieldMappings[h] === 'email' || fieldMappings[h] === 'Email'
            );
            if (emailField && row.raw[emailField]) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(row.raw[emailField])) {
                    warnings.push(`Row ${row.rowNumber}: Invalid email format`);
                }
            }

            row.errors = rowErrors;
            if (rowErrors.length > 0) {
                errors.push(...rowErrors);
            }
        });

        setValidationErrors(errors);
        return { isValid: errors.length === 0, errors, warnings };
    };

    // Map CSV data to system format
    const mapDataToSystemFormat = (): ParsedRow[] => {
        return parsedData.map(row => {
            const mapped: Record<string, any> = {};
            
            Object.entries(fieldMappings).forEach(([csvHeader, systemField]) => {
                const value = row.raw[csvHeader];
                if (value !== undefined && value !== '') {
                    mapped[systemField] = value.trim();
                }
            });

            return { ...row, mapped };
        });
    };

    // Handle upload
    const handleUpload = async () => {
        const validation = validateData();
        if (!validation.isValid) {
            toast.error(`Please fix validation errors:\n${validation.errors.slice(0, 5).join('\n')}`);
            return;
        }

        setIsUploading(true);
        setUploadProgress({ current: 0, total: parsedData.length });
        setUploadResults(null);

        const mappedData = mapDataToSystemFormat();
        const module = uploadModules.find(m => m.id === selectedUploadModule);
        if (!module) {
            toast.error('Invalid module selected.');
            setIsUploading(false);
            return;
        }

        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        try {
            // Upload records one by one (or in batches)
            for (let i = 0; i < mappedData.length; i++) {
                const row = mappedData[i];
                
                // Skip rows with errors
                if (row.errors.length > 0) {
                    failedCount++;
                    errors.push(`Row ${row.rowNumber}: ${row.errors.join(', ')}`);
                    setUploadProgress({ current: i + 1, total: mappedData.length });
                    continue;
                }

                try {
                    const response = await fetch(module.apiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify(row.mapped),
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                        failedCount++;
                        errors.push(`Row ${row.rowNumber}: ${errorData.message || 'Upload failed'}`);
                    }
                } catch (error) {
                    failedCount++;
                    errors.push(`Row ${row.rowNumber}: ${error instanceof Error ? error.message : 'Network error'}`);
                }

                setUploadProgress({ current: i + 1, total: mappedData.length });
            }

            setUploadResults({
                success: successCount,
                failed: failedCount,
                errors: errors.slice(0, 20) // Limit to first 20 errors
            });
            setCurrentStep('upload');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('An error occurred during upload. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    // Reset upload state
    const resetUpload = () => {
        setUploadFile(null);
        setCsvHeaders([]);
        setParsedData([]);
        setFieldMappings({});
        setUploadProgress({ current: 0, total: 0 });
        setUploadResults(null);
        setValidationErrors([]);
        setCurrentStep('select');
    };

    // Handle export with backend API and Field Management integration
    const handleExport = async () => {
        if (!selectedModule) {
            toast.error('Please select a module to export.');
            return;
        }

        if (selectedFields.length === 0) {
            toast.error('Please select at least one field to export.');
            return;
        }

        setIsExporting(true);
        setExportProgress({ current: 0, total: 1, module: selectedModule });

        try {
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );

            const module = downloadModules.find(m => m.id === selectedModule);
            const moduleName = module?.name || selectedModule;

            // Call backend export API with filters and selected fields
            const response = await fetch('/api/admin/data-downloader/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    module: selectedModule,
                    selectedFields: selectedFields,
                    filters: {
                        startDate: dateRange.start || null,
                        endDate: dateRange.end || null,
                        status: statusFilter || null,
                    },
                    format: exportFormat,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Export failed' }));
                throw new Error(errorData.message || 'Failed to export data');
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Export failed');
            }

            const data = result.data || [];
            const moduleNames: Record<string, string> = { [selectedModule]: moduleName };

            // Export based on format
            if (exportFormat === 'excel') {
                try {
                    await downloadExcel({ [selectedModule]: data }, moduleNames, selectedFields);
                } catch (error) {
                    // Error already handled in downloadExcel with fallback
                }
            } else {
                // CSV: single file export
                if (data.length > 0) {
                    const csvContent = convertToCSV(data, selectedModule, moduleName, selectedFields);
                    const timestamp = new Date().toISOString().split('T')[0];
                    downloadCSV(csvContent, `${moduleName}_${timestamp}.csv`);
                }
            }

            toast.success(`Successfully exported ${moduleName}!`);
            setShowDownloadModal(false);
        } catch (error) {
            console.error('Export error:', error);
            toast.error(error instanceof Error ? error.message : 'An error occurred during export. Please try again.');
        } finally {
            setIsExporting(false);
            setExportProgress({ current: 0, total: 0, module: '' });
        }
    };

    const adminModules: AdminModule[] = [
        {
            id: 'field-management',
            name: 'Field Management',
            icon: <FaRegFolderOpen size={50} color="white" />,
            path: '/dashboard/admin/field-management'
        },
        {
            id: 'data-uploader',
            name: 'Data Uploader',
            icon: <MdDriveFolderUpload size={50} color="white" />,
            path: '/dashboard/admin/data-uploader'
        },
        {
            id: 'downloader',
            name: 'Downloader',
            icon: <RiFolderDownloadLine size={50} color="white" />,
            path: '/dashboard/admin/downloader'
        },
        {
            id: 'data-scraper',
            name: 'Data Scraper',
            icon: <FiArrowRight size={50} color="white" />,
            path: '/dashboard/admin/data-scraper'
        },
        {
            id: 'api-management',
            name: 'API management',
            icon: <FiCode size={50} color="white" />,
            path: '/dashboard/admin/api-management'
        },
        {
            id: 'document-management',
            name: 'Document Management',
            icon: <IoDocumentOutline size={50} color="white" />,
            path: '/dashboard/admin/document-management'
        },
        {
            id: 'user-management',
            name: 'User Management',
            icon: <TfiUser size={50} color="white" />,
            path: '/dashboard/admin/user-management'
        },
        {
            id: 'the-button',
            name: 'The Button',
            icon: <FaRegArrowAltCircleRight size={50} color="white" />,
            path: '/dashboard/admin/the-button'
        },
         {
        id: 'email-management',
        name: 'Email Management',
        icon: <FiMail size={50} color="white" />,
        path: '/dashboard/admin/email-management'
    },
        {
            id: 'activity-tracker',
            name: 'Activity Tracker',
            icon: <FiActivity size={50} color="white" />,
            path: '/dashboard/admin/activity-tracker'
        }
    ];

    const handleModuleClick = (moduleId: string, path: string) => {
        // If it's the downloader module, open export modal instead of navigating
        if (moduleId === 'downloader') {
            setShowDownloadModal(true);
        } else {
            router.push(path);
        }
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            {/* Header with Upload Button */}
            <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Admin Center</h1>
                {/* Removed */}
                {/* <button
                    onClick={() => {
                        resetUpload();
                        setShowUploadModal(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
                >
                    <FiUpload size={20} />
                    <span>Upload CSV</span>
                </button> */}
            </div>

            <div className="grid grid-cols-4 gap-8 max-w-5xl mx-auto">
                {adminModules.map((module) => (
                    <div
                        key={module.id}
                        className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleModuleClick(module.id, module.path)}
                    >
                        {/* Module Icon - Black square with white icon */}
                        <div className="w-28 h-28 bg-black flex items-center justify-center mb-3 rounded-sm">
                            {module.icon}
                        </div>

                        {/* Module Name */}
                        <span className="text-base text-center text-black leading-tight">
                            {module.name}
                        </span>
                    </div>
                ))}
            </div>

            {/* Download Modal */}
            {showDownloadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center sticky top-0">
                            <h2 className="text-xl font-semibold text-gray-800">Export System Data</h2>
                            <button
                                onClick={() => setShowDownloadModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <FiX size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Module Selection - Single Select */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-3 block">
                                    Select Module to Export <span className="text-red-500">*</span>
                                </label>
                                <div className="border border-gray-200 rounded p-4">
                                    <div className="space-y-2">
                                        {downloadModules.map((module) => (
                                            <label
                                                key={module.id}
                                                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="radio"
                                                    name="moduleSelection"
                                                    value={module.id}
                                                    checked={selectedModule === module.id}
                                                    onChange={() => handleModuleSelect(module.id)}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">{module.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {!selectedModule && (
                                    <p className="mt-2 text-xs text-red-500">Please select a module to continue</p>
                                )}
                                {isLoadingFields && selectedModule && (
                                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                        Loading field configurations...
                                    </div>
                                )}
                            </div>

                            {/* Field Selection */}
                            {selectedModule && !isLoadingFields && (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-sm font-medium text-gray-700">
                                            Select Fields to Export <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={selectAllFields}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-gray-400">|</span>
                                            <button
                                                onClick={deselectAllFields}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>
                                    <div className="border border-gray-200 rounded p-4 max-h-64 overflow-y-auto">
                                        {getAvailableFields().length > 0 ? (
                                            <div className="space-y-2">
                                                {getAvailableFields().map((field) => (
                                                    <label
                                                        key={field.field_name}
                                                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedFields.includes(field.field_name)}
                                                            onChange={() => toggleField(field.field_name)}
                                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-700">{field.field_label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 text-center py-4">No fields available</p>
                                        )}
                                    </div>
                                    {selectedFields.length === 0 && (
                                        <p className="mt-2 text-xs text-red-500">Please select at least one field to export</p>
                                    )}
                                </div>
                            )}

                            {/* Export Format */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Export Format
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="csv"
                                            checked={exportFormat === 'csv'}
                                            onChange={(e) => setExportFormat(e.target.value as 'csv')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">CSV</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="excel"
                                            checked={exportFormat === 'excel'}
                                            onChange={(e) => setExportFormat(e.target.value as 'excel')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Excel</span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Single file export.</p>
                            </div>

                            {/* Filters */}
                            <div className="space-y-4 border-t pt-4">
                                <h3 className="text-sm font-medium text-gray-700">Optional Filters</h3>
                                
                                {/* Date Range */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            value={dateRange.start}
                                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            value={dateRange.end}
                                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Status Filter - Dynamic Dropdown */}
                                {selectedModule && (
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">
                                            Status Filter (optional)
                                        </label>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={statusOptions.length === 0}
                                        >
                                            <option value="">All Statuses</option>
                                            {statusOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        {statusOptions.length === 0 && !isLoadingFields && (
                                            <p className="mt-1 text-xs text-gray-500">No status options available</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Export Progress */}
                        {isExporting && exportProgress.total > 0 && (
                            <div className="px-6 pb-4">
                                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-blue-700">
                                            Exporting {exportProgress.module || 'data'}...
                                        </span>
                                        <span className="text-sm text-blue-600">
                                            {exportProgress.current} / {exportProgress.total} modules
                                        </span>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div className="bg-gray-50 p-4 border-t flex justify-end gap-3 sticky bottom-0">
                            <button
                                onClick={() => {
                                    setShowDownloadModal(false);
                                    setSelectedModule('');
                                    setSelectedFields([]);
                                    setDateRange({ start: '', end: '' });
                                    setStatusFilter('');
                                    setStatusOptions([]);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                                disabled={isExporting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={isExporting || !selectedModule || selectedFields.length === 0 || isLoadingFields}
                                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isExporting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Exporting...</span>
                                    </>
                                ) : (
                                    <>
                                        <FiDownload size={16} />
                                        <span>Export</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center sticky top-0">
                            <h2 className="text-xl font-semibold text-gray-800">Upload CSV Data</h2>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    resetUpload();
                                }}
                                className="text-gray-500 hover:text-gray-700"
                                disabled={isUploading}
                            >
                                <FiX size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Step 1: Select Module and File */}
                            {currentStep === 'select' && (
                                <>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                                            Select Module <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={selectedUploadModule}
                                            onChange={(e) => setSelectedUploadModule(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">-- Select Module --</option>
                                            {uploadModules.map(module => (
                                                <option key={module.id} value={module.id}>
                                                    {module.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                                            Select CSV File <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={handleFileSelect}
                                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={!selectedUploadModule}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Accepted format: CSV files only
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Step 2: Map Fields */}
                            {currentStep === 'map' && csvHeaders.length > 0 && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                                            Map CSV Columns to System Fields
                                        </h3>
                                        <div className="border border-gray-200 rounded p-4 max-h-96 overflow-y-auto">
                                            {csvHeaders.map(header => {
                                                const module = uploadModules.find(m => m.id === selectedUploadModule);
                                                const systemFields = module ? Object.keys(module.fieldMappings) : [];
                                                
                                                return (
                                                    <div key={header} className="flex items-center gap-4 mb-3 pb-3 border-b last:border-b-0">
                                                        <div className="w-48 text-sm text-gray-700 font-medium">
                                                            {header}
                                                        </div>
                                                        <div className="flex-1">
                                                            <select
                                                                value={fieldMappings[header] || ''}
                                                                onChange={(e) => {
                                                                    const newMappings = { ...fieldMappings };
                                                                    if (e.target.value) {
                                                                        newMappings[header] = e.target.value;
                                                                    } else {
                                                                        delete newMappings[header];
                                                                    }
                                                                    setFieldMappings(newMappings);
                                                                }}
                                                                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            >
                                                                <option value="">-- Skip --</option>
                                                                {systemFields.map(field => (
                                                                    <option key={field} value={field}>
                                                                        {field}
                                                                        {module?.requiredFields.includes(field) && ' *'}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {validationErrors.length > 0 && (
                                        <div className="bg-red-50 border border-red-200 rounded p-4">
                                            <div className="flex items-center gap-2 text-red-700 mb-2">
                                                <FiAlertCircle size={20} />
                                                <span className="font-medium">Validation Errors</span>
                                            </div>
                                            <ul className="list-disc list-inside text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                                                {validationErrors.slice(0, 10).map((error, index) => (
                                                    <li key={index}>{error}</li>
                                                ))}
                                                {validationErrors.length > 10 && (
                                                    <li>... and {validationErrors.length - 10} more errors</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                const validation = validateData();
                                                if (validation.isValid) {
                                                    setCurrentStep('preview');
                                                } else {
                                                    toast.error(`Please fix validation errors:\n${validation.errors.slice(0, 5).join('\n')}`);
                                                }
                                            }}
                                            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                            Preview Data
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Step 3: Preview */}
                            {currentStep === 'preview' && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                                            Preview Data ({parsedData.length} rows)
                                        </h3>
                                        <div className="border border-gray-200 rounded overflow-x-auto max-h-96 overflow-y-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-2 text-left border-b">Row</th>
                                                        {Object.keys(fieldMappings).map(header => (
                                                            <th key={header} className="p-2 text-left border-b">
                                                                {fieldMappings[header]}
                                                            </th>
                                                        ))}
                                                        <th className="p-2 text-left border-b">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {parsedData.slice(0, 10).map((row, index) => {
                                                        const mapped = mapDataToSystemFormat()[index];
                                                        const hasErrors = row.errors.length > 0;
                                                        
                                                        return (
                                                            <tr key={index} className={hasErrors ? 'bg-red-50' : ''}>
                                                                <td className="p-2 border-b">{row.rowNumber}</td>
                                                                {Object.keys(fieldMappings).map(header => (
                                                                    <td key={header} className="p-2 border-b">
                                                                        {row.raw[header] || '-'}
                                                                    </td>
                                                                ))}
                                                                <td className="p-2 border-b">
                                                                    {hasErrors ? (
                                                                        <span className="text-red-600 text-xs">
                                                                            {row.errors.length} error(s)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-green-600 text-xs">✓</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            {parsedData.length > 10 && (
                                                <div className="p-2 text-xs text-gray-500 text-center">
                                                    Showing first 10 rows of {parsedData.length} total rows
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setCurrentStep('map')}
                                            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleUpload}
                                            disabled={isUploading}
                                            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    <span>Uploading...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiUpload size={16} />
                                                    <span>Upload Data</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Step 4: Upload Results */}
                            {currentStep === 'upload' && uploadResults && (
                                <>
                                    <div className="bg-gray-50 border border-gray-200 rounded p-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Complete</h3>
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-600">{uploadResults.success}</div>
                                                <div className="text-sm text-gray-600">Successful</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-red-600">{uploadResults.failed}</div>
                                                <div className="text-sm text-gray-600">Failed</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-gray-600">{parsedData.length}</div>
                                                <div className="text-sm text-gray-600">Total</div>
                                            </div>
                                        </div>

                                        {uploadResults.errors.length > 0 && (
                                            <div className="mt-4">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Errors:</h4>
                                                <div className="bg-white border border-gray-200 rounded p-3 max-h-48 overflow-y-auto">
                                                    <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                                                        {uploadResults.errors.map((error, index) => (
                                                            <li key={index}>{error}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setShowUploadModal(false);
                                                resetUpload();
                                            }}
                                            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Upload Progress */}
                            {isUploading && (
                                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-blue-700">Uploading...</span>
                                        <span className="text-sm text-blue-600">
                                            {uploadProgress.current} / {uploadProgress.total}
                                        </span>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}