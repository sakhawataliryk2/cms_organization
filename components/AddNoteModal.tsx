'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { formatRecordId, type RecordType } from '@/lib/recordIdFormatter';
import StyledReactSelect, { type StyledSelectOption } from '@/components/StyledReactSelect';

interface AddNoteModalProps {
    open: boolean;
    onClose: () => void;
    entityType: string;
    entityId: string;
    entityDisplay?: string;
    onSuccess?: () => void;
    defaultAction?: string;
    defaultAboutReferences?: Array<{
        id: string;
        type: string;
        display: string;
        value: string;
    }>;
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
    note_date_time: string;
}

export default function AddNoteModal({
    open,
    onClose,
    entityType,
    entityId,
    entityDisplay,
    onSuccess,
    defaultAction,
    defaultAboutReferences
}: AddNoteModalProps) {
    const getCurrentLocalDateTime = () => {
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    };

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
        note_date_time: getCurrentLocalDateTime(),
    });

    const [noteFormErrors, setNoteFormErrors] = useState<{
        text?: string;
        action?: string;
        about?: string;
    }>({});

    const [isLoading, setIsLoading] = useState(false);
    const [actionFields, setActionFields] = useState<any[]>([]);
    const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

    // When defaultAction is provided, try to pre-select the closest matching action
    useEffect(() => {
        if (!defaultAction || actionFields.length === 0) return;

        const target = defaultAction.toLowerCase();

        const match = actionFields.find((action: any) => {
            const label = String(action.field_label || action.field_name || action.id || "").toLowerCase();
            // Case-insensitive, substring match in either direction
            return label.includes(target) || target.includes(label);
        });

        if (match) {
            const value = match.field_name || match.id;
            if (!value) return;
            setNoteForm((prev) => {
                // If user already chose something, don't override it
                if (prev.action && prev.action === value) return prev;
                return { ...prev, action: value };
            });
        }
    }, [defaultAction, actionFields]);

    // Reference search state for About field
    const [aboutSearchQuery, setAboutSearchQuery] = useState("");
    const [aboutSuggestions, setAboutSuggestions] = useState<any[]>([]);
    const [isLoadingAboutSearch, setIsLoadingAboutSearch] = useState(false);

    // Email notification search state
    const [emailSearchQuery, setEmailSearchQuery] = useState("");
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
            const baseRef = entityDisplay ? [{
                id: entityId,
                type: entityType.charAt(0).toUpperCase() + entityType.slice(1),
                display: entityDisplay,
                value: entityDisplay,
            }] : [];
            // Merge in any provided default about references (e.g. job seeker, hiring manager)
            const extraRefs = (defaultAboutReferences ?? []).map((ref) => ({
                id: String(ref.id),
                type: ref.type,
                display: ref.display,
                value: ref.value,
            }));
            const mergedMap = new Map<string, { id: string; type: string; display: string; value: string }>();
            [...baseRef, ...extraRefs].forEach((ref) => {
                const key = `${ref.type}:${ref.id}`;
                if (!mergedMap.has(key)) mergedMap.set(key, ref);
            });
            const defaultAboutRef = Array.from(mergedMap.values());
            setNoteForm({
                text: "",
                action: defaultAction || "",
                about: entityDisplay || "",
                aboutReferences: defaultAboutRef,
                copyNote: "No",
                replaceGeneralContactComments: false,
                additionalReferences: [],
                scheduleNextAction: "None",
                emailNotification: [],
                note_date_time: getCurrentLocalDateTime(),
            });
            setNoteFormErrors({});
            setAboutSearchQuery("");
            setAdditionalRefSearchQuery("");
            setEmailSearchQuery("");
            setShowAdditionalRefDropdown(false);
        }
    }, [open, entityType, entityId, entityDisplay]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (additionalRefInputRef.current && !additionalRefInputRef.current.contains(event.target as Node)) {
                setShowAdditionalRefDropdown(false);
            }
        };
        if (showAdditionalRefDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [showAdditionalRefDropdown]);

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

            // Use record_number for display/search when available (matches rest of app)
            const toSuggestion = (item: any, type: string, displayKey: string, formatKey: RecordType, displayNumber?: number | string | null) => {
                const num = displayNumber ?? item.record_number ?? item.id;
                const prefixLabel = formatRecordId(num, formatKey);
                return {
                    id: item.id,
                    type,
                    display: `${prefixLabel} ${item[displayKey] || "Unnamed"}`,
                    value: prefixLabel,
                };
            };

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
                    const num = js.record_number ?? js.id;
                    const prefixLabel = formatRecordId(num, "jobSeeker");
                    return { id: js.id, type: "Job Seeker", display: `${prefixLabel} ${name}`, value: prefixLabel };
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
                const allPlacements = (data.placements || []).map((p: any) => {
                    const num = p.record_number ?? p.id;
                    const prefixLabel = formatRecordId(num, "placement");
                    return {
                        id: p.id,
                        type: "Placement",
                        display: `${prefixLabel} ${[p.jobSeekerName, p.jobTitle].filter(Boolean).join(" – ") || "Placement"}`,
                        value: prefixLabel,
                    };
                });
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
                    const num = hm.record_number ?? hm.id;
                    const prefixLabel = formatRecordId(num, "hiringManager");
                    return { id: hm.id, type: "Hiring Manager", display: `${prefixLabel} ${name}`, value: prefixLabel };
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

    const aboutReferenceOptions: StyledSelectOption[] = useMemo(
        () =>
            aboutSuggestions.map((suggestion: any) => ({
                label: suggestion.display,
                value: `${suggestion.type}:${String(suggestion.id)}`,
                meta: suggestion,
            })),
        [aboutSuggestions],
    );

    const emailNotificationOptions: StyledSelectOption[] = useMemo(
        () =>
            users
                .map((user) => {
                    const value = user.email || user.name;
                    if (!value) return null;
                    return {
                        label: user.email
                            ? `${user.name || user.email} (${user.email})`
                            : user.name,
                        value,
                    } as StyledSelectOption;
                })
                .filter(Boolean) as StyledSelectOption[],
        [users],
    );

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

            const toSuggestion = (item: any, type: string, displayKey: string, formatKey: RecordType) => {
                const num = item.record_number ?? item.id;
                const prefixLabel = formatRecordId(num, formatKey);
                return {
                    id: item.id,
                    type,
                    display: `${prefixLabel} ${item[displayKey] || "Unnamed"}`,
                    value: prefixLabel,
                };
            };
            const matchesDisplay = (display: string) =>
                display.toLowerCase().includes(searchTerm.toLowerCase());

            const suggestions: any[] = [];

            if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
                const data = await jobsRes.value.json();
                (data.jobs || []).forEach((job: any) => {
                    const s = toSuggestion(job, "Job", "job_title", "job");
                    if (matchesDisplay(s.display)) suggestions.push(s);
                });
            }
            if (orgsRes.status === "fulfilled" && orgsRes.value.ok) {
                const data = await orgsRes.value.json();
                (data.organizations || []).forEach((org: any) => {
                    const s = toSuggestion(org, "Organization", "name", "organization");
                    if (matchesDisplay(s.display)) suggestions.push(s);
                });
            }
            if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
                const data = await jobSeekersRes.value.json();
                (data.jobSeekers || []).forEach((js: any) => {
                    const name = `${js.first_name || ""} ${js.last_name || ""}`.trim() || "Unnamed";
                    const num = js.record_number ?? js.id;
                    const prefixLabel = formatRecordId(num, "jobSeeker");
                    const s = { id: js.id, type: "Job Seeker", display: `${prefixLabel} ${name}`, value: prefixLabel };
                    if (matchesDisplay(s.display)) suggestions.push(s);
                });
            }
            if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
                const data = await leadsRes.value.json();
                (data.leads || []).forEach((lead: any) => {
                    const s = toSuggestion(lead, "Lead", "name", "lead");
                    if (matchesDisplay(s.display)) suggestions.push(s);
                });
            }
            if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
                const data = await tasksRes.value.json();
                (data.tasks || []).forEach((task: any) => {
                    const s = toSuggestion(task, "Task", "title", "task");
                    if (matchesDisplay(s.display)) suggestions.push(s);
                });
            }
            if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
                const data = await placementsRes.value.json();
                (data.placements || []).forEach((p: any) => {
                    const num = p.record_number ?? p.id;
                    const prefixLabel = formatRecordId(num, "placement");
                    const s = { id: p.id, type: "Placement", display: `${prefixLabel} ${[p.jobSeekerName, p.jobTitle].filter(Boolean).join(" – ") || "Placement"}`, value: prefixLabel };
                    if (matchesDisplay(s.display)) suggestions.push(s);
                });
            }
            if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
                const data = await hiringManagersRes.value.json();
                (data.hiringManagers || []).forEach((hm: any) => {
                    const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "Unnamed";
                    const num = hm.record_number ?? hm.id;
                    const prefixLabel = formatRecordId(num, "hiringManager");
                    const s = { id: hm.id, type: "Hiring Manager", display: `${prefixLabel} ${name}`, value: prefixLabel };
                    if (matchesDisplay(s.display)) suggestions.push(s);
                });
            }

            // Filter out already selected references
            const selectedIds = new Set(noteForm.additionalReferences.map((ref) => String(ref.id)));
            const filteredSuggestions = suggestions.filter((s) => !selectedIds.has(String(s.id)));

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

            // Create note on the primary record first
            const primaryNoteBody = {
                text: noteForm.text,
                action: noteForm.action,
                about: aboutData,
                copy_note: noteForm.copyNote === 'Yes',
                replace_general_contact_comments: noteForm.replaceGeneralContactComments,
                additional_references: noteForm.additionalReferences,
                schedule_next_action: noteForm.scheduleNextAction,
                email_notification: noteForm.emailNotification,
                note_date_time: noteForm.note_date_time,
                            };

            const response = await fetch(`/api/${apiPath}/${entityId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(primaryNoteBody)
            });

            if (!response.ok) {
                let errorMessage = 'Failed to add note';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (parseErr) {
                    console.error('AddNoteModal: Failed to parse error response', parseErr);
                }
                throw new Error(errorMessage);
            }

            // Best-effort: also add this note to each referenced record (About + Additional References)
            const allRefs = [
                ...(noteForm.aboutReferences || []),
                ...(noteForm.additionalReferences || []),
            ];
            const failedPropagations: string[] = [];
            if (allRefs.length > 0) {
                const typeToApiPath: Record<string, string> = {
                    'Job': 'jobs',
                    'Organization': 'organizations',
                    'Job Seeker': 'job-seekers',
                    'Lead': 'leads',
                    'Task': 'tasks',
                    'Placement': 'placements',
                    'Hiring Manager': 'hiring-managers',
                };
                const currentEntityLabelMap: Record<string, string> = {
                    'job': 'Job',
                    'organization': 'Organization',
                    'job-seeker': 'Job Seeker',
                    'lead': 'Lead',
                    'task': 'Task',
                    'placement': 'Placement',
                    'hiring-manager': 'Hiring Manager',
                };
                const currentEntityLabel = currentEntityLabelMap[entityType];
                const seen = new Set<string>();

                for (const ref of allRefs) {
                    if (!ref || !ref.id || !ref.type) continue;
                    const key = `${ref.type}:${ref.id}`;
                    if (seen.has(key)) continue;
                    seen.add(key);

                    // Skip the primary entity itself; it already has the note
                    if (currentEntityLabel && ref.type === currentEntityLabel && String(ref.id) === String(entityId)) {
                        continue;
                    }

                    const refApiPath = typeToApiPath[ref.type];
                    if (!refApiPath) continue;

                    try {
                        const propResponse = await fetch(`/api/${refApiPath}/${ref.id}/notes`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                text: noteForm.text,
                                action: noteForm.action,
                                about: aboutData,
                                about_references: aboutData,
                                copy_note: noteForm.copyNote === 'Yes',
                                replace_general_contact_comments: noteForm.replaceGeneralContactComments,
                                additional_references: noteForm.additionalReferences,
                                schedule_next_action: noteForm.scheduleNextAction,
                                email_notification: noteForm.emailNotification,
                                note_date_time: noteForm.note_date_time,
                                                            }),
                        });
                        
                        if (!propResponse.ok) {
                            const errorData = await propResponse.json().catch(() => ({}));
                            const errMsg = errorData.message || propResponse.statusText;
                            console.warn(`Note propagation failed for ${ref.type} ${ref.id}:`, errMsg);
                            failedPropagations.push(`${ref.type} ${ref.display || ref.id}`);
                        }
                    } catch (propErr) {
                        console.error('Error propagating note to reference:', propErr);
                        failedPropagations.push(`${ref.type} ${ref.display || ref.id}`);
                    }
                }
            }

            if (failedPropagations.length > 0) {
                toast.warning(`Note added to primary record, but failed to propagate to: ${failedPropagations.join(', ')}`);
            } else {
                toast.success('Note added and propagated successfully');
            }
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('AddNoteModal: handleSubmit error details:', {
                error: err,
                message: err instanceof Error ? err.message : 'Unknown error',
                stack: err instanceof Error ? err.stack : 'No stack',
                entityType,
                entityId,
                noteForm: {
                    ...noteForm,
                    text: noteForm.text.substring(0, 50) + '...'
                }
            });
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
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
                        {/* Note Date & Time */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Note Date & Time
                            </label>
                            <input
                                type="datetime-local"
                                value={noteForm.note_date_time}
                                onChange={(e) =>
                                    setNoteForm((prev) => ({ ...prev, note_date_time: e.target.value }))
                                }
                                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

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
                                    {actionFields.map((action, index) => (
                                        <option key={`${action.id ?? action.field_name ?? index}-${index}`} value={action.field_name || action.id}>
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
                            <StyledReactSelect
                                isMulti
                                options={aboutReferenceOptions}
                                value={noteForm.aboutReferences.map((ref) => ({
                                    label: ref.display,
                                    value: `${ref.type}:${String(ref.id)}`,
                                    meta: ref,
                                }))}
                                hasError={Boolean(noteFormErrors.about)}
                                isSearchable
                                isClearable={false}
                                isLoading={isLoadingAboutSearch}
                                placeholder="Search for records to reference..."
                                noOptionsMessage={() =>
                                    aboutSearchQuery.trim().length > 0
                                        ? "No results found"
                                        : "Type to search or select from list"
                                }
                                onFocus={() => {
                                    if (!aboutSearchQuery.trim()) {
                                        void searchAboutReferences("");
                                    }
                                }}
                                onInputChange={(value, meta) => {
                                    if (meta.action !== "input-change") return value;
                                    setAboutSearchQuery(value);
                                    void searchAboutReferences(value);
                                    return value;
                                }}
                                onChange={(options) => {
                                    const next = Array.isArray(options) ? options : [];
                                    const aboutReferences = next
                                        .map((opt) => opt.meta)
                                        .filter(Boolean) as Array<{
                                            id: string;
                                            type: string;
                                            display: string;
                                            value: string;
                                        }>;
                                    setNoteForm((prev) => ({
                                        ...prev,
                                        aboutReferences,
                                        about: aboutReferences.map((ref) => ref.display).join(", "),
                                    }));
                                }}
                            />
                            {noteFormErrors.about && (
                                <p className="mt-1 text-sm text-red-500">{noteFormErrors.about}</p>
                            )}
                        </div>

                        {/* Email Notifications */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email Notification
                            </label>
                            <StyledReactSelect
                                isMulti
                                isSearchable
                                isClearable={false}
                                isLoading={isLoadingUsers}
                                options={emailNotificationOptions}
                                value={emailNotificationOptions.filter((opt) =>
                                    noteForm.emailNotification.includes(opt.value),
                                )}
                                placeholder="Search users to notify..."
                                noOptionsMessage={() =>
                                    isLoadingUsers
                                        ? "Loading users..."
                                        : emailSearchQuery.trim().length > 0
                                            ? "No users found"
                                            : "Type to search users"
                                }
                                onInputChange={(value, meta) => {
                                    if (meta.action === "input-change") {
                                        setEmailSearchQuery(value);
                                    }
                                    return value;
                                }}
                                onChange={(options) => {
                                    const next = Array.isArray(options)
                                        ? options.map((opt) => String(opt.value))
                                        : [];
                                    setNoteForm((prev) => ({ ...prev, emailNotification: next }));
                                }}
                            />
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