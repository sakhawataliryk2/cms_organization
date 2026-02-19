"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import PanelWithHeader from "@/components/PanelWithHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { FiTarget, FiSearch } from "react-icons/fi";
import { BsFillPinAngleFill } from "react-icons/bs";
import { HiOutlineOfficeBuilding, HiOutlineUser } from "react-icons/hi";
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
// Drag and drop 
import DocumentViewer from "@/components/DocumentViewer";
import HistoryTabFilters, { useHistoryFilters } from "@/components/HistoryTabFilters";
import ConfirmFileDetailsModal from "@/components/ConfirmFileDetailsModal";
import { toast } from "sonner";
import AddTearsheetModal from "@/components/AddTearsheetModal";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import RequestActionModal from "@/components/RequestActionModal";
import AddNoteModal from "@/components/AddNoteModal";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import CountdownTimer from "@/components/CountdownTimer";
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
import { TbGripVertical } from "react-icons/tb";

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

// Sortable row for Lead Details edit modal (vertical drag + checkbox + label)
function SortableDetailsFieldRow({
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

import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";

// Default header fields for Leads module - defined outside component to ensure stable reference
const LEAD_DEFAULT_HEADER_FIELDS = ["phone", "email"];

// Storage keys for Lead Contact Info, Details, Website Jobs, Our Jobs – field lists come from admin (custom field definitions)
const LEAD_CONTACT_INFO_STORAGE_KEY = "leadsContactInfoFields";
const LEAD_DETAILS_STORAGE_KEY = "leadsDetailsFields";
const WEBSITE_JOBS_STORAGE_KEY = "leadsWebsiteJobsFields";
const OUR_JOBS_STORAGE_KEY = "leadsOurJobsFields";

const LEAD_VIEW_TAB_IDS = ["summary", "modify", "notes", "history", "quotes", "invoices", "contacts", "docs", "opportunities"];

export default function LeadView() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const leadId = searchParams.get("id");
  const tabFromUrl = searchParams.get("tab");

  const [lead, setLead] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // Notes and history state
  const [notes, setNotes] = useState<
    Array<{
      id: string;
      text: string;
      created_at: string;
      created_by_name: string;
      note_type?: string;
      action?: string;
    }>
  >([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyFilters = useHistoryFilters(history);
  const [showAddNote, setShowAddNote] = useState(false);
  
  // Add Note form state - matching Organization view structure
  const [noteForm, setNoteForm] = useState({
    text: "",
    action: "",
    about: lead ? `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${lead.name || lead.company_name || ""}` : "",
    aboutReferences: lead
      ? [
        {
          id: lead.id,
          type: "Lead",
          display: `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${lead.name || lead.company_name || "Unnamed"}`,
          value: formatRecordId(lead.record_number ?? lead.id, "lead"),
        },
      ]
      : [],
    copyNote: "No",
    replaceGeneralContactComments: false,
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

  // Email notification search state
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Action fields state
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

  // Note sorting & filtering (match Organization Notes design)
  const [noteActionFilter, setNoteActionFilter] = useState<string>("");
  const [noteAuthorFilter, setNoteAuthorFilter] = useState<string>("");
  const [noteSortKey, setNoteSortKey] = useState<"date" | "action" | "author">("date");
  const [noteSortDir, setNoteSortDir] = useState<"asc" | "desc">("desc");

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
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [unarchiveReason, setUnarchiveReason] = useState("");
  const [isSubmittingUnarchive, setIsSubmittingUnarchive] = useState(false);

  const sortedFilteredNotes = useMemo(() => {
    let out = [...notes];
    if (noteActionFilter) {
      out = out.filter((n) => (n.note_type || n.action || "") === noteActionFilter);
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
          av = a.note_type || a.action || "";
          bv = b.note_type || b.action || "";
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
      const cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true });
      return noteSortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [notes, noteActionFilter, noteAuthorFilter, noteSortKey, noteSortDir]);

  // Documents state
  const [documents, setDocuments] = useState<Array<any>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newDocumentType, setNewDocumentType] = useState("General");
  const [newDocumentContent, setNewDocumentContent] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileDetailsName, setFileDetailsName] = useState("");
  const [fileDetailsType, setFileDetailsType] = useState("General");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const [editDocumentName, setEditDocumentName] = useState("");
  const [editDocumentType, setEditDocumentType] = useState("General");
  const [isDragging, setIsDragging] = useState(false);

  const [tasks, setTasks] = useState<Array<any>>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);

  // Current active tab (sync with ?tab= URL param for shareable links)
  const [activeTab, setActiveTabState] = useState(() =>
    tabFromUrl && LEAD_VIEW_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "summary"
  );

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "summary") params.delete("tab");
    else params.set("tab", tabId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (tabFromUrl && LEAD_VIEW_TAB_IDS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    } else if (!tabFromUrl && activeTab !== "summary") {
      setActiveTabState("summary");
    }
  }, [tabFromUrl]);

  const handleTogglePinnedRecord = () => {
    if (!lead) return;
    const key = buildPinnedKey("lead", lead.id);
    const label = lead.fullName || String(lead.id);
    let url = `/dashboard/leads/view?id=${lead.id}`;
    if (activeTab && activeTab !== "summary") url += `&tab=${activeTab}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      toast.info("Maximum 10 pinned records reached");
    }
  };

  useEffect(() => {
    const syncPinned = () => {
      if (!lead) return;
      const key = buildPinnedKey("lead", lead.id);
      setIsRecordPinned(isPinnedRecord(key));
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [lead]);

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);

  // Drag and drop state
  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["contactInfo", "details"],
    right: ["recentNotes", "websiteJobs", "ourJobs", "openTasks"],
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
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
      const saved = localStorage.getItem("leadsSummaryColumns");
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

  // Initialize Lead Contact Info field order/visibility from localStorage (persists across all lead records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(LEAD_CONTACT_INFO_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Remove duplicates before setting
        const unique = Array.from(new Set(parsed));
        setVisibleFields((prev) => ({ ...prev, contactInfo: unique }));
      }
    } catch (_) {
      /* keep default */
    }
  }, []);

  // Initialize Lead Details field order/visibility from localStorage (persists across all lead records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(LEAD_DETAILS_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Remove duplicates before setting
        const unique = Array.from(new Set(parsed));
        setVisibleFields((prev) => ({ ...prev, details: unique }));
      }
    } catch (_) {
      /* keep default */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedW = localStorage.getItem(WEBSITE_JOBS_STORAGE_KEY);
    if (savedW) {
      try {
        const parsed = JSON.parse(savedW);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleFields((prev) => ({ ...prev, websiteJobs: parsed }));
        }
      } catch (_) { }
    }
    const savedO = localStorage.getItem(OUR_JOBS_STORAGE_KEY);
    if (savedO) {
      try {
        const parsed = JSON.parse(savedO);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleFields((prev) => ({ ...prev, ourJobs: parsed }));
        }
      } catch (_) { }
    }
  }, []);

  const prevColumnsRef = useRef<string>("");

  // Save columns to localStorage
  useEffect(() => {
    const colsString = JSON.stringify(columns);
    if (prevColumnsRef.current !== colsString) {
      localStorage.setItem("leadsSummaryColumns", colsString);
      prevColumnsRef.current = colsString;
    }
  }, [columns]);

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
  };

  const handlePanelDragCancel = () => {
    setActiveId(null);
  };

  const handlePanelDragOver = (_event: DragOverEvent) => {
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
  };
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") {
      return { contactInfo: [], details: [], recentNotes: ["notes"], websiteJobs: ["jobs"], ourJobs: ["jobs"] };
    }
    let contactInfo: string[] = [];
    let details: string[] = [];
    let websiteJobs: string[] = ["jobs"];
    let ourJobs: string[] = ["jobs"];
    try {
      const c = localStorage.getItem(LEAD_CONTACT_INFO_STORAGE_KEY);
      if (c) {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed) && parsed.length > 0) contactInfo = Array.from(new Set(parsed));
      }
    } catch (_) { }
    try {
      const d = localStorage.getItem(LEAD_DETAILS_STORAGE_KEY);
      if (d) {
        const parsed = JSON.parse(d);
        if (Array.isArray(parsed) && parsed.length > 0) details = Array.from(new Set(parsed));
      }
    } catch (_) { }
    try {
      const w = localStorage.getItem(WEBSITE_JOBS_STORAGE_KEY);
      if (w) {
        const parsed = JSON.parse(w);
        if (Array.isArray(parsed) && parsed.length > 0) websiteJobs = Array.from(new Set(parsed));
      }
    } catch (_) { }
    try {
      const o = localStorage.getItem(OUR_JOBS_STORAGE_KEY);
      if (o) {
        const parsed = JSON.parse(o);
        if (Array.isArray(parsed) && parsed.length > 0) ourJobs = Array.from(new Set(parsed));
      }
    } catch (_) { }
    return { contactInfo, details, recentNotes: ["notes"], websiteJobs, ourJobs };
  });
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  // Lead Contact Info edit modal: order and visibility (synced when modal opens)
  const [modalContactInfoOrder, setModalContactInfoOrder] = useState<string[]>([]);
  const [modalContactInfoVisible, setModalContactInfoVisible] = useState<Record<string, boolean>>({});
  // Lead Details edit modal: order and visibility (synced when modal opens)
  const [modalDetailsOrder, setModalDetailsOrder] = useState<string[]>([]);
  const [modalDetailsVisible, setModalDetailsVisible] = useState<Record<string, boolean>>({});
  const [detailsDragActiveId, setDetailsDragActiveId] = useState<string | null>(null);

  const [modalWebsiteJobsOrder, setModalWebsiteJobsOrder] = useState<string[]>([]);
  const [modalWebsiteJobsVisible, setModalWebsiteJobsVisible] = useState<Record<string, boolean>>({});
  const [websiteJobsDragActiveId, setWebsiteJobsDragActiveId] = useState<string | null>(null);

  const [modalOurJobsOrder, setModalOurJobsOrder] = useState<string[]>([]);
  const [modalOurJobsVisible, setModalOurJobsVisible] = useState<Record<string, boolean>>({});
  const [ourJobsDragActiveId, setOurJobsDragActiveId] = useState<string | null>(null);

  // =========================
  const {
    headerFields,
    setHeaderFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    saveHeaderConfig,
  } = useHeaderConfig({
    entityType: "LEAD",
    configType: "header",
    defaultFields: LEAD_DEFAULT_HEADER_FIELDS,
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
    if (!lead) return "-";
    const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;
    const l = lead as any;
    let v = l[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    v = lead.customFields?.[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    const field = headerFieldCatalog.find((f) => f.key === key);
    if (field) v = lead.customFields?.[field.label];
    return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
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

  // Fetch lead data when component mounts
  useEffect(() => {
    if (leadId) {
      fetchLeadData(leadId);
    }
  }, [leadId]);

  // Fetch available fields after lead is loaded
  useEffect(() => {
    if (lead && leadId) {
      fetchAvailableFields();
    }
  }, [lead, leadId]);

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const response = await fetch('/api/admin/field-management/leads');
      if (response.ok) {
        const data = await response.json();
        const fields = data.customFields || [];
        setAvailableFields(fields);
      }
    } catch (err) {
      console.error('Error fetching available fields:', err);
    } finally {
      setIsLoadingFields(false);
    }
  };

  // Toggle field visibility
  const toggleFieldVisibility = (panelId: string, fieldKey: string) => {
    setVisibleFields(prev => {
      const panelFields = prev[panelId] || [];
      const uniqueFields = Array.from(new Set(panelFields));
      if (uniqueFields.includes(fieldKey)) {
        return {
          ...prev,
          [panelId]: uniqueFields.filter(f => f !== fieldKey)
        };
      } else {
        return {
          ...prev,
          [panelId]: Array.from(new Set([...uniqueFields, fieldKey]))
        };
      }
    });
  };

  // Lead Contact Info field catalog: from admin field definitions + record customFields only (no hardcoded standard)
  const contactInfoFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    return [...fromApi];
  }, [availableFields]);

  // Lead Details field catalog: from admin field definitions + record customFields only
  const detailsFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    return [...fromApi];
  }, [availableFields]);

  // When catalog loads, if contactInfo/details visible list is empty, default to all catalog keys
  useEffect(() => {
    const keys = contactInfoFieldCatalog.map((f) => f.key);
    if (keys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.contactInfo || [];
        if (current.length > 0) return prev;
        return { ...prev, contactInfo: keys };
      });
    }
  }, [contactInfoFieldCatalog]);

  useEffect(() => {
    const keys = detailsFieldCatalog.map((f) => f.key);
    if (keys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.details || [];
        if (current.length > 0) return prev;
        return { ...prev, details: keys };
      });
    }
  }, [detailsFieldCatalog]);

  // Sync Lead Contact Info modal state when opening edit for contactInfo
  useEffect(() => {
    if (editingPanel !== "contactInfo") return;
    const current = visibleFields.contactInfo || [];
    const catalogKeys = contactInfoFieldCatalog.map((f) => f.key);
    // Remove duplicates from catalogKeys
    const uniqueCatalogKeys = Array.from(new Set(catalogKeys));

    const currentInCatalog = current.filter((k) => uniqueCatalogKeys.includes(k));
    const rest = uniqueCatalogKeys.filter((k) => !current.includes(k));
    const order = [...currentInCatalog, ...rest];

    const uniqueOrder = Array.from(new Set(order));
    setModalContactInfoOrder(uniqueOrder);
    setModalContactInfoVisible(
      uniqueCatalogKeys.reduce((acc, k) => {
        acc[k] = current.includes(k);
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.contactInfo, contactInfoFieldCatalog]);

  // Sync Lead Details modal state when opening edit for details
  useEffect(() => {
    if (editingPanel !== "details") return;
    const current = visibleFields.details || [];
    const catalogKeys = detailsFieldCatalog.map((f) => f.key);
    // Remove duplicates from catalogKeys
    const uniqueCatalogKeys = Array.from(new Set(catalogKeys));
    const order = [...current.filter((k) => uniqueCatalogKeys.includes(k))];
    uniqueCatalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    // Ensure order has no duplicates
    const uniqueOrder = Array.from(new Set(order));
    setModalDetailsOrder(uniqueOrder);
    setModalDetailsVisible(
      uniqueCatalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.details, detailsFieldCatalog]);

  const websiteJobsFieldCatalog = useMemo(() => [{ key: "jobs", label: "Jobs" }], []);
  const ourJobsFieldCatalog = useMemo(() => [{ key: "jobs", label: "Jobs" }], []);

  useEffect(() => {
    if (editingPanel !== "websiteJobs") return;
    const current = visibleFields.websiteJobs || [];
    const catalogKeys = websiteJobsFieldCatalog.map((f) => f.key);
    const order = [...current.filter((k) => catalogKeys.includes(k))];
    catalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    setModalWebsiteJobsOrder(order);
    setModalWebsiteJobsVisible(
      catalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.websiteJobs, websiteJobsFieldCatalog]);

  useEffect(() => {
    if (editingPanel !== "ourJobs") return;
    const current = visibleFields.ourJobs || [];
    const catalogKeys = ourJobsFieldCatalog.map((f) => f.key);
    const order = [...current.filter((k) => catalogKeys.includes(k))];
    catalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    setModalOurJobsOrder(order);
    setModalOurJobsVisible(
      catalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.ourJobs, ourJobsFieldCatalog]);

  // Handle edit panel click
  const renderPanel = (id: string, isOverlay = false) => {
    switch (id) {
      case "contactInfo":
        if (!lead) return null;
        const customObj = lead.customFields || {};
        const customFieldDefs = (availableFields || []).filter((f: any) => {
          const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
          return !isHidden;
        });

        const getContactInfoLabel = (key: string) => {
          const field = contactInfoFieldCatalog.find((f) => f.key === key);
          return field?.label || customFieldDefs.find((f: any) => String(f.field_name || f.field_key || f.api_name || f.id) === String(key))?.field_label || key;
        };

        const getContactInfoValue = (key: string): string => {
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
          return value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : "-";
        };

        const contactKeys = Array.from(new Set(visibleFields.contactInfo || []));
        const effectiveRows: { key: string; label: string }[] = [];
        for (const key of contactKeys) {
          effectiveRows.push({ key, label: getContactInfoLabel(key) });
        }

        const renderContactInfoRow = (row: { key: string; label: string }) => {
          const value = getContactInfoValue(row.key);
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
              <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">{row.label}:</div>
              <div className="flex-1 p-2 text-sm">
                <FieldValueRenderer
                  value={value}
                  fieldInfo={fieldInfo as any}
                  allFields={customFieldDefs as any}
                  valuesRecord={customObj as any}
                  emptyPlaceholder="-"
                  clickable
                />
              </div>
            </div>
          );
        };

        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
            <PanelWithHeader
              title="Lead Contact Info:"
              onEdit={() => handleEditPanel("contactInfo")}
            >
              <div className="space-y-0 border border-gray-200 rounded">
                {effectiveRows.map((row) => renderContactInfoRow(row))}
              </div>
            </PanelWithHeader>
          </SortablePanel>
        );
      case "details":
        if (!lead) return null;
        const detailsCustomObj = lead.customFields || {};
        const detailsCustomFieldDefs = (availableFields || []).filter((f: any) => {
          const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
          return !isHidden;
        });

        const renderDetailsRow = (key: string) => {
          // Standard fields
          switch (key) {
            // case "status":
            //   return (
            //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Status:</div>
            //       <div className="flex-1 p-2">
            //         <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{lead?.status}</span>
            //       </div>
            //     </div>
            //   );
            // case "owner":
            //   return (
            //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Owner:</div>
            //       <div className="flex-1 p-2">{lead?.owner || "-"}</div>
            //     </div>
            //   );
            // case "reportsTo":
            //   return (
            //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Reports To:</div>
            //       <div className="flex-1 p-2">{lead?.reportsTo || "-"}</div>
            //     </div>
            //   );
            // case "dateAdded":
            //   return (
            //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Date Added:</div>
            //       <div className="flex-1 p-2">{lead?.dateAdded || "-"}</div>
            //     </div>
            //   );
            // case "lastContactDate":
            //   return (
            //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Last Contact Date:</div>
            //       <div className="flex-1 p-2">{lead?.lastContactDate || "-"}</div>
            //     </div>
            //   );
            default:
              // Custom field
              const field = detailsCustomFieldDefs.find(
                (f: any) =>
                  String(f.field_name || f.field_key || f.api_name || f.id) === String(key) ||
                  String(f.field_label || "") === String(key) ||
                  String(f.field_name || "") === String(key)
              );
              const value =
                (detailsCustomObj as any)?.[key] ??
                (field?.field_label ? (detailsCustomObj as any)?.[field.field_label] : undefined) ??
                (field?.field_name ? (detailsCustomObj as any)?.[field.field_name] : undefined);
              const label = field?.field_label || field?.field_name || key;
              const fieldInfo = {
                key,
                label,
                fieldType: field?.field_type ?? field?.fieldType,
                lookupType: field?.lookup_type ?? field?.lookupType,
                multiSelectLookupType: field?.multi_select_lookup_type ?? field?.multiSelectLookupType,
              };
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">{label}:</div>
                  <div className="flex-1 p-2 text-sm">
                    <FieldValueRenderer
                      value={value}
                      fieldInfo={fieldInfo as any}
                      emptyPlaceholder="-"
                      clickable
                    />
                  </div>
                </div>
              );
          }
        };

        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
            <PanelWithHeader
              title="Lead Details"
              onEdit={() => handleEditPanel("details")}
            >
              <div className="space-y-0 border border-gray-200 rounded">
                {Array.from(new Set(visibleFields.details || [])).map((key) => renderDetailsRow(key))}
              </div>
            </PanelWithHeader>
          </SortablePanel>
        );
      case "recentNotes":
        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
            <PanelWithHeader
              title="Recent Notes"
              onEdit={() => handleEditPanel("recentNotes")}
            >
              {isLoadingNotes ? (
                <div className="text-gray-500 text-sm italic p-2">
                  Loading notes...
                </div>
              ) : notes.length === 0 ? (
                <div className="text-gray-500 text-sm italic p-2">
                  No notes found.
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.slice(0, 3).map((note) => (
                    <div
                      key={note.id}
                      className="p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                        <span className="text-xs font-medium text-blue-600">
                          {note.created_by_name}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {note.text}
                      </p>
                    </div>
                  ))}
                  {notes.length > 3 && (
                    <button
                      onClick={() => setActiveTab("notes")}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View all {notes.length} notes
                    </button>
                  )}
                </div>
              )}
            </PanelWithHeader>
          </SortablePanel>
        );
      case "openTasks":
        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
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
          </SortablePanel>
        );
      case "websiteJobs":
        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
            <PanelWithHeader
              title="Open Jobs from Website:"
              onEdit={() => handleEditPanel("websiteJobs")}
            >
              <div className="border border-gray-200 rounded">
                <div className="p-2">
                  <p className="text-gray-500 italic">No open jobs found</p>
                </div>
              </div>
            </PanelWithHeader>
          </SortablePanel>
        );
      case "ourJobs":
        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
            <PanelWithHeader
              title="Our Open Jobs:"
              onEdit={() => handleEditPanel("ourJobs")}
            >
              <div className="border border-gray-200 rounded">
                <div className="p-2">
                  <p className="text-gray-500 italic">No open jobs</p>
                </div>
              </div>
            </PanelWithHeader>
          </SortablePanel>
        );
      default:
        return null;
    }
  };

  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Lead Contact Info modal: drag end (reorder)
  const handleContactInfoDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setModalContactInfoOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // Lead Contact Info modal: save order/visibility and persist for all lead records
  const handleSaveContactInfoFields = useCallback(() => {
    const newOrder = Array.from(new Set(modalContactInfoOrder.filter((k) => modalContactInfoVisible[k] === true)));
    if (typeof window !== "undefined") {
      localStorage.setItem(LEAD_CONTACT_INFO_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, contactInfo: newOrder }));
    setEditingPanel(null);
  }, [modalContactInfoOrder, modalContactInfoVisible]);

  // Lead Details modal: drag end (reorder)
  const handleDetailsDragEnd = useCallback((event: DragEndEvent) => {
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

  // Lead Details modal: save order/visibility and persist for all lead records
  const handleSaveDetailsFields = useCallback(() => {
    const newOrder = Array.from(new Set(modalDetailsOrder.filter((k) => modalDetailsVisible[k])));
    if (typeof window !== "undefined") {
      localStorage.setItem(LEAD_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, details: newOrder }));
    setEditingPanel(null);
  }, [modalDetailsOrder, modalDetailsVisible]);

  const handleWebsiteJobsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setWebsiteJobsDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalWebsiteJobsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleSaveWebsiteJobsFields = useCallback(() => {
    const newOrder = modalWebsiteJobsOrder.filter((k) => modalWebsiteJobsVisible[k]);
    if (typeof window !== "undefined") {
      localStorage.setItem(WEBSITE_JOBS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, websiteJobs: newOrder }));
    setEditingPanel(null);
  }, [modalWebsiteJobsOrder, modalWebsiteJobsVisible]);

  const handleOurJobsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setOurJobsDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalOurJobsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleSaveOurJobsFields = useCallback(() => {
    const newOrder = modalOurJobsOrder.filter((k) => modalOurJobsVisible[k]);
    if (typeof window !== "undefined") {
      localStorage.setItem(OUR_JOBS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, ourJobs: newOrder }));
    setEditingPanel(null);
  }, [modalOurJobsOrder, modalOurJobsVisible]);

  const fetchTasks = async (leadId: string) => {
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
      const leadTasks = (tasksData.tasks || []).filter((task: any) => {
        if (task.is_completed === true || task.status === "Completed") return false;
        const taskLeadId = task.lead_id?.toString();
        return taskLeadId && taskLeadId === leadId.toString();
      });
      setTasks(leadTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasksError(err instanceof Error ? err.message : "An error occurred while fetching tasks");
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const fetchLeadData = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching lead data for ID: ${id}`);
      const response = await fetch(`/api/leads/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      console.log(
        `API Response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        let errorMessage = `Failed to fetch lead: ${response.status} ${response.statusText}`;
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
      console.log("Lead data received:", data);

      // Format the lead data
      const formattedLead = {
        id: data.lead.id,
        record_number: data.lead.record_number,
        firstName: data.lead.first_name || "",
        lastName: data.lead.last_name || "",
        fullName: data.lead.full_name || `${data.lead.last_name || ""}, ${data.lead.first_name || ""}`,
        status: data.lead.status || "New Lead",
        nickname: data.lead.nickname || "",
        title: data.lead.title || "",
        organizationId: data.lead.organization_id || "",
        organizationName: data.lead.organization_name_from_org || "",
        department: data.lead.department || "",
        reportsTo: data.lead.reports_to || "",
        owner: data.lead.owner || "",
        secondaryOwners: data.lead.secondary_owners || "",
        email: data.lead.email || "",
        email2: data.lead.email2 || "",
        phone: data.lead.phone || "",
        mobilePhone: data.lead.mobile_phone || "",
        directLine: data.lead.direct_line || "",
        linkedinUrl: data.lead.linkedin_url || "",
        address: data.lead.address || "",
        city: data.lead.city || "",
        state: data.lead.state || "",
        zip: data.lead.zip || "",
        fullAddress: formatAddress(data.lead),
        dateAdded: data.lead.created_at
          ? formatDate(data.lead.created_at)
          : "",
        lastContactDate: data.lead.last_contact_date
          ? formatDate(data.lead.last_contact_date)
          : "Never contacted",
        createdBy: data.lead.created_by_name || "Unknown",
        customFields: data.lead.custom_fields || {},
        archived_at: data.lead.archived_at || null,
      };

      console.log("Formatted lead:", formattedLead);
      setLead(formattedLead);

      // After loading lead data, fetch notes, history, documents, and tasks
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
      fetchTasks(id);
    } catch (err) {
      console.error("Error fetching lead:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching lead details"
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

  // Fetch notes for lead
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);
    setNoteError(null);

    try {
      const response = await fetch(`/api/leads/${id}/notes`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

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

  // Fetch history for lead
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/leads/${id}/history`, {
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

  // Fetch documents for lead
  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);

    try {
      const response = await fetch(`/api/leads/${id}/documents`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

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

  // Handle adding a new document
  const handleAddDocument = async () => {
    if (!newDocumentName.trim() || !leadId) return;

    try {
      const response = await fetch(`/api/leads/${leadId}/documents`, {
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
      await fetchDocuments(leadId);
      toast.success("Document added successfully");
    } catch (err) {
      console.error("Error adding document:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "An error occurred while adding a document"
      );
    }
  };

  // Handle deleting a document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(
        `/api/leads/${leadId}/documents/${documentId}`,
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

  const handleEditDocument = (doc: any) => {
    setEditingDocument(doc);
    setEditDocumentName(doc.document_name || "");
    setEditDocumentType(doc.document_type || "General");
    setShowEditDocumentModal(true);
  };

  const handleUpdateDocument = async () => {
    if (!editingDocument || !leadId || !editDocumentName.trim()) return;
    try {
      const token = getCookie("token");
      const response = await fetch(`/api/leads/${leadId}/documents/${editingDocument.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ document_name: editDocumentName, document_type: editDocumentType }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update document");
      }
      const data = await response.json();
      setDocuments((prev) => prev.map((d) => (d.id === editingDocument.id ? { ...d, ...data.document } : d)));
      setShowEditDocumentModal(false);
      setEditingDocument(null);
      setEditDocumentName("");
      setEditDocumentType("General");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update document");
    }
  };

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUploads(Array.from(files));
    }
    e.target.value = "";
  };

  const handleFileUploads = (files: File[]) => {
    if (!leadId) return;
    const validFiles = files.filter((file) => {
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
      const isValidSize = file.size <= 10 * 1024 * 1024;
      if (!isValidType) setUploadErrors((prev) => ({ ...prev, [file.name]: "Invalid file type. Allowed: PDF, DOC, DOCX, TXT, JPG, PNG, GIF" }));
      if (!isValidSize) setUploadErrors((prev) => ({ ...prev, [file.name]: "File size exceeds 10MB limit" }));
      return isValidType && isValidSize;
    });
    if (validFiles.length === 0) return;
    setPendingFiles(validFiles);
    // Strip file extension from name
    const fileNameWithoutExt = validFiles[0].name.replace(/\.[^/.]+$/, "");
    setFileDetailsName(fileNameWithoutExt);
    setFileDetailsType("General");
    setShowFileDetailsModal(true);
  };

  const handleConfirmFileDetails = async () => {
    if (pendingFiles.length === 0) return;
    const currentFile = pendingFiles[0];
    await uploadFile(currentFile, fileDetailsName.trim(), fileDetailsType);
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

  const uploadFile = async (file: File, documentName: string, documentType: string) => {
    if (!leadId) return;
    const fileName = file.name;
    setUploadProgress((prev) => ({ ...prev, [fileName]: 0 }));
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_name", documentName);
      formData.append("document_type", documentType);
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUploadProgress((prev) => ({ ...prev, [fileName]: (e.loaded / e.total) * 100 }));
      });
      xhr.addEventListener("load", () => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[fileName];
          return next;
        });
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.document) {
              fetchDocuments(leadId).then(() => toast.success("Document added successfully"));
            }
          } catch (_) { }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            setUploadErrors((prev) => ({ ...prev, [fileName]: data.message || "Upload failed" }));
          } catch (_) {
            setUploadErrors((prev) => ({ ...prev, [fileName]: "Upload failed" }));
          }
        }
      });
      xhr.addEventListener("error", () => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[fileName];
          return next;
        });
        setUploadErrors((prev) => ({ ...prev, [fileName]: "Network error" }));
      });
      const token = getCookie("token");
      xhr.open("POST", `/api/leads/${leadId}/documents/upload`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (err) {
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[fileName];
        return next;
      });
      setUploadErrors((prev) => ({ ...prev, [fileName]: "Upload failed" }));
    }
  };

  const handleGoBack = () => {
    router.push("/dashboard/leads");
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

  const handleActionSelected = (action: string) => {
    if (action === "edit" && leadId) {
      router.push(`/dashboard/leads/add?id=${leadId}`);
    } else if (action === "delete" && leadId) {
      checkPendingDeleteRequest();
      setShowDeleteModal(true);
    } else if (action === "add-note") {
      setShowAddNote(true);
      // setActiveTab("notes");
    } else if (action === "add-task") {
      // Navigate to add task page with lead context
      if (leadId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=lead&relatedEntityId=${leadId}`
        );
      }
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else if (action === "convert" && leadId) {
      // Convert lead -> create a job
      router.push(`/dashboard/jobs/add?leadId=${leadId}`);
    } else if (action === "email") {
      // Handle send email
      if (lead?.email) {
        window.location.href = `mailto:${lead.email}`;
      } else {
        toast.error("Lead email not available");
      }
    } else {
      console.log(`Action selected: ${action}`);
    }
  };

  // Fetch action fields on mount (Field500 / Admin Center → Field Management → Leads)
  useEffect(() => {
    const fetchActionFields = async () => {
      setIsLoadingActionFields(true);
      try {
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );

        const response = await fetch("/api/admin/field-management/leads", {
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
            data.leadFields ||
            data.data?.data?.fields ||
            [];

          const fieldNamesToCheck = ['field_500', 'actions', 'action'];

          const field500 = (fields as any[]).find((f: any) =>
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
            // Fallback default actions when Field500 is not configured
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
          // Non-OK response: use fallback defaults
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
  useEffect(() => {
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
          const internalUsers = (data.users || []).filter((user: any) => {
            return (
              user.user_type === "internal" ||
              user.role === "admin" ||
              user.role === "user" ||
              (!user.user_type && user.email)
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

    fetchUsers();
  }, []);

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
                lead.id?.toString().includes(searchTerm) ||
                String(lead.record_number ?? "").includes(searchTerm)
            )
          : (data.leads || []);
        leads.forEach((lead: any) => {
          suggestions.push({
            id: lead.id,
            type: "Lead",
            display: `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${lead.name || lead.company_name || "Unnamed"}`,
            value: formatRecordId(lead.record_number ?? lead.id, "lead"),
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
            display: `#${placement.id} ${placement.jobSeekerName || "Unnamed"} - ${placement.jobTitle || "Untitled"}`,
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

  // Filtered users for email notification dropdown
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
      if (
        emailInputRef.current &&
        !emailInputRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-email-dropdown]')
      ) {
        setShowEmailDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update noteForm when lead changes
  useEffect(() => {
    if (lead) {
      const defaultAboutRef = [
        {
          id: lead.id,
          type: "Lead",
          display: `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${lead.name || lead.company_name || "Unnamed"}`,
          value: formatRecordId(lead.record_number ?? lead.id, "lead"),
        },
      ];
      setNoteForm((prev) => ({
        ...prev,
        about: defaultAboutRef[0].display,
        aboutReferences: defaultAboutRef,
      }));
    }
  }, [lead]);

  // Function to delete a lead (kept for backward compatibility, but now shows modal)
  const deleteLead = async (id: string) => {
    checkPendingDeleteRequest();
    setShowDeleteModal(true);
  };

  // Check for pending delete request
  const checkPendingDeleteRequest = async () => {
    if (!leadId) return;

    setIsLoadingDeleteRequest(true);
    try {
      const response = await fetch(
        `/api/leads/${leadId}/delete-request?record_type=lead`,
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

    if (!leadId) {
      toast.error("Lead ID is missing");
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

      // Step 1: Add "Delete requested" note to lead
      const noteResponse = await fetch(`/api/leads/${leadId}/notes`, {
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
        `/api/leads/${leadId}/delete-request`,
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
            record_type: "lead",
            record_number: formatRecordId(lead?.record_number ?? lead?.id, "lead"),
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
      if (leadId) {
        fetchNotes(leadId);
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
    if (!unarchiveReason.trim() || !leadId) {
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
      const recordDisplay = lead
        ? `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${(lead.first_name || "").trim()} ${(lead.last_name || "").trim()}`.trim() || lead.organization_name || formatRecordId(lead.record_number ?? lead.id, "lead")
        : formatRecordId(leadId, "lead");
      const res = await fetch(`/api/leads/${leadId}/unarchive-request`, {
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

  // Check for pending delete request on mount
  useEffect(() => {
    if (leadId) {
      checkPendingDeleteRequest();
    }
  }, [leadId]);

  // Handle adding a new note with validation
  const handleAddNote = async () => {
    if (!leadId) return;

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

      const response = await fetch(`/api/leads/${leadId}/notes`, {
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
          about: JSON.stringify(aboutData),
          about_references: aboutData,
          copy_note: noteForm.copyNote === "Yes",
          replace_general_contact_comments: noteForm.replaceGeneralContactComments,
          schedule_next_action: noteForm.scheduleNextAction,
          email_notification: Array.isArray(noteForm.emailNotification) ? noteForm.emailNotification.join(",") : (noteForm.emailNotification ? [noteForm.emailNotification].join(",") : ""),
        }),
      });

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
      const defaultAboutRef = lead
        ? [
          {
            id: lead.id,
            type: "Lead",
            display: `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${lead.name || lead.company_name || "Unnamed"}`,
            value: formatRecordId(lead.record_number ?? lead.id, "lead"),
          },
        ]
        : [];

      setNoteForm({
        text: "",
        action: "",
        about: lead
          ? `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${lead.name || lead.company_name || ""}`
          : "",
        aboutReferences: defaultAboutRef,
        copyNote: "No",
        replaceGeneralContactComments: false,
        scheduleNextAction: "None",
        emailNotification: [],
      });
      setAboutSearchQuery("");
      setEmailSearchQuery("");
      setShowEmailDropdown(false);
      setValidationErrors({});
      setShowAddNote(false);

      // Refresh history to show the note addition
      if (leadId) {
        fetchNotes(leadId);
        fetchHistory(leadId);
      }
    } catch (err) {
      console.error("Error adding note:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "An error occurred while adding a note"
      );
    }
  };

  // Close Add Note modal handler
  const handleCloseAddNoteModal = () => {
    setShowAddNote(false);
  };

  const isArchived = !!lead?.archived_at;

  const actionOptions = isArchived
    ? [{ label: "Unarchive", action: () => setShowUnarchiveModal(true) }]
    : [
        { label: "Add Note", action: () => handleActionSelected("add-note") },
        { label: "Add Task", action: () => handleActionSelected("add-task") },
        { label: "Add Tearsheet", action: () => handleActionSelected("add-tearsheet") },
        { label: "Convert", action: () => handleActionSelected("convert") },
        { label: "Delete", action: () => handleActionSelected("delete") },
      ];

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "notes", label: "Notes" },
    { id: "history", label: "History" },
    { id: "quotes", label: "Quotes" },
    { id: "invoices", label: "Invoices" },
    { id: "contacts", label: "Contacts" },
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

  // Update the renderModifyTab function to forward to the add page instead of showing inline form
  const renderModifyTab = () => {
    if (isArchived) {
      return (
        <div className="bg-white p-4 rounded shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Modify Lead</h2>
          <p className="text-gray-600 mb-4">Archived records cannot be edited.</p>
        </div>
      );
    }
    // If we have a lead ID, redirect to the add page with that ID
    if (leadId) {
      router.push(`/dashboard/leads/add?id=${leadId}`);
      return null;
    }

    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-4">
          Loading lead editor...
        </h2>
      </div>
    );
  };

  // Render notes tab content
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
      }
    };

    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Lead Notes</h2>
          <button
            onClick={() => setShowAddNote(true)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Add Note
          </button>
        </div>

      {showAddNote && lead && (
        <AddNoteModal
          open={showAddNote}
          onClose={handleCloseAddNoteModal}
          entityType="lead"
          entityId={leadId ?? ""}
          entityDisplay={lead.name || `Lead #${leadId}`}
          onSuccess={() => { if (leadId) fetchNotes(leadId); }}
        />
      )}

      {/* Filters & Sort Controls (match Organization Notes) */}
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select
            value={noteActionFilter}
            onChange={(e) => setNoteActionFilter(e.target.value)}
            className="p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All Types</option>
            {Array.from(new Set(notes.map((n) => n.note_type || n.action).filter(Boolean))).map((t) => (
              <option key={t} value={t}>{t}</option>
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
            <option value="action">Type</option>
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
            const actionLabel = note.note_type || (note as any).action || "General Note";
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
                          Lead
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
      <h2 className="text-lg font-semibold mb-4">Lead History</h2>

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
                    actionDisplay = "Lead Created";
                    detailsDisplay = `Created by ${item.performed_by_name || "Unknown"
                      }`;
                    break;
                  case "UPDATE":
                    actionDisplay = "Lead Updated";
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
                        if (key.startsWith("_relationship_")) continue;

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
                                // Skip internal relationship ID fields (redundant with user-facing Job/Contact/Candidate)
                                if (cfKey.startsWith("_relationship_")) return;

                                const beforeCfVal = beforeObj[cfKey];
                                const afterCfVal = afterObj[cfKey];

                                if (JSON.stringify(beforeCfVal) !== JSON.stringify(afterCfVal)) {
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
    return <LoadingScreen message="Loading lead details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
        <div className="text-gray-700 mb-4">Lead not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with lead name and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            {/* <Image
              src="/file.svg"
              alt="Lead"
              width={24}
              height={24}
            /> */}
            <FiTarget size={20} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700 flex flex-wrap items-center gap-x-3 gap-y-1">
            L {lead.id} {lead.fullName}
            {lead.archived_at && (
              <div className="ml-3">
                <CountdownTimer archivedAt={lead.archived_at} />
              </div>
            )}
          </h1>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 p-3">
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
                return (
                  <div key={fk} className="min-w-[140px]">
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

          {/* RIGHT: existing actions */}
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
              disabled={!lead}
            >
              <BsFillPinAngleFill size={18} />
            </button>

            <button
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Reload"
              onClick={() => leadId && fetchLeadData(leadId)}
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
                setActiveTab(tab.id);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex bg-gray-300 p-2 space-x-2">
        {quickActions.map((action) => (
          <button
            key={action.id}
            className="bg-white px-4 py-1 rounded-full shadow"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        {/* Display content based on active tab */}
        {activeTab === "summary" && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handlePanelDragStart}
            onDragCancel={handlePanelDragCancel}
            onDragOver={handlePanelDragOver}
            onDragEnd={handlePanelDragEnd}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
          >
            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <div className="min-w-0 space-y-4">
                <DroppableContainer id="left" items={columns.left}>
                  {columns.left.map((id) => renderPanel(id))}
                </DroppableContainer>
              </div>
              <div className="min-w-0 space-y-4">
                <DroppableContainer id="right" items={columns.right}>
                  {columns.right.map((id) => renderPanel(id))}
                </DroppableContainer>
              </div>
            </div>
            <DragOverlay>
              {activeId ? renderPanel(activeId, true) : null}
            </DragOverlay>
          </DndContext>
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
            <p className="text-gray-500 italic">No quotes available</p>
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
            <h2 className="text-lg font-semibold mb-4">Lead Contacts</h2>
            <p className="text-gray-500 italic">No contacts available</p>
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
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
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
              alwaysShowSingleForm
            />

            {Object.keys(uploadErrors).length > 0 && (
              <div className="mb-4 space-y-2">
                {Object.entries(uploadErrors).map(([fileName, error]) => (
                  <div key={fileName} className="bg-red-50 border border-red-200 rounded p-2">
                    <p className="text-sm text-red-800"><strong>{fileName}:</strong> {error}</p>
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
                      <th className="text-left p-3 font-medium">Document Name</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Auto-Generated</th>
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
                              { label: "View", action: () => setSelectedDocument(doc) },
                              { label: "Edit", action: () => handleEditDocument(doc) },
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
                            {doc.document_name}
                          </button>
                        </td>
                        <td className="p-3">{doc.document_type}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${doc.is_auto_generated ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {doc.is_auto_generated ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="p-3">{doc.created_by_name || "System"}</td>
                        <td className="p-3">{new Date(doc.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic">No documents available</p>
            )}

            {/* Edit Document Modal */}
            {showEditDocumentModal && editingDocument && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
                        <option value="General">General</option>
                        <option value="Contract">Contract</option>
                        <option value="Agreement">Agreement</option>
                        <option value="Policy">Policy</option>
                        <option value="Welcome">Welcome</option>
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
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
          </div>
        )}

        {activeTab === "opportunities" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
            <p className="text-gray-500 italic">No opportunities available</p>
          </div>
        )}
      </div>

      <AddTearsheetModal
        open={showAddTearsheetModal}
        onClose={() => setShowAddTearsheetModal(false)}
        entityType="lead"
        entityId={leadId || ""}
      />

      {/* Header Fields Modal - uses universal SortableFieldsEditModal */}
      {showHeaderFieldModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowHeaderFieldModal(false)}
          title="Customize Header Fields"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records."
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
            setHeaderFields(LEAD_DEFAULT_HEADER_FIELDS);
            setHeaderFieldsOrder(LEAD_DEFAULT_HEADER_FIELDS);
          }}
          resetButtonText="Reset"
        />
      )}

      {/* Edit Fields Modal - Contact Info uses universal SortableFieldsEditModal */}
      {editingPanel === "contactInfo" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Lead Contact Info"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records."
          order={Array.from(new Set(modalContactInfoOrder))}
          visible={modalContactInfoVisible}
          fieldCatalog={contactInfoFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={(key) => setModalContactInfoVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
          onDragEnd={handleContactInfoDragEnd}
          onSave={handleSaveContactInfoFields}
          saveButtonText="Save"
          isSaveDisabled={modalContactInfoOrder.filter((k) => modalContactInfoVisible[k]).length === 0}
        />
      )}
      {editingPanel && editingPanel !== "contactInfo" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Edit Fields - {editingPanel === "details" ? "Lead Details" : editingPanel === "websiteJobs" ? "Website Jobs" : editingPanel === "ourJobs" ? "Our Jobs" : editingPanel}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              {editingPanel === "details" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setDetailsDragActiveId(e.active.id as string)}
                    onDragEnd={handleDetailsDragEnd}
                    onDragCancel={() => setDetailsDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalDetailsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {Array.from(new Set(modalDetailsOrder)).map((key, index) => {
                          const entry = detailsFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableDetailsFieldRow
                              key={`details-${entry.key}-${index}`}
                              id={entry.key}
                              label={entry.label}
                              checked={!!modalDetailsVisible[entry.key]}
                              onToggle={() =>
                                setModalDetailsVisible((prev) => ({
                                  ...prev,
                                  [entry.key]: !prev[entry.key],
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={dropAnimationConfig}>
                      {detailsDragActiveId ? (() => {
                        const entry = detailsFieldCatalog.find((f) => f.key === detailsDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableDetailsFieldRow
                            id={entry.key}
                            label={entry.label}
                            checked={!!modalDetailsVisible[entry.key]}
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
                      onClick={handleSaveDetailsFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : editingPanel === "websiteJobs" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setWebsiteJobsDragActiveId(e.active.id as string)}
                    onDragEnd={handleWebsiteJobsDragEnd}
                    onDragCancel={() => setWebsiteJobsDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalWebsiteJobsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {modalWebsiteJobsOrder.map((key, index) => {
                          const entry = websiteJobsFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableDetailsFieldRow
                              key={`websiteJobs-${entry.key}-${index}`}
                              id={entry.key}
                              label={entry.label}
                              checked={!!modalWebsiteJobsVisible[entry.key]}
                              onToggle={() =>
                                setModalWebsiteJobsVisible((prev) => ({
                                  ...prev,
                                  [entry.key]: !prev[entry.key],
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={dropAnimationConfig}>
                      {websiteJobsDragActiveId ? (() => {
                        const entry = websiteJobsFieldCatalog.find((f) => f.key === websiteJobsDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableDetailsFieldRow
                            id={entry.key}
                            label={entry.label}
                            checked={!!modalWebsiteJobsVisible[entry.key]}
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
                      onClick={handleSaveWebsiteJobsFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : editingPanel === "ourJobs" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setOurJobsDragActiveId(e.active.id as string)}
                    onDragEnd={handleOurJobsDragEnd}
                    onDragCancel={() => setOurJobsDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalOurJobsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {modalOurJobsOrder.map((key, index) => {
                          const entry = ourJobsFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableDetailsFieldRow
                              key={`ourJobs-${entry.key}-${index}`}
                              id={entry.key}
                              label={entry.label}
                              checked={!!modalOurJobsVisible[entry.key]}
                              onToggle={() =>
                                setModalOurJobsVisible((prev) => ({
                                  ...prev,
                                  [entry.key]: !prev[entry.key],
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={dropAnimationConfig}>
                      {ourJobsDragActiveId ? (() => {
                        const entry = ourJobsFieldCatalog.find((f) => f.key === ourJobsDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableDetailsFieldRow
                            id={entry.key}
                            label={entry.label}
                            checked={!!modalOurJobsVisible[entry.key]}
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
                      onClick={handleSaveOurJobsFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
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
                          contactInfo: [
                            { key: "fullName", label: "Name" },
                            { key: "nickname", label: "Nickname" },
                            { key: "title", label: "Title" },
                            { key: "organizationName", label: "Organization" },
                            { key: "department", label: "Department" },
                            { key: "phone", label: "Phone" },
                            { key: "mobilePhone", label: "Mobile" },
                            { key: "email", label: "Email" },
                            { key: "email2", label: "Email 2" },
                            { key: "fullAddress", label: "Address" },
                            { key: "linkedinUrl", label: "LinkedIn" },
                          ],
                          details: [
                            { key: "status", label: "Status" },
                            { key: "owner", label: "Owner" },
                            { key: "reportsTo", label: "Reports To" },
                            { key: "dateAdded", label: "Date Added" },
                            { key: "lastContactDate", label: "Last Contact" },
                          ],
                          recentNotes: [{ key: "notes", label: "Notes" }],
                          websiteJobs: [{ key: "jobs", label: "Jobs" }],
                          ourJobs: [{ key: "jobs", label: "Jobs" }],
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
              )}
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
        entityLabel="Lead"
        recordDisplay={
          lead
            ? `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${(lead.first_name || "").trim()} ${(lead.last_name || "").trim()}`.trim() || lead.organization_name || "N/A"
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
              {/* Lead Info */}
              <div className="bg-gray-50 p-4 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead to Delete
                </label>
                <p className="text-sm text-gray-900 font-medium">
                  {lead
                    ? `${formatRecordId(lead.record_number ?? lead.id, "lead")} ${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.organization_name || "N/A"
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
                  placeholder="Please provide a detailed reason for deleting this lead..."
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
