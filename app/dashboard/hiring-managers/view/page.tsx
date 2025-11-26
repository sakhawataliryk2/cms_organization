'use client'

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';

export default function HiringManagerView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('summary');

    // Add states for hiring manager data
    const [hiringManager, setHiringManager] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Notes and history state
    const [notes, setNotes] = useState<Array<any>>([]);
    const [history, setHistory] = useState<Array<any>>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    const [newNote, setNewNote] = useState('');

    const hiringManagerId = searchParams.get('id');

    // Fetch hiring manager when component mounts
    useEffect(() => {
        if (hiringManagerId) {
            fetchHiringManager(hiringManagerId);
        }
    }, [hiringManagerId]);

    // Function to fetch hiring manager data
    const fetchHiringManager = async (id: string) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Fetching hiring manager data for ID: ${id}`);
            const response = await fetch(`/api/hiring-managers/${id}`, {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            console.log(`API Response status: ${response.status}`);

            const responseText = await response.text();
            let data;

            try {
                data = JSON.parse(responseText);
            } catch (error) {
                const parseError = error as Error;
                console.error('Error parsing response:', parseError);
                console.error('Raw response:', responseText.substring(0, 200));
                throw new Error(`Failed to parse API response: ${parseError.message}`);
            }

            if (!response.ok) {
                throw new Error(data.message || `Failed to fetch hiring manager: ${response.status}`);
            }

            console.log('Hiring manager data received:', data);

            if (!data.hiringManager) {
                throw new Error('No hiring manager data received from API');
            }

            // Format the hiring manager data for display
            const hm = data.hiringManager;
            const formattedHiringManager = {
                id: hm.id || 'Unknown ID',
                firstName: hm.first_name || '',
                lastName: hm.last_name || '',
                fullName: hm.full_name || `${hm.last_name || ''}, ${hm.first_name || ''}`,
                title: hm.title || 'Not specified',
                phone: hm.phone || '(Not provided)',
                mobilePhone: hm.mobile_phone || '(Not provided)',
                directLine: hm.direct_line || '(Not provided)',
                email: hm.email || '(Not provided)',
                email2: hm.email2 || '',
                organization: {
                    name: hm.organization_name || hm.organization_name_from_org || 'Not specified',
                    status: 'Active',
                    phone: '(Not provided)',
                    url: 'https://example.com'
                },
                status: hm.status || 'Active',
                department: hm.department || 'Not specified',
                reportsTo: hm.reports_to || 'Not specified',
                owner: hm.owner || 'Not assigned',
                secondaryOwners: hm.secondary_owners || 'None',
                linkedinUrl: hm.linkedin_url || 'Not provided',
                dateAdded: hm.date_added ? new Date(hm.date_added).toLocaleDateString() :
                    hm.created_at ? new Date(hm.created_at).toLocaleDateString() : 'Unknown',
                address: hm.address || 'No address provided'
            };

            console.log('Formatted hiring manager data:', formattedHiringManager);
            setHiringManager(formattedHiringManager);

            // Now fetch notes and history
            fetchNotes(id);
            fetchHistory(id);
        } catch (err) {
            console.error('Error fetching hiring manager:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching hiring manager details');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch notes for the hiring manager
    const fetchNotes = async (id: string) => {
        setIsLoadingNotes(true);

        try {
            const response = await fetch(`/api/hiring-managers/${id}/notes`, {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch notes');
            }

            const data = await response.json();
            setNotes(data.notes || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setIsLoadingNotes(false);
        }
    };

    // Fetch history for the hiring manager
    const fetchHistory = async (id: string) => {
        setIsLoadingHistory(true);

        try {
            const response = await fetch(`/api/hiring-managers/${id}/history`, {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch history');
            }

            const data = await response.json();
            setHistory(data.history || []);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Handle adding a new note
    const handleAddNote = async () => {
        if (!newNote.trim() || !hiringManagerId) return;

        try {
            const response = await fetch(`/api/hiring-managers/${hiringManagerId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({ text: newNote })
            });

            if (!response.ok) {
                throw new Error('Failed to add note');
            }

            const data = await response.json();

            // Add the new note to the list
            setNotes([data.note, ...notes]);

            // Clear the form
            setNewNote('');
            setShowAddNote(false);

            // Refresh history
            fetchHistory(hiringManagerId);
        } catch (err) {
            console.error('Error adding note:', err);
            alert('Failed to add note. Please try again.');
        }
    };

    const handleGoBack = () => {
        router.back();
    };

    const handleEdit = () => {
        if (hiringManagerId) {
            router.push(`/dashboard/hiring-managers/add?id=${hiringManagerId}`);
        }
    };

    const handleActionSelected = (action: string) => {
        console.log(`Action selected: ${action}`);
        if (action === 'edit') {
            handleEdit();
        } else if (action === 'delete' && hiringManagerId) {
            handleDelete(hiringManagerId);
        } else if (action === 'add-task') {
            // Navigate to add task page with hiring manager context
            if (hiringManagerId) {
                router.push(
                    `/dashboard/tasks/add?relatedEntity=hiring_manager&relatedEntityId=${hiringManagerId}`
                );
            }
        }
    };

    // Handle hiring manager deletion
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this hiring manager?')) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`/api/hiring-managers/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete hiring manager');
            }

            // Redirect to the hiring managers list
            router.push('/dashboard/hiring-managers');
        } catch (error) {
            console.error('Error deleting hiring manager:', error);
            setError(error instanceof Error ? error.message : 'An error occurred while deleting the hiring manager');
            setIsLoading(false);
        }
    };

    const actionOptions = [
        { label: 'Edit', action: () => handleActionSelected('edit') },
        { label: 'Delete', action: () => handleActionSelected('delete') },
        { label: 'Clone', action: () => handleActionSelected('clone') },
        { label: 'Export', action: () => handleActionSelected('export') },
        { label: 'Add Task', action: () => handleActionSelected('add-task') },
        { label: 'Transfer', action: () => handleActionSelected('transfer') },
    ];

    // Tabs from the interface
    const tabs = [
        { id: 'summary', label: 'Summary' },
        { id: 'modify', label: 'Modify' },
        { id: 'history', label: 'History' },
        { id: 'notes', label: 'Notes' },
        { id: 'docs', label: 'Docs' },
        { id: 'active-applicants', label: 'Active Applicants' },
        { id: 'opportunities', label: 'Opportunities' },
        { id: 'quotes', label: 'Quotes' },
        { id: 'invoices', label: 'Invoices' }
    ];

    // Quick action buttons
    const quickActions = [
        { id: 'jobs', label: 'Jobs' },
        { id: 'apps-under-review', label: 'Apps Under Review' },
        { id: 'interviews', label: 'Interviews' },
        { id: 'placements', label: 'Placements' }
    ];

    // Render notes tab content
    const renderNotesTab = () => (
        <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Hiring Manager Notes</h2>
                <button
                    onClick={() => setShowAddNote(true)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                    Add Note
                </button>
            </div>

            {/* Add Note Form */}
            {showAddNote && (
                <div className="mb-6 p-4 bg-gray-50 rounded border">
                    <h3 className="font-medium mb-2">Add New Note</h3>
                    <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Enter your note here..."
                        className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                    />
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => setShowAddNote(false)}
                            className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddNote}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            disabled={!newNote.trim()}
                        >
                            Save Note
                        </button>
                    </div>
                </div>
            )}

            {/* Notes List */}
            {isLoadingNotes ? (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : notes.length > 0 ? (
                <div className="space-y-4">
                    {notes.map((note) => (
                        <div key={note.id} className="p-3 border rounded hover:bg-gray-50">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-medium text-blue-600">{note.created_by_name || 'Unknown User'}</span>
                                <span className="text-sm text-gray-500">
                                    {new Date(note.created_at).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-gray-700">{note.text}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 italic">No notes have been added yet.</p>
            )}
        </div>
    );

    // Render history tab content
    const renderHistoryTab = () => (
        <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Hiring Manager History</h2>

            {isLoadingHistory ? (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : history.length > 0 ? (
                <div className="space-y-4">
                    {history.map((item) => {
                        let actionDisplay = '';
                        let detailsDisplay = '';

                        try {
                            const details = typeof item.details === 'string'
                                ? JSON.parse(item.details)
                                : item.details;

                            switch (item.action) {
                                case 'CREATE':
                                    actionDisplay = 'Hiring Manager Created';
                                    detailsDisplay = `Created by ${item.performed_by_name || 'Unknown'}`;
                                    break;
                                case 'UPDATE':
                                    actionDisplay = 'Hiring Manager Updated';
                                    if (details && details.before && details.after) {
                                        const changes = [];
                                        for (const key in details.after) {
                                            if (details.before[key] !== details.after[key]) {
                                                const fieldName = key.replace(/_/g, ' ');
                                                changes.push(`${fieldName}: "${details.before[key] || ''}" → "${details.after[key] || ''}"`);
                                            }
                                        }
                                        if (changes.length > 0) {
                                            detailsDisplay = `Changes: ${changes.join(', ')}`;
                                        } else {
                                            detailsDisplay = 'No changes detected';
                                        }
                                    }
                                    break;
                                case 'ADD_NOTE':
                                    actionDisplay = 'Note Added';
                                    detailsDisplay = details.text || '';
                                    break;
                                default:
                                    actionDisplay = item.action;
                                    detailsDisplay = JSON.stringify(details);
                            }
                        } catch (e) {
                            console.error('Error parsing history details:', e);
                            detailsDisplay = 'Error displaying details';
                        }

                        return (
                            <div key={item.id} className="p-3 border rounded hover:bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-medium text-blue-600">{actionDisplay}</span>
                                    <span className="text-sm text-gray-500">
                                        {new Date(item.performed_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="mb-2">{detailsDisplay}</div>
                                <div className="text-sm text-gray-600">
                                    By: {item.performed_by_name || 'Unknown'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-gray-500 italic">No history records available</p>
            )}
        </div>
    );

    // Modified the Modify tab to redirect to the add page
    const renderModifyTab = () => (
        <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Edit Hiring Manager</h2>
            <p className="text-gray-600 mb-4">Click the button below to edit this hiring manager's details.</p>
            <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Edit Hiring Manager
            </button>
        </div>
    );

    if (isLoading) {
        return <LoadingScreen message="Loading hiring manager details..." />;
    }

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-red-500 mb-4">{error}</div>
                <button
                    onClick={handleGoBack}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Back to Hiring Managers
                </button>
            </div>
        );
    }

    if (!hiringManager) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-gray-700 mb-4">Hiring manager not found</div>
                <button
                    onClick={handleGoBack}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Back to Hiring Managers
                </button>
            </div>
        );
    }

    return (
        <div className="bg-gray-200 min-h-screen p-2">
            {/* Header with hiring manager name and buttons */}
            <div className="bg-gray-400 p-2 flex items-center">
                <div className="flex items-center">
                    <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
                        <Image
                            src="/file.svg"
                            alt="Hiring Manager"
                            width={24}
                            height={24}
                        />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-700">
                        {hiringManager.id} {hiringManager.fullName}
                    </h1>
                </div>
            </div>

            {/* Phone and Email section */}
            <div className="bg-white border-b border-gray-300 p-3 flex justify-between items-center">
                <div className="flex space-x-8">
                    <div>
                        <h2 className="text-gray-600">Phone</h2>
                        <p className="font-medium">{hiringManager.phone || "Not provided"}</p>
                    </div>
                    <div>
                        <h2 className="text-gray-600">Email</h2>
                        {hiringManager.email && hiringManager.email !== "(Not provided)" ? (
                            <a
                                href={`mailto:${hiringManager.email}`}
                                className="font-medium text-blue-600 hover:underline"
                            >
                                {hiringManager.email}
                            </a>
                        ) : (
                            <p className="font-medium">Not provided</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <ActionDropdown label="Actions" options={actionOptions} />
                    <button className="p-1 hover:bg-gray-200 rounded" aria-label="Print">
                        <Image src="/print.svg" alt="Print" width={20} height={20} />
                    </button>
                    <button
                        className="p-1 hover:bg-gray-200 rounded"
                        aria-label="Reload"
                        onClick={() => hiringManagerId && fetchHiringManager(hiringManagerId)}
                    >
                        <Image src="/reload.svg" alt="Reload" width={20} height={20} />
                    </button>
                    <button
                        onClick={handleGoBack}
                        className="p-1 hover:bg-gray-200 rounded"
                        aria-label="Close"
                    >
                        <Image src="/x.svg" alt="Close" width={20} height={20} />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-gray-300 mt-1 border-b border-gray-400 px-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`px-4 py-2 ${
                            activeTab === tab.id
                                ? "bg-gray-200 rounded-t border-t border-r border-l border-gray-400 font-medium"
                                : "text-gray-700 hover:bg-gray-200"
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex bg-gray-300 p-2 space-x-2">
                {quickActions.map((action) => (
                    <button
                        key={action.id}
                        className="bg-white px-4 py-1 rounded-full shadow text-gray-700 hover:bg-gray-100"
                    >
                        {action.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Display content based on active tab */}
                {activeTab === 'summary' && (
                    <>
                        {/* Left Column - Details */}
                        <div className="bg-white rounded shadow">
                            <div className="border-b border-gray-300 px-4 py-2 font-medium">
                                Details
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Status:</div>
                                    <div className="col-span-2">{hiringManager.status}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Organization:</div>
                                    <div className="col-span-2 text-blue-600">{hiringManager.organization.name}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Department:</div>
                                    <div className="col-span-2">{hiringManager.department}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Email:</div>
                                    <div className="col-span-2 text-blue-600">{hiringManager.email}</div>
                                </div>
                                {hiringManager.email2 && (
                                    <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                        <div className="text-gray-600">Email 2:</div>
                                        <div className="col-span-2 text-blue-600">{hiringManager.email2}</div>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Mobile Phone:</div>
                                    <div className="col-span-2">{hiringManager.mobilePhone}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Direct Line:</div>
                                    <div className="col-span-2">{hiringManager.directLine}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Reports To:</div>
                                    <div className="col-span-2">{hiringManager.reportsTo}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">LinkedIn URL:</div>
                                    <div className="col-span-2 text-blue-600 truncate">
                                        {hiringManager.linkedinUrl !== 'Not provided' ? (
                                            <a href={hiringManager.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                                {hiringManager.linkedinUrl}
                                            </a>
                                        ) : 'Not provided'}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Date Added:</div>
                                    <div className="col-span-2">{hiringManager.dateAdded}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Owner:</div>
                                    <div className="col-span-2">{hiringManager.owner}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Secondary Owners:</div>
                                    <div className="col-span-2">{hiringManager.secondaryOwners}</div>
                                </div>
                                <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                    <div className="text-gray-600">Address:</div>
                                    <div className="col-span-2">{hiringManager.address}</div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Action Items and Organization Details */}
                        <div className="space-y-4">
                            {/* Upcoming Action Items */}
                            <div className="bg-white rounded shadow">
                                <div className="border-b border-gray-300 px-4 py-2 font-medium">
                                    Upcoming Action Items
                                </div>
                                <div className="p-4 flex justify-center items-center h-40">
                                    <button className="px-6 py-2 bg-blue-500 text-white rounded">
                                        Add Task
                                    </button>
                                </div>
                            </div>

                            {/* Organization Details */}
                            <div className="bg-white rounded shadow">
                                <div className="border-b border-gray-300 px-4 py-2 font-medium">
                                    Organization Details
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                        <div className="text-gray-600">Status:</div>
                                        <div className="col-span-2">{hiringManager.organization.status}</div>
                                    </div>
                                    <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                        <div className="text-gray-600">Organization Name:</div>
                                        <div className="col-span-2 text-blue-600">{hiringManager.organization.name}</div>
                                    </div>
                                    <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                        <div className="text-gray-600">Organization Phone:</div>
                                        <div className="col-span-2">{hiringManager.organization.phone}</div>
                                    </div>
                                    <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                        <div className="text-gray-600">URL:</div>
                                        <div className="col-span-2 text-blue-600 truncate">
                                            <a href={hiringManager.organization.url} target="_blank" rel="noopener noreferrer">
                                                {hiringManager.organization.url}
                                            </a>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 border-b border-gray-200 pb-2">
                                        <div className="text-gray-600">Date Added:</div>
                                        <div className="col-span-2">{hiringManager.dateAdded}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Notes Section */}
                            <div className="bg-white rounded shadow">
                                <div className="border-b border-gray-300 px-4 py-2 font-medium">
                                    Recent Notes
                                </div>
                                <div className="p-4">
                                    <div className="flex justify-end mb-3">
                                        <button
                                            onClick={() => setShowAddNote(true)}
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            Add Note
                                        </button>
                                    </div>

                                    {/* Notes preview */}
                                    {notes.length > 0 ? (
                                        <div>
                                            {notes.slice(0, 2).map(note => (
                                                <div key={note.id} className="mb-3 pb-3 border-b last:border-0">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium">{note.created_by_name || 'Unknown User'}</span>
                                                        <span className="text-gray-500">{new Date(note.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700">
                                                        {note.text.length > 100 ? `${note.text.substring(0, 100)}...` : note.text}
                                                    </p>
                                                </div>
                                            ))}
                                            {notes.length > 2 && (
                                                <button
                                                    onClick={() => setActiveTab('notes')}
                                                    className="text-blue-500 text-sm hover:underline"
                                                >
                                                    View all {notes.length} notes
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-500 p-4">
                                            No notes have been added yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Notes Tab */}
                {activeTab === 'notes' && (
                    <div className="col-span-2">
                        {renderNotesTab()}
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="col-span-2">
                        {renderHistoryTab()}
                    </div>
                )}

                {/* Modify Tab */}
                {activeTab === 'modify' && (
                    <div className="col-span-2">
                        {renderModifyTab()}
                    </div>
                )}

                {/* Placeholder for other tabs */}
                {activeTab === 'docs' && (
                    <div className="col-span-2">
                        <div className="bg-white p-4 rounded shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Documents</h2>
                            <p className="text-gray-500 italic">No documents available</p>
                        </div>
                    </div>
                )}

                {activeTab === 'active-applicants' && (
                    <div className="col-span-2">
                        <div className="bg-white p-4 rounded shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Active Applicants</h2>
                            <p className="text-gray-500 italic">No active applicants</p>
                        </div>
                    </div>
                )}

                {activeTab === 'opportunities' && (
                    <div className="col-span-2">
                        <div className="bg-white p-4 rounded shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
                            <p className="text-gray-500 italic">No opportunities available</p>
                        </div>
                    </div>
                )}

                {activeTab === 'quotes' && (
                    <div className="col-span-2">
                        <div className="bg-white p-4 rounded shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Quotes</h2>
                            <p className="text-gray-500 italic">No quotes available</p>
                        </div>
                    </div>
                )}

                {activeTab === 'invoices' && (
                    <div className="col-span-2">
                        <div className="bg-white p-4 rounded shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Invoices</h2>
                            <p className="text-gray-500 italic">No invoices available</p>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}