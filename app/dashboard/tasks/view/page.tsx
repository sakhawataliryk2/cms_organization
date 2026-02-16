'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';
import PanelWithHeader from '@/components/PanelWithHeader';
import { FiCheckSquare, FiSearch, FiUserCheck } from 'react-icons/fi';
import { HiOutlineUser } from 'react-icons/hi';
import { BsFillPinAngleFill } from "react-icons/bs";
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import RecordNameResolver from '@/components/RecordNameResolver';
import FieldValueRenderer from '@/components/FieldValueRenderer';
import CountdownTimer from '@/components/CountdownTimer';
import {
    buildPinnedKey,
    isPinnedRecord,
    PINNED_RECORDS_CHANGED_EVENT,
    togglePinnedRecord,
} from "@/lib/pinnedRecords";
import HistoryTabFilters, { useHistoryFilters } from "@/components/HistoryTabFilters";
import { toast } from "sonner";
import AddTearsheetModal from "@/components/AddTearsheetModal";

import {
    DndContext,
    closestCorners,
    type DragEndEvent,
    type DragOverEvent,
    useDroppable,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    MeasuringStrategy,
} from "@dnd-kit/core";
import { restrictToWindowEdges, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    sortableKeyboardCoordinates,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbGripVertical } from "react-icons/tb";
// import { FiLock, FiUnlock } from "react-icons/fi";

// Default header fields for Tasks module - defined outside component to ensure stable reference
const TASK_DEFAULT_HEADER_FIELDS = ["dueDate", "assignedTo"];

// Standard header field keys -> display labels (when not in API catalog)
const TASK_HEADER_FIELD_LABELS: Record<string, string> = {
    dueDate: "Due Date",
    assignedTo: "Assigned To",
    priority: "Priority",
    status: "Status",
    owner: "Owner",
    jobSeeker: "Job Seeker",
    hiringManager: "Hiring Manager",
    job: "Job",
    organization: "Organization",
    lead: "Lead",
    dateCreated: "Date Created",
    createdBy: "Created By",
    website: "Website",
};

// Storage keys for Task Details and Task Overview – field lists come from admin (custom field definitions)
const TASK_DETAILS_STORAGE_KEY = "taskDetailsFields";
const TASK_OVERVIEW_STORAGE_KEY = "taskOverviewFields";

function DroppableContainer({
    id,
    children,
    items,
}: {
    id: string;
    children: ReactNode;
    items: string[];
}) {
    const { setNodeRef } = useDroppable({ id });
    return (
        <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
            <div ref={setNodeRef} className="flex flex-col gap-4 w-full min-h-[100px]">
                {children}
            </div>
        </SortableContext>
    );
}

function SortablePanel({
    id,
    children,
    isOverlay = false,
}: {
    id: string;
    children: ReactNode;
    isOverlay?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
        zIndex: isOverlay ? 1000 : undefined,
    };

    return (
        <div ref={setNodeRef} style={style} className={`relative group ${isOverlay ? "cursor-grabbing" : ""}`}>
            {!isOverlay && (
                <button
                    {...attributes}
                    {...listeners}
                    className="absolute left-2 top-2 z-10 p-1 bg-gray-100 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Drag to reorder"
                >
                    <TbGripVertical className="no-print w-5 h-5 text-gray-600" />
                </button>
            )}
            <div className={`${isDragging && !isOverlay ? "invisible" : ""} pt-0`}>{children}</div>
            {isDragging && !isOverlay && (
                <div className="absolute inset-0 border-2 border-dashed border-gray-300 rounded bg-gray-50 flex items-center justify-center p-4">
                    <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider italic">
                        Moving Panel...
                    </div>
                </div>
            )}
        </div>
    );
}

// Sortable row for Task Details edit modal (vertical drag + checkbox + label)
function SortableTaskDetailsFieldRow({
    id,
    label,
    checked,
    onToggle,
    isOverlay,
}: {
    id: string;
    label: string;
    checked: boolean;
    onToggle: () => void;
    isOverlay?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.5 : 1,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 p-2 border border-gray-200 rounded bg-white ${isOverlay ? "shadow-lg cursor-grabbing" : "hover:bg-gray-50"} ${isDragging && !isOverlay ? "invisible" : ""}`}
        >
            {!isOverlay && (
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
                    title="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                >
                    <TbGripVertical size={18} />
                </button>
            )}
            <input
                type="checkbox"
                checked={checked}
                onChange={onToggle}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 flex-1">{label}</span>
        </div>
    );
}

// Sortable row for Task Overview edit modal (vertical drag + checkbox + label)
function SortableTaskOverviewFieldRow({
    id,
    label,
    checked,
    onToggle,
    isOverlay,
}: {
    id: string;
    label: string;
    checked: boolean;
    onToggle: () => void;
    isOverlay?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.5 : 1,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 p-2 border border-gray-200 rounded bg-white ${isOverlay ? "shadow-lg cursor-grabbing" : "hover:bg-gray-50"} ${isDragging && !isOverlay ? "invisible" : ""}`}
        >
            {!isOverlay && (
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
                    title="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                >
                    <TbGripVertical size={18} />
                </button>
            )}
            <input
                type="checkbox"
                checked={checked}
                onChange={onToggle}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 flex-1">{label}</span>
        </div>
    );
}

// Sortable row for Header Fields edit modal (vertical drag + checkbox + label)
function SortableHeaderFieldRow({
    id,
    label,
    checked,
    onToggle,
    isOverlay,
}: {
    id: string;
    label: string;
    checked: boolean;
    onToggle: () => void;
    isOverlay?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.5 : 1,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 p-2 border border-gray-200 rounded bg-white ${isOverlay ? "shadow-lg cursor-grabbing" : "hover:bg-gray-50"} ${isDragging && !isOverlay ? "invisible" : ""}`}
        >
            {!isOverlay && (
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
                    title="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                >
                    <TbGripVertical size={18} />
                </button>
            )}
            <input
                type="checkbox"
                checked={checked}
                onChange={onToggle}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0"
            />
            <span className="text-sm text-gray-700 flex-1 truncate">{label}</span>
        </div>
    );
}

const TASK_VIEW_TAB_IDS = ['summary', 'modify', 'history', 'notes'];

interface NoteFormState {
  text: string;
  action?: string;
  about: string;
  aboutReferences: Array<{
    id: string;
    type: string;
    display: string;
    value: string;
  }>;
  copyNote: string;
  replaceGeneralContactComments: boolean;
  additionalReferences: string;
  scheduleNextAction: string;
  emailNotification: string[];
}

export default function TaskView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const taskId = searchParams.get('id');
    const tabFromUrl = searchParams.get('tab');

    const [activeTab, setActiveTabState] = useState(() =>
        tabFromUrl && TASK_VIEW_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'summary'
    );

    const setActiveTab = (tabId: string) => {
        setActiveTabState(tabId);
        const params = new URLSearchParams(searchParams.toString());
        if (tabId === 'summary') params.delete('tab');
        else params.set('tab', tabId);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    useEffect(() => {
        if (tabFromUrl && TASK_VIEW_TAB_IDS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
            setActiveTabState(tabFromUrl);
        } else if (!tabFromUrl && activeTab !== 'summary') {
            setActiveTabState('summary');
        }
    }, [tabFromUrl]);

    // Add states for task data
    const [task, setTask] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pinned record (bookmarks bar) state
    const [isRecordPinned, setIsRecordPinned] = useState(false);

    // Notes and history state
    const [notes, setNotes] = useState<Array<any>>([]);
    const [history, setHistory] = useState<Array<any>>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [noteError, setNoteError] = useState<string | null>(null);
    const historyFilters = useHistoryFilters(history);
    const [showAddNote, setShowAddNote] = useState(false);

    // Note sorting & filtering (match Organization Notes design)
    const [noteActionFilter, setNoteActionFilter] = useState<string>('');
    const [noteAuthorFilter, setNoteAuthorFilter] = useState<string>('');
    const [noteSortKey, setNoteSortKey] = useState<'date' | 'action' | 'author'>('date');
    const [noteSortDir, setNoteSortDir] = useState<'asc' | 'desc'>('desc');
    const sortedFilteredNotes = useMemo(() => {
        let out = [...notes];
        if (noteActionFilter) {
            out = out.filter((n) => (n.action || '') === noteActionFilter);
        }
        if (noteAuthorFilter) {
            out = out.filter(
                (n) => (n.created_by_name || 'Unknown User') === noteAuthorFilter
            );
        }
        out.sort((a, b) => {
            let av: any, bv: any;
            switch (noteSortKey) {
                case 'action':
                    av = a.action || '';
                    bv = b.action || '';
                    break;
                case 'author':
                    av = a.created_by_name || '';
                    bv = b.created_by_name || '';
                    break;
                default:
                    av = new Date(a.created_at).getTime();
                    bv = new Date(b.created_at).getTime();
                    break;
            }
            if (typeof av === 'number' && typeof bv === 'number') {
                return noteSortDir === 'asc' ? av - bv : bv - av;
            }
            const cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true });
            return noteSortDir === 'asc' ? cmp : -cmp;
        });
        return out;
    }, [notes, noteActionFilter, noteAuthorFilter, noteSortKey, noteSortDir]);

    // Add Note form state - matching Hiring Manager (Action, About Reference, Email Notification)
    const [validationErrors, setValidationErrors] = useState<{ text?: string; action?: string; about?: string }>({});
    const [noteForm, setNoteForm] = useState<NoteFormState>({
        text: '',
        action: '',
        about: '',
        aboutReferences: [],
        copyNote: 'No',
        replaceGeneralContactComments: false,
        additionalReferences: '',
        scheduleNextAction: 'None',
        emailNotification: []
    });
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Action fields (Field500 from Admin field-management/tasks)
    const [actionFields, setActionFields] = useState<any[]>([]);
    const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);
    // About reference search
    const [aboutSearchQuery, setAboutSearchQuery] = useState('');
    const [aboutSuggestions, setAboutSuggestions] = useState<any[]>([]);
    const [showAboutDropdown, setShowAboutDropdown] = useState(false);
    const [isLoadingAboutSearch, setIsLoadingAboutSearch] = useState(false);
    const aboutInputRef = useRef<HTMLInputElement>(null);
    // Email notification
    const [emailSearchQuery, setEmailSearchQuery] = useState('');
    const [showEmailDropdown, setShowEmailDropdown] = useState(false);
    const emailInputRef = useRef<HTMLDivElement>(null);

    const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);

    // Field management – panels driven from admin field definitions (must be before header catalog)
    const [availableFields, setAvailableFields] = useState<any[]>([]);

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

    // Sensors for Header Fields modal drag-and-drop
    const headerFieldsSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Drop animation config for drag overlay
    const dropAnimationConfig = useMemo(() => ({
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: "0.5",
                },
            },
        }),
    }), []);

    const [headerFieldsDragActiveId, setHeaderFieldsDragActiveId] = useState<string | null>(null);
    // Maintain order for all header fields (including unselected ones for proper ordering)
    const [headerFieldsOrder, setHeaderFieldsOrder] = useState<string[]>([]);

    const headerFieldCatalog = useMemo(() => {
        const seen = new Set<string>();
        const fromApi = (availableFields || [])
            .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
            .map((f: any) => {
                const k = f.field_name || f.field_key || f.field_label || f.id;
                return {
                    key: `custom:${String(k)}`,
                    label: f.field_label || f.field_name || String(k),
                    fieldType: (f.field_type ?? f.fieldType ?? "") as string,
                    lookupType: (f.lookup_type ?? f.lookupType ?? "") as string,
                    multiSelectLookupType: (f.multi_select_lookup_type ?? f.multiSelectLookupType ?? "") as string,
                };
            })
            .filter((x) => {
                if (seen.has(x.key)) return false;
                seen.add(x.key);
                return true;
            });
        return fromApi;
    }, [availableFields]);

    const getHeaderFieldInfo = (key: string) => {
        const found = headerFieldCatalog.find((f) => f.key === key);
        return found as { key: string; label: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
    };

    const getHeaderFieldValue = (key: string) => {
        if (!task) return "-";
        const t = task as Record<string, unknown>;

        // custom fields (same resolution order as organization: direct, customFields by rawKey, then by catalog label)
        if (key.startsWith("custom:")) {
            const rawKey = key.replace("custom:", "");
            let v = t[rawKey];
            if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
            v = task.customFields?.[rawKey];
            if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
            const field = headerFieldCatalog.find((f) => f.key === key);
            if (field) v = task.customFields?.[field.label];
            return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
        }

        // standard fields
        // switch (key) {
        //     case "dueDate":
        //         return task.dueDateTimeFormatted || "Not set";
        //     case "assignedTo":
        //         return task.assignedTo || "Not assigned";
        //     case "priority":
        //         return task.priority || "-";
        //     case "status":
        //         return task.status || "-";
        //     case "owner":
        //         return task.owner || "-";
        //     case "jobSeeker":
        //         return task.jobSeeker || "-";
        //     case "hiringManager":
        //         return task.hiringManager || "-";
        //     case "job":
        //         return task.job || "-";
        //     case "organization":
        //         return task.organization || "-";
        //     case "lead":
        //         return task.lead || "-";
        //     case "dateCreated":
        //         return task.dateCreated || "-";
        //     case "createdBy":
        //         return task.createdBy || "-";
        //     default:
        //         return "-";
        // }
    };

    const getHeaderFieldLabel = (key: string) => {
        const found = headerFieldCatalog.find((f) => f.key === key);
        if (found?.label) return found.label;
        return TASK_HEADER_FIELD_LABELS[key] ?? key;
    };

    const handleHeaderFieldsDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setHeaderFieldsDragActiveId(null);
        if (!over || active.id === over.id) return;
        setHeaderFieldsOrder((prev) => {
            const oldIndex = prev.indexOf(active.id as string);
            const newIndex = prev.indexOf(over.id as string);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
        // Also update headerFields order if both are in headerFields
        setHeaderFields((prev) => {
            const oldIndex = prev.indexOf(active.id as string);
            const newIndex = prev.indexOf(over.id as string);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    // Initialize headerFieldsOrder when headerFields or catalog changes
    useEffect(() => {
        if (headerFieldCatalog.length > 0 && headerFieldsOrder.length === 0) {
            // Initialize order with headerFields, then add remaining catalog fields
            const catalogKeys = headerFieldCatalog.map((f) => f.key);
            const selectedOrder = headerFields.filter((k) => catalogKeys.includes(k));
            const newFields = catalogKeys.filter((k) => !selectedOrder.includes(k));
            setHeaderFieldsOrder([...selectedOrder, ...newFields]);
        }
    }, [headerFieldCatalog.length, headerFields]);

    // Fetch task when component mounts
    useEffect(() => {
        if (taskId) {
            fetchTask(taskId);
        }
    }, [taskId]);

    // Fetch action fields (Field500 from Admin field-management/tasks) - same logic as Hiring Manager
    useEffect(() => {
        const fetchActionFields = async () => {
            setIsLoadingActionFields(true);
            try {
                const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1');
                const response = await fetch('/api/admin/field-management/tasks', {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                });
                if (response.ok) {
                    const raw = await response.text();
                    let data: any = {};
                    try { data = JSON.parse(raw); } catch { }
                    const fields = data.customFields || data.fields || data.data?.fields || data.taskFields || [];
                    const fieldNamesToCheck = ['field_500', 'actions', 'action'];
                    const field500 = (fields as any[]).find(
                        (f: any) =>
                            fieldNamesToCheck.includes(String(f.field_name || '').toLowerCase()) ||
                            fieldNamesToCheck.includes(String(f.field_label || '').toLowerCase())
                    );
                    if (field500 && field500.options) {
                        let options = field500.options;
                        if (typeof options === 'string') {
                            try { options = JSON.parse(options); } catch { }
                        }
                        if (Array.isArray(options)) {
                            setActionFields(options.map((opt: any) => ({
                                id: opt.value || opt,
                                field_label: opt.label || opt.value || opt,
                                field_name: opt.value || opt,
                            })));
                        } else if (typeof options === 'object' && options !== null) {
                            setActionFields(Object.entries(options).map(([key, value]) => ({
                                id: key,
                                field_label: String(value),
                                field_name: key,
                            })));
                        } else setActionFields([]);
                    } else {
                        setActionFields([
                            { id: 'Outbound Call', field_label: 'Outbound Call', field_name: 'Outbound Call' },
                            { id: 'Inbound Call', field_label: 'Inbound Call', field_name: 'Inbound Call' },
                            { id: 'Left Message', field_label: 'Left Message', field_name: 'Left Message' },
                            { id: 'Email', field_label: 'Email', field_name: 'Email' },
                            { id: 'Appointment', field_label: 'Appointment', field_name: 'Appointment' },
                            { id: 'Client Visit', field_label: 'Client Visit', field_name: 'Client Visit' },
                        ]);
                    }
                } else {
                    setActionFields([
                        { id: 'Outbound Call', field_label: 'Outbound Call', field_name: 'Outbound Call' },
                        { id: 'Inbound Call', field_label: 'Inbound Call', field_name: 'Inbound Call' },
                        { id: 'Left Message', field_label: 'Left Message', field_name: 'Left Message' },
                        { id: 'Email', field_label: 'Email', field_name: 'Email' },
                        { id: 'Appointment', field_label: 'Appointment', field_name: 'Appointment' },
                        { id: 'Client Visit', field_label: 'Client Visit', field_name: 'Client Visit' },
                    ]);
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
        fetchActionFields();
    }, []);

    // When Add Note modal opens, set default About reference to current task
    useEffect(() => {
        if (showAddNote && task && taskId) {
            const defaultRef = [{
                id: String(task.id),
                type: 'Task',
                display: `${formatRecordId(Number(task.id), 'task')} ${task.title || 'Untitled'}`,
                value: formatRecordId(Number(task.id), 'task'),
            }];
            setNoteForm(prev => ({
                ...prev,
                about: defaultRef.map(r => r.display).join(', '),
                aboutReferences: defaultRef,
                text: '',
                action: '',
                emailNotification: [],
            }));
            setAboutSearchQuery('');
            setEmailSearchQuery('');
            setShowAboutDropdown(false);
            setShowEmailDropdown(false);
            setValidationErrors({});
        }
    }, [showAddNote, task?.id, taskId]);

    // Fetch users for email notification
    useEffect(() => {
        if (showAddNote) {
            fetchUsers();
        }
    }, [showAddNote]);

    // Close About and Email dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (aboutInputRef.current && !aboutInputRef.current.contains(target)) setShowAboutDropdown(false);
            if (emailInputRef.current && !emailInputRef.current.contains(target)) setShowEmailDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                organization: data.task.organization_name || 'Not specified',
                organizationId: data.task.organization_id,
                lead: data.task.lead_name || 'Not specified',
                leadId: data.task.lead_id,
                placement: data.task.placement_id ? `Placement #${data.task.placement_id}` : 'Not specified',
                placementId: data.task.placement_id,
                dateCreated: data.task.created_at ? new Date(data.task.created_at).toLocaleDateString() : 'Unknown',
                createdBy: data.task.created_by_name || 'Unknown',
                completedAt: data.task.completed_at ? new Date(data.task.completed_at).toLocaleDateString() : null,
                completedBy: data.task.completed_by_name || null,
                customFields: customFieldsObj, // Use our properly parsed object
                archivedAt: data.task.archived_at || "",
                archiveReason: data.task.archive_reason || "",
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

    // Panel visibility state (availableFields declared above with header block)
    const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>(() => {
        if (typeof window === "undefined") {
            return { taskOverview: [], details: [], recentNotes: ["notes"] };
        }
        let taskOverview: string[] = [];
        let details: string[] = [];
        try {
            const to = localStorage.getItem(TASK_OVERVIEW_STORAGE_KEY);
            if (to) {
                const parsed = JSON.parse(to);
                if (Array.isArray(parsed) && parsed.length > 0) taskOverview = Array.from(new Set(parsed));
            }
        } catch (_) { }
        try {
            const d = localStorage.getItem(TASK_DETAILS_STORAGE_KEY);
            if (d) {
                const parsed = JSON.parse(d);
                if (Array.isArray(parsed) && parsed.length > 0) details = Array.from(new Set(parsed));
            }
        } catch (_) { }
        return { taskOverview, details, recentNotes: ["notes"] };
    });
    const [editingPanel, setEditingPanel] = useState<string | null>(null);
    const [isLoadingFields, setIsLoadingFields] = useState(false);

    // Modal-local state for Task Details edit
    const [modalDetailsOrder, setModalDetailsOrder] = useState<string[]>([]);
    const [modalDetailsVisible, setModalDetailsVisible] = useState<Record<string, boolean>>({});
    const [detailsDragActiveId, setDetailsDragActiveId] = useState<string | null>(null);

    // Modal-local state for Task Overview edit
    const [modalTaskOverviewOrder, setModalTaskOverviewOrder] = useState<string[]>([]);
    const [modalTaskOverviewVisible, setModalTaskOverviewVisible] = useState<Record<string, boolean>>({});

    // Delete request state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const deleteFromUrl = searchParams.get("delete");

    // Check for delete parameter in URL to open delete modal
    useEffect(() => {
      if (deleteFromUrl === "true" && !showDeleteModal) {
        setShowDeleteModal(true);
        // Remove the delete parameter from URL after opening modal
        const params = new URLSearchParams(searchParams.toString());
        params.delete("delete");
        router.replace(`?${params.toString()}`, { scroll: false });
      }
    }, [deleteFromUrl, showDeleteModal, searchParams, router]);
    const [deleteForm, setDeleteForm] = useState({
        reason: "", // Mandatory reason for deletion
    });
    const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
    const [pendingDeleteRequest, setPendingDeleteRequest] = useState<any>(null);
    const [isLoadingDeleteRequest, setIsLoadingDeleteRequest] = useState(false);
    const [taskOverviewDragActiveId, setTaskOverviewDragActiveId] = useState<string | null>(null);

    const fetchAvailableFields = useCallback(async () => {
        setIsLoadingFields(true);
        try {
            const token = document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );

            const response = await fetch("/api/admin/field-management/tasks", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json().catch(() => ({}));
            console.log("data", data);
            const fields =
                data?.customFields
            // (data as any).fields ||
            // (data as any).data?.customFields ||
            // (data as any).data?.fields ||
            // [];

            setAvailableFields(Array.isArray(fields) ? fields : []);
            console.log("availableFields", availableFields);
        } catch (err) {
            console.error("Error fetching task available fields:", err);
        } finally {
            setIsLoadingFields(false);
        }
    }, []);

    useEffect(() => {
        if (!task) return;
        fetchAvailableFields();
    }, [task, fetchAvailableFields]);

    const toggleFieldVisibility = (panelId: string, fieldKey: string) => {
        setVisibleFields((prev) => {
            const panelFields = prev[panelId] || [];
            const uniqueFields = Array.from(new Set(panelFields));
            if (uniqueFields.includes(fieldKey)) {
                return { ...prev, [panelId]: uniqueFields.filter((x) => x !== fieldKey) };
            }
            return { ...prev, [panelId]: Array.from(new Set([...uniqueFields, fieldKey])) };
        });
    };

    // Task Details field catalog: from admin field definitions + record customFields only (no hardcoded standard)
    const taskDetailsFieldCatalog = useMemo(() => {
        const fromApi = (availableFields || [])
            .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
            .map((f: any) => ({
                key: String(f.field_key || f.api_name || f.field_name || f.id),
                label: String(f.field_label || f.field_name || f.field_key || f.id),
                fieldType: String(f.field_type || f.fieldType),
                lookupType: String(f.lookup_type || f.lookupType),
                multiSelectLookupType: String(f.multi_select_lookup_type || f.multiSelectLookupType),
            }));
        return [...fromApi];
    }, [availableFields]);

    // Task Overview field catalog: from admin field definitions + record customFields only
    const taskOverviewFieldCatalog = useMemo(() => {
        const fromApi = (availableFields || [])
            .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
            .map((f: any) => ({
                key: String(f.field_key || f.api_name || f.field_name || f.id),
                label: String(f.field_label || f.field_name || f.field_key || f.id),
                fieldType: String(f.field_type || f.fieldType),
                lookupType: String(f.lookup_type || f.lookupType),
                multiSelectLookupType: String(f.multi_select_lookup_type || f.multiSelectLookupType),
            }));
        return [...fromApi];
    }, [availableFields]);

    // When catalog loads, if details/taskOverview visible list is empty, default to all catalog keys
    useEffect(() => {
        const keys = taskDetailsFieldCatalog.map((f) => f.key);
        if (keys.length > 0) {
            setVisibleFields((prev) => {
                const current = prev.details || [];
                if (current.length > 0) return prev;
                return { ...prev, details: keys };
            });
        }
    }, [taskDetailsFieldCatalog]);

    useEffect(() => {
        const keys = taskOverviewFieldCatalog.map((f) => f.key);
        if (keys.length > 0) {
            setVisibleFields((prev) => {
                const current = prev.taskOverview || [];
                if (current.length > 0) return prev;
                return { ...prev, taskOverview: keys };
            });
        }
    }, [taskOverviewFieldCatalog]);

    // Sync Task Details modal state when opening edit for details
    useEffect(() => {
        if (editingPanel !== "details") return;
        const current = visibleFields.details || [];
        const catalogKeys = taskDetailsFieldCatalog.map((f) => f.key);
        const uniqueCatalogKeys = Array.from(new Set(catalogKeys));
        const order = [...current.filter((k) => uniqueCatalogKeys.includes(k))];
        uniqueCatalogKeys.forEach((k) => {
            if (!order.includes(k)) order.push(k);
        });
        const uniqueOrder = Array.from(new Set(order));
        setModalDetailsOrder(uniqueOrder);
        setModalDetailsVisible(
            uniqueCatalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
        );
    }, [editingPanel, visibleFields.details, taskDetailsFieldCatalog]);

    // Sync Task Overview modal state when opening edit for taskOverview
    useEffect(() => {
        if (editingPanel !== "taskOverview") return;
        const current = visibleFields.taskOverview || [];
        const catalogKeys = taskOverviewFieldCatalog.map((f) => f.key);
        const uniqueCatalogKeys = Array.from(new Set(catalogKeys));
        const order = [...current.filter((k) => uniqueCatalogKeys.includes(k))];
        uniqueCatalogKeys.forEach((k) => {
            if (!order.includes(k)) order.push(k);
        });
        const uniqueOrder = Array.from(new Set(order));
        setModalTaskOverviewOrder(uniqueOrder);
        setModalTaskOverviewVisible(
            uniqueCatalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
        );
    }, [editingPanel, visibleFields.taskOverview, taskOverviewFieldCatalog]);

    // Task Details modal: drag end (reorder)
    const handleTaskDetailsDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDetailsDragActiveId(null);
        if (!over || active.id === over.id) return;
        setModalDetailsOrder((prev) => {
            const oldIndex = prev.indexOf(active.id as string);
            const newIndex = prev.indexOf(over.id as string);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    }, []);

    // Task Details modal: save order/visibility and persist for all records
    const handleSaveTaskDetailsFields = useCallback(() => {
        const newOrder = Array.from(new Set(modalDetailsOrder.filter((k) => modalDetailsVisible[k])));
        if (typeof window !== "undefined") {
            localStorage.setItem(TASK_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
        }
        setVisibleFields((prev) => ({ ...prev, details: newOrder }));
        setEditingPanel(null);
    }, [modalDetailsOrder, modalDetailsVisible]);

    // Task Overview modal: drag end (reorder)
    const handleTaskOverviewDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setTaskOverviewDragActiveId(null);
        if (!over || active.id === over.id) return;
        setModalTaskOverviewOrder((prev) => {
            const oldIndex = prev.indexOf(active.id as string);
            const newIndex = prev.indexOf(over.id as string);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    }, []);

    // Task Overview modal: save order/visibility and persist for all records
    const handleSaveTaskOverviewFields = useCallback(() => {
        const newOrder = Array.from(new Set(modalTaskOverviewOrder.filter((k) => modalTaskOverviewVisible[k])));
        if (typeof window !== "undefined") {
            localStorage.setItem(TASK_OVERVIEW_STORAGE_KEY, JSON.stringify(newOrder));
        }
        setVisibleFields((prev) => ({ ...prev, taskOverview: newOrder }));
        setEditingPanel(null);
    }, [modalTaskOverviewOrder, modalTaskOverviewVisible]);

    const handleEditPanel = (panelId: string) => {
        setEditingPanel(panelId);
    };

    const handleCloseEditModal = () => {
        setEditingPanel(null);
    };

    const getTaskFieldLabel = (key: string) => {
        const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;

        const fromHeader = headerFieldCatalog.find((f) => f.key === key);
        if (fromHeader?.label) return fromHeader.label;

        const def = (availableFields || []).find((f: any) => {
            const stableKey = f.field_key || f.api_name || f.field_name || f.id;
            return stableKey === rawKey;
        });

        return def?.field_label || def?.field_name || rawKey;
    };

    const getTaskFieldValue = (key: string) => {
        if (!task) return "-";

        const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;

        const getCustomValue = (k: string) => {
            const direct = task.customFields?.[k];
            if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
                return String(direct);
            }

            const def = (availableFields || []).find((f: any) => {
                const stableKey = f.field_key || f.api_name || f.field_name || f.id;
                return stableKey === k;
            });

            if (def?.field_label) {
                const val = task.customFields?.[def.field_label];
                if (val !== undefined && val !== null && String(val).trim() !== "") {
                    return String(val);
                }
            }

            if (def?.field_name) {
                const val = task.customFields?.[def.field_name];
                if (val !== undefined && val !== null && String(val).trim() !== "") {
                    return String(val);
                }
            }

            return null;
        };

        if (key.startsWith("custom:")) {
            const val = getCustomValue(rawKey);
            return val === null ? "-" : val;
        }

        const std = (task as any)[rawKey];
        if (std !== undefined && std !== null && String(std).trim() !== "") {
            return String(std);
        }

        const custom = getCustomValue(rawKey);
        return custom === null ? "-" : custom;
    };

    const getTaskFieldInfo = (key: string) => {
        const found = taskDetailsFieldCatalog.find((f) => f.key === key);
        return found as { key: string; label: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
    };

    // For summary: render record names as clickable links to their view pages
    const getTaskFieldDisplayContent = (key: string): React.ReactNode => {
        const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;
        console.log("rawKey", getTaskFieldLabel(key));
        const displayValue = getTaskFieldValue(key);
        // const linkMap: Record<string, { id: number | null | undefined; path: string }> = {
        //     jobSeeker: { id: task?.jobSeekerId, path: "/dashboard/job-seekers/view" },
        //     hiringManager: { id: task?.hiringManagerId, path: "/dashboard/hiring-managers/view" },
        //     job: { id: task?.jobId, path: "/dashboard/jobs/view" },
        //     organization: { id: task?.organizationId, path: "/dashboard/organizations/view" },
        //     lead: { id: task?.leadId, path: "/dashboard/leads/view" },
        // };
        // console.log("linkMap", linkMap);
        // const link = linkMap[rawKey];
        // if (link?.id != null && Number(link.id) > 0 && String(displayValue) !== "-" && String(displayValue).trim() !== "") {
        //     return (
        //         <button
        //             type="button"
        //             onClick={() => router.push(`${link.path}?id=${link.id}`)}
        //             className="text-blue-600 hover:underline text-left"
        //         >
        //             {displayValue}
        //         </button>
        //     );
        // }
        return displayValue;
    };

    // Fetch users for email notification dropdown (internal users only - same as Hiring Manager)
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
                const internalUsers = (data.users || []).filter(
                    (u: any) =>
                        u.user_type === 'internal' ||
                        u.role === 'admin' ||
                        u.role === 'user' ||
                        (!u.user_type && u.email)
                );
                setUsers(internalUsers);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    // Search for About/Reference - global search (same logic as Hiring Manager)
    const searchAboutReferences = async (query: string) => {
        setIsLoadingAboutSearch(true);
        setShowAboutDropdown(true);
        if (!query || query.trim().length < 2) {
            setAboutSuggestions([]);
            setIsLoadingAboutSearch(false);
            return;
        }
        try {
            const searchTerm = query.trim();
            const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1');
            const headers = { Authorization: `Bearer ${token}` };
            const [jobsRes, orgsRes, jobSeekersRes, leadsRes, tasksRes, placementsRes, hiringManagersRes] = await Promise.allSettled([
                fetch('/api/jobs', { headers }),
                fetch('/api/organizations', { headers }),
                fetch('/api/job-seekers', { headers }),
                fetch('/api/leads', { headers }),
                fetch('/api/tasks', { headers }),
                fetch('/api/placements', { headers }),
                fetch('/api/hiring-managers', { headers }),
            ]);
            const suggestions: any[] = [];
            if (jobsRes.status === 'fulfilled' && jobsRes.value.ok) {
                const data = await jobsRes.value.json();
                (data.jobs || []).filter((j: any) => (j.job_title || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(j.id).includes(searchTerm)).forEach((job: any) => {
                    suggestions.push({ id: job.id, type: 'Job', display: `${formatRecordId(job.id, 'job')} ${job.job_title || 'Untitled'}`, value: formatRecordId(job.id, 'job') });
                });
            }
            if (orgsRes.status === 'fulfilled' && orgsRes.value.ok) {
                const data = await orgsRes.value.json();
                (data.organizations || []).filter((o: any) => (o.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(o.id).includes(searchTerm)).forEach((org: any) => {
                    suggestions.push({ id: org.id, type: 'Organization', display: `${formatRecordId(org.id, 'organization')} ${org.name || 'Unnamed'}`, value: formatRecordId(org.id, 'organization') });
                });
            }
            if (jobSeekersRes.status === 'fulfilled' && jobSeekersRes.value.ok) {
                const data = await jobSeekersRes.value.json();
                (data.jobSeekers || []).filter((js: any) => `${(js.first_name || '')} ${(js.last_name || '')}`.toLowerCase().includes(searchTerm.toLowerCase()) || String(js.id).includes(searchTerm)).forEach((js: any) => {
                    const name = `${(js.first_name || '')} ${(js.last_name || '')}`.trim() || 'Unnamed';
                    suggestions.push({ id: js.id, type: 'Job Seeker', display: `${formatRecordId(js.id, 'jobSeeker')} ${name}`, value: formatRecordId(js.id, 'jobSeeker') });
                });
            }
            if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
                const data = await leadsRes.value.json();
                (data.leads || []).filter((l: any) => (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(l.id).includes(searchTerm)).forEach((lead: any) => {
                    suggestions.push({ id: lead.id, type: 'Lead', display: `${formatRecordId(lead.id, 'lead')} ${lead.name || 'Unnamed'}`, value: formatRecordId(lead.id, 'lead') });
                });
            }
            if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
                const data = await tasksRes.value.json();
                (data.tasks || []).filter((t: any) => (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(t.id).includes(searchTerm)).forEach((t: any) => {
                    suggestions.push({ id: t.id, type: 'Task', display: `${formatRecordId(t.id, 'task')} ${t.title || 'Untitled'}`, value: formatRecordId(t.id, 'task') });
                });
            }
            if (placementsRes.status === 'fulfilled' && placementsRes.value.ok) {
                const data = await placementsRes.value.json();
                (data.placements || []).filter((p: any) => String(p.id).includes(searchTerm)).forEach((p: any) => {
                    suggestions.push({ id: p.id, type: 'Placement', display: `${formatRecordId(p.id, 'placement')} Placement`, value: formatRecordId(p.id, 'placement') });
                });
            }
            if (hiringManagersRes.status === 'fulfilled' && hiringManagersRes.value.ok) {
                const data = await hiringManagersRes.value.json();
                (data.hiringManagers || []).filter((hm: any) => {
                    const name = `${(hm.first_name || '')} ${(hm.last_name || '')}`.trim() || hm.full_name || '';
                    return name.toLowerCase().includes(searchTerm.toLowerCase()) || String(hm.id).includes(searchTerm);
                }).forEach((hm: any) => {
                    const name = `${(hm.first_name || '')} ${(hm.last_name || '')}`.trim() || hm.full_name || 'Unnamed';
                    suggestions.push({ id: hm.id, type: 'Hiring Manager', display: `${formatRecordId(hm.id, 'hiringManager')} ${name}`, value: formatRecordId(hm.id, 'hiringManager') });
                });
            }
            const selectedIds = (noteForm.aboutReferences || []).map((r: any) => r.id);
            const filtered = suggestions.filter((s: any) => !selectedIds.includes(s.id));
            setAboutSuggestions(filtered.slice(0, 10));
        } catch (err) {
            console.error('Error searching about references:', err);
            setAboutSuggestions([]);
        } finally {
            setIsLoadingAboutSearch(false);
        }
    };

    const handleAboutReferenceSelect = (reference: any) => {
        setNoteForm(prev => {
            const newRefs = [...(prev.aboutReferences || []), reference];
            return { ...prev, aboutReferences: newRefs, about: newRefs.map(r => r.display).join(', ') };
        });
        setAboutSearchQuery('');
        setShowAboutDropdown(false);
        setAboutSuggestions([]);
    };

    const removeAboutReference = (index: number) => {
        setNoteForm(prev => {
            const newRefs = prev.aboutReferences.filter((_, i) => i !== index);
            return { ...prev, aboutReferences: newRefs, about: newRefs.length ? newRefs.map(r => r.display).join(', ') : '' };
        });
    };

    const emailNotificationSuggestions = useMemo(() => {
        if (!emailSearchQuery.trim()) return users.slice(0, 10);
        const q = emailSearchQuery.toLowerCase();
        return users.filter((u: any) => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)).slice(0, 10);
    }, [users, emailSearchQuery]);

    const handleEmailNotificationSelect = (user: any) => {
        const label = user.name || user.email || '';
        if (!label || noteForm.emailNotification.includes(label)) return;
        setNoteForm(prev => ({ ...prev, emailNotification: [...prev.emailNotification, label] }));
        setEmailSearchQuery('');
        setShowEmailDropdown(false);
    };

    const removeEmailNotification = (val: string) => {
        setNoteForm(prev => ({ ...prev, emailNotification: prev.emailNotification.filter(v => v !== val) }));
    };

    // Fetch notes for the task
    const fetchNotes = async (id: string) => {
        setIsLoadingNotes(true);
        setNoteError(null);
        try {
            const response = await fetch(`/api/tasks/${id}/notes`, {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to fetch notes');
            }

            const data = await response.json();
            setNotes(data.notes || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
            setNoteError(err instanceof Error ? err.message : 'An error occurred while fetching notes');
        } finally {
            setIsLoadingNotes(false);
        }
    };

    // Fetch history for the task
    const fetchHistory = async (id: string) => {
        setIsLoadingHistory(true);
        setHistoryError(null);

        try {
            const response = await fetch(`/api/tasks/${id}/history`, {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch history');
            }

            const data = await response.json();
            setHistory(data.history || []);
        } catch (err) {
            console.error('Error fetching history:', err);
            setHistoryError(
                err instanceof Error
                    ? err.message
                    : 'An error occurred while fetching history'
            );
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Handle adding a new note (validation and payload match Hiring Manager)
    const handleAddNote = async () => {
        if (!taskId) return;

        const errors: { text?: string; action?: string; about?: string } = {};
        if (!noteForm.text.trim()) errors.text = 'Note text is required';
        if (!noteForm.action || !String(noteForm.action).trim()) errors.action = 'Action is required';
        if (!noteForm.aboutReferences || noteForm.aboutReferences.length === 0) errors.about = 'At least one About/Reference is required';
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }
        setValidationErrors({});

        try {
            const aboutData = noteForm.aboutReferences.map(ref => ({ id: ref.id, type: ref.type, display: ref.display, value: ref.value }));
            const response = await fetch(`/api/tasks/${taskId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    text: noteForm.text,
                    action: noteForm.action,
                    about_references: aboutData,
                    copy_note: noteForm.copyNote === 'Yes',
                    replace_general_contact_comments: noteForm.replaceGeneralContactComments,
                    additional_references: noteForm.additionalReferences,
                    schedule_next_action: noteForm.scheduleNextAction,
                    email_notification: Array.isArray(noteForm.emailNotification) ? noteForm.emailNotification : (noteForm.emailNotification ? [noteForm.emailNotification] : []),
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (errorData.errors) setValidationErrors(errorData.errors);
                else throw new Error(errorData.message || 'Failed to add note');
                return;
            }

            const data = await response.json();
            setNotes([data.note, ...notes]);
            const defaultRef = task && taskId ? [{ id: String(task.id), type: 'Task', display: `${formatRecordId(Number(task.id), 'task')} ${task.title || 'Untitled'}`, value: formatRecordId(Number(task.id), 'task') }] : [];
            setNoteForm({
                text: '',
                action: '',
                about: defaultRef.map(r => r.display).join(', '),
                aboutReferences: defaultRef,
                copyNote: 'No',
                replaceGeneralContactComments: false,
                additionalReferences: '',
                scheduleNextAction: 'None',
                emailNotification: [],
            });
            setShowAddNote(false);
            toast.success('Note added successfully');
            fetchNotes(taskId);
            fetchHistory(taskId);
        } catch (err) {
            console.error('Error adding note:', err);
            toast.error(err instanceof Error ? err.message : 'An error occurred while adding a note');
        }
    };

    const handleCloseAddNoteModal = () => {
        setShowAddNote(false);
        const defaultRef = task && taskId ? [{ id: String(task.id), type: 'Task', display: `${formatRecordId(Number(task.id), 'task')} ${task.title || 'Untitled'}`, value: formatRecordId(Number(task.id), 'task') }] : [];
        setNoteForm({
            text: '',
            action: '',
            about: defaultRef.map(r => r.display).join(', '),
            aboutReferences: defaultRef,
            copyNote: 'No',
            replaceGeneralContactComments: false,
            additionalReferences: '',
            scheduleNextAction: 'None',
            emailNotification: [],
        });
        setValidationErrors({});
    };

    const handleGoBack = () => {
        router.back();
    };

    // Print handler: ensure Summary tab is active when printing
    const handlePrint = () => {
        const printContent = document.getElementById("printable-summary");
        if (!printContent) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const tabTitle = activeTab?.toUpperCase() || "Tasks SUMMARY";

        // clone styles
        const styles = Array.from(document.styleSheets)
            .map(sheet => {
                try {
                    if (sheet.href) {
                        return `<link rel="stylesheet" href="${sheet.href}" />`;
                    }
                    return `<style>${Array.from(sheet.cssRules)
                        .map(rule => rule.cssText)
                        .join("")}</style>`;
                } catch {
                    return "";
                }
            })
            .join("");

        printWindow.document.write(`
    <html>
      <head>
        <title>${tabTitle}</title>
        ${styles}
        <style>
          /* PAGE SETUP */
          @page {
            size: A4;
            margin: 18mm 16mm;
          }

          body {
            font-family: Inter, system-ui, Arial, sans-serif;
            background: #fff;
            color: #111827;
          }

          /* WRAPPER */
          .print-wrapper {
            max-width: 800px;
            margin: auto;
          }

          /* HEADER */
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }

          .print-title {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.03em;
          }

          .print-date {
            font-size: 11px;
            color: #6b7280;
          }

          /* FOOTER */
          .print-footer {
            position: fixed;
            bottom: 10mm;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
          }

          /* CLEANUP */
          .no-print {
            display: none !important;
          }

          table {
            page-break-inside: avoid;
          }

          .panel {
            page-break-inside: avoid;
          }
        </style>
      </head>

      <body>
        <div class="print-wrapper">

          <div class="print-header">
            <div class="print-title">${tabTitle}</div>
            <div class="print-date">
              ${new Date().toLocaleDateString()}
            </div>
          </div>

          ${printContent.innerHTML}

        </div>

        <div class="print-footer">
          Generated by System • Page <span class="pageNumber"></span>
        </div>
      </body>
    </html>
  `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 600);
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

    // Handle task deletion (kept for backward compatibility, but now shows modal)
    const handleDelete = async (id: string) => {
        checkPendingDeleteRequest();
        setShowDeleteModal(true);
    };

    // Check for pending delete request
    const checkPendingDeleteRequest = async () => {
        if (!taskId) return;

        setIsLoadingDeleteRequest(true);
        try {
            const response = await fetch(
                `/api/tasks/${taskId}/delete-request?record_type=task`,
                {
                    headers: {
                        Authorization: `Bearer ${document.cookie.replace(
                            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                            "$1"
                        )}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setPendingDeleteRequest(data.deleteRequest || null);
            } else {
                setPendingDeleteRequest(null);
            }
        } catch (error) {
            console.error("Error checking delete request:", error);
            setPendingDeleteRequest(null);
        } finally {
            setIsLoadingDeleteRequest(false);
        }
    };

    // Handle delete request submission
    const handleDeleteRequestSubmit = async () => {
        if (!deleteForm.reason.trim()) {
            toast.error("Please enter a reason for deletion");
            return;
        }

        if (!taskId) {
            toast.error("Task ID is missing");
            return;
        }

        setIsSubmittingDelete(true);
        try {
            // Get current user info
            const userCookie = document.cookie.replace(
                /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
            );
            let currentUser: any = null;
            if (userCookie) {
                try {
                    currentUser = JSON.parse(decodeURIComponent(userCookie));
                } catch (e) {
                    console.error("Error parsing user cookie:", e);
                }
            }

            // Step 1: Add "Delete requested" note to task
            const noteResponse = await fetch(`/api/tasks/${taskId}/notes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${document.cookie.replace(
                        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                        "$1"
                    )}`,
                },
                body: JSON.stringify({
                    text: `Delete requested by ${currentUser?.name || "Unknown User"} – Pending payroll approval`,
                    action: "Delete Request",
                }),
            });

            if (!noteResponse.ok) {
                console.error("Failed to add delete note");
            }

            // Step 2: Create delete request
            const deleteRequestResponse = await fetch(
                `/api/tasks/${taskId}/delete-request`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${document.cookie.replace(
                            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                            "$1"
                        )}`,
                    },
                    body: JSON.stringify({
                        reason: deleteForm.reason.trim(),
                        record_type: "task",
                        record_number: formatRecordId(task?.id, "task"),
                        requested_by: currentUser?.id || currentUser?.name || "Unknown",
                        requested_by_email: currentUser?.email || "",
                    }),
                }
            );

            if (!deleteRequestResponse.ok) {
                const errorData = await deleteRequestResponse
                    .json()
                    .catch(() => ({ message: "Failed to create delete request" }));
                throw new Error(
                    errorData.message || "Failed to create delete request"
                );
            }

            const deleteRequestData = await deleteRequestResponse.json();

            toast.success(
                "Delete request submitted successfully. Payroll will be notified via email."
            );

            // Refresh notes and delete request status
            if (taskId) {
                fetchNotes(taskId);
                checkPendingDeleteRequest();
            }

            setShowDeleteModal(false);
            setDeleteForm({ reason: "" });
        } catch (err) {
            console.error("Error submitting delete request:", err);
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to submit delete request. Please try again."
            );
        } finally {
            setIsSubmittingDelete(false);
        }
    };

    // Check for pending delete request on mount
    useEffect(() => {
        if (taskId) {
            checkPendingDeleteRequest();
        }
    }, [taskId]);

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

            const responseText = await response.text();
            let data: { message?: string } = {};
            try {
                data = responseText ? JSON.parse(responseText) : {};
            } catch (_) { }

            if (!response.ok) {
                const msg = data.message || response.statusText || 'Failed to update task';
                throw new Error(msg);
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

    // Render notes tab content (standardized to Organization Notes design)
    const renderNotesTab = () => {
        const parseAboutReferences = (refs: any) => {
            if (!refs) return [];
            if (typeof refs === 'string') {
                try {
                    return JSON.parse(refs);
                } catch {
                    return [];
                }
            }
            if (Array.isArray(refs)) return refs;
            return [];
        };
        const navigateToReference = (ref: any) => {
            if (!ref?.id || !ref?.type) return;
            const refType = (ref.type || '').toLowerCase().replace(/\s+/g, '');
            const routeMap: Record<string, string> = {
                organization: `/dashboard/organizations/view?id=${ref.id}`,
                job: `/dashboard/jobs/view?id=${ref.id}`,
                jobseeker: `/dashboard/job-seekers/view?id=${ref.id}`,
                lead: `/dashboard/leads/view?id=${ref.id}`,
                task: `/dashboard/tasks/view?id=${ref.id}`,
                placement: `/dashboard/placements/view?id=${ref.id}`,
                hiringmanager: `/dashboard/hiring-managers/view?id=${ref.id}`,
            };
            if (routeMap[refType]) router.push(routeMap[refType]);
        };

        const actionOptions = Array.from(new Set(notes.map((n) => n.action).filter(Boolean))) as string[];

        return (
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

                <div className="flex flex-wrap gap-4 items-end mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
                        <select
                            value={noteActionFilter}
                            onChange={(e) => setNoteActionFilter(e.target.value)}
                            className="p-2 border border-gray-300 rounded text-sm"
                        >
                            <option value="">All Actions</option>
                            {actionOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Author</label>
                        <select
                            value={noteAuthorFilter}
                            onChange={(e) => setNoteAuthorFilter(e.target.value)}
                            className="p-2 border border-gray-300 rounded text-sm"
                        >
                            <option value="">All Authors</option>
                            {Array.from(new Set(notes.map((n) => n.created_by_name || 'Unknown User'))).map((author) => (
                                <option key={author} value={author}>{author}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
                        <select
                            value={noteSortKey}
                            onChange={(e) => setNoteSortKey(e.target.value as 'date' | 'action' | 'author')}
                            className="p-2 border border-gray-300 rounded text-sm"
                        >
                            <option value="date">Date</option>
                            <option value="action">Action</option>
                            <option value="author">Author</option>
                        </select>
                    </div>
                    <div>
                        <button
                            onClick={() => setNoteSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs text-black"
                            title="Toggle Sort Direction"
                        >
                            {noteSortDir === 'asc' ? 'Asc ↑' : 'Desc ↓'}
                        </button>
                    </div>
                    {(noteActionFilter || noteAuthorFilter) && (
                        <button
                            onClick={() => { setNoteActionFilter(''); setNoteAuthorFilter(''); }}
                            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {isLoadingNotes ? (
                    <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : noteError ? (
                    <div className="text-red-500 py-2">{noteError}</div>
                ) : sortedFilteredNotes.length > 0 ? (
                    <div className="space-y-4">
                        {sortedFilteredNotes.map((note) => {
                            const actionLabel = note.action || 'General Note';
                            const aboutRefs = parseAboutReferences((note as any).about_references ?? (note as any).aboutReferences);
                            return (
                                <div id={`note-${note.id}`} key={note.id} className="p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
                                    <div className="border-b border-gray-200 pb-3 mb-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-blue-600">
                                                        {note.created_by_name || 'Unknown User'}
                                                    </span>
                                                    {actionLabel && (
                                                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                                                            {actionLabel}
                                                        </span>
                                                    )}
                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">
                                                        Task
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(note.created_at).toLocaleString('en-US', {
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        const el = document.getElementById(`note-${note.id}`);
                                                        if (el) {
                                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            el.classList.add('ring-2', 'ring-blue-500');
                                                            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 2000);
                                                        }
                                                    }}
                                                    className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                    title="View"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {aboutRefs.length > 0 && (
                                        <div className="mb-3 pb-3 border-b border-gray-100">
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide min-w-[80px]">
                                                    References:
                                                </span>
                                                <div className="flex flex-wrap gap-2 flex-1">
                                                    {aboutRefs.map((ref: any, idx: number) => {
                                                        const displayText = typeof ref === 'string' ? ref : ref.display || ref.value || `${ref.type} #${ref.id}`;
                                                        const refType = typeof ref === 'string' ? null : (ref.type || '').toLowerCase().replace(/\s+/g, '');
                                                        const refId = typeof ref === 'string' ? null : ref.id;
                                                        const isClickable = !!(refId && refType);
                                                        return (
                                                            <button
                                                                key={idx}
                                                                onClick={() => isClickable && navigateToReference(ref)}
                                                                disabled={!isClickable}
                                                                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition-all ${isClickable ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer' : 'bg-gray-100 text-gray-700 border-gray-200 cursor-default'}`}
                                                                title={isClickable ? `View ${refType}` : 'Reference not available'}
                                                            >
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                </svg>
                                                                {displayText}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-2">
                                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-500 italic">
                        {(noteActionFilter || noteAuthorFilter) ? 'No notes match your filters.' : 'No notes have been added yet.'}
                    </p>
                )}
            </div>
        );
    };

    // Render history tab content
    const renderHistoryTab = () => (
        <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Task History</h2>

            {isLoadingHistory ? (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : historyError ? (
                <div className="text-red-500 py-2">{historyError}</div>
            ) : history.length > 0 ? (
                <>
                    <HistoryTabFilters
                        sortOrder={historyFilters.sortOrder}
                        onSortOrderChange={historyFilters.setSortOrder}
                        userFilter={historyFilters.userFilter}
                        onUserFilterChange={historyFilters.setUserFilter}
                        uniqueUsers={historyFilters.uniqueUsers}
                        disabled={isLoadingHistory}
                    />
                    <div className="space-y-4">
                        {historyFilters.filteredAndSorted.map((item) => {
                            // Format the history entry based on action type
                            let actionDisplay = '';
                            let detailsDisplay: React.ReactNode = '';

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
                                            const changes: React.ReactNode[] = [];

                                            // Helper function to format values
                                            const formatValue = (val: any): string => {
                                                if (val === null || val === undefined) return 'Empty';
                                                if (typeof val === 'object') return JSON.stringify(val);
                                                return String(val);
                                            };

                                            for (const key in details.after) {
                                                // Skip internal fields that might not be relevant to users
                                                if (key === 'updated_at') continue;

                                                const beforeVal = details.before[key];
                                                const afterVal = details.after[key];

                                                if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
                                                    // Special handling for custom_fields
                                                    if (key === 'custom_fields') {
                                                        let beforeObj = typeof beforeVal === 'string' ? JSON.parse(beforeVal) : beforeVal;
                                                        let afterObj = typeof afterVal === 'string' ? JSON.parse(afterVal) : afterVal;

                                                        // Handle case where custom_fields might be null/undefined
                                                        beforeObj = beforeObj || {};
                                                        afterObj = afterObj || {};

                                                        if (typeof beforeObj === 'object' && typeof afterObj === 'object') {
                                                            const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));

                                                            allKeys.forEach(cfKey => {
                                                                const beforeCfVal = beforeObj[cfKey];
                                                                const afterCfVal = afterObj[cfKey];

                                                                if (beforeCfVal !== afterCfVal) {
                                                                    changes.push(
                                                                        <div key={`cf-${cfKey}`} className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-sm">
                                                                            <span className="font-semibold text-gray-700 min-w-[120px]">{cfKey}:</span>
                                                                            <div className="flex flex-wrap gap-2 items-center">
                                                                                <span className="text-red-600 bg-red-50 px-1 rounded line-through decoration-red-400 opacity-80">
                                                                                    {formatValue(beforeCfVal)}
                                                                                </span>
                                                                                <span className="text-gray-400">→</span>
                                                                                <span className="text-green-700 bg-green-50 px-1 rounded font-medium">
                                                                                    {formatValue(afterCfVal)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                            });
                                                            continue; // Skip the standard field handling for custom_fields
                                                        }
                                                    }

                                                    // Standard fields
                                                    // const fieldName = key.replace(/_/g, ' ');
                                                    // changes.push(
                                                    //     <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-sm">
                                                    //         <span className="font-semibold text-gray-700 capitalize min-w-[120px]">{fieldName}:</span>
                                                    //         <div className="flex flex-wrap gap-2 items-center">
                                                    //             <span className="text-red-600 bg-red-50 px-1 rounded line-through decoration-red-400 opacity-80">
                                                    //                 {formatValue(beforeVal)}
                                                    //             </span>
                                                    //             <span className="text-gray-400">→</span>
                                                    //             <span className="text-green-700 bg-green-50 px-1 rounded font-medium">
                                                    //                 {formatValue(afterVal)}
                                                    //             </span>
                                                    //         </div>
                                                    //     </div>
                                                    // );
                                                }
                                            }

                                            if (changes.length > 0) {
                                                detailsDisplay = (
                                                    <div className="flex flex-col gap-2 mt-2 bg-gray-50 p-2 rounded border border-gray-100">
                                                        {changes}
                                                    </div>
                                                );
                                            } else {
                                                detailsDisplay = <span className="text-gray-500 italic">No visible changes detected</span>;
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
                </>
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

    const [columns, setColumns] = useState<{ left: string[]; right: string[] }>({
        left: ["taskOverview"],
        right: ["details", "recentNotes"],
    });
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isPinned, setIsPinned] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const measuringConfig = useMemo(
        () => ({
            droppable: {
                strategy: MeasuringStrategy.Always,
            },
        }),
        []
    );

    const panelDropAnimationConfig = useMemo(
        () => ({
            sideEffects: defaultDropAnimationSideEffects({
                styles: {
                    active: {
                        opacity: "0.5",
                    },
                },
            }),
        }),
        []
    );

    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = localStorage.getItem("taskSummaryColumns");
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (
                parsed &&
                Array.isArray(parsed.left) &&
                Array.isArray(parsed.right)
            ) {
                setColumns({ left: parsed.left, right: parsed.right });
            }
        } catch (e) {
            console.error("Error loading task panel order:", e);
        }
    }, []);

    // Initialize Task Details field order/visibility from localStorage (persists across all records)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = localStorage.getItem(TASK_DETAILS_STORAGE_KEY);
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const unique = Array.from(new Set(parsed));
                setVisibleFields((prev) => ({ ...prev, details: unique }));
            }
        } catch (_) {
            /* keep default */
        }
    }, []);

    // Initialize Task Overview field order/visibility from localStorage (persists across all records)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = localStorage.getItem(TASK_OVERVIEW_STORAGE_KEY);
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const unique = Array.from(new Set(parsed));
                setVisibleFields((prev) => ({ ...prev, taskOverview: unique }));
            }
        } catch (_) {
            /* keep default */
        }
    }, []);

    const prevColumnsRef = useRef<string>("");
    useEffect(() => {
        if (typeof window === "undefined") return;
        const colsString = JSON.stringify(columns);
        if (prevColumnsRef.current !== colsString) {
            localStorage.setItem("taskSummaryColumns", colsString);
            prevColumnsRef.current = colsString;
        }
    }, [columns]);

    const togglePin = () => {
        setIsPinned((p) => !p);
        if (isPinned === false) setIsCollapsed(false);
    };

    const handleTogglePinnedRecord = () => {
        if (!task) return;
        const key = buildPinnedKey("task", task.id);
        const label = task.title || `${formatRecordId(task.id, "task")}`;
        let url = `/dashboard/tasks/view?id=${task.id}`;
        if (activeTab && activeTab !== 'summary') url += `&tab=${activeTab}`;

        const res = togglePinnedRecord({ key, label, url });
        if (res.action === "limit") {
            toast.info("Maximum 10 pinned records reached");
        }
    };

    useEffect(() => {
        const syncPinned = () => {
            if (!task) return;
            const key = buildPinnedKey("task", task.id);
            setIsRecordPinned(isPinnedRecord(key));
        };

        syncPinned();
        window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
        return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    }, [task]);

    const findContainer = useCallback(
        (id: string) => {
            if (id in columns) {
                return id as keyof typeof columns;
            }
            return Object.keys(columns).find((key) =>
                columns[key as keyof typeof columns].includes(id)
            ) as keyof typeof columns | undefined;
        },
        [columns]
    );

    const handlePanelDragStart = useCallback((event: any) => {
        setActiveId(event.active.id);
    }, []);

    const handlePanelDragOver = useCallback(
        (event: DragOverEvent) => {
            const { active, over } = event;
            const overId = over?.id;

            if (!overId || active.id === overId) {
                return;
            }

            const activeContainer = findContainer(active.id as string);
            const overContainer = findContainer(overId as string);

            if (!activeContainer || !overContainer || activeContainer === overContainer) {
                return;
            }

            setColumns((prev) => {
                const activeItems = prev[activeContainer];
                const overItems = prev[overContainer];
                const overIndex = overItems.indexOf(overId as string);

                let newIndex;

                if (overId in prev) {
                    newIndex = overItems.length + 1;
                } else {
                    const isBelowOverItem =
                        over &&
                        active.rect.current.translated &&
                        active.rect.current.translated.top > over.rect.top + over.rect.height;

                    const modifier = isBelowOverItem ? 1 : 0;
                    newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
                }

                const activeFiltered = prev[activeContainer].filter((item) => item !== active.id);
                const overUpdated = [
                    ...prev[overContainer].slice(0, newIndex),
                    active.id as string,
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length),
                ];

                return {
                    ...prev,
                    [activeContainer]: activeFiltered,
                    [overContainer]: overUpdated,
                };
            });
        },
        [findContainer]
    );

    const handlePanelDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            const activePanelId = active.id as string;
            const overPanelId = over?.id as string;

            const activeContainer = findContainer(activePanelId);
            const overContainer = findContainer(overPanelId);

            if (!activeContainer || !overContainer || activeContainer !== overContainer) {
                setActiveId(null);
                return;
            }

            const activeIndex = columns[activeContainer].indexOf(activePanelId);
            const overIndex = columns[overContainer].indexOf(overPanelId);

            if (activeIndex !== overIndex) {
                setColumns((prev) => ({
                    ...prev,
                    [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
                }));
            }

            setActiveId(null);
        },
        [columns, findContainer]
    );

    const renderPanel = useCallback(
        (panelId: string, isOverlay = false) => {
            if (panelId === "taskOverview") {
                return (
                    <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
                        <PanelWithHeader title="Task Overview" onEdit={() => handleEditPanel("taskOverview")}
                        >
                            <div className="border-b border-gray-300 pb-3 mb-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold">{task.title}</h2>
                                    <div
                                        className={`text-xs px-2 py-1 rounded ${task.isCompleted
                                            ? "bg-green-100 text-green-800"
                                            : "bg-yellow-100 text-yellow-800"
                                            }`}
                                    >
                                        {task.isCompleted ? "Completed" : task.status}
                                    </div>
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                    Due: {task.dueDateTimeFormatted} • Priority: {task.priority}
                                </div>
                            </div>

                            <div className="mb-6">
                                <h3 className="font-bold text-lg mb-2">Description</h3>
                                <div className="whitespace-pre-line text-gray-700">{task.description}</div>
                            </div>

                            {Array.from(new Set(visibleFields.taskOverview || [])).length > 0 && (
                                <div className="mb-6">
                                    <h3 className="font-bold text-lg mb-2">Additional Information</h3>
                                    <div className="space-y-0 border border-gray-200 rounded">
                                        {Array.from(new Set(visibleFields.taskOverview || [])).map((k, index) => {
                                            const customFieldDefs = (availableFields || []).filter((f: any) => {
                                                const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
                                                return !isHidden;
                                            });
                                            const lookupType = (customFieldDefs.find((f: any) => (f.field_name || f.field_key || f.field_label || f.id) === k)?.lookup_type || customFieldDefs.find((f: any) => (f.field_name || f.field_key || f.field_label || f.id) === k)?.lookupType || "") as any;
                                            return (
                                                <div key={`taskOverview-${k}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
                                                    <div className="w-40 p-2 border-r border-gray-200 bg-gray-50 font-medium">
                                                        {getTaskFieldLabel(k)}:
                                                    </div>
                                                    <div className="flex-1 p-2">
                                                        {/* {getTaskFieldValue(k).toLowerCase().includes("@") ? (
                                                            <a href={`mailto:${getTaskFieldValue(k)}`} className="text-sm font-medium text-blue-600 hover:underline">
                                                                {getTaskFieldValue(k)}
                                                            </a>
                                                        ) : getTaskFieldValue(k).toLowerCase().startsWith("http") || getTaskFieldValue(k).toLowerCase().startsWith("https") ? (
                                                            <a href={getTaskFieldValue(k)} className="text-sm font-medium text-blue-600 hover:underline">
                                                                {getTaskFieldValue(k)}
                                                            </a>
                                                        ) : lookupType && getTaskFieldValue(k) ? (
                                                            <RecordNameResolver
                                                                id={String(getTaskFieldValue(k) || "") || null}
                                                                type={lookupType as any}
                                                                clickable
                                                                fallback={String(getTaskFieldValue(k) || "") || ""}
                                                            />
                                                        )
                                                            : /\(\d{3}\)\s\d{3}-\d{4}/.test(getTaskFieldValue(k) || "") ? (
                                                                <a href={`tel:${getTaskFieldValue(k).replace(/\D/g, "")}`} className="text-sm font-medium text-blue-600 hover:underline">
                                                                    {getTaskFieldValue(k)}
                                                                </a>
                                                            )
                                                                : getTaskFieldValue(k) ? (
                                                                    <div className="text-sm font-medium text-gray-900">{getTaskFieldValue(k)}</div>
                                                                ) : (
                                                                    <div className="text-sm font-medium text-gray-900">-</div>
                                                                )} */}
                                                        <FieldValueRenderer
                                                            value={getTaskFieldValue(k)}
                                                            fieldInfo={(() => {
                                                                const info = getTaskFieldInfo(k);
                                                                return info ? { key: info.key ?? k, label: info.label, fieldType: info.fieldType, lookupType: info.lookupType, multiSelectLookupType: info.multiSelectLookupType } : { key: k, label: getTaskFieldLabel(k) };
                                                            })() as any}
                                                            emptyPlaceholder="-"
                                                            clickable
                                                            stopPropagation
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {task.isCompleted && task.completedAt && (
                                <div className="mb-6">
                                    <h3 className="font-bold text-lg mb-2">Completion Details</h3>
                                    <div className="bg-green-50 p-3 rounded">
                                        <p>
                                            <span className="font-medium">Completed on:</span> {task.completedAt}
                                        </p>
                                        {task.completedBy && (
                                            <p>
                                                <span className="font-medium">Completed by:</span> {task.completedBy}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </PanelWithHeader>
                    </SortablePanel>
                );
            }

            if (panelId === "details") {
                return (
                    <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
                        <PanelWithHeader title="Details" onEdit={() => handleEditPanel("details")}>
                            <div className="space-y-0 border border-gray-200 rounded">
                                {Array.from(new Set(visibleFields.details || [])).map((k, index) => {
                                    return (
                                        <div key={`details-${k}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
                                            <div className="w-40 p-2 border-r border-gray-200 bg-gray-50 font-medium">
                                                {getTaskFieldLabel(k)}:
                                            </div>
                                            <div className="flex-1 p-2">
                                                <FieldValueRenderer
                                                    value={getTaskFieldValue(k)}
                                                    fieldInfo={(() => {
                                                        const info = getTaskFieldInfo(k);
                                                        return info ? { key: info.key ?? k, label: info.label, fieldType: info.fieldType, lookupType: info.lookupType, multiSelectLookupType: info.multiSelectLookupType } : { key: k, label: getTaskFieldLabel(k) };
                                                    })() as any}
                                                    emptyPlaceholder="-"
                                                    clickable
                                                    stopPropagation
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </PanelWithHeader>
                    </SortablePanel>
                );
            }

            if (panelId === "recentNotes") {
                return (
                    <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
                        <PanelWithHeader title="Recent Notes" onEdit={() => handleEditPanel("recentNotes")}>
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

                            {notes.length > 0 ? (
                                <div>
                                    {notes.slice(0, 2).map((note) => (
                                        <div key={note.id} className="mb-3 pb-3 border-b last:border-0">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium">{note.created_by_name || 'Unknown User'}</span>
                                                <span className="text-gray-500">{new Date(note.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-700">
                                                {note.text.length > 100
                                                    ? `${note.text.substring(0, 100)}...`
                                                    : note.text}
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
                                <div className="text-center text-gray-500 p-4">No notes have been added yet.</div>
                            )}
                        </PanelWithHeader>
                    </SortablePanel>
                );
            }

            return null;
        },
        [notes, setActiveTab, setShowAddNote, task, visibleFields, availableFields, headerFieldCatalog]
    );

    if (isLoading) {
        return <LoadingScreen message="Loading task details..." />;
    }

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
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
            <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
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
                    {task.archivedAt && (
                        <div className="ml-3">
                            <CountdownTimer archivedAt={task.archivedAt} />
                        </div>
                    )}
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
                            headerFields.map((fk) => {
                                const info = getHeaderFieldInfo(fk);
                                const fieldInfo = info
                                    ? { key: info.key, label: info.label, fieldType: info.fieldType, lookupType: info.lookupType, multiSelectLookupType: info.multiSelectLookupType }
                                    : { key: fk, label: getHeaderFieldLabel(fk) };
                                return (
                                    <div key={fk} className="min-w-[140px]">
                                        <div className="text-xs text-gray-500">
                                            {getHeaderFieldLabel(fk)}
                                        </div>
                                        <FieldValueRenderer
                                            value={getHeaderFieldValue(fk)}
                                            fieldInfo={fieldInfo}
                                            emptyPlaceholder="-"
                                            clickable
                                        />
                                    </div>
                                );
                            })
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
                            onClick={handleTogglePinnedRecord}
                            className={`p-1 hover:bg-gray-200 rounded ${isRecordPinned ? "text-yellow-600" : "text-gray-600"}`}
                            aria-label={isRecordPinned ? "Unpin" : "Pin"}
                            title={isRecordPinned ? "Unpin" : "Pin"}
                            disabled={!task}
                        >
                            <BsFillPinAngleFill size={18} />
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
                        className={`px-4 py-2 ${activeTab === tab.id
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
                {activeTab === "summary" && (
                    <div className="relative w-full">

                        {!isPinned && (
                            <div id="printable-summary" className="p-4">
                                <DndContext
                                    id="regular-summary-dnd"
                                    sensors={sensors}
                                    collisionDetection={closestCorners}
                                    measuring={measuringConfig}
                                    modifiers={[restrictToWindowEdges]}
                                    onDragStart={handlePanelDragStart}
                                    onDragOver={handlePanelDragOver}
                                    onDragEnd={handlePanelDragEnd}
                                >
                                    <div className="grid grid-cols-[1fr_1fr] gap-4">
                                        <div className="min-w-0">
                                            <DroppableContainer id="left" items={columns.left}>
                                                {columns.left.map((id) => renderPanel(id))}
                                            </DroppableContainer>
                                        </div>
                                        <div className="min-w-0">
                                            <DroppableContainer id="right" items={columns.right}>
                                                {columns.right.map((id) => renderPanel(id))}
                                            </DroppableContainer>
                                        </div>
                                    </div>
                                    <DragOverlay dropAnimation={panelDropAnimationConfig}>
                                        {activeId ? renderPanel(activeId, true) : null}
                                    </DragOverlay>
                                </DndContext>
                            </div>
                        )}
                    </div>
                )}

                {activeTab !== "summary" && (
                    <div className="p-4">
                        {activeTab === 'notes' && renderNotesTab()}
                        {activeTab === 'history' && renderHistoryTab()}
                        {activeTab === 'modify' && renderModifyTab()}
                    </div>
                )}
            </div>

            <AddTearsheetModal
                open={showAddTearsheetModal}
                onClose={() => setShowAddTearsheetModal(false)}
                entityType="task"
                entityId={taskId || ""}
            />

            {/* Add Note Modal - same layout and functionality as Hiring Manager (Action, About Reference, Email Notification) */}
            {showAddNote && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                                <Image src="/file.svg" alt="Note" width={20} height={20} />
                                <h2 className="text-lg font-semibold">Add Note</h2>
                            </div>
                            <button onClick={handleCloseAddNoteModal} className="p-1 rounded hover:bg-gray-200">
                                <span className="text-2xl font-bold">×</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {/* Note Text - Required */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Note Text {noteForm.text.length > 0 ? <span className="text-green-500">✓</span> : <span className="text-red-500">*</span>}
                                    </label>
                                    <textarea
                                        value={noteForm.text}
                                        autoFocus
                                        onChange={(e) => {
                                            setNoteForm(prev => ({ ...prev, text: e.target.value }));
                                            if (validationErrors.text) setValidationErrors(prev => ({ ...prev, text: undefined }));
                                        }}
                                        placeholder="Enter your note text here. Reference people and distribution lists using @ (e.g. @John Smith). Reference other records using # (e.g. #Project Manager)."
                                        className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${validationErrors.text ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                                        rows={6}
                                    />
                                    {validationErrors.text && <p className="mt-1 text-sm text-red-500">{validationErrors.text}</p>}
                                </div>

                                {/* Action - Required (Field500) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Action {noteForm.action ? <span className="text-green-500">✓</span> : <span className="text-red-500">*</span>}
                                    </label>
                                    {isLoadingActionFields ? (
                                        <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">Loading actions...</div>
                                    ) : (
                                        <select
                                            value={noteForm.action}
                                            onChange={(e) => {
                                                setNoteForm(prev => ({ ...prev, action: e.target.value }));
                                                if (validationErrors.action) setValidationErrors(prev => ({ ...prev, action: undefined }));
                                            }}
                                            className={`w-full p-2 border rounded focus:outline-none focus:ring-2 ${validationErrors.action ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                                        >
                                            <option value="">Select an action...</option>
                                            {actionFields.map((action) => (
                                                <option key={action.id} value={action.field_name || action.id}>{action.field_label || action.field_name || action.id}</option>
                                            ))}
                                        </select>
                                    )}
                                    {validationErrors.action && <p className="mt-1 text-sm text-red-500">{validationErrors.action}</p>}
                                </div>

                                {/* About / Reference - Required */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        About / Reference {(noteForm.aboutReferences && noteForm.aboutReferences.length > 0) ? <span className="text-green-500">✓</span> : <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="relative" ref={aboutInputRef}>
                                        <div className={`min-h-[42px] flex flex-wrap items-center gap-2 p-2 border rounded focus-within:ring-2 focus-within:outline-none pr-8 ${validationErrors.about ? "border-red-500 focus-within:ring-red-500" : "border-gray-300 focus-within:ring-blue-500"}`}>
                                            {(noteForm.aboutReferences || []).map((ref, index) => (
                                                <span key={`${ref.type}-${ref.id}-${index}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-sm">
                                                    <FiUserCheck className="w-4 h-4" />
                                                    {ref.display}
                                                    <button type="button" onClick={() => removeAboutReference(index)} className="hover:text-blue-600 font-bold leading-none" title="Remove">×</button>
                                                </span>
                                            ))}
                                            <input
                                                type="text"
                                                value={aboutSearchQuery}
                                                onChange={(e) => { setAboutSearchQuery(e.target.value); searchAboutReferences(e.target.value); setShowAboutDropdown(true); }}
                                                onFocus={() => { setShowAboutDropdown(true); if (!aboutSearchQuery.trim()) searchAboutReferences(""); }}
                                                placeholder={noteForm.aboutReferences.length === 0 ? "Search and select records (e.g., Job, Lead, Placement, Organization, Hiring Manager, Task)..." : "Add more..."}
                                                className="flex-1 min-w-[120px] border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"><FiSearch className="w-4 h-4" /></span>
                                        </div>
                                        {validationErrors.about && <p className="mt-1 text-sm text-red-500">{validationErrors.about}</p>}
                                        {showAboutDropdown && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                                                {isLoadingAboutSearch ? <div className="p-3 text-center text-gray-500 text-sm">Searching...</div> : aboutSuggestions.length > 0 ? (
                                                    aboutSuggestions.map((suggestion, idx) => (
                                                        <button key={`${suggestion.type}-${suggestion.id}-${idx}`} type="button" onClick={() => handleAboutReferenceSelect(suggestion)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2">
                                                            <FiUserCheck className="w-4 h-4 text-gray-500 shrink-0" />
                                                            <div className="flex-1">
                                                                <div className="text-sm font-medium text-gray-900">{suggestion.display}</div>
                                                                <div className="text-xs text-gray-500">{suggestion.type}</div>
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : aboutSearchQuery.trim().length > 0 ? <div className="p-3 text-center text-gray-500 text-sm">No results found</div> : <div className="p-3 text-center text-gray-500 text-sm">Type to search or select from list</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Email Notification */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Notification</label>
                                    <div className="relative" ref={emailInputRef}>
                                        {isLoadingUsers ? <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50 min-h-[42px]">Loading users...</div> : (
                                            <div className="min-h-[42px] flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded focus-within:ring-2 focus-within:outline-none focus-within:ring-blue-500 pr-8">
                                                {(noteForm.emailNotification || []).map((val, index) => (
                                                    <span key={val} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-sm">
                                                        <HiOutlineUser className="w-4 h-4 shrink-0" />
                                                        {val}
                                                        <button type="button" onClick={() => removeEmailNotification(val)} className="hover:text-blue-600 font-bold leading-none" title="Remove">×</button>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    value={emailSearchQuery}
                                                    onChange={(e) => { setEmailSearchQuery(e.target.value); setShowEmailDropdown(true); }}
                                                    onFocus={() => setShowEmailDropdown(true)}
                                                    placeholder={noteForm.emailNotification.length === 0 ? "Search and add users to notify..." : "Add more..."}
                                                    className="flex-1 min-w-[120px] border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"><FiSearch className="w-4 h-4" /></span>
                                            </div>
                                        )}
                                        {showEmailDropdown && !isLoadingUsers && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                                                {emailNotificationSuggestions.length > 0 ? emailNotificationSuggestions.map((user, idx) => (
                                                    <button key={user.id ?? idx} type="button" onClick={() => handleEmailNotificationSelect(user)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2">
                                                        <HiOutlineUser className="w-4 h-4 text-gray-500 shrink-0" />
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-gray-900">{user.name || user.email}</div>
                                                            {user.email && user.name && <div className="text-xs text-gray-500">{user.email}</div>}
                                                        </div>
                                                    </button>
                                                )) : <div className="p-3 text-center text-gray-500 text-sm">{emailSearchQuery.trim().length >= 1 ? "No matching users found" : "Type to search internal users"}</div>}
                                            </div>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">Only internal system users are available for notification</p>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                                <button onClick={handleCloseAddNoteModal} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 font-medium">CANCEL</button>
                                <button
                                    onClick={handleAddNote}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    disabled={!noteForm.text.trim() || !noteForm.action || (noteForm.aboutReferences || []).length === 0}
                                >
                                    SAVE
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Fields Modal */}
            {editingPanel && (
                <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-semibold">
                                Edit Fields - {editingPanel === "details" ? "Task Details" : editingPanel === "taskOverview" ? "Task Overview" : editingPanel}
                            </h2>
                            <button
                                onClick={handleCloseEditModal}
                                className="p-1 rounded hover:bg-gray-200"
                            >
                                <span className="text-2xl font-bold">×</span>
                            </button>
                        </div>

                        <div className="p-6">
                            {editingPanel === "details" && (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCorners}
                                    onDragStart={(e) => setDetailsDragActiveId(e.active.id as string)}
                                    onDragEnd={handleTaskDetailsDragEnd}
                                    onDragCancel={() => setDetailsDragActiveId(null)}
                                >
                                    <div className="mb-4">
                                        <h3 className="font-medium mb-3">Drag to reorder, check/uncheck to show/hide:</h3>
                                        <SortableContext
                                            items={modalDetailsOrder}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                                                {modalDetailsOrder.map((key, index) => {
                                                    const field = taskDetailsFieldCatalog.find((f) => f.key === key);
                                                    if (!field) return null;
                                                    return (
                                                        <SortableTaskDetailsFieldRow
                                                            key={`details-${key}-${index}`}
                                                            id={key}
                                                            label={field.label}
                                                            checked={modalDetailsVisible[key] || false}
                                                            onToggle={() =>
                                                                setModalDetailsVisible((prev) => ({
                                                                    ...prev,
                                                                    [key]: !prev[key],
                                                                }))
                                                            }
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </SortableContext>
                                        <DragOverlay>
                                            {detailsDragActiveId ? (
                                                (() => {
                                                    const field = taskDetailsFieldCatalog.find((f) => f.key === detailsDragActiveId);
                                                    return field ? (
                                                        <SortableTaskDetailsFieldRow
                                                            id={detailsDragActiveId}
                                                            label={field.label}
                                                            checked={modalDetailsVisible[detailsDragActiveId] || false}
                                                            onToggle={() => { }}
                                                            isOverlay
                                                        />
                                                    ) : null;
                                                })()
                                            ) : null}
                                        </DragOverlay>
                                    </div>
                                    <div className="flex justify-end space-x-2 pt-4 border-t">
                                        <button
                                            onClick={handleCloseEditModal}
                                            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveTaskDetailsFields}
                                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </DndContext>
                            )}
                            {editingPanel === "taskOverview" && (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCorners}
                                    onDragStart={(e) => setTaskOverviewDragActiveId(e.active.id as string)}
                                    onDragEnd={handleTaskOverviewDragEnd}
                                    onDragCancel={() => setTaskOverviewDragActiveId(null)}
                                >
                                    <div className="mb-4">
                                        <h3 className="font-medium mb-3">Drag to reorder, check/uncheck to show/hide:</h3>
                                        <SortableContext
                                            items={modalTaskOverviewOrder}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                                                {modalTaskOverviewOrder.map((key, index) => {
                                                    const field = taskOverviewFieldCatalog.find((f) => f.key === key);
                                                    if (!field) return null;
                                                    return (
                                                        <SortableTaskOverviewFieldRow
                                                            key={`taskOverview-${key}-${index}`}
                                                            id={key}
                                                            label={field.label}
                                                            checked={modalTaskOverviewVisible[key] || false}
                                                            onToggle={() =>
                                                                setModalTaskOverviewVisible((prev) => ({
                                                                    ...prev,
                                                                    [key]: !prev[key],
                                                                }))
                                                            }
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </SortableContext>
                                        <DragOverlay>
                                            {taskOverviewDragActiveId ? (
                                                (() => {
                                                    const field = taskOverviewFieldCatalog.find((f) => f.key === taskOverviewDragActiveId);
                                                    return field ? (
                                                        <SortableTaskOverviewFieldRow
                                                            id={taskOverviewDragActiveId}
                                                            label={field.label}
                                                            checked={modalTaskOverviewVisible[taskOverviewDragActiveId] || false}
                                                            onToggle={() => { }}
                                                            isOverlay
                                                        />
                                                    ) : null;
                                                })()
                                            ) : null}
                                        </DragOverlay>
                                    </div>
                                    <div className="flex justify-end space-x-2 pt-4 border-t">
                                        <button
                                            onClick={handleCloseEditModal}
                                            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveTaskOverviewFields}
                                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </DndContext>
                            )}
                            {editingPanel !== "details" && editingPanel !== "taskOverview" && (
                                <>
                                    <div className="mb-4">
                                        <h3 className="font-medium mb-3">Available Fields from Modify Page:</h3>
                                        <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                                            {isLoadingFields ? (
                                                <div className="text-center py-4 text-gray-500">Loading fields...</div>
                                            ) : (() => {
                                                const visibleAvailableFields = (availableFields || []).filter((field: any) => {
                                                    const isHidden =
                                                        field?.is_hidden === true ||
                                                        field?.hidden === true ||
                                                        field?.isHidden === true;
                                                    return !isHidden;
                                                });

                                                return visibleAvailableFields.length > 0 ? (
                                                    visibleAvailableFields.map((field: any) => {
                                                        const stableKey =
                                                            field.field_key || field.api_name || field.field_name || field.id;
                                                        const prefixedKey = `custom:${String(stableKey)}`;
                                                        const isVisible =
                                                            visibleFields[editingPanel]?.includes(prefixedKey) || false;

                                                        return (
                                                            <div
                                                                key={String(field.id || stableKey)}
                                                                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                                                            >
                                                                <div className="flex items-center space-x-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isVisible}
                                                                        onChange={() =>
                                                                            toggleFieldVisibility(editingPanel, prefixedKey)
                                                                        }
                                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                                    />
                                                                    <label className="text-sm text-gray-700">
                                                                        {field.field_label || field.field_name || String(stableKey)}
                                                                    </label>
                                                                </div>
                                                                <span className="text-xs text-gray-500">
                                                                    {field.field_type || "text"}
                                                                </span>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-center py-4 text-gray-500">
                                                        <p>No visible fields available</p>
                                                        <p className="text-xs mt-1">
                                                            Only non-hidden fields from the modify page will appear here
                                                        </p>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <h3 className="font-medium mb-3">Standard Fields:</h3>
                                        <div className="space-y-2 border border-gray-200 rounded p-3">
                                            {(() => {
                                                const standardFieldsMap: Record<string, Array<{ key: string; label: string }>> = {
                                                    recentNotes: [{ key: "notes", label: "Notes" }],
                                                };

                                                const fields = standardFieldsMap[editingPanel] || [];
                                                return fields.map((field) => {
                                                    const isVisible =
                                                        visibleFields[editingPanel]?.includes(field.key) || false;
                                                    return (
                                                        <div
                                                            key={field.key}
                                                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                                                        >
                                                            <div className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isVisible}
                                                                    onChange={() =>
                                                                        toggleFieldVisibility(editingPanel, field.key)
                                                                    }
                                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                                />
                                                                <label className="text-sm text-gray-700">{field.label}</label>
                                                            </div>
                                                            <span className="text-xs text-gray-500">standard</span>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>

                                    <div className="flex justify-end space-x-2 pt-4 border-t">
                                        <button
                                            onClick={handleCloseEditModal}
                                            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Header Fields Modal */}
            {showHeaderFieldModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Customize Header Fields</h2>
                            <button
                                onClick={() => setShowHeaderFieldModal(false)}
                                className="p-1 rounded hover:bg-gray-200"
                            >
                                <span className="text-2xl font-bold">×</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <DndContext
                                sensors={headerFieldsSensors}
                                collisionDetection={closestCorners}
                                onDragStart={(e) => setHeaderFieldsDragActiveId(e.active.id as string)}
                                onDragEnd={handleHeaderFieldsDragEnd}
                                onDragCancel={() => setHeaderFieldsDragActiveId(null)}
                                modifiers={[restrictToVerticalAxis]}
                            >
                                <p className="text-sm text-gray-600 mb-4">
                                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all task records.
                                </p>
                                <SortableContext
                                    items={headerFieldsOrder.length > 0 ? headerFieldsOrder : headerFieldCatalog.map((f) => f.key)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                                        {(headerFieldsOrder.length > 0 ? headerFieldsOrder : headerFieldCatalog.map((f) => f.key)).length === 0 ? (
                                            <div className="text-center py-4 text-gray-500">
                                                No fields available
                                            </div>
                                        ) : (
                                            (headerFieldsOrder.length > 0 ? headerFieldsOrder : headerFieldCatalog.map((f) => f.key)).map((key) => {
                                                const label = getHeaderFieldLabel(key);
                                                const checked = headerFields.includes(key);
                                                return (
                                                    <SortableHeaderFieldRow
                                                        key={key}
                                                        id={key}
                                                        label={label}
                                                        checked={checked}
                                                        onToggle={() => {
                                                            if (checked) {
                                                                setHeaderFields((prev) => prev.filter((x) => x !== key));
                                                            } else {
                                                                setHeaderFields((prev) => [...prev, key]);
                                                                // Add to order if not already there
                                                                if (!headerFieldsOrder.includes(key)) {
                                                                    setHeaderFieldsOrder((prev) => [...prev, key]);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                );
                                            })
                                        )}
                                    </div>
                                </SortableContext>
                                <DragOverlay dropAnimation={dropAnimationConfig}>
                                    {headerFieldsDragActiveId ? (
                                        <SortableHeaderFieldRow
                                            id={headerFieldsDragActiveId}
                                            label={getHeaderFieldLabel(headerFieldsDragActiveId)}
                                            checked={headerFields.includes(headerFieldsDragActiveId)}
                                            onToggle={() => {}}
                                            isOverlay
                                        />
                                    ) : null}
                                </DragOverlay>
                                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                                    <button
                                        onClick={() => {
                                            setHeaderFields(TASK_DEFAULT_HEADER_FIELDS);
                                            setHeaderFieldsOrder(TASK_DEFAULT_HEADER_FIELDS);
                                        }}
                                        className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const success = await saveHeaderConfig();
                                            if (success) {
                                                setShowHeaderFieldModal(false);
                                            }
                                        }}
                                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={headerFields.length === 0 || isSavingHeaderConfig}
                                    >
                                        {isSavingHeaderConfig ? "Saving..." : "Done"}
                                    </button>
                                </div>
                            </DndContext>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Request Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">Request Deletion</h2>
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteForm({ reason: "" });
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <span className="text-2xl font-bold">×</span>
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="p-6 space-y-6">
                            {/* Task Info */}
                            <div className="bg-gray-50 p-4 rounded">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Task to Delete
                                </label>
                                <p className="text-sm text-gray-900 font-medium">
                                    {task
                                        ? `${formatRecordId(task.id, "task")} ${task.title || "N/A"}`
                                        : "N/A"}
                                </p>
                            </div>

                            {/* Pending Request Warning */}
                            {pendingDeleteRequest && pendingDeleteRequest.status === "pending" && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Pending Request:</strong> A delete request is already pending payroll approval.
                                    </p>
                                </div>
                            )}

                            {/* Denied Request Info */}
                            {pendingDeleteRequest && pendingDeleteRequest.status === "denied" && (
                                <div className="bg-red-50 border border-red-200 rounded p-4">
                                    <p className="text-sm text-red-800">
                                        <strong>Previous Request Denied:</strong> {pendingDeleteRequest.denial_reason || "No reason provided"}
                                    </p>
                                </div>
                            )}

                            {/* Reason Field - Required */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <span className="text-red-500 mr-1">•</span>
                                    Reason for Deletion
                                </label>
                                <textarea
                                    value={deleteForm.reason}
                                    onChange={(e) =>
                                        setDeleteForm((prev) => ({
                                            ...prev,
                                            reason: e.target.value,
                                        }))
                                    }
                                    placeholder="Please provide a detailed reason for deleting this task..."
                                    className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                                        !deleteForm.reason.trim()
                                            ? "border-red-300 focus:ring-red-500"
                                            : "border-gray-300 focus:ring-blue-500"
                                    }`}
                                    rows={5}
                                    required
                                />
                                {!deleteForm.reason.trim() && (
                                    <p className="mt-1 text-sm text-red-500">
                                        Reason is required
                                    </p>
                                )}
                            </div>

                            {/* Info Box */}
                            <div className="bg-blue-50 border border-blue-200 rounded p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Note:</strong> This will create a delete request. Payroll will be notified via email and must approve or deny the deletion. The record will be archived (not deleted) until payroll approval.
                                </p>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteForm({ reason: "" });
                                }}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSubmittingDelete}
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleDeleteRequestSubmit}
                                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                                disabled={
                                    isSubmittingDelete ||
                                    !deleteForm.reason.trim() ||
                                    (pendingDeleteRequest && pendingDeleteRequest.status === "pending")
                                }
                            >
                                {isSubmittingDelete ? "SUBMITTING..." : "SUBMIT DELETE REQUEST"}
                                {!isSubmittingDelete && (
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
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}