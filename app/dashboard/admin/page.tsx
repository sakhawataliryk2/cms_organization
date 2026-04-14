// app/dashboard/admin/page.tsx

'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import {
    FiUpload,
    FiDownload,
    FiArrowRight,
    FiCode,
    FiFileText,
    FiChevronDown,
    FiX,
    FiMail,
    FiActivity,
    FiFilter,
    FiCheckSquare
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

interface CustomFieldDefinition {
    id: string;
    field_name: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    is_hidden: boolean;
    sort_order: number;
    lookup_type?: string | null;
}

interface ModuleFieldConfig {
    [moduleId: string]: CustomFieldDefinition[];
}

const JOB_XML_STATUS_OPTIONS = [
    { value: "", label: "Default (Active / Open only)" },
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
    { value: "inactive", label: "Inactive" },
    { value: "all", label: "All statuses" },
];

const JOB_XML_TYPE_OPTIONS = [
    { value: "", label: "All types" },
    { value: "contract", label: "Contract" },
    { value: "direct-hire", label: "Direct Hire" },
    { value: "executive-search", label: "Executive Search" },
];

export default function AdminCenter() {
    const router = useRouter();
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [selectedModule, setSelectedModule] = useState<string>(''); // Single module selection
    const [selectedFields, setSelectedFields] = useState<string[]>([]); // Selected fields for export
    const [statusOptions, setStatusOptions] = useState<{ label: string; value: string }[]>([]); // Dynamic status options
    const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
    const [isExporting, setIsExporting] = useState(false);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [statusFilter, setStatusFilter] = useState('');
    const [moduleFieldConfigs, setModuleFieldConfigs] = useState<ModuleFieldConfig>({});
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, module: '' });

    // Jobs XML modal state
    const [showJobsXmlModal, setShowJobsXmlModal] = useState(false);
    const [jobsXmlStatus, setJobsXmlStatus] = useState<string>('');
    const [jobsXmlType, setJobsXmlType] = useState<string>('');
    const [isGeneratingJobsXml, setIsGeneratingJobsXml] = useState(false);

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
                // Avoid fetching very large organization list just to build status dropdown.
                if (selectedModule === 'organizations') {
                    setStatusOptions([
                        { label: 'Active', value: 'Active' },
                        { label: 'Archived', value: 'Archived' },
                    ]);
                    setModuleFieldConfigs(configs);
                    setIsLoadingFields(false);
                    return;
                }

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

    // Get field order and labels from Field Management only (admin center non-hidden fields)
    const getFieldConfig = (moduleId: string): { fields: string[]; labels: Record<string, string> } => {
        const adminFields = moduleFieldConfigs[moduleId] || [];
        const fallback = getStandardFields(moduleId);
        const allFields = adminFields.length > 0 ? adminFields : fallback;
        const sorted = [...allFields].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const fields: string[] = [];
        const labels: Record<string, string> = {};
        sorted.forEach((field: CustomFieldDefinition) => {
            fields.push(field.field_name);
            labels[field.field_name] = field.field_label;
        });
        return { fields, labels };
    };

    // Get all available fields for the selected module (admin center non-hidden fields only)
    const getAvailableFields = (): CustomFieldDefinition[] => {
        if (!selectedModule) return [];
        const adminFields = moduleFieldConfigs[selectedModule] || [];
        const fallback = getStandardFields(selectedModule);
        const allFields = adminFields.length > 0 ? adminFields : fallback;
        return [...allFields].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
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

        // Flatten all objects (nested keys like custom_fields.Industry become accessible)
        const flattenedData = data.map(item => flattenObject(item));

        // Get field configuration (labels for headers)
        const { labels } = getFieldConfig(moduleId);

        // Use selected fields if provided (preserve order and include all selected columns)
        const headers = fieldsToInclude && fieldsToInclude.length > 0
            ? fieldsToInclude
            : Object.keys(flattenedData[0] || {});

        // Create CSV rows with proper escaping and use field labels
        const csvRows = [
            headers.map(h => {
                const label = labels[h] || h;
                return `"${label.replace(/"/g, '""')}"`;
            }).join(','),
            ...flattenedData.map(row =>
                headers.map(header => {
                    const value = row[header] ?? '';
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

            // Custom fields are stored by field_label (e.g. "Industry") but we send field_name (e.g. "Field_1").
            // Send a map so the export API can look up custom_fields[field_label].
            const availableFields = getAvailableFields();
            const fieldNameToLabel: Record<string, string> = {};
            availableFields.forEach((f: CustomFieldDefinition) => {
                if (f.field_label && f.field_label !== f.field_name) {
                    fieldNameToLabel[f.field_name] = f.field_label;
                }
            });

            const fieldDefinitions = availableFields.map((f: CustomFieldDefinition) => ({
                field_name: f.field_name,
                field_label: f.field_label,
                field_type: f.field_type,
                lookup_type: f.lookup_type ?? null,
            }));

            const response = await fetch('/api/admin/data-downloader/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    module: selectedModule,
                    selectedFields: selectedFields,
                    fieldNameToLabel: Object.keys(fieldNameToLabel).length > 0 ? fieldNameToLabel : undefined,
                    fieldDefinitions,
                    filters: {
                        startDate: dateRange.start || null,
                        endDate: dateRange.end || null,
                        status: statusFilter || null,
                    },
                    format: exportFormat,
                    debug: true,
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

            if (result.debug) {
                console.log('[Export Debug]', result.debug);
                toast.info('Debug info in console (F12 → Console). Check "Export Debug" for details.');
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
            id: 'jobs-xml',
            name: 'Jobs XML Feed',
            icon: <FiDownload size={50} color="white" />,
            path: '/dashboard/admin/jobs-xml'
        },
        {
            id: 'jobs-xml-import',
            name: 'Jobs XML Import',
            icon: <FiFileText size={50} color="white" />,
            path: '/dashboard/jobs?xmlImport=true'
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
        },
        {
            id: 'onboarding-approvals',
            name: 'Onboarding Approvals',
            icon: <FiCheckSquare size={50} color="white" />,
            path: '/dashboard/admin/onboarding-approvals'
        }
    ];

    const handleModuleClick = (moduleId: string, path: string) => {
        // If it's the downloader module, open export modal instead of navigating
        if (moduleId === 'downloader') {
            setShowDownloadModal(true);
            return;
        }
        // Open Jobs XML feed in a modal
        if (moduleId === 'jobs-xml') {
            setShowJobsXmlModal(true);
            return;
        }
        router.push(path);
    };

    const handleGenerateJobsXmlFeed = () => {
        try {
            setIsGeneratingJobsXml(true);

            const params = new URLSearchParams();
            if (jobsXmlStatus) params.set('status', jobsXmlStatus);
            if (jobsXmlType) params.set('type', jobsXmlType);

            const query = params.toString();
            const url = `/api/jobs/xml${query ? `?${query}` : ''}`;

            if (typeof window !== 'undefined') {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        } finally {
            setIsGeneratingJobsXml(false);
        }
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            {/* Header with Upload Button */}
            <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Admin Center</h1>
                <button
                    onClick={() => {
                        router.push('/dashboard/admin/data-uploader');
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
                >
                    <FiUpload size={20} />
                    <span>Data Uploader</span>
                </button>
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
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

            {/* Jobs XML Feed Modal */}
            {showJobsXmlModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
                    <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center sticky top-0">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Jobs XML Feed</h2>
                                <p className="text-xs text-gray-600 mt-1">
                                    Generate an XML feed of jobs for external job boards and integrations.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowJobsXmlModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <FiX size={22} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-2">
                                <FiFilter className="text-gray-500" />
                                <h3 className="text-sm font-medium text-gray-800">Feed Filters</h3>
                            </div>

                            <p className="text-xs text-gray-600">
                                Use these filters to control which jobs are included in the XML feed. If you leave a filter
                                empty, the default behavior will be used.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Job Status
                                    </label>
                                    <select
                                        value={jobsXmlStatus}
                                        onChange={(e) => setJobsXmlStatus(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {JOB_XML_STATUS_OPTIONS.map((opt) => (
                                            <option key={opt.value || 'default'} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Default: only jobs marked as active/open are included.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Job Type
                                    </label>
                                    <select
                                        value={jobsXmlType}
                                        onChange={(e) => setJobsXmlType(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {JOB_XML_TYPE_OPTIONS.map((opt) => (
                                            <option key={opt.value || 'all-types'} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Filter by internal job type if you use categories like Contract, Direct Hire, etc.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-gray-50 p-4 border-t flex justify-end gap-3 sticky bottom-0">
                            <button
                                onClick={() => setShowJobsXmlModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                                disabled={isGeneratingJobsXml}
                            >
                                Close
                            </button>
                            <button
                                onClick={handleGenerateJobsXmlFeed}
                                disabled={isGeneratingJobsXml}
                                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FiDownload size={16} />
                                <span>{isGeneratingJobsXml ? 'Generating...' : 'Export XML Feed'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
