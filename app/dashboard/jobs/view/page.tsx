'use client'

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';

export default function JobView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('summary');
    const [activeQuickTab, setActiveQuickTab] = useState('applied');

    // Add states for job data
    const [job, setJob] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Notes and history state
    const [notes, setNotes] = useState<Array<any>>([]);
    const [history, setHistory] = useState<Array<any>>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    const [newNote, setNewNote] = useState('');

    const jobId = searchParams.get('id');

    // Fetch job when component mounts
    useEffect(() => {
        if (jobId) {
            fetchJob(jobId);
        }
    }, [jobId]);

    // Function to fetch job data with better error handling
    const fetchJob = async (id: string) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Fetching job data for ID: ${id}`);
            const response = await fetch(`/api/jobs/${id}`, {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            console.log(`API Response status: ${response.status}`);

            // Handle non-JSON responses
            const responseText = await response.text();
            let data;

            try {
                data = JSON.parse(responseText);
            } catch (error) {
                // Properly type the error to access the message property
                const parseError = error as Error;
                console.error('Error parsing response:', parseError);
                console.error('Raw response:', responseText.substring(0, 200));
                throw new Error(`Failed to parse API response: ${parseError.message}`);
            }

            if (!response.ok) {
                throw new Error(data.message || `Failed to fetch job: ${response.status}`);
            }

            console.log('Job data received:', data);

            // Validate job data
            if (!data.job) {
                throw new Error('No job data received from API');
            }

            // Format the job data for display with defensive coding
            let customFieldsObj = {};

            // Safely parse custom_fields if it exists
            if (data.job.custom_fields) {
                try {
                    // Handle both string and object formats
                    if (typeof data.job.custom_fields === 'string') {
                        customFieldsObj = JSON.parse(data.job.custom_fields);
                    } else if (typeof data.job.custom_fields === 'object') {
                        customFieldsObj = data.job.custom_fields;
                    }
                } catch (error) {
                    const parseError = error as Error;
                    console.error('Error parsing custom fields:', parseError);
                    customFieldsObj = {}; // Default to empty object if parsing fails
                }
            }

            // Format the job data with default values for all fields
            const formattedJob = {
                id: data.job.id || 'Unknown ID',
                title: data.job.job_title || 'Untitled Job',
                category: data.job.category || 'Uncategorized',
                status: data.job.status || 'Unknown',
                priority: data.job.priority || '-',
                employmentType: data.job.employment_type || 'Not specified',
                startDate: data.job.start_date ? new Date(data.job.start_date).toLocaleDateString() : 'Not specified',
                worksite: data.job.worksite_location || 'Not specified',
                remoteOption: data.job.remote_option || 'Not specified',
                dateAdded: data.job.created_at ? new Date(data.job.created_at).toLocaleDateString() : 'Unknown',
                jobBoardStatus: data.job.job_board_status || 'Not Posted',
                owner: data.job.owner || 'Not assigned',
                organization: {
                    name: data.job.organization_name || 'Not specified',
                    phone: data.job.organization_phone || 'Not provided',
                    website: data.job.organization_website || 'Not provided'
                },
                hiringManager: {
                    name: data.job.hiring_manager || 'Not specified',
                    phone: 'Phone not available',
                    email: 'Email not available'
                },
                description: data.job.job_description || 'No description provided',
                benefits: data.job.benefits ? data.job.benefits.split('\n').filter(Boolean) : [],
                salaryRange: data.job.min_salary && data.job.max_salary
                    ? `$${parseFloat(data.job.min_salary).toLocaleString()} - $${parseFloat(data.job.max_salary).toLocaleString()}`
                    : 'Not specified',
                requiredSkills: data.job.required_skills || '',
                location: data.job.remote_option || 'On-site',
                applicants: 0,
                customFields: customFieldsObj // Use our properly parsed object
            };

            console.log('Formatted job data:', formattedJob);
            setJob(formattedJob);

            // Now fetch notes and history
            fetchNotes(id);
            fetchHistory(id);
        } catch (err) {
            console.error('Error fetching job:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching job details');
        } finally {
            setIsLoading(false);
        }
    };

    // Custom fields section with proper type handling
    const renderCustomFields = () => {
        if (!job || !job.customFields) return null;

        const customFieldKeys = Object.keys(job.customFields);
        if (customFieldKeys.length === 0) return null;

        return (
            <div className="mb-6">
                <h3 className="font-bold text-lg mb-2">Additional Information</h3>
                <ul className="list-inside">
                    {Object.entries(job.customFields).map(([key, value]) => (
                        <li key={key} className="mb-1 text-gray-700">
                            <span className="font-medium">{key}:</span> {String(value || '')}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // Fetch notes for the job
    const fetchNotes = async (id: string) => {
        setIsLoadingNotes(true);

        try {
            const response = await fetch(`/api/jobs/${id}/notes`, {
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

    // Fetch history for the job
    const fetchHistory = async (id: string) => {
        setIsLoadingHistory(true);

        try {
            const response = await fetch(`/api/jobs/${id}/history`, {
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
        if (!newNote.trim() || !jobId) return;

        try {
            const response = await fetch(`/api/jobs/${jobId}/notes`, {
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
            fetchHistory(jobId);
        } catch (err) {
            console.error('Error adding note:', err);
            alert('Failed to add note. Please try again.');
        }
    };

    const handleGoBack = () => {
        router.back();
    };

    // FIXED: Update this to work with Modify tab too
    const handleEdit = () => {
        if (jobId) {
            router.push(`/dashboard/jobs/add?id=${jobId}`);
        }
    };

    const handleActionSelected = (action: string) => {
        console.log(`Action selected: ${action}`);
        if (action === 'edit') {
            handleEdit();
        } else if (action === 'delete' && jobId) {
            handleDelete(jobId);
        } else if (action === 'add-task') {
            // Navigate to add task page with job context
            if (jobId) {
                router.push(
                    `/dashboard/tasks/add?relatedEntity=job&relatedEntityId=${jobId}`
                );
            }
        }
    };

    // Handle job deletion
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this job?')) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`/api/jobs/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete job');
            }

            // Redirect to the jobs list
            router.push('/dashboard/jobs');
        } catch (error) {
            console.error('Error deleting job:', error);
            setError(error instanceof Error ? error.message : 'An error occurred while deleting the job');
            setIsLoading(false);
        }
    };

    const actionOptions = [
        { label: 'Edit', action: () => handleActionSelected('edit') },
        { label: 'Delete', action: () => handleActionSelected('delete') },
        { label: 'Clone', action: () => handleActionSelected('clone') },
        { label: 'Publish to Job Board', action: () => handleActionSelected('publish') },
        { label: 'Add Task', action: () => handleActionSelected('add-task') },
        { label: 'Transfer', action: () => handleActionSelected('transfer') },
        { label: 'Add Placement', action: () => handleActionSelected('add-placement') },
    ];

    // Tabs from the image
    const tabs = [
        { id: 'summary', label: 'Summary' },
        { id: 'modify', label: 'Modify' },
        { id: 'history', label: 'History' },
        { id: 'notes', label: 'Notes' },
        { id: 'docs', label: 'Docs' }
    ];

    // Quick action tabs
    const quickTabs = [
        { id: 'applied', label: 'Applied' },
        { id: 'client-submissions', label: 'Client Submissions' },
        { id: 'interviews', label: 'Interviews' },
        { id: 'placements', label: 'Placements' }
    ];

    // Render notes tab content
    const renderNotesTab = () => (
        <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Job Notes</h2>
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
            <h2 className="text-lg font-semibold mb-4">Job History</h2>

            {isLoadingHistory ? (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : history.length > 0 ? (
                <div className="space-y-4">
                    {history.map((item) => {
                        // Format the history entry based on action type
                        let actionDisplay = '';
                        let detailsDisplay = '';

                        try {
                            const details = typeof item.details === 'string'
                                ? JSON.parse(item.details)
                                : item.details;

                            switch (item.action) {
                                case 'CREATE':
                                    actionDisplay = 'Job Created';
                                    detailsDisplay = `Created by ${item.performed_by_name || 'Unknown'}`;
                                    break;
                                case 'UPDATE':
                                    actionDisplay = 'Job Updated';
                                    if (details && details.before && details.after) {
                                        // Create a list of changes
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

    // FIXED: Modified the Modify tab to directly use handleEdit
    const renderModifyTab = () => (
        <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Edit Job</h2>
            <p className="text-gray-600 mb-4">Click the button below to edit this job's details.</p>
            <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Edit Job
            </button>
        </div>
    );

    if (isLoading) {
        return <LoadingScreen message="Loading job details..." />;
    }

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-red-500 mb-4">{error}</div>
                <button
                    onClick={handleGoBack}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Back to Jobs
                </button>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-gray-700 mb-4">Job not found</div>
                <button
                    onClick={handleGoBack}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Back to Jobs
                </button>
            </div>
        );
    }

    return (
        <div className="bg-gray-200 min-h-screen p-2">
            {/* Header with job name and buttons */}
            <div className="bg-gray-400 p-2 flex items-center">
                <div className="flex items-center">
                    <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
                        <Image
                            src="/file.svg"
                            alt="Job"
                            width={24}
                            height={24}
                        />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-700">
                        {job.id} {job.title}
                    </h1>
                </div>
            </div>

            {/* Phone and Website section */}
            <div className="bg-white border-b border-gray-300 p-3 flex justify-between items-center">
                <div className="flex space-x-8">
                    <div>
                        <h2 className="text-gray-600">Phone</h2>
                        <p className="font-medium">{job.organization.phone || "Not provided"}</p>
                    </div>
                    <div>
                        <h2 className="text-gray-600">Website</h2>
                        {job.organization.website && job.organization.website !== 'Not provided' ? (
                            <a
                                href={job.organization.website.startsWith('http') ? job.organization.website : `https://${job.organization.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 hover:underline"
                            >
                                {job.organization.website}
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
                        onClick={() => jobId && fetchJob(jobId)}
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
                {quickTabs.map((action) => (
                    <button
                        key={action.id}
                        className={`${activeQuickTab === action.id
                            ? 'bg-white text-blue-600 font-medium'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                            } px-4 py-1 rounded-full shadow`}
                        onClick={() => setActiveQuickTab(action.id)}
                    >
                        {action.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="p-4">
                <div className="grid grid-cols-7 gap-4">
                {/* Display content based on active tab */}
                {activeTab === 'summary' && (
                    <>
                        {/* Left Column - Job Details (4/7 width) */}
                        <div className="col-span-4">
                            <div className="bg-white rounded-lg shadow">
                                <div className="border-b border-gray-300 p-4 font-medium">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl font-bold">{job.title}</h2>
                                        <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                            {job.employmentType}
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        {job.organization.name} • {job.location}
                                    </div>
                                </div>
                                <div className="p-4">
                                    {/* Job Description */}
                                    <div className="mb-6">
                                        <h3 className="font-bold text-lg mb-2">Job Description</h3>
                                        <div className="whitespace-pre-line text-gray-700">
                                            {job.description}
                                        </div>
                                    </div>

                                    {/* Custom fields section with proper type handling */}
                                    {Object.keys(job.customFields).length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="font-bold text-lg mb-2">Additional Information</h3>
                                            <ul className="list-inside">
                                                {Object.entries(job.customFields).map(([key, value]) => (
                                                    <li key={key} className="mb-1 text-gray-700">
                                                        <span className="font-medium">{key}:</span> {String(value)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Benefits Section */}
                                    <div className="mb-6">
                                        <h3 className="font-bold text-lg mb-2">Benefits</h3>
                                        {job.benefits.length > 0 ? (
                                            <ul className="list-disc pl-5">
                                                {job.benefits.map((benefit: string, index: number) => (
                                                    <li key={index} className="text-gray-700 mb-1">{benefit}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-gray-500 italic">No benefits listed</p>
                                        )}
                                    </div>

                                    {/* Required Skills */}
                                    {job.requiredSkills && (
                                        <div className="mb-6">
                                            <h3 className="font-bold text-lg mb-2">Required Skills</h3>
                                            <div className="text-gray-700">
                                                {job.requiredSkills}
                                            </div>
                                        </div>
                                    )}

                                    {/* Salary and Details */}
                                    <div className="mb-6">
                                        <h3 className="font-bold text-lg mb-2">Compensation</h3>
                                        <div className="text-gray-700">
                                            <p><span className="font-medium">Salary Range:</span> {job.salaryRange}</p>
                                            <p><span className="font-medium">Employment Type:</span> {job.employmentType}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Job Details (3/7 width) */}
                        <div className="col-span-3 space-y-4">
                            {/* Details Panel */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="border-b border-gray-300 p-2 font-medium">
                                    Details
                                </div>
                                <div className="p-4">
                                    <div className="space-y-3">
                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Status:</div>
                                            <div className="flex-1">
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                                    {job.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Priority:</div>
                                            <div className="flex-1">{job.priority}</div>
                                        </div>

                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Employment Type:</div>
                                            <div className="flex-1">{job.employmentType}</div>
                                        </div>

                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Start Date:</div>
                                            <div className="flex-1">{job.startDate}</div>
                                        </div>

                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Worksite Location:</div>
                                            <div className="flex-1">{job.worksite}</div>
                                        </div>

                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Date Added:</div>
                                            <div className="flex-1">{job.dateAdded}</div>
                                        </div>

                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Job Board Status:</div>
                                            <div className="flex-1">{job.jobBoardStatus}</div>
                                        </div>

                                        <div className="flex">
                                            <div className="w-32 text-gray-600">User Owner:</div>
                                            <div className="flex-1">{job.owner}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hiring Manager Contact */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="border-b border-gray-300 p-2 font-medium">
                                    Hiring Manager
                                </div>
                                <div className="p-4">
                                    <div className="space-y-3">
                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Name:</div>
                                            <div className="flex-1 text-blue-600">{job.hiringManager.name}</div>
                                        </div>
                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Phone:</div>
                                            <div className="flex-1">{job.hiringManager.phone}</div>
                                        </div>
                                        <div className="flex">
                                            <div className="w-32 text-gray-600">Email:</div>
                                            <div className="flex-1 text-blue-600">{job.hiringManager.email}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Notes Section */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="border-b border-gray-300 p-2 font-medium">
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
                    <div className="col-span-7">
                        {renderNotesTab()}
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="col-span-7">
                        {renderHistoryTab()}
                    </div>
                )}

                {/* Modify Tab */}
                {activeTab === 'modify' && (
                    <div className="col-span-7">
                        {renderModifyTab()}
                    </div>
                )}

                {/* Placeholder for Docs tab */}
                {activeTab === 'docs' && (
                    <div className="col-span-7">
                        <div className="bg-white p-4 rounded shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Documents</h2>
                            <p className="text-gray-500 italic">No documents available</p>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}