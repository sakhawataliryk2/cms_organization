// app/dashboard/admin/page.tsx

'use client'

import { useState, useEffect, useRef } from 'react';
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
import FileUpload from '@/components/FileUpload';


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
    // Upload: dynamic fields from Field Management (so mapping matches current system)
    const [uploadModuleFields, setUploadModuleFields] = useState<CustomFieldDefinition[]>([]);
    const [isLoadingUploadFields, setIsLoadingUploadFields] = useState(false);
    const [uploadUpdateExisting, setUploadUpdateExisting] = useState(true);
    const [isDraggingCsv, setIsDraggingCsv] = useState(false);
    const [isParsingCsv, setIsParsingCsv] = useState(false);
    const [parseProgress, setParseProgress] = useState(0);
    const csvFileInputRef = useRef<HTMLInputElement>(null);

    // Convert APYHub/SharpAPI resume parse result to one row with label-style keys for job-seeker auto-mapping
    const resumeResultToRow = (result: Record<string, any>): Record<string, string> => {
        const nameParts = (result.candidate_name || '').trim().split(/\s+/);
        const firstName = nameParts[0] ?? '';
        const lastName = nameParts.slice(1).join(' ') ?? '';
        const positions = Array.isArray(result.positions) ? result.positions : [];
        const primary = positions[0] || {};
        const skillsArr = primary.skills ?? result.skills ?? [];
        const skills = Array.isArray(skillsArr) ? skillsArr.join(', ') : String(skillsArr || '');
        const edu = Array.isArray(result.education_qualifications) ? result.education_qualifications : [];
        const eduText = edu.map((e: any) => [e.school_name, e.degree_type, e.specialization_subjects].filter(Boolean).join(' – ')).join('; ');
        const jobDetails = positions.map((p: any) => (p.job_details || `${p.position_name || ''} at ${p.company_name || ''}`).trim()).filter(Boolean).join('\n');
        const resumeText = [jobDetails, eduText].filter(Boolean).join('\n\n') || '';
        return {
            'First Name': firstName,
            'Last Name': lastName,
            'Email': (result.candidate_email ?? '').trim(),
            'Phone': (result.candidate_phone ?? '').trim(),
            'Address': (result.candidate_address ?? '').trim(),
            'Title': (primary.position_name ?? '').trim(),
            'Current Organization': (primary.company_name ?? '').trim(),
            'Skills': skills.trim(),
            'Resume Text': resumeText.trim(),
        };
    };

    // Auto-open upload modal if ?upload=true query parameter is present
    useEffect(() => {
        const shouldOpenUpload = searchParams.get('upload') === 'true';
        if (shouldOpenUpload) {
            setSelectedUploadModule('');
            const pending = typeof window !== 'undefined' ? sessionStorage.getItem('adminParseDataPendingFile') : null;
            if (pending) {
                try {
                    const { name, base64, type, isResume } = JSON.parse(pending);
                    sessionStorage.removeItem('adminParseDataPendingFile');
                    const binary = atob(base64);
                    const arr = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
                    const blob = new Blob([arr], { type: type || 'text/csv' });
                    const file = new File([blob], name, { type: blob.type });

                    if (isResume) {
                        // Resume parsing (Job Seekers only): call APYHub via our API, then map result to one row
                        setSelectedUploadModule('job-seekers');
                        setIsParsingCsv(true);
                        setParseProgress(0);
                        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1');
                        (async () => {
                            try {
                                setParseProgress(20);
                                const form = new FormData();
                                form.append('file', file);
                                const res = await fetch('/api/admin/parse-resume', {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` },
                                    body: form,
                                });
                                const data = await res.json();
                                if (!res.ok || !data.result) {
                                    toast.error(data.message || 'Resume parsing failed.');
                                    setIsParsingCsv(false);
                                    setParseProgress(0);
                                    return;
                                }
                                setParseProgress(90);
                                const raw = resumeResultToRow(data.result);
                                const headers = Object.keys(raw);
                                setCsvHeaders(headers);
                                setParsedData([{ raw, mapped: {}, errors: [], rowNumber: 1 }]);
                                setUploadFile(file);
                                setParseProgress(100);
                                toast.success('Resume parsed. Map fields and upload to Job Seekers.');
                            } catch (e) {
                                console.error(e);
                                toast.error(e instanceof Error ? e.message : 'Resume parsing failed.');
                            } finally {
                                setIsParsingCsv(false);
                                setParseProgress(0);
                            }
                        })();
                        setShowUploadModal(true);
                        setUploadProgress({ current: 0, total: 0 });
                        setUploadResults(null);
                        setValidationErrors([]);
                        setCurrentStep('select');
                        router.replace('/dashboard/admin', { scroll: false });
                        return;
                    }

                    setIsParsingCsv(true);
                    setParseProgress(0);
                    file.text().then((text) => {
                        setParseProgress(40);
                        const rows = parseCSVLocal(text);
                        if (rows.length === 0) {
                            setIsParsingCsv(false);
                            setParseProgress(0);
                            toast.error('CSV file is empty.');
                            return;
                        }
                        const headers = rows[0].map((h: string) => h.trim());
                        setCsvHeaders(headers);
                        setParseProgress(70);
                        setParsedData(rows.slice(1).map((row: string[], index: number) => {
                            const raw: Record<string, string> = {};
                            headers.forEach((h: string, colIndex: number) => { raw[h] = row[colIndex] || ''; });
                            return { raw, mapped: {}, errors: [], rowNumber: index + 2 };
                        }));
                        setUploadFile(file);
                        setParseProgress(100);
                    }).catch(() => {
                        setIsParsingCsv(false);
                        setParseProgress(0);
                        toast.error('Error reading CSV file.');
                    }).finally(() => {
                        setIsParsingCsv(false);
                        setParseProgress(0);
                    });
                } catch {
                    sessionStorage.removeItem('adminParseDataPendingFile');
                }
            } else {
                setUploadFile(null);
                setCsvHeaders([]);
                setParsedData([]);
                setFieldMappings({});
            }
            setUploadProgress({ current: 0, total: 0 });
            setUploadResults(null);
            setValidationErrors([]);
            setCurrentStep('select');
            setShowUploadModal(true);
            router.replace('/dashboard/admin', { scroll: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // parseCSV helper available for the upload effect (defined at module level)
    const parseCSVLocal = (csvText: string): string[][] => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];
            if (char === '"') {
                if (inQuotes && nextChar === '"') { currentField += '"'; i++; } else { inQuotes = !inQuotes; }
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
                if (char === '\r' && nextChar === '\n') i++;
            } else {
                currentField += char;
            }
        }
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            rows.push(currentRow);
        }
        return rows;
    };

    // Shared auto-mapping: match CSV headers to admin center fields using field_label and field_name variants
    const runAutoMapping = (headers: string[], fields: CustomFieldDefinition[]) => {
        if (fields.length === 0 || headers.length === 0) return {};
        const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s*\*+\s*$/, '').trim();
        const usedHeaders = new Set<string>();
        const autoMappings: Record<string, string> = {};
        const getVariants = (field: CustomFieldDefinition) => {
            const label = (field.field_label ?? '') || '';
            const name = (field.field_name ?? '') || '';
            const nLabel = normalize(label);
            const nName = normalize(name.replace(/_/g, ' '));
            const nNameUnderscore = name.toLowerCase().replace(/\s+/g, '_');
            const nLabelNoSpaces = nLabel.replace(/\s+/g, '');
            const nLabelUnderscore = nLabel.replace(/\s+/g, '_');
            return [...new Set([nLabel, nName, nNameUnderscore, nLabelNoSpaces, nLabelUnderscore].filter(Boolean))];
        };
        fields.forEach((field: CustomFieldDefinition) => {
            const fieldName = field.field_name || '';
            if (!fieldName) return;
            const variants = getVariants(field);
            const match = headers.find((h: string) => {
                if (usedHeaders.has(h)) return false;
                const normalized = normalize(h);
                return variants.some(v => v === normalized || normalized === (v || '').replace(/_/g, ' '));
            });
            if (match) {
                autoMappings[fieldName] = match;
                usedHeaders.add(match);
            }
        });
        return autoMappings;
    };

    // When file is pre-loaded (from sidebar drop) and user selects module, wait for fields then auto-advance
    useEffect(() => {
        if (currentStep !== 'select' || !uploadFile || !selectedUploadModule || csvHeaders.length === 0) return;
        if (uploadModuleFields.length === 0) return; // wait for admin fields to load
        const mappings = runAutoMapping(csvHeaders, uploadModuleFields);
        setFieldMappings(mappings);
        setCurrentStep('map');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, uploadFile, selectedUploadModule, csvHeaders, uploadModuleFields]);

    // Late auto-mapping: when on map step with data but empty mappings (e.g. fields loaded after file select)
    useEffect(() => {
        if (currentStep !== 'map' || !uploadFile || csvHeaders.length === 0 || !selectedUploadModule) return;
        if (uploadModuleFields.length === 0) return;
        if (Object.keys(fieldMappings).length > 0) return; // already have mappings
        const mappings = runAutoMapping(csvHeaders, uploadModuleFields);
        setFieldMappings(mappings);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, uploadFile, csvHeaders, selectedUploadModule, uploadModuleFields]);

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

    // Fetch upload module fields from Field Management only (admin center non-hidden fields, no standard fallback)
    useEffect(() => {
        if (!showUploadModal || !selectedUploadModule) {
            setUploadModuleFields([]);
            return;
        }
        const entityType = moduleToEntityType[selectedUploadModule];
        const fetchUploadFields = async () => {
            setIsLoadingUploadFields(true);
            let allFields: CustomFieldDefinition[] = [];
            if (entityType) {
                try {
                    const token = document.cookie.replace(
                        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                        "$1"
                    );
                    const response = await fetch(`/api/admin/field-management/${entityType}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (response.ok) {
                        const data = await response.json();
                        allFields = (data.customFields || data.fields || [])
                            .filter((f: CustomFieldDefinition) => !(f.is_hidden ?? (f as any).isHidden))
                            .sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => ((a.sort_order ?? (a as any).sortOrder) || 0) - ((b.sort_order ?? (b as any).sortOrder) || 0));
                    }
                } catch (err) {
                    console.error('Error fetching upload fields:', err);
                }
            }
            setUploadModuleFields(allFields);
            setIsLoadingUploadFields(false);
        };
        fetchUploadFields();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showUploadModal, selectedUploadModule]);

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

    // Process CSV file (from input or drag-drop)
    const processCsvFile = async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            toast.error('Please select a CSV file.');
            return;
        }
        setUploadFile(file);
        setIsParsingCsv(true);
        setParseProgress(0);
        try {
            setParseProgress(15);
            const text = await file.text();
            setParseProgress(45);
            const rows = parseCSV(text);
            if (rows.length === 0) {
                setIsParsingCsv(false);
                setParseProgress(0);
                toast.error('CSV file is empty.');
                return;
            }
            const headers = rows[0].map(h => h.trim());
            setCsvHeaders(headers);
            setParseProgress(65);
            const dataRows: ParsedRow[] = rows.slice(1).map((row, index) => {
                const raw: Record<string, string> = {};
                headers.forEach((header, colIndex) => {
                    raw[header] = row[colIndex] || '';
                });
                return {
                    raw,
                    mapped: {},
                    errors: [],
                    rowNumber: index + 2
                };
            });
            setParsedData(dataRows);
            setParseProgress(90);
            if (selectedUploadModule && uploadModuleFields.length > 0) {
                setFieldMappings(runAutoMapping(headers, uploadModuleFields));
                setCurrentStep('map');
            } else {
                setFieldMappings({});
            }
            setParseProgress(100);
        } catch (error) {
            console.error('Error parsing CSV:', error);
            toast.error('Error reading CSV file. Please check the file format.');
        } finally {
            setIsParsingCsv(false);
            setParseProgress(0);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processCsvFile(file);
        e.target.value = '';
    };

    // Validate parsed data
    const validateData = (): ValidationResult => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!selectedUploadModule) {
            errors.push('Please select a module.');
            return { isValid: false, errors, warnings };
        }

        // Required fields: use only admin center non-hidden fields (no standard fallback)
        const requiredFields = uploadModuleFields
            .filter(f => f.is_required ?? (f as any).isRequired)
            .map(f => f.field_name ?? (f as any).fieldName);
        // fieldMappings is systemField -> csvHeader
        const missingRequired = requiredFields.filter(req => !fieldMappings[req] || fieldMappings[req].trim() === '');
        if (missingRequired.length > 0) {
            const labels = missingRequired.map(r => uploadModuleFields.find(f => f.field_name === r)?.field_label ?? r);
            errors.push(`Required fields not mapped: ${labels.join(', ')}`);
        }

        // Validate each row
        parsedData.forEach((row, index) => {
            const rowErrors: string[] = [];

            requiredFields.forEach(reqField => {
                const csvHeader = fieldMappings[reqField];
                if (csvHeader) {
                    const value = row.raw[csvHeader];
                    if (!value || value.trim() === '') {
                        const label = uploadModuleFields.find(f => f.field_name === reqField)?.field_label ?? reqField;
                        rowErrors.push(`Row ${row.rowNumber}: Missing required field "${label}"`);
                    }
                }
            });

            // Validate email format if email field exists
            const emailCsvHeader = fieldMappings['email'];
            if (emailCsvHeader && row.raw[emailCsvHeader]) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(row.raw[emailCsvHeader])) {
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

    // Map CSV data to system format (fieldMappings: systemField -> csvHeader)
    const mapDataToSystemFormat = (): ParsedRow[] => {
        return parsedData.map(row => {
            const mapped: Record<string, any> = {};
            Object.entries(fieldMappings).forEach(([systemField, csvHeader]) => {
                if (!csvHeader) return;
                const value = row.raw[csvHeader];
                if (value !== undefined && value !== '') {
                    mapped[systemField] = value.trim();
                }
            });
            return { ...row, mapped };
        });
    };

    // Handle upload: use data-uploader import API so records are created/updated in main system
    const handleUpload = async () => {
        const validation = validateData();
        if (!validation.isValid) {
            toast.error(`Please fix validation errors:\n${validation.errors.slice(0, 5).join('\n')}`);
            return;
        }

        const mappedData = mapDataToSystemFormat();
        const module = uploadModules.find(m => m.id === selectedUploadModule);
        if (!module) {
            toast.error('Invalid module selected.');
            return;
        }

        const recordsToSend = mappedData
            .filter(row => row.errors.length === 0)
            .map(row => row.mapped);

        if (recordsToSend.length === 0) {
            toast.error('No valid rows to upload.');
            return;
        }

        setIsUploading(true);
        setUploadProgress({ current: 0, total: recordsToSend.length });
        setUploadResults(null);

        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

        // Map field_name -> field_label so import API stores custom fields by field_label (not field_name)
        const fieldNameToLabel: Record<string, string> = {};
        uploadModuleFields.forEach((f: CustomFieldDefinition) => {
            if (f.field_name && f.field_label) fieldNameToLabel[f.field_name] = f.field_label;
        });

        try {
            const response = await fetch('/api/admin/data-uploader/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    entityType: selectedUploadModule,
                    records: recordsToSend,
                    fieldNameToLabel: Object.keys(fieldNameToLabel).length > 0 ? fieldNameToLabel : undefined,
                    options: {
                        updateExisting: uploadUpdateExisting,
                        skipDuplicates: false,
                        importNewOnly: false,
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error(data.message || 'Import failed');
                setIsUploading(false);
                return;
            }

            const summary = data.summary || { successful: 0, failed: 0, errors: [] };
            const errorsList = Array.isArray(summary.errors)
                ? summary.errors.flatMap((e: { row?: number; errors?: string[] }) =>
                    (e.errors || []).map((err: string) => (e.row ? `Row ${e.row}: ${err}` : err))
                )
                : [];
            setUploadResults({
                success: summary.successful ?? 0,
                failed: summary.failed ?? 0,
                errors: errorsList.slice(0, 20),
            });
            setCurrentStep('upload');
            toast.success(`Import complete: ${summary.successful ?? 0} succeeded, ${summary.failed ?? 0} failed.`);
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

            // Custom fields are stored by field_label (e.g. "Industry") but we send field_name (e.g. "Field_1").
            // Send a map so the export API can look up custom_fields[field_label].
            const availableFields = getAvailableFields();
            const fieldNameToLabel: Record<string, string> = {};
            availableFields.forEach((f: CustomFieldDefinition) => {
                if (f.field_label && f.field_label !== f.field_name) {
                    fieldNameToLabel[f.field_name] = f.field_label;
                }
            });

            const response = await fetch('/api/admin/data-downloader/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    module: selectedModule,
                    selectedFields: selectedFields,
                    fieldNameToLabel: Object.keys(fieldNameToLabel).length > 0 ? fieldNameToLabel : undefined,
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
                                            CSV File <span className="text-red-500">*</span>
                                        </label>
                                        {isParsingCsv && (
                                            <div className="mb-3">
                                                <p className="text-sm text-gray-600 mb-2">Parsing CSV data…</p>
                                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                    <div
                                                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                                        style={{ width: `${parseProgress}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 text-right">{parseProgress}%</p>
                                            </div>
                                        )}
                                        {uploadFile ? (
                                            <div className="p-3 bg-green-50 border border-green-200 rounded flex items-center justify-between">
                                                <span className="text-sm text-green-800 truncate">{uploadFile.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setUploadFile(null); setCsvHeaders([]); setParsedData([]); }}
                                                    className="text-gray-500 hover:text-red-600 text-sm shrink-0 ml-2"
                                                    disabled={isParsingCsv}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!isParsingCsv) setIsDraggingCsv(true); }}
                                                onDragLeave={(e) => { e.preventDefault(); setIsDraggingCsv(false); }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingCsv(false);
                                                    if (isParsingCsv) return;
                                                    const file = e.dataTransfer.files?.[0];
                                                    if (file) processCsvFile(file);
                                                }}
                                                onClick={() => !isParsingCsv && csvFileInputRef.current?.click()}
                                                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isParsingCsv ? 'cursor-not-allowed opacity-60 border-gray-300 bg-gray-50' : `cursor-pointer ${isDraggingCsv ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}`}
                                            >
                                                <input
                                                    ref={csvFileInputRef}
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                />
                                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <p className="mt-2 text-gray-600 text-sm">Drag and drop a CSV file here, or click to select</p>
                                                <p className="text-xs text-gray-500 mt-1">Accepted format: CSV (max 10MB)</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Step 2: Map Fields - LEFT: system fields (Admin non-hidden); RIGHT: CSV/Excel column headers */}
                            {currentStep === 'map' && csvHeaders.length > 0 && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                                            Map CSV Columns to System Fields
                                        </h3>
                                        <p className="text-xs text-gray-500 mb-2">
                                            Left: system fields for {uploadModules.find(m => m.id === selectedUploadModule)?.name ?? selectedUploadModule}. Right: select the column from your file that maps to each field.
                                        </p>
                                        {isLoadingUploadFields && (
                                            <p className="text-sm text-gray-500 mb-2">Loading system fields…</p>
                                        )}
                                        <div className="border border-gray-200 rounded p-4 max-h-96 overflow-y-auto space-y-3">
                                            {uploadModuleFields.length > 0 ? uploadModuleFields.map((field: CustomFieldDefinition) => (
                                                <div key={field.field_name} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-b-0">
                                                    <div className="w-52 shrink-0 text-sm font-medium text-gray-700 border-r border-gray-200 pr-3" title="System field from Admin Center">
                                                        {field.field_label}
                                                        {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <select
                                                            value={fieldMappings[field.field_name] || ''}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setFieldMappings(prev => ({ ...prev, [field.field_name]: v }));
                                                            }}
                                                            className="w-full max-w-md p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            title="CSV/Excel column header from your file"
                                                        >
                                                            <option value="">-- Skip --</option>
                                                            {csvHeaders.map(header => (
                                                                <option key={header} value={header}>
                                                                    {header}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )) : (
                                                <p className="text-sm text-gray-500 py-4">No fields available for this module. Configure fields in Admin Center → Field Management.</p>
                                            )}
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
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setUploadFile(null);
                                                        setCsvHeaders([]);
                                                        setParsedData([]);
                                                        setFieldMappings({});
                                                        setValidationErrors([]);
                                                        setCurrentStep('select');
                                                    }}
                                                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 text-sm"
                                                >
                                                    Change file
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const completeRows = parsedData.filter(row => row.errors.length === 0);
                                                        const skippedCount = parsedData.length - completeRows.length;
                                                        setParsedData(completeRows);
                                                        setValidationErrors([]);
                                                        setCurrentStep('preview');
                                                        if (skippedCount > 0) {
                                                            toast.success(`Skipped ${skippedCount} incomplete record(s). Continuing with ${completeRows.length} valid row(s).`);
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm"
                                                >
                                                    Skip incomplete records ({parsedData.filter(r => r.errors.length > 0).length} to skip, {parsedData.filter(r => r.errors.length === 0).length} valid)
                                                </button>
                                            </div>
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
                                                        {Object.entries(fieldMappings)
                                                            .filter(([, csvHeader]) => csvHeader)
                                                            .map(([systemField]) => {
                                                                const label = uploadModuleFields.find(f => f.field_name === systemField)?.field_label ?? systemField;
                                                                return (
                                                                    <th key={systemField} className="p-2 text-left border-b">
                                                                        {label}
                                                                    </th>
                                                                );
                                                            })}
                                                        <th className="p-2 text-left border-b">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {parsedData.slice(0, 10).map((row, index) => {
                                                        const hasErrors = row.errors.length > 0;
                                                        return (
                                                            <tr key={index} className={hasErrors ? 'bg-red-50' : ''}>
                                                                <td className="p-2 border-b">{row.rowNumber}</td>
                                                                {Object.entries(fieldMappings)
                                                                    .filter(([, csvHeader]) => csvHeader)
                                                                    .map(([systemField, csvHeader]) => (
                                                                        <td key={systemField} className="p-2 border-b">
                                                                            {row.raw[csvHeader] ?? '-'}
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

                                    <div className="flex items-center gap-2 mb-4">
                                        <input
                                            type="checkbox"
                                            id="upload-update-existing"
                                            checked={uploadUpdateExisting}
                                            onChange={(e) => setUploadUpdateExisting(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor="upload-update-existing" className="text-sm text-gray-700">
                                            Update existing records when a match is found (e.g. by email or name)
                                        </label>
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