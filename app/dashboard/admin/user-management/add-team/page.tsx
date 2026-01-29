'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiRefreshCw, FiX, FiChevronDown } from 'react-icons/fi';

interface Team {
    id: string;
    name: string;
    office_name: string;
    office_id: string;
}

interface Office {
    id: string;
    building_name: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

export default function TeamManagement() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState('Enabled');
    const [teams, setTeams] = useState<Team[]>([]);
    const [offices, setOffices] = useState<Office[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

    // Fetch teams and offices on component mount
    useEffect(() => {
        fetchTeams();
        fetchOffices();
    }, []);

    const fetchTeams = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/teams');
            const data = await response.json();

            if (data.success) {
                setTeams(data.teams || []);
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOffices = async () => {
        try {
            const response = await fetch('/api/offices');
            const data = await response.json();

            if (data.success) {
                setOffices(data.offices || []);
            }
        } catch (error) {
            console.error('Error fetching offices:', error);
        }
    };

    // Filter teams based on search term
    const filteredTeams = teams.filter(team => {
        const searchableFields = [team.name, team.office_name].join(' ').toLowerCase();
        return searchableFields.includes(searchTerm.toLowerCase());
    });

    const handleAddTeam = () => {
        setIsAddTeamModalOpen(true);
    };

    const handleGoBack = () => {
        router.push('/dashboard/admin/user-management');
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const handleSelectTeam = (id: string) => {
        setSelectedTeam(id);
    };

    return (
        <div className="bg-gray-100 min-h-screen">
            {/* Header area */}
            <div className="bg-white border-b border-gray-300 flex items-center justify-between p-4">
                <div className="flex items-center">
                    <div className="h-8 w-8 bg-gray-400 rounded-full mr-2 flex items-center justify-center">
                        <span className="text-white">T</span>
                    </div>
                    <h1 className="text-xl font-semibold">Teams</h1>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleAddTeam}
                        className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-100"
                    >
                        Add Team
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
                    ( {filteredTeams.length} ) Records
                </div>
            </div>

            {/* Table */}
            <div className="px-4 pb-4">
                <div className="bg-white p-4">
                    <table className="min-w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-2 px-3 border-b font-normal">Name</th>
                                <th className="text-left py-2 px-3 border-b font-normal">Office</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={2} className="py-4 text-center text-gray-500">Loading teams...</td>
                                </tr>
                            ) : filteredTeams.length > 0 ? (
                                filteredTeams.map(team => (
                                    <tr key={team.id}
                                        className={`hover:bg-gray-50 cursor-pointer ${selectedTeam === team.id ? 'bg-gray-100' : ''}`}
                                        onClick={() => handleSelectTeam(team.id)}
                                    >
                                        <td className="py-2 px-3">{team.name}</td>
                                        <td className="py-2 px-3">{team.office_name}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={2} className="py-4 text-center text-gray-500">No teams found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Team Modal */}
            {isAddTeamModalOpen && (
                <AddTeamModal
                    offices={offices}
                    onClose={() => setIsAddTeamModalOpen(false)}
                    onTeamAdded={fetchTeams}
                />
            )}

            {/* Team Detail Section */}
            {selectedTeam && (
                <TeamDetail
                    teamId={selectedTeam}
                    teamName={teams.find(t => t.id === selectedTeam)?.name || ''}
                />
            )}
        </div>
    );
}

function TeamDetail({ teamId, teamName }: { teamId: string, teamName: string }) {
    const [users, setUsers] = useState<User[]>([]);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [showTeamDetail, setShowTeamDetail] = useState(true);

    useEffect(() => {
        fetchTeamMembers();
    }, [teamId]);

    const fetchTeamMembers = async () => {
        try {
            const response = await fetch(`/api/teams/${teamId}/members`);
            const data = await response.json();

            if (data.success) {
                setUsers(data.members.map((member: any) => ({
                    id: member.user_id,
                    name: member.user_name
                })));
            }
        } catch (error) {
            console.error('Error fetching team members:', error);
        }
    };

    const handleAddUser = () => {
        setIsAddingUser(true);
    };

    const handleCancelAddUser = () => {
        setIsAddingUser(false);
        setNewUserName('');
    };

    const handleSubmitNewUser = async () => {
        if (newUserName.trim()) {
            try {
                const response = await fetch(`/api/teams/${teamId}/members`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userName: newUserName,
                        role: 'member'
                    })
                });

                if (response.ok) {
                    fetchTeamMembers();
                }
            } catch (error) {
                console.error('Error adding team member:', error);
            }
        }
        setIsAddingUser(false);
        setNewUserName('');
    };

    const handleRemoveUser = async (userId: string) => {
        try {
            const response = await fetch(`/api/teams/${teamId}/members/${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setUsers(users.filter(user => user.id !== userId));
            }
        } catch (error) {
            console.error('Error removing team member:', error);
        }
    };

    const handleClose = () => {
        setShowTeamDetail(false);
    };

    if (!showTeamDetail) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-md shadow-lg w-full max-w-3xl overflow-hidden">
                <div className="flex justify-between items-center bg-gray-100 p-4 border-b">
                    <h2 className="text-lg font-semibold">Team Details</h2>
                    <button onClick={handleClose} className="p-1 rounded hover:bg-gray-200">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    <h2 className="font-bold mb-4">Users on {teamName}</h2>
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={handleAddUser}
                            className="text-green-500 font-medium"
                        >
                            Add User
                        </button>
                    </div>

                    <div className="border-t border-b">
                        {users.map(user => (
                            <div key={user.id} className="flex justify-between items-center py-2 px-4 border-b">
                                <span>{user.name}</span>
                                <button
                                    onClick={() => handleRemoveUser(user.id)}
                                    className="text-red-500 font-medium"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>

                    {isAddingUser && (
                        <div className="mt-4">
                            <h3 className="mb-2">Name</h3>
                            <input
                                type="text"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                                placeholder="Full name as you would like it to appear"
                                className="w-full px-4 py-2 border rounded"
                                autoFocus
                            />
                            <div className="mt-2 flex space-x-2">
                                <button
                                    onClick={handleSubmitNewUser}
                                    className="px-4 py-2 bg-black text-white rounded"
                                >
                                    Submit
                                </button>
                                <button
                                    onClick={handleCancelAddUser}
                                    className="px-4 py-2 text-gray-600 rounded"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 bg-black text-white rounded"
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Add Team Modal Component
function AddTeamModal({
    offices,
    onClose,
    onTeamAdded
}: {
    offices: Office[],
    onClose: () => void,
    onTeamAdded: () => void
}) {
    const [step, setStep] = useState(1);
    const [teamData, setTeamData] = useState({
        name: '',
        officeId: '',
        description: ''
    });
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [newUserName, setNewUserName] = useState('');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Simulate API call to fetch available users
        const sampleUsers: User[] = [
            { id: 'U1001', name: 'User 1', email: 'user1@example.com' },
            { id: 'U1002', name: 'User 2', email: 'user2@example.com' },
            { id: 'U1003', name: 'User 3', email: 'user3@example.com' }
        ];
        setAvailableUsers(sampleUsers);
    }, []);

    const handleNextStep = () => {
        if (step === 1 && (!teamData.name.trim() || !teamData.officeId)) {
            setError('Team name and office selection are required');
            return;
        }
        setError('');
        setStep(step + 1);
    };

    const handlePrevStep = () => {
        setStep(step - 1);
        setError('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTeamData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAddUser = () => {
        setIsAddingUser(true);
    };

    const handleCancelAddUser = () => {
        setIsAddingUser(false);
        setNewUserName('');
    };

    const handleSubmitNewUser = () => {
        if (newUserName.trim()) {
            const newUser = {
                id: `U${Date.now()}`,
                name: newUserName,
                email: `${newUserName.toLowerCase().replace(' ', '.')}@example.com`
            };
            setSelectedUsers([...selectedUsers, newUser]);
        }
        setIsAddingUser(false);
        setNewUserName('');
    };

    const handleRemoveUser = (userId: string) => {
        setSelectedUsers(selectedUsers.filter(user => user.id !== userId));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            // Create team
            const response = await fetch('/api/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: teamData.name,
                    officeId: teamData.officeId,
                    description: teamData.description
                })
            });

            const data = await response.json();

            if (data.success) {
                // Add team members if any
                if (selectedUsers.length > 0) {
                    for (const user of selectedUsers) {
                        await fetch(`/api/teams/${data.team.id}/members`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                userId: user.id,
                                role: 'member'
                            })
                        });
                    }
                }

                onTeamAdded();
                onClose();
            } else {
                setError(data.message || 'Failed to create team');
            }
        } catch (error) {
            setError('An error occurred while creating the team');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-md shadow-lg w-full max-w-3xl overflow-hidden">
                <div className="flex justify-between items-center bg-gray-100 p-4 border-b">
                    <h2 className="text-lg font-semibold">Add Team</h2>
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

                    {step === 1 && (
                        <>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Team Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={teamData.name}
                                        onChange={handleChange}
                                        placeholder="Enter team name"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Office <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="officeId"
                                        value={teamData.officeId}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select Office</option>
                                        {offices.map(office => (
                                            <option key={office.id} value={office.id}>
                                                {office.building_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <textarea
                                        name="description"
                                        value={teamData.description}
                                        onChange={handleChange}
                                        placeholder="Enter team description (optional)"
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end space-x-4">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleNextStep}
                                    className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md"
                                    disabled={!teamData.name.trim() || !teamData.officeId}
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <h2 className="font-bold mb-4">Users on {teamData.name}</h2>
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={handleAddUser}
                                    className="text-green-500 font-medium"
                                >
                                    Add User
                                </button>
                            </div>

                            <div className="border-t border-b">
                                {selectedUsers.map(user => (
                                    <div key={user.id} className="flex justify-between items-center py-2 px-4 border-b">
                                        <span>{user.name}</span>
                                        <button
                                            onClick={() => handleRemoveUser(user.id)}
                                            className="text-red-500 font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                {selectedUsers.length === 0 && (
                                    <div className="py-4 px-4 text-gray-500 text-center">
                                        No users added yet
                                    </div>
                                )}
                            </div>

                            {isAddingUser && (
                                <div className="mt-4">
                                    <h3 className="mb-2">Name</h3>
                                    <input
                                        type="text"
                                        value={newUserName}
                                        onChange={(e) => setNewUserName(e.target.value)}
                                        placeholder="Full name as you would like it to appear"
                                        className="w-full px-4 py-2 border rounded"
                                        autoFocus
                                    />
                                    <div className="mt-2 flex space-x-2">
                                        <button
                                            onClick={handleSubmitNewUser}
                                            className="px-4 py-2 bg-black text-white rounded"
                                        >
                                            Submit
                                        </button>
                                        <button
                                            onClick={handleCancelAddUser}
                                            className="px-4 py-2 text-gray-600 rounded"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 flex justify-between">
                                <button
                                    onClick={handlePrevStep}
                                    className="px-4 py-2 text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-md"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md flex items-center"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Creating...
                                        </>
                                    ) : 'Create Team'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}