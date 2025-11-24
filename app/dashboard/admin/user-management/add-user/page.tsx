'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiRefreshCw, FiSearch, FiChevronDown, FiX } from 'react-icons/fi';

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phone2?: string;
    title: string;
    office: string;
    team: string;
    idNumber: string;
    isAdmin: boolean;
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

export default function UserManagement() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState('Enabled');
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

                    return {
                        id: String(user.id),
                        firstName: firstName,
                        lastName: lastName,
                        email: user.email || '',
                        phone: user.phone || '',
                        phone2: user.phone2 || '',
                        title: user.title || '',
                        office: user.office_name || '',
                        team: user.team_name || '',
                        idNumber: user.id_number || '',
                        isAdmin: user.is_admin || false
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

    // Filter users based on search term
    const filteredUsers = users.filter(user => {
        const searchableFields = [
            user.firstName,
            user.lastName,
            user.email,
            user.phone,
            user.title,
            user.office,
            user.team,
            user.idNumber
        ].join(' ').toLowerCase();

        return searchableFields.includes(searchTerm.toLowerCase());
    });

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

    const handleFilterChange = (status: string) => {
        setFilterStatus(status);
    };

    const tableHeaders = [
        { id: 'firstName', label: 'First Name' },
        { id: 'lastName', label: 'Last Name' },
        { id: 'email', label: 'Email' },
        { id: 'phone', label: 'Phone' },
        { id: 'phone2', label: 'Phone2' },
        { id: 'title', label: 'Title' },
        { id: 'office', label: 'Office' },
        { id: 'team', label: 'Team' },
        { id: 'idNumber', label: 'ID Number' },
        { id: 'isAdmin', label: 'Is Admin' }
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
                    <button className="p-2 rounded hover:bg-gray-200">
                        <FiRefreshCw size={18} />
                    </button>
                    <button onClick={handleGoBack} className="p-2 rounded hover:bg-gray-200">
                        <FiX size={18} />
                    </button>
                </div>
            </div>

            {/* Search and filter area */}
            <div className="p-4 flex items-center space-x-4">
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
                            <FiX size={16} />
                        </button>
                    )}
                </div>

                <button onClick={handleClearSearch} className="bg-gray-200 px-4 py-2 rounded text-gray-700 hover:bg-gray-300">
                    Clear
                </button>

                <div className="relative">
                    <button className="bg-white border border-gray-300 px-4 py-2 rounded flex items-center">
                        {filterStatus}
                        <FiChevronDown className="ml-2" />
                    </button>
                </div>

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
                                    <th key={header.id} className="px-4 py-3 text-left text-sm font-medium text-gray-500">
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
                                    <td colSpan={tableHeaders.length} className="px-4 py-4 text-center">
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
                                        <td className="px-4 py-3 text-sm">{user.firstName}</td>
                                        <td className="px-4 py-3 text-sm">{user.lastName}</td>
                                        <td className="px-4 py-3 text-sm text-blue-600">{user.email}</td>
                                        <td className="px-4 py-3 text-sm">{user.phone}</td>
                                        <td className="px-4 py-3 text-sm">{user.phone2 || '-'}</td>
                                        <td className="px-4 py-3 text-sm">{user.title}</td>
                                        <td className="px-4 py-3 text-sm">{user.office}</td>
                                        <td className="px-4 py-3 text-sm">{user.team}</td>
                                        <td className="px-4 py-3 text-sm">{user.idNumber}</td>
                                        <td className="px-4 py-3 text-sm">{user.isAdmin ? 'Yes' : 'No'}</td>
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
                />
            )}
        </div>
    );
}

// Add User Modal Component
function AddUserModal({ onClose, onUserAdded }: { onClose: () => void; onUserAdded?: () => void }) {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        phone2: '',
        title: '',
        officeId: '',
        teamId: '',
        idNumber: '',
        isAdmin: false,
        password: '',
        confirmPassword: ''
    });

    const [offices, setOffices] = useState<Office[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadingOffices, setLoadingOffices] = useState(true);
    const [loadingTeams, setLoadingTeams] = useState(false);

    // Fetch offices and teams on component mount
    useEffect(() => {
        fetchOffices();
        fetchTeams();
    }, []);

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
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate form
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
            setError('First name, last name, email, and password are required');
            return;
        }

        if (!formData.officeId || !formData.teamId) {
            setError('Office and team selection are required');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `${formData.firstName} ${formData.lastName}`,
                    email: formData.email,
                    password: formData.password,
                    userType: 'recruiter', // Default role
                    officeId: formData.officeId,
                    teamId: formData.teamId,
                    phone: formData.phone,
                    phone2: formData.phone2,
                    title: formData.title,
                    idNumber: formData.idNumber,
                    isAdmin: formData.isAdmin
                })
            });

            const data = await response.json();

            if (data.success) {
                onClose();
                // Call the callback to refresh users list
                if (onUserAdded) {
                    onUserAdded();
                } else {
                    // Fallback to page reload if callback not provided
                    window.location.reload();
                }
            } else {
                setError(data.message || 'Failed to create user');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-md shadow-lg w-full max-w-4xl overflow-hidden">
                <div className="flex justify-between items-center bg-gray-100 p-4 border-b">
                    <h2 className="text-lg font-semibold">Add User</h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-200">
                        <FiX size={20} />
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
                                    First Name <span className="text-red-500">*</span>
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
                                    Last Name <span className="text-red-500">*</span>
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
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
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
                                    Office <span className="text-red-500">*</span>
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
                                    Team <span className="text-red-500">*</span>
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
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Confirm Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="flex items-center space-x-2 mt-4">
                                    <input
                                        type="checkbox"
                                        name="isAdmin"
                                        checked={formData.isAdmin}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Administrator</span>
                                </label>
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
                                className="px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded-md flex items-center"
                                disabled={loading}
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