"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import LoadingScreen from "@/components/LoadingScreen";
import PanelWithHeader from "@/components/PanelWithHeader";
import { sendEmailViaOffice365, isOffice365Authenticated, initializeOffice365Auth, sendCalendarInvite, type EmailMessage, type CalendarEvent } from "@/lib/office365";
import { FiUsers, FiUpload, FiFile, FiX, FiLock, FiUnlock, FiArrowUp, FiArrowDown, FiFilter, FiSearch } from "react-icons/fi";
import { HiOutlineUser } from "react-icons/hi";
import { BsFillPinAngleFill } from "react-icons/bs";
import { TbGripVertical } from "react-icons/tb";
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import OnboardingTab from "./onboarding/OnboardingTab";
import RecordNameResolver from '@/components/RecordNameResolver';
import FieldValueRenderer from '@/components/FieldValueRenderer';
import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";
import ConfirmFileDetailsModal from "@/components/ConfirmFileDetailsModal";
import DocumentViewer from "@/components/DocumentViewer";
import HistoryTabFilters, { useHistoryFilters } from "@/components/HistoryTabFilters";
import { toast } from "sonner";
import AddTearsheetModal from "@/components/AddTearsheetModal";
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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

// Sortable row for Job Seeker Details edit modal (vertical drag + checkbox + label)
function SortableJobSeekerDetailsFieldRow({
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

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

// Sortable Column Header Component for Documents
function SortableColumnHeader({
  id,
  columnKey,
  label,
  sortState,
  filterValue,
  onSort,
  onFilterChange,
  filterType,
  filterOptions,
}: {
  id: string;
  columnKey: string;
  label: string;
  sortState: ColumnSortState;
  filterValue: ColumnFilterState;
  onSort: () => void;
  onFilterChange: (value: string) => void;
  filterType: "text" | "select" | "number";
  filterOptions?: { label: string; value: string }[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const thRef = useRef<HTMLTableCellElement | null>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!showFilter || !filterToggleRef.current || !thRef.current) {
      setFilterPosition(null);
      return;
    }
    const btnRect = filterToggleRef.current.getBoundingClientRect();
    const thRect = thRef.current.getBoundingClientRect();
    setFilterPosition({ top: btnRect.bottom + 4, left: thRect.left, width: Math.max(150, Math.min(250, thRect.width)) });
  }, [showFilter]);

  // Close filter on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(`[data-filter-toggle="${id}"]`)
      ) {
        setShowFilter(false);
      }
    };

    if (showFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilter, id]);

  return (
    <th
      ref={(node) => { thRef.current = node; setNodeRef(node); }}
      style={style}
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-r border-gray-200 relative group"
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={16} />
        </button>

        {/* Column Label */}
        <span className="flex-1">{label}</span>

        {/* Sort Control */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSort();
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title={sortState === "asc" ? "Sort descending" : "Sort ascending"}
        >
          {sortState === "asc" ? (
            <FiArrowUp size={14} />
          ) : (
            <FiArrowDown size={14} />
          )}
        </button>

        {/* Filter Toggle */}
        <button
          ref={filterToggleRef}
          data-filter-toggle={id}
          onClick={(e) => {
            e.stopPropagation();
            setShowFilter(!showFilter);
          }}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${filterValue ? "text-blue-600" : ""
            }`}
          title="Filter column"
        >
          <FiFilter size={14} />
        </button>
      </div>

      {/* Filter Dropdown (portal) */}
      {showFilter && filterPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={filterRef}
          className="bg-white border border-gray-300 shadow-lg rounded p-2 z-[100] min-w-[150px]"
          style={{ position: "fixed", top: filterPosition.top, left: filterPosition.left, width: filterPosition.width }}
          onClick={(e) => e.stopPropagation()}
        >
          {filterType === "text" && (
            <input
              type="text"
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}...`}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          )}
          {filterType === "number" && (
            <input
              type="number"
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}...`}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          )}
          {filterType === "select" && filterOptions && (
            <select
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            >
              <option value="">All</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          {filterValue && (
            <button
              onClick={() => {
                onFilterChange("");
                setShowFilter(false);
              }}
              className="mt-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Clear Filter
            </button>
          )}
        </div>,
        document.body
      )}
    </th>
  );
}

// Sortable Panel Component with drag handle
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

// Storage keys for Job Seeker Details and Overview – field lists come from admin (custom field definitions)
const JOB_SEEKER_DETAILS_STORAGE_KEY = "jobSeekersJobSeekerDetailsFields";
const OVERVIEW_STORAGE_KEY = "jobSeekersOverviewFields";

const JOBSEEKER_VIEW_TAB_IDS = ["summary", "modify", "history", "notes", "docs", "references", "applications", "onboarding"];

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
  additionalReferences: string;
  scheduleNextAction: string;
  emailNotification: string[];
}

export default function JobSeekerView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobSeekerId = searchParams.get("id");
  const tabFromUrl = searchParams.get("tab");

  const [activeTab, setActiveTabState] = useState(() =>
    tabFromUrl && JOBSEEKER_VIEW_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "summary"
  );

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "summary") params.delete("tab");
    else params.set("tab", tabId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (tabFromUrl && JOBSEEKER_VIEW_TAB_IDS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    } else if (!tabFromUrl && activeTab !== "summary") {
      setActiveTabState("summary");
    }
  }, [tabFromUrl]);
  const [activeQuickTab, setActiveQuickTab] = useState("prescreen");

  const [applications, setApplications] = useState<any[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [applicationsView, setApplicationsView] = useState<
    "web_submissions" | "submissions" | "client_submissions"
  >("web_submissions");

  const fetchApplications = async (id: string) => {
    setIsLoadingApplications(true);
    setApplicationsError(null);

    try {
      const response = await fetch(`/api/job-seekers/${id}/applications`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch applications");
      }

      setApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch (err) {
      setApplications([]);
      setApplicationsError(
        err instanceof Error
          ? err.message
          : "An error occurred while loading applications"
      );
    } finally {
      setIsLoadingApplications(false);
    }
  };

  // Add states for job seeker data
  const [jobSeeker, setJobSeeker] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // Notes and history state
  const [notes, setNotes] = useState<Array<any>>([]);
  const [history, setHistory] = useState<Array<any>>([]);

  // Note filtering/sorting state
  const [noteActionFilter, setNoteActionFilter] = useState("");
  const [noteAuthorFilter, setNoteAuthorFilter] = useState("");
  const [noteSortKey, setNoteSortKey] = useState<"date" | "action" | "author">("date");
  const [noteSortDir, setNoteSortDir] = useState<"asc" | "desc">("desc");

  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyFilters = useHistoryFilters(history);
  const [showAddNote, setShowAddNote] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Add Note form state
  const [noteForm, setNoteForm] = useState<NoteFormState>({
    text: "",
    action: "",
    about: jobSeeker
      ? `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.fullName}`
      : "",
    aboutReferences: jobSeeker
      ? [
        {
          id: jobSeeker.id,
          type: "Job Seeker",
          display: `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.fullName}`,
          value: formatRecordId(jobSeeker.id, "jobSeeker"),
        },
      ]
      : [],
    copyNote: "No",
    replaceGeneralContactComments: false,
    additionalReferences: "",
    scheduleNextAction: "None",
    emailNotification: [],
  });

  // Validation state
  const [validationErrors, setValidationErrors] = useState<{
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

  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isOffice365Connected, setIsOffice365Connected] = useState(false);

  // Action fields state (for dynamic dropdown options)
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

  // Field management – overview and jobSeekerDetails driven from admin field definitions only
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") {
      return { resume: ["profile", "skills", "experience"], overview: [], jobSeekerDetails: [] };
    }
    let overview: string[] = [];
    let jobSeekerDetails: string[] = [];
    try {
      const o = localStorage.getItem(OVERVIEW_STORAGE_KEY);
      if (o) {
        const parsed = JSON.parse(o);
        if (Array.isArray(parsed) && parsed.length > 0) overview = Array.from(new Set(parsed));
      }
    } catch (_) { }
    try {
      const d = localStorage.getItem(JOB_SEEKER_DETAILS_STORAGE_KEY);
      if (d) {
        const parsed = JSON.parse(d);
        if (Array.isArray(parsed) && parsed.length > 0) jobSeekerDetails = Array.from(new Set(parsed));
      }
    } catch (_) { }
    return { resume: ["profile", "skills", "experience"], overview, jobSeekerDetails };
  });

  // ===== Summary layout state =====
  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["resume", "jobSeekerDetails"],
    right: ["overview", "recentNotes", "openTasks"],
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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


  const DEFAULT_HEADER_FIELDS = [
    "phone",
    "email",
    "status",
    "currentOrganization",
    "title",
  ];

  const {
    headerFields,
    setHeaderFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    saveHeaderConfig,
  } = useHeaderConfig({
    entityType: "JOB_SEEKER",
    configType: "header",
    defaultFields: DEFAULT_HEADER_FIELDS,
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
  }), [])

  const [headerFieldsDragActiveId, setHeaderFieldsDragActiveId] = useState<string | null>(null);
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

  const getHeaderFieldValue = (key: string): string => {
    if (!jobSeeker) return "-";
    const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;
    const j = jobSeeker as any;
    let v = j[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    v = jobSeeker.customFields?.[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    const field = headerFieldCatalog.find((f) => f.key === key);
    if (field) v = jobSeeker.customFields?.[field.label];
    return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
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

  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  // Job Seeker Details edit modal: order and visibility (synced when modal opens)
  const [modalJobSeekerDetailsOrder, setModalJobSeekerDetailsOrder] = useState<string[]>([]);
  const [modalJobSeekerDetailsVisible, setModalJobSeekerDetailsVisible] = useState<Record<string, boolean>>({});
  const [jobSeekerDetailsDragActiveId, setJobSeekerDetailsDragActiveId] = useState<string | null>(null);

  // Overview edit modal: order and visibility (synced when modal opens)
  const [modalOverviewOrder, setModalOverviewOrder] = useState<string[]>([]);
  const [modalOverviewVisible, setModalOverviewVisible] = useState<Record<string, boolean>>({});
  const [overviewDragActiveId, setOverviewDragActiveId] = useState<string | null>(null);

  const [isResumeEditorOpen, setIsResumeEditorOpen] = useState(false);
  const [resumeDraft, setResumeDraft] = useState("");
  const [isSavingResume, setIsSavingResume] = useState(false);
  const [resumeSaveError, setResumeSaveError] = useState<string | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  // Document table columns state
  const DOCUMENT_DEFAULT_COLUMNS = ["document_name", "document_type", "created_by_name", "created_at"];
  const [documentColumnFields, setDocumentColumnFields] = useState<string[]>(DOCUMENT_DEFAULT_COLUMNS);
  const [documentColumnSorts, setDocumentColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [documentColumnFilters, setDocumentColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  // Document columns catalog (Docs tab table)
  const documentColumnsCatalog = useMemo(() => {
    return [
      { key: "document_name", label: "Document Name", sortable: true, filterType: "text" as const },
      { key: "document_type", label: "Type", sortable: true, filterType: "select" as const },
      { key: "created_by_name", label: "Created By", sortable: true, filterType: "text" as const },
      { key: "created_at", label: "Created At", sortable: true, filterType: "text" as const },
    ];
  }, []);

  const getDocumentColumnLabel = (key: string) =>
    documentColumnsCatalog.find((c) => c.key === key)?.label || key;

  const getDocumentColumnInfo = (key: string) =>
    documentColumnsCatalog.find((c) => c.key === key);

  const getDocumentColumnValue = (doc: any, key: string) => {
    switch (key) {
      case "document_name":
        return doc.document_name || doc.name || "Untitled Document";
      case "document_type":
        return doc.document_type || doc.type || "General";
      case "created_by_name":
        return doc.created_by_name || "System";
      case "created_at":
        return doc.created_at ? new Date(doc.created_at).toLocaleString() : "N/A";
      default:
        return "—";
    }
  };

  // Get unique document types for filter dropdown
  const documentTypeOptions = useMemo(() => {
    const types = new Set<string>();
    documents.forEach((doc) => {
      const type = doc.document_type || doc.type;
      if (type) types.add(type);
    });
    return Array.from(types).map((t) => ({ label: t, value: t }));
  }, [documents]);

  // Filtered and sorted documents
  const filteredAndSortedDocuments = useMemo(() => {
    let result = [...documents];

    // Apply filters
    Object.entries(documentColumnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((doc) => {
        const value = getDocumentColumnValue(doc, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        // For select filters, do exact match
        const columnInfo = getDocumentColumnInfo(columnKey);
        if (columnInfo?.filterType === "select") {
          return valueStr === filterStr;
        }

        // For text columns, do contains match
        return valueStr.includes(filterStr);
      });
    });

    // Apply sorting
    const activeSorts = Object.entries(documentColumnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
      const [sortKey, sortDir] = activeSorts[0];
      result.sort((a, b) => {
        let aValue: any = getDocumentColumnValue(a, sortKey);
        let bValue: any = getDocumentColumnValue(b, sortKey);

        // Handle dates properly
        if (sortKey === "created_at") {
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
        }

        const aNum = typeof aValue === "number" ? aValue : Number(aValue);
        const bNum = typeof bValue === "number" ? bValue : Number(bValue);

        let cmp = 0;
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          cmp = aNum - bNum;
        } else {
          cmp = String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }

        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [documents, documentColumnFilters, documentColumnSorts]);

  // Handle document column sort toggle
  const handleDocumentColumnSort = (columnKey: string) => {
    setDocumentColumnSorts((prev) => {
      const current = prev[columnKey];
      if (current === "asc") {
        return { ...prev, [columnKey]: "desc" };
      } else if (current === "desc") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      } else {
        return { ...prev, [columnKey]: "asc" };
      }
    });
  };

  // Handle document column filter change
  const handleDocumentColumnFilter = (columnKey: string, value: string) => {
    setDocumentColumnFilters((prev) => {
      if (!value || value.trim() === "") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: value };
    });
  };

  // Handle document column drag end
  const handleDocumentColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = documentColumnFields.indexOf(active.id as string);
    const newIndex = documentColumnFields.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(documentColumnFields, oldIndex, newIndex);
      setDocumentColumnFields(newOrder);
    }
  };
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [fileDetailsName, setFileDetailsName] = useState("");
  const [fileDetailsType, setFileDetailsType] = useState("General");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document editing state
  const [editingDocument, setEditingDocument] = useState<any | null>(null);
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [editDocumentName, setEditDocumentName] = useState("");
  const [editDocumentType, setEditDocumentType] = useState("General");

  // Add text document state
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newDocumentType, setNewDocumentType] = useState("General");
  const [newDocumentContent, setNewDocumentContent] = useState("");

  // Document viewer state
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);

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

  // Delete request modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteFromUrl = searchParams.get("delete");
  const [deleteForm, setDeleteForm] = useState({ reason: "" });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<any>(null);
  const [isLoadingDeleteRequest, setIsLoadingDeleteRequest] = useState(false);

  // Transfer modal state (target = another Job Seeker; notes, docs, tasks, placements, applications move to target; source archived)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ targetJobSeekerId: "" });
  const [transferSearchQuery, setTransferSearchQuery] = useState("");
  const [showTransferDropdown, setShowTransferDropdown] = useState(false);
  const transferSearchRef = useRef<HTMLDivElement>(null);
  const [availableJobSeekersForTransfer, setAvailableJobSeekersForTransfer] = useState<any[]>([]);
  const [isLoadingTransferTargets, setIsLoadingTransferTargets] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Onboarding send modal state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Record<string, boolean>>({});
  const onboardingDocs = [
    {
      id: "w4",
      name: "W-4 (Employee's Withholding Certificate)",
      url: "/docs/onboarding/W-4.pdf",
    },
    {
      id: "i9",
      name: "I-9 (Employment Eligibility Verification)",
      url: "/docs/onboarding/I-9.pdf",
    },
    {
      id: "dd",
      name: "Direct Deposit Authorization",
      url: "/docs/onboarding/Direct-Deposit.pdf",
    },
    {
      id: "policy",
      name: "Company Policies Acknowledgement",
      url: "/docs/onboarding/Policies.pdf",
    },
  ];

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendOnboarding = async () => {
    if (!jobSeeker?.email) {
      toast.error("Job seeker email is missing");
      return;
    }

    const chosen = onboardingDocs.filter((d) => selectedDocs[d.id]);
    const subject = "Onboarding Documents";
    const links =
      chosen.length > 0
        ? "\n\nDocuments:\n" +
        chosen
          .map((d) => `- ${d.name}: ${window.location.origin}${d.url}`)
          .join("\n")
        : "";
    const body =
      "Here are your onboarding documents. Please fill these out and return promptly." +
      links;

    // Use Office 365 if connected, otherwise use mailto
    if (isOffice365Connected) {
      try {
        const emailMessage: EmailMessage = {
          to: [jobSeeker.email],
          subject: subject,
          body: body,
          bodyType: "text",
        };
        await sendEmailViaOffice365(emailMessage);
        toast.success("Onboarding documents sent successfully via Office 365!");
        setShowOnboardingModal(false);
        setSelectedDocs({});
      } catch (error: any) {
        toast.warning(
          `Failed to send via Office 365: ${error.message}. Falling back to mailto.`
        );
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);
        window.location.href = `mailto:${jobSeeker.email}?subject=${encodedSubject}&body=${encodedBody}`;
        setShowOnboardingModal(false);
        setSelectedDocs({});
      }
    } else {
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      window.location.href = `mailto:${jobSeeker.email}?subject=${encodedSubject}&body=${encodedBody}`;
      setShowOnboardingModal(false);
      setSelectedDocs({});
    }
  };

  // Reference form send modal state
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [selectedReferenceDocs, setSelectedReferenceDocs] = useState<
    Record<string, boolean>
  >({});
  const [referenceEmail, setReferenceEmail] = useState("");

  // Saved references state
  const [references, setReferences] = useState<any[]>([]);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [referencesError, setReferencesError] = useState<string | null>(null);

  // Add Reference modal state
  const [showAddReferenceModal, setShowAddReferenceModal] = useState(false);
  const [addReferenceMode, setAddReferenceMode] = useState<
    "onboarding" | "manual"
  >("onboarding");
  const [selectedOnboardingReferenceIndex, setSelectedOnboardingReferenceIndex] =
    useState<string>("");
  const [manualReferenceForm, setManualReferenceForm] = useState({
    name: "",
    role: "",
    company: "",
    email: "",
    phone: "",
    relationship: "",
  });
  const referenceDocs = [
    {
      id: "reference-form",
      name: "Reference Request Form",
      url: "/docs/references/Reference-Form.pdf",
    },
    {
      id: "background-check",
      name: "Background Check Authorization",
      url: "/docs/references/Background-Check.pdf",
    },
    {
      id: "employment-verification",
      name: "Employment Verification Form",
      url: "/docs/references/Employment-Verification.pdf",
    },
  ];

  const toggleReferenceDoc = (id: string) => {
    setSelectedReferenceDocs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendReferenceForm = async () => {
    if (!referenceEmail || !referenceEmail.trim()) {
      toast.error("Please enter a reference email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(referenceEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    const chosen = referenceDocs.filter((d) => selectedReferenceDocs[d.id]);
    const subject = "Reference Request";
    const links =
      chosen.length > 0
        ? "\n\nPlease review and complete the following documents:\n" +
        chosen
          .map((d) => `- ${d.name}: ${window.location.origin}${d.url}`)
          .join("\n")
        : "";
    const body = `Dear Reference,

We are requesting a reference for ${jobSeeker?.fullName || "a candidate"
      }. Please review and complete the attached reference documents at your earliest convenience.${links}

Thank you for your time and assistance.

Best regards`;

    // Use Office 365 if connected, otherwise use mailto
    if (isOffice365Connected) {
      try {
        const emailMessage: EmailMessage = {
          to: [referenceEmail.trim()],
          subject: subject,
          body: body,
          bodyType: "text",
        };
        await sendEmailViaOffice365(emailMessage);
        toast.success("Reference form sent successfully via Office 365!");
        setShowReferenceModal(false);
        setReferenceEmail("");
        setSelectedReferenceDocs({});
      } catch (error: any) {
        toast.warning(
          `Failed to send via Office 365: ${error.message}. Falling back to mailto.`
        );
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);
        window.location.href = `mailto:${referenceEmail.trim()}?subject=${encodedSubject}&body=${encodedBody}`;
        setShowReferenceModal(false);
        setReferenceEmail("");
        setSelectedReferenceDocs({});
      }
    } else {
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      window.location.href = `mailto:${referenceEmail.trim()}?subject=${encodedSubject}&body=${encodedBody}`;
      setShowReferenceModal(false);
      setReferenceEmail("");
      setSelectedReferenceDocs({});
    }
  };



  const fetchReferences = async (id: string) => {
    setIsLoadingReferences(true);
    setReferencesError(null);

    try {
      const response = await fetch(`/api/job-seekers/${id}/references`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch references");
      }

      setReferences(Array.isArray(data?.references) ? data.references : []);
    } catch (err) {
      console.error("Error fetching references:", err);
      setReferencesError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching references"
      );
    } finally {
      setIsLoadingReferences(false);
    }
  };



  const handleAddReference = async () => {
    if (!jobSeekerId) return;

    const onboardingRefs =
      (jobSeeker?.customFields?.onboardingReferences as any[]) || [];

    let payload: any = null;

    if (addReferenceMode === "onboarding") {
      const idx = Number(selectedOnboardingReferenceIndex);
      if (!Number.isFinite(idx) || idx < 0 || idx >= onboardingRefs.length) {
        toast.error("Please select an onboarding reference");
        return;
      }

      const selected = onboardingRefs[idx] || {};
      payload = {
        name: selected.name || "",
        role: selected.role || "",
        company: selected.company || "",
        email: selected.email || "",
        phone: selected.phone || "",
        relationship: selected.relationship || "",
      };
    } else {
      if (!manualReferenceForm.name.trim()) {
        toast.error("Please enter a reference name");
        return;
      }

      payload = { ...manualReferenceForm };
    }

    try {
      const response = await fetch(`/api/job-seekers/${jobSeekerId}/references`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to add reference");
      }

      setReferences(Array.isArray(data?.references) ? data.references : []);
      setShowAddReferenceModal(false);
      setAddReferenceMode("onboarding");
      setSelectedOnboardingReferenceIndex("");
      setManualReferenceForm({
        name: "",
        role: "",
        company: "",
        email: "",
        phone: "",
        relationship: "",
      });
    } catch (err) {
      console.error("Error adding reference:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add reference");
    }
  };



  const handleDeleteReference = async (referenceId: string) => {
    if (!jobSeekerId) return;
    if (!confirm("Are you sure you want to delete this reference?")) return;

    try {
      const response = await fetch(
        `/api/job-seekers/${jobSeekerId}/references/${referenceId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete reference");
      }

      setReferences(Array.isArray(data?.references) ? data.references : []);
    } catch (err) {
      console.error("Error deleting reference:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete reference");
    }
  };



  // Initialize columns from localStorage or default
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobSeekerSummaryColumns");
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

  // Initialize Job Seeker Details field order/visibility from localStorage (persists across all job seeker records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(JOB_SEEKER_DETAILS_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setVisibleFields((prev) => ({ ...prev, jobSeekerDetails: parsed }));
      }
    } catch (_) {
      /* keep default */
    }
  }, []);

  // Initialize Overview field order/visibility from localStorage (persists across all job seeker records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(OVERVIEW_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setVisibleFields((prev) => ({ ...prev, overview: parsed }));
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
      localStorage.setItem("jobSeekerSummaryColumns", colsString);
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

      // Reorder within the same column
      if (source === target) {
        // Dropped on the container itself (not a panel)
        if (overId === source) return prev;
        const oldIndex = prev[source].indexOf(activeId);
        const newIndex = prev[source].indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        return {
          ...prev,
          [source]: arrayMove(prev[source], oldIndex, newIndex),
        };
      }

      // Move across columns
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
    if (!jobSeeker) return;
    const key = buildPinnedKey("jobSeeker", jobSeeker.id);
    const label = jobSeeker.fullName || `${formatRecordId(jobSeeker.id, "jobSeeker")}`;
    let url = `/dashboard/job-seekers/view?id=${jobSeeker.id}`;
    if (activeTab && activeTab !== "summary") url += `&tab=${activeTab}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      toast.info("Maximum 10 pinned records reached");
    }
  };

  useEffect(() => {
    const syncPinned = () => {
      if (!jobSeeker) return;
      const key = buildPinnedKey("jobSeeker", jobSeeker.id);
      setIsRecordPinned(isPinnedRecord(key));
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [jobSeeker]);

  // Fetch job seeker when component mounts
  useEffect(() => {
    if (jobSeekerId) {
      fetchJobSeeker(jobSeekerId);
    }
  }, [jobSeekerId]);

  // Fetch references when references tab is active
  useEffect(() => {
    if (activeTab === "references" && jobSeekerId) {
      fetchReferences(jobSeekerId);
    }
  }, [activeTab, jobSeekerId]);

  // Fetch available fields after job seeker is loaded
  useEffect(() => {
    if (jobSeeker && jobSeekerId) {
      fetchAvailableFields();
      // Update note form about field when job seeker is loaded
      setNoteForm((prev) => ({
        ...prev,
        about: `${jobSeeker.id} ${jobSeeker.fullName}`,
      }));
      // Fetch documents when job seeker is loaded
      fetchDocuments(jobSeekerId);
    }
  }, [jobSeeker, jobSeekerId]);

  // Fetch users for email notification
  useEffect(() => {
    if (showAddNote) {
      fetchUsers();
      fetchActionFields();
    }
  }, [showAddNote]);

  // Search for references for About field
  const searchAboutReferences = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setAboutSuggestions([]);
      setShowAboutDropdown(false);
      return;
    }

    setIsLoadingAboutSearch(true);
    setShowAboutDropdown(true);

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
            display: `${formatRecordId(job.id, "job")} ${job.job_title || "Untitled"
              }`,
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
            display: `${formatRecordId(org.id, "organization")} ${org.name || "Unnamed"
              }`,
            value: formatRecordId(org.id, "organization"),
          });
        });
      }

      // Process job seekers
      if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
        const data = await jobSeekersRes.value.json();
        const seekers = (data.jobSeekers || []).filter(
          (seeker: any) =>
            seeker.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            seeker.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            seeker.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            seeker.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            seeker.id?.toString().includes(searchTerm)
        );
        seekers.forEach((seeker: any) => {
          const name =
            seeker.full_name ||
            `${seeker.first_name || ""} ${seeker.last_name || ""}`.trim() ||
            "Unnamed";
          suggestions.push({
            id: seeker.id,
            type: "Job Seeker",
            display: `${formatRecordId(seeker.id, "jobSeeker")} ${name}`,
            value: formatRecordId(seeker.id, "jobSeeker"),
          });
        });
      }

      // Process leads
      if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
        const data = await leadsRes.value.json();
        const leads = (data.leads || []).filter(
          (lead: any) =>
            lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.id?.toString().includes(searchTerm)
        );
        leads.forEach((lead: any) => {
          suggestions.push({
            id: lead.id,
            type: "Lead",
            display: `${formatRecordId(lead.id, "lead")} ${lead.name || lead.company_name || "Unnamed"
              }`,
            value: formatRecordId(lead.id, "lead"),
          });
        });
      }

      // Process hiring managers
      if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
        const data = await hiringManagersRes.value.json();
        const hms = (data.hiringManagers || []).filter(
          (hm: any) =>
            hm.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            hm.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            hm.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            hm.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            hm.id?.toString().includes(searchTerm)
        );
        hms.forEach((hm: any) => {
          const name =
            hm.full_name ||
            `${hm.first_name || ""} ${hm.last_name || ""}`.trim() ||
            "Unnamed";
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

  // Close About dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        aboutInputRef.current &&
        !aboutInputRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-about-dropdown]')
      ) {
        setShowAboutDropdown(false);
      }
    };

    if (showAboutDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAboutDropdown]);

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

  // Fetch users for email notification dropdown
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
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );

      const response = await fetch("/api/admin/field-management/job-seekers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(raw);
      } catch { }

      const fields =
        data.customFields ||
        data.fields ||
        data.data?.fields ||
        data.jobSeekerFields ||
        [];

      setAvailableFields(fields);
    } catch (err) {
      console.error("Error fetching available fields:", err);
    } finally {
      setIsLoadingFields(false);
    }
  };

  // Fetch action fields (custom fields from Job Seekers field management)
  const fetchActionFields = async () => {
    setIsLoadingActionFields(true);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch("/api/admin/field-management/job-seekers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Get custom fields from the response - handle both response structures
        const fields = data.customFields || data.fields || [];

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
          // Fallback default actions (same as organization)
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
      console.error("Error fetching action fields:", err);
    } finally {
      setIsLoadingActionFields(false);
    }
  };

  // Toggle field visibility
  const toggleFieldVisibility = (panelId: string, fieldKey: string) => {
    setVisibleFields((prev) => {
      const panelFields = prev[panelId] || [];
      if (panelFields.includes(fieldKey)) {
        return {
          ...prev,
          [panelId]: panelFields.filter((f) => f !== fieldKey),
        };
      } else {
        return {
          ...prev,
          [panelId]: [...panelFields, fieldKey],
        };
      }
    });
  };

  // Job Seeker Details field catalog: from admin field definitions + record customFields only (no hardcoded standard)
  const jobSeekerDetailsFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    // const seen = new Set(fromApi.map((f) => f.key));
    // const fromJS = Object.keys(jobSeeker?.customFields || {})
    //   .filter((k) => !seen.has(k))
    //   .map((k) => ({ key: k, label: k }));
    return [...fromApi];
  }, [availableFields, jobSeeker?.customFields]);

  // Overview panel field catalog: from admin field definitions + record customFields only
  const overviewFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    const seen = new Set(fromApi.map((f) => f.key));
    // const fromJS = Object.keys(jobSeeker?.customFields || {})
    //   .filter((k) => !seen.has(k))
    //   .map((k) => ({ key: k, label: k }));
    return [...fromApi];
  }, [availableFields, jobSeeker?.customFields]);

  // When catalog loads, if overview/jobSeekerDetails visible list is empty, default to all catalog keys
  useEffect(() => {
    const keys = jobSeekerDetailsFieldCatalog.map((f) => f.key);
    if (keys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.jobSeekerDetails || [];
        if (current.length > 0) return prev;
        return { ...prev, jobSeekerDetails: keys };
      });
    }
  }, [jobSeekerDetailsFieldCatalog]);

  useEffect(() => {
    const keys = overviewFieldCatalog.map((f) => f.key);
    if (keys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.overview || [];
        if (current.length > 0) return prev;
        return { ...prev, overview: keys };
      });
    }
  }, [overviewFieldCatalog]);

  // Sync Job Seeker Details modal state when opening edit for jobSeekerDetails
  useEffect(() => {
    if (editingPanel !== "jobSeekerDetails") return;
    const current = visibleFields.jobSeekerDetails || [];
    const catalogKeys = jobSeekerDetailsFieldCatalog.map((f) => f.key);

    const currentInCatalog = current.filter((k) => catalogKeys.includes(k));
    const rest = catalogKeys.filter((k) => !current.includes(k));
    const order = [...currentInCatalog, ...rest];

    setModalJobSeekerDetailsOrder(order);
    setModalJobSeekerDetailsVisible(
      catalogKeys.reduce((acc, k) => {
        acc[k] = current.includes(k);
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.jobSeekerDetails, jobSeekerDetailsFieldCatalog]);

  // Sync Overview modal state when opening edit for overview
  useEffect(() => {
    if (editingPanel !== "overview") return;
    const current = visibleFields.overview || [];
    const catalogKeys = overviewFieldCatalog.map((f) => f.key);

    const currentInCatalog = current.filter((k) => catalogKeys.includes(k));
    const rest = catalogKeys.filter((k) => !current.includes(k));
    const order = [...currentInCatalog, ...rest];

    setModalOverviewOrder(order);
    setModalOverviewVisible(
      catalogKeys.reduce((acc, k) => {
        acc[k] = current.includes(k);
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.overview, overviewFieldCatalog]);

  // Handle edit panel click
  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Job Seeker Details modal: drag end (reorder)
  const handleJobSeekerDetailsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setJobSeekerDetailsDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalJobSeekerDetailsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // Job Seeker Details modal: save order/visibility and persist for all job seeker records
  const handleSaveJobSeekerDetailsFields = useCallback(() => {
    const newOrder = modalJobSeekerDetailsOrder.filter((k) => modalJobSeekerDetailsVisible[k] === true);
    if (typeof window !== "undefined") {
      localStorage.setItem(JOB_SEEKER_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, jobSeekerDetails: newOrder }));
    setEditingPanel(null);
  }, [modalJobSeekerDetailsOrder, modalJobSeekerDetailsVisible]);

  // Overview modal: drag end (reorder)
  const handleOverviewDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setOverviewDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalOverviewOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // Overview modal: save order/visibility and persist for all job seeker records
  const handleSaveOverviewFields = useCallback(() => {
    const newOrder = modalOverviewOrder.filter((k) => modalOverviewVisible[k] === true);
    if (typeof window !== "undefined") {
      localStorage.setItem(OVERVIEW_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, overview: newOrder }));
    setEditingPanel(null);
  }, [modalOverviewOrder, modalOverviewVisible]);

  const openResumeEditor = () => {
    if (!jobSeeker) return;
    setResumeSaveError(null);
    setResumeDraft(jobSeeker.resumeText || jobSeeker?.resume?.profile || "");
    setIsResumeEditorOpen(true);
  };

  const closeResumeEditor = () => {
    setIsResumeEditorOpen(false);
    setResumeSaveError(null);
  };

  const saveResumeText = async () => {
    if (!jobSeeker?.id) return;
    setIsSavingResume(true);
    setResumeSaveError(null);

    try {
      const response = await fetch(`/api/job-seekers/${jobSeeker.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({ resumeText: resumeDraft }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save resume");
      }

      setJobSeeker((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          resumeText: resumeDraft,
          resume: {
            ...(prev.resume || {}),
            profile: resumeDraft,
          },
        };
      });

      setIsResumeEditorOpen(false);
    } catch (err) {
      setResumeSaveError(
        err instanceof Error ? err.message : "An error occurred while saving the resume"
      );
    } finally {
      setIsSavingResume(false);
    }
  };

  // Fetch documents for the job seeker
  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);

    try {
      const response = await fetch(`/api/job-seekers/${id}/documents`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setDocumentError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching documents"
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const fileArray = Array.from(droppedFiles);
      setPendingFiles(fileArray);
      if (fileArray.length === 1) {
        setFileDetailsName(fileArray[0].name.replace(/\.[^/.]+$/, ""));
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setPendingFiles(fileArray);
      if (fileArray.length === 1) {
        setFileDetailsName(fileArray[0].name.replace(/\.[^/.]+$/, ""));
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }
  };

  const handleConfirmFileDetails = async () => {
    if (!jobSeekerId || pendingFiles.length === 0) return;

    setShowFileDetailsModal(false);
    const filesToUpload = [...pendingFiles];
    setPendingFiles([]);

    setUploadError(null);
    setUploadErrors({});

    const newUploadProgress: Record<string, number> = { ...uploadProgress };

    for (const file of filesToUpload) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadErrors((prev) => ({
          ...prev,
          [file.name]: "File size exceeds 10MB limit",
        }));
        continue;
      }

      newUploadProgress[file.name] = 0;
      setUploadProgress({ ...newUploadProgress });

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "document_name",
          filesToUpload.length === 1 ? fileDetailsName : file.name.replace(/\.[^/.]+$/, "")
        );
        formData.append(
          "document_type",
          filesToUpload.length === 1 ? fileDetailsType : "General"
        );

        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            const current = prev[file.name] || 0;
            if (current >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return { ...prev, [file.name]: current + 10 };
          });
        }, 200);

        setIsUploading(true);
        const response = await fetch(
          `/api/job-seekers/${jobSeekerId}/documents/upload`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${document.cookie.replace(
                /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                "$1"
              )}`,
            },
            body: formData,
          }
        );

        clearInterval(progressInterval);

        if (response.ok) {
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
          await fetchDocuments(jobSeekerId);
          toast.success("Document added successfully");
        } else {
          const data = await response.json();
          setUploadErrors((prev) => ({
            ...prev,
            [file.name]: data.message || "Upload failed",
          }));
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
        }
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        setUploadErrors((prev) => ({
          ...prev,
          [file.name]: "An error occurred during upload",
        }));
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      } finally {
        setIsUploading(false);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };



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

  // Handle delete document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(
        `/api/job-seekers/${jobSeekerId}/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete document");
      }

      // Remove the document from the list
      setDocuments(documents.filter((doc) => doc.id !== documentId));

      toast.success("Document deleted successfully");
    } catch (err) {
      console.error("Error deleting document:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting the document"
      );
    }
  };

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Handle edit document
  const handleEditDocument = (doc: any) => {
    setEditingDocument(doc);
    setEditDocumentName(doc?.document_name || "");
    setEditDocumentType(doc?.document_type || "General");
    setShowEditDocumentModal(true);
  };

  // Handle update document
  const handleUpdateDocument = async () => {
    if (!editingDocument?.id || !jobSeekerId || !editDocumentName.trim()) return;

    try {
      const response = await fetch(
        `/api/job-seekers/${jobSeekerId}/documents/${editingDocument.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
          body: JSON.stringify({
            document_name: editDocumentName,
            document_type: editDocumentType,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update document");
      }

      const data = await response.json();

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === editingDocument.id ? data.document : doc))
      );

      setEditingDocument(null);
      setShowEditDocumentModal(false);
      setEditDocumentName("");
      setEditDocumentType("General");

      toast.success("Document updated successfully");
    } catch (err) {
      console.error("Error updating document:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "An error occurred while updating the document"
      );
    }
  };

  // Handle add text document
  const handleAddDocument = async () => {
    if (!jobSeekerId || !newDocumentName.trim()) return;

    try {
      const response = await fetch(
        `/api/job-seekers/${jobSeekerId}/documents`,
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
            document_name: newDocumentName,
            document_type: newDocumentType,
            content: newDocumentContent,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add document");
      }

      setShowAddDocument(false);
      setNewDocumentName("");
      setNewDocumentType("General");
      setNewDocumentContent("");
      await fetchDocuments(jobSeekerId);
      toast.success("Document added successfully");
    } catch (err) {
      console.error("Error adding document:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "An error occurred while adding the document"
      );
    }
  };

  // Function to fetch job seeker data with better error handling
  const fetchJobSeeker = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching job seeker data for ID: ${id}`);
      const response = await fetch(`/api/job-seekers/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
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
        console.error("Error parsing response:", parseError);
        console.error("Raw response:", responseText.substring(0, 200));
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to fetch job seeker: ${response.status}`
        );
      }

      console.log("Job seeker data received:", data);

      // Validate job seeker data
      if (!data.jobSeeker) {
        throw new Error("No job seeker data received from API");
      }

      // Process the job seeker data
      const jobSeekerData = data.jobSeeker;

      // Create a resume object based on the job seeker's data
      const resume = {
        profile:
          jobSeekerData.resume_text || "No profile information available",
        experience: [], // Would be populated from a formatted resume if available
      };

      let customFieldsObj: any = {};
      const possibleCustomSources = [
        jobSeekerData.custom_fields,
        jobSeekerData.customFields,
        jobSeekerData.custom_fields_json,
        jobSeekerData.job_seeker_custom_fields,
      ];

      for (const src of possibleCustomSources) {
        if (!src) continue;
        try {
          if (typeof src === "string") {
            customFieldsObj = JSON.parse(src);
          } else if (typeof src === "object") {
            customFieldsObj = src;
          }
          if (Object.keys(customFieldsObj).length > 0) break;
        } catch {
          customFieldsObj = {};
        }
      }

      // Format the job seeker data with default values for all fields
      const formattedJobSeeker = {
        id: jobSeekerData.id || "Unknown ID",
        firstName: jobSeekerData.first_name || "",
        lastName: jobSeekerData.last_name || "",
        fullName:
          jobSeekerData.full_name ||
          `${jobSeekerData.last_name}, ${jobSeekerData.first_name}`,
        email: jobSeekerData.email || "No email provided",
        phone: jobSeekerData.phone || "No phone provided",
        mobilePhone:
          jobSeekerData.mobile_phone ||
          jobSeekerData.phone ||
          "No phone provided",
        address: jobSeekerData.address || "No address provided",
        city: jobSeekerData.city || "",
        state: jobSeekerData.state || "",
        zip: jobSeekerData.zip || "",
        fullAddress: formatAddress(jobSeekerData),
        status: jobSeekerData.status || "New lead",
        currentOrganization:
          jobSeekerData.current_organization || "Not specified",
        title: jobSeekerData.title || "Not specified",
        dateAdded: jobSeekerData.date_added
          ? formatDate(jobSeekerData.date_added)
          : "Unknown",
        lastContactDate: jobSeekerData.last_contact_date
          ? formatDate(jobSeekerData.last_contact_date)
          : "Never contacted",
        owner: jobSeekerData.owner || "Not assigned",
        skills: jobSeekerData.skills
          ? jobSeekerData.skills.split(",").map((skill: string) => skill.trim())
          : [],
        desiredSalary: jobSeekerData.desired_salary || "Not specified",
        resume: resume,
        resumeText: jobSeekerData.resume_text || "",
        customFields: customFieldsObj,
      };

      console.log("Formatted job seeker data:", formattedJobSeeker);
      setJobSeeker(formattedJobSeeker);

      // Now fetch notes, history, documents, and tasks
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
      fetchTasks(id);
    } catch (err) {
      console.error("Error fetching job seeker:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching job seeker details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format the complete address
  function formatAddress(data: any): string {
    const addressParts = [];
    if (data.address) addressParts.push(data.address);

    const cityStateParts = [];
    if (data.city) cityStateParts.push(data.city);
    if (data.state) cityStateParts.push(data.state);
    if (cityStateParts.length > 0) addressParts.push(cityStateParts.join(", "));

    if (data.zip) addressParts.push(data.zip);

    return addressParts.length > 0
      ? addressParts.join(", ")
      : "No address provided";
  }

  // Format date function
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  // Fetch notes for the job seeker
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);

    try {
      const response = await fetch(`/api/job-seekers/${id}/notes`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notes");
      }

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Fetch history for the job seeker
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/job-seekers/${id}/history`, {
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

  // Fetch tasks for the job seeker (only non-completed tasks)
  const fetchTasks = async (jobSeekerId: string) => {
    setIsLoadingTasks(true);
    setTasksError(null);

    try {
      // Fetch all tasks
      const tasksResponse = await fetch(`/api/tasks`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!tasksResponse.ok) {
        const errorData = await tasksResponse.json();
        throw new Error(errorData.message || "Failed to fetch tasks");
      }

      const tasksData = await tasksResponse.json();

      // Filter tasks:
      // 1. Not completed (status !== "Completed" and is_completed !== true)
      // 2. Related to this job seeker by task.job_seeker_id == jobSeekerId
      const jobSeekerTasks = (tasksData.tasks || []).filter((task: any) => {
        // Exclude completed tasks
        if (task.is_completed === true || task.status === "Completed") {
          return false;
        }

        // Check if task is related to this job seeker
        const taskJobSeekerId = task.job_seeker_id?.toString();
        return taskJobSeekerId && taskJobSeekerId === jobSeekerId.toString();
      });

      setTasks(jobSeekerTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasksError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching tasks"
      );
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!noteForm.text.trim() || !jobSeekerId) return;

    try {
      const requestBody = {
        text: noteForm.text,
        note_type: noteForm.action || "General Note", // Map action to note_type for backend
        // Backend only uses text and note_type, but we can send other fields for future use
        action: noteForm.action,
        copy_note: noteForm.copyNote === "Yes",
        replace_general_contact_comments:
          noteForm.replaceGeneralContactComments,
        additional_references: noteForm.additionalReferences,
        schedule_next_action: noteForm.scheduleNextAction,
        email_notification: Array.isArray(noteForm.emailNotification) ? noteForm.emailNotification : (noteForm.emailNotification ? [noteForm.emailNotification] : []),
      };

      console.log("Adding note for job seeker:", jobSeekerId);
      console.log("Request body:", requestBody);

      const response = await fetch(`/api/job-seekers/${jobSeekerId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      // Get response as text first so we can handle non-JSON (e.g. HTML error pages)
      const responseText = await response.text();
      let data: { note?: unknown; message?: string; error?: string } | null = null;

      try {
        if (responseText.trim()) data = JSON.parse(responseText);
      } catch (parseError) {
        if (response.ok) {
          console.error("Error parsing response:", parseError);
          console.error("Raw response:", responseText);
          throw new Error("Server returned an invalid response. Please try again.");
        }
        // Non-OK response with non-JSON body (e.g. HTML error page)
        const message =
          response.status === 401
            ? "Session expired or not authorized. Please sign in again."
            : response.status >= 500
              ? "Server error. Please try again later."
              : "Failed to add note. Please try again.";
        throw new Error(message);
      }

      if (!response.ok) {
        const message =
          (data && (data.message || data.error)) ||
          (response.status === 401
            ? "Session expired or not authorized. Please sign in again."
            : "Failed to add note");
        throw new Error(message);
      }

      if (!data) {
        throw new Error("Server returned an empty response. Please try again.");
      }

      // Add the new note to the list
      // Handle both response structures: { note } or { success: true, note }
      const newNote = data.note ?? data;
      if (newNote) {
        setNotes([newNote, ...notes]);
      }

      // Clear the form
      setNoteForm({
        text: "",
        action: "",
        about: jobSeeker
          ? `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.fullName}`
          : "",
        aboutReferences: [], // ✅ required
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: "",
        scheduleNextAction: "None",
        emailNotification: [],
      });
      setEmailSearchQuery("");
      setShowEmailDropdown(false);
      setShowAddNote(false);

      // Refresh history and notes
      fetchHistory(jobSeekerId);
      fetchNotes(jobSeekerId);

      // Show success message
      toast.success("Note added successfully");
    } catch (err) {
      console.error("Error adding note:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "An error occurred while adding a note"
      );
    }
  };

  // Close add note modal
  const handleCloseAddNoteModal = () => {
    setShowAddNote(false);
    setNoteForm({
      text: "",
      action: "",
      about: jobSeeker
        ? `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.fullName}`
        : "",
      aboutReferences: jobSeeker
        ? [
          {
            id: jobSeeker.id,
            type: "Job Seeker",
            display: `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.fullName}`,
            value: formatRecordId(jobSeeker.id, "jobSeeker"),
          },
        ]
        : [],
      copyNote: "No",
      replaceGeneralContactComments: false,
      additionalReferences: "",
      scheduleNextAction: "None",
      emailNotification: [],
    });
    setAboutSearchQuery("");
    setShowAboutDropdown(false);
    setAboutSuggestions([]);
    setEmailSearchQuery("");
    setShowEmailDropdown(false);
  };


  const handleGoBack = () => {
    router.back();
  };

  const handleEdit = () => {
    if (jobSeekerId) {
      router.push(`/dashboard/job-seekers/add?id=${jobSeekerId}`);
    }
  };

  // Check Office 365 connection on mount
  useEffect(() => {
    const checkConnection = () => {
      const connected = isOffice365Authenticated();
      setIsOffice365Connected(connected);
    };
    checkConnection();
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("msal_access_token");
      if (token) setIsOffice365Connected(true);
    }
  }, []);

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

  const handleActionSelected = async (action: string) => {
    console.log(`Action selected: ${action}`);
    if (action === "edit") {
      handleEdit();
    } else if (action === "delete" && jobSeekerId) {
      setShowDeleteModal(true);
    } else if (action === "transfer" && jobSeekerId) {
      setShowTransferModal(true);
    } else if (action === "add-note") {
      setShowAddNote(true);
      setActiveTab("notes");
    } else if (action === "add-task") {
      // Navigate to add task page with job seeker context
      if (jobSeekerId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=job_seeker&relatedEntityId=${jobSeekerId}`
        );
      }
    } else if (action === "email") {
      // Open default email application with mailto link
      if (!jobSeeker?.email || jobSeeker.email === "No email provided") {
        toast.error("Job seeker email not available");
        return;
      }

      // Use mailto link to open default email application (e.g., Outlook Desktop)
      window.location.href = `mailto:${jobSeeker.email}`;
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else if (action === "add-appointment") {
      setShowAppointmentModal(true);
      // Pre-fill job seeker email if available
      if (jobSeeker?.email && jobSeeker.email !== "No email provided") {
        setAppointmentForm((prev) => ({
          ...prev,
          attendees: [jobSeeker.email],
        }));
      }
    }
  };

  // Check for pending delete request
  const checkPendingDeleteRequest = async () => {
    if (!jobSeekerId) return;
    setIsLoadingDeleteRequest(true);
    try {
      const response = await fetch(
        `/api/job-seekers/${jobSeekerId}/delete-request`,
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

  useEffect(() => {
    if (showDeleteModal && jobSeekerId) checkPendingDeleteRequest();
  }, [showDeleteModal, jobSeekerId]);

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

  const handleDeleteRequestSubmit = async () => {
    if (!deleteForm.reason.trim()) {
      toast.error("Please enter a reason for deletion");
      return;
    }
    if (!jobSeekerId) return;
    setIsSubmittingDelete(true);
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
      const res = await fetch(`/api/job-seekers/${jobSeekerId}/delete-request`, {
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
          record_type: "job_seeker",
          record_number: formatRecordId(jobSeeker?.id, "jobSeeker"),
          requested_by: currentUser?.name || currentUser?.id || "Unknown",
          requested_by_email: currentUser?.email || "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create delete request");
      }
      toast.success("Delete request submitted. Payroll will be notified for approval.");
      setShowDeleteModal(false);
      setDeleteForm({ reason: "" });
      checkPendingDeleteRequest();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit delete request");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Fetch available job seekers for transfer (exclude current and archived)
  const fetchAvailableJobSeekersForTransfer = async () => {
    setIsLoadingTransferTargets(true);
    try {
      const response = await fetch("/api/job-seekers", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const list = data.jobSeekers || data.data || data || [];
        const arr = Array.isArray(list) ? list : [];
        const filtered = arr.filter(
          (js: any) =>
            String(js?.id) !== String(jobSeekerId) &&
            js?.status !== "Archived" &&
            !js?.archived_at
        );
        setAvailableJobSeekersForTransfer(filtered);
      } else {
        setAvailableJobSeekersForTransfer([]);
      }
    } catch (err) {
      console.error("Error fetching job seekers for transfer:", err);
      setAvailableJobSeekersForTransfer([]);
    } finally {
      setIsLoadingTransferTargets(false);
    }
  };

  useEffect(() => {
    if (showTransferModal) {
      fetchAvailableJobSeekersForTransfer();
      setTransferSearchQuery("");
      setShowTransferDropdown(false);
    }
  }, [showTransferModal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (transferSearchRef.current && !transferSearchRef.current.contains(e.target as Node)) {
        setShowTransferDropdown(false);
      }
    };
    if (showTransferDropdown) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTransferDropdown]);

  const filteredTransferJobSeekers =
    transferSearchQuery.trim() === ""
      ? availableJobSeekersForTransfer
      : availableJobSeekersForTransfer.filter((js: any) => {
          const q = transferSearchQuery.trim().toLowerCase();
          const fullName = String(js?.full_name || `${js?.last_name || ""}, ${js?.first_name || ""}`).toLowerCase();
          const idStr = js?.id != null ? String(js.id) : "";
          const recordId = js?.id != null ? String(formatRecordId(js.id, "jobSeeker")).toLowerCase() : "";
          return fullName.includes(q) || idStr.includes(q) || recordId.includes(q);
        });

  const handleTransferSubmit = async () => {
    if (!transferForm.targetJobSeekerId) {
      toast.error("Please select a target job seeker");
      return;
    }
    if (!jobSeekerId) return;
    const targetId = Number(transferForm.targetJobSeekerId);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      toast.error("Invalid target job seeker");
      return;
    }
    if (Number(jobSeekerId) === targetId) {
      toast.error("Cannot transfer to the same job seeker");
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
      const res = await fetch("/api/job-seekers/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          source_job_seeker_id: Number(jobSeekerId),
          target_job_seeker_id: targetId,
          requested_by: currentUser?.name || currentUser?.id || "Unknown",
          requested_by_email: currentUser?.email || "",
          source_record_number: formatRecordId(Number(jobSeekerId), "jobSeeker"),
          target_record_number: formatRecordId(targetId, "jobSeeker"),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create transfer request");
      }
      toast.success("Transfer request submitted. Payroll will be notified for approval.");
      setShowTransferModal(false);
      setTransferForm({ targetJobSeekerId: "" });
      setTransferSearchQuery("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit transfer request");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Handle appointment submission
  const handleAppointmentSubmit = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.type) {
      toast.error("Please fill in all required fields (Date, Time, Type)");
      return;
    }

    if (!jobSeekerId) {
      toast.error("Job Seeker ID is missing");
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
          jobSeekerId: jobSeekerId,
          client: jobSeeker?.fullName || jobSeeker?.name || "",
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
            subject: `${appointmentForm.type} - ${jobSeeker?.fullName || jobSeeker?.name || 'Job Seeker'}`,
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

  // Print handler: ensure Summary tab (with Job Seeker Details) is active when printing
  const handlePrint = () => {
    const printContent = document.getElementById("printable-summary");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tabTitle = activeTab?.toUpperCase() || "Job Seeker SUMMARY";

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

  // Handle job seeker deletion
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job seeker?")) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/job-seekers/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete job seeker");
      }

      // Redirect to the job seekers list
      router.push("/dashboard/job-seekers");
    } catch (error) {
      console.error("Error deleting job seeker:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while deleting the job seeker"
      );
      setIsLoading(false);
    }
  };

  const actionOptions = [
    { label: "Add Note", action: () => setShowAddNote(true) },
    { label: "Send Email", action: () => handleActionSelected("email") },
    {
      label: "Add Appointment",
      action: () => handleActionSelected("add-appointment"),
    },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
    {
      label: "Add Tearsheet",
      action: () => handleActionSelected("add-tearsheet"),
    },
    {
      label: "Password Reset",
      action: () => handleActionSelected("password-reset"),
    },
    // { label: "Edit", action: () => handleActionSelected("edit") },
    { label: "Transfer", action: () => handleActionSelected("transfer") },
    { label: "Delete", action: () => handleActionSelected("delete") },
  ];

  const printableOptions = [
    { label: "Summary", action: () => handlePrint() },
    { label: "Full Profile", action: () => handlePrint() },
  ];

  // Tabs from the image
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "history", label: "History" },
    { id: "notes", label: "Notes" },
    { id: "docs", label: "Docs" },
    { id: "references", label: "References" },
    { id: "applications", label: "Applications" },
    { id: "onboarding", label: "Onboarding" },
  ];

  const getCustomFieldRecordCount = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.length;
    if (typeof value === "object") {
      const maybeArray =
        (value as any).records ||
        (value as any).items ||
        (value as any).data ||
        (value as any).rows;
      if (Array.isArray(maybeArray)) return maybeArray.length;
      const maybeCount = (value as any).count;
      if (typeof maybeCount === "number" && Number.isFinite(maybeCount))
        return maybeCount;
    }
    return 0;
  };

  const getQuickTabCount = (tabId: string): number => {
    const cf = jobSeeker?.customFields || {};
    if (tabId === "prescreen") {
      return getCustomFieldRecordCount(
        cf.prescreen ?? cf.prescreens ?? cf.preScreen ?? cf.preScreens
      );
    }
    if (tabId === "submissions") {
      return getCustomFieldRecordCount(
        cf.submissions ?? cf.submission ?? cf.candidateSubmissions
      );
    }
    if (tabId === "sendouts") {
      return getCustomFieldRecordCount(
        cf.sendouts ?? cf.sendOuts ?? cf.sendout ?? cf.sendOut
      );
    }
    if (tabId === "interviews") {
      return getCustomFieldRecordCount(
        cf.interviews ?? cf.interview ?? cf.candidateInterviews
      );
    }
    if (tabId === "placements") {
      return getCustomFieldRecordCount(
        cf.placements ?? cf.placement ?? cf.candidatePlacements
      );
    }
    return 0;
  };

  // Quick action tabs from the image
  const quickTabs = [
    { id: "prescreen", label: "Prescreen", count: getQuickTabCount("prescreen") },
    { id: "submissions", label: "Submissions", count: getQuickTabCount("submissions") },
    { id: "sendouts", label: "Sendouts", count: getQuickTabCount("sendouts") },
    { id: "interviews", label: "Interviews", count: getQuickTabCount("interviews") },
    { id: "placements", label: "Placements", count: getQuickTabCount("placements") },
  ];

  // Render notes tab content
  const renderNotesTab = () => {
    // Filter and sort notes
    const sortedFilteredNotes = notes
      .filter((note) => {
        const matchesAction = noteActionFilter
          ? (note.action === noteActionFilter)
          : true;
        const matchesAuthor = noteAuthorFilter
          ? (note.created_by_name || "Unknown User") === noteAuthorFilter
          : true;
        return matchesAction && matchesAuthor;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (noteSortKey === "date") {
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else if (noteSortKey === "action") {
          cmp = (a.action || "").localeCompare(b.action || "");
        } else if (noteSortKey === "author") {
          cmp = (a.created_by_name || "").localeCompare(b.created_by_name || "");
        }
        return noteSortDir === "asc" ? cmp : -cmp;
      });

    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Job Seeker Notes{" "}
            {notes.length > 0 && (
              <span className="text-gray-500 font-normal">({notes.length})</span>
            )}
          </h2>
          <button
            onClick={() => setShowAddNote(true)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Add Note
          </button>
        </div>

        {/* Filters & Sort Controls */}
        <div className="flex flex-wrap gap-4 items-end mb-4">
          {/* Action Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Action
            </label>
            <select
              value={noteActionFilter}
              onChange={(e) => setNoteActionFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded text-sm"
            >
              <option value="">All Actions</option>
              {Array.from(new Set([...actionFields.map((af) => af.field_label || af.field_name), ...notes.map(n => n.action).filter(Boolean)])).sort().map(
                (action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Author Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Author
            </label>
            <select
              value={noteAuthorFilter}
              onChange={(e) => setNoteAuthorFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded text-sm"
            >
              <option value="">All Authors</option>
              {Array.from(
                new Set(notes.map((n) => n.created_by_name || "Unknown User"))
              ).sort().map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Key */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={noteSortKey}
              onChange={(e) =>
                setNoteSortKey(e.target.value as "date" | "action" | "author")
              }
              className="p-2 border border-gray-300 rounded text-sm"
            >
              <option value="date">Date</option>
              <option value="action">Action</option>
              <option value="author">Author</option>
            </select>
          </div>

          {/* Sort Direction Toggle */}
          <div>
            <button
              onClick={() =>
                setNoteSortDir((d) => (d === "asc" ? "desc" : "asc"))
              }
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs text-black"
              title="Toggle Sort Direction"
            >
              {noteSortDir === "asc" ? "Asc ↑" : "Desc ↓"}
            </button>
          </div>

          {/* Clear Filters */}
          {(noteActionFilter || noteAuthorFilter) && (
            <button
              onClick={() => {
                setNoteActionFilter("");
                setNoteAuthorFilter("");
              }}
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Notes List (standardized to Organization Notes design) */}
        {isLoadingNotes ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : sortedFilteredNotes.length > 0 ? (
          <div className="space-y-4">
            {sortedFilteredNotes.map((note) => {
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
              const aboutRefs = parseAboutReferences((note as any).about_references ?? (note as any).aboutReferences);
              const actionLabel = note.action || "General Note";

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
                            Job Seeker
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
                            const navigateToRef = (r: any) => {
                              if (!r?.id || !r?.type) return;
                              const t = (r.type || "").toLowerCase().replace(/\s+/g, "");
                              const routeMap: Record<string, string> = {
                                organization: `/dashboard/organizations/view?id=${r.id}`,
                                job: `/dashboard/jobs/view?id=${r.id}`,
                                jobseeker: `/dashboard/job-seekers/view?id=${r.id}`,
                                lead: `/dashboard/leads/view?id=${r.id}`,
                                task: `/dashboard/tasks/view?id=${r.id}`,
                                placement: `/dashboard/placements/view?id=${r.id}`,
                                hiringmanager: `/dashboard/hiring-managers/view?id=${r.id}`,
                              };
                              if (routeMap[t]) router.push(routeMap[t]);
                            };
                            return (
                              <button
                                key={idx}
                                onClick={() => isClickable && navigateToRef(ref)}
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
          <p className="text-gray-500 italic">
            {(noteActionFilter || noteAuthorFilter) ? "No notes match your filters." : "No notes have been added yet."}
          </p>
        )}
      </div>
    );
  };

  // Render history tab content
  const renderHistoryTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Job Seeker History</h2>

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
                    actionDisplay = "Job Seeker Created";
                    detailsDisplay = `Created by ${item.performed_by_name || "Unknown"
                      }`;
                    break;
                  case "UPDATE":
                    actionDisplay = "Job Seeker Updated";
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
        <p className="text-gray-500 italic">No Job Seeker history records available</p>
      )}
    </div>
  );

  // Render modify tab to direct to edit form
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Edit Job Seeker</h2>
      <p className="text-gray-600 mb-4">
        Click the button below to edit this job seeker's details.
      </p>
      <button
        onClick={handleEdit}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Edit Job Seeker
      </button>
    </div>
  );

  // Render individual panels for summary
  const renderResumePanel = () => {
    if (!jobSeeker) return null;
    return (
      <PanelWithHeader
        title="Resume"
        onEdit={openResumeEditor}
        editButtonTitle="Edit Resume Content"
        editButtonAriaLabel="Edit Resume Content"
      >
        <div className="space-y-0 border border-gray-200 rounded">
          {visibleFields.resume.includes("profile") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              {/* <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Profile:</div> */}
              <div className="flex-1 p-2 text-sm">{jobSeeker.resume.profile}</div>
            </div>
          )}
        </div>
      </PanelWithHeader>
    );
  };

  const renderOverviewPanel = () => {
    if (!jobSeeker) return null;
    const customObj = jobSeeker.customFields || {};
    const customFieldDefs = (availableFields || []).filter((f: any) => {
      const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
      return !isHidden;
    });

    const getOverviewLabel = (key: string) =>
      overviewFieldCatalog.find((f) => f.key === key)?.label ||
      customFieldDefs.find((f: any) => String(f.field_name || f.field_key || f.api_name || f.id) === key)?.field_label ||
      key;
    const overviewKeys = visibleFields.overview || [];
    const effectiveRows: { key: string; label: string }[] = [];
    for (const key of overviewKeys) {
      effectiveRows.push({ key, label: getOverviewLabel(key) });
    }

    const renderOverviewRow = (key: string) => {
      const field = customFieldDefs.find(
        (f: any) =>
          String(f.field_name || f.field_key || f.api_name || f.id) === String(key) ||
          String(f.field_label || "") === String(key) ||
          String(f.field_name || "") === String(key)
      );
      const value =
        (jobSeeker as any)?.[key] ??
        (customObj as any)?.[key] ??
        (field?.field_label ? (customObj as any)?.[field.field_label] : undefined) ??
        (field?.field_name ? (customObj as any)?.[field.field_name] : undefined);
      const label = field?.field_label || field?.field_name || key;
      const fieldValue = value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : "-";
      const lookupType = (field?.lookup_type || field?.lookupType || "") as any;
      return (
        <div key={key} className="flex border-b border-gray-200 last:border-b-0">
          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{label}:</div>
          <div className="flex-1 p-2 text-sm">{
            /\(\d{3}\)\s\d{3}-\d{4}/.test(fieldValue || "") ? (
              <a href={`tel:${String(fieldValue)}`} className="text-blue-600 hover:underline">
                {String(fieldValue)}
              </a>
            ) : String(fieldValue)?.includes("@") ? (
              <a href={`mailto:${String(fieldValue)}`} className="text-blue-600 hover:underline">
                {String(fieldValue)}
              </a>
            ) : String(fieldValue)?.startsWith("http") || String(fieldValue)?.startsWith("https") ? (
              <a href={String(fieldValue)} className="text-blue-600 hover:underline">
                {String(fieldValue)}
              </a>
            ) : lookupType && fieldValue ? (
              <RecordNameResolver
                id={String(fieldValue || "") || null}
                type={lookupType as any}
                clickable
                fallback={String(fieldValue || "") || ""}
              />) : (
              String(fieldValue) || "-"
            )}
          </div>
          {/* </div> */}
        </div>
      );
    };

    return (
      <PanelWithHeader title="Overview" onEdit={() => handleEditPanel("overview")}>
        <div className="space-y-0 border border-gray-200 rounded">
          {effectiveRows.map((row) =>
            renderOverviewRow(row.key)
          )}
        </div>
      </PanelWithHeader>
    );
  };

  const renderJobSeekerDetailsPanel = () => {
    if (!jobSeeker) return null;
    const customObj = jobSeeker.customFields || {};
    const customFieldDefs = (availableFields || []).filter((f: any) => {
      const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
      return !isHidden;
    });

    const getDetailsLabel = (key: string) =>
      jobSeekerDetailsFieldCatalog.find((f) => f.key === key)?.label ||
      customFieldDefs.find((f: any) => String(f.field_name || f.field_key || f.api_name || f.id) === key)?.field_label ||
      key;
    const detailsKeys = visibleFields.jobSeekerDetails || [];
    const effectiveRows: { key: string; label: string }[] = [];
    for (const key of detailsKeys) {
      effectiveRows.push({ key, label: getDetailsLabel(key) });
    }

    const renderJobSeekerDetailsRow = (key: string) => {
      const field = customFieldDefs.find(
        (f: any) =>
          String(f.field_name || f.field_key || f.api_name || f.id) === String(key) ||
          String(f.field_label || "") === String(key) ||
          String(f.field_name || "") === String(key)
      );
      const value =
        (customObj as any)?.[key] ??
        (field?.field_label ? (customObj as any)?.[field.field_label] : undefined) ??
        (field?.field_name ? (customObj as any)?.[field.field_name] : undefined);
      const label = field?.field_label || field?.field_name || key;
      const fieldValue = value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : "-";
      const lookupType = (field?.lookup_type || field?.lookupType || "") as any;
      return (
        <div key={key} className="flex border-b border-gray-200 last:border-b-0">
          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{label}:</div>
          <div className="flex-1 p-2 text-sm">{
            /\(\d{3}\)\s\d{3}-\d{4}/.test(fieldValue || "") ? (
              <a href={`tel:${String(fieldValue)}`} className="text-blue-600 hover:underline">
                {String(fieldValue)}
              </a>
            ) : String(fieldValue)?.includes("@") ? (
              <a href={`mailto:${String(fieldValue)}`} className="text-blue-600 hover:underline">
                {String(fieldValue)}
              </a>
            ) : String(fieldValue)?.startsWith("http") || String(fieldValue)?.startsWith("https") ? (
              <a href={String(fieldValue)} className="text-blue-600 hover:underline">
                {String(fieldValue)}
              </a>
            ) : lookupType && fieldValue ? (
              <RecordNameResolver
                id={String(fieldValue || "") || null}
                type={lookupType as any}
                clickable
                fallback={String(fieldValue || "") || ""}
              />) : (
              String(fieldValue) || "-"
            )}
          </div>
        </div>
      );
    };

    return (
      <PanelWithHeader title="Job Seeker Details" onEdit={() => handleEditPanel("jobSeekerDetails")}>
        <div className="space-y-0 border border-gray-200 rounded">
          {effectiveRows.map((row) =>
            renderJobSeekerDetailsRow(row.key)
          )}
        </div>
      </PanelWithHeader>
    );
  };

  const renderRecentNotesPanel = () => (
    <PanelWithHeader title="Recent Notes:">
      <div className="p-2 border border-gray-200 rounded">
        {notes.length > 0 ? (
          <div className="space-y-2">
            {notes.slice(0, 3).map((note) => (
              <div key={note.id} className="text-sm pb-2 border-b last:border-b-0">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{note.created_by_name}</span>
                  <span>{new Date(note.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1">{note.text}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 italic text-sm">No recent notes</p>}
      </div>
    </PanelWithHeader>
  );

  const renderOpenTasksPanel = () => (
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
                onClick={() => router.push(`/dashboard/tasks/view?id=${task.id}`)}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-medium text-blue-600 hover:underline">{task.title}</h4>
                  {task.priority && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        task.priority === "High"
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
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                )}
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <div className="flex space-x-3">
                    {task.due_date && (
                      <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                    )}
                    {task.assigned_to_name && (
                      <span>Assigned to: {task.assigned_to_name}</span>
                    )}
                  </div>
                  {task.status && <span className="text-gray-600">{task.status}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500 italic">No open tasks</div>
        )}
      </div>
    </PanelWithHeader>
  );

  const renderPanel = useCallback((panelId: string, isOverlay = false) => {
    let content = null;
    if (panelId === "resume") content = renderResumePanel();
    else if (panelId === "overview") content = renderOverviewPanel();
    else if (panelId === "jobSeekerDetails") content = renderJobSeekerDetailsPanel();
    else if (panelId === "recentNotes") content = renderRecentNotesPanel();
    else if (panelId === "openTasks") content = renderOpenTasksPanel();

    if (!content) return null;
    return (
      <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
        {content}
      </SortablePanel>
    );
  }, [jobSeeker, visibleFields, notes, tasks, isLoadingTasks, tasksError]);

  if (isLoading) {
    return <LoadingScreen message="Loading job seeker details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Job Seekers
        </button>
      </div>
    );
  }

  if (!jobSeeker) {
    return (
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
        <div className="text-gray-700 mb-4">Job seeker not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Job Seekers
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-2 sm:p-4 min-w-0">
      {/* Header with job seeker name and buttons */}
      <div className="bg-gray-400 p-2 sm:p-3 flex items-center min-w-0">
        <div className="flex items-center min-w-0 flex-1">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2 shrink-0">
            <FiUsers size={20} />
          </div>
          <h1 className="text-base sm:text-xl font-semibold text-gray-700 truncate min-w-0">
            {formatRecordId(jobSeeker.id, "jobSeeker")} {jobSeeker.fullName}
          </h1>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-3 py-2 sm:px-4">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-3 sm:gap-4">
          {/* LEFT: dynamic fields */}
          <div className="flex flex-wrap gap-x-6 sm:gap-x-10 gap-y-2 flex-1 min-w-0">
            {headerFields.length === 0 ? (
              <span className="text-sm text-gray-500">
                No header fields selected
              </span>
            ) : (
              headerFields.map((fk) => {
                const info = getHeaderFieldInfo(fk);
                return (
                  <div key={fk} className="min-w-[120px] sm:min-w-[140px]">
                    <div className="text-xs text-gray-500">
                      {getHeaderFieldLabel(fk)}
                    </div>
                    <FieldValueRenderer
                      value={getHeaderFieldValue(fk)}
                      fieldInfo={info ? { key: info.key, label: info.label, fieldType: info.fieldType, lookupType: info.lookupType, multiSelectLookupType: info.multiSelectLookupType } : { key: fk, label: getHeaderFieldLabel(fk) }}
                      emptyPlaceholder="-"
                      clickable
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT: pencil + existing actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setShowHeaderFieldModal(true)}
              className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900"
              aria-label="Edit header fields"
              title="Edit header fields"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20h9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <ActionDropdown label="Printable" options={printableOptions} />
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
              disabled={!jobSeeker}
            >
              <BsFillPinAngleFill size={18} />
            </button>

            <button
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Reload"
              onClick={() => jobSeekerId && fetchJobSeeker(jobSeekerId)}
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

      {/* Navigation Tabs - scroll horizontally on small screens */}
      <div className="flex bg-gray-300 mt-1 border-b border-gray-400 px-2 overflow-x-auto">
        <div className="flex shrink-0 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap ${activeTab === tab.id
                ? "bg-gray-200 rounded-t border-t border-r border-l border-gray-400 font-medium"
                : "text-gray-700 hover:bg-gray-200"
                }`}
              onClick={() => {
                if (tab.id === "modify") {
                  handleEdit();
                } else if (tab.id === "applications") {
                  setActiveTab(tab.id);
                  if (jobSeekerId) fetchApplications(jobSeekerId);
                } else {
                  setActiveTab(tab.id);
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action Buttons - wrap on small screens */}
      <div className="flex bg-gray-300 p-2 flex-wrap gap-2">
        {quickTabs.map((action) => (
          <button
            key={action.id}
            className={`${activeQuickTab === action.id
              ? "bg-white text-blue-600 font-medium"
              : "bg-white text-gray-700 hover:bg-gray-100"
              } px-3 sm:px-4 py-1 rounded-full shadow text-sm sm:text-base`}
            onClick={() => setActiveQuickTab(action.id)}
          >
            {action.label} ({action.count})
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="p-2 sm:p-4 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {activeTab === "summary" && (
            <div className="col-span-1 lg:col-span-7 relative w-full min-w-0">
              {/* Pinned side drawer */}
              {/* {isPinned && (
                <div className={`mt-12 fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transition-all duration-300 ${isCollapsed ? "w-12" : "w-1/3"} border-l border-gray-300`}>
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                      <h3 className="font-semibold text-sm">Job Seeker Summary</h3>
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
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
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

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="col-span-1 lg:col-span-7 min-w-0">{renderNotesTab()}</div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="col-span-1 lg:col-span-7 min-w-0">{renderHistoryTab()}</div>
          )}

          {/* Modify Tab */}
          {activeTab === "modify" && (
            <div className="col-span-1 lg:col-span-7 min-w-0">{renderModifyTab()}</div>
          )}

          {/* Docs Tab */}
          {activeTab === "docs" && (
            <div className="col-span-1 lg:col-span-7 min-w-0">
              <div className="bg-white p-4 rounded shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Job Seeker Documents</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={triggerFileInput}
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

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
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
                        onClick={triggerFileInput}
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

                {Object.keys(uploadErrors).length > 0 && (
                  <div className="mb-4 space-y-2">
                    {Object.entries(uploadErrors).map(([fileName, err]) => (
                      <div key={fileName} className="bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-sm text-red-800">
                          <strong>{fileName}:</strong> {err}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {showAddDocument && (
                  <div className="mb-6 p-4 bg-gray-50 rounded border">
                    <h3 className="font-medium mb-2">Add New Document</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Document Name *</label>
                        <input
                          type="text"
                          value={newDocumentName}
                          onChange={(e) => setNewDocumentName(e.target.value)}
                          placeholder="Enter document name"
                          className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Document Type</label>
                        <select
                          value={newDocumentType}
                          onChange={(e) => setNewDocumentType(e.target.value)}
                          className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="General">General</option>
                          <option value="Contract">Contract</option>
                          <option value="Agreement">Agreement</option>
                          <option value="Policy">Policy</option>
                          <option value="Welcome">Welcome</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Content</label>
                        <textarea
                          value={newDocumentContent}
                          onChange={(e) => setNewDocumentContent(e.target.value)}
                          placeholder="Enter document content..."
                          className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={6}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-3">
                      <button
                        onClick={() => setShowAddDocument(false)}
                        className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddDocument}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        disabled={!newDocumentName.trim()}
                      >
                        Save Document
                      </button>
                    </div>
                  </div>
                )}

                {isLoadingDocuments ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : documentError ? (
                  <div className="text-red-500 py-2">{documentError}</div>
                ) : filteredAndSortedDocuments.length > 0 ? (
                  <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <DndContext collisionDetection={closestCorners} onDragEnd={handleDocumentColumnDragEnd}>
                      <table className="w-full border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-100 border-b">
                            <th className="text-left p-3 font-medium">Actions</th>
                            <SortableContext
                              items={documentColumnFields}
                              strategy={horizontalListSortingStrategy}
                            >
                              {documentColumnFields.map((key) => {
                                const columnInfo = getDocumentColumnInfo(key);
                                if (!columnInfo) return null;

                                return (
                                  <SortableColumnHeader
                                    key={key}
                                    id={key}
                                    columnKey={key}
                                    label={getDocumentColumnLabel(key)}
                                    sortState={documentColumnSorts[key] || null}
                                    filterValue={documentColumnFilters[key] || null}
                                    onSort={() => handleDocumentColumnSort(key)}
                                    onFilterChange={(value) => handleDocumentColumnFilter(key, value)}
                                    filterType={columnInfo.filterType}
                                    filterOptions={
                                      key === "document_type" ? documentTypeOptions : undefined
                                    }
                                  />
                                );
                              })}
                            </SortableContext>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAndSortedDocuments.map((doc) => (
                            <tr key={doc.id} className="border-b hover:bg-gray-50">
                              <td className="p-3">
                                <ActionDropdown
                                  label="Actions"
                                  options={[
                                    { label: "View", action: () => setSelectedDocument(doc) },
                                    { label: "Edit", action: () => handleEditDocument(doc) },
                                    { label: "Download", action: () => handleDownloadDocument(doc) },
                                    { label: "Delete", action: () => handleDeleteDocument(doc.id) },
                                  ]}
                                />
                              </td>
                              {documentColumnFields.map((key) => (
                                <td key={key} className="p-3">
                                  {key === "document_name" ? (
                                    <button
                                      onClick={() => setSelectedDocument(doc)}
                                      className="text-blue-600 hover:underline font-medium"
                                    >
                                      {getDocumentColumnValue(doc, key)}
                                    </button>
                                  ) : (
                                    getDocumentColumnValue(doc, key)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </DndContext>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">
                    {documents.length === 0
                      ? "No documents available"
                      : "No documents match the current filters"}
                  </p>
                )}

                {/* Edit Document Modal (Name + Type only) */}
                {showEditDocumentModal && editingDocument && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-50">
                    <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
                      <h3 className="text-lg font-semibold mb-4">Edit Document</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Document Name *</label>
                          <input
                            type="text"
                            value={editDocumentName}
                            onChange={(e) => setEditDocumentName(e.target.value)}
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Document Type *</label>
                          <select
                            value={editDocumentType}
                            onChange={(e) => setEditDocumentType(e.target.value)}
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Contract">Contract</option>
                            <option value="Invoice">Invoice</option>
                            <option value="Report">Report</option>
                            <option value="ID">ID</option>
                            <option value="General">General</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2 mt-5">
                        <button
                          onClick={() => {
                            setShowEditDocumentModal(false);
                            setEditingDocument(null);
                            setEditDocumentName("");
                            setEditDocumentType("General");
                          }}
                          className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleUpdateDocument}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50"
                          disabled={!editDocumentName.trim()}
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Viewer Modal */}
                {selectedDocument && (
                  <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] flex flex-col">
                      <div className="bg-gray-100 p-4 border-b flex justify-between items-center shrink-0">
                        <h2 className="text-lg font-semibold">{selectedDocument.document_name || selectedDocument.name || "Untitled Document"}</h2>
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
                              documentName={selectedDocument.document_name || selectedDocument.name}
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
              </div>
            </div>
          )}

          {activeTab === "references" && (
            <div className="col-span-1 lg:col-span-7 min-w-0">
              <div className="bg-white p-4 rounded shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">References</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddReferenceModal(true)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded hover:bg-gray-50"
                    >
                      Add Reference
                    </button>
                    <button
                      onClick={() => setShowReferenceModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Send Reference Form
                    </button>
                  </div>
                </div>

                {isLoadingReferences && (
                  <div className="text-sm text-gray-500 mb-3">Loading...</div>
                )}

                {referencesError && (
                  <div className="text-sm text-red-600 mb-3">{referencesError}</div>
                )}

                {references.length === 0 ? (
                  <div className="text-gray-500 italic">
                    No references saved yet.
                  </div>
                ) : (
                  <div className="border rounded overflow-hidden">
                    <div className="divide-y">
                      {references.map((ref) => (
                        <div
                          key={ref.id}
                          className="flex items-start justify-between p-3"
                        >
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {ref.name || "Unnamed"}
                            </div>
                            <div className="text-sm text-gray-600">
                              {ref.role || "-"}
                              {ref.company ? `, ${ref.company}` : ""}
                            </div>
                            <div className="text-sm text-gray-600">
                              {ref.email || "-"}
                              {ref.phone ? ` | ${ref.phone}` : ""}
                            </div>
                            {ref.relationship ? (
                              <div className="text-xs text-gray-500 mt-1">
                                Relationship: {ref.relationship}
                              </div>
                            ) : null}
                          </div>
                          <button
                            onClick={() => handleDeleteReference(ref.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                            title="Delete reference"
                          >
                            <FiX size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "applications" && (
            <div className="col-span-1 lg:col-span-7 min-w-0">
              <div className="bg-white p-4 rounded shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Applications</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => jobSeekerId && fetchApplications(jobSeekerId)}
                      className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-xs"
                      disabled={!jobSeekerId || isLoadingApplications}
                    >
                      Reload
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    className={`px-3 py-1 rounded-full text-sm border ${applicationsView === "web_submissions"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                    onClick={() => setApplicationsView("web_submissions")}
                  >
                    Web Submissions ({applications.filter((a) => a?.type === "web_submissions").length})
                  </button>
                  <button
                    className={`px-3 py-1 rounded-full text-sm border ${applicationsView === "submissions"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                    onClick={() => setApplicationsView("submissions")}
                  >
                    Submissions ({applications.filter((a) => a?.type === "submissions").length})
                  </button>
                  <button
                    className={`px-3 py-1 rounded-full text-sm border ${applicationsView === "client_submissions"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                    onClick={() => setApplicationsView("client_submissions")}
                  >
                    Client Submissions ({applications.filter((a) => a?.type === "client_submissions").length})
                  </button>
                </div>

                {isLoadingApplications ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : applicationsError ? (
                  <div className="text-red-600 text-sm">{applicationsError}</div>
                ) : (
                  (() => {
                    const filtered = applications
                      .filter((a) => a?.type === applicationsView)
                      .sort(
                        (a, b) =>
                          new Date(b?.created_at || 0).getTime() -
                          new Date(a?.created_at || 0).getTime()
                      );

                    if (filtered.length === 0) {
                      return (
                        <p className="text-gray-500 italic">No records found</p>
                      );
                    }

                    return (
                      <div className="overflow-x-auto border rounded">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100 border-b">
                              <th className="text-left p-3 font-medium">Job</th>
                              <th className="text-left p-3 font-medium">Organization / Client</th>
                              <th className="text-left p-3 font-medium">Status</th>
                              <th className="text-left p-3 font-medium">Created At</th>
                              <th className="text-left p-3 font-medium">Created By</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((app) => (
                              <tr key={app.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 text-sm text-gray-900">
                                  {app.job_title || app.job_id || "-"}
                                </td>
                                <td className="p-3 text-sm text-gray-700">
                                  {app.organization_name || app.client_name || "-"}
                                </td>
                                <td className="p-3 text-sm text-gray-700">
                                  {app.status || "-"}
                                </td>
                                <td className="p-3 text-sm text-gray-700">
                                  {app.created_at
                                    ? new Date(app.created_at).toLocaleString()
                                    : "-"}
                                </td>
                                <td className="p-3 text-sm text-gray-700">
                                  {app.created_by || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {activeTab === "onboarding" && (
            <div className="col-span-1 lg:col-span-7 min-w-0">
              <OnboardingTab jobSeeker={jobSeeker} />
            </div>
          )}

        </div>
      </div>



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
          { value: "General", label: "General" },
          { value: "Resume", label: "Resume" },
          { value: "ID", label: "ID" },
          { value: "Contract", label: "Contract" },
          { value: "Other", label: "Other" },
        ]}
        title="Document Details"
        confirmButtonText="Upload"
      />

      {/* Onboarding Modal */}
      {/* {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                Send Onboarding Documents
              </h3>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => setShowOnboardingModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-700 mb-2">
                Select documents to include as links in the email:
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {onboardingDocs.map((doc) => (
                  <label key={doc.id} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!selectedDocs[doc.id]}
                      onChange={() => toggleDoc(doc.id)}
                    />
                    <span>
                      <span className="font-medium">{doc.name}</span>
                      <div className="text-xs text-gray-500">{doc.url}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="text-sm text-gray-700 mb-4">
              Email will be pre-addressed to{" "}
              <span className="font-medium">{jobSeeker?.email}</span> with
              subject
              <span className="font-medium"> "Onboarding Documents"</span> and
              body:
              <pre className="bg-gray-50 border rounded p-2 mt-1 whitespace-pre-wrap">
                Here are your onboarding documents. Please fill these out and
                return promptly.
              </pre>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 border rounded"
                onClick={() => setShowOnboardingModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSendOnboarding}
              >
                {isOffice365Connected
                  ? "Send via Office 365"
                  : "Open in Outlook"}
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* Reference Form Modal */}
      {showReferenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Send Reference Form</h3>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => {
                  setShowReferenceModal(false);
                  setReferenceEmail("");
                  setSelectedReferenceDocs({});
                }}
              >
                ✕
              </button>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Email Address:
              </label>
              <input
                type="email"
                value={referenceEmail}
                onChange={(e) => setReferenceEmail(e.target.value)}
                placeholder="reference@example.com"
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-700 mb-2">
                Select documents to include as links in the email:
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {referenceDocs.map((doc) => (
                  <label key={doc.id} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!selectedReferenceDocs[doc.id]}
                      onChange={() => toggleReferenceDoc(doc.id)}
                    />
                    <span>
                      <span className="font-medium">{doc.name}</span>
                      <div className="text-xs text-gray-500">{doc.url}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="text-sm text-gray-700 mb-4">
              Email will be pre-addressed to the reference email address with
              subject
              <span className="font-medium"> "Reference Request"</span> and a
              professional message requesting a reference for{" "}
              {jobSeeker?.fullName || "the candidate"}.
            </div>
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 border rounded"
                onClick={() => {
                  setShowReferenceModal(false);
                  setReferenceEmail("");
                  setSelectedReferenceDocs({});
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSendReferenceForm}
              >
                {isOffice365Connected
                  ? "Send via Office 365"
                  : "Open in Outlook"}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Add Reference Modal */}
      {showAddReferenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Add Reference</h3>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => setShowAddReferenceModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Choose how to add:
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={addReferenceMode === "onboarding"}
                    onChange={() => setAddReferenceMode("onboarding")}
                  />
                  Select from onboarding references
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={addReferenceMode === "manual"}
                    onChange={() => setAddReferenceMode("manual")}
                  />
                  Add new reference manually
                </label>
              </div>
            </div>

            {addReferenceMode === "onboarding" ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Onboarding references:
                </label>
                {Array.isArray(jobSeeker?.customFields?.onboardingReferences) &&
                  jobSeeker.customFields.onboardingReferences.length > 0 ? (
                  <select
                    className="w-full p-2 border border-gray-300 rounded"
                    value={selectedOnboardingReferenceIndex}
                    onChange={(e) => setSelectedOnboardingReferenceIndex(e.target.value)}
                  >
                    <option value="">Select a reference...</option>
                    {(jobSeeker.customFields.onboardingReferences as any[]).map(
                      (r, idx) => (
                        <option key={idx} value={String(idx)}>
                          {(r?.name || "Unnamed") + (r?.company ? ` (${r.company})` : "")}
                        </option>
                      )
                    )}
                  </select>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No onboarding references found.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    className="w-full p-2 border border-gray-300 rounded"
                    value={manualReferenceForm.name}
                    onChange={(e) =>
                      setManualReferenceForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <input
                      className="w-full p-2 border border-gray-300 rounded"
                      value={manualReferenceForm.role}
                      onChange={(e) =>
                        setManualReferenceForm((p) => ({ ...p, role: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company
                    </label>
                    <input
                      className="w-full p-2 border border-gray-300 rounded"
                      value={manualReferenceForm.company}
                      onChange={(e) =>
                        setManualReferenceForm((p) => ({ ...p, company: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full p-2 border border-gray-300 rounded"
                      value={manualReferenceForm.email}
                      onChange={(e) =>
                        setManualReferenceForm((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      className="w-full p-2 border border-gray-300 rounded"
                      value={manualReferenceForm.phone}
                      onChange={(e) =>
                        setManualReferenceForm((p) => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Relationship
                  </label>
                  <input
                    className="w-full p-2 border border-gray-300 rounded"
                    value={manualReferenceForm.relationship}
                    onChange={(e) =>
                      setManualReferenceForm((p) => ({ ...p, relationship: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 border rounded"
                onClick={() => setShowAddReferenceModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleAddReference}
              >
                Save
              </button>
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
                Edit Fields - {editingPanel === "jobSeekerDetails" ? "Job Seeker Details" : editingPanel}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              {editingPanel === "jobSeekerDetails" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all job seeker records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setJobSeekerDetailsDragActiveId(e.active.id as string)}
                    onDragEnd={handleJobSeekerDetailsDragEnd}
                    onDragCancel={() => setJobSeekerDetailsDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalJobSeekerDetailsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {modalJobSeekerDetailsOrder.map((key) => {
                          const label = jobSeekerDetailsFieldCatalog.find((f) => f.key === key)?.label ?? key;
                          const entry = jobSeekerDetailsFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableJobSeekerDetailsFieldRow
                              key={key}
                              id={key}
                              label={label}
                              checked={!!modalJobSeekerDetailsVisible[key]}
                              onToggle={() =>
                                setModalJobSeekerDetailsVisible((prev) => ({
                                  ...prev,
                                  [key]: !prev[key],
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={dropAnimationConfig}>
                      {jobSeekerDetailsDragActiveId ? (() => {
                        const label = jobSeekerDetailsFieldCatalog.find((f) => f.key === jobSeekerDetailsDragActiveId)?.label ?? jobSeekerDetailsDragActiveId;
                        const entry = jobSeekerDetailsFieldCatalog.find((f) => f.key === jobSeekerDetailsDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableJobSeekerDetailsFieldRow
                            id={jobSeekerDetailsDragActiveId}
                            label={label}
                            checked={!!modalJobSeekerDetailsVisible[jobSeekerDetailsDragActiveId]}
                            onToggle={() => { }}
                            isOverlay
                          />
                        );
                      })() : null}
                    </DragOverlay>
                  </DndContext>
                  <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
                    <button
                      onClick={handleCloseEditModal}
                      className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveJobSeekerDetailsFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : editingPanel === "resume" ? (
                // Resume panel: Show ALL fields (standard + custom) from Field Management
                <div className="mb-4">
                  <h3 className="font-medium mb-3">All Available Fields:</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                    {isLoadingFields ? (
                      <div className="text-center py-4 text-gray-500">
                        Loading fields...
                      </div>
                    ) : (
                      <>
                        {/* All Standard Fields for Resume (using headerFieldCatalog which includes all standard + custom) */}
                        {headerFieldCatalog.map((field) => {
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
                            </div>
                          );
                        })}

                        {/* Also include original resume-specific fields if not already in headerFieldCatalog */}
                        {(() => {
                          const resumeSpecificFields = [
                            { key: "profile", label: "Profile" },
                            { key: "skills", label: "Skills" },
                            { key: "experience", label: "Work Experience" },
                          ];
                          const existingKeys = new Set(headerFieldCatalog.map(f => f.key));
                          return resumeSpecificFields
                            .filter(f => !existingKeys.has(f.key))
                            .map((field) => {
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
                      </>
                    )}
                  </div>
                </div>
              ) : editingPanel === "overview" ? (
                // Overview panel: drag to reorder, checkbox to toggle visibility (persists for all job seeker records)
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all job seeker records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setOverviewDragActiveId(e.active.id as string)}
                    onDragEnd={handleOverviewDragEnd}
                    onDragCancel={() => setOverviewDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalOverviewOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {modalOverviewOrder.map((key) => {
                          const label = overviewFieldCatalog.find((f) => f.key === key)?.label ?? key;
                          const entry = overviewFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableJobSeekerDetailsFieldRow
                              key={key}
                              id={key}
                              label={label}
                              checked={!!modalOverviewVisible[key]}
                              onToggle={() =>
                                setModalOverviewVisible((prev) => ({
                                  ...prev,
                                  [key]: !prev[key],
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={dropAnimationConfig}>
                      {overviewDragActiveId ? (() => {
                        const label = overviewFieldCatalog.find((f) => f.key === overviewDragActiveId)?.label ?? overviewDragActiveId;
                        const entry = overviewFieldCatalog.find((f) => f.key === overviewDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableJobSeekerDetailsFieldRow
                            id={overviewDragActiveId}
                            label={label}
                            checked={!!modalOverviewVisible[overviewDragActiveId]}
                            onToggle={() => { }}
                            isOverlay
                          />
                        );
                      })() : null}
                    </DragOverlay>
                  </DndContext>
                  <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
                    <button
                      onClick={handleCloseEditModal}
                      className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveOverviewFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
                // Other panels (jobSeekerDetails): Keep existing behavior
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
                      ) : availableFields.length > 0 ? (
                        availableFields.map((field) => {
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
                          <p>No custom fields available</p>
                          <p className="text-xs mt-1">
                            Fields from the modify page will appear here
                          </p>
                        </div>
                      )}
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
                          jobSeekerDetails: [
                            { key: "status", label: "Status" },
                            {
                              key: "currentOrganization",
                              label: "Current Organization",
                            },
                            { key: "title", label: "Title" },
                            { key: "email", label: "Email" },
                            { key: "mobilePhone", label: "Mobile Phone" },
                            { key: "address", label: "Address" },
                            { key: "desiredSalary", label: "Desired Salary" },
                            { key: "dateAdded", label: "Date Added" },
                            { key: "lastContactDate", label: "Last Contact" },
                            { key: "owner", label: "User Owner" },
                          ],
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8">
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
      )}

      {/* Delete Request Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Request Delete (Job Seeker)</h2>
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
            <div className="p-6 space-y-4">
              {pendingDeleteRequest && pendingDeleteRequest.status === "pending" ? (
                <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-800">
                  A delete request is already pending for this job seeker. Payroll will approve or deny it.
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Request archival and permanent deletion of this job seeker. Payroll will be notified and must approve or deny.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason for deletion <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={deleteForm.reason}
                      onChange={(e) => setDeleteForm((prev) => ({ ...prev, reason: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Enter reason..."
                      required
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteForm({ reason: "" });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                disabled={isSubmittingDelete}
              >
                Cancel
              </button>
              {!(pendingDeleteRequest && pendingDeleteRequest.status === "pending") && (
                <button
                  onClick={handleDeleteRequestSubmit}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                  disabled={isSubmittingDelete || !deleteForm.reason.trim()}
                >
                  {isSubmittingDelete ? "Submitting..." : "Submit Delete Request"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Transfer Job Seeker</h2>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferForm({ targetJobSeekerId: "" });
                  setTransferSearchQuery("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Job Seeker</label>
                <p className="text-sm text-gray-900 font-medium">
                  {jobSeeker ? `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.full_name || `${jobSeeker.last_name || ""}, ${jobSeeker.first_name || ""}`.trim() || "N/A"}` : "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500 mr-1">•</span>
                  Select Target Job Seeker
                </label>
                {isLoadingTransferTargets ? (
                  <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                    Loading job seekers...
                  </div>
                ) : availableJobSeekersForTransfer.length === 0 ? (
                  <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                    No available job seekers found
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
                      placeholder="Search by name or Record ID..."
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {showTransferDropdown && filteredTransferJobSeekers.length > 0 && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                        {filteredTransferJobSeekers.map((js: any) => {
                          const displayName = js?.full_name || `${js?.last_name || ""}, ${js?.first_name || ""}`.trim() || "Unnamed";
                          return (
                            <button
                              key={js.id}
                              type="button"
                              onClick={() => {
                                setTransferForm((prev) => ({ ...prev, targetJobSeekerId: String(js.id) }));
                                setTransferSearchQuery(`${formatRecordId(js.id, "jobSeeker")} ${displayName}`.trim());
                                setShowTransferDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                            >
                              <span className="text-sm font-medium text-gray-900">
                                {formatRecordId(js.id, "jobSeeker")} {displayName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will create a transfer request. This job seeker&apos;s notes, documents, tasks, placements, and applications will move to the target job seeker, and this record will be archived. Payroll will be notified and must approve or deny.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferForm({ targetJobSeekerId: "" });
                  setTransferSearchQuery("");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                disabled={isSubmittingTransfer}
              >
                Cancel
              </button>
              <button
                onClick={handleTransferSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmittingTransfer || !transferForm.targetJobSeekerId}
              >
                {isSubmittingTransfer ? "Submitting..." : "Submit Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddTearsheetModal
        open={showAddTearsheetModal}
        onClose={() => setShowAddTearsheetModal(false)}
        entityType="job_seeker"
        entityId={jobSeekerId || ""}
      />

      {/* Add Note Modal - Jobs-style layout */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-2 sm:mx-4 my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
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
                    Note Text{" "}
                    {noteForm.text.length > 0 ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <textarea
                    value={noteForm.text}
                    autoFocus
                    onChange={(e) =>
                      setNoteForm((prev) => ({ ...prev, text: e.target.value }))
                    }
                    placeholder="Enter your note text here. Reference people and distribution lists using @ (e.g. @John Smith). Reference other records using # (e.g. #Project Manager)."
                    className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                  />
                </div>

                {/* Action Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action{" "}
                    {noteForm.action ? (
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
                      className={`w-full p-2 border rounded focus:outline-none focus:ring-2 ${validationErrors.action
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:ring-blue-500"
                        }`}
                    >
                      <option value="">Select Action</option>
                      {actionFields.map((field) => (
                        <option
                          key={field.id || field.field_name || field.field_label}
                          value={field.field_label || field.field_name || ""}
                        >
                          {field.field_label || field.field_name || ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {validationErrors.action && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.action}</p>
                  )}
                </div>

                {/* About / Reference - Jobs-style (tags + search + suggestions) */}
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
                    {noteForm.aboutReferences && noteForm.aboutReferences.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-300 rounded bg-gray-50 min-h-[40px]">
                        {noteForm.aboutReferences.map((ref, index) => (
                          <span
                            key={`${ref.type}-${ref.id}-${index}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                          >
                            <FiUsers className="w-4 h-4" />
                            {ref.display}
                            <button
                              type="button"
                              onClick={() => removeAboutReference(index)}
                              className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      {noteForm.aboutReferences && noteForm.aboutReferences.length > 0 && (
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Add Additional References
                        </label>
                      )}
                      <input
                        type="text"
                        value={aboutSearchQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAboutSearchQuery(value);
                          if (value.trim().length >= 2) searchAboutReferences(value);
                        }}
                        onFocus={() => {
                          if (aboutSearchQuery.trim().length >= 2) {
                            setShowAboutDropdown(true);
                          }
                        }}
                        placeholder={
                          noteForm.aboutReferences && noteForm.aboutReferences.length === 0
                            ? "Search and select records (e.g., Job, Org, Lead, Placement)..."
                            : "Type to search more references..."
                        }
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 pr-8 ${validationErrors.about
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                          }`}
                      />
                      <span className="absolute right-2 top-2 text-gray-400 text-sm">Q</span>
                    </div>

                    {validationErrors.about && (
                      <p className="mt-1 text-sm text-red-500">{validationErrors.about}</p>
                    )}

                    {showAboutDropdown && (
                      <div
                        data-about-dropdown
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                      >
                        {isLoadingAboutSearch ? (
                          <div className="p-3 text-sm text-gray-500 text-center">Searching...</div>
                        ) : aboutSuggestions.length > 0 ? (
                          aboutSuggestions.map((suggestion, idx) => (
                            <button
                              key={`${suggestion.type}-${suggestion.id}-${idx}`}
                              type="button"
                              onClick={() => handleAboutReferenceSelect(suggestion)}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{suggestion.display}</div>
                                  <div className="text-xs text-gray-500">{suggestion.type}</div>
                                </div>
                                <span className="text-xs text-blue-600 font-medium">{suggestion.value}</span>
                              </div>
                            </button>
                          ))
                        ) : aboutSearchQuery.trim().length >= 2 ? (
                          <div className="p-3 text-sm text-gray-500 text-center">No references found</div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule Next Action - Job Seeker specific */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Next Action
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((prev) => ({ ...prev, scheduleNextAction: "None" }))
                      }
                      className={`px-4 py-2 rounded text-sm font-medium ${noteForm.scheduleNextAction === "None"
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((prev) => ({ ...prev, scheduleNextAction: "Appointment" }))
                      }
                      className={`px-4 py-2 rounded text-sm font-medium ${noteForm.scheduleNextAction === "Appointment"
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      Appointment
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((prev) => ({ ...prev, scheduleNextAction: "Task" }))
                      }
                      className={`px-4 py-2 rounded text-sm font-medium ${noteForm.scheduleNextAction === "Task"
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      Task
                    </button>
                  </div>
                </div>

                {/* Copy Note - Job Seeker specific */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Copy Note
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((prev) => ({ ...prev, copyNote: "No" }))
                      }
                      className={`px-4 py-2 rounded text-sm font-medium ${noteForm.copyNote === "No"
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((prev) => ({ ...prev, copyNote: "Yes" }))
                      }
                      className={`px-4 py-2 rounded text-sm font-medium ${noteForm.copyNote === "Yes"
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      Yes
                    </button>
                  </div>
                  {noteForm.copyNote === "Yes" && (
                    <label className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noteForm.replaceGeneralContactComments}
                        onChange={(e) =>
                          setNoteForm((prev) => ({
                            ...prev,
                            replaceGeneralContactComments: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        Replace the General Contact Comments with this note?
                      </span>
                    </label>
                  )}
                </div>

                {/* Email Notification - Search and add (matches About/Reference design) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Notification
                  </label>
                  <div className="relative" ref={emailInputRef}>
                    {noteForm.emailNotification.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-300 rounded bg-gray-50 min-h-[40px]">
                        {noteForm.emailNotification.map((val) => (
                          <span
                            key={val}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                          >
                            <HiOutlineUser className="w-4 h-4 shrink-0" />
                            {val}
                            <button
                              type="button"
                              onClick={() => removeEmailNotification(val)}
                              className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {noteForm.emailNotification.length > 0 && (
                      <label className="block text-xs font-medium text-gray-500 mb-1">Add Additional Users</label>
                    )}
                    <div className="relative">
                      {isLoadingUsers ? (
                        <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                          Loading users...
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={emailSearchQuery}
                          onChange={(e) => {
                            setEmailSearchQuery(e.target.value);
                            setShowEmailDropdown(true);
                          }}
                          onFocus={() => setShowEmailDropdown(true)}
                          placeholder={
                            noteForm.emailNotification.length === 0
                              ? "Search and add users to notify..."
                              : "Add another user..."
                          }
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                        />
                      )}
                      {!isLoadingUsers && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                          <FiSearch className="w-4 h-4" />
                        </span>
                      )}
                    </div>
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
                                <div className="text-sm font-medium text-gray-900">{user.name || user.email}</div>
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
      {/* Header Fields Modal (PENCIL-HEADER-MODAL) */}
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
                  Drag to reorder. Toggle visibility with the checkbox. Changes apply to all job seeker records.
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
                      setHeaderFields(DEFAULT_HEADER_FIELDS);
                      setHeaderFieldsOrder(DEFAULT_HEADER_FIELDS);
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
                    disabled={headerFields.length === 0}
                  >
                    Done
                  </button>
                </div>
              </DndContext>
            </div>
          </div>
        </div>
      )}

      {isResumeEditorOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Edit Resume Content</h2>
              <button
                onClick={closeResumeEditor}
                className="p-1 rounded hover:bg-gray-200"
                disabled={isSavingResume}
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6 space-y-3">
              <textarea
                value={resumeDraft}
                onChange={(e) => setResumeDraft(e.target.value)}
                className="w-full min-h-[60vh] border border-gray-300 rounded p-3 text-sm font-mono leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Resume content..."
              />

              {resumeSaveError && (
                <div className="text-sm text-red-600">{resumeSaveError}</div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={closeResumeEditor}
                  className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  disabled={isSavingResume}
                >
                  Cancel
                </button>
                <button
                  onClick={saveResumeText}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                  disabled={isSavingResume}
                >
                  {isSavingResume ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
