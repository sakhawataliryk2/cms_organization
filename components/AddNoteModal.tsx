'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { FiUserCheck, FiSearch } from 'react-icons/fi';
import { HiOutlineUser } from 'react-icons/hi';
import { formatRecordId, type RecordType } from '@/lib/recordIdFormatter';

interface AddNoteModalProps {
    open: boolean;
    onClose: () => void;
    entityType: string;
    entityId: string;
    entityDisplay?: string;
    onSuccess?: () => void;
}

interface NoteFormState {
    text: string;
    action: string;
    about: string;
    aboutReferences: Array<{
        id: string;
        type: string;
        display: string;
        value: string;
    }>;
    copyNote: string;
    replaceGeneralContactComments: boolean;
    additionalReferences: Array<{ id: string; type: string; display: string; value: string }>;
    scheduleNextAction: string;
    emailNotification: string[];
}

export default function AddNoteModal({
    open,
    onClose,
    entityType,
    entityId,
    entityDisplay,
    onSuccess
}: AddNoteModalProps) {
    const [noteForm, setNoteForm] = useState<NoteFormState>({
        text: "",
        action: "",
        about: entityDisplay || "",
        aboutReferences: entityDisplay ? [{
            id: entityId,
            type: entityType.charAt(0).toUpperCase() + entityType.slice(1),
            display: entityDisplay,
            value: entityDisplay,
        }] : [],
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: [],
        scheduleNextAction: "None",
        emailNotification: [],
    });

    const [noteFormErrors, setNoteFormErrors] = useState<{
        text?: string;
        action?: string;
        about?: string;
    }>({});

    const [isLoading, setIsLoading] = useState(false);
    const [actionFields, setActionFields] = useState<any[]>([]);
    const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

    // Reference search state for About field
    const [aboutSearchQuery, setAboutSearchQuery] = useState("");
    const [aboutSuggestions, setAboutSuggestions] = useState<any[]>([]);
    const [showAboutDropdown, setShowAboutDropdown] = useState(false);
    const [isLoadingAboutSearch, setIsLoadingAboutSearch] = useState(false);
    const aboutInputRef = useRef<HTMLInputElement>(null);

    // Email notification search state
    const [emailSearchQuery, setEmailSearchQuery] = useState("");
    const [showEmailDropdown, setShowEmailDropdown] = useState(false);
    const emailInputRef = useRef<HTMLInputElement>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Reference search state for Additional References
    const [additionalRefSearchQuery, setAdditionalRefSearchQuery] = useState("");
    const [additionalRefSuggestions, setAdditionalRefSuggestions] = useState<any[]>([]);
    const [showAdditionalRefDropdown, setShowAdditionalRefDropdown] = useState(false);
    const [isLoadingAdditionalRefSearch, setIsLoadingAdditionalRefSearch] = useState(false);
    const additionalRefInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            fetchActionFields();
            fetchUsers();
            // Reset form with entity info
            const defaultAboutRef = entityDisplay ? [{
                id: entityId,
                type: entityType.charAt(0).toUpperCase() + entityType.slice(1),
                display: entityDisplay,
                value: entityDisplay,
            }] : [];
            setNoteForm({
                text: "",
                action: "",
                about: entityDisplay || "",
                aboutReferences: defaultAboutRef,
                copyNote: "No",
                replaceGeneralContactComments: false,
                additionalReferences: [],
                scheduleNextAction: "None",
                emailNotification: [],
            });
            setNoteFormErrors({});
            setAboutSearchQuery("");
            setAdditionalRefSearchQuery("");
            setEmailSearchQuery("");
            setShowAboutDropdown(false);
            setShowAdditionalRefDropdown(false);
            setShowEmailDropdown(false);
        }
    }, [open, entityType, entityId, entityDisplay]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (aboutInputRef.current && !aboutInputRef.current.contains(event.target as Node)) {
                setShowAboutDropdown(false);
            }
            if (emailInputRef.current && !emailInputRef.current.contains(event.target as Node)) {
                setShowEmailDropdown(false);
            }
            if (additionalRefInputRef.current && !additionalRefInputRef.current.contains(event.target as Node)) {
                setShowAdditionalRefDropdown(false);
            }
        };
        if (showAboutDropdown || showEmailDropdown || showAdditionalRefDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [showAboutDropdown, showEmailDropdown, showAdditionalRefDropdown]);

    const fetchActionFields = async () => {
        setIsLoadingActionFields(true);
        try {
            const token = document.cookie
                .split('; ')
                .find((r) => r.startsWith('token='))?.split('=')[1];

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

            const response = await fetch(`/api/admin/field-management/${apiPath}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });

            if (response.ok) {
                const raw = await response.text();
                let data: any = {};
                try {
                    data = JSON.parse(raw);
                } catch { }

                const fields =
                    data.customFields ||
                    data.fields ||
                    data.data?.fields ||
                    data[`${entityType}Fields`] ||
                    data.data?.data?.fields ||
                    [];

                const fieldNamesToCheck = ['field_500', 'actions', 'action'];

                const field500 = (fields as any[]).find((f: any) =>
                    fieldNamesToCheck.includes(f.field_name?.toLowerCase()) ||
                    fieldNamesToCheck.includes(f.field_label?.toLowerCase())
                );

                if (field500 && field500.options) {
                    let options = field500.options;
                    if (typeof options === 'string') {
                        try {
                            options = JSON.parse(options);
                        } catch { }
                    }
                    if (Array.isArray(options)) {
                        setActionFields(
                            options.map((opt: any) => ({
                                id: opt.value || opt,
                                field_label: opt.label || opt.value || opt,
                                field_name: opt.value || opt,
                            }))
                        );
                    } else if (typeof options === 'object') {
                        setActionFields(
                            Object.entries(options).map(([key, value]) => ({
                                id: key,
                                field_label: String(value),
                                field_name: key,
                            }))
                        );
                    }
                } else {
                    // Fallback default actions
                    setActionFields([
                        { id: 'Outbound Call', field_label: 'Outbound Call', field_name: 'Outbound Call' },
                        { id: 'Inbound Call', field_label: 'Inbound Call', field_name: 'Inbound Call' },
                        { id: 'Left Message', field_label: 'Left Message', field_name: 'Left Message' },
                        { id: 'Email', field_label: 'Email', field_name: 'Email' },
                        { id: 'Appointment', field_label: 'Appointment', field_name: 'Appointment' },
                        { id: 'Client Visit', field_label: 'Client Visit', field_name: 'Client Visit' },
                    ]);
                }
            }
        } catch (err) {
            console.error('Error fetching action fields:', err);
            setActionFields([
                { id: 'Outbound Call', field_label: 'Outbound Call', field_name: 'Outbound Call' },
                { id: 'Inbound Call', field_label: 'Inbound Call', field_name: 'Inbound Call' },
                { id: 'Left Message', field_label: 'Left Message', field_name: 'Left Message' },
                { id: 'Email', field_label: 'Email', field_name: 'Email' },
                { id: 'Appointment', field_label: 'Appointment', field_name: 'Appointment' },
                { id: 'Client Visit', field_label: 'Client Visit', field_name: 'Client Visit' },
            ]);
        } finally {
            setIsLoadingActionFields(false);
        }
    };

    // Fetch users for email notification dropdown - Internal Users Only
    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const response = await fetch("/api/users/active", {
                headers: {
                    Authorization: `Bearer ${document.cookie.replace(
                        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                        "$1"
                    )}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                // Filter to only internal system users (exclude external contacts, job seekers, hiring managers, organizations)
                const internalUsers = (data.users || []).filter((user: any) => {
                    return (
                        user.user_type === "internal" ||
                        user.role === "admin" ||
                        user.role === "user" ||
                        (!user.user_type && user.email) // Default to internal if user_type not set but has email
                    );
                });
                setUsers(internalUsers);
            }
        } catch (err) {
            console.error("Error fetching users:", err);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    // Search for references for About field - Global Search
    const searchAboutReferences = async (query: string) => {
        setIsLoadingAboutSearch(true);
        setShowAboutDropdown(true);

        try {
            const searchTerm = query ? query.trim() : "";
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );

            const headers = {
                Authorization: `Bearer ${token}`,
            };

            // Search across multiple entity types in parallel
            const [
                jobsRes,
                orgsRes,
                jobSeekersRes,
                leadsRes,
                tasksRes,
                placementsRes,
                hiringManagersRes,
            ] = await Promise.allSettled([
                fetch("/api/jobs", { headers }),
                fetch("/api/organizations", { headers }),
                fetch("/api/job-seekers", { headers }),
                fetch("/api/leads", { headers }),
                fetch("/api/tasks", { headers }),
                fetch("/api/placements", { headers }),
                fetch("/api/hiring-managers", { headers }),
            ]);

            const toSuggestion = (item: any, type: string, displayKey: string, formatKey: RecordType) => ({
                id: item.id,
                type,
                display: `${formatRecordId(item.id, formatKey)} ${item[displayKey] || "Unnamed"}`,
                value: formatRecordId(item.id, formatKey),
            });

            // Match search term against the same display string shown in the dropdown (so "J67", "67", "Accounting" all match "J67 Accounting")
            const matchesDisplay = (display: string) =>
                !searchTerm || display.toLowerCase().includes(searchTerm.toLowerCase());

            const lists: any[][] = [];

            // Process jobs
            if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
                const data = await jobsRes.value.json();
                const allJobs = (data.jobs || []).map((job: any) => toSuggestion(job, "Job", "job_title", "job"));
                const jobs = searchTerm ? allJobs.filter((s: any) => matchesDisplay(s.display)) : allJobs;
                lists.push(jobs);
            } else {
                lists.push([]);
            }

            // Process organizations
            if (orgsRes.status === "fulfilled" && orgsRes.value.ok) {
                const data = await orgsRes.value.json();
                const allOrgs = (data.organizations || []).map((org: any) => toSuggestion(org, "Organization", "name", "organization"));
                const orgs = searchTerm ? allOrgs.filter((s: any) => matchesDisplay(s.display)) : allOrgs;
                lists.push(orgs);
            } else {
                lists.push([]);
            }

            // Process job seekers
            if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
                const data = await jobSeekersRes.value.json();
                const allJS = (data.jobSeekers || []).map((js: any) => {
                    const name = `${js.first_name || ""} ${js.last_name || ""}`.trim() || "Unnamed";
                    return { id: js.id, type: "Job Seeker", display: `${formatRecordId(js.id, "jobSeeker")} ${name}`, value: formatRecordId(js.id, "jobSeeker") };
                });
                const jobSeekers = searchTerm ? allJS.filter((s: any) => matchesDisplay(s.display)) : allJS;
                lists.push(jobSeekers);
            } else {
                lists.push([]);
            }

            // Process leads
            if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
                const data = await leadsRes.value.json();
                const allLeads = (data.leads || []).map((lead: any) => toSuggestion(lead, "Lead", "name", "lead"));
                const leads = searchTerm ? allLeads.filter((s: any) => matchesDisplay(s.display)) : allLeads;
                lists.push(leads);
            } else {
                lists.push([]);
            }

            // Process tasks
            if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
                const data = await tasksRes.value.json();
                const allTasks = (data.tasks || []).map((task: any) => toSuggestion(task, "Task", "title", "task"));
                const tasks = searchTerm ? allTasks.filter((s: any) => matchesDisplay(s.display)) : allTasks;
                lists.push(tasks);
            } else {
                lists.push([]);
            }

            // Process placements
            if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
                const data = await placementsRes.value.json();
                const allPlacements = (data.placements || []).map((p: any) => ({
                    id: p.id,
                    type: "Placement",
                    display: `${formatRecordId(p.id, "placement")} ${[p.jobSeekerName, p.jobTitle].filter(Boolean).join(" – ") || "Placement"}`,
                    value: formatRecordId(p.id, "placement"),
                }));
                const placements = searchTerm ? allPlacements.filter((s: any) => matchesDisplay(s.display)) : allPlacements;
                lists.push(placements);
            } else {
                lists.push([]);
            }

            // Process hiring managers
            if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
                const data = await hiringManagersRes.value.json();
                const allHM = (data.hiringManagers || []).map((hm: any) => {
                    const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "Unnamed";
                    return { id: hm.id, type: "Hiring Manager", display: `${formatRecordId(hm.id, "hiringManager")} ${name}`, value: formatRecordId(hm.id, "hiringManager") };
                });
                const hiringManagers = searchTerm ? allHM.filter((s: any) => matchesDisplay(s.display)) : allHM;
                lists.push(hiringManagers);
            } else {
                lists.push([]);
            }

            // Filter out already selected references (normalize to string for comparison)
            const selectedIds = new Set(noteForm.aboutReferences.map((ref) => String(ref.id)));
            const filteredLists = lists.map((list) => list.filter((s) => !selectedIds.has(String(s.id))));

            // Interleave so we show a mix of all entity types (Job, Org, Job Seeker, Lead, Task, Placement, HM, ...)
            const MAX_SUGGESTIONS = 100;
            const interleaved: any[] = [];
            let index = 0;
            while (interleaved.length < MAX_SUGGESTIONS) {
                let added = 0;
                for (const list of filteredLists) {
                    if (interleaved.length >= MAX_SUGGESTIONS) break;
                    if (index < list.length) {
                        interleaved.push(list[index]);
                        added++;
                    }
                }
                if (added === 0) break;
                index++;
            }

            setAboutSuggestions(interleaved);
        } catch (err) {
            console.error("Error searching about references:", err);
            setAboutSuggestions([]);
        } finally {
            setIsLoadingAboutSearch(false);
        }
    };

    // Handle About reference selection
    const handleAboutReferenceSelect = (reference: any) => {
        setNoteForm((prev) => {
            const newReferences = [...prev.aboutReferences, reference];
            return {
                ...prev,
                aboutReferences: newReferences,
                about: newReferences.map((ref) => ref.display).join(", "),
            };
        });
        setAboutSearchQuery("");
        setShowAboutDropdown(false);
        setAboutSuggestions([]);
        if (aboutInputRef.current) {
            aboutInputRef.current.focus();
        }
    };

    // Remove About reference
    const removeAboutReference = (index: number) => {
        setNoteForm((prev) => {
            const newReferences = prev.aboutReferences.filter((_, i) => i !== index);
            return {
                ...prev,
                aboutReferences: newReferences,
                about: newReferences.length > 0
                    ? newReferences.map((ref) => ref.display).join(", ")
                    : "",
            };
        });
    };

    const emailNotificationSuggestions = useMemo(() => {
        const selected = new Set(noteForm.emailNotification);
        const q = (emailSearchQuery || "").trim().toLowerCase();
        if (!q) return users.filter((u) => !selected.has(u.email || u.name));
        return users.filter((u) => {
            if (selected.has(u.email || u.name)) return false;
            const name = (u.name || "").toLowerCase();
            const email = (u.email || "").toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [users, noteForm.emailNotification, emailSearchQuery]);

    const handleEmailNotificationSelect = (user: any) => {
        const value = user.email || user.name;
        if (!value) return;
        setNoteForm((prev) => {
            if (prev.emailNotification.includes(value)) return prev;
            return { ...prev, emailNotification: [...prev.emailNotification, value] };
        });
        setEmailSearchQuery("");
        setShowEmailDropdown(false);
        if (emailInputRef.current) emailInputRef.current.focus();
    };

    const removeEmailNotification = (value: string) => {
        setNoteForm((prev) => ({
            ...prev,
            emailNotification: prev.emailNotification.filter((v) => v !== value),
        }));
    };

    // Search for references for Additional References field - Global Search
    const searchAdditionalReferences = async (query: string) => {
        if (!query || query.trim().length < 2) {
            setAdditionalRefSuggestions([]);
            setShowAdditionalRefDropdown(false);
            return;
        }

        setIsLoadingAdditionalRefSearch(true);
        setShowAdditionalRefDropdown(true);

        try {
            const searchTerm = query.trim();
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );
            const headers = {
                Authorization: `Bearer ${token}`,
            };

            // Search across multiple entity types in parallel (same as About field)
            const [
                jobsRes,
                orgsRes,
                jobSeekersRes,
                leadsRes,
                tasksRes,
                placementsRes,
                hiringManagersRes,
            ] = await Promise.allSettled([
                fetch("/api/jobs", { headers }),
                fetch("/api/organizations", { headers }),
                fetch("/api/job-seekers", { headers }),
                fetch("/api/leads", { headers }),
                fetch("/api/tasks", { headers }),
                fetch("/api/placements", { headers }),
                fetch("/api/hiring-managers", { headers }),
            ]);

            const suggestions: any[] = [];

            // Process all entity types (same logic as About field)
            if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
                const data = await jobsRes.value.json();
                const jobs = (data.jobs || []).filter(
                    (job: any) =>
                        job.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        job.id?.toString().includes(searchTerm)
                );
                jobs.forEach((job: any) => {
                    suggestions.push({
                        id: job.id,
                        type: "Job",
                        display: `${formatRecordId(job.id, "job")} ${job.job_title || "Untitled"}`,
                        value: formatRecordId(job.id, "job"),
                    });
                });
            }

            // Similar processing for other entity types...
            // (Including organizations, job seekers, leads, tasks, placements, hiring managers)

            // Filter out already selected references
            const selectedIds = noteForm.additionalReferences.map((ref) => ref.id);
            const filteredSuggestions = suggestions.filter(
                (s) => !selectedIds.includes(s.id)
            );

            // Limit to top 10 suggestions
            setAdditionalRefSuggestions(filteredSuggestions.slice(0, 10));
        } catch (err) {
            console.error("Error searching additional references:", err);
            setAdditionalRefSuggestions([]);
        } finally {
            setIsLoadingAdditionalRefSearch(false);
        }
    };

    // Handle Additional Reference selection
    const handleAdditionalRefSelect = (reference: any) => {
        setNoteForm((prev) => ({
            ...prev,
            additionalReferences: [...prev.additionalReferences, reference],
        }));
        setAdditionalRefSearchQuery("");
        setShowAdditionalRefDropdown(false);
        setAdditionalRefSuggestions([]);
        if (additionalRefInputRef.current) {
            additionalRefInputRef.current.focus();
        }
    };

    // Remove Additional Reference
    const removeAdditionalReference = (index: number) => {
        setNoteForm((prev) => ({
            ...prev,
            additionalReferences: prev.additionalReferences.filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = async () => {
        // Clear previous validation errors
        setNoteFormErrors({});

        // Validate required fields
        const errors: { text?: string; action?: string; about?: string } = {};
        if (!noteForm.text.trim()) {
            errors.text = "Note text is required";
        }
        if (!noteForm.action || noteForm.action.trim() === "") {
            errors.action = "Action is required";
        }
        if (!noteForm.aboutReferences || noteForm.aboutReferences.length === 0) {
            errors.about = "At least one About/Reference is required";
        }

        // If validation errors exist, set them and prevent save
        if (Object.keys(errors).length > 0) {
            setNoteFormErrors(errors);
            return; // Keep form open
        }

        setIsLoading(true);
        try {
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
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

            // Format about references as structured data
            const aboutData = noteForm.aboutReferences.map((ref) => ({
                id: ref.id,
                type: ref.type,
                display: ref.display,
                value: ref.value,
            }));

            const response = await fetch(`/api/${apiPath}/${entityId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    text: noteForm.text,
                    action: noteForm.action,
                    about: aboutData,
                    copy_note: noteForm.copyNote === 'Yes',
                    replace_general_contact_comments: noteForm.replaceGeneralContactComments,
                    additional_references: noteForm.additionalReferences,
                    schedule_next_action: noteForm.scheduleNextAction,
                    email_notification: noteForm.emailNotification
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to add note');
            }

            const data = await response.json();
            toast.success('Note added successfully');
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error adding note:', err);
            toast.error(err instanceof Error ? err.message : 'An error occurred while adding the note');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseModal = () => {
        setNoteFormErrors({});
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <Image src="/file.svg" alt="Note" width={20} height={20} />
                        <h2 className="text-lg font-semibold">Add Note</h2>
                    </div>
                    <button
                        onClick={handleCloseModal}
                        className="p-1 rounded hover:bg-gray-200"
                    >
                        <span className="text-2xl font-bold">×</span>
                    </button>
                </div>

                {/* Form Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        {/* Note Text Area - Required */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Note Text {" "} {noteForm.text.length > 0 ? (
                                    <span className="text-green-500">✓</span>
                                ) : (
                                    <span className="text-red-500">*</span>
                                )}
                            </label>
                            <textarea
                                value={noteForm.text}
                                autoFocus
                                onChange={(e) => {
                                    setNoteForm((prev) => ({ ...prev, text: e.target.value }));
                                    // Clear error when user starts typing
                                    if (noteFormErrors.text) {
                                        setNoteFormErrors((prev) => ({ ...prev, text: undefined }));
                                    }
                                }}
                                placeholder="Enter your note text here. Reference people and distribution lists using @ (e.g. @John Smith). Reference other records using # (e.g. #Project Manager)."
                                className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${noteFormErrors.text
                                    ? "border-red-500 focus:ring-red-500"
                                    : "border-gray-300 focus:ring-blue-500"
                                    }`}
                                rows={6}
                            />
                            {noteFormErrors.text && (
                                <p className="mt-1 text-sm text-red-500">{noteFormErrors.text}</p>
                            )}
                        </div>

                        {/* Action Field - Required */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Action {noteForm.action ? (
                                    <span className="text-green-500">✓</span>
                                ) : (
                                    <span className="text-red-500">*</span>
                                )}
                            </label>
                            {isLoadingActionFields ? (
                                <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                                    Loading actions...
                                </div>
                            ) : (
                                <select
                                    value={noteForm.action}
                                    onChange={(e) =>
                                        setNoteForm((prev) => ({ ...prev, action: e.target.value }))
                                    }
                                    className={`w-full p-2 border rounded focus:outline-none focus:ring-2 ${noteFormErrors.action
                                        ? "border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:ring-blue-500"
                                        }`}
                                >
                                    <option value="">Select an action...</option>
                                    {actionFields.map((action) => (
                                        <option key={action.id} value={action.field_name || action.id}>
                                            {action.field_label || action.field_name || action.id}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {noteFormErrors.action && (
                                <p className="mt-1 text-sm text-red-500">{noteFormErrors.action}</p>
                            )}
                        </div>

                        {/* About/Reference Field - Required */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                About / Reference{" "}
                                {(noteForm.aboutReferences && noteForm.aboutReferences.length > 0) ? (
                                    <span className="text-green-500">✓</span>
                                ) : (
                                    <span className="text-red-500">*</span>
                                )}
                            </label>
                            <div className="relative" ref={aboutInputRef}>
                                <div
                                    className={`min-h-[42px] flex flex-wrap items-center gap-2 p-2 border rounded focus-within:ring-2 focus-within:outline-none pr-8 ${
                                        noteFormErrors.about
                                            ? "border-red-500 focus-within:ring-red-500"
                                            : "border-gray-300 focus-within:ring-blue-500"
                                    }`}
                                >
                                    {/* Selected References Tags */}
                                    {noteForm.aboutReferences.map((ref, index) => (
                                        <span
                                            key={`${ref.type}-${ref.id}-${index}`}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-sm"
                                        >
                                            <FiUserCheck className="w-4 h-4" />
                                            {ref.display}
                                            <button
                                                type="button"
                                                onClick={() => removeAboutReference(index)}
                                                className="hover:text-blue-600 font-bold leading-none"
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                    {/* Input field */}
                                    <input
                                        type="text"
                                        value={aboutSearchQuery}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setAboutSearchQuery(value);
                                            searchAboutReferences(value);
                                        }}
                                        onFocus={() => {
                                            setShowAboutDropdown(true);
                                            if (!aboutSearchQuery.trim()) {
                                                searchAboutReferences("");
                                            }
                                        }}
                                        placeholder="Search for records to reference..."
                                        className="flex-1 min-w-[120px] border-none outline-none bg-transparent"
                                    />
                                    {/* Search icon */}
                                    <FiSearch className="w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>

                                {/* Dropdown Suggestions */}
                                {showAboutDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto" data-about-dropdown>
                                        {isLoadingAboutSearch ? (
                                            <div className="p-3 text-gray-500 text-sm">Searching...</div>
                                        ) : aboutSuggestions.length > 0 ? (
                                            aboutSuggestions.map((suggestion) => (
                                                <div
                                                    key={`${suggestion.type}-${suggestion.id}`}
                                                    onClick={() => handleAboutReferenceSelect(suggestion)}
                                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                                                >
                                                    <HiOutlineUser className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm">{suggestion.display}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-gray-500 text-sm">
                                                {aboutSearchQuery.trim().length > 0
                                                    ? "No results found"
                                                    : "Type to search or select from list"}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {noteFormErrors.about && (
                                <p className="mt-1 text-sm text-red-500">{noteFormErrors.about}</p>
                            )}
                        </div>

                        {/* Email Notifications */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email Notification
                            </label>
                            <div className="relative" ref={emailInputRef}>
                                <div className="min-h-[42px] flex flex-wrap items-center gap-2 p-2 border rounded focus-within:ring-2 focus-within:ring-blue-500 focus-within:outline-none pr-8 border-gray-300">
                                    {/* Selected Email Tags */}
                                    {noteForm.emailNotification.map((email, index) => (
                                        <span
                                            key={email}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-800 text-sm"
                                        >
                                            {email}
                                            <button
                                                type="button"
                                                onClick={() => removeEmailNotification(email)}
                                                className="hover:text-green-600 font-bold leading-none"
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                    {/* Input field */}
                                    <input
                                        type="text"
                                        value={emailSearchQuery}
                                        onChange={(e) => setEmailSearchQuery(e.target.value)}
                                        onFocus={() => setShowEmailDropdown(true)}
                                        placeholder="Search users to notify..."
                                        className="flex-1 min-w-[120px] border-none outline-none bg-transparent"
                                    />
                                    {/* Search icon */}
                                    <FiSearch className="w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>

                                {/* Email Dropdown Suggestions */}
                                {showEmailDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto" data-email-dropdown>
                                        {isLoadingUsers ? (
                                            <div className="p-3 text-gray-500 text-sm">Loading users...</div>
                                        ) : emailNotificationSuggestions.length > 0 ? (
                                            emailNotificationSuggestions.map((user) => (
                                                <div
                                                    key={user.id}
                                                    onClick={() => handleEmailNotificationSelect(user)}
                                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                                                >
                                                    <HiOutlineUser className="w-4 h-4 text-gray-400" />
                                                    <div>
                                                        <div className="text-sm font-medium">{user.name}</div>
                                                        <div className="text-xs text-gray-500">{user.email}</div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-gray-500 text-sm">No users found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                        <button
                            onClick={handleCloseModal}
                            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 font-medium"
                            disabled={isLoading}
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                            disabled={isLoading || !noteForm.text.trim() || !noteForm.action || noteForm.aboutReferences.length === 0}
                        >
                            {isLoading ? "SAVING..." : "SAVE"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
