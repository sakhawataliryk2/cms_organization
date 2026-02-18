'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';
import PanelWithHeader from '@/components/PanelWithHeader';
import { FiUserCheck, FiSearch } from 'react-icons/fi';
import { HiOutlineUser } from 'react-icons/hi';
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { sendCalendarInvite, type CalendarEvent } from "@/lib/office365";
import RecordNameResolver from '@/components/RecordNameResolver';
import FieldValueRenderer from '@/components/FieldValueRenderer';
import RequestActionModal from '@/components/RequestActionModal';
// Drag and drop imports
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
import { BsFillPinAngleFill } from "react-icons/bs";
import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";
import DocumentViewer from "@/components/DocumentViewer";
import HistoryTabFilters, { useHistoryFilters } from "@/components/HistoryTabFilters";
import ConfirmFileDetailsModal from "@/components/ConfirmFileDetailsModal";
import { toast } from "sonner";
import AddTearsheetModal from "@/components/AddTearsheetModal";
import CountdownTimer from '@/components/CountdownTimer';
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";

// Default header fields for Hiring Managers module - defined outside component to ensure stable reference
const HIRING_MANAGER_DEFAULT_HEADER_FIELDS = ["phone", "email"];

// Storage keys for Hiring Manager Details and Organization Details – field lists come from admin (custom field definitions)
const HM_DETAILS_STORAGE_KEY = "hiringManagerDetailsFields";
const HM_ORGANIZATION_DETAILS_STORAGE_KEY = "hiringManagerOrganizationDetailsFields";

// Droppable Column Container
function DroppableContainer({ id, children, items }: { id: string, children: React.ReactNode, items: string[] }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="flex flex-col gap-4 w-full min-h-[100px]">
        {children}
      </div>
    </SortableContext>
  );
}

// SortablePanel helper
function SortablePanel({ id, children, isOverlay = false }: { id: string; children: React.ReactNode; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
    zIndex: isOverlay ? 1000 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative group ${isOverlay ? 'cursor-grabbing' : ''}`}>
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
      <div className={`${isDragging && !isOverlay ? 'invisible' : ''} pt-0`}>
        {children}
      </div>
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

const HM_VIEW_TAB_IDS = ["summary", "modify", "history", "notes", "docs", "active-applicants", "opportunities", "quotes", "invoices"];

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

export default function HiringManagerView() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const hiringManagerId = searchParams.get("id");
  const tabFromUrl = searchParams.get("tab");
  const deleteFromUrl = searchParams.get("delete");

  const [activeTab, setActiveTabState] = useState(() =>
    tabFromUrl && HM_VIEW_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "summary"
  );

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "summary") params.delete("tab");
    else params.set("tab", tabId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (tabFromUrl && HM_VIEW_TAB_IDS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    } else if (!tabFromUrl && activeTab !== "summary") {
      setActiveTabState("summary");
    }
  }, [tabFromUrl]);


  // Hiring manager data
  const [hiringManager, setHiringManager] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes and history
  const [notes, setNotes] = useState<Array<any>>([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const historyFilters = useHistoryFilters(history);
  const [showAddNote, setShowAddNote] = useState(false);

  // Note sorting & filtering state (match Organization Notes design)
  const [noteActionFilter, setNoteActionFilter] = useState<string>("");
  const [noteAuthorFilter, setNoteAuthorFilter] = useState<string>("");
  const [noteSortKey, setNoteSortKey] = useState<"date" | "action" | "author">("date");
  const [noteSortDir, setNoteSortDir] = useState<"asc" | "desc">("desc");

  const sortedFilteredNotes = useMemo(() => {
    let out = [...notes];
    if (noteActionFilter) {
      out = out.filter((n) => (n.action || "") === noteActionFilter);
    }
    if (noteAuthorFilter) {
      out = out.filter(
        (n) => (n.created_by_name || "Unknown User") === noteAuthorFilter
      );
    }
    out.sort((a, b) => {
      let av: any, bv: any;
      switch (noteSortKey) {
        case "action":
          av = a.action || "";
          bv = b.action || "";
          break;
        case "author":
          av = a.created_by_name || "";
          bv = b.created_by_name || "";
          break;
        default:
          av = new Date(a.created_at).getTime();
          bv = new Date(b.created_at).getTime();
          break;
      }
      if (typeof av === "number" && typeof bv === "number") {
        return noteSortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return noteSortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [notes, noteActionFilter, noteAuthorFilter, noteSortKey, noteSortDir]);

  // Documents state
  const [documents, setDocuments] = useState<Array<any>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newDocumentType, setNewDocumentType] = useState("General");
  const [newDocumentContent, setNewDocumentContent] = useState("");
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileDetailsName, setFileDetailsName] = useState("");
  const [fileDetailsType, setFileDetailsType] = useState("General");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [noteForm, setNoteForm] = useState<NoteFormState>({
    text: "",
    action: "",
    about: hiringManager ? `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}` : "",
    aboutReferences: hiringManager
      ? [
        {
          id: hiringManager.id,
          type: "Hiring Manager",
          display: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`,
          value: formatRecordId(hiringManager.id, "hiringManager"),
        },
      ]
      : [],
    copyNote: "No",
    replaceGeneralContactComments: false,
    additionalReferences: [],
    scheduleNextAction: "None",
    emailNotification: [],
  });

  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Action fields state (Field_500 for hiring managers)
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

  useEffect(() => {
    const fetchActionFields = async () => {
      setIsLoadingActionFields(true);
      try {
        const token = document.cookie
          .split('; ')
          .find((r) => r.startsWith('token='))?.split('=')[1];

        const response = await fetch('/api/admin/field-management/hiring-managers', {
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
            data.hiringManagerFields ||
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

    fetchActionFields();
  }, []);

  // Validation state
  const [noteFormErrors, setNoteFormErrors] = useState<{
    text?: string;
    action?: string;
    about?: string;
  }>({});

  // Reference search state for About field
  const [aboutSearchQuery, setAboutSearchQuery] = useState("");
  const [aboutSuggestions, setAboutSuggestions] = useState<any[]>([]);
  const [showAboutDropdown, setShowAboutDropdown] = useState(false);
  const [isLoadingAboutSearch, setIsLoadingAboutSearch] = useState(false);
  const aboutInputRef = useRef<HTMLInputElement>(null);

  // Email notification search state (search-and-add like About/Reference)
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Reference search state for Additional References
  const [additionalRefSearchQuery, setAdditionalRefSearchQuery] = useState("");
  const [additionalRefSuggestions, setAdditionalRefSuggestions] = useState<any[]>([]);
  const [showAdditionalRefDropdown, setShowAdditionalRefDropdown] = useState(false);
  const [isLoadingAdditionalRefSearch, setIsLoadingAdditionalRefSearch] = useState(false);
  const additionalRefInputRef = useRef<HTMLInputElement>(null);

  // Summary counts state
  const [summaryCounts, setSummaryCounts] = useState({
    jobs: 0,
    appsUnderReview: 0,
    interviews: 0,
    placements: 0,
  });
  const [isLoadingSummaryCounts, setIsLoadingSummaryCounts] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Field management – panels driven from admin field definitions only
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  // Organization details: field definitions from admin (organizations entity) and fetched org record
  const [organizationAvailableFields, setOrganizationAvailableFields] = useState<any[]>([]);
  const [fetchedOrganization, setFetchedOrganization] = useState<any>(null);
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") {
      return { details: [], organizationDetails: [], recentNotes: ["notes"] };
    }
    const detailsSaved = localStorage.getItem(HM_DETAILS_STORAGE_KEY);
    const orgDetailsSaved = localStorage.getItem(HM_ORGANIZATION_DETAILS_STORAGE_KEY);
    let details: string[] = [];
    let organizationDetails: string[] = [];
    if (detailsSaved) {
      try {
        const parsed = JSON.parse(detailsSaved);
        if (Array.isArray(parsed) && parsed.length > 0) details = Array.from(new Set(parsed));
      } catch (_) { }
    }
    if (orgDetailsSaved) {
      try {
        const parsed = JSON.parse(orgDetailsSaved);
        if (Array.isArray(parsed) && parsed.length > 0) organizationDetails = Array.from(new Set(parsed));
      } catch (_) { }
    }
    return { details, organizationDetails, recentNotes: ["notes"] };
  });

  // ===== Summary layout state =====
  // ===== Summary layout state =====
  // ===== Summary layout state =====
  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["details"],
    right: ["organizationDetails", "recentNotes", "openTasks"],
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // High-performance sensors configuration
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

  const measuringConfig = useMemo(() => ({
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  }), []);

  // Initialize columns from localStorage or default
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hiringManagerSummaryColumns");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.left && Array.isArray(parsed.left) && parsed.right && Array.isArray(parsed.right)) {
            setColumns(parsed);
          }
        } catch (e) {
          console.error("Error loading panel order:", e);
        }
      }
    }
  }, []);

  // Initialize Hiring Manager Details field order/visibility from localStorage (persists across all records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(HM_DETAILS_STORAGE_KEY);
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

  // Initialize Hiring Manager Organization Details field order/visibility from localStorage (persists across all records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(HM_ORGANIZATION_DETAILS_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const unique = Array.from(new Set(parsed));
        setVisibleFields((prev) => ({ ...prev, organizationDetails: unique }));
      }
    } catch (_) {
      /* keep default */
    }
  }, []);

  const prevColumnsRef = useRef<string>("");

  // Save columns to localStorage
  useEffect(() => {
    const colsString = JSON.stringify(columns);
    if (prevColumnsRef.current !== colsString) {
      localStorage.setItem("hiringManagerSummaryColumns", colsString);
      prevColumnsRef.current = colsString;
    }
  }, [columns]);

  const findContainer = useCallback((id: string) => {
    if (id === "left" || id === "right") {
      return id;
    }

    if (columns.left.includes(id)) return "left";
    if (columns.right.includes(id)) return "right";

    return undefined;
  }, [columns]);

  const handlePanelDragStart = useCallback((event: any) => {
    setActiveId(event.active.id);
  }, []);

  const handlePanelDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handlePanelDragOver = useCallback((_event: DragOverEvent) => {
    return;
  }, []);

  const handlePanelDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    setColumns((prev) => {
      const findContainerInState = (id: string) => {
        if (id === "left" || id === "right") return id as "left" | "right";
        if (prev.left.includes(id)) return "left";
        if (prev.right.includes(id)) return "right";
        return undefined;
      };

      const source = findContainerInState(activeId);
      const target = findContainerInState(overId);

      if (!source || !target) return prev;

      if (source === target) {
        if (overId === source) return prev;
        const oldIndex = prev[source].indexOf(activeId);
        const newIndex = prev[source].indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        return {
          ...prev,
          [source]: arrayMove(prev[source], oldIndex, newIndex),
        };
      }

      const sourceItems = prev[source].filter((id) => id !== activeId);
      const targetItems = [activeId, ...prev[target].filter((id) => id !== activeId)];

      return {
        ...prev,
        [source]: sourceItems,
        [target]: targetItems,
      };
    });

    setActiveId(null);
  }, []);

  const togglePin = () => {
    setIsPinned((p) => !p);
    if (isPinned === false) setIsCollapsed(false);
  };

  const handleTogglePinnedRecord = () => {
    if (!hiringManager) return;
    const key = buildPinnedKey("hiringManager", hiringManager.id);
    const label =
      hiringManager.fullName ||
      hiringManager.name ||
      `${formatRecordId(hiringManager.id, "hiringManager")}`;
    let url = `/dashboard/hiring-managers/view?id=${hiringManager.id}`;
    if (activeTab && activeTab !== "summary") url += `&tab=${activeTab}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      toast.info("Maximum 10 pinned records reached");
    }
  };

  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    setTasksError(null);
    try {
      const response = await fetch(`/api/tasks`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch tasks");
      }
      const tasksData = await response.json();
      const hiringManagerTasks = (tasksData.tasks || []).filter((task: any) => {
        // Exclude completed tasks
        if (task.is_completed === true || task.status === "Completed") {
          return false;
        }

        const taskHiringManagerId = task.hiring_manager_id ? parseInt(task.hiring_manager_id) : null;

        return (
          (taskHiringManagerId && taskHiringManagerId === hiringManager?.id)
        );
      });
      setTasks(hiringManagerTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasksError(err instanceof Error ? err.message : "An error occurred while fetching tasks");
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (!hiringManager?.id) return;
    fetchTasks();
  }, [hiringManager?.id]);


  useEffect(() => {
    const syncPinned = () => {
      if (!hiringManager) return;
      const key = buildPinnedKey("hiringManager", hiringManager.id);
      setIsRecordPinned(isPinnedRecord(key));
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [hiringManager]);

  // Hiring Manager Details field catalog: from admin field definitions + record customFields only (no hardcoded standard)
  const detailsFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    return [...fromApi];
  }, [availableFields]);

  // Status field options from admin field definitions (same as organization summary)
  const statusFieldOptions = useMemo((): string[] => {
    const statusField = (availableFields || []).find(
      (f: any) =>
        (f.field_label || "").toLowerCase() === "status" ||
        (f.field_name || "").toLowerCase() === "status"
    );
    if (!statusField || !statusField.options) {
      return ["Active", "Inactive", "Archived", "On Hold"];
    }
    let options = statusField.options;
    if (typeof options === "string") {
      try {
        options = JSON.parse(options);
      } catch {
        return options
          .split(/\r?\n/)
          .map((opt: string) => opt.trim())
          .filter((opt: string) => opt.length > 0);
      }
    }
    if (Array.isArray(options)) {
      return options
        .filter((opt: any): opt is string => typeof opt === "string" && opt.trim().length > 0)
        .map((opt: string) => opt.trim());
    }
    if (typeof options === "object" && options !== null) {
      const values = Object.values(options) as unknown[];
      return values
        .filter((opt): opt is string => typeof opt === "string" && opt.trim().length > 0)
        .map((opt: string) => opt.trim());
    }
    return ["Active", "Inactive", "Archived", "On Hold"];
  }, [availableFields]);

  // Organization Details field catalog: from admin field definitions for organizations + fetched org custom_fields (same as organizations view)
  const organizationDetailsFieldCatalog = useMemo(() => {
    const fromApi = (organizationAvailableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_key ?? f.field_name ?? f.api_name ?? f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    return [...fromApi];
  }, [organizationAvailableFields]);

  // Basic renderPanel (placeholder content for now)
  // Render individual panels
  const renderDetailsPanel = () => {
    if (!hiringManager) return null;
    const customObj = hiringManager.customFields || {};
    const customFieldDefs = (availableFields || []).filter((f: any) => {
      const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
      return !isHidden;
    });

    const getDetailsLabel = (key: string) =>
      detailsFieldCatalog.find((f) => f.key === key)?.label ||
      customFieldDefs.find((f: any) => String(f.field_name || f.field_key || f.api_name || f.id) === key)?.field_label ||
      key;
    const isStatusField = (key: string) => {
      const k = (key || "").toLowerCase();
      const label = (getDetailsLabel(key) || "").toLowerCase();
      return k === "status" || label === "status";
    };

    const getDetailsValue = (key: string): string => {
      if (isStatusField(key)) {
        const statusVal = (hiringManager as any).status ?? customObj["Status"] ?? customObj["status"];
        const str = statusVal !== undefined && statusVal !== null && String(statusVal).trim() !== "" ? String(statusVal).trim() : "Active";
        return statusFieldOptions.includes(str) ? str : (statusFieldOptions[0] || "Active");
      }
      const fieldDef = customFieldDefs.find((f: any) => String(f.field_name || f.field_key || f.api_name || f.id) === key);
      const fieldLabel = fieldDef?.field_label || fieldDef?.field_name || key;
      const v = customObj[fieldLabel] ?? customObj[key];
      return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
    };



    const detailsKeys = Array.from(new Set(visibleFields.details || []));
    const effectiveRows: { key: string; label: string; isStatus?: boolean }[] = [];
    let statusRowAdded = false;
    for (const key of detailsKeys) {
      if (isStatusField(key)) statusRowAdded = true;
      effectiveRows.push({
        key,
        label: getDetailsLabel(key),
        isStatus: isStatusField(key),
      });
    }
    if (!statusRowAdded) {
      const statusFieldFromCatalog = detailsFieldCatalog.find(
        (f) => f.label?.toLowerCase() === "status" || f.key?.toLowerCase() === "status"
      );
      const statusKey = statusFieldFromCatalog?.key || "status";
      effectiveRows.push({ key: statusKey, label: "Status", isStatus: true });
    }

    const renderDetailsRow = (row: { key: string; label: string; isStatus?: boolean }) => {
      const value = getDetailsValue(row.key);
      const def = customFieldDefs.find((f: any) => (f.field_name || f.field_key || f.field_label || f.id) === row.key);
      const fieldInfo = {
        key: row.key,
        label: row.label,
        fieldType: def?.field_type ?? def?.fieldType,
        lookupType: def?.lookup_type ?? def?.lookupType,
        multiSelectLookupType: def?.multi_select_lookup_type ?? def?.multiSelectLookupType,
      };
      return (
        <div key={row.key} className="flex border-b border-gray-200 last:border-b-0">
          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{row.label}:</div>
          <div className="flex-1 p-2 text-sm">
            {row.isStatus ? (
              <select
                value={value && statusFieldOptions.includes(value) ? value : (statusFieldOptions[0] || "")}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={isSavingStatus}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {statusFieldOptions.length === 0 ? (
                  <option value="">Loading...</option>
                ) : (
                  statusFieldOptions.map((option: string) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <FieldValueRenderer
                value={value}
                fieldInfo={fieldInfo}
                emptyPlaceholder="-"
                clickable
              />
            )}
          </div>
        </div>
      );
    };

    return (
      <PanelWithHeader title="Details" onEdit={() => handleEditPanel("details")}>
        <div className="space-y-0 border border-gray-200 rounded">
          {effectiveRows.map((row) => renderDetailsRow(row))}
        </div>
      </PanelWithHeader>
    );
  };

  const getOrganizationDetailLabel = (key: string): string => {
    const entry = organizationDetailsFieldCatalog.find((f) => f.key === key);
    return entry?.label ?? key;
  };

  const renderOrganizationPanel = () => {
    if (!hiringManager?.organization) return null;

    // Resolve value from fetched organization (same structure as organizations view)
    const getOrganizationDetailValue = (key: string): string => {
      if (!fetchedOrganization) return "-";
      const o = fetchedOrganization as any;
      // Standard backend columns (snake_case from API or camelCase)
      const standard: Record<string, string> = {
        name: o.name ?? o.Name ?? "",
        website: o.website ?? o.Website ?? "",
        contact_phone: o.contact_phone ?? o.contactPhone ?? o.phone ?? "",
        address: o.address ?? o.Address ?? "",
        overview: o.overview ?? o.Overview ?? o.about ?? "",
        status: o.status ?? o.Status ?? "",
        nicknames: o.nicknames ?? o.Nicknames ?? "",
        parent_organization: o.parent_organization ?? o.parentOrganization ?? "",
        contract_on_file: o.contract_on_file ?? o.contractOnFile ?? "",
        date_contract_signed: o.date_contract_signed ?? o.dateContractSigned ?? "",
        year_founded: o.year_founded ?? o.yearFounded ?? "",
        perm_fee: o.perm_fee ?? o.permFee ?? "",
        num_employees: o.num_employees != null ? String(o.num_employees) : o.numEmployees != null ? String(o.numEmployees) : "",
        num_offices: o.num_offices != null ? String(o.num_offices) : o.numOffices != null ? String(o.numOffices) : "",
      };
      if (standard[key] !== undefined && standard[key] !== null && String(standard[key]).trim() !== "") {
        return String(standard[key]);
      }
      const direct = o[key] ?? o[key?.replace(/(_\w)/g, (m: string) => m[1].toUpperCase())];
      if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct);
      // From custom_fields by label (catalog key may be field_name/field_key – resolve to label)
      const fieldDef = (organizationAvailableFields || []).find(
        (f: any) => String(f.field_key ?? f.field_name ?? f.api_name ?? f.id) === key
      );
      const label = fieldDef?.field_label ?? fieldDef?.field_name ?? key;
      const customVal = o.customFields?.[getOrganizationDetailLabel(label)] ?? o.customFields?.[key];
      if (customVal !== undefined && customVal !== null) return String(customVal);
      return "-";
    };

    const orgDetailsKeys = Array.from(new Set(visibleFields.organizationDetails || []));
    const effectiveRows: { key: string; label: string }[] = [];
    for (const key of orgDetailsKeys) {
      effectiveRows.push({ key, label: getOrganizationDetailLabel(key) });
    }

    const renderOrganizationDetailsRow = (row: { key: string; label: string }) => {
      const customFieldDefs = (organizationAvailableFields || []).filter((f: any) => {
        const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
        return !isHidden;
      });
      const value = getOrganizationDetailValue(row.key);
      const def = customFieldDefs.find((f: any) => (f.field_name || f.field_key || f.field_label || f.id) === row.key);
      const fieldInfo = {
        key: row.key,
        label: row.label,
        fieldType: def?.field_type ?? def?.fieldType,
        lookupType: def?.lookup_type ?? def?.lookupType,
        multiSelectLookupType: def?.multi_select_lookup_type ?? def?.multiSelectLookupType,
      };
      return (
        <div key={row.key} className="flex border-b border-gray-200 last:border-b-0">
          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{row.label}:</div>
          <div className="flex-1 p-2 text-sm">
            <FieldValueRenderer
              value={value}
              fieldInfo={fieldInfo}
              emptyPlaceholder="-"
              clickable
            />
          </div>
        </div>
      );
    };

    return (
      <PanelWithHeader title="Organization Details" onEdit={() => handleEditPanel("organizationDetails")}>
        <div className="space-y-0 border border-gray-200 rounded">
          {isLoadingOrganization ? (
            <div className="p-4 text-gray-500 text-sm">Loading organization details...</div>
          ) : (
            effectiveRows.map((row) => renderOrganizationDetailsRow(row))
          )}
        </div>
      </PanelWithHeader>
    );
  };

  const renderRecentNotesPanel = () => {
    return (
      <PanelWithHeader title="Recent Notes" onEdit={() => handleEditPanel("recentNotes")}>
        <div className="border border-gray-200 rounded">
          {notes.length > 0 ? (
            <div className="p-2">
              <div className="flex justify-end mb-2">
                <button onClick={() => setShowAddNote(true)} className="text-sm text-blue-600 hover:underline">Add Note</button>
              </div>
              {notes.slice(0, 5).map((note) => (
                <div key={note.id} className="mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{note.created_by_name || "Unknown User"}</span>
                    <span className="text-gray-500">{new Date(note.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-700">{note.text.length > 100 ? `${note.text.substring(0, 100)}...` : note.text}</p>
                </div>
              ))}
              {notes.length > 5 && (
                <button onClick={() => setActiveTab("notes")} className="text-blue-500 text-sm hover:underline mt-1">View all {notes.length} notes</button>
              )}
            </div>
          ) : (
            <div className="p-2">
              <div className="flex justify-end mb-2">
                <button onClick={() => setShowAddNote(true)} className="text-sm text-blue-600 hover:underline">Add Note</button>
              </div>
              <p className="text-gray-500 italic text-center">No recent notes</p>
            </div>
          )}
        </div>
      </PanelWithHeader>
    );
  };

  const renderPanel = useCallback((panelId: string, isOverlay = false) => {
    if (panelId === "details") {
      return (
        <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
          {renderDetailsPanel()}
        </SortablePanel>
      );
    }
    if (panelId === "organizationDetails") {
      return (
        <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
          {renderOrganizationPanel()}
        </SortablePanel>
      );
    }
    if (panelId === "recentNotes") {
      return (
        <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
          {renderRecentNotesPanel()}
        </SortablePanel>
      );
    }
    if (panelId === "openTasks") {
      return (
        <SortablePanel key={panelId} id={panelId}>
          <PanelWithHeader title="Open Tasks:">
            <div className="border border-gray-200 rounded">
              {isLoadingTasks ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : tasksError ? (
                <div className="p-2 text-red-500 text-sm">{tasksError}</div>
              ) : tasks.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/tasks/view?id=${task.id}`)
                      }
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-medium text-blue-600 hover:underline">
                          {task.title}
                        </h4>
                        {task.priority && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${task.priority === "High"
                              ? "bg-red-100 text-red-800"
                              : task.priority === "Medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <div className="flex space-x-3">
                          {task.due_date && (
                            <span>
                              Due:{" "}
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {task.assigned_to_name && (
                            <span>
                              Assigned to: {task.assigned_to_name}
                            </span>
                          )}
                        </div>
                        {task.status && (
                          <span className="text-gray-600">{task.status}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 italic">
                  No open tasks
                </div>
              )}
            </div>
          </PanelWithHeader>
        </SortablePanel>
      );
    }
    return null;
  }, [hiringManager, visibleFields, notes, availableFields, organizationDetailsFieldCatalog, fetchedOrganization, isLoadingOrganization, organizationAvailableFields]);

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
    entityType: "HIRING_MANAGER",
    configType: "header",
    defaultFields: HIRING_MANAGER_DEFAULT_HEADER_FIELDS,
  });

  // Drop animation config for drag overlay (used by main content DnD)
  const dropAnimationConfig = useMemo(() => ({
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  }), []);

  // Maintain order for all header fields (including unselected ones for proper ordering)
  const [headerFieldsOrder, setHeaderFieldsOrder] = useState<string[]>([]);

  const buildHeaderFieldCatalog = () => {
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
  };

  const headerFieldCatalog = buildHeaderFieldCatalog();

  const getHeaderFieldLabel = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found?.label || key;
  };

  const getHeaderFieldInfo = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found as { key: string; label: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
  };

  const getHeaderFieldValue = (key: string) => {
    if (!hiringManager) return "-";
    const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;

    // Helper to get value from custom fields by key or label
    const getCustomValue = (k: string) => {
      // 1. Try direct key lookup
      if (hiringManager.customFields?.[k] !== undefined && hiringManager.customFields?.[k] !== null && String(hiringManager.customFields?.[k]).trim() !== "") {
        return String(hiringManager.customFields?.[k]);
      }

      // 2. Try lookup by label/field_name from availableFields
      const fieldDef = (availableFields || []).find((f: any) =>
        (f.field_key || f.api_name || f.field_name || f.id) === k
      );

      if (fieldDef) {
        // Try field_label
        if (fieldDef.field_label) {
          const val = hiringManager.customFields?.[fieldDef.field_label];
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            return String(val);
          }
        }
        // Try field_name
        if (fieldDef.field_name) {
          const val = hiringManager.customFields?.[fieldDef.field_name];
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            return String(val);
          }
        }
      }

      return null;
    };

    // Check customFields first if it's explicitly a custom key
    if (key.startsWith("custom:")) {
      const val = getCustomValue(rawKey);
      return val === null ? "-" : val;
    }

    // Special case for organization object
    if (rawKey === "organization" || rawKey === "organizationName") {
      return hiringManager.organization?.name || "-";
    }

    // Try standard field on the object itself
    const std = (hiringManager as any)[rawKey];
    if (std !== undefined && std !== null && String(std).trim() !== "") {
      return String(std);
    }

    // Fallback to customFields without prefix (for fields in details panel without custom: prefix)
    const custom = getCustomValue(rawKey);
    if (custom !== null) {
      return custom;
    }

    return "-";
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


  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Modal-local state for Hiring Manager Details edit
  const [modalDetailsOrder, setModalDetailsOrder] = useState<string[]>([]);
  const [modalDetailsVisible, setModalDetailsVisible] = useState<Record<string, boolean>>({});

  // Modal-local state for Hiring Manager Organization Details edit
  const [modalOrganizationDetailsOrder, setModalOrganizationDetailsOrder] = useState<string[]>([]);
  const [modalOrganizationDetailsVisible, setModalOrganizationDetailsVisible] = useState<Record<string, boolean>>({});

  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);

  // Transfer modal state (target = another Hiring Manager; notes, docs, tasks, jobs move to target; source HM archived)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    targetHiringManagerId: "", // Hiring Manager to transfer data to
  });
  const [transferSearchQuery, setTransferSearchQuery] = useState("");
  const [showTransferDropdown, setShowTransferDropdown] = useState(false);
  const transferSearchRef = useRef<HTMLDivElement>(null);
  const [availableHiringManagersForTransfer, setAvailableHiringManagersForTransfer] = useState<any[]>([]);
  const [isLoadingTransferTargets, setIsLoadingTransferTargets] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Click outside to close transfer search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (transferSearchRef.current && !transferSearchRef.current.contains(event.target as Node)) {
        setShowTransferDropdown(false);
      }
    };

    if (showTransferDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTransferDropdown]);

  useEffect(() => {
    if (showTransferModal) {
      fetchAvailableHiringManagersForTransfer();
      setTransferSearchQuery("");
      setShowTransferDropdown(false);
    }
  }, [showTransferModal]);

  // Delete request modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    reason: "", // Mandatory reason for deletion
  });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<any>(null);
  const [isLoadingDeleteRequest, setIsLoadingDeleteRequest] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [unarchiveReason, setUnarchiveReason] = useState('');
  const [isSubmittingUnarchive, setIsSubmittingUnarchive] = useState(false);

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

  // Password Reset modal state
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetForm, setPasswordResetForm] = useState({
    email: "",
    sendEmail: true,
  });
  const [isSubmittingPasswordReset, setIsSubmittingPasswordReset] = useState(false);

  // Calendar appointment modal state
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    date: "",
    time: "",
    type: "",
    description: "",
    location: "",
    duration: 30,
    attendees: [] as string[], // Array of user IDs/emails
    sendInvites: true,
  });
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [appointmentUsers, setAppointmentUsers] = useState<any[]>([]);
  const [isLoadingAppointmentUsers, setIsLoadingAppointmentUsers] = useState(false);

  // Fetch hiring manager when component mounts
  useEffect(() => {
    if (hiringManagerId) {
      fetchHiringManager(hiringManagerId);
      fetchDocuments(hiringManagerId);
    }
  }, [hiringManagerId]);

  // Fetch available fields and organization field definitions after hiring manager is loaded
  useEffect(() => {
    if (hiringManager && hiringManagerId) {
      fetchAvailableFields();
      fetchOrganizationAvailableFields();
      // Update note form about field when hiring manager is loaded
      setNoteForm((prev) => ({
        ...prev,
        about: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName
          }`,
      }));
    }
  }, [hiringManager, hiringManagerId]);

  // Fetch users for email notification
  useEffect(() => {
    if (showAddNote) {
      fetchUsers();
    }
  }, [showAddNote]);

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

  // Fetch users for appointment attendees
  useEffect(() => {
    if (showAppointmentModal) {
      fetchAppointmentUsers();
    }
  }, [showAppointmentModal]);

  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );

      const response = await fetch(
        "/api/admin/field-management/hiring-managers",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );


      const raw = await response.text();

      let data: any = {};
      try {
        data = JSON.parse(raw);
      } catch { }

      // ✅ IMPORTANT: your API is returning customFields (as per your screenshot)
      const fields =
        data.customFields ||
        data.fields ||
        data.data?.fields ||
        data.hiringManagerFields ||
        [];


      // Save fields for modal/catalog (visibility/order driven by catalog + localStorage)
      setAvailableFields(fields);
    } catch (err) {
      console.error("Error fetching HM available fields:", err);
    } finally {
      setIsLoadingFields(false);
    }
  };

  // Fetch organization field definitions from admin (same as organizations view)
  const fetchOrganizationAvailableFields = async () => {
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch("/api/admin/field-management/organizations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      const fields =
        data.customFields ||
        data.fields ||
        data.data?.customFields ||
        data.data?.fields ||
        data.organizationFields ||
        [];
      setOrganizationAvailableFields(Array.isArray(fields) ? fields : []);
    } catch (err) {
      console.error("Error fetching organization available fields:", err);
    }
  };

  // Fetch full organization record by ID (for Organization Details panel)
  const fetchOrganizationById = useCallback(async (orgId: string) => {
    if (!orgId) {
      setFetchedOrganization(null);
      return;
    }
    setIsLoadingOrganization(true);
    setFetchedOrganization(null);
    try {
      const response = await fetch(`/api/organizations/${orgId}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to fetch organization");
      }
      const data = await response.json();
      const org = data.organization;
      if (!org) {
        setFetchedOrganization(null);
        return;
      }
      let customFieldsObj: Record<string, any> = {};
      if (org.custom_fields) {
        try {
          customFieldsObj =
            typeof org.custom_fields === "string"
              ? JSON.parse(org.custom_fields)
              : org.custom_fields;
        } catch (_) { }
      }
      setFetchedOrganization({
        ...org,
        customFields: customFieldsObj,
      });
    } catch (err) {
      console.error("Error fetching organization by ID:", err);
      setFetchedOrganization(null);
    } finally {
      setIsLoadingOrganization(false);
    }
  }, []);

  // Fetch full organization record when hiring manager has an organization ID (for Organization Details panel)
  useEffect(() => {
    const orgId = hiringManager?.organization?.id;
    if (orgId) {
      fetchOrganizationById(String(orgId));
    } else {
      setFetchedOrganization(null);
    }
  }, [hiringManager?.organization?.id, fetchOrganizationById]);

  // When catalog loads, if details/organizationDetails visible list is empty, default to all catalog keys
  useEffect(() => {
    const detailsKeys = detailsFieldCatalog.map((f) => f.key);
    if (detailsKeys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.details || [];
        if (current.length > 0) return prev;
        return { ...prev, details: detailsKeys };
      });
    }
  }, [detailsFieldCatalog]);

  useEffect(() => {
    const orgKeys = organizationDetailsFieldCatalog.map((f) => f.key);
    if (orgKeys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.organizationDetails || [];
        if (current.length > 0) return prev;
        return { ...prev, organizationDetails: orgKeys };
      });
    }
  }, [organizationDetailsFieldCatalog]);

  // Sync Hiring Manager Details modal state when opening edit for details
  useEffect(() => {
    if (editingPanel !== "details") return;
    const current = visibleFields.details || [];
    const catalogKeys = detailsFieldCatalog.map((f) => f.key);
    const uniqueCatalogKeys = Array.from(new Set(catalogKeys));

    const currentInCatalog = current.filter((k) => uniqueCatalogKeys.includes(k));
    const rest = uniqueCatalogKeys.filter((k) => !current.includes(k));
    const order = [...currentInCatalog, ...rest];

    const uniqueOrder = Array.from(new Set(order));
    setModalDetailsOrder(uniqueOrder);
    setModalDetailsVisible(
      uniqueCatalogKeys.reduce((acc, k) => {
        acc[k] = current.includes(k);
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.details, detailsFieldCatalog]);

  // Sync Hiring Manager Organization Details modal state when opening edit for organizationDetails
  useEffect(() => {
    if (editingPanel !== "organizationDetails") return;
    const current = visibleFields.organizationDetails || [];
    const catalogKeys = organizationDetailsFieldCatalog.map((f) => f.key);
    const uniqueCatalogKeys = Array.from(new Set(catalogKeys));

    const currentInCatalog = current.filter((k) => uniqueCatalogKeys.includes(k));
    const rest = uniqueCatalogKeys.filter((k) => !current.includes(k));
    const order = [...currentInCatalog, ...rest];

    const uniqueOrder = Array.from(new Set(order));
    setModalOrganizationDetailsOrder(uniqueOrder);
    setModalOrganizationDetailsVisible(
      uniqueCatalogKeys.reduce((acc, k) => {
        acc[k] = current.includes(k);
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.organizationDetails, organizationDetailsFieldCatalog]);


  // Toggle field visibility
  const toggleFieldVisibility = (panelId: string, fieldKey: string) => {
    setVisibleFields((prev) => {
      const panelFields = prev[panelId] || [];
      const uniqueFields = Array.from(new Set(panelFields));
      if (uniqueFields.includes(fieldKey)) {
        return {
          ...prev,
          [panelId]: uniqueFields.filter((f) => f !== fieldKey),
        };
      } else {
        return {
          ...prev,
          [panelId]: Array.from(new Set([...uniqueFields, fieldKey])),
        };
      }
    });
  };

  // Hiring Manager Details modal: save order/visibility and persist for all records
  const handleSaveDetailsFields = useCallback(() => {
    const newOrder = Array.from(new Set(modalDetailsOrder.filter((k) => modalDetailsVisible[k] === true)));
    if (typeof window !== "undefined") {
      localStorage.setItem(HM_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, details: newOrder }));
    setEditingPanel(null);
  }, [modalDetailsOrder, modalDetailsVisible]);

  // Hiring Manager Organization Details modal: save order/visibility and persist for all records
  const handleSaveOrganizationDetailsFields = useCallback(() => {
    const newOrder = Array.from(new Set(modalOrganizationDetailsOrder.filter((k) => modalOrganizationDetailsVisible[k] === true)));
    if (typeof window !== "undefined") {
      localStorage.setItem(HM_ORGANIZATION_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, organizationDetails: newOrder }));
    setEditingPanel(null);
  }, [modalOrganizationDetailsOrder, modalOrganizationDetailsVisible]);


  // Handle edit panel click
  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Function to fetch hiring manager data
  const fetchHiringManager = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/hiring-managers/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });


      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch (error) {
        const parseError = error as Error;
        console.error("Error parsing response:", parseError);
        console.error("Raw response:", responseText.substring(0, 200));
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to fetch hiring manager: ${response.status}`
        );
      }


      if (!data.hiringManager) {
        throw new Error("No hiring manager data received from API");
      }

      // Format the hiring manager data for display
      const hm = data.hiringManager;
      const formattedHiringManager = {
        id: hm.id || "Unknown ID",
        firstName: hm.first_name || "",
        lastName: hm.last_name || "",
        fullName:
          hm.full_name || `${hm.last_name || ""}, ${hm.first_name || ""}`,
        title: hm.title || "Not specified",
        phone: hm.phone || "(Not provided)",
        mobilePhone: hm.mobile_phone || "(Not provided)",
        directLine: hm.direct_line || "(Not provided)",
        email: hm.email || "(Not provided)",
        email2: hm.email2 || "",
        organization: {
          id: hm.organization_id,
          name:
            hm.organization_name ||
            hm.organization_name_from_org ||
            "Not specified",
          status: "Active",
          phone: "(Not provided)",
          url: "https://example.com",
        },
        status: hm.status || "Active",
        department: hm.department || "Not specified",
        reportsTo: hm.reports_to || "Not specified",
        owner: hm.owner || "Not assigned",
        secondaryOwners: hm.secondary_owners || "None",
        linkedinUrl: hm.linkedin_url || "Not provided",
        dateAdded: hm.date_added
          ? new Date(hm.date_added).toLocaleDateString()
          : hm.created_at
            ? new Date(hm.created_at).toLocaleDateString()
            : "Unknown",
        address: hm.address || "No address provided",
        customFields: hm.custom_fields || {},
        archived_at: hm.archived_at
      };

      setHiringManager(formattedHiringManager);

      // Now fetch notes and history
      fetchNotes(id);
      fetchHistory(id);
      fetchSummaryCounts(id);
    } catch (err) {
      console.error("Error fetching hiring manager:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching hiring manager details"
      );
    } finally {
      setIsLoading(false);
    }
  };


  // Fetch notes for the hiring manager
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);
    setNoteError(null);
    try {
      const response = await fetch(`/api/hiring-managers/${id}/notes`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch notes");
      }

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setNoteError(err instanceof Error ? err.message : "An error occurred while fetching notes");
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Fetch history for the hiring manager
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/hiring-managers/${id}/history`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch history");
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error("Error fetching history:", err);
      setHistoryError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching history"
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch summary counts for the hiring manager
  const fetchSummaryCounts = async (id: string) => {
    if (!id) return;
    setIsLoadingSummaryCounts(true);
    try {
      const response = await fetch(`/api/hiring-managers/${id}/summary-counts`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.counts) {
          setSummaryCounts(data.counts);
        }
      }
    } catch (err) {
      console.error("Error fetching summary counts:", err);
    } finally {
      setIsLoadingSummaryCounts(false);
    }
  };

  // Handle status change from summary page dropdown (same as organization summary)
  const handleStatusChange = async (newStatus: string) => {
    const id = hiringManagerId || hiringManager?.id;
    if (!id || isSavingStatus) return;
    setIsSavingStatus(true);
    try {
      const statusField = (availableFields || []).find(
        (f: any) =>
          (f.field_label || "").toLowerCase() === "status" ||
          (f.field_name || "").toLowerCase() === "status"
      );
      const statusLabel = statusField?.field_label || "Status";
      const currentCustomFields = hiringManager?.customFields || {};
      const updatedCustomFields = {
        ...currentCustomFields,
        [statusLabel]: newStatus,
      };
      const response = await fetch(`/api/hiring-managers/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          status: newStatus,
          customFields: updatedCustomFields,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update status");
      }
      setHiringManager((prev: any) =>
        prev
          ? {
            ...prev,
            status: newStatus,
            customFields: updatedCustomFields,
          }
          : prev
      );
      toast.success("Status updated successfully");
      if (id) await fetchHiringManager(id);
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update status");
      if (hiringManagerId) fetchHiringManager(hiringManagerId);
    } finally {
      setIsSavingStatus(false);
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
    
    if (!query || query.trim().length < 2) {
      setAboutSuggestions([]);
      return;
    }

    try {
      const searchTerm = query.trim();
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

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!hiringManagerId) return;

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

    try {
      // Format about references as structured data
      const aboutData = noteForm.aboutReferences.map((ref) => ({
        id: ref.id,
        type: ref.type,
        display: ref.display,
        value: ref.value,
      }));

      const response = await fetch(
        `/api/hiring-managers/${hiringManagerId}/notes`,
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
            text: noteForm.text,
            action: noteForm.action,
            about: JSON.stringify(aboutData), // Send as structured JSON
            about_references: aboutData, // Also send as array for backend processing
            copy_note: noteForm.copyNote === "Yes",
            replace_general_contact_comments:
              noteForm.replaceGeneralContactComments,
            additional_references: noteForm.additionalReferences,
            schedule_next_action: noteForm.scheduleNextAction,
            email_notification: Array.isArray(noteForm.emailNotification) ? noteForm.emailNotification : (noteForm.emailNotification ? [noteForm.emailNotification] : []),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        // Handle backend validation errors
        if (errorData.errors) {
          setNoteFormErrors(errorData.errors);
        } else {
          throw new Error(errorData.message || "Failed to add note");
        }
        return;
      }

      const data = await response.json();

      // Refresh summary counts after adding note
      if (hiringManagerId) {
        fetchSummaryCounts(hiringManagerId);
      }

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      // Clear the form
      const defaultAboutRef = hiringManager
        ? [
          {
            id: hiringManager.id,
            type: "Hiring Manager",
            display: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`,
            value: formatRecordId(hiringManager.id, "hiringManager"),
          },
        ]
        : [];
      setNoteForm({
        text: "",
        action: "",
        about: defaultAboutRef.map((ref) => ref.display).join(", "),
        aboutReferences: defaultAboutRef,
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: [],
        scheduleNextAction: "None",
        emailNotification: [],
      });
      setAboutSearchQuery("");
      setAdditionalRefSearchQuery("");
      setEmailSearchQuery("");
      setShowEmailDropdown(false);
      setNoteFormErrors({});
      setShowAddNote(false);

      // Refresh history
      fetchNotes(hiringManagerId);
      fetchHistory(hiringManagerId);

      toast.success("Note added successfully");
      setShowAddNote(false);
      setNoteFormErrors({});
    } catch (err) {
      console.error("Error adding note:", err);
      toast.error(err instanceof Error ? err.message : "An error occurred while adding a note");
    }
  };

  // Documents functions

  // Fetch documents for the hiring manager
  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);
    try {
      const response = await fetch(`/api/hiring-managers/${id}/documents`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      } else {
        setDocumentError("Failed to fetch documents");
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
      setDocumentError("An error occurred while fetching documents");
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // Handle manual file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setPendingFiles(fileArray);
      // If single file, pre-fill modal with its name
      if (fileArray.length === 1) {
        setFileDetailsName(fileArray[0].name.replace(/\.[^/.]+$/, ""));
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }
  };

  // Drag and drop handlers
  const handleDocDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDocDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDocDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setPendingFiles(fileArray);
      // Pre-fill modal
      if (fileArray.length === 1) {
        setFileDetailsName(fileArray[0].name.replace(/\.[^/.]+$/, ""));
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }
  };

  // Confirm file details and start upload
  const handleConfirmFileDetails = async () => {
    if (pendingFiles.length === 0 || !hiringManagerId) return;

    setShowFileDetailsModal(false);
    const filesToUpload = [...pendingFiles];
    setPendingFiles([]);

    setUploadErrors({});
    const newUploadProgress = { ...uploadProgress };

    for (const file of filesToUpload) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadErrors(prev => ({
          ...prev,
          [file.name]: "File size exceeds 10MB limit"
        }));
        continue;
      }

      // Start upload
      newUploadProgress[file.name] = 0;
      setUploadProgress({ ...newUploadProgress });

      try {
        const formData = new FormData();
        formData.append("file", file);
        // Strip file extension from name
        const fileNameWithoutExt = filesToUpload.length === 1 ? fileDetailsName : file.name.replace(/\.[^/.]+$/, "");
        formData.append("document_name", fileNameWithoutExt);
        formData.append("document_type", filesToUpload.length === 1 ? fileDetailsType : "General");

        // Simulate progress for UI feedback since fetch doesn't support it natively without XHR
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev[file.name] || 0;
            if (current >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return { ...prev, [file.name]: current + 10 };
          });
        }, 200);

        const response = await fetch(`/api/hiring-managers/${hiringManagerId}/documents/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
          body: formData,
        });

        clearInterval(progressInterval);

        if (response.ok) {
          setUploadProgress(prev => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
          await fetchDocuments(hiringManagerId);
          toast.success("Document added successfully");
        } else {
          const data = await response.json();
          setUploadErrors(prev => ({
            ...prev,
            [file.name]: data.message || "Upload failed"
          }));
          setUploadProgress(prev => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
        }
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        setUploadErrors(prev => ({
          ...prev,
          [file.name]: "An error occurred during upload"
        }));
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    }
  };

  // Add a text-based document
  const handleAddDocument = async () => {
    if (!hiringManagerId || !newDocumentName.trim()) return;

    try {
      const response = await fetch(`/api/hiring-managers/${hiringManagerId}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          document_name: newDocumentName,
          document_type: newDocumentType,
          content: newDocumentContent,
        }),
      });

      if (response.ok) {
        setShowAddDocument(false);
        setNewDocumentName("");
        setNewDocumentType("General");
        setNewDocumentContent("");
        await fetchDocuments(hiringManagerId);
        toast.success("Document added successfully");
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to add document");
      }
    } catch (err) {
      console.error("Error adding document:", err);
      toast.error("An error occurred while adding the document");
    }
  };

  // Delete a document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(`/api/hiring-managers/${hiringManagerId}/documents/${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        fetchDocuments(hiringManagerId!);
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete document");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      toast.error("An error occurred while deleting the document");
    }
  };

  // Download a document
  // const handleDownloadDocument = async (doc: any) => {
  //   // Check if it's a text file (by mime_type or file extension)
  //   const isTextFile = doc.mime_type === "text/plain" || 
  //                      doc.file_path?.toLowerCase().endsWith(".txt") ||
  //                      doc.document_name?.toLowerCase().endsWith(".txt");

  //   // If the document has a stored file path
  //   if (doc.file_path) {
  //     // For text files, force download instead of opening in a new tab
  //     if (isTextFile) {
  //       try {
  //         const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  //         const isAbsoluteUrl = doc.file_path.startsWith('http://') || doc.file_path.startsWith('https://');

  //         const url = isAbsoluteUrl
  //           ? doc.file_path
  //           : `${apiUrl}/${doc.file_path.startsWith("/") ? doc.file_path.slice(1) : doc.file_path}`;

  //         // Fetch the file content and create a blob for download
  //         const response = await fetch(url);
  //         if (!response.ok) {
  //           throw new Error("Failed to fetch file");
  //         }
  //         const blob = await response.blob();
  //         const downloadUrl = URL.createObjectURL(blob);
  //         const link = document.createElement("a");
  //         link.href = downloadUrl;
  //         link.download = `${doc.document_name || "document"}.txt`;
  //         document.body.appendChild(link);
  //         link.click();
  //         document.body.removeChild(link);
  //         URL.revokeObjectURL(downloadUrl);
  //         toast.success("File downloaded successfully");
  //       } catch (error) {
  //         console.error("Error downloading text file:", error);
  //         toast.error("Failed to download file. Opening in new tab instead.");
  //         // Fallback to opening in new tab if download fails
  //         const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  //         window.open(`${apiUrl}/${doc.file_path}`, "_blank");
  //       }
  //       return;
  //     }

  //     // For non-text files, open in a new tab (existing behavior)
  //     const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  //     window.open(`${apiUrl}/${doc.file_path}`, "_blank");
  //     return;
  //   }

  //   // For text documents without a file_path, generate a file to download
  //   if (doc.content) {
  //     const element = document.createElement("a");
  //     const file = new Blob([doc.content || ""], { type: "text/plain;charset=utf-8" });
  //     const fileUrl = URL.createObjectURL(file);
  //     element.href = fileUrl;
  //     element.download = `${doc.document_name || "document"}.txt`;
  //     document.body.appendChild(element);
  //     element.click();
  //     document.body.removeChild(element);
  //     URL.revokeObjectURL(fileUrl);
  //     toast.success("File downloaded successfully");
  //   } else {
  //     toast.info("This document has no file or content to download.");
  //   }
  // };
  const handleDownloadDocument = async (doc: any) => {
    // Check if it's a text file (by mime_type or file extension)
    const isTextFile = doc.mime_type === "text/plain" ||
      doc.file_path?.toLowerCase().endsWith(".txt") ||
      doc.document_name?.toLowerCase().endsWith(".txt");

    // If the document has a stored file path
    if (doc.file_path) {
      // For text files, force download instead of opening in a new tab
      if (isTextFile) {
        try {
          // Check if it's an absolute URL (e.g. from Vercel Blob)
          const isAbsoluteUrl = doc.file_path.startsWith('http://') || doc.file_path.startsWith('https://');

          // Prepend leading slash if missing and not absolute URL
          const url = isAbsoluteUrl
            ? doc.file_path
            : (doc.file_path.startsWith("/") ? doc.file_path : `/${doc.file_path}`);

          // Fetch the file content and create a blob for download
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Failed to fetch file");
          }
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = `${doc.document_name || "document"}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          toast.success("File downloaded successfully");
        } catch (error) {
          console.error("Error downloading text file:", error);
          toast.error("Failed to download file. Opening in new tab instead.");
          // Fallback to opening in new tab if download fails
          const isAbsoluteUrl = doc.file_path.startsWith('http://') || doc.file_path.startsWith('https://');
          const url = isAbsoluteUrl
            ? doc.file_path
            : (doc.file_path.startsWith("/") ? doc.file_path : `/${doc.file_path}`);
          window.open(url, "_blank");
        }
        return;
      }

      // For non-text files, open in a new tab (existing behavior)
      const isAbsoluteUrl = doc.file_path.startsWith('http://') || doc.file_path.startsWith('https://');
      const url = isAbsoluteUrl
        ? doc.file_path
        : (doc.file_path.startsWith("/") ? doc.file_path : `/${doc.file_path}`);
      window.open(url, "_blank");
      return;
    }

    // For text-based documents without a file, trigger a text download
    if (doc.content) {
      const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${doc.document_name || "document"}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("File downloaded successfully");
    } else {
      toast.info("This document has no file or content to download.");
    }
  };

  // Close add note modal
  const handleCloseAddNoteModal = () => {
    const defaultAboutRef = hiringManager
      ? [
        {
          id: hiringManager.id,
          type: "Hiring Manager",
          display: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`,
          value: formatRecordId(hiringManager.id, "hiringManager"),
        },
      ]
      : [];
    setNoteForm({
      text: "",
      action: "",
      about: defaultAboutRef.map((ref) => ref.display).join(", "),
      aboutReferences: defaultAboutRef,
      copyNote: "No",
      replaceGeneralContactComments: false,
      additionalReferences: [],
      scheduleNextAction: "None",
      emailNotification: [],
    });
    setAboutSearchQuery("");
    setAdditionalRefSearchQuery("");
    setEmailSearchQuery("");
    setShowEmailDropdown(false);
    setNoteFormErrors({});
    setShowAboutDropdown(false);
    setShowAdditionalRefDropdown(false);
    setShowAddNote(false);
  };

  const handleGoBack = () => {
    router.back();
  };

  const filteredTransferHiringManagers = transferSearchQuery.trim() === ""
    ? availableHiringManagersForTransfer
    : availableHiringManagersForTransfer.filter((hm: any) => {
      const q = transferSearchQuery.trim().toLowerCase();
      const fullName = String(hm?.full_name || `${hm?.last_name || ""}, ${hm?.first_name || ""}`).toLowerCase();
      const idStr = hm?.id !== undefined && hm?.id !== null ? String(hm.id) : "";
      const recordId = hm?.id !== undefined && hm?.id !== null
        ? String(formatRecordId(hm.id, "hiringManager")).toLowerCase()
        : "";
      return fullName.includes(q) || idStr.includes(q) || recordId.includes(q);
    });

  // Fetch available hiring managers for transfer (exclude current and archived)
  const fetchAvailableHiringManagersForTransfer = async () => {
    setIsLoadingTransferTargets(true);
    try {
      const response = await fetch("/api/hiring-managers", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const list = data.hiringManagers || data.data || data || [];
        const arr = Array.isArray(list) ? list : [];
        const filtered = arr.filter(
          (hm: any) =>
            String(hm?.id) !== String(hiringManagerId) &&
            hm?.status !== "Archived" &&
            !hm?.archived_at
        );
        setAvailableHiringManagersForTransfer(filtered);
      } else {
        setAvailableHiringManagersForTransfer([]);
      }
    } catch (err) {
      console.error("Error fetching hiring managers for transfer:", err);
      setAvailableHiringManagersForTransfer([]);
    } finally {
      setIsLoadingTransferTargets(false);
    }
  };

  // Handle transfer submission (Hiring Manager to Hiring Manager: notes, docs, tasks, jobs → target; source HM archived)
  const handleTransferSubmit = async () => {
    if (!transferForm.targetHiringManagerId) {
      toast.error("Please select a target hiring manager");
      return;
    }

    if (!hiringManagerId) {
      toast.error("Hiring Manager ID is missing");
      return;
    }

    const targetId = Number(transferForm.targetHiringManagerId);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      toast.error("Invalid target hiring manager");
      return;
    }

    if (Number(hiringManagerId) === targetId) {
      toast.error("Cannot transfer to the same hiring manager");
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      const userCookie = document.cookie.replace(
        /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      let currentUser: any = null;
      if (userCookie) {
        try {
          currentUser = JSON.parse(decodeURIComponent(userCookie));
        } catch { }
      }

      // Add note to source hiring manager
      await fetch(`/api/hiring-managers/${hiringManagerId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          text: "Transfer requested (data will move to target hiring manager)",
          action: "Transfer",
          about_references: [{
            id: hiringManagerId,
            type: "Hiring Manager",
            display: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`,
          }],
        }),
      });

      const transferResponse = await fetch("/api/hiring-managers/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          source_hiring_manager_id: Number(hiringManagerId),
          target_hiring_manager_id: targetId,
          requested_by: currentUser?.name || currentUser?.id || "Unknown",
          requested_by_email: currentUser?.email || "",
          source_record_number: formatRecordId(Number(hiringManagerId), "hiringManager"),
          target_record_number: formatRecordId(targetId, "hiringManager"),
        }),
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse
          .json()
          .catch(() => ({ message: "Failed to create transfer request" }));
        throw new Error(errorData.message || "Failed to create transfer request");
      }

      toast.success("Transfer request submitted successfully. Payroll will be notified for approval.");
      setShowTransferModal(false);
      setTransferForm({ targetHiringManagerId: "" });
      setTransferSearchQuery("");
    } catch (err) {
      console.warn("Transfer request failed:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to submit transfer request. Please try again."
      );
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Check for pending delete request
  const checkPendingDeleteRequest = async () => {
    if (!hiringManagerId) return;

    setIsLoadingDeleteRequest(true);
    try {
      const response = await fetch(
        `/api/hiring-managers/${hiringManagerId}/delete-request`,
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
        if (data.deleteRequest && data.deleteRequest.status === "pending") {
          setPendingDeleteRequest(data.deleteRequest);
        } else {
          setPendingDeleteRequest(null);
        }
      }
    } catch (err) {
      console.error("Error checking delete request:", err);
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

    if (!hiringManagerId) {
      toast.error("Hiring Manager ID is missing");
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
        } catch { }
      }

      // Create delete request
      const deleteRequestResponse = await fetch(
        `/api/hiring-managers/${hiringManagerId}/delete-request`,
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
            record_type: "hiring_manager",
            record_number: formatRecordId(hiringManager.id, "hiringManager"),
            requested_by: currentUser?.id || currentUser?.name || "Unknown",
            requested_by_email: currentUser?.email || "",
          }),
        }
      );

      if (!deleteRequestResponse.ok) {
        const errorData = await deleteRequestResponse
          .json()
          .catch(() => ({ message: "Failed to create delete request" }));
        throw new Error(errorData.message || "Failed to create delete request");
      }

      toast.success("Delete request submitted successfully. Payroll will be notified for approval.");
      setShowDeleteModal(false);
      setDeleteForm({ reason: "" });
      checkPendingDeleteRequest(); // Refresh delete request status
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

  const handleUnarchiveSubmit = async () => {
    if (!unarchiveReason.trim() || !hiringManagerId) {
      toast.error("Please enter a reason for unarchiving.");
      return;
    }
    setIsSubmittingUnarchive(true);
    try {
      const userCookie = document.cookie.replace(
        /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      let currentUser: { name?: string; email?: string } = {};
      if (userCookie) {
        try {
          currentUser = JSON.parse(decodeURIComponent(userCookie));
        } catch (e) {
          console.error("Error parsing user cookie:", e);
        }
      }
      const recordDisplay = hiringManager
        ? `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName || ""}`.trim()
        : formatRecordId(hiringManagerId, "hiringManager");
      const res = await fetch(`/api/hiring-managers/${hiringManagerId}/unarchive-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: unarchiveReason.trim(),
          record_number: recordDisplay,
          requested_by: currentUser?.name || "Unknown",
          requested_by_email: currentUser?.email || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send unarchive request");
      toast.success("Unarchive request sent. Payroll will be notified via email.");
      setShowUnarchiveModal(false);
      setUnarchiveReason("");
    } catch (err) {
      console.error("Error submitting unarchive request:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to send unarchive request. Please try again."
      );
    } finally {
      setIsSubmittingUnarchive(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!hiringManagerId) {
      toast.error("Hiring Manager ID is missing");
      return;
    }

    if (!passwordResetForm.email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(passwordResetForm.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmittingPasswordReset(true);
    try {
      const response = await fetch(
        `/api/hiring-managers/${hiringManagerId}/password-reset`,
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
            email: passwordResetForm.email.trim(),
            send_email: passwordResetForm.sendEmail,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to reset password" }));
        throw new Error(errorData.message || "Failed to reset password");
      }

      toast.success("Password reset processed successfully. An email has been sent if requested.");
      setShowPasswordResetModal(false);
      setPasswordResetForm({ email: "", sendEmail: true });
    } catch (err) {
      console.error("Error resetting password:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to reset password. Please try again."
      );
    } finally {
      setIsSubmittingPasswordReset(false);
    }
  };

  // Print handler: ensure Summary tab is active when printing
  const handlePrint = () => {
    const printContent = document.getElementById("printable-summary");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tabTitle = activeTab?.toUpperCase() || "Hiring Manager SUMMARY";

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
    if (hiringManagerId) {
      router.push(`/dashboard/hiring-managers/add?id=${hiringManagerId}`);
    }
  };

  // Handle Send Email - Opens default email application using mailto link
  const handleSendEmail = () => {
    // Get email from hiring manager
    const email = hiringManager?.email;

    // Validate email - check if exists and not placeholder
    if (!email || email.trim() === "" || email === "(Not provided)" || email === "No email provided") {
      toast.error("Hiring manager email address is not available. Please add an email address to this record.");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("The email address format is invalid. Please check the email address and try again.");
      return;
    }

    const recipientEmail = email.trim();

    // Open default email application using mailto link
    // This will open Outlook Desktop if it's set as the default mail app on Windows
    window.location.href = `mailto:${recipientEmail}`;
  };

  // Fetch users for appointment attendees
  const fetchAppointmentUsers = async () => {
    setIsLoadingAppointmentUsers(true);
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
        setAppointmentUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingAppointmentUsers(false);
    }
  };

  const handleActionSelected = (action: string) => {
    if (action === "edit") {
      handleEdit();
    } else if (action === "delete" && hiringManagerId) {
      setShowDeleteModal(true);
    } else if (action === "add-task") {
      // Navigate to add task page with hiring manager context
      if (hiringManagerId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=hiring_manager&relatedEntityId=${hiringManagerId}`
        );
      }
    } else if (action === "add-note") {
      setShowAddNote(true);
      // setActiveTab("notes");
    } else if (action === "add-job") {
      router.push(
        `/dashboard/jobs/add?relatedEntity=hiring_manager&relatedEntityId=${hiringManagerId}`
      );
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else if (action === "send-email") {
      handleSendEmail();
    } else if (action === "add-appointment") {
      setShowAppointmentModal(true);
      // Pre-fill hiring manager email if available
      if (hiringManager?.email && hiringManager.email !== "(Not provided)" && hiringManager.email !== "No email provided") {
        setAppointmentForm((prev) => ({
          ...prev,
          attendees: [hiringManager.email],
        }));
      }
    } else if (action === "password-reset") {
      // Pre-fill email if available
      setPasswordResetForm({
        email: hiringManager?.email && hiringManager.email !== "(Not provided)" && hiringManager.email !== "No email provided"
          ? hiringManager.email
          : "",
        sendEmail: true,
      });
      setShowPasswordResetModal(true);
    } else if (action === "transfer") {
      setShowTransferModal(true);
    }
  };

  // Handle appointment submission
  const handleAppointmentSubmit = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.type) {
      toast.error("Please fill in all required fields (Date, Time, Type)");
      return;
    }

    if (!hiringManagerId) {
      toast.error("Hiring Manager ID is missing");
      return;
    }

    setIsSavingAppointment(true);

    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );

      // Create appointment in planner
      const response = await fetch("/api/planner/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: appointmentForm.date,
          time: appointmentForm.time,
          type: appointmentForm.type,
          description: appointmentForm.description,
          location: appointmentForm.location,
          duration: appointmentForm.duration,
          hiringManagerId: hiringManagerId,
          client: hiringManager?.fullName || hiringManager?.name || "",
          organizationId: hiringManager?.organizationId || null,
          attendees: appointmentForm.attendees,
          sendInvites: appointmentForm.sendInvites,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create appointment";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `HTTP ${response.status}: ${response.statusText || "Failed to create appointment"}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Send calendar invites if requested
      if (appointmentForm.sendInvites && appointmentForm.attendees.length > 0) {
        try {
          // Combine date and time
          const [hours, minutes] = appointmentForm.time.split(':');
          const appointmentDate = new Date(appointmentForm.date);
          appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          const endDate = new Date(appointmentDate);
          endDate.setMinutes(endDate.getMinutes() + appointmentForm.duration);

          const calendarEvent: CalendarEvent = {
            subject: `${appointmentForm.type} - ${hiringManager?.fullName || hiringManager?.name || 'Hiring Manager'}`,
            start: {
              dateTime: appointmentDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            body: {
              contentType: 'Text',
              content: appointmentForm.description || `Appointment: ${appointmentForm.type}`,
            },
            location: appointmentForm.location ? {
              displayName: appointmentForm.location,
            } : undefined,
          };

          await sendCalendarInvite(calendarEvent, appointmentForm.attendees);
        } catch (inviteError) {
          console.error("Error sending calendar invites:", inviteError);
          // Don't fail the appointment creation if invites fail
          toast.warning("Appointment created, but calendar invites failed to send. Please send manually.");
        }
      }

      toast.success("Appointment created successfully!");
      setShowAppointmentModal(false);
      setAppointmentForm({
        date: "",
        time: "",
        type: "",
        description: "",
        location: "",
        duration: 30,
        attendees: [],
        sendInvites: true,
      });
    } catch (err) {
      console.error("Error creating appointment:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create appointment. Please try again.");
    } finally {
      setIsSavingAppointment(false);
    }
  };

  // Handle hiring manager deletion (legacy - now uses delete request workflow)
  const handleDelete = async (id: string) => {
    // This function is kept for backward compatibility but now opens the delete modal
    setShowDeleteModal(true);
  };

  const isArchived = !!hiringManager?.archived_at;

  const actionOptions = isArchived
    ? [{ label: "Unarchive", action: () => setShowUnarchiveModal(true) }]
    : [
        { label: "Add Note", action: () => handleActionSelected("add-note") },
        { label: "Add Job", action: () => handleActionSelected("add-job") },
        { label: "Send Email", action: () => handleActionSelected("send-email") },
        { label: "Add Task", action: () => handleActionSelected("add-task") },
        { label: "Add Appointment", action: () => handleActionSelected("add-appointment") },
        { label: "Add Tearsheet", action: () => handleActionSelected("add-tearsheet") },
        { label: "Password Reset", action: () => handleActionSelected("password-reset") },
        { label: "Transfer", action: () => handleActionSelected("transfer") },
        { label: "Delete", action: () => handleActionSelected("delete") },
      ];

  // Tabs from the interface
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "history", label: "History" },
    { id: "notes", label: "Notes" },
    { id: "docs", label: "Docs" },
    { id: "active-applicants", label: "Active Applicants" },
    { id: "opportunities", label: "Opportunities" },
    { id: "quotes", label: "Quotes" },
    { id: "invoices", label: "Invoices" },
  ];

  // Quick action buttons
  const quickActions = [
    { id: "jobs", label: "Jobs" },
    { id: "apps-under-review", label: "Apps Under Review" },
    { id: "interviews", label: "Interviews" },
    { id: "placements", label: "Placements" },
  ];

  // Render documents tab content
  const renderDocsTab = () => {
    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Hiring Manager Documents</h2>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Upload Files
            </button>
            <button
              onClick={() => setShowAddDocument(true)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Add Text Document
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
        />

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDocDragEnter}
          onDragOver={handleDocDragOver}
          onDragLeave={handleDocDragLeave}
          onDrop={handleDocDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }`}
        >
          <div className="flex flex-col items-center">
            <svg
              className="w-12 h-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-600 mb-2">
              Drag and drop files here, or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-500 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-gray-500">
              Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG, GIF (Max 10MB per file)
            </p>
          </div>
        </div>

        {/* Upload Progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="mb-4 space-y-2">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="bg-gray-100 rounded p-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Errors */}
        {Object.keys(uploadErrors).length > 0 && (
          <div className="mb-4 space-y-2">
            {Object.entries(uploadErrors).map(([fileName, error]) => (
              <div key={fileName} className="bg-red-50 border border-red-200 rounded p-2">
                <p className="text-sm text-red-800">
                  <strong>{fileName}:</strong> {error}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Add Document Form */}
        {showAddDocument && (
          <div className="mb-6 p-4 bg-gray-50 rounded border">
            <h3 className="font-medium mb-2">Add New Document</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Document Name *
                </label>
                <input
                  type="text"
                  value={newDocumentName}
                  onChange={(e) => setNewDocumentName(e.target.value)}
                  placeholder="Enter document name"
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Document Type
                </label>
                <select
                  value={newDocumentType}
                  onChange={(e) => setNewDocumentType(e.target.value)}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="General">General</option>
                  <option value="Contract">Contract</option>
                  <option value="Agreement">Agreement</option>
                  <option value="Policy">Policy</option>
                  <option value="Welcome">Welcome</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Content
                </label>
                <textarea
                  value={newDocumentContent}
                  onChange={(e) => setNewDocumentContent(e.target.value)}
                  placeholder="Enter document content..."
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={6}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-3">
              <button
                onClick={() => setShowAddDocument(false)}
                className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDocument}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!newDocumentName.trim()}
              >
                Save Document
              </button>
            </div>
          </div>
        )}

        {/* Documents List */}
        {isLoadingDocuments ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : documentError ? (
          <div className="text-red-500 py-2">{documentError}</div>
        ) : documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3 font-medium">Actions</th>
                  <th className="text-left p-3 font-medium">
                    Document Name
                  </th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Created By</th>
                  <th className="text-left p-3 font-medium">Created At</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <ActionDropdown
                        label="Actions"
                        options={[
                          {
                            label: "View",
                            action: () => setSelectedDocument(doc),
                          },
                          {
                            label: "Download",
                            action: () => handleDownloadDocument(doc),
                          },
                          {
                            label: "Delete",
                            action: () => handleDeleteDocument(doc.id),
                          },
                        ]}
                      />
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setSelectedDocument(doc)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {doc.document_name}
                      </button>
                    </td>
                    <td className="p-3">{doc.document_type}</td>
                    <td className="p-3">
                      {doc.created_by_name || "System"}
                    </td>
                    <td className="p-3">
                      {new Date(doc.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 italic">No documents available</p>
        )}
      </div>
    );
  };

  // Helper to navigate to a referenced record (match Organization Notes)
  const navigateToReference = (ref: any) => {
    if (!ref || !ref.id) return;
    const refType = (typeof ref === "string" ? null : (ref.type || "").toLowerCase().replace(/\s+/g, "")) as string | null;
    const refId = typeof ref === "string" ? null : ref.id;
    if (!refId) return;
    const routeMap: Record<string, string> = {
      organization: `/dashboard/organizations/view?id=${refId}`,
      job: `/dashboard/jobs/view?id=${refId}`,
      jobseeker: `/dashboard/job-seekers/view?id=${refId}`,
      lead: `/dashboard/leads/view?id=${refId}`,
      task: `/dashboard/tasks/view?id=${refId}`,
      placement: `/dashboard/placements/view?id=${refId}`,
      hiringmanager: `/dashboard/hiring-managers/view?id=${refId}`,
    };
    const route = refType ? routeMap[refType] : null;
    if (route) router.push(route);
  };

  // Render notes tab content (standardized to Organization Notes design)
  const renderNotesTab = () => {
    const parseAboutReferences = (refs: any) => {
      if (!refs) return [];
      if (typeof refs === "string") {
        try {
          return JSON.parse(refs);
        } catch {
          return [];
        }
      }
      if (Array.isArray(refs)) return refs;
      return [];
    };

    return (
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

        {/* Filters & Sort Controls */}
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
            <select
              value={noteActionFilter}
              onChange={(e) => setNoteActionFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded text-sm"
            >
              <option value="">All Actions</option>
              {actionFields.map((af) => (
                <option key={af.id || af.field_name || af.field_label} value={af.field_name || af.field_label}>
                  {af.field_label || af.field_name}
                </option>
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
              {Array.from(new Set(notes.map((n) => n.created_by_name || "Unknown User"))).map((author) => (
                <option key={author} value={author}>{author}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={noteSortKey}
              onChange={(e) => setNoteSortKey(e.target.value as "date" | "action" | "author")}
              className="p-2 border border-gray-300 rounded text-sm"
            >
              <option value="date">Date</option>
              <option value="action">Action</option>
              <option value="author">Author</option>
            </select>
          </div>
          <div>
            <button
              onClick={() => setNoteSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs text-black"
              title="Toggle Sort Direction"
            >
              {noteSortDir === "asc" ? "Asc ↑" : "Desc ↓"}
            </button>
          </div>
          {(noteActionFilter || noteAuthorFilter) && (
            <button
              onClick={() => { setNoteActionFilter(""); setNoteAuthorFilter(""); }}
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Notes List */}
        {isLoadingNotes ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : noteError ? (
          <div className="text-red-500 py-2">{noteError}</div>
        ) : sortedFilteredNotes.length > 0 ? (
          <div className="space-y-4">
            {sortedFilteredNotes.map((note) => {
              const actionLabel =
                actionFields.find(
                  (af) => af.field_name === note.action || af.field_label === note.action
                )?.field_label || note.action || "General Note";
              const aboutRefs = parseAboutReferences((note as any).about_references ?? (note as any).aboutReferences);

              return (
                <div id={`note-${note.id}`} key={note.id} className="p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
                  <div className="border-b border-gray-200 pb-3 mb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-blue-600">
                            {note.created_by_name || "Unknown User"}
                          </span>
                          {actionLabel && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                              {actionLabel}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">
                            Hiring Manager
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleString("en-US", {
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const el = document.getElementById(`note-${note.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              el.classList.add("ring-2", "ring-blue-500");
                              setTimeout(() => el.classList.remove("ring-2", "ring-blue-500"), 2000);
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
                            const displayText = typeof ref === "string" ? ref : ref.display || ref.value || `${ref.type} #${ref.id}`;
                            const refType = typeof ref === "string" ? null : (ref.type || "").toLowerCase().replace(/\s+/g, "");
                            const refId = typeof ref === "string" ? null : ref.id;
                            const isClickable = !!(refId && refType);
                            return (
                              <button
                                key={idx}
                                onClick={() => isClickable && navigateToReference(ref)}
                                disabled={!isClickable}
                                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition-all ${isClickable ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer" : "bg-gray-100 text-gray-700 border-gray-200 cursor-default"}`}
                                title={isClickable ? `View ${refType}` : "Reference not available"}
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
          <p className="text-gray-500 italic">No notes have been added yet.</p>
        )}
      </div>
    );
  };

  // Render history tab content
  const renderHistoryTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Hiring Manager History</h2>

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
              let actionDisplay = "";
              let detailsDisplay: React.ReactNode = "";

              try {
                const details =
                  typeof item.details === "string"
                    ? JSON.parse(item.details)
                    : item.details;

                switch (item.action) {
                  case "CREATE":
                    actionDisplay = "Hiring Manager Created";
                    detailsDisplay = `Created by ${item.performed_by_name || "Unknown"
                      }`;
                    break;
                  case "UPDATE":
                    actionDisplay = "Hiring Manager Updated";
                    if (details && details.before && details.after) {
                      // Create a list of changes
                      const changes: React.ReactNode[] = [];

                      // Helper function to format values
                      const formatValue = (val: any): string => {
                        if (val === null || val === undefined) return "Empty";
                        if (typeof val === "object") return JSON.stringify(val);
                        return String(val);
                      };

                      for (const key in details.after) {
                        // Skip internal fields that might not be relevant to users
                        if (key === "updated_at") continue;

                        const beforeVal = details.before[key];
                        const afterVal = details.after[key];

                        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
                          // Special handling for custom_fields
                          if (key === "custom_fields") {
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
                          // const fieldName = key.replace(/_/g, " ");
                          // changes.push(
                          //   <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-sm">
                          //     <span className="font-semibold text-gray-700 capitalize min-w-[120px]">{fieldName}:</span>
                          //     <div className="flex flex-wrap gap-2 items-center">
                          //       <span className="text-red-600 bg-red-50 px-1 rounded line-through decoration-red-400 opacity-80">
                          //         {formatValue(beforeVal)}
                          //       </span>
                          //       <span className="text-gray-400">→</span>
                          //       <span className="text-green-700 bg-green-50 px-1 rounded font-medium">
                          //         {formatValue(afterVal)}
                          //       </span>
                          //     </div>
                          //   </div>
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
                  case "ADD_NOTE":
                    actionDisplay = "Note Added";
                    detailsDisplay = details.text || "";
                    break;
                  default:
                    actionDisplay = item.action;
                    detailsDisplay = JSON.stringify(details);
                }
              } catch (e) {
                console.error("Error parsing history details:", e);
                detailsDisplay = "Error displaying details";
              }

              return (
                <div
                  key={item.id}
                  className="p-3 border rounded hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-blue-600">
                      {actionDisplay}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(item.performed_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mb-2">{detailsDisplay}</div>
                  <div className="text-sm text-gray-600">
                    By: {item.performed_by_name || "Unknown"}
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

  // Modified the Modify tab to redirect to the add page
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Edit Hiring Manager</h2>
      <p className="text-gray-600 mb-4">
        {isArchived
          ? "Archived records cannot be edited."
          : "Click the button below to edit this hiring manager's details."}
      </p>
      <button
        onClick={handleEdit}
        disabled={isArchived}
        className={`px-4 py-2 rounded ${isArchived ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
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
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
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
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
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
            <FiUserCheck size={20} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            HM {hiringManager.id} {hiringManager.fullName}
          </h1>
          {
            hiringManager.archived_at && (
              <div className="ml-3">
                <CountdownTimer archivedAt={hiringManager.archived_at} />
              </div>
            )
          }
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 p-3">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          {/* Header Fields */}
          <div className="flex flex-wrap gap-x-10 gap-y-2 flex-1 min-w-0">
            {headerFields.length === 0 ? (
              <span className="text-sm text-gray-500">
                No header fields selected
              </span>
            ) : (
              headerFields.map((fk) => {
                const fieldInfo = getHeaderFieldInfo(fk);
                return (
                  <div key={fk} className="min-w-[140px]">
                    <div className="text-xs text-gray-500">{getHeaderFieldLabel(fk)}</div>
                    <FieldValueRenderer
                      value={getHeaderFieldValue(fk)}
                      fieldInfo={fieldInfo ? { key: fieldInfo.key, label: fieldInfo.label, fieldType: fieldInfo.fieldType, lookupType: fieldInfo.lookupType, multiSelectLookupType: fieldInfo.multiSelectLookupType } : { key: fk, label: getHeaderFieldLabel(fk) }}
                      emptyPlaceholder="-"
                      clickable
                    />
                  </div>
                );
              })
            )}

          </div>

          {/* Action Buttons */}
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
              disabled={!hiringManager}
            >
              <BsFillPinAngleFill size={18} />
            </button>
            <button
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Reload"
              onClick={() =>
                hiringManagerId && fetchHiringManager(hiringManagerId)
              }
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
        {tabs.map((tab) => {
          const isModifyTab = tab.id === "modify";
          const tabDisabled = isModifyTab && isArchived;
          return (
            <button
              key={tab.id}
              className={`px-4 py-2 ${activeTab === tab.id
                ? "bg-gray-200 rounded-t border-t border-r border-l border-gray-400 font-medium"
                : "text-gray-700 hover:bg-gray-200"
                } ${tabDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={tabDisabled}
              onClick={() => {
                if (tabDisabled) return;
                if (isModifyTab) {
                  handleEdit();
                } else {
                  setActiveTab(tab.id);
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex bg-gray-300 p-2 space-x-2">
        <div className="flex-1 space-x-2">
          {quickActions.map((action) => {
            let count = 0;
            let countLabel = action.label;

            if (action.id === "jobs") {
              count = summaryCounts.jobs || 0;
              countLabel = isLoadingSummaryCounts ? "Loading..." : `${count} ${count === 1 ? "Job" : "Jobs"}`;
            } else if (action.id === "apps-under-review") {
              count = summaryCounts.appsUnderReview || 0;
              countLabel = isLoadingSummaryCounts ? "Loading..." : `${count} Apps Under Review`;
            } else if (action.id === "interviews") {
              count = summaryCounts.interviews || 0;
              countLabel = isLoadingSummaryCounts ? "Loading..." : `${count} ${count === 1 ? "Interview" : "Interviews"}`;
            } else if (action.id === "placements") {
              count = summaryCounts.placements || 0;
              countLabel = isLoadingSummaryCounts ? "Loading..." : `${count} ${count === 1 ? "Placement" : "Placements"}`;
            }
            return (
              <button
                key={action.id}
                className="bg-white px-4 py-1 rounded-full shadow text-gray-700 hover:bg-gray-100"
              >
                {countLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}

      {/* NEW Summary with drag-drop + pin */}
      {activeTab === "summary" && (
        <div className="relative w-full">
          {/* Pinned side drawer */}
          {/* {isPinned && (
            <div className={`mt-12 fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transition-all duration-300 ${isCollapsed ? "w-12" : "w-1/3"} border-l border-gray-300`}>
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                  <h3 className="font-semibold text-sm">Hiring Manager Summary</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsCollapsed(!isCollapsed)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title={isCollapsed ? "Expand" : "Collapse"}
                    >
                      {isCollapsed ? "▶" : "◀"}
                    </button>
                    <button
                      onClick={togglePin}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Unpin panel"
                    >
                      <FiUnlock className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div id="printable-summary">
                      <DndContext
                        id="pinned-summary-dnd"
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        measuring={measuringConfig}
                        modifiers={[restrictToWindowEdges]}
                        onDragStart={handlePanelDragStart}
                        onDragOver={handlePanelDragOver}
                        onDragEnd={handlePanelDragEnd}
                        onDragCancel={handlePanelDragCancel}
                      >
                        <div className="flex flex-col gap-4">
                          <DroppableContainer id="left" items={columns.left}>
                            {columns.left.map((id) => renderPanel(id))}
                          </DroppableContainer>
                          <DroppableContainer id="right" items={columns.right}>
                            {columns.right.map((id) => renderPanel(id))}
                          </DroppableContainer>
                        </div>
                        <DragOverlay dropAnimation={dropAnimationConfig}>
                          {activeId ? renderPanel(activeId, true) : null}
                        </DragOverlay>
                      </DndContext>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )} */}

          {/* Regular summary (not pinned) */}
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
                onDragCancel={handlePanelDragCancel}
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
                <DragOverlay dropAnimation={dropAnimationConfig}>
                  {activeId ? renderPanel(activeId, true) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </div>
      )}

      {/* Disable big static summary */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="col-span-2">{renderNotesTab()}</div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="col-span-2">{renderHistoryTab()}</div>
          )}

          {/* Modify Tab */}
          {activeTab === "modify" && (
            <div className="col-span-2">{renderModifyTab()}</div>
          )}

          {/* Placeholder for other tabs */}
          {activeTab === "docs" && (
            <div className="col-span-2">{renderDocsTab()}</div>
          )}

          {activeTab === "active-applicants" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">
                  Active Applicants
                </h2>
                <p className="text-gray-500 italic">No active applicants</p>
              </div>
            </div>
          )}

          {activeTab === "opportunities" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
                <p className="text-gray-500 italic">
                  No opportunities available
                </p>
              </div>
            </div>
          )}

          {activeTab === "quotes" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Quotes</h2>
                {isLoadingDocuments ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : documentError ? (
                  <p className="text-red-500 py-2">{documentError}</p>
                ) : (() => {
                  const quoteDocs = (documents || []).filter(
                    (d: any) => (d.document_type || "").toLowerCase() === "quote"
                  );
                  return quoteDocs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100 border-b">
                            <th className="text-left p-3 font-medium">Actions</th>
                            <th className="text-left p-3 font-medium">Document Name</th>
                            <th className="text-left p-3 font-medium">Created By</th>
                            <th className="text-left p-3 font-medium">Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quoteDocs.map((doc: any) => (
                            <tr key={doc.id} className="border-b hover:bg-gray-50">
                              <td className="p-3">
                                <ActionDropdown
                                  label="Actions"
                                  options={[
                                    { label: "View", action: () => setSelectedDocument(doc) },
                                    { label: "Download", action: () => handleDownloadDocument(doc) },
                                    { label: "Delete", action: () => handleDeleteDocument(doc.id) },
                                  ]}
                                />
                              </td>
                              <td className="p-3">
                                <button
                                  onClick={() => setSelectedDocument(doc)}
                                  className="text-blue-600 hover:underline font-medium"
                                >
                                  {doc.document_name || "Unnamed"}
                                </button>
                              </td>
                              <td className="p-3">{doc.created_by_name || "—"}</td>
                              <td className="p-3">
                                {doc.created_at
                                  ? new Date(doc.created_at).toLocaleString()
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No quotes available. Upload quotes from Admin Center → Document Management → Quotes.</p>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Document Viewer Modal (shared by Docs and Quotes tabs) */}
          {selectedDocument && (
            <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] flex flex-col">
                <div className="bg-gray-100 p-4 border-b flex justify-between items-center shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedDocument.document_name}</h2>
                    <p className="text-sm text-gray-600">Type: {selectedDocument.document_type}</p>
                  </div>
                  <button onClick={() => setSelectedDocument(null)} className="p-1 rounded hover:bg-gray-200">
                    <span className="text-2xl font-bold">×</span>
                  </button>
                </div>
                <div className="p-4 flex-1 min-h-0 flex flex-col">
                  <div className="mb-2">
                    <p className="text-sm text-gray-600">
                      Created by {selectedDocument.created_by_name || "System"} on{" "}
                      {new Date(selectedDocument.created_at).toLocaleString()}
                    </p>
                  </div>
                  {selectedDocument.file_path ? (
                    <div className="overflow-y-auto flex-1 min-h-[60vh] flex flex-col">
                      <DocumentViewer
                        filePath={selectedDocument.file_path}
                        mimeType={selectedDocument.mime_type}
                        documentName={selectedDocument.document_name}
                        className="flex-1"
                        onOpenInNewTab={() =>
                          window.open(selectedDocument.file_path, "_blank")
                        }
                      />
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded border whitespace-pre-wrap overflow-y-auto">
                      {selectedDocument.content || "No content available"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Invoices</h2>
                <p className="text-gray-500 italic">No invoices available</p>
              </div>
            </div>
          )}
        </div>
      </div >

      {/* Edit Fields Modal - details and organizationDetails use SortableFieldsEditModal */}
      {editingPanel === "details" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Hiring Manager Details"
          description="Drag to reorder, check/uncheck to show or hide fields."
          order={modalDetailsOrder}
          visible={modalDetailsVisible}
          fieldCatalog={detailsFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={(key) =>
            setModalDetailsVisible((prev) => ({ ...prev, [key]: !prev[key] }))
          }
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            setModalDetailsOrder((prev) => {
              const oldIndex = prev.indexOf(active.id as string);
              const newIndex = prev.indexOf(over.id as string);
              if (oldIndex === -1 || newIndex === -1) return prev;
              return arrayMove(prev, oldIndex, newIndex);
            });
          }}
          onSave={handleSaveDetailsFields}
          saveButtonText="Save"
          listMaxHeight="60vh"
        />
      )}
      {editingPanel === "organizationDetails" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Organization Details"
          description="Drag to reorder, check/uncheck to show or hide fields."
          order={modalOrganizationDetailsOrder}
          visible={modalOrganizationDetailsVisible}
          fieldCatalog={organizationDetailsFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={(key) =>
            setModalOrganizationDetailsVisible((prev) => ({ ...prev, [key]: !prev[key] }))
          }
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            setModalOrganizationDetailsOrder((prev) => {
              const oldIndex = prev.indexOf(active.id as string);
              const newIndex = prev.indexOf(over.id as string);
              if (oldIndex === -1 || newIndex === -1) return prev;
              return arrayMove(prev, oldIndex, newIndex);
            });
          }}
          onSave={handleSaveOrganizationDetailsFields}
          saveButtonText="Save"
          listMaxHeight="60vh"
        />
      )}
      {editingPanel && editingPanel !== "details" && editingPanel !== "organizationDetails" && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Edit Fields - {editingPanel}</h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              <>
                  <div className="mb-4">
                    <h3 className="font-medium mb-3">
                      Available Fields from Modify Page:
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                      {isLoadingFields ? (
                        <div className="text-center py-4 text-gray-500">
                          Loading fields...
                        </div>
                      ) : (() => {
                        const visibleAvailableFields = availableFields.filter((field) => {
                          const isHidden = field.is_hidden === true || field.hidden === true || field.isHidden === true;
                          return !isHidden;
                        });

                        return visibleAvailableFields.length > 0 ? (
                          visibleAvailableFields.map((field) => {
                            const fieldKey =
                              field.field_name || field.field_label || field.id;
                            const isVisible =
                              visibleFields[editingPanel]?.includes(fieldKey) ||
                              false;
                            return (
                              <div
                                key={field.id || fieldKey}
                                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={() =>
                                      toggleFieldVisibility(editingPanel, fieldKey)
                                    }
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <label className="text-sm text-gray-700">
                                    {field.field_label ||
                                      field.field_name ||
                                      fieldKey}
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
                        const standardFieldsMap: Record<
                          string,
                          Array<{ key: string; label: string }>
                        > = {
                          recentNotes: [{ key: "notes", label: "Notes" }],
                        };

                        const fields = standardFieldsMap[editingPanel] || [];
                        return fields.map((field) => {
                          const isVisible =
                            visibleFields[editingPanel]?.includes(field.key) ||
                            false;
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
                                <label className="text-sm text-gray-700">
                                  {field.label}
                                </label>
                              </div>
                              <span className="text-xs text-gray-500">
                                standard
                              </span>
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
            </div>
          </div>
        </div>
      )}

      {/* Add Appointment Modal */}
      {
        showAppointmentModal && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Create Calendar Appointment</h2>
                <button
                  onClick={() => {
                    setShowAppointmentModal(false);
                    setAppointmentForm({
                      date: "",
                      time: "",
                      type: "",
                      description: "",
                      location: "",
                      duration: 30,
                      attendees: [],
                      sendInvites: true,
                    });
                  }}
                  className="p-1 rounded hover:bg-gray-200"
                >
                  <span className="text-2xl font-bold">×</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={appointmentForm.date}
                    onChange={(e) =>
                      setAppointmentForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={appointmentForm.time}
                    onChange={(e) =>
                      setAppointmentForm((prev) => ({ ...prev, time: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={appointmentForm.duration}
                    onChange={(e) =>
                      setAppointmentForm((prev) => ({ ...prev, duration: parseInt(e.target.value) || 30 }))
                    }
                    min="15"
                    step="15"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Appointment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={appointmentForm.type}
                    onChange={(e) =>
                      setAppointmentForm((prev) => ({ ...prev, type: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select type</option>
                    <option value="zoom">Zoom Meeting</option>
                    <option value="Interview">Interview</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={appointmentForm.description}
                    onChange={(e) =>
                      setAppointmentForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={4}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter appointment description..."
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={appointmentForm.location}
                    onChange={(e) =>
                      setAppointmentForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter location or video link..."
                  />
                </div>

                {/* Attendees */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Attendees (will receive calendar invite)
                  </label>
                  {isLoadingAppointmentUsers ? (
                    <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                      Loading users...
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500">
                      <div className="max-h-48 overflow-y-auto p-2">
                        {appointmentUsers.length === 0 ? (
                          <div className="text-gray-500 text-sm p-2">
                            No users available
                          </div>
                        ) : (
                          appointmentUsers.map((user) => (
                            <label
                              key={user.id}
                              className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                            >
                              <input
                                type="checkbox"
                                checked={appointmentForm.attendees.includes(user.email || user.id)}
                                onChange={(e) => {
                                  const email = user.email || user.id;
                                  if (e.target.checked) {
                                    setAppointmentForm((prev) => ({
                                      ...prev,
                                      attendees: [...prev.attendees, email],
                                    }));
                                  } else {
                                    setAppointmentForm((prev) => ({
                                      ...prev,
                                      attendees: prev.attendees.filter((a) => a !== email),
                                    }));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                              />
                              <span className="text-sm text-gray-700">
                                {user.name || user.email || `User #${user.id}`}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      {appointmentForm.attendees.length > 0 && (
                        <div className="border-t border-gray-300 p-2 bg-gray-50">
                          <div className="text-xs text-gray-600 mb-1">
                            Selected: {appointmentForm.attendees.length} attendee(s)
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {appointmentForm.attendees.map((email) => (
                              <span
                                key={email}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                              >
                                {email}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAppointmentForm((prev) => ({
                                      ...prev,
                                      attendees: prev.attendees.filter((a) => a !== email),
                                    }));
                                  }}
                                  className="ml-1 text-blue-600 hover:text-blue-800"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Send Invites Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={appointmentForm.sendInvites}
                    onChange={(e) =>
                      setAppointmentForm((prev) => ({ ...prev, sendInvites: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm text-gray-700">
                    Send calendar invites to attendees
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 p-4 border-t">
                <button
                  onClick={() => {
                    setShowAppointmentModal(false);
                    setAppointmentForm({
                      date: "",
                      time: "",
                      type: "",
                      description: "",
                      location: "",
                      duration: 30,
                      attendees: [],
                      sendInvites: true,
                    });
                  }}
                  className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                  disabled={isSavingAppointment}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAppointmentSubmit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={
                    isSavingAppointment ||
                    !appointmentForm.date ||
                    !appointmentForm.time ||
                    !appointmentForm.type
                  }
                >
                  {isSavingAppointment ? "Creating..." : "Create Appointment"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      <AddTearsheetModal
        open={showAddTearsheetModal}
        onClose={() => setShowAddTearsheetModal(false)}
        entityType="hiring_manager"
        entityId={hiringManagerId || ""}
      />

      {/* Transfer Modal */}
      {
        showTransferModal && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Transfer Hiring Manager</h2>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferForm({ targetHiringManagerId: "" });
                    setTransferSearchQuery("");
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <span className="text-2xl font-bold">x</span>
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-6">
                {/* Source Hiring Manager Info */}
                <div className="bg-gray-50 p-4 rounded">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Hiring Manager
                  </label>
                  <p className="text-sm text-gray-900 font-medium">
                    {hiringManager
                      ? `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`
                      : "N/A"}
                  </p>
                </div>

                {/* Target Hiring Manager Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500 mr-1">•</span>
                    Select Target Hiring Manager
                  </label>
                  {isLoadingTransferTargets ? (
                    <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                      Loading hiring managers...
                    </div>
                  ) : availableHiringManagersForTransfer.length === 0 ? (
                    <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                      No available hiring managers found
                    </div>
                  ) : (
                    <div className="relative" ref={transferSearchRef}>
                      <input
                        type="text"
                        value={transferSearchQuery}
                        onChange={(e) => {
                          setTransferSearchQuery(e.target.value);
                          setShowTransferDropdown(true);
                        }}
                        onFocus={() => setShowTransferDropdown(true)}
                        onClick={() => setShowTransferDropdown(true)}
                        placeholder="Search by name or Record ID..."
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      {showTransferDropdown && (transferSearchQuery || availableHiringManagersForTransfer.length > 0) && (
                        <div className="absolute z-60 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                          {filteredTransferHiringManagers.length > 0 ? (
                            filteredTransferHiringManagers.map((hm: any) => {
                              const displayName = hm?.full_name || `${hm?.last_name || ""}, ${hm?.first_name || ""}`.trim() || "Unnamed";
                              return (
                                <button
                                  key={hm.id}
                                  type="button"
                                  onClick={() => {
                                    setTransferForm((prev) => ({
                                      ...prev,
                                      targetHiringManagerId: String(hm.id),
                                    }));
                                    setTransferSearchQuery(`${formatRecordId(hm.id, "hiringManager")} ${displayName}`.trim());
                                    setShowTransferDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex flex-col"
                                >
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatRecordId(hm.id, "hiringManager")} {displayName}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="p-3 text-center text-gray-500 text-sm">
                              No matching hiring managers found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This will create a transfer request. This hiring manager&apos;s notes, documents, tasks, and jobs will move to the target hiring manager, and this record will be archived. Payroll will be notified via email and must approve or deny the transfer.
                  </p>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferForm({ targetHiringManagerId: "" });
                    setTransferSearchQuery("");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmittingTransfer}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleTransferSubmit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                  disabled={isSubmittingTransfer || !transferForm.targetHiringManagerId}
                >
                  {isSubmittingTransfer ? "SUBMITTING..." : "SUBMIT TRANSFER"}
                  {!isSubmittingTransfer && (
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
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Unarchive Request Modal */}
      <RequestActionModal
        open={showUnarchiveModal}
        onClose={() => {
          setShowUnarchiveModal(false);
          setUnarchiveReason("");
        }}
        modelType="unarchive"
        entityLabel="Hiring Manager"
        recordDisplay={
          hiringManager
            ? `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName || ""}`.trim()
            : formatRecordId(hiringManagerId ?? "", "hiringManager")
        }
        reason={unarchiveReason}
        onReasonChange={setUnarchiveReason}
        onSubmit={handleUnarchiveSubmit}
        isSubmitting={isSubmittingUnarchive}
      />

      {/* Delete Modal */}
      {
        showDeleteModal && (
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
                {/* Delete Reason */}
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
                    placeholder="Please provide a detailed reason for deleting this hiring manager..."
                    className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${!deleteForm.reason.trim()
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

                {/* Pending Request Status */}
                {pendingDeleteRequest && pendingDeleteRequest.status === "pending" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Pending Request:</strong> A delete request is already pending approval. You cannot submit another request until this one is resolved.
                    </p>
                  </div>
                )}
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
                  disabled={isSubmittingDelete || !deleteForm.reason.trim() || (pendingDeleteRequest && pendingDeleteRequest.status === "pending")}
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Password Reset Modal */}
      {
        showPasswordResetModal && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Password Reset</h2>
                <button
                  onClick={() => {
                    setShowPasswordResetModal(false);
                    setPasswordResetForm({ email: "", sendEmail: true });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <span className="text-2xl font-bold">×</span>
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-6">
                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500 mr-1">•</span>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={passwordResetForm.email}
                    onChange={(e) =>
                      setPasswordResetForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="Enter email address for password reset"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Send Email Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={passwordResetForm.sendEmail}
                    onChange={(e) =>
                      setPasswordResetForm((prev) => ({
                        ...prev,
                        sendEmail: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm text-gray-700">
                    Send password reset email to the user
                  </label>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> A new password will be generated and sent to the email address provided if "Send email" is checked.
                  </p>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowPasswordResetModal(false);
                    setPasswordResetForm({ email: "", sendEmail: true });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmittingPasswordReset}
                >
                  CANCEL
                </button>
                <button
                  onClick={handlePasswordReset}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                  disabled={isSubmittingPasswordReset || !passwordResetForm.email.trim()}
                >
                  {isSubmittingPasswordReset ? "PROCESSING..." : "RESET PASSWORD"}
                  {!isSubmittingPasswordReset && (
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
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Note Modal */}
      {
        showAddNote && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                                <FiUserCheck className="w-4 h-4 text-gray-500 shrink-0" />
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
                              <HiOutlineUser className="w-4 h-4 shrink-0" />
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
                                <HiOutlineUser className="w-4 h-4 text-gray-500 shrink-0" />
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
                    onClick={handleCloseAddNoteModal}
                    className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 font-medium"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleAddNote}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={!noteForm.text.trim() || !noteForm.action || noteForm.aboutReferences.length === 0}
                  >
                    SAVE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* Header Fields Modal - uses universal SortableFieldsEditModal */}
      {showHeaderFieldModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowHeaderFieldModal(false)}
          title="Customize Header Fields"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all hiring manager records."
          order={headerFieldsOrder.length > 0 ? headerFieldsOrder : headerFieldCatalog.map((f) => f.key)}
          visible={Object.fromEntries(headerFieldCatalog.map((f) => [f.key, headerFields.includes(f.key)]))}
          fieldCatalog={headerFieldCatalog.map((f) => ({ key: f.key, label: f.label ?? getHeaderFieldLabel(f.key) }))}
          onToggle={(key) => {
            if (headerFields.includes(key)) {
              setHeaderFields((prev) => prev.filter((x) => x !== key));
            } else {
              setHeaderFields((prev) => [...prev, key]);
              if (!headerFieldsOrder.includes(key)) {
                setHeaderFieldsOrder((prev) => [...prev, key]);
              }
            }
          }}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            setHeaderFieldsOrder((prev) => {
              const oldIndex = prev.indexOf(active.id as string);
              const newIndex = prev.indexOf(over.id as string);
              if (oldIndex === -1 || newIndex === -1) return prev;
              return arrayMove(prev, oldIndex, newIndex);
            });
            setHeaderFields((prev) => {
              const oldIndex = prev.indexOf(active.id as string);
              const newIndex = prev.indexOf(over.id as string);
              if (oldIndex === -1 || newIndex === -1) return prev;
              return arrayMove(prev, oldIndex, newIndex);
            });
          }}
          onSave={async () => {
            const success = await saveHeaderConfig();
            if (success) setShowHeaderFieldModal(false);
          }}
          saveButtonText={isSavingHeaderConfig ? "Saving..." : "Done"}
          isSaveDisabled={headerFields.length === 0 || !!isSavingHeaderConfig}
          onReset={() => {
            setHeaderFields(HIRING_MANAGER_DEFAULT_HEADER_FIELDS);
            setHeaderFieldsOrder(HIRING_MANAGER_DEFAULT_HEADER_FIELDS);
          }}
          resetButtonText="Reset"
          listMaxHeight="50vh"
        />
      )}

      <ConfirmFileDetailsModal
        isOpen={showFileDetailsModal && pendingFiles.length > 0}
        onClose={() => { setShowFileDetailsModal(false); setPendingFiles([]); }}
        onConfirm={() => handleConfirmFileDetails()}
        fileName={fileDetailsName}
        fileType={fileDetailsType}
        onFileNameChange={setFileDetailsName}
        onFileTypeChange={setFileDetailsType}
        pendingFiles={pendingFiles}
        documentTypeOptions={[
          { value: "Contract", label: "Contract" },
          { value: "Invoice", label: "Invoice" },
          { value: "Report", label: "Report" },
          { value: "ID", label: "ID" },
          { value: "General", label: "General" },
        ]}
        confirmButtonText="Save & Upload"
        zIndex={100}
      />
    </div >
  );
}