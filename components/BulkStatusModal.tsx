'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface BulkStatusModalProps {
    open: boolean;
    onClose: () => void;
    entityType: string;
    entityIds: string[];
    fieldLabel: string;
    options?: string[];
    availableFields?: any[];
    onSuccess?: () => void;
}

export default function BulkStatusModal({
    open,
    onClose,
    entityType,
    entityIds,
    fieldLabel,
    options = [],
    availableFields = [],
    onSuccess
}: BulkStatusModalProps) {
    const [selectedStatus, setSelectedStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Default status options if none provided
    const statusOptions = options.length > 0 ? options : ['Active', 'Inactive', 'Archived', 'Pending', 'Closed'];

    const handleSubmit = async () => {
        console.log('\n=== FRONTEND: BULK STATUS UPDATE START ===');
        console.log('Entity Type:', entityType);
        console.log('Entity IDs:', entityIds);
        console.log('Field Label:', fieldLabel);
        console.log('Selected Status:', selectedStatus);
        console.log('Available Fields:', availableFields);
        
        if (!selectedStatus) {
            console.error('Validation failed: No status selected');
            toast.error('Please select a status');
            return;
        }

        setIsLoading(true);
        try {
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                '$1'
            );
            console.log('Token extracted:', token ? 'Yes (length: ' + token.length + ')' : 'No');

            const entityTypeMap: Record<string, string> = {
                'organization': 'organizations',
                'lead': 'leads',
                'job': 'jobs',
                'task': 'tasks',
                'hiring-manager': 'hiring-managers',
                'job-seeker': 'job-seekers',
                'placement': 'placements'
            };
            const apiPath = entityTypeMap[entityType] || `${entityType}s`;
            console.log('API Path:', apiPath);
            
            // Status can be both a standard field AND stored in custom_fields
            // Match the pattern from view page: send both status and customFields
            const payload = {
                ids: entityIds,
                updates: {
                    status: selectedStatus, // Update standard status field
                    customFields: {
                        [fieldLabel]: selectedStatus // Also update in custom_fields
                    }
                }
            };
            
            console.log('\n--- Request Payload ---');
            console.log(JSON.stringify(payload, null, 2));
            console.log('Field Label being used:', fieldLabel);
            console.log('Status value:', selectedStatus);
            console.log('Custom Fields object:', JSON.stringify(payload.updates.customFields, null, 2));
            
            const apiUrl = `/api/${apiPath}/bulk-update`;
            console.log('API URL:', apiUrl);
            console.log('Making fetch request...');
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            console.log('\n--- Response Received ---');
            console.log('Status:', response.status);
            console.log('Status Text:', response.statusText);
            console.log('OK:', response.ok);
            
            const responseText = await response.text();
            console.log('Raw response text:', responseText);
            
            // Handle empty response
            if (!responseText || responseText.trim() === '') {
                console.error('Empty response from server');
                throw new Error(`Server returned empty response (Status: ${response.status})`);
            }
            
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed response data:', JSON.stringify(data, null, 2));
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Response text:', responseText);
                console.error('Response status:', response.status);
                console.error('Response statusText:', response.statusText);
                throw new Error(`Invalid response from server (Status: ${response.status}): ${responseText.substring(0, 100)}`);
            }

            if (!response.ok) {
                const errorMsg = data.message || data.error || 'Failed to update status';
                console.error('\n❌ Request failed');
                console.error('Error message:', errorMsg);
                console.error('Full error data:', JSON.stringify(data, null, 2));
                throw new Error(errorMsg);
            }

            console.log('\n--- Processing Results ---');
            console.log('Results:', JSON.stringify(data.results, null, 2));
            
            if (data.results && data.results.failed && data.results.failed.length > 0) {
                const errorDetails = data.results.errors.map((e: any) => `${e.id}: ${e.error}`).join(', ');
                console.error('Some records failed:', errorDetails);
                toast.error(`Some records failed: ${errorDetails}`);
            } else {
                console.log('✅ All records updated successfully');
                toast.success(`Updated status for ${entityIds.length} record(s)`);
            }
            
            console.log('=== FRONTEND: BULK STATUS UPDATE END ===\n');
            onSuccess?.();
        } catch (error) {
            console.error('\n❌ FRONTEND ERROR in bulk status update');
            console.error('Error:', error);
            console.error('Error message:', error instanceof Error ? error.message : String(error));
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
            console.log('=== FRONTEND: BULK STATUS UPDATE END (ERROR) ===\n');
            toast.error(error instanceof Error ? error.message : 'Failed to update status');
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Change Status</h2>
                <p className="text-gray-600 mb-4">
                    Update status for {entityIds.length} selected record(s)
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                    </label>
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    >
                        <option value="">Select a status</option>
                        {statusOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        disabled={isLoading || !selectedStatus}
                    >
                        {isLoading ? 'Updating...' : 'Update Status'}
                    </button>
                </div>
            </div>
        </div>
    );
}
