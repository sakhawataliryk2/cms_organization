'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface BulkOpenCloseModalProps {
    open: boolean;
    onClose: () => void;
    entityType: string;
    entityIds: string[];
    fieldLabel: string;
    onSuccess?: () => void;
}

export default function BulkOpenCloseModal({
    open,
    onClose,
    entityType,
    entityIds,
    fieldLabel,
    onSuccess
}: BulkOpenCloseModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleUpdate = async (value: 'Open' | 'Closed') => {
        setIsLoading(true);
        try {
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                '$1'
            );

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
            const response = await fetch(`/api/${apiPath}/bulk-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ids: entityIds,
                    updates: {
                        customFields: {
                            [fieldLabel]: value
                        }
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update Open/Close status');
            }

            toast.success(`Marked ${entityIds.length} record(s) as ${value}`);
            onSuccess?.();
        } catch (error) {
            console.error('Error updating Open/Close status:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update Open/Close status');
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Open/Close</h2>
                <p className="text-gray-600 mb-4">
                    Update Open/Close status for {entityIds.length} selected record(s)
                </p>

                <div className="flex gap-3 mb-4">
                    <button
                        onClick={() => handleUpdate('Open')}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        disabled={isLoading}
                    >
                        Mark as Open
                    </button>
                    <button
                        onClick={() => handleUpdate('Closed')}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        disabled={isLoading}
                    >
                        Mark as Closed
                    </button>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
