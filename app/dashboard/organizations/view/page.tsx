"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import PanelWithHeader from "@/components/PanelWithHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { HiOutlineOfficeBuilding, HiOutlineUser } from "react-icons/hi";
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import CountdownTimer from "@/components/CountdownTimer";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
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
import { TbGripVertical } from "react-icons/tb";
import {
  FiLock,
  FiUnlock,
  FiEdit2,
  FiStar,
  FiArrowUp,
  FiArrowDown,
  FiFilter,
  FiSearch,
} from "react-icons/fi";
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
import RecordNameResolver from "@/components/RecordNameResolver";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import { toast } from "sonner";
import AddTearsheetModal from "@/components/AddTearsheetModal";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import RequestActionModal from "@/components/RequestActionModal";
import AddNoteModal from "@/components/AddNoteModal";

// Default header fields for Organizations module - defined outside component to ensure stable reference
const ORG_DEFAULT_HEADER_FIELDS = ["phone", "website"];

const ORG_PANEL_TITLES: Record<string, string> = {
  contactInfo: "Organization Contact Info:",
  about: "About:",
  recentNotes: "Recent Notes:",
  websiteJobs: "Open Jobs from Website:",
  ourJobs: "Our Jobs:",
  openTasks: "Open Tasks:",
};

// Storage for Organization Contact Info panel – field list comes from admin (custom field definitions)
const CONTACT_INFO_STORAGE_KEY = "organizationContactInfoFields";

// Sortable Panel Component with drag handle
function SortablePanel({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
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

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 p-1 bg-gray-100 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <TbGripVertical className="no-print w-5 h-5 text-gray-600" />
      </button>
      {children}
    </div>
  );
}

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

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

// Sortable Column Header Component for Documents
function SortableColumnHeader({
  id,
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

const ORG_VIEW_TAB_IDS = ["summary", "modify", "notes", "history", "quotes", "invoices", "contacts", "docs", "opportunities", "jobs", "placements"];

export default function OrganizationView() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  // Null-safe search params (older Next types can mark this as nullable).
  const safeSearchParams = searchParams;
  const hmFilter = safeSearchParams.get("hm");
  const tabFromUrl = safeSearchParams.get("tab");
  const organizationId = safeSearchParams.get("id");

  const [organization, setOrganization] = useState<any>(null);
  // console.log("Organi")
  console.log("Organization", organization)
  const [originalData, setOriginalData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Notes and history state
  const [notes, setNotes] = useState<
    Array<{
      id: string;
      text: string;
      created_at: string;
      created_by_name: string;
      action?: string;
      additional_references?: string;
      about_references?: any;
      aboutReferences?: any;
      note_type?: string;
    }>
  >([]);
  const [history, setHistory] = useState<Array<any>>([]);

  // Note sorting & filtering state
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
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyFilters = useHistoryFilters(history);
  const [showAddNote, setShowAddNote] = useState(false);
  // Add Note form state - matching jobs view structure
  const [noteForm, setNoteForm] = useState({
    text: "",
    action: "",
    about: organization ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}` : "",
    aboutReferences: organization
      ? [
        {
          id: organization.id,
          type: "Organization",
          display: `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}`,
          value: formatRecordId(organization.record_number ?? organization.id, "organization"),
        },
      ]
      : [],
    copyNote: "No",
    replaceGeneralContactComments: false,
    additionalReferences: "",
    scheduleNextAction: "None",
    emailNotification: [] as string[],
  });
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<{
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

  // Documents state
  const [documents, setDocuments] = useState<Array<any>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any | null>(null);
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [editDocumentName, setEditDocumentName] = useState("");
  const [editDocumentType, setEditDocumentType] = useState("General");
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newDocumentType, setNewDocumentType] = useState("General");
  const [newDocumentContent, setNewDocumentContent] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  // Document table columns state
  const DOCUMENT_DEFAULT_COLUMNS = ["document_name", "document_type", "source", "is_auto_generated", "created_by_name", "created_at"];
  const [documentColumnFields, setDocumentColumnFields] = useState<string[]>(DOCUMENT_DEFAULT_COLUMNS);
  const [documentColumnSorts, setDocumentColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [documentColumnFilters, setDocumentColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Modal state for confirming file details before upload
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileDetailsName, setFileDetailsName] = useState("");
  const [fileDetailsType, setFileDetailsType] = useState("General");

  // Hiring Managers (Contacts) state
  const [hiringManagers, setHiringManagers] = useState<Array<any>>([]);
  const [isLoadingHiringManagers, setIsLoadingHiringManagers] = useState(false);
  const [hiringManagersError, setHiringManagersError] = useState<string | null>(
    null
  );

  // Contacts tab: sortable/filterable column state
  const CONTACT_DEFAULT_COLUMNS = ["name", "title", "email", "phone", "jobs", "status"];
  const [contactColumnFields, setContactColumnFields] = useState<string[]>(CONTACT_DEFAULT_COLUMNS);
  const [contactColumnSorts, setContactColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [contactColumnFilters, setContactColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [contactSearchTerm, setContactSearchTerm] = useState("");

  // Tasks state
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<Array<any>>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  // Website metadata state
  const [websiteMetadata, setWebsiteMetadata] = useState<{
    title: string;
    faviconUrl: string;
    domain: string;
    url: string;
  } | null>(null);
  const [isLoadingWebsiteMetadata, setIsLoadingWebsiteMetadata] = useState(false);

  const [placements, setPlacements] = useState<Array<any>>([]);
  const [isLoadingPlacements, setIsLoadingPlacements] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const filteredJobs = hmFilter
    ? jobs.filter((j: any) => norm(j.hiring_manager) === norm(hmFilter))
    : jobs;

  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);

  // Transfer modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    targetOrganizationId: "", // Organization to transfer to
  });
  const [availableOrganizations, setAvailableOrganizations] = useState<any[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferSearchQuery, setTransferSearchQuery] = useState("");
  const [showTransferDropdown, setShowTransferDropdown] = useState(false);
  const transferSearchRef = useRef<HTMLDivElement>(null);

  // Delete request modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteFromUrl = safeSearchParams.get("delete");
  const [deleteForm, setDeleteForm] = useState({
    reason: "", // Mandatory reason for deletion
  });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<any>(null);
  const [isLoadingDeleteRequest, setIsLoadingDeleteRequest] = useState(false);

  // Check for delete parameter in URL to open delete modal
  useEffect(() => {
    if (deleteFromUrl === "true" && !showDeleteModal) {
      setShowDeleteModal(true);
      // Remove the delete parameter from URL after opening modal
      const params = new URLSearchParams(safeSearchParams.toString());
      params.delete("delete");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [deleteFromUrl, showDeleteModal, safeSearchParams, router]);

  // Dependency check state
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false);
  const [dependencyCounts, setDependencyCounts] = useState<any>(null);
  const [showDependencyWarningModal, setShowDependencyWarningModal] = useState(false);
  const [deleteActionType, setDeleteActionType] = useState<"standard" | "cascade">("standard");
  const [cascadeUserConsent, setCascadeUserConsent] = useState(false);

  // Unarchive request modal state
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [unarchiveReason, setUnarchiveReason] = useState("");
  const [isSubmittingUnarchive, setIsSubmittingUnarchive] = useState(false);

  // Summary counts state
  const [summaryCounts, setSummaryCounts] = useState({
    clientVisits: 0,
    jobs: 0,
    submissions: 0,
    clientSubmissions: 0,
    interviews: 0,
    placements: 0,
  });
  const [isLoadingSummaryCounts, setIsLoadingSummaryCounts] = useState(false);

  // Derived counts on the frontend so pills always match visible data
  const clientVisitNoteCount = useMemo(
    () =>
      notes.filter((n) =>
        (n.action || "").toLowerCase().includes("client visit")
      ).length,
    [notes]
  );
  const organizationJobsCount = useMemo(() => jobs.length, [jobs]);

  // Current active tab (sync with ?tab= URL param for shareable links)
  const [activeTab, setActiveTabState] = useState(() =>
    tabFromUrl && ORG_VIEW_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "summary"
  );

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    const params = new URLSearchParams(safeSearchParams.toString());
    if (tabId === "summary") params.delete("tab");
    else params.set("tab", tabId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (tabFromUrl && ORG_VIEW_TAB_IDS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    } else if (!tabFromUrl && activeTab !== "summary") {
      setActiveTabState("summary");
    }
  }, [tabFromUrl]);

  // Editable fields in Modify tab
  const [editableFields, setEditableFields] = useState<any>({});

  // Pin/Pop-out panel state
  const [isPinned, setIsPinned] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // Panel order state for drag-and-drop
  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["contactInfo", "about"],
    right: ["recentNotes", "websiteJobs", "ourJobs", "openTasks"],
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Editable "About" text state
  const [aboutText, setAboutText] = useState("");
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [tempAboutText, setTempAboutText] = useState("");
  // Website (jobs page) edit state for "Open Jobs from Website" panel
  const [isEditingWebsiteUrl, setIsEditingWebsiteUrl] = useState(false);
  const [tempWebsiteUrl, setTempWebsiteUrl] = useState("");
  const [isSavingWebsiteUrl, setIsSavingWebsiteUrl] = useState(false);

  // Action fields (Field_500) for notes
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

  // Field management state
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
  } = useHeaderConfig({
    entityType: "ORGANIZATION",
    defaultFields: ORG_DEFAULT_HEADER_FIELDS,
    configType: "header",
  });

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

  const getHeaderFieldValue = (key: string) => {
    if (!organization) return "-";
    const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;
    const o = organization as any;
    let v = o[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    if (o.contact?.[rawKey] !== undefined) return String(o.contact[rawKey] ?? "-");
    if (rawKey === "contact_phone" || rawKey === "phone") return String(o.contact_phone ?? o.phone ?? "(Not provided)");
    if (rawKey === "nickname") return String(o.nicknames ?? o.contact?.nickname ?? "-");
    v = o.customFields?.[rawKey];
    if (v !== undefined && v !== null) return String(v);
    const field = headerFieldCatalog.find((f) => f.key === key);
    if (field) v = o.customFields?.[field.label];
    return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
  };

  const getHeaderFieldInfo = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found as any;
  };

  const handleUpdateDocument = async () => {
    if (!editingDocument?.id || !organizationId || !editDocumentName.trim()) return;

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/documents/${editingDocument.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
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

  const handleEditDocument = (doc: any) => {
    setEditingDocument(doc);
    setEditDocumentName(doc?.document_name || "");
    setEditDocumentType(doc?.document_type || "General");
    setShowEditDocumentModal(true);
  };

  const getHeaderFieldLabel = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found?.label || key;
  };


  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") {
      return {
        contactInfo: [],
        about: ["about"],
        recentNotes: ["notes"],
        websiteJobs: ["jobs"],
        ourJobs: ["jobs"],
      };
    }
    const saved = localStorage.getItem(CONTACT_INFO_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            contactInfo: parsed,
            about: ["about"],
            recentNotes: ["notes"],
            websiteJobs: ["jobs"],
            ourJobs: ["jobs"],
          };
        }
      } catch (_) { }
    }
    return {
      contactInfo: [],
      about: ["about"],
      recentNotes: ["notes"],
      websiteJobs: ["jobs"],
      ourJobs: ["jobs"],
    };
  });
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Modal-local state for Contact Info edit: order and visibility (only applied on Save)
  const [modalContactInfoOrder, setModalContactInfoOrder] = useState<string[]>([]);
  const [modalContactInfoVisible, setModalContactInfoVisible] = useState<Record<string, boolean>>({});
  // Maintain order for all header fields (including unselected ones for proper ordering)
  const [headerFieldsOrder, setHeaderFieldsOrder] = useState<string[]>([]);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Fetch organization data when component mounts
  useEffect(() => {
    if (organizationId) {
      fetchOrganizationData(organizationId);
    }
  }, [organizationId]);

  // Refresh hiring managers and jobs when returning from adding a hiring manager or job
  useEffect(() => {
    const returnToOrgId = sessionStorage.getItem("returnToOrganizationId");
    if (returnToOrgId && returnToOrgId === organizationId) {
      // Clear the flag
      sessionStorage.removeItem("returnToOrganizationId");
      // Refresh hiring managers and jobs
      if (organizationId) {
        fetchHiringManagers(organizationId);
        fetchJobs(organizationId);
      }
    }
  }, [organizationId]);

  // Refresh tasks when organization changes or when hiring managers/jobs are updated
  useEffect(() => {
    if (organizationId && !isLoadingHiringManagers && !isLoadingJobs) {
      fetchTasks(organizationId);
    }
  }, [organizationId, isLoadingHiringManagers, isLoadingJobs]);

  // Fetch placements when user switches to Placements tab
  useEffect(() => {
    if (organizationId && activeTab === "placements") {
      fetchPlacements(organizationId);
    }
  }, [organizationId, activeTab]);

  // Fetch available fields after organization is loaded
  useEffect(() => {
    if (organization && organizationId) {
      fetchAvailableFields();
      // Update note form about field when organization is loaded
      const defaultAboutRef = [
        {
          id: organization.id,
          type: "Organization",
          display: `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name
            }`,
          value: formatRecordId(organization.record_number ?? organization.id, "organization"),
        },
      ];
      setNoteForm((prev) => ({
        ...prev,
        about: defaultAboutRef.map((ref) => ref.display).join(", "),
        aboutReferences: defaultAboutRef,
      }));
    }
  }, [organization, organizationId]);

  // Fetch users for email notification
  useEffect(() => {
    if (showAddNote) {
      fetchUsers();
    }
  }, [showAddNote]);

  // Initialize columns from localStorage or default
  useEffect(() => {
    const savedColumns = localStorage.getItem("organizationSummaryColumns");
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        if (parsed.left && parsed.right) {
          setColumns(parsed);
        } else {
          setColumns({
            left: ["contactInfo", "about"],
            right: ["recentNotes", "websiteJobs", "ourJobs", "openTasks"],
          });
        }
      } catch (e) {
        console.error("Error loading panel order:", e);
        setColumns({
          left: ["contactInfo", "about"],
          right: ["recentNotes", "websiteJobs", "ourJobs", "openTasks"],
        });
      }
    } else {
      setColumns({
        left: ["contactInfo", "about"],
        right: ["recentNotes", "websiteJobs", "ourJobs", "openTasks"],
      });
    }
  }, []);

  // Save columns to localStorage
  useEffect(() => {
    localStorage.setItem("organizationSummaryColumns", JSON.stringify(columns));
  }, [columns]);

  // Initialize about text from organization
  useEffect(() => {
    if (organization && organization.about) {
      setAboutText(organization.about);
    }
  }, [organization]);

  // Fetch action fields - Field500 / Admin Center field mapping (same logic as Hiring Manager)
  useEffect(() => {
    const fetchActionFields = async () => {
      setIsLoadingActionFields(true);
      try {
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );

        const response = await fetch("/api/admin/field-management/organizations", {
          headers: { Authorization: `Bearer ${token}` },
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
            data.organizationFields ||
            [];

          const fieldNamesToCheck = ["field_500", "actions", "action"];
          const field500 = (fields as any[]).find(
            (f: any) =>
              fieldNamesToCheck.includes(String(f.field_name || "").toLowerCase()) ||
              fieldNamesToCheck.includes(String(f.field_label || "").toLowerCase())
          );

          if (field500 && field500.options) {
            let options = field500.options;
            if (typeof options === "string") {
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
            } else if (typeof options === "object" && options !== null) {
              setActionFields(
                Object.entries(options).map(([key, value]) => ({
                  id: key,
                  field_label: String(value),
                  field_name: key,
                }))
              );
            } else {
              setActionFields([]);
            }
          } else {
            setActionFields([
              { id: "Outbound Call", field_label: "Outbound Call", field_name: "Outbound Call" },
              { id: "Inbound Call", field_label: "Inbound Call", field_name: "Inbound Call" },
              { id: "Left Message", field_label: "Left Message", field_name: "Left Message" },
              { id: "Email", field_label: "Email", field_name: "Email" },
              { id: "Appointment", field_label: "Appointment", field_name: "Appointment" },
              { id: "Client Visit", field_label: "Client Visit", field_name: "Client Visit" },
            ]);
          }
        } else {
          setActionFields([
            { id: "Outbound Call", field_label: "Outbound Call", field_name: "Outbound Call" },
            { id: "Inbound Call", field_label: "Inbound Call", field_name: "Inbound Call" },
            { id: "Left Message", field_label: "Left Message", field_name: "Left Message" },
            { id: "Email", field_label: "Email", field_name: "Email" },
            { id: "Appointment", field_label: "Appointment", field_name: "Appointment" },
            { id: "Client Visit", field_label: "Client Visit", field_name: "Client Visit" },
          ]);
        }
      } catch (err) {
        console.error("Error fetching action fields:", err);
        setActionFields([
          { id: "Outbound Call", field_label: "Outbound Call", field_name: "Outbound Call" },
          { id: "Inbound Call", field_label: "Inbound Call", field_name: "Inbound Call" },
          { id: "Left Message", field_label: "Left Message", field_name: "Left Message" },
          { id: "Email", field_label: "Email", field_name: "Email" },
          { id: "Appointment", field_label: "Appointment", field_name: "Appointment" },
          { id: "Client Visit", field_label: "Client Visit", field_name: "Client Visit" },
        ]);
      } finally {
        setIsLoadingActionFields(false);
      }
    };

    fetchActionFields();
  }, []);

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

  // Search for references for About field
  const searchAboutReferences = async (query: string) => {
    setIsLoadingAboutSearch(true);
    setShowAboutDropdown(true);

    try {
      const searchTerm = (query || "").trim();
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
            display: `${formatRecordId(job.id, "job")} ${job.job_title || "Untitled"
              }`,
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
              org.id?.toString().includes(searchTerm) ||
              String(org.record_number ?? "").includes(searchTerm)
          )
          : (data.organizations || []);
        orgs.forEach((org: any) => {
          suggestions.push({
            id: org.id,
            type: "Organization",
            display: `${formatRecordId(org.record_number ?? org.id, "organization")} ${org.name || "Unnamed"
              }`,
            value: formatRecordId(org.record_number ?? org.id, "organization"),
          });
        });
      }

      // Process job seekers
      if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
        const data = await jobSeekersRes.value.json();
        const seekers = searchTerm
          ? (data.jobSeekers || []).filter(
            (seeker: any) =>
              seeker.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              seeker.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              seeker.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              seeker.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              seeker.id?.toString().includes(searchTerm)
          )
          : (data.jobSeekers || []);
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
        const leads = searchTerm
          ? (data.leads || []).filter(
            (lead: any) =>
              lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              lead.id?.toString().includes(searchTerm)
          )
          : (data.leads || []);
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
            display: `#${task.id} ${task.title || "Untitled"}`,
            value: `#${task.id}`,
          });
        });
      }

      // Process placements
      if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
        const data = await placementsRes.value.json();
        const placements = searchTerm
          ? (data.placements || []).filter(
            (placement: any) =>
              placement.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              placement.jobSeekerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              placement.id?.toString().includes(searchTerm)
          )
          : (data.placements || []);
        placements.forEach((placement: any) => {
          suggestions.push({
            id: placement.id,
            type: "Placement",
            display: `#${placement.id} ${placement.jobSeekerName || "Unnamed"
              } - ${placement.jobTitle || "Untitled"}`,
            value: `#${placement.id}`,
          });
        });
      }

      // Process hiring managers
      if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
        const data = await hiringManagersRes.value.json();
        const hms = searchTerm
          ? (data.hiringManagers || []).filter(
            (hm: any) =>
              hm.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              hm.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              hm.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              hm.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              hm.id?.toString().includes(searchTerm)
          )
          : (data.hiringManagers || []);
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

  // Filtered users for email notification dropdown (exclude already selected)
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

  // Add user to email notification
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

  // Remove user from email notification
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

  // Close Email notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emailInputRef.current &&
        !emailInputRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-email-dropdown]')
      ) {
        setShowEmailDropdown(false);
      }
    };

    if (showEmailDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmailDropdown]);

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
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
        (data as any).customFields ||
        (data as any).fields ||
        (data as any).data?.customFields ||
        (data as any).data?.fields ||
        (data as any).organizationFields ||
        [];
      setAvailableFields(Array.isArray(fields) ? fields : []);
    } catch (err) {
      console.error("Error fetching available fields:", err);
    } finally {
      setIsLoadingFields(false);
    }
  };

  const contactInfoFieldCatalog = useMemo(() => {
    const seenKeys = new Set<string>();
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_key ?? f.field_name ?? f.api_name ?? f.id),
        label: f.field_label || f.field_name || String(f.field_key ?? f.field_name ?? f.api_name ?? f.id),
        fieldType: (f.field_type || f.type) as string | undefined,
        lookupType: (f.lookup_type ?? f.lookupType ?? "") as string,
        multiSelectLookupType: (f.multi_select_lookup_type ?? f.multiSelectLookupType ?? "") as string,
      }))
      .filter((f) => {
        if (seenKeys.has(f.key)) return false;
        seenKeys.add(f.key);
        return true;
      });
    return [...fromApi];
  }, [availableFields]);

  // When catalog loads, if contactInfo visible list is empty, default to all catalog keys so first load shows admin-defined fields
  useEffect(() => {
    const catalogKeys = contactInfoFieldCatalog.map((f) => f.key);
    if (catalogKeys.length === 0) return;
    setVisibleFields((prev) => {
      const current = prev.contactInfo || [];
      if (current.length > 0) return prev;
      return { ...prev, contactInfo: catalogKeys };
    });
  }, [contactInfoFieldCatalog]);

  // Initialize modal state when opening Contact Info edit (order has no duplicate keys)
  useEffect(() => {
    if (editingPanel !== "contactInfo") return;
    const current = visibleFields.contactInfo || [];
    const catalogKeys = contactInfoFieldCatalog.map((f) => f.key);

    const currentInCatalog = current.filter((k) => catalogKeys.includes(k));
    const rest = catalogKeys.filter((k) => !current.includes(k));
    const order = [...currentInCatalog, ...rest];

    const uniqueOrder = Array.from(new Set(order));
    setModalContactInfoOrder(uniqueOrder);

    setModalContactInfoVisible(
      catalogKeys.reduce<Record<string, boolean>>((acc, k) => {
        acc[k] = current.includes(k);
        return acc;
      }, {})
    );
  }, [editingPanel, contactInfoFieldCatalog, visibleFields.contactInfo]);

  // Save Contact Info config (visibility + order) and persist globally
  const saveContactInfoConfig = () => {
    const orderedVisible = modalContactInfoOrder.filter((k) => modalContactInfoVisible[k] === true);
    if (orderedVisible.length === 0) return;

    setVisibleFields((prev) => ({ ...prev, contactInfo: orderedVisible }));
    try {
      localStorage.setItem(CONTACT_INFO_STORAGE_KEY, JSON.stringify(orderedVisible));
    } catch (_) { }
    setEditingPanel(null);
  };

  // Toggle field visibility (used by non-contactInfo panels)
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

  // Contact Info modal: toggle visibility for a field
  const toggleModalContactInfoVisible = (key: string) => {
    setModalContactInfoVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Contact Info modal: drag end handler for reordering
  const handleContactInfoDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setModalContactInfoOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleHeaderFieldsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
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

  // Handle edit panel click
  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Initialize editable fields when organization data is loaded
  useEffect(() => {
    if (organization) {
      // Flatten organization data for editing
      const flattenedData = {
        name: organization.name,
        phone: organization.phone,
        website: organization.website,
        contactName: organization.contact.name,
        contactNickname: organization.contact.nickname || "",
        contactPhone: organization.contactPhone || organization.phone || "",
        contactAddress: organization.contact.address,
        contactWebsite: organization.contact.website,
        about: organization.about,
      };
      setEditableFields(flattenedData);
      setOriginalData({ ...flattenedData });
    }
  }, [organization]);

  // Update the fetchOrganizationData function in app/dashboard/organizations/view/page.tsx

  const fetchOrganizationData = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/organizations/${id}`);
      if (!response.ok) {
        let errorMessage = `Failed to fetch organization: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error("API error detail:", errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.error("Could not parse error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      // Parse the successful response
      const data = await response.json();

      // Parse custom fields
      let customFieldsObj = {};
      if (data.organization.custom_fields) {
        try {
          if (typeof data.organization.custom_fields === "string") {
            customFieldsObj = JSON.parse(data.organization.custom_fields);
          } else if (typeof data.organization.custom_fields === "object") {
            customFieldsObj = data.organization.custom_fields;
          }
        } catch (e) {
          console.error("Error parsing custom fields:", e);
        }
      }

      // FIXED MAPPING: Map the data correctly to display fields
      const formattedOrg = {
        id: data.organization.id,
        record_number: data.organization.record_number,
        name: data.organization.name || "No name provided",
        phone: data.organization.contact_phone || "(Not provided)",
        website: data.organization.website || "https://example.com",
        nicknames: data.organization.nicknames || "",
        parentOrganization: data.organization.parent_organization_name || data.organization.parent_organization || "",
        status: data.organization.status || "Active",
        archived_at: data.organization.archived_at ?? data.organization.archivedAt ?? null,
        contractOnFile: data.organization.contract_on_file || "No",
        dateContractSigned: data.organization.date_contract_signed || "",
        yearFounded: data.organization.year_founded || "",
        permFee: data.organization.perm_fee || "",
        numEmployees: data.organization.num_employees || "",
        numOffices: data.organization.num_offices || "",
        contactPhone: data.organization.contact_phone || "",
        address: data.organization.address || "",
        address2: data.organization.address2 || "",
        city: data.organization.city || "",
        state: data.organization.state || "",
        zip_code: data.organization.zip_code || "",
        parentOrganizationId: data.organization.parent_organization_id ?? (typeof data.organization.parent_organization === "string" && /^\d+$/.test(data.organization.parent_organization.trim()) ? data.organization.parent_organization.trim() : null),
        contact: {
          // IMPORTANT: Use correct field for contact name - this was causing "No contact specified"
          name: data.organization.name || "No name provided",
          nickname: data.organization.nicknames || "",
          phone: data.organization.contact_phone || "(Not provided)",
          address: data.organization.address || "No address provided",
          website: data.organization.website || "https://example.com",
        },
        about: data.organization.overview || "No description provided",
        customFields: customFieldsObj,
      };


      setOrganization(formattedOrg);

      // Fetch website metadata if website URL exists
      if (formattedOrg.website && formattedOrg.website !== "https://example.com") {
        fetchWebsiteMetadata(formattedOrg.website);
      } else {
        setWebsiteMetadata(null);
      }

      // After loading organization data, fetch notes, history, documents, hiring managers, and tasks
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
      fetchHiringManagers(id);
      fetchJobs(id);
      fetchTasks(id);
    } catch (err) {
      console.error("Error fetching organization:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching organization details"
      );
    } finally {
      setIsLoading(false);
    }
  };
  // Fetch website metadata (favicon and title)
  const fetchWebsiteMetadata = async (url: string) => {
    if (!url || url === "https://example.com") {
      setWebsiteMetadata(null);
      return;
    }

    setIsLoadingWebsiteMetadata(true);
    try {
      const response = await fetch(`/api/website-metadata?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        setWebsiteMetadata(data);
      } else {
        // Fallback: extract domain and use Google favicon
        try {
          const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
          const domain = urlObj.hostname.replace(/^www\./, '');
          setWebsiteMetadata({
            domain,
            title: domain,
            faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            url: url.startsWith('http') ? url : `https://${url}`,
          });
        } catch {
          setWebsiteMetadata(null);
        }
      }
    } catch (error) {
      console.error('Error fetching website metadata:', error);
      // Fallback: extract domain and use Google favicon
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const domain = urlObj.hostname.replace(/^www\./, '');
        setWebsiteMetadata({
          domain,
          title: domain,
          faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
          url: url.startsWith('http') ? url : `https://${url}`,
        });
      } catch {
        setWebsiteMetadata(null);
      }
    } finally {
      setIsLoadingWebsiteMetadata(false);
    }
  };

  const norm = (s: string) =>
    (s || "").toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();

  // Archive retention: backend schedules cleanup 7 days after archived_at
  const ARCHIVE_RETENTION_DAYS = 7;
  const getArchivedTimeLeft = (archivedAt: string | null | undefined): string | null => {
    if (!archivedAt) return null;
    const archived = new Date(archivedAt).getTime();
    const deleteAt = archived + ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const msLeft = deleteAt - now;
    if (msLeft <= 0) return "Scheduled for deletion";
    const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
    const hoursLeft = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (daysLeft > 0) return `Deletes in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
    if (hoursLeft > 0) return `Deletes in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}`;
    return "Deletes in less than an hour";
  };

  const hmName = (hm: any) =>
    hm.full_name?.trim() ||
    `${hm.first_name || ""} ${hm.last_name || ""}`.trim();

  const jobsCountForHiringManager = (hm: any) => {
    const name = norm(hmName(hm));
    return (jobs || []).filter((j: any) => norm(j.hiring_manager) === name)
      .length;
  };


  // Fetch notes for organization
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);
    setNoteError(null);

    try {
      const response = await fetch(`/api/organizations/${id}/notes`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch notes");
      }

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setNoteError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching notes"
      );
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Fetch history for organization
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/organizations/${id}/history`);

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

  // Document columns catalog
  const documentColumnsCatalog = useMemo(() => {
    return [
      { key: "document_name", label: "Document Name", sortable: true, filterType: "text" as const },
      { key: "document_type", label: "Type", sortable: true, filterType: "select" as const },
      { key: "source", label: "Source", sortable: true, filterType: "text" as const },
      { key: "is_auto_generated", label: "Auto-Generated", sortable: true, filterType: "select" as const },
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
        return doc.document_name || "N/A";
      case "document_type":
        return doc.document_type || "N/A";
      case "source":
        return doc.source_label || "—";
      case "is_auto_generated":
        return doc.is_auto_generated ? "Yes" : "No";
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
      if (doc.document_type) types.add(doc.document_type);
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
        let value = getDocumentColumnValue(doc, columnKey);
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
        } else if (sortKey === "is_auto_generated") {
          aValue = a.is_auto_generated ? 1 : 0;
          bValue = b.is_auto_generated ? 1 : 0;
        }

        // Handle numeric values
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

  // Contacts (Hiring Managers) columns catalog and helpers
  const contactColumnsCatalog = useMemo(() => [
    { key: "name", label: "Name", sortable: true, filterType: "text" as const },
    { key: "title", label: "Title", sortable: true, filterType: "text" as const },
    { key: "email", label: "Email", sortable: true, filterType: "text" as const },
    { key: "phone", label: "Phone", sortable: true, filterType: "text" as const },
    { key: "jobs", label: "Jobs", sortable: true, filterType: "number" as const },
    { key: "status", label: "Status", sortable: true, filterType: "select" as const },
  ], []);

  const getContactColumnLabel = (key: string) =>
    contactColumnsCatalog.find((c) => c.key === key)?.label || key;

  const getContactColumnInfo = (key: string) =>
    contactColumnsCatalog.find((c) => c.key === key);

  const getContactColumnValue = (hm: any, key: string) => {
    switch (key) {
      case "name":
        return hm.full_name || `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || "—";
      case "title":
        return hm.title || "—";
      case "email":
        return hm.email || "—";
      case "phone":
        return hm.phone || "—";
      case "jobs":
        return jobsCountForHiringManager(hm);
      case "status":
        return hm.status || "Active";
      default:
        return "—";
    }
  };

  const contactStatusOptions = useMemo(() => {
    const statuses = new Set<string>();
    hiringManagers.forEach((hm) => {
      if (hm.status) statuses.add(hm.status);
    });
    statuses.add("Active");
    statuses.add("Inactive");
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [hiringManagers]);

  const filteredAndSortedHiringManagers = useMemo(() => {
    let result = [...hiringManagers];

    if (contactSearchTerm.trim()) {
      const term = contactSearchTerm.toLowerCase();
      result = result.filter((hm) => {
        const name = getContactColumnValue(hm, "name");
        const email = getContactColumnValue(hm, "email");
        const title = getContactColumnValue(hm, "title");
        const phone = getContactColumnValue(hm, "phone");
        return (
          String(name).toLowerCase().includes(term) ||
          String(email).toLowerCase().includes(term) ||
          String(title).toLowerCase().includes(term) ||
          String(phone).toLowerCase().includes(term)
        );
      });
    }

    Object.entries(contactColumnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((hm) => {
        let value = getContactColumnValue(hm, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();
        const columnInfo = getContactColumnInfo(columnKey);
        if (columnInfo?.filterType === "select") {
          return valueStr === filterStr;
        }
        if (columnInfo?.filterType === "number") {
          return String(value) === String(filterValue);
        }
        return valueStr.includes(filterStr);
      });
    });

    const activeSorts = Object.entries(contactColumnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
      const [sortKey, sortDir] = activeSorts[0];
      result.sort((a, b) => {
        let aValue: any = getContactColumnValue(a, sortKey);
        let bValue: any = getContactColumnValue(b, sortKey);

        if (sortKey === "jobs") {
          aValue = jobsCountForHiringManager(a);
          bValue = jobsCountForHiringManager(b);
          const aNum = Number(aValue);
          const bNum = Number(bValue);
          if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
            const cmp = aNum - bNum;
            return sortDir === "asc" ? cmp : -cmp;
          }
        }

        const cmp = String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [hiringManagers, jobs, contactSearchTerm, contactColumnFilters, contactColumnSorts]);

  const handleContactColumnSort = (columnKey: string) => {
    setContactColumnSorts((prev) => {
      const current = prev[columnKey];
      if (current === "asc") return { ...prev, [columnKey]: "desc" };
      if (current === "desc") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: "asc" };
    });
  };

  const handleContactColumnFilter = (columnKey: string, value: string) => {
    setContactColumnFilters((prev) => {
      if (!value || value.trim() === "") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: value };
    });
  };

  const handleContactColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = contactColumnFields.indexOf(active.id as string);
    const newIndex = contactColumnFields.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      setContactColumnFields(arrayMove(contactColumnFields, oldIndex, newIndex));
    }
  };

  // Fetch documents for organization
  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);

    try {
      const response = await fetch(`/api/organizations/${id}/documents`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch documents");
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

  // Fetch hiring managers (contacts) for organization - use org-specific endpoint
  const fetchHiringManagers = async (organizationId: string) => {
    setIsLoadingHiringManagers(true);
    setHiringManagersError(null);

    try {
      const response = await fetch(
        `/api/hiring-managers?organization_id=${organizationId}`,
        {
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
        throw new Error(errorData.message || "Failed to fetch hiring managers");
      }

      const data = await response.json();
      let hms = data.hiringManagers || [];
      // Fallback: if org-specific endpoint returns empty, fetch all and filter client-side
      if (hms.length === 0) {
        const allResponse = await fetch(`/api/hiring-managers`, {
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        });
        if (allResponse.ok) {
          const allData = await allResponse.json();
          const allHms = allData.hiringManagers || [];
          hms = allHms.filter(
            (hm: any) =>
              hm.organization_id?.toString() === organizationId.toString() ||
              hm.organizationId?.toString() === organizationId.toString()
          );
        }
      }
      setHiringManagers(hms);
    } catch (err) {
      console.error("Error fetching hiring managers:", err);
      setHiringManagersError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching hiring managers"
      );
    } finally {
      setIsLoadingHiringManagers(false);
    }
  };

  // Fetch jobs for organization
  const fetchJobs = async (organizationId: string) => {
    setIsLoadingJobs(true);
    setJobsError(null);

    try {
      const response = await fetch(`/api/jobs`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch jobs");
      }

      const data = await response.json();
      // Filter jobs by organization ID
      const orgJobs = (data.jobs || []).filter(
        (job: any) =>
          job.organization_id?.toString() === organizationId.toString()
      );
      setJobs(orgJobs);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setJobsError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching jobs"
      );
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Fetch placements for organization
  const fetchPlacements = async (organizationId: string) => {
    setIsLoadingPlacements(true);
    setPlacementsError(null);
    try {
      const response = await fetch(
        `/api/placements/organization/${organizationId}`,
        {
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch placements");
      }
      const data = await response.json();
      const list = data.placements ?? data ?? [];
      setPlacements(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Error fetching placements:", err);
      setPlacementsError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching placements"
      );
      setPlacements([]);
    } finally {
      setIsLoadingPlacements(false);
    }
  };

  // Fetch tasks for organization (only non-completed tasks)
  const fetchTasks = async (organizationId: string) => {
    setIsLoadingTasks(true);
    setTasksError(null);

    try {
      // Fetch hiring managers for this organization
      const hiringManagersResponse = await fetch(`/api/hiring-managers`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      let hiringManagerIds: number[] = [];
      if (hiringManagersResponse.ok) {
        const hiringManagersData = await hiringManagersResponse.json();
        const orgHiringManagers = (hiringManagersData.hiringManagers || []).filter(
          (hm: any) =>
            hm.organization_id?.toString() === organizationId.toString()
        );
        hiringManagerIds = orgHiringManagers.map((hm: any) => parseInt(hm.id));
      }

      // Fetch jobs for this organization
      const jobsResponse = await fetch(`/api/jobs`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      let jobIds: number[] = [];
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        jobIds = (jobsData.jobs || [])
          .filter(
            (job: any) =>
              job.organization_id?.toString() === organizationId.toString()
          )
          .map((job: any) => parseInt(job.id));
      }

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
      // 2. Related to this organization by:
      //    - task.organization_id == organizationId OR
      //    - task.job_id belongs to a job under this organization OR
      //    - task.hiring_manager_id belongs to a hiring manager under this organization
      const orgTasks = (tasksData.tasks || []).filter((task: any) => {
        // Exclude completed tasks
        if (task.is_completed === true || task.status === "Completed") {
          return false;
        }

        // Check if task is related to this organization
        const taskOrgId = task.organization_id?.toString();
        const taskJobId = task.job_id ? parseInt(task.job_id) : null;
        const taskHiringManagerId = task.hiring_manager_id ? parseInt(task.hiring_manager_id) : null;

        return (
          (taskOrgId && taskOrgId === organizationId.toString()) ||
          (taskJobId && jobIds.includes(taskJobId)) ||
          (taskHiringManagerId && hiringManagerIds.includes(taskHiringManagerId))
        );
      });

      setTasks(orgTasks);
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

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUploads(files);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUploads(Array.from(files));
    }
  };

  // Handle multiple file uploads
  const handleFileUploads = (files: File[]) => {
    if (!organizationId) return;

    const validFiles = files.filter((file) => {
      // Validate file type (allow common document types)
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "image/jpeg",
        "image/png",
        "image/gif",
      ];
      const isValidType = allowedTypes.includes(file.type) || file.name.match(/\.(pdf|doc|docx|txt|jpg|jpeg|png|gif)$/i);

      // Validate file size (max 10MB)
      const isValidSize = file.size <= 10 * 1024 * 1024;

      if (!isValidType) {
        setUploadErrors((prev) => ({
          ...prev,
          [file.name]: "Invalid file type. Allowed: PDF, DOC, DOCX, TXT, JPG, PNG, GIF",
        }));
      }
      if (!isValidSize) {
        setUploadErrors((prev) => ({
          ...prev,
          [file.name]: "File size exceeds 10MB limit",
        }));
      }

      return isValidType && isValidSize;
    });

    if (validFiles.length === 0) return;

    // Queue validated files and show modal for the first one
    setPendingFiles(validFiles);
    // Strip file extension from name
    const fileNameWithoutExt = validFiles[0].name.replace(/\.[^/.]+$/, "");
    setFileDetailsName(fileNameWithoutExt);
    setFileDetailsType("General");
    setShowFileDetailsModal(true);
  };


  // Confirm details and upload the first file in the queue
  const handleConfirmFileDetails = async () => {
    if (pendingFiles.length === 0) return;

    const currentFile = pendingFiles[0];
    await uploadFile(currentFile, fileDetailsName.trim(), fileDetailsType);

    // Move to next file or close modal
    const remaining = pendingFiles.slice(1);
    if (remaining.length > 0) {
      setPendingFiles(remaining);
      // Strip file extension from name
      const fileNameWithoutExt = remaining[0].name.replace(/\.[^/.]+$/, "");
      setFileDetailsName(fileNameWithoutExt);
      setFileDetailsType("General");
    } else {
      setShowFileDetailsModal(false);
      setPendingFiles([]);
    }
  };

  const uploadFile = async (
    file: File,
    documentName: string,
    documentType: string
  ) => {
    if (!organizationId) return;

    const fileName = file.name;
    setUploadProgress((prev) => ({ ...prev, [fileName]: 0 }));
    setUploadErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fileName];
      return newErrors;
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_name", documentName);
      formData.append("document_type", documentType);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress((prev) => ({ ...prev, [fileName]: percentComplete }));
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status === 200 || xhr.status === 201) {
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
          });
          fetchDocuments(organizationId).then(() => {
            toast.success("Document added successfully");
            fetchSummaryCounts();
          });
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setUploadErrors((prev) => ({
            ...prev,
            [fileName]: errorData.message || "Upload failed",
          }));
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
          });
        }
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        setUploadErrors((prev) => ({
          ...prev,
          [fileName]: "Network error during upload",
        }));
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[fileName];
          return newProgress;
        });
      });

      // Send request
      xhr.open("POST", `/api/organizations/${organizationId}/documents/upload`);
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (err) {
      console.error("Error uploading file:", err);
      setUploadErrors((prev) => ({
        ...prev,
        [fileName]: err instanceof Error ? err.message : "Upload failed",
      }));
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        return newProgress;
      });
    }
  };

  // Handle adding a new document (text-based)
  const handleAddDocument = async () => {
    if (!newDocumentName.trim() || !organizationId) return;

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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

      const data = await response.json();

      // Clear the form and close modal
      setNewDocumentName("");
      setNewDocumentType("General");
      setNewDocumentContent("");
      setShowAddDocument(false);

      // Refresh docs list from server and show success
      await fetchDocuments(organizationId);
      toast.success('Document added successfully');
      fetchSummaryCounts();
    } catch (err) {
      console.error('Error adding document:', err);
      toast.error(err instanceof Error ? err.message : 'An error occurred while adding a document');
    }
  };

  // Handle deleting a document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/documents/${documentId}`,
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

      toast.success('Document deleted successfully');
    } catch (err) {
      console.error('Error deleting document:', err);
      toast.error(err instanceof Error ? err.message : 'An error occurred while deleting the document');
    }
  };

  // Handle downloading a document (file or text)
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

  const handleGoBack = () => {
    router.push("/dashboard/organizations");
  };

  const findContainer = (id: string) => {
    if (id === "left" || id === "right") {
      return id;
    }

    if (columns.left.includes(id)) return "left";
    if (columns.right.includes(id)) return "right";

    return undefined;
  };

  const handlePanelDragStart = (event: any) => {
    setActiveId(event.active.id);
  }

  const handlePanelDragCancel = () => {
    setActiveId(null);
  };

  const handlePanelDragOver = (event: DragOverEvent) => {
    return;
  };

  const handlePanelDragEnd = (event: DragEndEvent) => {
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
  };

  const renderPanelPreview = (panelId: string) => {
    const title = ORG_PANEL_TITLES[panelId] ?? panelId;
    return (
      <div className="bg-white border border-gray-200 rounded shadow-lg w-[340px] max-w-[90vw]">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-sm">
          {title}
        </div>
        <div className="px-3 py-3 text-sm text-gray-500">Moving panel...</div>
      </div>
    );
  };

  const renderPanel = (panelId: string) => {
    if (panelId === "contactInfo") {
      const getContactInfoLabel = (key: string) =>
        contactInfoFieldCatalog.find((f) => f.key === key)?.label || key;
      const isUrlField = (key: string) => {
        const entry = contactInfoFieldCatalog.find((f) => f.key === key);
        return key === "website" || entry?.fieldType === "url" || entry?.fieldType === "link";
      };
      const isNameField = (key: string) =>
        key === "name" || contactInfoFieldCatalog.find((f) => f.key === key)?.label?.toLowerCase() === "name";
      const isPhoneField = (key: string) => {
        const k = (key || "").toLowerCase();
        const label = (getContactInfoLabel(key) || "").toLowerCase();
        return k === "phone" || k === "contact_phone" || label === "phone" || label.includes("phone");
      };
      const isParentOrgField = (key: string) => {
        const k = (key || "").toLowerCase();
        const label = (getContactInfoLabel(key) || "").toLowerCase();
        return k === "parent_organization" || k === "parentorganization" || label.includes("parent organization");
      };
      const isStatusField = (key: string) => {
        const k = (key || "").toLowerCase();
        const label = (getContactInfoLabel(key) || "").toLowerCase();
        return k === "status" || label === "status";
      };

      const getContactInfoValue = (key: string): string => {
        if (!organization) return "-";
        const o = organization as any;
        const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;

        // Special handling for status: prioritize customFields["Status"] (matching Edit mode)
        const isStatus = isStatusField(key);
        if (isStatus) {
          // Find Status field from availableFields (same source as Edit mode uses)
          const statusFieldFromApi = (availableFields || []).find(
            (f: any) =>
              (f.field_label || "").toLowerCase() === "status" ||
              (f.field_name || "").toLowerCase() === "status"
          );
          const statusLabel = statusFieldFromApi?.field_label || "Status";

          console.log("Status retrieval - Field label:", statusLabel);
          console.log("Status retrieval - customFields:", o.customFields);
          console.log("Status retrieval - Available options:", statusFieldOptions);

          // PRIORITY 1: Check customFields with exact label from API (matching Edit mode storage)
          let statusValue = o.customFields?.[statusLabel];
          if (statusValue !== undefined && statusValue !== null && String(statusValue).trim() !== "") {
            const valueStr = String(statusValue).trim();
            console.log("Status retrieval - Found in customFields[statusLabel]:", valueStr);
            // Ensure the value matches one of the available options
            if (statusFieldOptions.includes(valueStr)) {
              console.log("Status retrieval - Value matches options, returning:", valueStr);
              return valueStr;
            }
            // If value doesn't match options, still return it but log warning
            console.warn("Status value doesn't match options:", valueStr, "Available:", statusFieldOptions);
            return valueStr;
          }

          // PRIORITY 2: Check other variations in customFields
          statusValue = o.customFields?.["Status"] ?? o.customFields?.["status"];
          if (statusValue !== undefined && statusValue !== null && String(statusValue).trim() !== "") {
            const valueStr = String(statusValue).trim();
            console.log("Status retrieval - Found in customFields variations:", valueStr);
            if (statusFieldOptions.includes(valueStr)) {
              console.log("Status retrieval - Value matches options, returning:", valueStr);
              return valueStr;
            }
            return valueStr;
          }

          // PRIORITY 3: Fallback to top-level status (for backward compatibility)
          const fallbackStatus = String(o.status ?? statusFieldOptions[0] ?? "Active").trim();
          console.log("Status retrieval - Using fallback:", fallbackStatus);
          return fallbackStatus;
        }

        let v = o[rawKey];
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
        if (o.contact?.[rawKey] !== undefined) return String(o.contact[rawKey] ?? "-");
        if (rawKey === "contact_phone" || rawKey === "phone") return String(o.contact_phone ?? o.phone ?? "(Not provided)");
        if (rawKey === "nickname") return String(o.nicknames ?? o.contact?.nickname ?? "-");
        if (rawKey === "parent_organization" || rawKey === "parentOrganization") return String(o.parentOrganization ?? o.parent_organization ?? "-");
        v = o.customFields?.[rawKey];
        if (v !== undefined && v !== null) return String(v);
        const field = contactInfoFieldCatalog.find((f) => f.key === key);
        if (field) v = o.customFields?.[field.label];
        return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
      };

      const contactKeys = visibleFields.contactInfo || [];
      const effectiveRows: { key: string; label: string; isParentOrg?: boolean; isPhone?: boolean; isStatus?: boolean; isUrl?: boolean; isName?: boolean }[] = [];
      let statusRowAdded = false;
      for (const key of contactKeys) {
        if (isStatusField(key)) statusRowAdded = true;
        effectiveRows.push({
          key,
          label: getContactInfoLabel(key),
          isParentOrg: isParentOrgField(key),
          isPhone: isPhoneField(key),
          isStatus: isStatusField(key),
          isUrl: isUrlField(key) && getContactInfoValue(key) !== "-",
          isName: isNameField(key),
        });
      }
      if (!statusRowAdded) {
        // Find the actual status field from catalog to use its correct key
        const statusFieldFromCatalog = contactInfoFieldCatalog.find(
          (f) => f.label?.toLowerCase() === "status" || f.key?.toLowerCase() === "status"
        );
        const statusKey = statusFieldFromCatalog?.key || "status";
        effectiveRows.push({ key: statusKey, label: "Status", isStatus: true });
      }

      return (
        <SortablePanel key={panelId} id={panelId}>
          <PanelWithHeader
            title="Organization Contact Info"
            onEdit={() => handleEditPanel("contactInfo")}
          >
            <div className="space-y-0 border border-gray-200 rounded">
              {effectiveRows.map((row) => {
                const value = getContactInfoValue(row.key);
                const parentOrgId = (organization as any)?.parentOrganizationId;
                const catalogEntry = contactInfoFieldCatalog.find((f) => f.key === row.key);
                const fieldInfo = {
                  key: row.key,
                  label: row.label,
                  fieldType: catalogEntry?.fieldType,
                  lookupType: catalogEntry?.lookupType,
                  multiSelectLookupType: catalogEntry?.multiSelectLookupType,
                };
                return (
                  <div
                    key={row.key}
                    className="flex border-b border-gray-200 last:border-b-0"
                  >
                    <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">
                      {row.label}:
                    </div>
                    <div className="flex-1 p-2">
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
                      ) : row.isParentOrg && parentOrgId ? (
                        <FieldValueRenderer
                          value={String(parentOrgId)}
                          fieldInfo={{ ...fieldInfo, fieldType: "lookup", lookupType: "organization" }}
                          emptyPlaceholder="-"
                          clickable
                          lookupFallback={(organization as any)?.parentOrganization || value}
                          className={row.isName ? "text-blue-600" : ""}
                        />
                      ) : (
                        <FieldValueRenderer
                          value={value}
                          fieldInfo={row.isParentOrg && !parentOrgId ? { ...fieldInfo, fieldType: "text" } : fieldInfo}
                          // addressParts={addressParts}
                          emptyPlaceholder="-"
                          clickable
                          className={row.isName ? "text-blue-600" : ""}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelWithHeader>
        </SortablePanel>
      );
    }
    if (panelId === "about") {
      return (
        <SortablePanel key={panelId} id={panelId}>
          <PanelWithHeader
            title="About the Organization:"
            onEdit={() => {
              setIsEditingAbout(true);
              setTempAboutText(aboutText);
            }}
          >
            <div className="border border-gray-200 rounded">
              {isEditingAbout ? (
                <div className="p-2">
                  <textarea
                    value={tempAboutText}
                    onChange={(e) => setTempAboutText(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => {
                        setIsEditingAbout(false);
                        setTempAboutText("");
                      }}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveAboutText}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {aboutText || "No description provided"}
                  </p>
                </div>
              )}
            </div>
          </PanelWithHeader>
        </SortablePanel>
      );
    }
    if (panelId === "recentNotes") {
      return (
        <SortablePanel key={panelId} id={panelId}>
          <PanelWithHeader title="Recent Notes:">
            <div className="border border-gray-200 rounded">
              {notes.length > 0 ? (
                <div className="p-2">
                  {notes.slice(0, 5).map((note: any) => {
                    const actionLabel =
                      actionFields.find(
                        (af) =>
                          af.field_name === note.action ||
                          af.field_label === note.action
                      )?.field_label || note.action || "General Note";

                    return (
                      <div
                        key={note.id}
                        className="mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0"
                      >
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">
                            {note.created_by_name || "Unknown User"}
                          </span>
                          <span className="text-gray-500">
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        {actionLabel && (
                          <div className="mb-1">
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                              {actionLabel}
                            </span>
                          </div>
                        )}
                        {note.additional_references && (
                          <div className="mb-1 text-xs text-gray-600">
                            References: {note.additional_references}
                          </div>
                        )}
                        <p className="text-sm text-gray-700">
                          {note.text.length > 100
                            ? `${note.text.substring(0, 100)}...`
                            : note.text}
                        </p>
                      </div>
                    );
                  })}
                  {notes.length > 5 && (
                    <button
                      onClick={() => setActiveTab("notes")}
                      className="text-blue-500 text-sm hover:underline mt-2"
                    >
                      View all {notes.length} notes
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 italic p-2">No recent notes</p>
              )}
            </div>
          </PanelWithHeader>
        </SortablePanel>
      );
    }
    if (panelId === "websiteJobs") {
      const openJobs = jobs.filter((j: any) => (j.status || "").toLowerCase() === "open");
      const websiteUrl = organization?.website;
      const hasValidWebsite = websiteUrl && websiteUrl !== "https://example.com";

      return (
        <SortablePanel key={panelId} id={panelId}>
          <PanelWithHeader
            title="Open Jobs from Website:"
            onEdit={() => {
              setIsEditingWebsiteUrl(true);
              setTempWebsiteUrl(organization?.website || "");
            }}
          >
            <div className="border border-gray-200 rounded">
              {/* Website URL Display */}
              {hasValidWebsite && (
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-gray-50">
                  <div className="flex items-center gap-3">
                    {isLoadingWebsiteMetadata ? (
                      <div className="w-10 h-10 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 flex-shrink-0" />
                    ) : websiteMetadata?.faviconUrl ? (
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-white rounded-full p-2 bg-white border border-gray-200 p-0.5">
                        <img
                          src={websiteMetadata.faviconUrl}
                          alt={`${websiteMetadata.domain} favicon`}
                          className="w-full h-full object-contain rounded"
                          onError={(e) => {
                            // Fallback to a default icon if favicon fails to load
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-white rounded border border-gray-200">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {websiteMetadata?.title ? (
                        <div
                          className="font-semibold text-gray-900 truncate mb-0.5"
                          title={websiteMetadata.title}
                        >
                          {websiteMetadata.title}
                        </div>
                      ) : (
                        <div className="font-semibold text-gray-900 truncate mb-0.5">
                          {websiteMetadata?.domain || 'Website'}
                        </div>
                      )}
                      <a
                        href={websiteMetadata?.url || websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate block flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{websiteMetadata?.domain || websiteUrl}</span>
                        <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {!hasValidWebsite && (
                <div className="p-4 text-sm text-gray-500">
                  No jobs page URL has been configured. Use the pencil icon on this panel to enter the
                  jobs page URL from the client website. This will also update the Organization
                  Website field in Admin Center.
                </div>
              )}

              {hasValidWebsite && (
                <div className="border-t border-gray-200">
                  <div className="w-full aspect-video bg-gray-100">
                    <iframe
                      src={websiteMetadata?.url || (websiteUrl!.startsWith("http") ? websiteUrl! : `https://${websiteUrl}`)}
                      title="Open jobs from website"
                      className="w-full h-full border-0"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>
          </PanelWithHeader>
        </SortablePanel>
      );
    }
    if (panelId === "ourJobs") {
      const openJobs = jobs.filter((j: any) => (j.status || "").toLowerCase() === "open");
      return (
        <SortablePanel key={panelId} id={panelId}>
          <PanelWithHeader title="Our Open Jobs:">
            <div className="border border-gray-200 rounded">
              {isLoadingJobs ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500" />
                </div>
              ) : openJobs.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {openJobs.slice(0, 5).map((job: any) => (
                    <div
                      key={job.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/dashboard/jobs/view?id=${job.id}`)}
                    >
                      <div className="font-medium text-blue-600 hover:underline">
                        {job.job_title || "Untitled Job"}
                      </div>
                      <div className="text-xs text-gray-500">{job.worksite_location || job.category || ""}</div>
                    </div>
                  ))}
                  {openJobs.length > 5 && (
                    <button
                      onClick={() => setActiveTab("jobs")}
                      className="w-full p-2 text-blue-500 text-sm hover:underline"
                    >
                      View all {openJobs.length} jobs
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-2">
                  <p className="text-gray-500 italic">No open jobs</p>
                </div>
              )}
            </div>
          </PanelWithHeader>
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
  };

  // Toggle pin/pop-out panel
  const handleTogglePinnedRecord = () => {
    if (!organization) return;
    const key = buildPinnedKey("org", organization.id);
    const label = organization.name || `Organization ${organization.record_number ?? organization.id}`;
    let url = `/dashboard/organizations/view?id=${organization.id}`;
    if (activeTab && activeTab !== "summary") url += `&tab=${activeTab}`;
    if (hmFilter) url += `&hm=${encodeURIComponent(hmFilter)}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      toast.info("Maximum 10 pinned records reached");
    }
  };

  useEffect(() => {
    const syncPinned = () => {
      if (!organization) return;
      const key = buildPinnedKey("org", organization.id);
      setIsRecordPinned(isPinnedRecord(key));
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [organization]);

  // Save about text
  const saveAboutText = async () => {
    if (!organizationId) return;

    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );

      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          overview: tempAboutText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save about text");
      }

      setAboutText(tempAboutText);
      setIsEditingAbout(false);
      if (organization) {
        setOrganization({ ...organization, about: tempAboutText });
      }
    } catch (err) {
      console.error("Error saving about text:", err);
      toast.error("Failed to save about text. Please try again.");
    }
  };

  // Normalize a URL by ensuring it has a protocol
  const normalizeUrl = (url: string) => {
    const trimmed = (url || "").trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  // Save website URL (jobs page) from "Open Jobs from Website" panel
  const saveWebsiteUrl = async () => {
    if (!organizationId) return;
    const normalized = normalizeUrl(tempWebsiteUrl);
    if (!normalized) {
      toast.error("Please enter a valid jobs page URL.");
      return;
    }

    setIsSavingWebsiteUrl(true);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );

      // Preserve all existing custom fields and update Organization Website label
      const currentCustomFields = organization?.customFields || {};
      const updatedCustomFields = {
        ...currentCustomFields,
        "Organization Website": normalized,
      };

      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          website: normalized,
          custom_fields: updatedCustomFields,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update website URL");
      }

      const data = await response.json().catch(() => ({}));

      // Parse custom_fields from response if present
      let returnedCustomFields = updatedCustomFields;
      const apiOrg = (data as any).organization;
      if (apiOrg?.custom_fields) {
        try {
          returnedCustomFields =
            typeof apiOrg.custom_fields === "string"
              ? JSON.parse(apiOrg.custom_fields)
              : apiOrg.custom_fields;
        } catch {
          // ignore parse error and keep updatedCustomFields
        }
      }

      // Update local organization state
      setOrganization((prev: any) =>
        prev
          ? {
            ...prev,
            website: normalized,
            contact: {
              ...(prev.contact || {}),
              website: normalized,
            },
            customFields: returnedCustomFields,
          }
          : prev
      );

      // Refresh website metadata and close modal
      fetchWebsiteMetadata(normalized);
      setIsEditingWebsiteUrl(false);
      toast.success("Website URL updated successfully.");
    } catch (err) {
      console.error("Error updating website URL:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update website URL. Please try again."
      );
    } finally {
      setIsSavingWebsiteUrl(false);
    }
  };

  // Print handler: print only Overview Summary content
  const handlePrint = () => {
    const printContent = document.getElementById("printable-summary");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tabTitle = activeTab?.toUpperCase() || "Organization SUMMARY";

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



  const refreshPanel = (panelName: string) => {
    console.log(`Refreshing ${panelName} panel`);
    // In a real application, you would refetch data for this panel
  };

  const closePanel = (panelName: string) => {
    console.log(`Closing ${panelName} panel`);
    // In a real application, you would hide or collapse this panel
  };

  const handleActionSelected = (action: string) => {
    if (action === "edit" && organizationId) {
      router.push(`/dashboard/organizations/add?id=${organizationId}`);
    } else if (action === "delete" && organizationId) {
      // Check for pending delete request first
      checkPendingDeleteRequest();
      // Check dependencies before showing modal
      checkDependencies();
    } else if (action === "add-note") {
      setShowAddNote(true);
    } else if (action === "add-job") {
      // Navigate to add job page with organization context
      if (organizationId) {
        // Store organizationId in sessionStorage to refresh jobs when returning
        sessionStorage.setItem("returnToOrganizationId", organizationId);
        router.push(`/dashboard/jobs/add?organizationId=${organizationId}`);
      } else {
        router.push("/dashboard/jobs/add");
      }
    } else if (action === "add-task") {
      // Navigate to add task page with organization context
      if (organizationId) {
        const params = new URLSearchParams({
          relatedEntity: "organization",
          relatedEntityId: organizationId,
        });
        if (organization?.name) params.set("organizationName", organization.name);
        router.push(`/dashboard/tasks/add?${params.toString()}`);
      }
    } else if (action === "add-hiring-manager") {
      // Navigate to add hiring manager page with organization context
      if (organizationId) {
        // Store organizationId in sessionStorage to refresh contacts when returning
        sessionStorage.setItem("returnToOrganizationId", organizationId);
        router.push(
          `/dashboard/hiring-managers/add?organizationId=${organizationId}`
        );
      } else {
        router.push("/dashboard/hiring-managers/add");
      }
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else if (action === "transfer") {
      setShowTransferModal(true);
      fetchAvailableOrganizations();
    } else {
      console.log(`Action selected: ${action}`);
    }
  };

  // Check for pending delete request
  const checkPendingDeleteRequest = async () => {
    if (!organizationId) return;

    setIsLoadingDeleteRequest(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/delete-request`,
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
    } catch (err) {
      console.error("Error checking delete request:", err);
      setPendingDeleteRequest(null);
    } finally {
      setIsLoadingDeleteRequest(false);
    }
  };

  // Check for pending delete request on component mount
  useEffect(() => {
    if (organizationId) {
      checkPendingDeleteRequest();
    }
  }, [organizationId]);

  // Check for dependencies
  const checkDependencies = async () => {
    if (!organizationId) return;
    setIsLoadingDependencies(true);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch(`/api/organizations/${organizationId}/dependencies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDependencyCounts(data.counts);

        // Check if there are any dependencies (using counts or details length)
        const hasDependencies = data.counts && (
          (data.counts.hiring_managers > 0) ||
          (data.counts.jobs > 0) ||
          (data.counts.placements > 0) ||
          (data.counts.child_organizations > 0) ||
          (data.counts.details?.hiring_managers?.length > 0) ||
          (data.counts.details?.jobs?.length > 0) ||
          (data.counts.details?.placements?.length > 0) ||
          (data.counts.details?.child_organizations?.length > 0)
        );

        if (hasDependencies) {
          setShowDependencyWarningModal(true);
          // Default to transfer logic or let user choose
        } else {
          // No dependencies, proceed to standard delete modal
          setDeleteActionType("standard");
          setShowDeleteModal(true);
        }
      } else {
        // Fallback if check fails
        console.error("Failed to check dependencies");
        setShowDeleteModal(true);
      }
    } catch (err) {
      console.error("Error checking dependencies:", err);
      // Fallback
      setShowDeleteModal(true);
    } finally {
      setIsLoadingDependencies(false);
    }
  };

  // Fetch summary counts
  const fetchSummaryCounts = async () => {
    if (!organizationId) return;
    setIsLoadingSummaryCounts(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/summary-counts`, {
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

  // Fetch summary counts when organization changes
  useEffect(() => {
    if (organizationId) {
      fetchSummaryCounts();
    }
  }, [organizationId]);

  // Handle delete request submission
  const handleDeleteRequestSubmit = async () => {
    if (!deleteForm.reason.trim()) {
      toast.error("Please enter a reason for deletion");
      return;
    }

    if (!organizationId) {
      toast.error("Organization ID is missing");
      return;
    }

    setIsSubmittingDelete(true);
    try {
      // Get current user info
      const userCookie = document.cookie.replace(
        /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      let currentUser = null;
      if (userCookie) {
        try {
          currentUser = JSON.parse(decodeURIComponent(userCookie));
        } catch (e) {
          console.error("Error parsing user cookie:", e);
        }
      }

      // Step 1: Add "Delete requested" note to organization
      const noteResponse = await fetch(
        `/api/organizations/${organizationId}/notes`,
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
            text: `Delete requested by ${currentUser?.name || "Unknown User"} – Pending payroll approval`,
            action: "Delete Request",
            about: organization
              ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}`
              : "",
          }),
        }
      );

      if (!noteResponse.ok) {
        console.error("Failed to add delete note");
      }

      // Step 2: Create delete request
      const deleteRequestResponse = await fetch(
        `/api/organizations/${organizationId}/delete-request`,
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
            record_type: "organization",
            record_number: formatRecordId(organization?.record_number ?? organization?.id, "organization"),
            requested_by: currentUser?.id || currentUser?.name || "Unknown",
            requested_by_email: currentUser?.email || "",
            action_type: deleteActionType,
            dependencies_summary: dependencyCounts || {},
            user_consent: deleteActionType === 'cascade' ? cascadeUserConsent : false
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
      if (organizationId) {
        fetchNotes(organizationId);
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

  const handleUnarchiveSubmit = async () => {
    if (!unarchiveReason.trim() || !organizationId) {
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
      const res = await fetch(`/api/organizations/${organizationId}/unarchive-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: unarchiveReason.trim(),
          record_number: organization
            ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}`
            : formatRecordId(organizationId, "organization"),
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

  // Handle field changes in the Modify tab
  const handleFieldChange = (fieldName: string, value: string) => {
    setEditableFields({
      ...editableFields,
      [fieldName]: value,
    });
  };

  // Update the saveModifications function in app/dashboard/organizations/view/page.tsx

  const saveModifications = async () => {
    if (!organizationId) return;

    setIsSaving(true);
    try {
      // Debug - log the current editable fields
      console.log("Editable fields before save:", editableFields);

      // Get the currently logged in user from cookies
      const userDataStr = getCookie("user");
      let userId = null;

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr as string);
          userId = userData.id;
          console.log("Current user ID:", userId);
        } catch (e) {
          console.error("Error parsing user data from cookie:", e);
        }
      }

      // Convert editable fields back to API format matching backend expectations
      const apiData = {
        name: editableFields.name,
        nicknames: editableFields.contactNickname,
        website: editableFields.website,
        overview: editableFields.about,
        contact_phone: editableFields.contactPhone,
        address: editableFields.contactAddress, // Use the address from the form
        // Important: Include the user ID so backend knows who's making the update
        created_by: userId,
        // Pass other necessary fields from the original organization
        status: organization.status || "Active",
        parent_organization: organization.parentOrganization || "",
        contract_on_file: organization.contractOnFile || "No",
        contract_signed_by: editableFields.contactName, // This was missing
      };

      console.log("Data being sent to API:", apiData);

      // Send the update request
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiData),
      });

      // Get response as text first for debugging
      const responseText = await response.text();
      console.log("Raw response:", responseText);

      // Try to parse the response
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("API response data:", data);
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        throw new Error("Invalid response format from server");
      }

      // Check for error response
      if (!response.ok) {
        console.error("API error response:", data);
        throw new Error(data.message || "Failed to update organization");
      }

      // Update the organization state with the new data
      setOrganization({
        ...organization,
        name: editableFields.name,
        phone: editableFields.contactPhone,
        website: editableFields.website,
        address: editableFields.contactAddress, // Update address in organization state
        contact: {
          ...organization.contact,
          name: editableFields.contactName,
          nickname: editableFields.contactNickname,
          phone: editableFields.contactPhone,
          address: editableFields.contactAddress,
          website: editableFields.contactWebsite,
        },
        about: editableFields.about,
      });

      setOriginalData({ ...editableFields });

      // Refresh history after update
      fetchHistory(organizationId);

      toast.success("Organization updated successfully");
    } catch (err) {
      console.error("Error updating organization:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "An error occurred while updating the organization"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel modifications
  const cancelModifications = () => {
    setEditableFields({ ...originalData });
  };

  // Get Status field options from admin field definitions
  const statusFieldOptions = useMemo((): string[] => {
    const statusField = (availableFields || []).find(
      (f: any) =>
        (f.field_label || "").toLowerCase() === "status" ||
        (f.field_name || "").toLowerCase() === "status"
    );

    if (!statusField || !statusField.options) {
      // Fallback to default options if not found
      return ["Active", "Inactive", "Archived", "On Hold"];
    }

    let options = statusField.options;

    // Parse options if it's a string
    if (typeof options === "string") {
      try {
        options = JSON.parse(options);
      } catch {
        // Fallback: assume newline-delimited list
        return options
          .split(/\r?\n/)
          .map((opt: string) => opt.trim())
          .filter((opt: string) => opt.length > 0);
      }
    }

    // Handle array of options
    if (Array.isArray(options)) {
      return options
        .filter((opt: any): opt is string => typeof opt === "string" && opt.trim().length > 0)
        .map((opt: string) => opt.trim());
    }

    // Handle object format {key: value}
    if (typeof options === "object" && options !== null) {
      const values = Object.values(options) as unknown[];
      return values
        .filter((opt): opt is string => typeof opt === "string" && opt.trim().length > 0)
        .map((opt: string) => opt.trim());
    }

    return ["Active", "Inactive", "Archived", "On Hold"];
  }, [availableFields]);

  // Handle status change from summary page dropdown
  const handleStatusChange = async (newStatus: string) => {
    if (!organizationId || isSavingStatus) return;
    setIsSavingStatus(true);
    try {
      // Find the Status field definition to get its label (matching Edit mode)
      const statusField = (availableFields || []).find(
        (f: any) =>
          (f.field_label || "").toLowerCase() === "status" ||
          (f.field_name || "").toLowerCase() === "status"
      );
      const statusLabel = statusField?.field_label || "Status";

      console.log("Status update - Field label:", statusLabel);
      console.log("Status update - New value:", newStatus);
      console.log("Status update - Current customFields:", organization?.customFields);

      // Get current customFields and update Status in it (matching Edit mode storage)
      // CRITICAL: Ensure we preserve ALL existing custom_fields, not just Status
      const currentCustomFields = organization?.customFields || {};

      // Ensure we're using the exact field_label that Edit mode will look for
      // Edit mode reads from existingCustomFields[field.field_label], so we must use field_label
      const updatedCustomFields = {
        ...currentCustomFields, // Preserve all existing custom fields
        [statusLabel]: newStatus, // Update Status with the exact field_label (matching Edit mode lookup)
      };

      console.log("Status update - Status field label:", statusLabel);
      console.log("Status update - Status field name:", statusField?.field_name);
      console.log("Status update - Current customFields keys:", Object.keys(currentCustomFields));
      console.log("Status update - Updated customFields:", updatedCustomFields);
      console.log("Status update - Status value in updatedCustomFields:", updatedCustomFields[statusLabel]);

      // Send update EXACTLY like Edit mode does:
      // 1. Top-level status field (for API compatibility)
      // 2. Full custom_fields object with ALL fields (matching Edit mode's getCustomFieldsForSubmission format)
      // This ensures Edit mode can read it back correctly
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          status: newStatus, // Top-level for API compatibility (matches Edit mode)
          custom_fields: updatedCustomFields, // Full custom_fields object with Status updated (matches Edit mode)
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update status");
      }

      const responseData = await response.json();
      console.log("Status update - API response:", responseData);

      // Parse the returned custom_fields from API response to ensure we have the exact format
      let returnedCustomFields = updatedCustomFields; // Default to what we sent
      if (responseData.organization?.custom_fields) {
        try {
          returnedCustomFields = typeof responseData.organization.custom_fields === "string"
            ? JSON.parse(responseData.organization.custom_fields)
            : responseData.organization.custom_fields;
          console.log("Status update - Parsed custom_fields from API:", returnedCustomFields);
          console.log("Status update - Status value in returned custom_fields:", returnedCustomFields[statusLabel]);
          console.log("Status update - All keys in returned custom_fields:", Object.keys(returnedCustomFields));
        } catch (e) {
          console.error("Error parsing returned custom_fields:", e);
        }
      } else {
        console.warn("Status update - No custom_fields in API response, using updatedCustomFields");
      }

      // Update local state immediately: both top-level status and customFields[Status]
      // Use the returned custom_fields from API to ensure we have the exact format the backend stored
      setOrganization((prev: any) => {
        const updated = prev ? {
          ...prev,
          status: newStatus, // Update top-level for backward compatibility
          customFields: returnedCustomFields, // Use returned custom_fields from API (most accurate)
        } : prev;
        console.log("Status update - Updated local state:", updated);
        console.log("Status update - customFields[Status] in state:", updated?.customFields?.[statusLabel]);
        console.log("Status update - Status field label used:", statusLabel);
        return updated;
      });

      toast.success("Status updated successfully");

      // Refresh organization data to ensure consistency with backend
      // This ensures both Summary and Edit mode see the same value
      if (organizationId) {
        await fetchOrganizationData(organizationId);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update status");
      // Revert on error by refreshing
      if (organizationId) {
        fetchOrganizationData(organizationId);
      }
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Handle adding a new note with validation
  const handleAddNote = async () => {
    if (!organizationId) return;

    // Clear previous validation errors
    setValidationErrors({});

    // Validate required fields
    const errors: { text?: string; action?: string; about?: string } = {};
    if (!noteForm.text.trim()) {
      errors.text = "Note text is required";
    }
    if (!noteForm.action || noteForm.action.trim() === "") {
      errors.action = "Action is required";
    }
    if (
      !noteForm.aboutReferences ||
      noteForm.aboutReferences.length === 0
    ) {
      errors.about = "At least one About/Reference is required";
    }

    // If validation errors exist, set them and prevent save
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
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
        `/api/organizations/${organizationId}/notes`,
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
          const backendErrors: { action?: string; about?: string } = {};
          if (errorData.errors.action) {
            backendErrors.action = errorData.errors.action;
          }
          if (errorData.errors.about || errorData.errors.about_references) {
            backendErrors.about =
              errorData.errors.about || errorData.errors.about_references;
          }
          setValidationErrors(backendErrors);
          return; // Keep form open
        }
        throw new Error(errorData.message || "Failed to add note");
      }

      const data = await response.json();

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      toast.success("Note added successfully");

      // Clear the form
      const defaultAboutRef = organization
        ? [
          {
            id: organization.id,
            type: "Organization",
            display: `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name
              }`,
            value: formatRecordId(organization.record_number ?? organization.id, "organization"),
          },
        ]
        : [];

      setNoteForm({
        text: "",
        action: "",
        about: organization
          ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name
          }`
          : "",
        aboutReferences: defaultAboutRef,
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: "",
        scheduleNextAction: "None",
        emailNotification: [],
      });
      setAboutSearchQuery("");
      setEmailSearchQuery("");
      setShowEmailDropdown(false);
      setValidationErrors({});
      setShowAddNote(false);

      // Refresh history and summary counts to show the note addition
      fetchNotes(organizationId);
      fetchHistory(organizationId);
      fetchSummaryCounts();
    } catch (err) {
      console.error("Error adding note:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "An error occurred while adding a note"
      );
    }
  };

  const handleCloseAddNoteModal = () => {
    setShowAddNote(false);
  };

  const filteredTransferOrganizations =
    transferSearchQuery.trim() === ""
      ? availableOrganizations
      : availableOrganizations.filter((org: any) => {
        const q = transferSearchQuery.trim().toLowerCase();
        const name = String(org?.name || "").toLowerCase();
        const idStr = org?.id !== undefined && org?.id !== null ? String(org.id) : "";
        const recordNum = org?.record_number ?? org?.id;
        const recordId =
          recordNum !== undefined && recordNum !== null
            ? String(formatRecordId(recordNum, "organization")).toLowerCase()
            : "";
        return name.includes(q) || idStr.includes(q) || recordId.includes(q);
      });

  // Click outside to close transfer search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (transferSearchRef.current && !transferSearchRef.current.contains(event.target as Node)) {
        setShowTransferDropdown(false);
      }
    };
    if (showTransferDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTransferDropdown]);

  useEffect(() => {
    if (showTransferModal) {
      setTransferSearchQuery("");
      setShowTransferDropdown(false);
    }
  }, [showTransferModal]);

  // Fetch available organizations for transfer (exclude current organization)
  const fetchAvailableOrganizations = async () => {
    setIsLoadingOrganizations(true);
    try {
      const response = await fetch("/api/organizations", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter out current organization and archived organizations
        const filtered = (data.organizations || []).filter(
          (org: any) =>
            org.id.toString() !== organizationId &&
            org.status !== "Archived"
        );
        setAvailableOrganizations(filtered);
      } else {
        console.error("Failed to fetch organizations:", response.statusText);
        setAvailableOrganizations([]);
      }
    } catch (err) {
      console.error("Error fetching organizations:", err);
      setAvailableOrganizations([]);
    } finally {
      setIsLoadingOrganizations(false);
    }
  };

  // Handle transfer submission
  const handleTransferSubmit = async () => {
    if (!transferForm.targetOrganizationId) {
      toast.error("Please select a target organization");
      return;
    }

    if (!organizationId) {
      toast.error("Source organization ID is missing");
      return;
    }

    if (transferForm.targetOrganizationId === organizationId) {
      toast.error("Cannot transfer to the same organization");
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      // Get current user info
      const userCookie = document.cookie.replace(
        /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      let currentUser = null;
      if (userCookie) {
        try {
          currentUser = JSON.parse(decodeURIComponent(userCookie));
        } catch (e) {
          console.error("Error parsing user cookie:", e);
        }
      }

      // Step 1: Add "Transfer requested" note to source organization
      const noteResponse = await fetch(
        `/api/organizations/${organizationId}/notes`,
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
            text: "Transfer requested",
            action: "Transfer Request",
            about: organization
              ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}`
              : "",
          }),
        }
      );

      if (!noteResponse.ok) {
        console.error("Failed to add transfer note to source organization");
      }

      // Step 2: Add "Transfer requested" note to target organization
      const targetNoteResponse = await fetch(
        `/api/organizations/${transferForm.targetOrganizationId}/notes`,
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
            text: "Transfer requested",
            action: "Transfer Request",
            about: organization
              ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}`
              : "",
          }),
        }
      );

      if (!targetNoteResponse.ok) {
        console.error("Failed to add transfer note to target organization");
      }

      // Step 3: Create transfer request
      const transferResponse = await fetch("/api/organizations/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          source_organization_id: organizationId,
          target_organization_id: transferForm.targetOrganizationId,
          requested_by: currentUser?.id || currentUser?.name || "Unknown",
          requested_by_email: currentUser?.email || "",
          source_record_number: formatRecordId(organization?.record_number ?? organization?.id, "organization"),
          target_record_number: formatRecordId(
            parseInt(transferForm.targetOrganizationId),
            "organization"
          ),
        }),
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse
          .json()
          .catch(() => ({ message: "Failed to create transfer request" }));
        throw new Error(errorData.message || "Failed to create transfer request");
      }

      const transferData = await transferResponse.json();

      toast.success(
        "Transfer request submitted successfully. Payroll will be notified via email."
      );

      // Refresh notes to show the transfer note
      if (organizationId) {
        fetchNotes(organizationId);
      }

      setShowTransferModal(false);
      setTransferForm({ targetOrganizationId: "" });
    } catch (err) {
      console.error("Error submitting transfer:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to submit transfer request. Please try again."
      );
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const isArchived = !!organization?.archived_at;

  // Update the actionOptions to remove the edit option since we'll handle it in Modify tab
  const getDeleteLabel = () => {
    if (isArchived) return "Delete (Archived)";
    if (isLoadingDeleteRequest) return "Delete (Loading...)";
    if (pendingDeleteRequest) {
      if (pendingDeleteRequest.status === "pending") {
        return "Delete (Pending Approval)";
      } else if (pendingDeleteRequest.status === "denied") {
        return "Delete (Previously Denied)";
      } else if (pendingDeleteRequest.status === "approved") {
        return "Delete (Archived)";
      }
    }
    return "Delete";
  };

  const isDeleteDisabled = () => {
    return (
      isArchived ||
      isLoadingDeleteRequest ||
      (pendingDeleteRequest && pendingDeleteRequest.status === "pending")
    );
  };

  // When archived: only Unarchive is enabled; all other actions disabled
  const actionOptions = isArchived
    ? [{ label: "Unarchive", action: () => setShowUnarchiveModal(true) }]
    : [
      { label: "Add Note", action: () => handleActionSelected("add-note") },
      {
        label: "Add Hiring Manager",
        action: () => handleActionSelected("add-hiring-manager"),
      },
      { label: "Add Job", action: () => handleActionSelected("add-job") },
      { label: "Add Task", action: () => handleActionSelected("add-task") },
      {
        label: "Add Tearsheet",
        action: () => handleActionSelected("add-tearsheet"),
      },
      { label: "Transfer", action: () => handleActionSelected("transfer") },
      {
        label: getDeleteLabel(),
        action: () => handleActionSelected("delete"),
        disabled: isDeleteDisabled(),
      },
    ];

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "notes", label: "Notes" },
    { id: "history", label: "History" },
    { id: "quotes", label: "Quotes" },
    { id: "invoices", label: "Invoices" },
    { id: "contacts", label: `Contacts ${hiringManagers.length}` },
    { id: "docs", label: "Docs" },
    { id: "opportunities", label: "Opportunities" },
  ];

  const quickActions = [
    { id: "client-visit", label: "Client Visit" },
    { id: "jobs", label: "Jobs" },
    { id: "submissions", label: "Submissions" },
    { id: "client-submissions", label: "Client Submissions" },
    { id: "interviews", label: "Interviews" },
    { id: "placements", label: "Placements" },
  ];

  // Handle modify button click - redirect to add page with organization ID
  const handleModifyClick = () => {
    if (organizationId) {
      router.push(`/dashboard/organizations/add?id=${organizationId}`);
    }
  };

  // Update the renderModifyTab function to show a button instead of auto-redirecting
  const renderModifyTab = () => {
    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Modify Organization</h2>
        <p className="text-gray-600 mb-4">
          {isArchived
            ? "Archived records cannot be edited."
            : "Click the button below to edit this organization's details."}
        </p>
        <button
          onClick={handleModifyClick}
          disabled={isArchived}
          className={`px-4 py-2 rounded ${isArchived ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
        >
          Modify Organization
        </button>
      </div>
    );
  };

  // Helper function to navigate to a referenced record
  const navigateToReference = (ref: any) => {
    if (!ref || !ref.id) return;

    const refType = typeof ref === "string" ? null : (ref.type || "").toLowerCase().replace(/\s+/g, "");
    const refId = typeof ref === "string" ? null : ref.id;

    if (!refId) return;

    // Map reference types to routes (normalized - spaces removed, lowercase)
    const routeMap: Record<string, string> = {
      organization: `/dashboard/organizations/view?id=${refId}`,
      job: `/dashboard/jobs/view?id=${refId}`,
      jobseeker: `/dashboard/job-seekers/view?id=${refId}`,
      lead: `/dashboard/leads/view?id=${refId}`,
      task: `/dashboard/tasks/view?id=${refId}`,
      placement: `/dashboard/placements/view?id=${refId}`,
      hiringmanager: `/dashboard/hiring-managers/view?id=${refId}`,
    };

    const route = routeMap[refType];
    if (route) {
      router.push(route);
    } else {
      console.warn(`Unknown reference type: ${refType}`);
    }
  };

  // Render notes tab content
  const renderNotesTab = () => {
    // Helper function to parse about_references
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
          <h2 className="text-lg font-semibold">Organization Notes</h2>
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
              {actionFields.map((af) => (
                <option
                  key={af.id || af.field_name || af.field_label}
                  value={af.field_name || af.field_label}
                >
                  {af.field_label || af.field_name}
                </option>
              ))}
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
              {Array.from(new Set(notes.map((n) => n.created_by_name || "Unknown User"))).map(
                (author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                )
              )}
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
              // Find action label from actionFields
              const actionLabel =
                actionFields.find(
                  (af) =>
                    af.field_name === note.action ||
                    af.field_label === note.action
                )?.field_label || note.action || "General Note";

              // Parse about_references
              const aboutRefs = parseAboutReferences(
                (note as any).about_references || (note as any).aboutReferences
              );

              return (
                <div id={`note-${note.id}`} key={note.id} className="p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
                  {/* Note Header: Metadata Section */}
                  <div className="border-b border-gray-200 pb-3 mb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                        {/* Created By and Action */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-blue-600">
                            {note.created_by_name || "Unknown User"}
                          </span>
                          {actionLabel && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                              {actionLabel}
                            </span>
                          )}
                          {/* Source Module Badge */}
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">
                            Organization
                          </span>
                        </div>
                        {/* Date & Time */}
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
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            // View action - scroll to note or highlight
                            const noteElement = document.getElementById(`note-${note.id}`);
                            if (noteElement) {
                              noteElement.scrollIntoView({ behavior: "smooth", block: "center" });
                              noteElement.classList.add("ring-2", "ring-blue-500");
                              setTimeout(() => {
                                noteElement.classList.remove("ring-2", "ring-blue-500");
                              }, 2000);
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

                  {/* Affiliated References Section */}
                  {aboutRefs.length > 0 && (
                    <div className="mb-3 pb-3 border-b border-gray-100">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide min-w-[80px]">
                          References:
                        </span>
                        <div className="flex flex-wrap gap-2 flex-1">
                          {aboutRefs.map((ref: any, idx: number) => {
                            const displayText =
                              typeof ref === "string"
                                ? ref
                                : ref.display || ref.value || `${ref.type} #${ref.id}`;
                            const refType = typeof ref === "string" ? null : (ref.type || "").toLowerCase().replace(/\s+/g, "");
                            const refId = typeof ref === "string" ? null : ref.id;
                            const isClickable = refId && refType;

                            return (
                              <button
                                key={idx}
                                onClick={() => navigateToReference(ref)}
                                disabled={!isClickable}
                                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition-all ${isClickable
                                  ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer"
                                  : "bg-gray-100 text-gray-700 border-gray-200 cursor-default"
                                  }`}
                                title={isClickable ? `View ${refType}` : "Reference not available"}
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                  />
                                </svg>
                                {displayText}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Note Content */}
                  <div className="mt-2">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
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
      <h2 className="text-lg font-semibold mb-4">Organization History</h2>

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
                    actionDisplay = "Organization Created";
                    detailsDisplay = `Created by ${item.performed_by_name || "Unknown"
                      }`;
                    break;
                  case "UPDATE":
                    actionDisplay = "Organization Updated";
                    if (details && details.before && details.after) {
                      // Create a list of changes
                      const changes: React.ReactNode[] = [];

                      // Helper function to format values
                      const formatValue = (val: any): string => {
                        if (val === null || val === undefined) return "Empty";
                        if (typeof val === "string" && val.trim() === "") return "Empty";
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

  if (isLoading) {
    return <LoadingScreen message="Loading organization details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Organizations
        </button>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
        <div className="text-gray-700 mb-4">Organization not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Organizations
        </button>
      </div>
    );
  }
  console.log("Archived_at", organization.archived_at)
  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with company name and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            <HiOutlineOfficeBuilding size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {formatRecordId(organization.record_number ?? organization.id, "organization")}{" "}
            {organization.name}
            {organization.archived_at && (
              <div className="ml-3">
                {/* <span>Archived at</span> */}
                <CountdownTimer archivedAt={organization.archived_at} />
              </div>
            )}
          </h1>
        </div>
      </div>

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
                const info = getHeaderFieldInfo(fk) as { key?: string; label?: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
                return (
                  <div key={fk} className="min-w-[140px]">
                    <div className="text-xs text-gray-500">
                      {getHeaderFieldLabel(fk)}
                    </div>
                    <FieldValueRenderer
                      value={getHeaderFieldValue(fk)}
                      fieldInfo={info ? { key: info.key ?? fk, label: info.label, fieldType: info.fieldType, lookupType: info.lookupType, multiSelectLookupType: info.multiSelectLookupType } : { key: fk, label: getHeaderFieldLabel(fk) }}
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
              disabled={!organization}
            >
              <BsFillPinAngleFill size={18} />
            </button>

            <button
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Reload"
              onClick={() =>
                organizationId && fetchOrganizationData(organizationId)
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
                  handleModifyClick();
                } else {
                  setActiveTab(tab.id);
                  // Refresh hiring managers when contacts tab is activated
                  if (tab.id === "contacts" && organizationId) {
                    fetchHiringManagers(organizationId);
                  }
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex bg-gray-300 p-2 ">
        <div className="flex-1 space-x-2">

          {quickActions.map((action) => {
            // Client Visit with count
            if (action.id === "client-visit") {
              // Prefer live note-based count; fall back to summary API if needed
              const count =
                clientVisitNoteCount > 0
                  ? clientVisitNoteCount
                  : summaryCounts.clientVisits;
              const hasAny = count > 0;
              return (
                <button
                  key={action.id}
                  className={`inline-flex items-center gap-2 px-4 py-1 rounded-full shadow font-medium border ${hasAny
                      ? "border-green-500 bg-green-50 text-green-800"
                      : "border-gray-300 bg-white text-gray-700"
                    }`}
                  onClick={() => {
                    setNoteActionFilter("Client Visit");
                    setActiveTab("notes");
                  }}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full border ${hasAny
                        ? "bg-green-500 border-green-600"
                        : "bg-gray-200 border-gray-400"
                      }`}
                  />
                  <span>
                    {isLoadingSummaryCounts
                      ? "Loading..."
                      : `${count} Client Visit${count !== 1 ? "s" : ""}`}
                  </span>
                </button>
              );
            }
            // Jobs with count
            if (action.id === "jobs") {
              // Prefer jobs array length; fall back to summary API if needed
              const count =
                organizationJobsCount > 0
                  ? organizationJobsCount
                  : summaryCounts.jobs;
              const hasAny = count > 0;
              return (
                <button
                  key={action.id}
                  className={`inline-flex items-center gap-2 px-4 py-1 rounded-full shadow font-medium border ${hasAny
                      ? "border-green-500 bg-green-50 text-green-800"
                      : "border-gray-300 bg-white text-gray-700"
                    }`}
                  onClick={() => setActiveTab("jobs")}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full border ${hasAny
                        ? "bg-green-500 border-green-600"
                        : "bg-gray-200 border-gray-400"
                      }`}
                  />
                  <span>
                    {isLoadingJobs || isLoadingSummaryCounts
                      ? "Loading..."
                      : `${count} ${count === 1 ? "Job" : "Jobs"}`}
                  </span>
                </button>
              );
            }
            // Submissions with count
            if (action.id === "submissions") {
              return (
                <button
                  key={action.id}
                  className="bg-white px-4 py-1 rounded-full shadow font-medium"
                  onClick={() => {
                    setNoteActionFilter("Submission");
                    setActiveTab("notes");
                  }}
                >
                  {isLoadingSummaryCounts
                    ? "Loading..."
                    : `${summaryCounts.submissions} Submission${summaryCounts.submissions !== 1 ? "s" : ""}`}
                </button>
              );
            }
            // Client Submissions with count
            if (action.id === "client-submissions") {
              return (
                <button
                  key={action.id}
                  className="bg-white px-4 py-1 rounded-full shadow font-medium"
                  onClick={() => {
                    setNoteActionFilter("Client Submission");
                    setActiveTab("notes");
                  }}
                >
                  {isLoadingSummaryCounts
                    ? "Loading..."
                    : `${summaryCounts.clientSubmissions} Client Submission${summaryCounts.clientSubmissions !== 1 ? "s" : ""}`}
                </button>
              );
            }
            // Interviews with count
            if (action.id === "interviews") {
              return (
                <button
                  key={action.id}
                  className="bg-white px-4 py-1 rounded-full shadow font-medium"
                  onClick={() => {
                    setNoteActionFilter("Interview");
                    setActiveTab("notes");
                  }}
                >
                  {isLoadingSummaryCounts
                    ? "Loading..."
                    : `${summaryCounts.interviews} Interview${summaryCounts.interviews !== 1 ? "s" : ""}`}
                </button>
              );
            }
            // Placements with count
            if (action.id === "placements") {
              return (
                <button
                  key={action.id}
                  className="bg-white px-4 py-1 rounded-full shadow font-medium"
                  onClick={() => setActiveTab("placements")}
                >
                  {isLoadingSummaryCounts
                    ? "Loading..."
                    : `${summaryCounts.placements} Placement${summaryCounts.placements !== 1 ? "s" : ""}`}
                </button>
              );
            }
            return (
              <button
                key={action.id}
                className="bg-white px-4 py-1 rounded-full shadow"
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        {/* Display content based on active tab */}
        {activeTab === "summary" && (
          <div className="relative">
            {!isPinned && (
              <div id="printable-summary" className="overflow-hidden">
                <DndContext modifiers={[restrictToWindowEdges]}
                  collisionDetection={closestCenter}
                  onDragStart={handlePanelDragStart}
                  onDragOver={handlePanelDragOver}
                  onDragEnd={handlePanelDragEnd}
                  onDragCancel={handlePanelDragCancel}
                >
                  <div className="grid grid-cols-[1fr_1fr] gap-4">
                    {/* Left Column - equal width */}
                    <div className="min-w-0">
                      <DroppableContainer id="left" items={columns.left}>
                        {columns.left.map(renderPanel)}
                      </DroppableContainer>
                    </div>

                    {/* Right Column - equal width */}
                    <div className="min-w-0">
                      <DroppableContainer id="right" items={columns.right}>
                        {columns.right.map(renderPanel)}
                      </DroppableContainer>
                    </div>
                  </div>
                  <DragOverlay>
                    {activeId ? renderPanelPreview(activeId) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            )}
          </div>
        )}

        {/* Modify Tab */}
        {activeTab === "modify" && renderModifyTab()}

        {/* Notes Tab */}
        {activeTab === "notes" && renderNotesTab()}

        {/* History Tab */}
        {activeTab === "history" && renderHistoryTab()}

        {/* Placeholder for other tabs */}
        {activeTab === "quotes" && (
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
        )}

        {/* Document Viewer Modal (shared by Docs and Quotes tabs) */}
        {selectedDocument && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] flex flex-col">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedDocument.document_name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Type: {selectedDocument.document_type}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="p-1 rounded hover:bg-gray-200"
                >
                  <span className="text-2xl font-bold">×</span>
                </button>
              </div>
              <div className="p-4 flex-1 min-h-0 flex flex-col">
                <div className="mb-2">
                  <p className="text-sm text-gray-600">
                    Created by{" "}
                    {selectedDocument.created_by_name || "System"} on{" "}
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
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Invoices</h2>
            <p className="text-gray-500 italic">No invoices available</p>
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Organization Contacts (Hiring Managers)
              </h2>
              <button
                onClick={() => handleActionSelected("add-hiring-manager")}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Add Hiring Manager
              </button>
            </div>

            {isLoadingHiringManagers ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : hiringManagersError ? (
              <div className="text-red-500 py-2">{hiringManagersError}</div>
            ) : hiringManagers.length > 0 ? (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={contactSearchTerm}
                    onChange={(e) => setContactSearchTerm(e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {filteredAndSortedHiringManagers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <DndContext collisionDetection={closestCenter} onDragEnd={handleContactColumnDragEnd}>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100 border-b">
                            <th className="text-left px-6 py-3 font-medium">Actions</th>
                            <SortableContext
                              items={contactColumnFields}
                              strategy={horizontalListSortingStrategy}
                            >
                              {contactColumnFields.map((key) => {
                                const columnInfo = getContactColumnInfo(key);
                                if (!columnInfo) return null;
                                return (
                                  <SortableColumnHeader
                                    key={key}
                                    id={key}
                                    columnKey={key}
                                    label={getContactColumnLabel(key)}
                                    sortState={contactColumnSorts[key] || null}
                                    filterValue={contactColumnFilters[key] || null}
                                    onSort={() => handleContactColumnSort(key)}
                                    onFilterChange={(value) => handleContactColumnFilter(key, value)}
                                    filterType={columnInfo.filterType}
                                    filterOptions={
                                      key === "status" ? contactStatusOptions : undefined
                                    }
                                  />
                                );
                              })}
                            </SortableContext>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAndSortedHiringManagers.map((hm) => (
                            <tr key={hm.id} className="border-b hover:bg-gray-50">
                              <td className="px-6 py-3">
                                <ActionDropdown
                                  label="Actions"
                                  options={[
                                    {
                                      label: "View",
                                      action: () =>
                                        router.push(
                                          `/dashboard/hiring-managers/view?id=${hm.id}`
                                        ),
                                    },
                                  ]}
                                />
                              </td>
                              {contactColumnFields.map((key) => (
                                <td key={key} className="px-6 py-3">
                                  {key === "name" ? (
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/dashboard/hiring-managers/view?id=${hm.id}`
                                        )
                                      }
                                      className="text-blue-600 hover:underline font-medium"
                                    >
                                      {getContactColumnValue(hm, key)}
                                    </button>
                                  ) : key === "email" ? (
                                    getContactColumnValue(hm, key) !== "—" ? (
                                      <a
                                        href={`mailto:${hm.email}`}
                                        className="text-blue-600 hover:underline"
                                      >
                                        {getContactColumnValue(hm, key)}
                                      </a>
                                    ) : (
                                      "—"
                                    )
                                  ) : key === "phone" ? (
                                    (() => {
                                      const phone = hm.phone || "";
                                      const digits = phone.replace(/\D/g, "");
                                      return digits.length >= 7 ? (
                                        <a
                                          href={`tel:${digits}`}
                                          className="text-blue-600 hover:underline"
                                        >
                                          {getContactColumnValue(hm, key)}
                                        </a>
                                      ) : (
                                        getContactColumnValue(hm, key)
                                      );
                                    })()
                                  ) : key === "jobs" ? (
                                    <button
                                      className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800 hover:bg-green-200"
                                      onClick={() => {
                                        const name = encodeURIComponent(hmName(hm));
                                        router.push(
                                          `/dashboard/organizations/view?id=${organizationId}&tab=jobs&hm=${name}`
                                        );
                                        setActiveTab("jobs");
                                      }}
                                    >
                                      {getContactColumnValue(hm, key)} Jobs
                                    </button>
                                  ) : key === "status" ? (
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${hm.status === "Active"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-800"
                                        }`}
                                    >
                                      {getContactColumnValue(hm, key)}
                                    </span>
                                  ) : (
                                    getContactColumnValue(hm, key)
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
                  <p className="text-gray-500 italic py-4 text-center">
                    No contacts match the current filters.
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 italic mb-4">
                  No hiring managers have been added to this organization yet.
                </p>
                <button
                  onClick={() => handleActionSelected("add-hiring-manager")}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add First Hiring Manager
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "docs" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Documents</h2>
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
              onDragEnter={handleDragEnter}
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
              alwaysShowSingleForm
            />

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

            {/* Documents List */}
            {isLoadingDocuments ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : documentError ? (
              <div className="text-red-500 py-2">{documentError}</div>
            ) : filteredAndSortedDocuments.length > 0 ? (
              <div className="overflow-x-auto">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDocumentColumnDragEnd}>
                  <table className="w-full border-collapse">
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
                                  key === "document_type"
                                    ? documentTypeOptions
                                    : key === "is_auto_generated"
                                      ? [
                                        { label: "Yes", value: "Yes" },
                                        { label: "No", value: "No" },
                                      ]
                                      : undefined
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
                                {
                                  label: "View",
                                  action: () => setSelectedDocument(doc),
                                },
                                {
                                  label: "Edit",
                                  action: () => handleEditDocument(doc),
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
                          {documentColumnFields.map((key) => (
                            <td key={key} className="p-3">
                              {key === "document_name" ? (
                                <button
                                  onClick={() => setSelectedDocument(doc)}
                                  className="text-blue-600 hover:underline font-medium"
                                >
                                  {getDocumentColumnValue(doc, key)}
                                </button>
                              ) : key === "source" ? (
                                doc.source_link ? (
                                  <a
                                    href={doc.source_link}
                                    className="text-blue-600 hover:underline"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      router.push(doc.source_link);
                                    }}
                                  >
                                    {doc.source_label || "—"}
                                  </a>
                                ) : (
                                  <span className="text-gray-600">{doc.source_label || "—"}</span>
                                )
                              ) : key === "is_auto_generated" ? (
                                <span
                                  className={`px-2 py-1 rounded text-xs ${doc.is_auto_generated
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                    }`}
                                >
                                  {getDocumentColumnValue(doc, key)}
                                </span>
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
          </div>
        )}

        {activeTab === "jobs" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Organization Jobs</h2>
              <button
                onClick={() => handleActionSelected("add-job")}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Add Job
              </button>
            </div>

            {isLoadingJobs ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : jobsError ? (
              <div className="text-red-500 py-2">{jobsError}</div>
            ) : jobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3 font-medium">Job Title</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Location</th>
                      <th className="text-left p-3 font-medium">
                        Employment Type
                      </th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job: any) => (
                      <tr key={job.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <button
                            onClick={() =>
                              router.push(`/dashboard/jobs/view?id=${job.id}`)
                            }
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {job.job_title || "Untitled Job"}
                          </button>
                        </td>
                        <td className="p-3">{job.category || "-"}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${job.status === "Open"
                              ? "bg-green-100 text-green-800"
                              : job.status === "On Hold"
                                ? "bg-yellow-100 text-yellow-800"
                                : job.status === "Filled"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {job.status || "Open"}
                          </span>
                        </td>
                        <td className="p-3">{job.worksite_location || "-"}</td>
                        <td className="p-3">{job.employment_type || "-"}</td>
                        <td className="p-3">
                          <button
                            onClick={() =>
                              router.push(`/dashboard/jobs/view?id=${job.id}`)
                            }
                            className="text-blue-500 hover:text-blue-700 text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 italic mb-4">
                  No jobs have been added to this organization yet.
                </p>
                <button
                  onClick={() => handleActionSelected("add-job")}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add First Job
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "placements" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Organization Placements</h2>
            {isLoadingPlacements ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
              </div>
            ) : placementsError ? (
              <div className="text-red-500 py-2">{placementsError}</div>
            ) : placements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3 font-medium">ID</th>
                      <th className="text-left p-3 font-medium">Job Seeker</th>
                      <th className="text-left p-3 font-medium">Job Title</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements.map((placement: any) => (
                      <tr key={placement.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{formatRecordId(placement.id, "placement")}</td>
                        <td className="p-3">{placement.jobSeekerName ?? placement.job_seeker_name ?? "-"}</td>
                        <td className="p-3">{placement.jobTitle ?? placement.job_title ?? "-"}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            {placement.status ?? "-"}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() =>
                              router.push(`/dashboard/placements/view?id=${placement.id}`)
                            }
                            className="text-blue-500 hover:text-blue-700 text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic py-4">No placements for this organization yet.</p>
            )}
          </div>
        )}

        {activeTab === "opportunities" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
            <p className="text-gray-500 italic">No opportunities available</p>
          </div>
        )}
      </div>

      {/* Edit Fields Modal - Contact Info uses universal SortableFieldsEditModal */}
      {editingPanel === "contactInfo" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Organization Contact Info"
          description="Drag to reorder, check/uncheck to show/hide. Changes apply to all organization contact cards."
          order={modalContactInfoOrder}
          visible={modalContactInfoVisible}
          fieldCatalog={contactInfoFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={toggleModalContactInfoVisible}
          onDragEnd={handleContactInfoDragEnd}
          onSave={saveContactInfoConfig}
          isLoading={isLoadingFields}
          saveButtonText="Save (applies to all organizations)"
          isSaveDisabled={modalContactInfoOrder.filter((k) => modalContactInfoVisible[k]).length === 0}
        />
      )}
      {editingPanel && editingPanel !== "contactInfo" && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Edit Fields - {editingPanel}
              </h2>
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
                      const visible = availableFields.filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden);
                      const seenKeys = new Set<string>();
                      const deduped = visible.filter((f: any) => {
                        const key = String(f.field_key ?? f.api_name ?? f.field_name ?? f.id);
                        if (seenKeys.has(key)) return false;
                        seenKeys.add(key);
                        return true;
                      });
                      return deduped.length > 0 ? (
                        deduped.map((field: any) => {
                          const fieldKey =
                            field.field_key || field.api_name || field.field_name || field.id;
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
                        contactInfo: [
                          { key: "name", label: "Name" },
                          { key: "nickname", label: "Nickname" },
                          { key: "phone", label: "Phone" },
                          { key: "address", label: "Address" },
                          { key: "website", label: "Website" },
                        ],
                        about: [{ key: "about", label: "About" }],
                        recentNotes: [{ key: "notes", label: "Notes" }],
                        websiteJobs: [{ key: "jobs", label: "Jobs" }],
                        ourJobs: [{ key: "jobs", label: "Jobs" }],
                      };

                      const availableKeys = new Set(
                        (availableFields || [])
                          .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
                          .map((f: any) => String(f.field_key ?? f.api_name ?? f.field_name ?? f.id))
                      );
                      const fields = (standardFieldsMap[editingPanel] || []).filter(
                        (f) => !availableKeys.has(f.key)
                      );
                      if (fields.length === 0) {
                        return (
                          <div className="text-sm text-gray-500 italic py-2">
                            All standard fields are covered by custom fields above.
                          </div>
                        );
                      }
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

      {showAddNote && organization && (
        <AddNoteModal
          open={showAddNote}
          onClose={handleCloseAddNoteModal}
          entityType="organization"
          entityId={organizationId ?? ""}
          entityDisplay={organization.name}
          onSuccess={() => {
            if (organizationId) {
              fetchNotes(organizationId);
              fetchHistory(organizationId);
              fetchSummaryCounts();
            }
          }}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Transfer Organization</h2>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferForm({ targetOrganizationId: "" });
                  setTransferSearchQuery("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Source Organization Info */}
              <div className="bg-gray-50 p-4 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Organization
                </label>
                <p className="text-sm text-gray-900 font-medium">
                  {organization
                    ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}`
                    : "N/A"}
                </p>
              </div>

              {/* Target Organization Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500 mr-1">•</span>
                  Select Target Organization
                </label>
                {isLoadingOrganizations ? (
                  <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                    Loading organizations...
                  </div>
                ) : availableOrganizations.length === 0 ? (
                  <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                    No available organizations found
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
                      placeholder="Search by organization name or Record ID..."
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {showTransferDropdown && (transferSearchQuery || availableOrganizations.length > 0) && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                        {filteredTransferOrganizations.length > 0 ? (
                          filteredTransferOrganizations.map((org: any) => (
                            <button
                              key={org.id}
                              type="button"
                              onClick={() => {
                                setTransferForm((prev) => ({
                                  ...prev,
                                  targetOrganizationId: String(org.id),
                                }));
                                setTransferSearchQuery(`${formatRecordId(org.record_number ?? org.id, "organization")} ${org.name || ""}`.trim());
                                setShowTransferDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex flex-col"
                            >
                              <span className="text-sm font-medium text-gray-900">
                                {formatRecordId(org.record_number ?? org.id, "organization")} {org.name}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No matching organizations found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Transfer Info */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will create a transfer request. Payroll will be
                  notified via email and must approve or deny the transfer. Notes will be
                  automatically added to both organizations.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferForm({ targetOrganizationId: "" });
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
                disabled={
                  isSubmittingTransfer || !transferForm.targetOrganizationId
                }
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
      )}

      {/* Unarchive Request Modal */}
      <RequestActionModal
        open={showUnarchiveModal}
        onClose={() => {
          setShowUnarchiveModal(false);
          setUnarchiveReason("");
        }}
        modelType="unarchive"
        entityLabel="Organization"
        recordDisplay={
          organization
            ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}`
            : "N/A"
        }
        reason={unarchiveReason}
        onReasonChange={setUnarchiveReason}
        onSubmit={handleUnarchiveSubmit}
        isSubmitting={isSubmittingUnarchive}
      />

      {/* Delete Request Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {deleteActionType === 'cascade' ? "Request Cascade Deletion" : "Request Deletion"}
              </h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteForm({ reason: "" });
                  setCascadeUserConsent(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
              {/* Organization Info */}
              <div className="bg-gray-50 p-4 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization to Delete
                </label>
                <p className="text-sm text-gray-900 font-medium">
                  {organization
                    ? `${formatRecordId(organization.record_number ?? organization.id, "organization")} ${organization.name}`
                    : "N/A"}
                </p>
                {deleteActionType === 'cascade' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-2">
                    Cascade Delete Mode
                  </span>
                )}
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

              {/* Cascade Consent Checkbox */}
              {deleteActionType === 'cascade' && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-sm text-red-800 mb-3">
                    <strong>Warning:</strong> You are requesting to delete this organization AND all linked records:
                  </p>
                  <ul className="list-disc list-inside text-xs text-red-700 mb-3 space-y-1">
                    {dependencyCounts?.hiring_managers > 0 && <li>{dependencyCounts.hiring_managers} Hiring Managers</li>}
                    {dependencyCounts?.jobs > 0 && <li>{dependencyCounts.jobs} Jobs</li>}
                    {dependencyCounts?.placements > 0 && <li>{dependencyCounts.placements} Placements</li>}
                    {dependencyCounts?.child_organizations > 0 && <li>{dependencyCounts.child_organizations} Child Organizations</li>}
                  </ul>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cascadeUserConsent}
                      onChange={(e) => setCascadeUserConsent(e.target.checked)}
                      className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm text-red-900">
                      I understand that this action will delete all linked records and cannot be undone once approved.
                    </span>
                  </label>
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
                  placeholder="Please provide a detailed reason for deleting this organization..."
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
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteForm({ reason: "" });
                  setCascadeUserConsent(false);
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
                  (pendingDeleteRequest && pendingDeleteRequest.status === "pending") ||
                  (deleteActionType === 'cascade' && !cascadeUserConsent)
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

      {/* Dependency Warning Modal */}
      {showDependencyWarningModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Linked Records Found</h2>
              <button
                onClick={() => setShowDependencyWarningModal(false)}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-orange-100 p-2 rounded-full">
                    <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">
                    This organization has linked records. You must either transfer these records to another organization or request a cascade deletion.
                  </p>
                </div>
              </div>

              {/* Detailed Records */}
              <div className="space-y-4">
                {/* Hiring Managers */}
                {dependencyCounts?.details?.hiring_managers?.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Hiring Managers ({dependencyCounts.details.hiring_managers.length})
                      </h4>
                    </div>
                    <div className="divide-y">
                      {dependencyCounts.details.hiring_managers.map((hm: any) => (
                        <div key={hm.id} className="px-4 py-2 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => router.push(`/dashboard/hiring-managers/view?id=${hm.id}`)}
                              className="text-left flex-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <span className="font-medium">{formatRecordId(hm.id, "hiringManager")}</span>
                              <span className="ml-2">{hm.name}</span>
                              {hm.title && <span className="ml-2 text-gray-500 text-xs">({hm.title})</span>}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Jobs */}
                {dependencyCounts?.details?.jobs?.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Jobs ({dependencyCounts.details.jobs.length})
                      </h4>
                    </div>
                    <div className="divide-y">
                      {dependencyCounts.details.jobs.map((job: any) => (
                        <div key={job.id} className="px-4 py-2 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => router.push(`/dashboard/jobs/view?id=${job.id}`)}
                              className="text-left flex-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <span className="font-medium">{formatRecordId(job.id, "job")}</span>
                              <span className="ml-2">{job.name}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Placements */}
                {dependencyCounts?.details?.placements?.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Placements ({dependencyCounts.details.placements.length})
                      </h4>
                    </div>
                    <div className="divide-y">
                      {dependencyCounts.details.placements.map((placement: any) => (
                        <div key={placement.id} className="px-4 py-2 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => router.push(`/dashboard/placements/view?id=${placement.id}`)}
                              className="text-left flex-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <span className="font-medium">{formatRecordId(placement.id, "placement")}</span>
                              <span className="ml-2">{placement.name}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Child Organizations */}
                {dependencyCounts?.details?.child_organizations?.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Child Organizations ({dependencyCounts.details.child_organizations.length})
                      </h4>
                    </div>
                    <div className="divide-y">
                      {dependencyCounts.details.child_organizations.map((org: any) => (
                        <div key={org.id} className="px-4 py-2 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => router.push(`/dashboard/organizations/view?id=${org.id}`)}
                              className="text-left flex-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <span className="font-medium">{formatRecordId(org.record_number ?? org.id, "organization")}</span>
                              <span className="ml-2">{org.name}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t bg-gray-50 space-y-3">

              <button
                onClick={() => {
                  setShowDependencyWarningModal(false);
                  // Open Transfer Modal
                  handleActionSelected("transfer");
                }}
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Transfer Organization Records
              </button>

              <button
                onClick={() => {
                  setShowDependencyWarningModal(false);
                  setDeleteActionType("cascade");
                  setShowDeleteModal(true);
                }}
                className="w-full flex justify-center items-center px-4 py-2 border border-red-300 rounded shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Request Cascade Deletion (Delete All)
              </button>

              <button
                onClick={() => setShowDependencyWarningModal(false)}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <AddTearsheetModal
        open={showAddTearsheetModal}
        onClose={() => setShowAddTearsheetModal(false)}
        entityType="organization"
        entityId={organizationId || ""}
      />
      {/* Header Fields Modal */}
      {showHeaderFieldModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowHeaderFieldModal(false)}
          title="Customize Header Fields"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all organization records."
          order={headerFieldsOrder.length > 0 ? headerFieldsOrder : headerFieldCatalog.map((f) => f.key)}
          visible={Object.fromEntries(headerFieldCatalog.map((f) => [f.key, headerFields.includes(f.key)]))}
          fieldCatalog={headerFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
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
          onDragEnd={handleHeaderFieldsDragEnd}
          onSave={async () => {
            const success = await saveHeaderConfig();
            if (success) setShowHeaderFieldModal(false);
          }}
          saveButtonText="Done"
          isSaveDisabled={headerFields.length === 0}
          onReset={() => {
            setHeaderFields(ORG_DEFAULT_HEADER_FIELDS);
            setHeaderFieldsOrder(ORG_DEFAULT_HEADER_FIELDS);
          }}
          resetButtonText="Reset"
        />
      )}

      {/* Edit Website URL Modal for "Open Jobs from Website" panel */}
      {isEditingWebsiteUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-lg w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Set Jobs Page URL</h2>
              <button
                onClick={() => {
                  if (!isSavingWebsiteUrl) {
                    setIsEditingWebsiteUrl(false);
                  }
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Enter the full URL of the client&apos;s jobs page (for example,
                <span className="font-mono"> https://example.com/jobs</span>). This URL will:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Be used to embed the jobs page in the &quot;Open Jobs from Website&quot; panel.</li>
                <li>Update the main <span className="font-semibold">Website</span> field for this organization.</li>
                <li>Update the <span className="font-mono">Organization Website</span> custom field from Admin Center.</li>
              </ul>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jobs Page URL
                </label>
                <input
                  type="text"
                  value={tempWebsiteUrl}
                  onChange={(e) => setTempWebsiteUrl(e.target.value)}
                  placeholder="https://company-site.com/jobs"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  if (!isSavingWebsiteUrl) {
                    setIsEditingWebsiteUrl(false);
                  }
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50"
                disabled={isSavingWebsiteUrl}
              >
                Cancel
              </button>
              <button
                onClick={saveWebsiteUrl}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={isSavingWebsiteUrl || !tempWebsiteUrl.trim()}
              >
                {isSavingWebsiteUrl ? "Saving..." : "Save URL"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
