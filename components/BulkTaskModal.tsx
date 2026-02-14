'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface BulkTaskModalProps {
    open: boolean;
    onClose: () => void;
    entityType: string;
    entityIds: string[];
    onSuccess?: () => void;
}

export default function BulkTaskModal({
    open,
    onClose,
    entityType,
    entityIds,
    onSuccess
}: BulkTaskModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [status, setStatus] = useState('Pending');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open) {
            // Reset form
            setTitle('');
            setDescription('');
            setDueDate('');
            setPriority('Medium');
            setStatus('Pending');
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast.error('Please enter a task title');
            return;
        }

        setIsLoading(true);
        try {
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                '$1'
            );

            const entityTypeMap: Record<string, string> = {
                'organization': 'organization_id',
                'lead': 'lead_id',
                'job': 'job_id',
                'hiring-manager': 'hiring_manager_id',
                'job-seeker': 'job_seeker_id',
                'placement': 'placement_id'
            };
            const entityField = entityTypeMap[entityType] || 'organization_id';
            
            // Validate entity field exists
            if (!entityField) {
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            // Create task for each entity
            const results = {
                successful: [] as string[],
                failed: [] as string[],
                errors: [] as Array<{ id: string; error: string }>
            };

            for (const id of entityIds) {
                try {
                    const taskData: any = {
                        title: title.trim(),
                        description: description.trim() || null,
                        due_date: dueDate || null,
                        priority,
                        status,
                        [entityField]: parseInt(id),
                    };

                    const response = await fetch('/api/tasks', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(taskData)
                    });

                    if (response.ok) {
                        results.successful.push(id);
                    } else {
                        const errorData = await response.json();
                        results.failed.push(id);
                        results.errors.push({
                            id,
                            error: errorData.message || 'Failed to create task'
                        });
                    }
                } catch (error) {
                    results.failed.push(id);
                    results.errors.push({
                        id,
                        error: error instanceof Error ? error.message : 'Failed to create task'
                    });
                }
            }

            if (results.failed.length > 0) {
                const errorDetails = results.errors.map(e => `${e.id}: ${e.error}`).join(', ');
                toast.error(`Some tasks failed: ${errorDetails}`);
            } else {
                toast.success(`Created tasks for ${entityIds.length} record(s)`);
            }

            onSuccess?.();
        } catch (error) {
            console.error('Error creating bulk tasks:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create tasks');
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Create Tasks</h2>
                <p className="text-gray-600 mb-4">
                    Create a task for {entityIds.length} selected record(s)
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Task Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter task title"
                        autoFocus
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter task description"
                        rows={3}
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Due Date
                    </label>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Priority
                        </label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
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
                        disabled={isLoading || !title.trim()}
                    >
                        {isLoading ? 'Creating...' : 'Create Tasks'}
                    </button>
                </div>
            </div>
        </div>
    );
}
