'use client'

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { RefreshCw, X, Pencil } from 'lucide-react';
import Tooltip from '@/components/Tooltip';
import { isValidUSPhoneNumber } from '@/app/utils/phoneValidation';

interface User {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phone2?: string;
    zoomExtensionNumber?: string;
    officeId?: string;
    teamId?: string;
    title: string;
    office: string;
    team: string;
    idNumber: string;
    isAdmin: boolean;
    status: boolean;
    role: string;
}

// User types: display label -> backend role value
const USER_TYPES: { label: string; value: string }[] = [
    { label: 'Developer', value: 'developer' },
    { label: 'Owner', value: 'owner' },
    { label: 'Administrator', value: 'administrator' },
    { label: 'Payroll-Admin', value: 'payroll-admin' },
    { label: 'Onboarding-admin', value: 'onboarding-admin' },
    { label: 'Account manager-temp', value: 'account-manager-temp' },
    { label: 'Account Manager-Perm', value: 'account-manager-perm' },
    { label: 'Sales Rep', value: 'sales-rep' },
    { label: 'Recruiter', value: 'recruiter' },
];

function roleToLabel(role: string): string {
    const found = USER_TYPES.find(t => t.value === (role || '').toLowerCase());
    return found ? found.label : (role || '—');
}

interface Office {
    id: string;
    building_name: string;
}

interface Team {
    id: string;
    name: string;
    office_id: string;
}

type DuplicateMatch = { id: string | number; name: string };

function formatPhoneNumber(input: string) {
    const cleaned = input.replace(/\D/g, '').slice(0, 10);
    if (cleaned.length >= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    if (cleaned.length >= 3) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    if (cleaned.length > 0) return `(${cleaned}`;
    return '';
}

function phoneDigitsOnly(input: string | null | undefined): string {
    return String(input || '').replace(/\D/g, '').slice(0, 10);
}

function isValidEmail(email: string): boolean {
    const trimmed = (email || '').trim();
    if (!trimmed) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function isValidPhone(phone: string): boolean {
    const trimmed = (phone || '').trim();
    if (!trimmed) return true;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length !== 10) return false;
    if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(trimmed)) return false;
    return isValidUSPhoneNumber(trimmed);
}

function duplicateCacheKey(
    type: 'email' | 'phone' | 'zoom',
    excludeId: string,
    value: string
): string {
    return `${type}|ex:${excludeId}|v:${value}`;
}

function ValidationIndicator({ valid }: { valid: boolean }) {
    return (
        <span className={`text-sm font-semibold ${valid ? 'text-green-500' : 'text-red-500'}`} aria-hidden>
            {valid ? '✔' : '*'}
        </span>
    );
}

export default function UserManagement() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'deactivated'>('active');
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch users from database
    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch('/api/users');
            const data = await response.json();
            console.log(data)

            if (data.success && data.users) {
                // Map backend user data to frontend User interface
                const mappedUsers: User[] = data.users.map((user: any) => {
                    // Split name into firstName and lastName
                    const nameParts = user.name ? user.name.trim().split(' ') : ['', ''];
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';

                    const backendUserId =
                        user.user_id ||
                        user.userId ||
                        null;

                    return {
                        id: String(user.id),
                        // Fall back to primary id when a separate user_id field is not present
                        userId: backendUserId ? String(backendUserId) : String(user.id),
                        firstName: firstName,
                        lastName: lastName,
                        email: user.email || '',
                        phone: formatPhoneNumber(user.phone || ''),
                        phone2: formatPhoneNumber(user.phone2 || ''),
                        zoomExtensionNumber: user.zoom_extension_number
                            ? String(user.zoom_extension_number)
                            : '',
                        officeId:
                            user.office_id != null && user.office_id !== ''
                                ? String(user.office_id)
                                : '',
                        teamId:
                            user.team_id != null && user.team_id !== ''
                                ? String(user.team_id)
                                : '',
                        title: user.title || '',
                        office: user.office_name || '',
                        team: user.team_name || '',
                        idNumber: user.id_number || '',
                        isAdmin: user.is_admin || false,
                        status: user.status !== false,
                        role: user.role || 'recruiter'
                    };
                });
                setUsers(mappedUsers);
            } else {
                setError(data.message || 'Failed to load users');
                setUsers([]);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to load users');
            setUsers([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch users on component mount
    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users by tab (active vs deactivated) then by search term
    const filteredUsers = users.filter(user => {
        const matchTab = activeTab === 'active' ? user.status === true : user.status === false;
        if (!matchTab) return false;
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase().trim();
        const searchableText = [
            user.userId,
            user.firstName,
            user.lastName,
            user.email,
            user.phone,
            user.zoomExtensionNumber,
            user.title,
            user.office,
            user.team,
            user.idNumber,
            user.role
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(term);
    });

    // Compute the next sequential primary key value based on existing users.
    // Uses the numeric `id` from the backend and falls back to "1" if none exist.
    const getNextIdNumber = (): string => {
        const numericIds = users
            .map((u) => parseInt((u.id || '').trim(), 10))
            .filter((n) => !Number.isNaN(n));
        const maxExisting = numericIds.length ? Math.max(...numericIds) : 0;
        return String(maxExisting + 1);
    };

    const handleAddUser = () => {
        setIsAddUserModalOpen(true);
    };

    const handleUserAdded = () => {
        // Refresh users list after adding a new user
        fetchUsers();
    };

    const handleGoBack = () => {
        router.push('/dashboard/admin');
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);

    const handleActivate = async (user: User) => {
        if (user.status) return;
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
        const confirmed = window.confirm(`Activate user "${fullName}"? They will be able to log in again.`);
        if (!confirmed) return;

        try {
            setUpdatingUserId(user.id);
            const response = await fetch(`/api/users/${user.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: true }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                alert(data.message || 'Failed to activate user');
                return;
            }
            setUsers(prev =>
                prev.map(u => (u.id === user.id ? { ...u, status: true } : u))
            );
        } catch (error) {
            console.error('Error activating user:', error);
            alert('Failed to activate user. Please try again.');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleRoleChange = async (user: User, newRole: string) => {
        if ((user.role || '').toLowerCase() === newRole.toLowerCase()) return;
        try {
            setUpdatingRoleUserId(user.id);
            const response = await fetch(`/api/users/${user.id}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                alert(data.message || 'Failed to update user type');
                return;
            }
            setUsers(prev =>
                prev.map(u => (u.id === user.id ? { ...u, role: newRole } : u))
            );
        } catch (error) {
            console.error('Error updating role:', error);
            alert('Failed to update user type. Please try again.');
        } finally {
            setUpdatingRoleUserId(null);
        }
    };

    const handleDeactivate = async (user: User) => {
        if (!user.status) return;
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
        const confirmed = window.confirm(`Deactivate user "${fullName}"? They will no longer be able to log in.`);
        if (!confirmed) return;

        try {
            setUpdatingUserId(user.id);
            const response = await fetch(`/api/users/${user.id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: false }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                alert(data.message || 'Failed to deactivate user');
                return;
            }

            // Update local state so UI reflects the change without full reload
            setUsers(prev =>
                prev.map(u => (u.id === user.id ? { ...u, status: false } : u))
            );
        } catch (error) {
            console.error('Error deactivating user:', error);
            alert('Failed to deactivate user. Please try again.');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const tableHeaders = [
        { id: 'firstName', label: 'First Name' },
        { id: 'userId', label: 'User ID' },
        { id: 'lastName', label: 'Last Name' },
        { id: 'email', label: 'Email' },
        { id: 'phone', label: 'Phone' },
        { id: 'phone2', label: 'Phone2' },
        { id: 'zoomExt', label: 'Zoom ext.' },
        { id: 'title', label: 'Title' },
        { id: 'office', label: 'Office' },
        { id: 'team', label: 'Team' },
        { id: 'idNumber', label: 'ID Number' },
        { id: 'userType', label: 'User Type' },
        { id: 'isAdmin', label: 'Is Admin' },
        { id: 'status', label: 'Status' },
        { id: 'actions', label: 'Actions' },
    ];

    return (
        <div className="bg-gray-100 min-h-screen">
            {/* Header area */}
            <div className="bg-white border-b border-gray-300 flex items-center justify-between p-4">
                <div className="flex items-center">
                    <div className="h-8 w-8 bg-gray-400 rounded-full mr-2 flex items-center justify-center">
                        <span className="text-white">U</span>
                    </div>
                    <h1 className="text-xl font-semibold">Users</h1>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleAddUser}
                        className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-100"
                    >
                        Add User
                    </button>
                    <button
                        onClick={fetchUsers}
                        className="p-2 rounded hover:bg-gray-200"
                        title="Refresh list"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button onClick={handleGoBack} className="p-2 rounded hover:bg-gray-200">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Search and tabs */}
            <div className="p-4 flex flex-wrap items-center gap-4">
                <div className="flex border border-gray-300 rounded-md overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 text-sm font-medium ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                        Active
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('deactivated')}
                        className={`px-4 py-2 text-sm font-medium ${activeTab === 'deactivated' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                        Deactivated
                    </button>
                </div>

                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearch}
                        placeholder="Find"
                        className="border border-gray-300 rounded px-3 py-2 w-56"
                    />
                    {searchTerm && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <button onClick={handleClearSearch} className="bg-gray-200 px-4 py-2 rounded text-gray-700 hover:bg-gray-300">
                    Clear
                </button>

                <div className="text-gray-500">
                    ( {filteredUsers.length} ) Records
                </div>
            </div>

            {/* Table */}
            <div className="px-4 pb-4">
                <div className="bg-white rounded-md shadow overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                {tableHeaders.map(header => (
                                    <th key={header.id} className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-gray-500">
                                        {header.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={tableHeaders.length} className="px-4 py-4 text-center text-gray-500">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={tableHeaders.length} className="whitespace-nowrap px-4 py-4 text-center">
                                        <div className="text-red-600 mb-2">{error}</div>
                                        <button
                                            onClick={fetchUsers}
                                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.firstName}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap font-mono text-gray-700">{user.userId || '—'}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.lastName}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap text-blue-600"><a href={`mailto:${user.email}`} className="hover:underline">{user.email}</a></td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.phone}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.phone2 || '-'}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap font-mono">{user.zoomExtensionNumber || '—'}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.title}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.office}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.team}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.idNumber}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                            <select
                                                value={(user.role || 'recruiter').toLowerCase()}
                                                onChange={(e) => handleRoleChange(user, e.target.value)}
                                                disabled={updatingRoleUserId === user.id}
                                                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white min-w-[140px] disabled:opacity-60"
                                            >
                                                {USER_TYPES.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {updatingRoleUserId === user.id && (
                                                <span className="ml-1 text-xs text-gray-500">Saving...</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{user.isAdmin ? 'Yes' : 'No'}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                            <span className={user.status ? 'text-green-600' : 'text-red-600'}>
                                                {user.status ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingUser(user)}
                                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                                                    title="Edit user"
                                                >
                                                    <Pencil size={14} />
                                                    Edit
                                                </button>
                                                {user.status ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeactivate(user)}
                                                        disabled={updatingUserId === user.id}
                                                        className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        {updatingUserId === user.id ? 'Deactivating...' : 'Deactivate'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleActivate(user)}
                                                        disabled={updatingUserId === user.id}
                                                        className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        {updatingUserId === user.id ? 'Activating...' : 'Activate'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={tableHeaders.length} className="px-4 py-4 text-center text-gray-500">
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add User Modal */}
            {isAddUserModalOpen && (
                <AddUserModal 
                    onClose={() => setIsAddUserModalOpen(false)} 
                    onUserAdded={handleUserAdded}
                    initialIdNumber={getNextIdNumber()}
                />
            )}
            {editingUser && (
                <EditUserModal
                    key={editingUser.id}
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSaved={() => {
                        fetchUsers();
                        setEditingUser(null);
                    }}
                />
            )}
        </div>
    );
}

// Add User Modal Component
function AddUserModal({
    onClose,
    onUserAdded,
    initialIdNumber,
}: {
    onClose: () => void;
    onUserAdded?: () => void;
    initialIdNumber?: string;
}) {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        phone2: '',
        zoomExtensionNumber: '',
        title: '',
        officeId: '',
        teamId: '',
        idNumber: initialIdNumber || '',
        userType: 'recruiter',
        isAdmin: false,
        password: '',
        confirmPassword: ''
    });

    // Passwords are always auto-generated; manual entry removed.
    const [createdPassword, setCreatedPassword] = useState<string | null>(null);
    const [offices, setOffices] = useState<Office[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadingOffices, setLoadingOffices] = useState(true);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [emailDupMatches, setEmailDupMatches] = useState<DuplicateMatch[]>([]);
    const [phoneDupMatches, setPhoneDupMatches] = useState<DuplicateMatch[]>([]);
    const [zoomDupMatches, setZoomDupMatches] = useState<DuplicateMatch[]>([]);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'ok' | 'duplicate'>('idle');
    const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'ok' | 'duplicate'>('idle');
    const [zoomExtStatus, setZoomExtStatus] = useState<'idle' | 'checking' | 'ok' | 'duplicate'>('idle');
    const emailDupResponseCache = useRef<Map<string, DuplicateMatch[]>>(new Map());
    const phoneDupResponseCache = useRef<Map<string, DuplicateMatch[]>>(new Map());
    const zoomDupResponseCache = useRef<Map<string, DuplicateMatch[]>>(new Map());

    const normalizedEmail = useMemo(() => formData.email.trim().toLowerCase(), [formData.email]);
    const normalizedPhone = useMemo(() => formData.phone.trim(), [formData.phone]);
    const normalizedPhoneDigits = useMemo(() => normalizedPhone.replace(/\D/g, ''), [normalizedPhone]);
    const normalizedZoomExt = useMemo(
        () => formData.zoomExtensionNumber.replace(/\D/g, '').trim(),
        [formData.zoomExtensionNumber]
    );

    const isEmailValid = useMemo(() => isValidEmail(normalizedEmail), [normalizedEmail]);
    const isPhoneValid = useMemo(() => isValidPhone(normalizedPhone), [normalizedPhone]);
    const isZoomExtValid = useMemo(
        () => normalizedZoomExt === '' || /^\d+$/.test(normalizedZoomExt),
        [normalizedZoomExt]
    );

    // Fetch offices and teams on component mount
    useEffect(() => {
        fetchOffices();
        fetchTeams();
    }, []);

    useEffect(() => {
        let timeoutId: number | undefined;
        let isCancelled = false;
        if (!normalizedEmail || !isEmailValid) {
            setEmailDupMatches([]);
            setEmailStatus(normalizedEmail ? 'idle' : 'idle');
            return () => {
                isCancelled = true;
            };
        }
        const cacheKey = duplicateCacheKey('email', '', normalizedEmail);
        const cached = emailDupResponseCache.current.get(cacheKey);
        if (cached) {
            setEmailDupMatches(cached);
            setEmailStatus(cached.length > 0 ? 'duplicate' : 'ok');
            return () => {
                isCancelled = true;
            };
        }
        const runCheck = async () => {
            try {
                setEmailStatus('checking');
                const params = new URLSearchParams();
                params.set('email', normalizedEmail);
                const res = await fetch(`/api/users/check-duplicates?${params.toString()}`);
                const data = await res.json();
                if (isCancelled) return;
                const matches = data.success && data.duplicates ? (data.duplicates.email ?? []) : [];
                emailDupResponseCache.current.set(cacheKey, matches);
                setEmailDupMatches(matches);
                setEmailStatus(matches.length > 0 ? 'duplicate' : 'ok');
            } catch {
                if (!isCancelled) {
                    setEmailDupMatches([]);
                    setEmailStatus('idle');
                }
            }
        };
        timeoutId = window.setTimeout(runCheck, 600);
        return () => {
            isCancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [normalizedEmail, isEmailValid]);

    useEffect(() => {
        let timeoutId: number | undefined;
        let isCancelled = false;
        if (!normalizedPhoneDigits || !isPhoneValid) {
            setPhoneDupMatches([]);
            setPhoneStatus('idle');
            return () => {
                isCancelled = true;
            };
        }
        const cacheKey = duplicateCacheKey('phone', '', normalizedPhoneDigits);
        const cached = phoneDupResponseCache.current.get(cacheKey);
        if (cached) {
            setPhoneDupMatches(cached);
            setPhoneStatus(cached.length > 0 ? 'duplicate' : 'ok');
            return () => {
                isCancelled = true;
            };
        }
        const runCheck = async () => {
            try {
                setPhoneStatus('checking');
                const params = new URLSearchParams();
                params.set('phone', normalizedPhoneDigits);
                const res = await fetch(`/api/users/check-duplicates?${params.toString()}`);
                const data = await res.json();
                if (isCancelled) return;
                const matches = data.success && data.duplicates ? (data.duplicates.phone ?? []) : [];
                phoneDupResponseCache.current.set(cacheKey, matches);
                setPhoneDupMatches(matches);
                setPhoneStatus(matches.length > 0 ? 'duplicate' : 'ok');
            } catch {
                if (!isCancelled) {
                    setPhoneDupMatches([]);
                    setPhoneStatus('idle');
                }
            }
        };
        timeoutId = window.setTimeout(runCheck, 600);
        return () => {
            isCancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [normalizedPhoneDigits, isPhoneValid]);

    useEffect(() => {
        let timeoutId: number | undefined;
        let isCancelled = false;
        if (!normalizedZoomExt || !isZoomExtValid) {
            setZoomDupMatches([]);
            setZoomExtStatus('idle');
            return () => {
                isCancelled = true;
            };
        }
        const cacheKey = duplicateCacheKey('zoom', '', normalizedZoomExt);
        const cached = zoomDupResponseCache.current.get(cacheKey);
        if (cached) {
            setZoomDupMatches(cached);
            setZoomExtStatus(cached.length > 0 ? 'duplicate' : 'ok');
            return () => {
                isCancelled = true;
            };
        }
        const runCheck = async () => {
            try {
                setZoomExtStatus('checking');
                const params = new URLSearchParams();
                params.set('zoomExtensionNumber', normalizedZoomExt);
                const res = await fetch(`/api/users/check-duplicates?${params.toString()}`);
                const data = await res.json();
                if (isCancelled) return;
                const matches =
                    data.success && data.duplicates ? (data.duplicates.zoomExtensionNumber ?? []) : [];
                zoomDupResponseCache.current.set(cacheKey, matches);
                setZoomDupMatches(matches);
                setZoomExtStatus(matches.length > 0 ? 'duplicate' : 'ok');
            } catch {
                if (!isCancelled) {
                    setZoomDupMatches([]);
                    setZoomExtStatus('idle');
                }
            }
        };
        timeoutId = window.setTimeout(runCheck, 600);
        return () => {
            isCancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [normalizedZoomExt, isZoomExtValid]);

    // Debug: Log when teams or officeId changes
    useEffect(() => {
        if (formData.officeId) {
            console.log('Office selected:', formData.officeId);
            console.log('All teams:', teams);
            console.log('Filtered teams:', filteredTeams);
        }
    }, [formData.officeId, teams, filteredTeams]);

    // Filter teams when office changes
    useEffect(() => {
        if (formData.officeId) {
            // Convert both to strings for comparison to handle type mismatches
            const officeIdStr = String(formData.officeId);
            const filtered = teams.filter(team => {
                // Handle both string and number types for office_id
                const teamOfficeId = team.office_id ? String(team.office_id) : null;
                return teamOfficeId === officeIdStr;
            });
            setFilteredTeams(filtered);
            // Reset team selection if current team doesn't belong to selected office
            if (formData.teamId && !filtered.find(team => String(team.id) === String(formData.teamId))) {
                setFormData(prev => ({ ...prev, teamId: '' }));
            }
        } else {
            setFilteredTeams([]);
            setFormData(prev => ({ ...prev, teamId: '' }));
        }
    }, [formData.officeId, teams]);

    const fetchOffices = async () => {
        try {
            setLoadingOffices(true);
            const response = await fetch('/api/offices');
            const data = await response.json();

            if (data.success) {
                setOffices(data.offices || []);
            } else {
                setError('Failed to load offices');
            }
        } catch (error) {
            console.error('Error fetching offices:', error);
            setError('Failed to load offices');
        } finally {
            setLoadingOffices(false);
        }
    };

    const fetchTeams = async () => {
        try {
            setLoadingTeams(true);
            const response = await fetch('/api/teams');
            const data = await response.json();

            if (data.success) {
                const teamsData = data.teams || [];
                console.log('Fetched teams data:', teamsData);
                console.log('Teams with office_id:', teamsData.map((t: Team) => ({ id: t.id, name: t.name, office_id: t.office_id })));
                setTeams(teamsData);
            } else {
                setError('Failed to load teams');
                console.error('Failed to load teams:', data);
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
            setError('Failed to load teams');
        } finally {
            setLoadingTeams(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        let nextValue: string | boolean = type === 'checkbox' ? checked : value;
        if (name === 'phone' || name === 'phone2') {
            nextValue = formatPhoneNumber(String(value));
        }
        if (name === 'zoomExtensionNumber') {
            nextValue = String(value).replace(/\D/g, '');
        }
        setFormData({
            ...formData,
            [name]: nextValue
        });
    };

    const isFormValid = useMemo(() => {
        const requiredFilled =
            formData.firstName.trim() !== '' &&
            formData.lastName.trim() !== '' &&
            formData.officeId.trim() !== '' &&
            formData.teamId.trim() !== '';
        if (!requiredFilled) return false;
        if (!isEmailValid || emailStatus === 'checking' || emailStatus === 'duplicate') return false;
        if (!isPhoneValid || phoneStatus === 'checking' || phoneStatus === 'duplicate') return false;
        if (!isZoomExtValid || zoomExtStatus === 'checking' || zoomExtStatus === 'duplicate') return false;
        return true;
    }, [
        formData.firstName,
        formData.lastName,
        formData.officeId,
        formData.teamId,
        isEmailValid,
        isPhoneValid,
        isZoomExtValid,
        emailStatus,
        phoneStatus,
        zoomExtStatus
    ]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.firstName || !formData.lastName || !formData.email) {
            setError('First name, last name, and email are required');
            return;
        }
        if (!isEmailValid) {
            setError('Enter a valid email address.');
            return;
        }
        if (!isPhoneValid) {
            setError('Enter a valid US phone number in format (###) ###-####.');
            return;
        }
        if (emailStatus === 'duplicate' || phoneStatus === 'duplicate' || zoomExtStatus === 'duplicate') {
            setError('Email, phone, or Zoom extension already exists for another user. Please review and fix before saving.');
            return;
        }
        if (!formData.officeId || !formData.teamId) {
            setError('Office and team selection are required');
            return;
        }

        setLoading(true);

        try {
            const zoomExtDigits = (formData.zoomExtensionNumber || '').replace(/\D/g, '').trim();
            const phoneDigits = phoneDigitsOnly(formData.phone);
            const phone2Digits = phoneDigitsOnly(formData.phone2);
            const body: Record<string, unknown> = {
                name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                userType: formData.userType,
                officeId: formData.officeId,
                teamId: formData.teamId,
                phone: phoneDigits || null,
                phone2: phone2Digits || null,
                ...(zoomExtDigits ? { zoomExtensionNumber: zoomExtDigits } : {}),
                title: formData.title,
                idNumber: formData.idNumber,
                isAdmin: ['admin', 'owner', 'developer', 'administrator'].includes(formData.userType)
            };
            // No manual password; backend will auto-generate a strong temporary password.

            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.success) {
                const plain = data.user?.plainPassword;
                if (plain) {
                    setLoading(false);
                    setCreatedPassword(plain);
                    return;
                }
                const createdUserId = data.user?.userId ?? data.user?.user_id ?? null;
                if (createdUserId) {
                    try {
                        await navigator.clipboard.writeText(createdUserId);
                    } catch (_) {}
                }
                onClose();
                if (onUserAdded) onUserAdded();
                else window.location.reload();
            } else {
                setError(data.message || 'Failed to create user');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClosePasswordModal = () => {
        setCreatedPassword(null);
        onClose();
        if (onUserAdded) onUserAdded();
        else window.location.reload();
    };

    if (createdPassword) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
                <div className="bg-white rounded-md shadow-lg max-w-md w-full mx-4 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Password generated</h3>
                    <p className="text-sm text-gray-600 mb-3">Show this password once. Copy it now; it will not be shown again.</p>
                    <div className="flex items-center gap-2 mb-4">
                        <code className="flex-1 px-3 py-2 bg-gray-100 rounded border text-sm break-all font-mono">
                            {createdPassword}
                        </code>
                        <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(createdPassword)}
                            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm whitespace-nowrap"
                        >
                            Copy
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleClosePasswordModal}
                        className="w-full px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
            <div className="bg-white rounded-md shadow-lg w-full max-w-4xl overflow-hidden">
                <div className="flex justify-between items-center bg-gray-100 p-4 border-b">
                    <h2 className="text-lg font-semibold">Add User</h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    First Name <ValidationIndicator valid={formData.firstName.trim() !== ''} />
                                </label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Last Name <ValidationIndicator valid={formData.lastName.trim() !== ''} />
                                </label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email <ValidationIndicator valid={isEmailValid} />
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {emailStatus === 'ok' && (
                                        <Tooltip
                                            text="Email is available"
                                            className="absolute right-2 top-1/2 -translate-y-1/2"
                                        >
                                            <span className="text-green-600 text-lg">✓</span>
                                        </Tooltip>
                                    )}
                                    {emailStatus === 'duplicate' && (
                                        <Tooltip
                                            text="Email already exists"
                                            className="absolute right-2 top-1/2 -translate-y-1/2"
                                        >
                                            <span className="text-red-600 text-lg">✕</span>
                                        </Tooltip>
                                    )}
                                </div>
                                {emailStatus === 'checking' && isEmailValid && (
                                    <p className="mt-2 text-xs text-gray-500">Checking for duplicates…</p>
                                )}
                                {!isEmailValid && formData.email.trim() !== '' && (
                                    <p className="mt-2 text-xs text-red-600">Enter a valid email address.</p>
                                )}
                                {emailDupMatches.length > 0 && (
                                    <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                        <div className="font-semibold mb-1">Possible duplicate user(s) detected</div>
                                        <div className="font-medium">Same email:</div>
                                        <ul className="list-disc list-inside">
                                            {emailDupMatches.map((u) => (
                                                <li key={`dup-email-${u.id}`}>{u.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone
                                </label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="(123) 456-7890"
                                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {phoneStatus === 'ok' && (
                                        <Tooltip
                                            text="Phone is available"
                                            className="absolute right-2 top-1/2 -translate-y-1/2"
                                        >
                                            <span className="text-green-600 text-lg">✓</span>
                                        </Tooltip>
                                    )}
                                    {phoneStatus === 'duplicate' && (
                                        <Tooltip
                                            text="Phone already exists"
                                            className="absolute right-2 top-1/2 -translate-y-1/2"
                                        >
                                            <span className="text-red-600 text-lg">✕</span>
                                        </Tooltip>
                                    )}
                                </div>
                                {phoneStatus === 'checking' && isPhoneValid && normalizedPhoneDigits !== '' && (
                                    <p className="mt-2 text-xs text-gray-500">Checking for duplicates…</p>
                                )}
                                {!isPhoneValid && normalizedPhoneDigits !== '' && (
                                    <p className="mt-2 text-xs text-red-600">
                                        Invalid phone. Use (###) ###-#### with valid US area/exchange code.
                                    </p>
                                )}
                                {phoneDupMatches.length > 0 && (
                                    <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                        <div className="font-semibold mb-1">Possible duplicate user(s) detected</div>
                                        <div className="font-medium">Same phone number:</div>
                                        <ul className="list-disc list-inside">
                                            {phoneDupMatches.map((u) => (
                                                <li key={`dup-phone-${u.id}`}>{u.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone2
                                </label>
                                <input
                                    type="tel"
                                    name="phone2"
                                    value={formData.phone2}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Zoom Phone extension
                                </label>
                                <p className="text-xs text-gray-500 mb-1">
                                    Internal extension (e.g. 8247) from Zoom Phone — used to match inbound calls to this user. Digits only; must be unique.
                                </p>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="zoomExtensionNumber"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        placeholder="e.g. 8247"
                                        value={formData.zoomExtensionNumber}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {zoomExtStatus === 'ok' && (formData.zoomExtensionNumber || '').replace(/\D/g, '').trim() !== '' && (
                                        <Tooltip
                                            text="Extension is available"
                                            className="absolute right-2 top-1/2 -translate-y-1/2"
                                        >
                                            <span className="text-green-600 text-lg">✓</span>
                                        </Tooltip>
                                    )}
                                    {zoomExtStatus === 'duplicate' && (
                                        <Tooltip
                                            text="Extension already assigned"
                                            className="absolute right-2 top-1/2 -translate-y-1/2"
                                        >
                                            <span className="text-red-600 text-lg">✕</span>
                                        </Tooltip>
                                    )}
                                </div>
                                {zoomExtStatus === 'checking' && normalizedZoomExt !== '' && (
                                    <p className="mt-2 text-xs text-gray-500">Checking for duplicates…</p>
                                )}
                                {zoomDupMatches.length > 0 && (
                                    <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                        <div className="font-semibold mb-1">Possible duplicate user(s) detected</div>
                                        <div className="font-medium">Same Zoom extension:</div>
                                        <ul className="list-disc list-inside">
                                            {zoomDupMatches.map((u) => (
                                                <li key={`dup-zoom-${u.id}`}>{u.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Office <ValidationIndicator valid={formData.officeId.trim() !== ''} />
                                </label>
                                <select
                                    name="officeId"
                                    value={formData.officeId}
                                    onChange={handleChange}
                                    required
                                    disabled={loadingOffices}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                >
                                    <option value="">
                                        {loadingOffices ? 'Loading offices...' : 'Select Office'}
                                    </option>
                                    {offices.map(office => (
                                        <option key={office.id} value={office.id}>
                                            {office.building_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Team <ValidationIndicator valid={formData.teamId.trim() !== ''} />
                                </label>
                                <select
                                    name="teamId"
                                    value={formData.teamId}
                                    onChange={handleChange}
                                    required
                                    disabled={!formData.officeId || loadingTeams}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                >
                                    <option value="">
                                        {!formData.officeId ? 'Select Office First' :
                                            loadingTeams ? 'Loading teams...' :
                                                filteredTeams.length === 0 ? 'No teams available for selected office' :
                                                    'Select Team'}
                                    </option>
                                    {filteredTeams.map(team => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                                {formData.officeId && filteredTeams.length === 0 && !loadingTeams && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        No teams found for this office. Please select a different office or create a team first.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ID Number
                                </label>
                                <input
                                    type="text"
                                    name="idNumber"
                                    value={formData.idNumber}
                                    readOnly
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                                    title="Next primary key value (auto-generated)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    User Type <ValidationIndicator valid={formData.userType.trim() !== ''} />
                                </label>
                                <select
                                    name="userType"
                                    value={formData.userType}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {USER_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    User ID
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value=""
                                    placeholder="Auto-generated on save"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                                    title="Generated by the system when you save (format: USR-YYYY-XXXX)"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <p className="text-sm text-gray-600">
                                    A strong temporary password will be auto-generated and sent to the user in their welcome email. They will be required to change it on first login.
                                </p>
                            </div>

                            <div className="col-span-2">
                                <p className="text-xs text-gray-500">
                                    Administrator, Owner, and Developer have elevated access. User type can be changed later from the user list.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded-md flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={loading || !isFormValid}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Processing...
                                    </>
                                ) : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function EditUserModal({
    user,
    onClose,
    onSaved,
}: {
    user: User;
    onClose: () => void;
    onSaved?: () => void;
}) {
    const [formData, setFormData] = useState({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: formatPhoneNumber(user.phone),
        phone2: formatPhoneNumber(user.phone2 || ''),
        zoomExtensionNumber: user.zoomExtensionNumber || '',
        title: user.title || '',
        officeId: user.officeId || '',
        teamId: user.teamId || '',
        idNumber: user.idNumber || '',
        userType: (user.role || 'recruiter').toLowerCase(),
        statusActive: user.status,
    });

    const [offices, setOffices] = useState<Office[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadingOffices, setLoadingOffices] = useState(true);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [emailDupMatches, setEmailDupMatches] = useState<DuplicateMatch[]>([]);
    const [phoneDupMatches, setPhoneDupMatches] = useState<DuplicateMatch[]>([]);
    const [zoomDupMatches, setZoomDupMatches] = useState<DuplicateMatch[]>([]);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'ok' | 'duplicate'>('idle');
    const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'ok' | 'duplicate'>('idle');
    const [zoomExtStatus, setZoomExtStatus] = useState<'idle' | 'checking' | 'ok' | 'duplicate'>('idle');
    const emailDupResponseCache = useRef<Map<string, DuplicateMatch[]>>(new Map());
    const phoneDupResponseCache = useRef<Map<string, DuplicateMatch[]>>(new Map());
    const zoomDupResponseCache = useRef<Map<string, DuplicateMatch[]>>(new Map());

    const normalizedEmail = useMemo(() => formData.email.trim().toLowerCase(), [formData.email]);
    const normalizedPhone = useMemo(() => formData.phone.trim(), [formData.phone]);
    const normalizedPhoneDigits = useMemo(() => normalizedPhone.replace(/\D/g, ''), [normalizedPhone]);
    const normalizedZoomExt = useMemo(
        () => formData.zoomExtensionNumber.replace(/\D/g, '').trim(),
        [formData.zoomExtensionNumber]
    );

    const isEmailValid = useMemo(() => isValidEmail(normalizedEmail), [normalizedEmail]);
    const isPhoneValid = useMemo(() => isValidPhone(normalizedPhone), [normalizedPhone]);
    const isZoomExtValid = useMemo(
        () => normalizedZoomExt === '' || /^\d+$/.test(normalizedZoomExt),
        [normalizedZoomExt]
    );

    useEffect(() => {
        const load = async () => {
            try {
                setLoadingOffices(true);
                const oRes = await fetch('/api/offices');
                const oData = await oRes.json();
                if (oData.success) setOffices(oData.offices || []);
            } catch {
                setError('Failed to load offices');
            } finally {
                setLoadingOffices(false);
            }
            try {
                setLoadingTeams(true);
                const tRes = await fetch('/api/teams');
                const tData = await tRes.json();
                if (tData.success) setTeams(tData.teams || []);
            } catch {
                setError('Failed to load teams');
            } finally {
                setLoadingTeams(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (formData.officeId) {
            const officeIdStr = String(formData.officeId);
            const filtered = teams.filter((team) => {
                const teamOfficeId = team.office_id ? String(team.office_id) : null;
                return teamOfficeId === officeIdStr;
            });
            setFilteredTeams(filtered);
            if (
                teams.length > 0 &&
                formData.teamId &&
                !filtered.find((team) => String(team.id) === String(formData.teamId))
            ) {
                setFormData((prev) => ({ ...prev, teamId: '' }));
            }
        } else {
            setFilteredTeams([]);
            setFormData((prev) => (prev.teamId ? { ...prev, teamId: '' } : prev));
        }
    }, [formData.officeId, formData.teamId, teams]);

    useEffect(() => {
        let timeoutId: number | undefined;
        let isCancelled = false;
        if (!normalizedEmail || !isEmailValid) {
            setEmailDupMatches([]);
            setEmailStatus('idle');
            return () => {
                isCancelled = true;
            };
        }
        const cacheKey = duplicateCacheKey('email', String(user.id), normalizedEmail);
        const cached = emailDupResponseCache.current.get(cacheKey);
        if (cached) {
            setEmailDupMatches(cached);
            setEmailStatus(cached.length > 0 ? 'duplicate' : 'ok');
            return () => {
                isCancelled = true;
            };
        }
        const runCheck = async () => {
            try {
                setEmailStatus('checking');
                const params = new URLSearchParams();
                params.set('email', normalizedEmail);
                params.set('excludeId', String(user.id));
                const res = await fetch(`/api/users/check-duplicates?${params.toString()}`);
                const data = await res.json();
                if (isCancelled) return;
                const matches = data.success && data.duplicates ? (data.duplicates.email ?? []) : [];
                emailDupResponseCache.current.set(cacheKey, matches);
                setEmailDupMatches(matches);
                setEmailStatus(matches.length > 0 ? 'duplicate' : 'ok');
            } catch {
                if (!isCancelled) {
                    setEmailDupMatches([]);
                    setEmailStatus('idle');
                }
            }
        };
        timeoutId = window.setTimeout(runCheck, 600);
        return () => {
            isCancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [normalizedEmail, isEmailValid, user.id]);

    useEffect(() => {
        let timeoutId: number | undefined;
        let isCancelled = false;
        if (!normalizedPhoneDigits || !isPhoneValid) {
            setPhoneDupMatches([]);
            setPhoneStatus('idle');
            return () => {
                isCancelled = true;
            };
        }
        const cacheKey = duplicateCacheKey('phone', String(user.id), normalizedPhoneDigits);
        const cached = phoneDupResponseCache.current.get(cacheKey);
        if (cached) {
            setPhoneDupMatches(cached);
            setPhoneStatus(cached.length > 0 ? 'duplicate' : 'ok');
            return () => {
                isCancelled = true;
            };
        }
        const runCheck = async () => {
            try {
                setPhoneStatus('checking');
                const params = new URLSearchParams();
                params.set('phone', normalizedPhoneDigits);
                params.set('excludeId', String(user.id));
                const res = await fetch(`/api/users/check-duplicates?${params.toString()}`);
                const data = await res.json();
                if (isCancelled) return;
                const matches = data.success && data.duplicates ? (data.duplicates.phone ?? []) : [];
                phoneDupResponseCache.current.set(cacheKey, matches);
                setPhoneDupMatches(matches);
                setPhoneStatus(matches.length > 0 ? 'duplicate' : 'ok');
            } catch {
                if (!isCancelled) {
                    setPhoneDupMatches([]);
                    setPhoneStatus('idle');
                }
            }
        };
        timeoutId = window.setTimeout(runCheck, 600);
        return () => {
            isCancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [normalizedPhoneDigits, isPhoneValid, user.id]);

    useEffect(() => {
        let timeoutId: number | undefined;
        let isCancelled = false;
        if (!normalizedZoomExt || !isZoomExtValid) {
            setZoomDupMatches([]);
            setZoomExtStatus('idle');
            return () => {
                isCancelled = true;
            };
        }
        const cacheKey = duplicateCacheKey('zoom', String(user.id), normalizedZoomExt);
        const cached = zoomDupResponseCache.current.get(cacheKey);
        if (cached) {
            setZoomDupMatches(cached);
            setZoomExtStatus(cached.length > 0 ? 'duplicate' : 'ok');
            return () => {
                isCancelled = true;
            };
        }
        const runCheck = async () => {
            try {
                setZoomExtStatus('checking');
                const params = new URLSearchParams();
                params.set('zoomExtensionNumber', normalizedZoomExt);
                params.set('excludeId', String(user.id));
                const res = await fetch(`/api/users/check-duplicates?${params.toString()}`);
                const data = await res.json();
                if (isCancelled) return;
                const matches =
                    data.success && data.duplicates ? (data.duplicates.zoomExtensionNumber ?? []) : [];
                zoomDupResponseCache.current.set(cacheKey, matches);
                setZoomDupMatches(matches);
                setZoomExtStatus(matches.length > 0 ? 'duplicate' : 'ok');
            } catch {
                if (!isCancelled) {
                    setZoomDupMatches([]);
                    setZoomExtStatus('idle');
                }
            }
        };
        timeoutId = window.setTimeout(runCheck, 600);
        return () => {
            isCancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [normalizedZoomExt, isZoomExtValid, user.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) => ({ ...prev, [name]: checked }));
        } else {
            let nextValue = value;
            if (name === 'phone' || name === 'phone2') {
                nextValue = formatPhoneNumber(value);
            }
            if (name === 'zoomExtensionNumber') {
                nextValue = value.replace(/\D/g, '');
            }
            setFormData((prev) => ({ ...prev, [name]: nextValue }));
        }
    };

    const officeTeamRequired = ['recruiter', 'candidate'].includes(formData.userType);
    const isFormValid = useMemo(() => {
        const requiredIdentity =
            formData.firstName.trim() !== '' &&
            formData.lastName.trim() !== '' &&
            formData.userType.trim() !== '' &&
            isEmailValid;
        if (!requiredIdentity) return false;
        if (!isPhoneValid || !isZoomExtValid) return false;
        if (officeTeamRequired && (!formData.officeId.trim() || !formData.teamId.trim())) return false;
        if (emailStatus === 'checking' || phoneStatus === 'checking' || zoomExtStatus === 'checking') return false;
        if (emailStatus === 'duplicate' || phoneStatus === 'duplicate' || zoomExtStatus === 'duplicate') return false;
        return true;
    }, [
        formData.firstName,
        formData.lastName,
        formData.userType,
        formData.officeId,
        formData.teamId,
        officeTeamRequired,
        isEmailValid,
        isPhoneValid,
        isZoomExtValid,
        emailStatus,
        phoneStatus,
        zoomExtStatus
    ]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.firstName || !formData.lastName || !formData.email) {
            setError('First name, last name, and email are required');
            return;
        }
        if (!isEmailValid) {
            setError('Enter a valid email address.');
            return;
        }
        if (!isPhoneValid) {
            setError('Enter a valid US phone number in format (###) ###-####.');
            return;
        }
        if (emailStatus === 'duplicate' || phoneStatus === 'duplicate' || zoomExtStatus === 'duplicate') {
            setError('Email, phone, or Zoom extension conflicts with another user. Fix before saving.');
            return;
        }
        if (officeTeamRequired && (!formData.officeId || !formData.teamId)) {
            setError('Office and team are required for recruiters and candidates');
            return;
        }

        setLoading(true);
        try {
            const zoomExtDigits = (formData.zoomExtensionNumber || '').replace(/\D/g, '').trim();
            const phoneDigits = phoneDigitsOnly(formData.phone);
            const phone2Digits = phoneDigitsOnly(formData.phone2);
            const body = {
                name: `${formData.firstName} ${formData.lastName}`.trim(),
                email: formData.email,
                phone: phoneDigits || null,
                phone2: phone2Digits || null,
                title: formData.title || null,
                idNumber: formData.idNumber || null,
                officeId: formData.officeId || null,
                teamId: formData.teamId || null,
                zoomExtensionNumber: zoomExtDigits || null,
                role: formData.userType,
                status: formData.statusActive,
            };

            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                setError(data.message || 'Failed to update user');
                return;
            }
            if (onSaved) onSaved();
        } catch {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999]">
            <div className="bg-white rounded-md shadow-lg w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center bg-gray-100 p-4 border-b shrink-0">
                    <h2 className="text-lg font-semibold">Edit User</h2>
                    <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    First Name <ValidationIndicator valid={formData.firstName.trim() !== ''} />
                                </label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Last Name <ValidationIndicator valid={formData.lastName.trim() !== ''} />
                                </label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email <ValidationIndicator valid={isEmailValid} />
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {emailStatus === 'ok' && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 text-lg">
                                            ✓
                                        </span>
                                    )}
                                    {emailStatus === 'duplicate' && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 text-lg">
                                            ✕
                                        </span>
                                    )}
                                </div>
                                {emailStatus === 'checking' && isEmailValid && (
                                    <p className="mt-2 text-xs text-gray-500">Checking for duplicates…</p>
                                )}
                                {!isEmailValid && formData.email.trim() !== '' && (
                                    <p className="mt-2 text-xs text-red-600">Enter a valid email address.</p>
                                )}
                                {emailDupMatches.length > 0 && (
                                    <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                        <div className="font-semibold mb-1">Possible duplicate user(s) detected</div>
                                        <div className="font-medium">Same email:</div>
                                        <ul className="list-disc list-inside">
                                            {emailDupMatches.map((u) => (
                                                <li key={`e-${u.id}`}>{u.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="(123) 456-7890"
                                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {phoneStatus === 'ok' && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 text-lg">
                                            ✓
                                        </span>
                                    )}
                                    {phoneStatus === 'duplicate' && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 text-lg">
                                            ✕
                                        </span>
                                    )}
                                </div>
                                {phoneStatus === 'checking' && isPhoneValid && normalizedPhoneDigits !== '' && (
                                    <p className="mt-2 text-xs text-gray-500">Checking for duplicates…</p>
                                )}
                                {!isPhoneValid && normalizedPhoneDigits !== '' && (
                                    <p className="mt-2 text-xs text-red-600">
                                        Invalid phone. Use (###) ###-#### with valid US area/exchange code.
                                    </p>
                                )}
                                {phoneDupMatches.length > 0 && (
                                    <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                        <div className="font-semibold mb-1">Possible duplicate user(s) detected</div>
                                        <div className="font-medium">Same phone number:</div>
                                        <ul className="list-disc list-inside">
                                            {phoneDupMatches.map((u) => (
                                                <li key={`p-${u.id}`}>{u.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone2</label>
                                <input
                                    type="tel"
                                    name="phone2"
                                    value={formData.phone2}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Zoom Phone extension
                                </label>
                                <p className="text-xs text-gray-500 mb-1">Digits only; unique per user.</p>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="zoomExtensionNumber"
                                        inputMode="numeric"
                                        value={formData.zoomExtensionNumber}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {zoomExtStatus === 'ok' &&
                                        (formData.zoomExtensionNumber || '').replace(/\D/g, '').trim() !== '' && (
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 text-lg">
                                                ✓
                                            </span>
                                        )}
                                    {zoomExtStatus === 'duplicate' && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 text-lg">
                                            ✕
                                        </span>
                                    )}
                                </div>
                                {zoomExtStatus === 'checking' && normalizedZoomExt !== '' && (
                                    <p className="mt-2 text-xs text-gray-500">Checking for duplicates…</p>
                                )}
                                {zoomDupMatches.length > 0 && (
                                    <div className="mt-2 p-3 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-900">
                                        <div className="font-semibold mb-1">Possible duplicate user(s) detected</div>
                                        <div className="font-medium">Same Zoom extension:</div>
                                        <ul className="list-disc list-inside">
                                            {zoomDupMatches.map((u) => (
                                                <li key={`z-${u.id}`}>{u.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Office {officeTeamRequired && <ValidationIndicator valid={formData.officeId.trim() !== ''} />}
                                </label>
                                <select
                                    name="officeId"
                                    value={formData.officeId}
                                    onChange={handleChange}
                                    required={officeTeamRequired}
                                    disabled={loadingOffices}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                >
                                    <option value="">
                                        {loadingOffices ? 'Loading…' : 'Select office'}
                                    </option>
                                    {offices.map((office) => (
                                        <option key={office.id} value={office.id}>
                                            {office.building_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Team {officeTeamRequired && <ValidationIndicator valid={formData.teamId.trim() !== ''} />}
                                </label>
                                <select
                                    name="teamId"
                                    value={formData.teamId}
                                    onChange={handleChange}
                                    required={officeTeamRequired}
                                    disabled={!formData.officeId || loadingTeams}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                >
                                    <option value="">
                                        {!formData.officeId
                                            ? 'Select office first'
                                            : loadingTeams
                                              ? 'Loading…'
                                              : filteredTeams.length === 0
                                                ? 'No teams'
                                                : 'Select team'}
                                    </option>
                                    {filteredTeams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                                <input
                                    type="text"
                                    name="idNumber"
                                    value={formData.idNumber}
                                    readOnly
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={user.userId || ''}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    User type <ValidationIndicator valid={formData.userType.trim() !== ''} />
                                </label>
                                <select
                                    name="userType"
                                    value={formData.userType}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {USER_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pt-6">
                                <input
                                    id="edit-user-status-active"
                                    type="checkbox"
                                    name="statusActive"
                                    checked={formData.statusActive}
                                    onChange={handleChange}
                                    className="h-4 w-4"
                                />
                                <label htmlFor="edit-user-status-active" className="text-sm font-medium text-gray-700">
                                    Account active (can sign in)
                                </label>
                            </div>

                            <div className="col-span-2">
                                <p className="text-xs text-gray-500">
                                    Password cannot be changed here — use the password reset flow if needed.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !isFormValid}
                                className="px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : 'Save changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}