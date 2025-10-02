// app/dashboard/admin/field-mapping/page.tsx
'use client'

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiChevronLeft, FiChevronsLeft, FiRefreshCw, FiSearch, FiPlus, FiEdit2, FiTrash2, FiClock, FiX, FiArrowLeft, FiInfo } from 'react-icons/fi';

// Define Field interface for type safety
interface CustomField {
    id: string;
    entity_type: string;
    field_name: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    is_hidden: boolean;
    sort_order: number;
    options?: string[];
    placeholder?: string;
    default_value?: string;
    created_by_name?: string;
    updated_by_name?: string;
    created_at: string;
    updated_at: string;
}

interface HistoryEntry {
    id: string;
    action: string;
    old_values?: any;
    new_values?: any;
    changed_fields?: string[];
    performed_by_name: string;
    performed_at: string;
}

const FieldMapping = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const section = searchParams.get('section') || 'jobs';

    const [showCount, setShowCount] = useState('200');
    const [searchTerm, setSearchTerm] = useState('');
    const [nameSearchTerm, setNameSearchTerm] = useState('');
    const [editTypeSearchTerm, setEditTypeSearchTerm] = useState('');
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedField, setSelectedField] = useState<CustomField | null>(null);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showFieldNamingModal, setShowFieldNamingModal] = useState(false);
    const [fieldHistory, setFieldHistory] = useState<HistoryEntry[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [fieldColumnNames, setFieldColumnNames] = useState<{ [key: string]: string }>({
        field1: 'Field Label',
        field2: 'Field Name',
        field3: 'Field Type',
        field4: 'Hidden',
        field5: 'Required',
        field6: 'Sort Order',
        field7: 'Last Modified',
        field8: 'Modified By'
    });
    const [editFormData, setEditFormData] = useState({
        fieldName: '',
        fieldLabel: '',
        fieldType: 'text',
        isRequired: false,
        isHidden: false,
        sortOrder: 0,
        options: [] as string[],
        placeholder: '',
        defaultValue: '',
    });
    const [editingSortOrder, setEditingSortOrder] = useState<string | null>(null);
    const [tempSortOrder, setTempSortOrder] = useState<number>(0);

    const editTypeOptions = [
        'text',
        'email',
        'phone',
        'number',
        'date',
        'textarea',
        'select',
        'checkbox',
        'radio',
        'url',
        'file'
    ];

    // Load custom fields on component mount
    useEffect(() => {
        fetchCustomFields();
    }, [section]);

    const fetchCustomFields = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/admin/field-management/${section}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch custom fields');
            }

            setCustomFields(data.customFields || []);
        } catch (err) {
            console.error('Error fetching custom fields:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFieldHistory = async (fieldId: string) => {
        setIsLoadingHistory(true);
        try {
            const response = await fetch(`/api/admin/field-management/fields/${fieldId}/history`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch custom field history');
            }

            setFieldHistory(data.history || []);
        } catch (err) {
            console.error('Error fetching field history:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching history');
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleFieldClick = (field: CustomField) => {
        setSelectedField(field);
        setEditFormData({
            fieldName: field.field_name,
            fieldLabel: field.field_label,
            fieldType: field.field_type,
            isRequired: field.is_required,
            isHidden: field.is_hidden,
            sortOrder: field.sort_order,
            options: field.options || [],
            placeholder: field.placeholder || '',
            defaultValue: field.default_value || '',
        });
        setShowEditForm(true);
    };

    const handleShowHistory = (field: CustomField) => {
        setSelectedField(field);
        setShowHistoryModal(true);
        fetchFieldHistory(field.id);
    };

    const handleAddField = () => {
        // Generate the next sequential field name
        const nextFieldNumber = getNextFieldNumber();
        const autoGeneratedFieldName = `Field_${nextFieldNumber}`;
        
        setEditFormData({
            fieldName: autoGeneratedFieldName,
            fieldLabel: '',
            fieldType: 'text',
            isRequired: false,
            isHidden: false,
            sortOrder: customFields.length * 10,
            options: [],
            placeholder: '',
            defaultValue: '',
        });
        setSelectedField(null);
        setShowAddForm(true);
    };

    // Helper function to generate the next field number
    const getNextFieldNumber = () => {
        // Extract all existing field numbers from field names
        const existingNumbers = customFields
            .map(field => {
                const match = field.field_name.match(/^Field_(\d+)$/);
                return match ? parseInt(match[1]) : 0;
            })
            .filter(num => num > 0);
        
        // Find the highest number and add 1
        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        return maxNumber + 1;
    };

    const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setEditFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) || 0 : value)
        }));
    };

    const handleOptionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const options = e.target.value.split('\n').filter(option => option.trim() !== '');
        setEditFormData(prev => ({
            ...prev,
            options
        }));
    };

    const handleSaveField = async () => {
        try {
            let apiData;
            let response;

            if (selectedField) {
                // Update existing field - only send changed fields
                apiData = {
                    fieldLabel: editFormData.fieldLabel,
                    fieldType: editFormData.fieldType,
                    isRequired: editFormData.isRequired,
                    isHidden: editFormData.isHidden,
                    sortOrder: editFormData.sortOrder,
                    options: editFormData.options.length > 0 ? editFormData.options : null,
                    placeholder: editFormData.placeholder || null,
                    defaultValue: editFormData.defaultValue || null,
                };

                console.log('Updating field with data:', apiData);
                console.log('Field ID:', selectedField.id);

                response = await fetch(`/api/admin/field-management/fields/${selectedField.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiData)
                });
            } else {
                // Create new field - include all required fields
                apiData = {
                    entityType: section,
                    fieldName: editFormData.fieldName,
                    fieldLabel: editFormData.fieldLabel,
                    fieldType: editFormData.fieldType,
                    isRequired: editFormData.isRequired,
                    isHidden: editFormData.isHidden,
                    sortOrder: editFormData.sortOrder,
                    options: editFormData.options.length > 0 ? editFormData.options : null,
                    placeholder: editFormData.placeholder || null,
                    defaultValue: editFormData.defaultValue || null,
                };

                console.log('Creating field with data:', apiData);

                response = await fetch(`/api/admin/field-management/${section}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiData)
                });
            }

            const data = await response.json();
            console.log('Response status:', response.status);
            console.log('Response data:', data);

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save field');
            }

            // Refresh the fields list
            await fetchCustomFields();

            // Close the form
            setShowEditForm(false);
            setShowAddForm(false);
            setSelectedField(null);
        } catch (err) {
            console.error('Error saving field:', err);
            alert(err instanceof Error ? err.message : 'An error occurred while saving the field');
        }
    };

    const handleDeleteField = async (fieldId: string) => {
        if (!confirm('Are you sure you want to delete this custom field? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/field-management/fields/${fieldId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete field');
            }

            // Refresh the fields list
            await fetchCustomFields();
        } catch (err) {
            console.error('Error deleting field:', err);
            alert(err instanceof Error ? err.message : 'An error occurred while deleting the field');
        }
    };

    // Fixed toggle functions with API calls
    const toggleFieldRequired = async (field: CustomField) => {
        try {
            const updateData = { isRequired: !field.is_required };
            console.log('Toggling field required status:', updateData);
            console.log('Field ID:', field.id);
            console.log('API URL:', `/api/admin/field-management/fields/${field.id}`);

            const response = await fetch(`/api/admin/field-management/fields/${field.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            console.log('Toggle required response status:', response.status);
            console.log('Toggle required response headers:', response.headers);

            let data;
            try {
                data = await response.json();
                console.log('Toggle required response data:', data);
            } catch (jsonError) {
                console.error('Error parsing JSON response:', jsonError);
                const textResponse = await response.text();
                console.log('Raw response text:', textResponse);
                throw new Error('Invalid response format from server');
            }

            if (!response.ok) {
                throw new Error(data?.message || `Server error: ${response.status} ${response.statusText}`);
            }

            // Refresh the fields list
            await fetchCustomFields();
        } catch (err) {
            console.error('Error updating field:', err);
            const errorMessage = err instanceof Error ? err.message : 'An error occurred while updating the custom field';
            alert(`Failed to update field status: ${errorMessage}`);
        }
    };

    const toggleFieldHidden = async (field: CustomField) => {
        try {
            const updateData = { isHidden: !field.is_hidden };
            console.log('Toggling field hidden status:', updateData);
            console.log('Field ID:', field.id);
            console.log('API URL:', `/api/admin/field-management/fields/${field.id}`);

            const response = await fetch(`/api/admin/field-management/fields/${field.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            console.log('Toggle hidden response status:', response.status);
            console.log('Toggle hidden response headers:', response.headers);

            let data;
            try {
                data = await response.json();
                console.log('Toggle hidden response data:', data);
            } catch (jsonError) {
                console.error('Error parsing JSON response:', jsonError);
                const textResponse = await response.text();
                console.log('Raw response text:', textResponse);
                throw new Error('Invalid response format from server');
            }

            if (!response.ok) {
                throw new Error(data?.message || `Server error: ${response.status} ${response.statusText}`);
            }

            // Refresh the fields list
            await fetchCustomFields();
        } catch (err) {
            console.error('Error updating field:', err);
            const errorMessage = err instanceof Error ? err.message : 'An error occurred while updating the custom field';
            alert(`Failed to update field status: ${errorMessage}`);
        }
    };

    // Handle inline sort order editing
    const handleSortOrderClick = (field: CustomField) => {
        setEditingSortOrder(field.id);
        setTempSortOrder(field.sort_order);
    };

    const handleSortOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value) || 0;
        setTempSortOrder(value);
    };

    const handleSortOrderSave = async (field: CustomField) => {
        try {
            const updateData = { sortOrder: tempSortOrder };
            console.log('Updating sort order:', updateData);
            console.log('Field ID:', field.id);

            const response = await fetch(`/api/admin/field-management/fields/${field.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Failed to update sort order');
            }

            // Refresh the fields list
            await fetchCustomFields();
            setEditingSortOrder(null);
        } catch (err) {
            console.error('Error updating sort order:', err);
            const errorMessage = err instanceof Error ? err.message : 'An error occurred while updating the sort order';
            alert(`Failed to update sort order: ${errorMessage}`);
        }
    };

    const handleSortOrderCancel = () => {
        setEditingSortOrder(null);
        setTempSortOrder(0);
    };

    const handleSortOrderKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, field: CustomField) => {
        if (e.key === 'Enter') {
            handleSortOrderSave(field);
        } else if (e.key === 'Escape') {
            handleSortOrderCancel();
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const handleGoBack = () => {
        router.push('/dashboard/admin/field-management');
    };

    const handleUpdateColumnName = (fieldKey: string, newName: string) => {
        setFieldColumnNames(prev => ({
            ...prev,
            [fieldKey]: newName
        }));
    };

    // Field Naming Modal Component
    const FieldNamingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                    <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Field Column Definitions</h2>
                        <button
                            onClick={onClose}
                            className="p-1 rounded hover:bg-gray-200"
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                    <div className="p-6">
                        <p className="text-gray-600 mb-4">
                            The table columns are numbered for easy reference. You can customize the column names below:
                        </p>
                        <div className="space-y-4">
                            {Object.entries(fieldColumnNames).map(([key, value]) => (
                                <div key={key} className="flex items-center space-x-4">
                                    <div className="w-20 font-semibold text-blue-600 capitalize">
                                        {key.replace('field', 'Field ')}:
                                    </div>
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => handleUpdateColumnName(key, e.target.value)}
                                        className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 p-4 bg-blue-50 rounded border-l-4 border-blue-500">
                            <h3 className="font-semibold text-blue-800 mb-2">Field Customization</h3>
                            <ul className="text-sm text-blue-700 space-y-1">
                                <li>• Click on Field 4 (Hidden) to toggle field visibility</li>
                                <li>• Click on Field 5 (Required) to toggle whether the field is mandatory</li>
                                <li>• Click the edit icon to modify field properties</li>
                                <li>• Use "Add Custom Field" to create new fields with custom names</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderHistoryModal = () => {
        if (!showHistoryModal || !selectedField) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                    <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                        <h2 className="text-lg font-semibold">
                            History for "{selectedField.field_label}"
                        </h2>
                        <button
                            onClick={() => setShowHistoryModal(false)}
                            className="p-1 rounded hover:bg-gray-200"
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                    <div className="p-6">
                        {isLoadingHistory ? (
                            <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        ) : fieldHistory.length > 0 ? (
                            <div className="space-y-4">
                                {fieldHistory.map((entry) => (
                                    <div key={entry.id} className="border rounded p-4 hover:bg-gray-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${entry.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                                                        entry.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-red-100 text-red-800'
                                                    }`}>
                                                    {entry.action}
                                                </span>
                                                <span className="ml-2 font-medium">{entry.performed_by_name}</span>
                                            </div>
                                            <span className="text-sm text-gray-500">
                                                {formatDate(entry.performed_at)}
                                            </span>
                                        </div>

                                        {entry.action === 'UPDATE' && entry.changed_fields && entry.changed_fields.length > 0 && (
                                            <div className="mt-2">
                                                <div className="text-sm font-medium text-gray-700 mb-1">
                                                    Changed fields: {entry.changed_fields.join(', ')}
                                                </div>
                                                {entry.old_values && entry.new_values && (
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <div className="font-medium text-red-600">Before:</div>
                                                            <pre className="bg-red-50 p-2 rounded text-xs overflow-auto">
                                                                {JSON.stringify(entry.old_values, null, 2)}
                                                            </pre>
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-green-600">After:</div>
                                                            <pre className="bg-green-50 p-2 rounded text-xs overflow-auto">
                                                                {JSON.stringify(entry.new_values, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic text-center py-8">No history records found</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const filteredFields = customFields.filter(field => {
        const matchesField = field.field_label.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesName = field.field_name.toLowerCase().includes(nameSearchTerm.toLowerCase());
        const matchesEditType = field.field_type.toLowerCase().includes(editTypeSearchTerm.toLowerCase());
        return matchesField && matchesName && matchesEditType;
    });

    const visibleFields = filteredFields.slice(0, parseInt(showCount));

    return (
        <div className="bg-gray-200 min-h-screen">
            {/* Header Bar */}
            <div className="bg-gray-50 border-b border-gray-300 p-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm">
                        <button
                            onClick={handleGoBack}
                            className="hover:bg-gray-200 p-1 rounded mr-2 flex items-center"
                            title="Go back to Field Management"
                        >
                            <FiArrowLeft size={16} className="mr-1" />
                            Back
                        </button>
                        <span className="font-medium capitalize">{section.replace('-', ' ')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setShowFieldNamingModal(true)}
                            className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            title="View field column definitions"
                        >
                            <FiInfo size={14} className="mr-1" />
                            Field Guide
                        </button>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-gray-100 p-2 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <span className="text-sm mr-2">Show</span>
                        <select
                            value={showCount}
                            onChange={(e) => setShowCount(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="200">200</option>
                            <option value="500">500</option>
                        </select>
                        <span className="text-sm ml-2">entries</span>
                    </div>
                    <button
                        onClick={fetchCustomFields}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Refresh"
                    >
                        <FiRefreshCw size={16} />
                    </button>
                    <span className="text-sm">Refresh</span>
                </div>

                <button
                    onClick={handleAddField}
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    <FiPlus size={16} className="mr-1" />
                    Add Custom Field
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
                    {error}
                </div>
            )}

            {/* Loading Display */}
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <>
                    {/* Table Container */}
                    <div className="bg-white shadow overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-100 text-left text-sm">
                                    <th className="p-3 font-normal w-16">Actions</th>
                                    
                                    <th className="p-3 font-normal">
                                        <div className="flex items-center">
                                            {fieldColumnNames.field2}
                                            <div className="ml-1 relative">
                                                <input
                                                    type="text"
                                                    className="w-32 px-2 py-1 border rounded"
                                                    value={nameSearchTerm}
                                                    onChange={(e) => setNameSearchTerm(e.target.value)}
                                                    placeholder="Search..."
                                                />
                                            
                                                <FiSearch size={14} className="absolute right-2 top-2 text-gray-400" />
                                            </div>
                                        </div>
                                    </th>

                                    {/* ider paste krna h */}
                                    <th className="p-3 font-normal w-48">
                                        <div className="flex items-center">
                                            {fieldColumnNames.field1}
                                            <div className="ml-1 relative">
                                                <input
                                                    type="text"
                                                    className="w-24 px-2 py-1 border rounded"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    placeholder="Search..."
                                                />
                                                <FiSearch size={14} className="absolute right-2 top-2 text-gray-400" />
                                            </div>
                                        </div>
                                    </th>
                                    <th className="p-3 font-normal">
                                        <div className="flex items-center">
                                            {fieldColumnNames.field3}
                                            <div className="ml-1 relative">
                                                <input
                                                    type="text"
                                                    className="w-32 px-2 py-1 border rounded"
                                                    value={editTypeSearchTerm}
                                                    onChange={(e) => setEditTypeSearchTerm(e.target.value)}
                                                    placeholder="Search..."
                                                />
                                                <FiSearch size={14} className="absolute right-2 top-2 text-gray-400" />
                                            </div>
                                        </div>
                                    </th>
                                    <th className="p-3 font-normal text-center w-20">{fieldColumnNames.field4}</th>
                                    <th className="p-3 font-normal text-center w-20">{fieldColumnNames.field5}</th>
                                    <th className="p-3 font-normal w-24">{fieldColumnNames.field6}</th>
                                    <th className="p-3 font-normal w-40">{fieldColumnNames.field7}</th>
                                    <th className="p-3 font-normal w-32">{fieldColumnNames.field8}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleFields.map((field) => (
                                    <tr key={field.id} className="border-t border-gray-200 hover:bg-gray-50">
                                        <td className="p-3">
                                            <div className="flex space-x-1">
                                                <button
                                                    onClick={() => handleFieldClick(field)}
                                                    className="text-blue-500 hover:text-blue-700"
                                                    title="Edit"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                {/* <button
                                                    onClick={() => handleDeleteField(field.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    title="Delete"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button> */}
                                                <button
                                                    onClick={() => handleShowHistory(field)}
                                                    className="text-green-500 hover:text-green-700"
                                                    title="View History"
                                                >
                                                    <FiClock size={14} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className="text-sm font-mono">{field.field_name}</span>
                                        </td>
                                        <td className="p-3 text-sm font-medium">{field.field_label}</td>
                                        <td className="p-3 text-sm">{field.field_type}</td>

                                        <td className="p-3 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleFieldHidden(field);
                                                }}
                                                className={`h-4 w-4 rounded flex items-center justify-center ${field.is_hidden
                                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                                        : 'bg-gray-300 hover:bg-gray-400'
                                                    }`}
                                                title={field.is_hidden ? 'Hidden - Click to show' : 'Visible - Click to hide'}
                                            >
                                                {field.is_hidden && <span className="text-xs leading-none">✓</span>}
                                            </button>
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleFieldRequired(field);
                                                }}
                                                className={`h-4 w-4 rounded flex items-center justify-center ${field.is_required
                                                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                                        : 'bg-gray-300 hover:bg-gray-400'
                                                    }`}
                                                title={field.is_required ? 'Required - Click to make optional' : 'Optional - Click to make required'}
                                            >
                                                {field.is_required && <span className="text-xs leading-none">✓</span>}
                                            </button>
                                        </td>
                                        <td className="p-3">
                                            {editingSortOrder === field.id ? (
                                                <div className="flex items-center space-x-1">
                                                    <input
                                                        type="number"
                                                        value={tempSortOrder}
                                                        onChange={handleSortOrderChange}
                                                        onKeyDown={(e) => handleSortOrderKeyPress(e, field)}
                                                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        min="0"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleSortOrderSave(field)}
                                                        className="text-green-600 hover:text-green-800 text-xs"
                                                        title="Save"
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        onClick={handleSortOrderCancel}
                                                        className="text-red-600 hover:text-red-800 text-xs"
                                                        title="Cancel"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleSortOrderClick(field)}
                                                    className="text-sm hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                                    title="Click to edit sort order"
                                                >
                                                    {field.sort_order}
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-3 text-sm">
                                            {formatDate(field.updated_at)}
                                        </td>
                                        <td className="p-3 text-sm">{field.updated_by_name || field.created_by_name || 'System'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-gray-100 p-2 text-sm text-gray-600">
                        Showing {visibleFields.length} of {filteredFields.length} entries
                    </div>
                </>
            )}

            {/* Edit/Add Form Modal */}
            {(showEditForm || showAddForm) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-semibold">
                                {selectedField ? 'Edit' : 'Add'} Custom Field
                            </h2>
                            <div className="space-x-2">
                                <button
                                    onClick={() => {
                                        setShowEditForm(false);
                                        setShowAddForm(false);
                                        setSelectedField(null);
                                    }}
                                    className="px-4 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveField}
                                    className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                    {selectedField ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Field Name: <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="fieldName"
                                        value={editFormData.fieldName}
                                        onChange={handleEditFormChange}
                                        className={`w-full px-3 py-2 border rounded ${
                                            !selectedField ? 'bg-gray-100 cursor-not-allowed' : ''
                                        }`}
                                        placeholder="e.g., company_size"
                                        pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                                        title={!selectedField ? "Field name is auto-generated for new fields" : "Must start with a letter and contain only letters, numbers, and underscores"}
                                        required
                                        disabled={!selectedField} // Auto-generated for new fields, editable for existing fields
                                        readOnly={!selectedField} // Make it read-only for new fields
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {!selectedField 
                                            ? "Field name is automatically generated in sequential order (Field_1, Field_2, etc.)"
                                            : "Must start with a letter and contain only letters, numbers, and underscores"
                                        }
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Field Label: <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="fieldLabel"
                                        value={editFormData.fieldLabel}
                                        onChange={handleEditFormChange}
                                        className="w-full px-3 py-2 border rounded"
                                        placeholder="e.g., Company Size"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Field Type: <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="fieldType"
                                        value={editFormData.fieldType}
                                        onChange={handleEditFormChange}
                                        className="w-full px-3 py-2 border rounded"
                                        required
                                    >
                                        {editTypeOptions.map(option => (
                                            <option key={option} value={option}>
                                                {option.charAt(0).toUpperCase() + option.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Sort Order:
                                    </label>
                                    <input
                                        type="number"
                                        name="sortOrder"
                                        value={editFormData.sortOrder}
                                        onChange={handleEditFormChange}
                                        className="w-full px-3 py-2 border rounded"
                                        min="0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Placeholder:
                                    </label>
                                    <input
                                        type="text"
                                        name="placeholder"
                                        value={editFormData.placeholder}
                                        onChange={handleEditFormChange}
                                        className="w-full px-3 py-2 border rounded"
                                        placeholder="Placeholder text for the field"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Default Value:
                                    </label>
                                    <input
                                        type="text"
                                        name="defaultValue"
                                        value={editFormData.defaultValue}
                                        onChange={handleEditFormChange}
                                        className="w-full px-3 py-2 border rounded"
                                        placeholder="Default value for the field"
                                    />
                                </div>

                                {(editFormData.fieldType === 'select' || editFormData.fieldType === 'radio') && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Options (one per line):
                                        </label>
                                        <textarea
                                            value={editFormData.options.join('\n')}
                                            onChange={handleOptionsChange}
                                            className="w-full px-3 py-2 border rounded"
                                            rows={5}
                                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center space-x-6">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            name="isRequired"
                                            checked={editFormData.isRequired}
                                            onChange={handleEditFormChange}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm">Required</span>
                                    </label>

                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            name="isHidden"
                                            checked={editFormData.isHidden}
                                            onChange={handleEditFormChange}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm">Hidden</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {renderHistoryModal()}

            {/* Field Naming Modal */}
            <FieldNamingModal
                isOpen={showFieldNamingModal}
                onClose={() => setShowFieldNamingModal(false)}
            />
        </div>
    );
};

export default FieldMapping;