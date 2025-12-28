'use client'

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';
import { FiCheckSquare } from 'react-icons/fi';
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";

// Default header fields for Tasks module - defined outside component to ensure stable reference
const TASK_DEFAULT_HEADER_FIELDS = ["dueDate", "assignedTo"];

export default function TaskView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('summary');

    // Add states for task data
    const [task, setTask] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Notes and history state
    const [notes, setNotes] = useState<Array<any>>([]);
    const [history, setHistory] = useState<Array<any>>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    // Add Note form state - matching jobs view structure
    const [noteForm, setNoteForm] = useState({
        text: '',
        about: task ? `${task.id} ${task.title}` : '',
        copyNote: 'No',
        replaceGeneralContactComments: false,
        additionalReferences: '',
        scheduleNextAction: 'None',
        emailNotification: 'Internal User'
    });
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Tearsheet modal state
    const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);
    const [tearsheetForm, setTearsheetForm] = useState({
        name: '',
        visibility: 'Existing' // 'New' or 'Existing'
    });
    const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);

    const taskId = searchParams.get('id');

    // =====================
    // HEADER FIELDS (Top Row)
    // =====================

    const {
      headerFields,
      setHeaderFields,
      showHeaderFieldModal,
      setShowHeaderFieldModal,
      saveHeaderConfig,
      isSaving: isSavingHeaderConfig,
    } = useHeaderConfig({
      entityType: "TASK",
      configType: "header",
      defaultFields: TASK_DEFAULT_HEADER_FIELDS,
    });

    // Build field list: Standard + Custom
    const buildHeaderFieldCatalog = () => {
        const standard = [
            { key: "dueDate", label: "Due Date" },
            { key: "assignedTo", label: "Assigned To" },
            { key: "priority", label: "Priority" },
            { key: "status", label: "Status" },
            { key: "owner", label: "Owner" },
            { key: "jobSeeker", label: "Job Seeker" },
            { key: "hiringManager", label: "Hiring Manager" },
            { key: "job", label: "Job" },
            { key: "lead", label: "Lead" },
            { key: "dateCreated", label: "Date Created" },
            { key: "createdBy", label: "Created By" },
        ];

        const taskCustom = Object.keys(task?.customFields || {}).map((k) => ({
            key: `custom:${k}`,
            label: k,
        }));

        const merged = [...standard, ...taskCustom];
        const seen = new Set<string>();
        return merged.filter((x) => {
            if (seen.has(x.key)) return false;
            seen.add(x.key);
            return true;
        });
    };

    const headerFieldCatalog = buildHeaderFieldCatalog();

    const getHeaderFieldValue = (key: string) => {
        if (!task) return "-";

        // custom fields
        if (key.startsWith("custom:")) {
            const rawKey = key.replace("custom:", "");
            const val = task.customFields?.[rawKey];
            return val === undefined || val === null || val === ""
                ? "-"
                : String(val);
        }

        // standard fields
        switch (key) {
            case "dueDate":
                return task.dueDateTimeFormatted || "Not set";
            case "assignedTo":
                return task.assignedTo || "Not assigned";
            case "priority":
                return task.priority || "-";
            case "status":
                return task.status || "-";
            case "owner":
                return task.owner || "-";
            case "jobSeeker":
                return task.jobSeeker || "-";
            case "hiringManager":
                return task.hiringManager || "-";
            case "job":
                return task.job || "-";
            case "lead":
                return task.lead || "-";
            case "dateCreated":
                return task.dateCreated || "-";
            case "createdBy":
                return task.createdBy || "-";
            default:
                return "-";
        }
    };

    const getHeaderFieldLabel = (key: string) => {
        const found = headerFieldCatalog.find((f) => f.key === key);
        return found?.label || key;
    };

    const toggleHeaderField = (fieldKey: string) => {
        setHeaderFields((prev) => {
            if (prev.includes(fieldKey)) {
                return prev.filter((k) => k !== fieldKey);
            }
            return [...prev, fieldKey];
        });
    };

    const moveHeaderField = (fieldKey: string, dir: "up" | "down") => {
        setHeaderFields((prev) => {
            const idx = prev.indexOf(fieldKey);
            if (idx === -1) return prev;

            const targetIdx = dir === "up" ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= prev.length) return prev;

            const next = [...prev];
            const temp = next[idx];
            next[idx] = next[targetIdx];
            next[targetIdx] = temp;
            return next;
        });
    };

    // Fetch task when component mounts
    useEffect(() => {
        if (taskId) {
            fetchTask(taskId);
        }
    }, [taskId]);

    // Update note form about field when task is loaded
    useEffect(() => {
        if (task) {
            setNoteForm(prev => ({ ...prev, about: `${task.id} ${task.title}` }));
        }
    }, [task]);

    // Fetch users for email notification
    useEffect(() => {
        if (showAddNote) {
            fetchUsers();
        }
    }, [showAddNote]);

    // Function to fetch task data with better error handling
    const fetchTask = async (id: string) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Fetching task data for ID: ${id}`);
            const response = await fetch(`/api/tasks/${id}`, {
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
                const parseError = error as Error;
                console.error('Error parsing response:', parseError);
                console.error('Raw response:', responseText.substring(0, 200));
                throw new Error(`Failed to parse API response: ${parseError.message}`);
            }

            if (!response.ok) {
                throw new Error(data.message || `Failed to fetch task: ${response.status}`);
            }

            console.log('Task data received:', data);

            // Validate task data
            if (!data.task) {
                throw new Error('No task data received from API');
            }

            // Format the task data for display with defensive coding
            let customFieldsObj = {};

            // Safely parse custom_fields if it exists
            if (data.task.custom_fields) {
                try {
                    // Handle both string and object formats
                    if (typeof data.task.custom_fields === 'string') {
                        customFieldsObj = JSON.parse(data.task.custom_fields);
                    } else if (typeof data.task.custom_fields === 'object') {
                        customFieldsObj = data.task.custom_fields;
                    }
                } catch (error) {
                    const parseError = error as Error;
                    console.error('Error parsing custom fields:', parseError);
                    customFieldsObj = {}; // Default to empty object if parsing fails
                }
            }

            // Format the task data with default values for all fields
            const formattedTask = {
                id: data.task.id || 'Unknown ID',
                title: data.task.title || 'Untitled Task',
                description: data.task.description || 'No description provided',
                isCompleted: data.task.is_completed || false,
                dueDate: data.task.due_date ? new Date(data.task.due_date).toLocaleDateString() : 'Not set',
                dueTime: data.task.due_time || 'Not set',
                dueDateTimeFormatted: data.task.due_date
                    ? `${new Date(data.task.due_date).toLocaleDateString()}${data.task.due_time ? ` ${data.task.due_time}` : ''}`
                    : 'Not set',
                priority: data.task.priority || 'Medium',
                status: data.task.status || 'Pending',
                owner: data.task.owner || 'Not assigned',
                assignedTo: data.task.assigned_to_name || 'Not assigned',
                assignedToId: data.task.assigned_to,
                jobSeeker: data.task.job_seeker_name || 'Not specified',
                jobSeekerId: data.task.job_seeker_id,
                hiringManager: data.task.hiring_manager_name || 'Not specified',
                hiringManagerId: data.task.hiring_manager_id,
                job: data.task.job_title || 'Not specified',
                jobId: data.task.job_id,
                lead: data.task.lead_name || 'Not specified',
                leadId: data.task.lead_id,
                placement: data.task.placement_id ? `Placement #${data.task.placement_id}` : 'Not specified',
                placementId: data.task.placement_id,
                dateCreated: data.task.created_at ? new Date(data.task.created_at).toLocaleDateString() : 'Unknown',
                createdBy: data.task.created_by_name || 'Unknown',
                completedAt: data.task.completed_at ? new Date(data.task.completed_at).toLocaleDateString() : null,
                completedBy: data.task.completed_by_name || null,
                customFields: customFieldsObj // Use our properly parsed object
            };

            console.log('Formatted task data:', formattedTask);
            setTask(formattedTask);

            // Now fetch notes and history
            fetchNotes(id);
            fetchHistory(id);
        } catch (err) {
            console.error('Error fetching task:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching task details');
        } finally {
            setIsLoading(false);
        }
    };

    // Custom fields section with proper type handling
    const renderCustomFields = () => {
        if (!task || !task.customFields) return null;

        const customFieldKeys = Object.keys(task.customFields);
        if (customFieldKeys.length === 0) return null;

        return (
            <div className="mb-6">
                <h3 className="font-bold text-lg mb-2">Additional Information</h3>
                <ul className="list-inside">
                    {Object.entries(task.customFields).map(([key, value]) => (
                        <li key={key} className="mb-1 text-gray-700">
                            <span className="font-medium">{key}:</span> {String(value || '')}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // Fetch users for email notification dropdown
    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const response = await fetch('/api/users/active', {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    // Fetch notes for the task
    const fetchNotes = async (id: string) => {
        setIsLoadingNotes(true);

        try {
            const response = await fetch(`/api/tasks/${id}/notes`, {
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

    // Fetch history for the task
    const fetchHistory = async (id: string) => {
        setIsLoadingHistory(true);

        try {
            const response = await fetch(`/api/tasks/${id}/history`, {
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
        if (!noteForm.text.trim() || !taskId) return;

        try {
            const response = await fetch(`/api/tasks/${taskId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({ 
                    text: noteForm.text,
                    copy_note: noteForm.copyNote === 'Yes',
                    replace_general_contact_comments: noteForm.replaceGeneralContactComments,
                    additional_references: noteForm.additionalReferences,
                    schedule_next_action: noteForm.scheduleNextAction,
                    email_notification: noteForm.emailNotification
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add note');
            }

            const data = await response.json();

            // Add the new note to the list
            setNotes([data.note, ...notes]);

            // Clear the form
            setNoteForm({
                text: '',
                about: task ? `${task.id} ${task.title}` : '',
                copyNote: 'No',
                replaceGeneralContactComments: false,
                additionalReferences: '',
                scheduleNextAction: 'None',
                emailNotification: 'Internal User'
            });
            setShowAddNote(false);

            // Refresh history
            fetchHistory(taskId);
        } catch (err) {
            console.error('Error adding note:', err);
            alert('Failed to add note. Please try again.');
        }
    };

    // Close add note modal
    const handleCloseAddNoteModal = () => {
        setShowAddNote(false);
        setNoteForm({
            text: '',
            about: task ? `${task.id} ${task.title}` : '',
            copyNote: 'No',
            replaceGeneralContactComments: false,
            additionalReferences: '',
            scheduleNextAction: 'None',
            emailNotification: 'Internal User'
        });
    };

    const handleGoBack = () => {
        router.back();
    };

    // Handle tearsheet submission
    const handleTearsheetSubmit = async () => {
        if (!tearsheetForm.name.trim()) {
            alert('Please enter a tearsheet name');
            return;
        }

        if (!taskId) {
            alert('Task ID is missing');
            return;
        }

        setIsSavingTearsheet(true);
        try {
            const response = await fetch('/api/tearsheets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    name: tearsheetForm.name,
                    visibility: tearsheetForm.visibility,
                    task_id: taskId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to create tearsheet' }));
                throw new Error(errorData.message || 'Failed to create tearsheet');
            }

            alert('Tearsheet created successfully!');
            setShowAddTearsheetModal(false);
            setTearsheetForm({ name: '', visibility: 'Existing' });
        } catch (err) {
            console.error('Error creating tearsheet:', err);
            if (err instanceof Error && err.message.includes('Failed to fetch')) {
                alert('Tearsheet creation feature is being set up. The tearsheet will be created once the API is ready.');
                setShowAddTearsheetModal(false);
                setTearsheetForm({ name: '', visibility: 'Existing' });
            } else {
                alert(err instanceof Error ? err.message : 'Failed to create tearsheet. Please try again.');
            }
        } finally {
            setIsSavingTearsheet(false);
        }
    };

    // Print handler: ensure Summary tab is active when printing
    const handlePrint = () => {
        const prevTab = activeTab;
        if (prevTab !== "summary") {
            setActiveTab("summary");
            setTimeout(() => {
                window.print();
                setActiveTab(prevTab);
            }, 300);
        } else {
            window.print();
        }
    };

    const handleEdit = () => {
        if (taskId) {
            router.push(`/dashboard/tasks/add?id=${taskId}`);
        }
    };

    const handleActionSelected = (action: string) => {
        console.log(`Action selected: ${action}`);
        if (action === 'edit') {
            handleEdit();
        } else if (action === 'delete' && taskId) {
            handleDelete(taskId);
        } else if (action === 'complete' && taskId) {
            handleToggleComplete(taskId, false);
        } else if (action === 'incomplete' && taskId) {
            handleToggleComplete(taskId, true);
        } else if (action === 'add-note') {
            setShowAddNote(true);
            setActiveTab('notes');
        } else if (action === 'add-tearsheet') {
            setShowAddTearsheetModal(true);
        }
    };

    // Handle task deletion
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`/api/tasks/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete task');
            }

            // Redirect to the tasks list
            router.push('/dashboard/tasks');
        } catch (error) {
            console.error('Error deleting task:', error);
            setError(error instanceof Error ? error.message : 'An error occurred while deleting the task');
            setIsLoading(false);
        }
    };

    // Handle task completion toggle
    const handleToggleComplete = async (id: string, currentlyCompleted: boolean) => {
        try {
            const response = await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    isCompleted: !currentlyCompleted,
                    status: !currentlyCompleted ? 'Completed' : 'Pending'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update task');
            }

            // Refresh the task data
            fetchTask(id);
        } catch (error) {
            console.error('Error updating task:', error);
            setError(error instanceof Error ? error.message : 'An error occurred while updating the task');
        }
    };

    const actionOptions = [
        { label: 'Add Note', action: () => handleActionSelected('add-note') },
        { label: 'Add Tearsheet', action: () => handleActionSelected('add-tearsheet') },
        { label: 'Delete', action: () => handleActionSelected('delete') },
        // { label: 'Edit', action: () => handleActionSelected('edit') },
        // {
        //     label: task?.isCompleted ? 'Mark Incomplete' : 'Mark Complete',
        //     action: () => handleActionSelected(task?.isCompleted ? 'incomplete' : 'complete')
        // },
        // { label: 'Clone', action: () => handleActionSelected('clone') },    
        // { label: 'Transfer', action: () => handleActionSelected('transfer') },
    ];

    // Tabs from the design
    const tabs = [
        { id: 'summary', label: 'Summary' },
        { id: 'modify', label: 'Modify' },
        { id: 'history', label: 'History' },
        { id: 'notes', label: 'Notes' },
    ];

    // Render notes tab content
    const renderNotesTab = () => (
        <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Task Notes</h2>
                <button
                    onClick={() => setShowAddNote(true)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                    Add Note
                </button>
            </div>

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
            <h2 className="text-lg font-semibold mb-4">Task History</h2>

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
                                    actionDisplay = 'Task Created';
                                    detailsDisplay = `Created by ${item.performed_by_name || 'Unknown'}`;
                                    break;
                                case 'UPDATE':
                                    actionDisplay = 'Task Updated';
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

    // Modified the Modify tab to directly use handleEdit
    const renderModifyTab = () => (
        <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Edit Task</h2>
            <p className="text-gray-600 mb-4">Click the button below to edit this task's details.</p>
            <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Edit Task
            </button>
        </div>
    );

    if (isLoading) {
        return <LoadingScreen message="Loading task details..." />;
    }

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-red-500 mb-4">{error}</div>
                <button
                    onClick={handleGoBack}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Back to Tasks
                </button>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-gray-700 mb-4">Task not found</div>
                <button
                    onClick={handleGoBack}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Back to Tasks
                </button>
            </div>
        );
    }

    return (
        <div className="bg-gray-200 min-h-screen p-2">
            {/* Header with task name and buttons */}
            <div className="bg-gray-400 p-2 flex items-center">
                <div className="flex items-center">
                    <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
                        {/* <Image
                            src="/file.svg"
                            alt="Task"
                            width={24}
                            height={24}
                        /> */}
                        <FiCheckSquare size={20} />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-700">
                        {formatRecordId(task.id, 'task')} {task.title}
                    </h1>
                </div>
            </div>

            {/* Header Fields Row */}
            <div className="bg-white border-b border-gray-300 px-3 py-2">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                    {/* LEFT: dynamic fields */}
                    <div className="flex flex-wrap gap-x-10 gap-y-2 flex-1 min-w-0">
                        {headerFields.length === 0 ? (
                            <span className="text-sm text-gray-500">
                                No header fields selected
                            </span>
                        ) : (
                            headerFields.map((fk) => (
                                <div key={fk} className="min-w-[140px]">
                                    <div className="text-xs text-gray-500">
                                        {getHeaderFieldLabel(fk)}
                                    </div>
                                    <div className="text-sm font-medium text-gray-900">
                                        {getHeaderFieldValue(fk)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* RIGHT: actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                        <button
                            onClick={() => setShowHeaderFieldModal(true)}
                            className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900"
                            title="Customize header fields"
                            aria-label="Customize header fields"
                        >
                            <svg
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                height="16"
                                width="16"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                        </button>

                        <ActionDropdown label="Actions" options={actionOptions} />
                        <button
                            onClick={handlePrint}
                            className="p-1 hover:bg-gray-200 rounded"
                            aria-label="Print"
                        >
                            <Image src="/print.svg" alt="Print" width={20} height={20} />
                        </button>
                        <button
                            className="p-1 hover:bg-gray-200 rounded"
                            aria-label="Reload"
                            onClick={() => taskId && fetchTask(taskId)}
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
                        onClick={() => {
                            if (tab.id === "modify") {
                                handleEdit();
                            } else {
                                setActiveTab(tab.id);
                            }
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="p-4">
                <div className="grid grid-cols-7 gap-4">
                {/* Display content based on active tab */}
                {activeTab === 'summary' && (
                    <>
                        {/* Left Column - Task Details (4/7 width) */}
                        <div className="col-span-4">
                            <div className="bg-white rounded-lg shadow">
                                <div className="border-b border-gray-300 p-4 font-medium">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl font-bold">{task.title}</h2>
                                        <div className={`text-xs px-2 py-1 rounded ${task.isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {task.isCompleted ? 'Completed' : task.status}
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        Due: {task.dueDateTimeFormatted} • Priority: {task.priority}
                                    </div>
                                </div>
                                <div className="p-4">
                                    {/* Task Description */}
                                    <div className="mb-6">
                                        <h3 className="font-bold text-lg mb-2">Description</h3>
                                        <div className="whitespace-pre-line text-gray-700">
                                            {task.description}
                                        </div>
                                    </div>

                                    {/* Custom fields section */}
                                    {renderCustomFields()}

                                    {/* Related Records */}
                                    <div className="mb-6">
                                        <h3 className="font-bold text-lg mb-2">Related Records</h3>
                                        <div className="border border-gray-200 rounded">
                                            <div className="flex border-b border-gray-200 last:border-b-0">
                                                <div className="w-40 p-2 border-r border-gray-200 bg-gray-50 font-medium">Job Seeker:</div>
                                                <div className="flex-1 p-2">{task.jobSeeker}</div>
                                            </div>
                                            <div className="flex border-b border-gray-200 last:border-b-0">
                                                <div className="w-40 p-2 border-r border-gray-200 bg-gray-50 font-medium">Hiring Manager:</div>
                                                <div className="flex-1 p-2">{task.hiringManager}</div>
                                            </div>
                                            <div className="flex border-b border-gray-200 last:border-b-0">
                                                <div className="w-40 p-2 border-r border-gray-200 bg-gray-50 font-medium">Job:</div>
                                                <div className="flex-1 p-2">{task.job}</div>
                                            </div>
                                            <div className="flex border-b border-gray-200 last:border-b-0">
                                                <div className="w-40 p-2 border-r border-gray-200 bg-gray-50 font-medium">Lead:</div>
                                                <div className="flex-1 p-2">{task.lead}</div>
                                            </div>
                                            {task.placement !== 'Not specified' && (
                                                <div className="flex border-b border-gray-200 last:border-b-0">
                                                    <div className="w-40 p-2 border-r border-gray-200 bg-gray-50 font-medium">Placement:</div>
                                                    <div className="flex-1 p-2">{task.placement}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Completion Info */}
                                    {task.isCompleted && task.completedAt && (
                                        <div className="mb-6">
                                            <h3 className="font-bold text-lg mb-2">Completion Details</h3>
                                            <div className="bg-green-50 p-3 rounded">
                                                <p><span className="font-medium">Completed on:</span> {task.completedAt}</p>
                                                {task.completedBy && (
                                                    <p><span className="font-medium">Completed by:</span> {task.completedBy}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Task Details (3/7 width) */}
                        <div className="col-span-3 space-y-4">
                            {/* Details Panel */}
                            <div className="bg-white rounded-lg shadow">
                                <div className="border-b border-gray-300 p-2 font-medium">
                                    Details
                                </div>
                                <div className="p-4">
                                    <div className="space-y-0 border border-gray-200 rounded">
                                        <div className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-32 p-2 border-r border-gray-200 bg-gray-50 text-gray-600 font-medium">Status:</div>
                                            <div className="flex-1 p-2">
                                                <span className={`px-2 py-1 rounded text-sm ${task.isCompleted ? 'bg-green-100 text-green-800' :
                                                        task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {task.isCompleted ? 'Completed' : task.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-32 p-2 border-r border-gray-200 bg-gray-50 text-gray-600 font-medium">Priority:</div>
                                            <div className="flex-1 p-2">
                                                <span className={`px-2 py-1 rounded text-sm ${task.priority === 'High' ? 'bg-red-100 text-red-800' :
                                                        task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-green-100 text-green-800'
                                                    }`}>
                                                    {task.priority}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-32 p-2 border-r border-gray-200 bg-gray-50 text-gray-600 font-medium">Due Date:</div>
                                            <div className="flex-1 p-2">{task.dueDate}</div>
                                        </div>

                                        <div className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-32 p-2 border-r border-gray-200 bg-gray-50 text-gray-600 font-medium">Due Time:</div>
                                            <div className="flex-1 p-2">{task.dueTime}</div>
                                        </div>

                                        <div className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-32 p-2 border-r border-gray-200 bg-gray-50 text-gray-600 font-medium">Owner:</div>
                                            <div className="flex-1 p-2">{task.owner}</div>
                                        </div>

                                        <div className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-32 p-2 border-r border-gray-200 bg-gray-50 text-gray-600 font-medium">Assigned To:</div>
                                            <div className="flex-1 p-2">{task.assignedTo}</div>
                                        </div>

                                        <div className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-32 p-2 border-r border-gray-200 bg-gray-50 text-gray-600 font-medium">Created:</div>
                                            <div className="flex-1 p-2">{task.dateCreated}</div>
                                        </div>

                                        <div className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-32 p-2 border-r border-gray-200 bg-gray-50 text-gray-600 font-medium">Created By:</div>
                                            <div className="flex-1 p-2">{task.createdBy}</div>
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
                                            onClick={() => {
                                                setShowAddNote(true);
                                                setActiveTab('notes');
                                            }}
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
                </div>
            </div>

            {/* Add Tearsheet Modal */}
            {showAddTearsheetModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">Tearsheets</h2>
                            <button
                                onClick={() => {
                                    setShowAddTearsheetModal(false);
                                    setTearsheetForm({ name: '', visibility: 'Existing' });
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <span className="text-2xl font-bold">×</span>
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="p-6 space-y-6">
                            {/* Tearsheet Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <span className="text-red-500 mr-1">•</span>
                                    Tearsheet name
                                </label>
                                <input
                                    type="text"
                                    value={tearsheetForm.name}
                                    onChange={(e) => setTearsheetForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter tearsheet name"
                                    className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                    required
                                />
                            </div>

                            {/* Visibility */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Visibility
                                </label>
                                <div className="inline-flex rounded-md border border-gray-300 overflow-hidden" role="group">
                                    <button
                                        type="button"
                                        onClick={() => setTearsheetForm(prev => ({ ...prev, visibility: 'New' }))}
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                                            tearsheetForm.visibility === 'New'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-gray-700 border-r border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        New
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTearsheetForm(prev => ({ ...prev, visibility: 'Existing' }))}
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                                            tearsheetForm.visibility === 'Existing'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Existing
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setShowAddTearsheetModal(false);
                                    setTearsheetForm({ name: '', visibility: 'Existing' });
                                }}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSavingTearsheet}
                            >
                                BACK
                            </button>
                            <button
                                onClick={handleTearsheetSubmit}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                                disabled={isSavingTearsheet || !tearsheetForm.name.trim()}
                            >
                                SAVE
                                <svg
                                    className="w-4 h-4 ml-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Note Modal */}
            {showAddNote && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                                <Image src="/file.svg" alt="Note" width={20} height={20} />
                                <h2 className="text-lg font-semibold">Add Note</h2>
                            </div>
                            <button
                                onClick={handleCloseAddNoteModal}
                                className="p-1 rounded hover:bg-gray-200"
                            >
                                <span className="text-2xl font-bold">×</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {/* Note Text Area */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Note Text
                                    </label>
                                    <textarea
                                        value={noteForm.text}
                                        onChange={(e) => setNoteForm(prev => ({ ...prev, text: e.target.value }))}
                                        placeholder="Enter your note text here. Reference people and distribution lists using @ (e.g. @John Smith). Reference other records using # (e.g. #Project Manager)."
                                        className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={6}
                                    />
                                </div>

                                {/* About Section */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        About
                                    </label>
                                    <div className="relative">
                                        <div className="flex items-center border border-gray-300 rounded p-2 bg-white">
                                            <div className="w-6 h-6 rounded-full bg-orange-400 mr-2 flex-shrink-0"></div>
                                            <span className="flex-1 text-sm">{noteForm.about}</span>
                                            <button
                                                onClick={() => setNoteForm(prev => ({ ...prev, about: '' }))}
                                                className="ml-2 text-gray-500 hover:text-gray-700 text-xs"
                                            >
                                                CLEAR ALL X
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional References Section */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Additional References
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={noteForm.additionalReferences}
                                            onChange={(e) => setNoteForm(prev => ({ ...prev, additionalReferences: e.target.value }))}
                                            placeholder="Reference other records using #"
                                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                                        />
                                        <span className="absolute right-2 top-2 text-gray-400 text-sm">Q</span>
                                    </div>
                                </div>

                                {/* Email Notification Section */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                        <span className="mr-2">📧</span>
                                        Email Notification
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={noteForm.emailNotification}
                                            onChange={(e) => setNoteForm(prev => ({ ...prev, emailNotification: e.target.value }))}
                                            placeholder="Internal User"
                                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                                <button
                                    onClick={handleCloseAddNoteModal}
                                    className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 font-medium"
                                >
                                    CANCEL
                                </button>
                                <button
                                    onClick={handleAddNote}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    disabled={!noteForm.text.trim()}
                                >
                                    SAVE
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Fields Customization Modal */}
            {showHeaderFieldModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Customize Header Fields</h2>
                            <button
                                onClick={() => setShowHeaderFieldModal(false)}
                                className="p-1 rounded hover:bg-gray-200"
                            >
                                <span className="text-2xl font-bold">×</span>
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-6">
                            {/* Left: available fields */}
                            <div>
                                <h3 className="font-medium mb-3">Available Fields</h3>
                                <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                                    {headerFieldCatalog.map((f) => {
                                        const checked = headerFields.includes(f.key);
                                        return (
                                            <label
                                                key={f.key}
                                                className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleHeaderField(f.key)}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-gray-800">{f.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right: selected + reorder */}
                            <div>
                                <h3 className="font-medium mb-3">Header Order</h3>
                                <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                                    {headerFields.length === 0 ? (
                                        <div className="text-sm text-gray-500 italic">
                                            No fields selected
                                        </div>
                                    ) : (
                                        headerFields.map((key, idx) => (
                                            <div
                                                key={key}
                                                className="flex items-center justify-between p-2 border rounded"
                                            >
                                                <div>
                                                    <div className="text-sm font-medium">
                                                        {getHeaderFieldLabel(key)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{key}</div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                                                        disabled={idx === 0}
                                                        onClick={() => moveHeaderField(key, "up")}
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                                                        disabled={idx === headerFields.length - 1}
                                                        onClick={() => moveHeaderField(key, "down")}
                                                    >
                                                        ↓
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 border rounded text-xs hover:bg-gray-50 text-red-600"
                                                        onClick={() => toggleHeaderField(key)}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 mt-4">
                                    <button
                                        className="px-4 py-2 border rounded hover:bg-gray-50"
                                        onClick={() => setHeaderFields(TASK_DEFAULT_HEADER_FIELDS)}
                                    >
                                        Reset
                                    </button>
                                    <button
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={async () => {
                                            const success = await saveHeaderConfig();
                                            if (success) {
                                                setShowHeaderFieldModal(false);
                                            }
                                        }}
                                        disabled={isSavingHeaderConfig}
                                    >
                                        {isSavingHeaderConfig ? "Saving..." : "Done"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}