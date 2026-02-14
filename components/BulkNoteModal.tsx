'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { FiUserCheck, FiSearch } from 'react-icons/fi';
import { HiOutlineUser } from 'react-icons/hi';
import { formatRecordId } from '@/lib/recordIdFormatter';

interface BulkNoteModalProps {
    open: boolean;
    onClose: () => void;
    entityType: string;
    entityIds: string[];
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

export default function BulkNoteModal({
    open,
    onClose,
    entityType,
    entityIds,
    onSuccess
}: BulkNoteModalProps) {
    const [noteForm, setNoteForm] = useState<NoteFormState>({
        text: "",
        action: "",
        about: "",
        aboutReferences: [],
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
            // Reset form
            setNoteForm({
                text: "",
                action: "",
                about: "",
                aboutReferences: [],
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
    }, [open]);

    // Close email notification dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                emailInputRef.current &&
                !emailInputRef.current.contains(event.target as Node) &&
                !(event.target as HTMLElement).closest("[data-email-dropdown]")
            ) {
                setShowEmailDropdown(false);
            }
        };
        if (showEmailDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [showEmailDropdown]);

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

            const suggestions: any[] = [];

            // Process jobs
            if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
                const data = await jobsRes.value.json();
                const jobs = searchTerm
                    ? (data.jobs || []).filter(
                        (job: any) =>
                            job.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            job.id?.toString().includes(searchTerm)
                    )
                    : (data.jobs || []);
                jobs.forEach((job: any) => {
                    suggestions.push({
                        id: job.id,
                        type: "Job",
                        display: `${formatRecordId(job.id, "job")} ${job.job_title || "Untitled"}`,
                        value: formatRecordId(job.id, "job"),
                    });
                });
            }

            // Process organizations
            if (orgsRes.status === "fulfilled" && orgsRes.value.ok) {
                const data = await orgsRes.value.json();
                const orgs = searchTerm
                    ? (data.organizations || []).filter(
                        (org: any) =>
                            org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            org.id?.toString().includes(searchTerm)
                    )
                    : (data.organizations || []);
                orgs.forEach((org: any) => {
                    suggestions.push({
                        id: org.id,
                        type: "Organization",
                        display: `${formatRecordId(org.id, "organization")} ${org.name || "Unnamed"}`,
                        value: formatRecordId(org.id, "organization"),
                    });
                });
            }

            // Process job seekers
            if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
                const data = await jobSeekersRes.value.json();
                const jobSeekers = searchTerm
                    ? (data.jobSeekers || []).filter(
                        (js: any) =>
                            `${js.first_name || ""} ${js.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            js.id?.toString().includes(searchTerm)
                    )
                    : (data.jobSeekers || []);
                jobSeekers.forEach((js: any) => {
                    const name = `${js.first_name || ""} ${js.last_name || ""}`.trim() || "Unnamed";
                    suggestions.push({
                        id: js.id,
                        type: "Job Seeker",
                        display: `${formatRecordId(js.id, "jobSeeker")} ${name}`,
                        value: formatRecordId(js.id, "jobSeeker"),
                    });
                });
            }

            // Process leads
            if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
                const data = await leadsRes.value.json();
                const leads = searchTerm
                    ? (data.leads || []).filter(
                        (lead: any) =>
                            lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            lead.id?.toString().includes(searchTerm)
                    )
                    : (data.leads || []);
                leads.forEach((lead: any) => {
                    suggestions.push({
                        id: lead.id,
                        type: "Lead",
                        display: `${formatRecordId(lead.id, "lead")} ${lead.name || "Unnamed"}`,
                        value: formatRecordId(lead.id, "lead"),
                    });
                });
            }

            // Process tasks
            if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
                const data = await tasksRes.value.json();
                const tasks = searchTerm
                    ? (data.tasks || []).filter(
                        (task: any) =>
                            task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            task.id?.toString().includes(searchTerm)
                    )
                    : (data.tasks || []);
                tasks.forEach((task: any) => {
                    suggestions.push({
                        id: task.id,
                        type: "Task",
                        display: `${formatRecordId(task.id, "task")} ${task.title || "Untitled"}`,
                        value: formatRecordId(task.id, "task"),
                    });
                });
            }

            // Process placements
            if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
                const data = await placementsRes.value.json();
                const placements = searchTerm
                    ? (data.placements || []).filter(
                        (placement: any) =>
                            placement.id?.toString().includes(searchTerm)
                    )
                    : (data.placements || []);
                placements.forEach((placement: any) => {
                    suggestions.push({
                        id: placement.id,
                        type: "Placement",
                        display: `${formatRecordId(placement.id, "placement")} Placement`,
                        value: formatRecordId(placement.id, "placement"),
                    });
                });
            }

            // Process hiring managers
            if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
                const data = await hiringManagersRes.value.json();
                const hiringManagers = searchTerm
                    ? (data.hiringManagers || []).filter(
                        (hm: any) => {
                            const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "";
                            return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                hm.id?.toString().includes(searchTerm);
                        }
                    )
                    : (data.hiringManagers || []);
                hiringManagers.forEach((hm: any) => {
                    const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "Unnamed";
                    suggestions.push({
                        id: hm.id,
                        type: "Hiring Manager",
                        display: `${formatRecordId(hm.id, "hiringManager")} ${name}`,
                        value: formatRecordId(hm.id, "hiringManager"),
                    });
                });
            }

            // Filter out already selected references
            const selectedIds = noteForm.aboutReferences.map((ref) => ref.id);
            const filteredSuggestions = suggestions.filter(
                (s) => !selectedIds.includes(s.id)
            );

            // Limit to top 10 suggestions
            setAboutSuggestions(filteredSuggestions.slice(0, 10));
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

            // Process jobs
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

            // Process organizations
            if (orgsRes.status === "fulfilled" && orgsRes.value.ok) {
                const data = await orgsRes.value.json();
                const orgs = (data.organizations || []).filter(
                    (org: any) =>
                        org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        org.id?.toString().includes(searchTerm)
                );
                orgs.forEach((org: any) => {
                    suggestions.push({
                        id: org.id,
                        type: "Organization",
                        display: `${formatRecordId(org.id, "organization")} ${org.name || "Unnamed"}`,
                        value: formatRecordId(org.id, "organization"),
                    });
                });
            }

            // Process job seekers
            if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
                const data = await jobSeekersRes.value.json();
                const jobSeekers = (data.jobSeekers || []).filter(
                    (js: any) =>
                        `${js.first_name || ""} ${js.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        js.id?.toString().includes(searchTerm)
                );
                jobSeekers.forEach((js: any) => {
                    const name = `${js.first_name || ""} ${js.last_name || ""}`.trim() || "Unnamed";
                    suggestions.push({
                        id: js.id,
                        type: "Job Seeker",
                        display: `${formatRecordId(js.id, "jobSeeker")} ${name}`,
                        value: formatRecordId(js.id, "jobSeeker"),
                    });
                });
            }

            // Process leads
            if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
                const data = await leadsRes.value.json();
                const leads = (data.leads || []).filter(
                    (lead: any) =>
                        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        lead.id?.toString().includes(searchTerm)
                );
                leads.forEach((lead: any) => {
                    suggestions.push({
                        id: lead.id,
                        type: "Lead",
                        display: `${formatRecordId(lead.id, "lead")} ${lead.name || "Unnamed"}`,
                        value: formatRecordId(lead.id, "lead"),
                    });
                });
            }

            // Process tasks
            if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
                const data = await tasksRes.value.json();
                const tasks = (data.tasks || []).filter(
                    (task: any) =>
                        task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        task.id?.toString().includes(searchTerm)
                );
                tasks.forEach((task: any) => {
                    suggestions.push({
                        id: task.id,
                        type: "Task",
                        display: `${formatRecordId(task.id, "task")} ${task.title || "Untitled"}`,
                        value: formatRecordId(task.id, "task"),
                    });
                });
            }

            // Process placements
            if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
                const data = await placementsRes.value.json();
                const placements = (data.placements || []).filter(
                    (placement: any) =>
                        placement.id?.toString().includes(searchTerm)
                );
                placements.forEach((placement: any) => {
                    suggestions.push({
                        id: placement.id,
                        type: "Placement",
                        display: `${formatRecordId(placement.id, "placement")} Placement`,
                        value: formatRecordId(placement.id, "placement"),
                    });
                });
            }

            // Process hiring managers
            if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
                const data = await hiringManagersRes.value.json();
                const hiringManagers = (data.hiringManagers || []).filter(
                    (hm: any) => {
                        const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "";
                        return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            hm.id?.toString().includes(searchTerm);
                    }
                );
                hiringManagers.forEach((hm: any) => {
                    const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "Unnamed";
                    suggestions.push({
                        id: hm.id,
                        type: "Hiring Manager",
                        display: `${formatRecordId(hm.id, "hiringManager")} ${name}`,
                        value: formatRecordId(hm.id, "hiringManager"),
                    });
                });
            }

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

            // Add note to each entity
            const results = {
                successful: [] as string[],
                failed: [] as string[],
                errors: [] as Array<{ id: string; error: string }>
            };

            for (const id of entityIds) {
                try {
                    const response = await fetch(`/api/${apiPath}/${id}/notes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            text: noteForm.text,
                            action: noteForm.action,
                            about: JSON.stringify(aboutData), // Send as structured JSON
                            about_references: aboutData, // Also send as array for backend processing
                            copy_note: noteForm.copyNote === "Yes",
                            replace_general_contact_comments: noteForm.replaceGeneralContactComments,
                            additional_references: noteForm.additionalReferences,
                            schedule_next_action: noteForm.scheduleNextAction,
                            email_notification: Array.isArray(noteForm.emailNotification) ? noteForm.emailNotification : (noteForm.emailNotification ? [noteForm.emailNotification] : []),
                        })
                    });

                    if (response.ok) {
                        results.successful.push(id);
                    } else {
                        const errorData = await response.json().catch(() => ({}));
                        results.failed.push(id);
                        results.errors.push({
                            id,
                            error: errorData.message || 'Failed to add note'
                        });
                    }
                } catch (error) {
                    results.failed.push(id);
                    results.errors.push({
                        id,
                        error: error instanceof Error ? error.message : 'Failed to add note'
                    });
                }
            }

            if (results.failed.length > 0) {
                const errorDetails = results.errors.map(e => `${e.id}: ${e.error}`).join(', ');
                toast.error(`Some notes failed: ${errorDetails}`);
            } else {
                toast.success(`Added note to ${entityIds.length} record(s)`);
            }

            // Reset form
            setNoteForm({
                text: "",
                action: "",
                about: "",
                aboutReferences: [],
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

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error adding bulk notes:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to add notes');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setNoteForm({
            text: "",
            action: "",
            about: "",
            aboutReferences: [],
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
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <Image src="/file.svg" alt="Note" width={20} height={20} />
                        <h2 className="text-lg font-semibold">Add Note</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded hover:bg-gray-200"
                    >
                        <span className="text-2xl font-bold">×</span>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-gray-600 mb-4 text-sm">
                        Add a note to {entityIds.length} selected record(s)
                    </p>
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

                        {/* About Section - Required, Multiple References, Global Search */}
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
                                    {/* Selected References Tags - Inside the input container */}
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

                                    {/* Search Input for References - Same field to add more */}
                                    <input
                                        type="text"
                                        value={aboutSearchQuery}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setAboutSearchQuery(value);
                                            searchAboutReferences(value);
                                            setShowAboutDropdown(true);
                                        }}
                                        onFocus={() => {
                                            setShowAboutDropdown(true);
                                            if (!aboutSearchQuery.trim()) {
                                                searchAboutReferences("");
                                            }
                                        }}
                                        placeholder={
                                            noteForm.aboutReferences.length === 0
                                                ? "Search and select records (e.g., Job, Lead, Placement, Organization, Hiring Manager)..."
                                                : "Add more..."
                                        }
                                        className="flex-1 min-w-[120px] border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                                        <FiSearch className="w-4 h-4" />
                                    </span>
                                </div>

                                {/* Validation Error */}
                                {noteFormErrors.about && (
                                    <p className="mt-1 text-sm text-red-500">
                                        {noteFormErrors.about}
                                    </p>
                                )}

                                {/* Suggestions Dropdown */}
                                {showAboutDropdown && (
                                    <div
                                        data-about-dropdown
                                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                                    >
                                        {isLoadingAboutSearch ? (
                                            <div className="p-3 text-center text-gray-500 text-sm">
                                                Searching...
                                            </div>
                                        ) : aboutSuggestions.length > 0 ? (
                                            aboutSuggestions.map((suggestion, idx) => (
                                                <button
                                                    key={`${suggestion.type}-${suggestion.id}-${idx}`}
                                                    type="button"
                                                    onClick={() => handleAboutReferenceSelect(suggestion)}
                                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                                                >
                                                    <FiUserCheck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {suggestion.display}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {suggestion.type}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))
                                        ) : aboutSearchQuery.trim().length > 0 ? (
                                            <div className="p-3 text-center text-gray-500 text-sm">
                                                No results found
                                            </div>
                                        ) : (
                                            <div className="p-3 text-center text-gray-500 text-sm">
                                                Type to search or select from list
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Additional References Section - Global Search */}


                        {/* Email Notification Section - Search and add (matches MultiSelectLookupField design) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email Notification
                            </label>
                            <div className="relative" ref={emailInputRef}>
                                {isLoadingUsers ? (
                                    <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50 min-h-[42px]">
                                        Loading users...
                                    </div>
                                ) : (
                                    <div className="min-h-[42px] flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded focus-within:ring-2 focus-within:outline-none focus-within:ring-blue-500 pr-8">
                                        {/* Selected Users Tags - Inside the input container */}
                                        {noteForm.emailNotification.map((val, index) => (
                                            <span
                                                key={val}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-sm"
                                            >
                                                <HiOutlineUser className="w-4 h-4 flex-shrink-0" />
                                                {val}
                                                <button
                                                    type="button"
                                                    onClick={() => removeEmailNotification(val)}
                                                    className="hover:text-blue-600 font-bold leading-none"
                                                    title="Remove"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}

                                        {/* Search Input for Users - Same field to add more */}
                                        <input
                                            type="text"
                                            value={emailSearchQuery}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setEmailSearchQuery(value);
                                                setShowEmailDropdown(true);
                                            }}
                                            onFocus={() => setShowEmailDropdown(true)}
                                            placeholder={
                                                noteForm.emailNotification.length === 0
                                                    ? "Search and add users to notify..."
                                                    : "Add more..."
                                            }
                                            className="flex-1 min-w-[120px] border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                                            <FiSearch className="w-4 h-4" />
                                        </span>
                                    </div>
                                )}

                                {/* Suggestions Dropdown - same structure as About */}
                                {showEmailDropdown && !isLoadingUsers && (
                                    <div
                                        data-email-dropdown
                                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                                    >
                                        {emailNotificationSuggestions.length > 0 ? (
                                            emailNotificationSuggestions.slice(0, 10).map((user, idx) => (
                                                <button
                                                    key={user.id ?? idx}
                                                    type="button"
                                                    onClick={() => handleEmailNotificationSelect(user)}
                                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                                                >
                                                    <HiOutlineUser className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.name || user.email}
                                                        </div>
                                                        {user.email && user.name && (
                                                            <div className="text-xs text-gray-500">{user.email}</div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-gray-500 text-sm">
                                                {emailSearchQuery.trim().length >= 1
                                                    ? "No matching users found"
                                                    : "Type to search internal users"}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                Only internal system users are available for notification
                            </p>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                        <button
                            onClick={handleClose}
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
                            {isLoading ? 'SAVING...' : 'SAVE'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
