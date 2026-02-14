'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getCookie } from 'cookies-next';

interface BulkOwnershipModalProps {
    open: boolean;
    onClose: () => void;
    entityType: string;
    entityIds: string[];
    fieldLabel: string;
    onSuccess?: () => void;
}

interface User {
    id: number;
    name: string;
    email: string;
    user_type?: string;
    role?: string;
}

export default function BulkOwnershipModal({
    open,
    onClose,
    entityType,
    entityIds,
    fieldLabel,
    onSuccess
}: BulkOwnershipModalProps) {
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch internal users when modal opens
    useEffect(() => {
        if (open) {
            fetchUsers();
        } else {
            // Reset selection when modal closes
            setSelectedUserId('');
        }
    }, [open]);

    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                '$1'
            );

            const response = await fetch("/api/users/active", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Filter to only internal system users
                const internalUsers = (data.users || []).filter((user: any) => {
                    return (
                        user.user_type === "internal" ||
                        user.role === "admin" ||
                        user.role === "user" ||
                        (!user.user_type && user.email) // Default to internal if user_type not set but has email
                    );
                });
                setUsers(internalUsers);

                // Auto-select current user if available
                try {
                    const userDataStr = getCookie('user');
                    if (userDataStr) {
                        const userData = JSON.parse(userDataStr as string);
                        if (userData.id) {
                            const currentUser = internalUsers.find((u: User) => u.id === userData.id);
                            if (currentUser) {
                                setSelectedUserId(String(currentUser.id));
                            }
                        } else if (userData.name) {
                            // Fallback: try to match by name
                            const currentUser = internalUsers.find((u: User) => u.name === userData.name);
                            if (currentUser) {
                                setSelectedUserId(String(currentUser.id));
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }
        } catch (err) {
            console.error('Error fetching users:', err);
            toast.error('Failed to load users');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const getSelectedUserName = () => {
        if (!selectedUserId) return '';
        const user = users.find(u => String(u.id) === selectedUserId);
        return user?.name || '';
    };

    const handleSubmit = async () => {
        console.log('\n=== FRONTEND: BULK OWNERSHIP UPDATE START ===');
        console.log('Entity Type:', entityType);
        console.log('Entity IDs:', entityIds);
        console.log('Field Label:', fieldLabel);
        console.log('Selected User ID:', selectedUserId);
        
        if (!selectedUserId) {
            console.error('Validation failed: No user selected');
            toast.error('Please select an owner');
            return;
        }

        const ownerName = getSelectedUserName();
        if (!ownerName) {
            console.error('Validation failed: Owner name not found');
            toast.error('Selected user not found');
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
            
            const payload = {
                ids: entityIds,
                updates: {
                    customFields: {
                        [fieldLabel]: ownerName.trim()
                    }
                }
            };
            
            console.log('\n--- Request Payload ---');
            console.log(JSON.stringify(payload, null, 2));
            console.log('Field Label being used:', fieldLabel);
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
            
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed response data:', JSON.stringify(data, null, 2));
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Response text:', responseText);
                throw new Error('Invalid response from server');
            }

            if (!response.ok) {
                const errorMsg = data.message || data.error || 'Failed to update ownership';
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
                toast.success(`Updated ownership for ${entityIds.length} record(s)`);
            }
            
            console.log('=== FRONTEND: BULK OWNERSHIP UPDATE END ===\n');
            onSuccess?.();
        } catch (error) {
            console.error('\n❌ FRONTEND ERROR in bulk ownership update');
            console.error('Error:', error);
            console.error('Error message:', error instanceof Error ? error.message : String(error));
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
            console.log('=== FRONTEND: BULK OWNERSHIP UPDATE END (ERROR) ===\n');
            toast.error(error instanceof Error ? error.message : 'Failed to update ownership');
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Manage Ownership</h2>
                <p className="text-gray-600 mb-4">
                    Update ownership for {entityIds.length} selected record(s)
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Owner
                    </label>
                    {isLoadingUsers ? (
                        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500"></div>
                            <span className="text-sm text-gray-500">Loading users...</span>
                        </div>
                    ) : (
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        >
                            <option value="">Select an owner</option>
                            {users.map((user) => (
                                <option key={user.id} value={String(user.id)}>
                                    {user.name} {user.email ? `(${user.email})` : ''}
                                </option>
                            ))}
                        </select>
                    )}
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
                        disabled={isLoading || isLoadingUsers || !selectedUserId}
                    >
                        {isLoading ? 'Updating...' : 'Update Ownership'}
                    </button>
                </div>
            </div>
        </div>
    );
}
