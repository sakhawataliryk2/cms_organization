"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import PanelWithHeader from "@/components/PanelWithHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { FiBriefcase, FiLock, FiUnlock, FiSearch } from "react-icons/fi";
import { HiOutlineOfficeBuilding, HiOutlineUser } from "react-icons/hi";
import { formatRecordId } from "@/lib/recordIdFormatter";
import { BsFillPinAngleFill } from "react-icons/bs";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import CountdownTimer from "@/components/CountdownTimer";
import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";
import ConfirmFileDetailsModal from "@/components/ConfirmFileDetailsModal";
import RequestActionModal from "@/components/RequestActionModal";
import DocumentViewer from "@/components/DocumentViewer";
import HistoryTabFilters, { useHistoryFilters } from "@/components/HistoryTabFilters";
import { toast } from "sonner";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";

import {
  DndContext,
  closestCenter,
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
import { FiArrowUp, FiArrowDown, FiFilter } from "react-icons/fi";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import AddNoteModal from "@/components/AddNoteModal";

// Default header fields for Placements module - defined outside component to ensure stable reference
const PLACEMENT_DEFAULT_HEADER_FIELDS = ["status", "owner"];

// Storage keys for Placement Details and Details panels – field lists come from admin (custom field definitions)
const PLACEMENT_DETAILS_STORAGE_KEY = "placementDetailsFields";
const DETAILS_STORAGE_KEY = "placementDetailsPanelFields";

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

// Sortable Column Header for Documents table
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
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={16} />
        </button>
        <span className="flex-1">{label}</span>
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
        <button
          ref={filterToggleRef}
          data-filter-toggle={id}
          onClick={(e) => {
            e.stopPropagation();
            setShowFilter(!showFilter);
          }}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${filterValue ? "text-blue-600" : ""}`}
          title="Filter column"
        >
          <FiFilter size={14} />
        </button>
      </div>
      {showFilter && filterPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={filterRef}
          className="bg-white border border-gray-300 shadow-lg rounded p-2 z-100 min-w-[150px]"
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
              className="mt-2 w-full px-2 py-1 text-xs text-red-600 rounded"
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
    zIndex: isOverlay ? 1000 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isOverlay ? "cursor-grabbing" : ""}`}
    >
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
      <div className={`${isDragging && !isOverlay ? "invisible" : ""} pt-0`}>
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

const PLACEMENT_VIEW_TAB_IDS = ["summary", "modify", "notes", "docs", "history"];

export default function PlacementView() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const placementId = searchParams.get("id") || "";
  const tabFromUrl = searchParams.get("tab");

  const [placement, setPlacement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // Notes and history state
  const [notes, setNotes] = useState<
    Array<{
      id: string;
      text: string;
      action?: string;
      about_references?: unknown;
      aboutReferences?: unknown;
      created_at: string;
      created_by_name: string;
    }>
  >([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyFilters = useHistoryFilters(history);
  const [showAddNote, setShowAddNote] = useState(false);
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
  const [noteForm, setNoteForm] = useState({
    text: "",
    action: "",
    about: "",
    aboutReferences: [] as { id: number | string; type: string; display: string; value: string }[],
    emailNotification: [] as string[],
  });
  const [validationErrors, setValidationErrors] = useState<{ action?: string; about?: string; text?: string }>({});
  const [aboutSearchQuery, setAboutSearchQuery] = useState("");
  const [aboutSuggestions, setAboutSuggestions] = useState<any[]>([]);
  const [showAboutDropdown, setShowAboutDropdown] = useState(false);
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);
  const [isLoadingAboutSearch, setIsLoadingAboutSearch] = useState(false);
  const aboutInputRef = useRef<HTMLDivElement>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);

  // Delete request state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    reason: "", // Mandatory reason for deletion
  });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<any>(null);
  const [isLoadingDeleteRequest, setIsLoadingDeleteRequest] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [unarchiveReason, setUnarchiveReason] = useState("");
  const [isSubmittingUnarchive, setIsSubmittingUnarchive] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

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
  const [editingDocument, setEditingDocument] = useState<any | null>(null);
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [editDocumentName, setEditDocumentName] = useState("");
  const [editDocumentType, setEditDocumentType] = useState("General");

  const DOCUMENT_DEFAULT_COLUMNS = ["document_name", "document_type", "created_by_name", "created_at"];
  const [documentColumnFields, setDocumentColumnFields] = useState<string[]>(DOCUMENT_DEFAULT_COLUMNS);
  const [documentColumnSorts, setDocumentColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [documentColumnFilters, setDocumentColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  const [tasks, setTasks] = useState<Array<any>>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["placementDetails"],
    right: ["details", "recentNotes", "openTasks"],
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

  // Drop animation config for panel drag-and-drop
  const panelDropAnimationConfig = useMemo(() => ({
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  }), []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("placementSummaryColumns");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (
            parsed.left &&
            Array.isArray(parsed.left) &&
            parsed.right &&
            Array.isArray(parsed.right)
          ) {
            setColumns(parsed);
          }
        } catch (e) {
          console.error("Error loading panel order:", e);
        }
      }
    }
  }, []);

  // Initialize Placement Details field order/visibility from localStorage (persists across all records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(PLACEMENT_DETAILS_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const unique = Array.from(new Set(parsed));
        setVisibleFields((prev) => ({ ...prev, placementDetails: unique }));
      }
    } catch (_) {
      /* keep default */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(DETAILS_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setVisibleFields((prev) => ({ ...prev, details: parsed }));
      }
    } catch (_) { }
  }, []);

  const prevColumnsRef = useRef<string>("");

  useEffect(() => {
    const colsString = JSON.stringify(columns);
    if (prevColumnsRef.current !== colsString) {
      localStorage.setItem("placementSummaryColumns", colsString);
      prevColumnsRef.current = colsString;
    }
  }, [columns]);

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

        const activeFiltered = prev[activeContainer].filter(
          (item) => item !== active.id
        );
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
      const activeId = active.id as string;
      const overId = over?.id as string;

      const activeContainer = findContainer(activeId);
      const overContainer = findContainer(overId);

      if (!activeContainer || !overContainer || activeContainer !== overContainer) {
        setActiveId(null);
        return;
      }

      const activeIndex = columns[activeContainer].indexOf(activeId);
      const overIndex = columns[overContainer].indexOf(overId);

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

  // const togglePin = () => {
  //   setIsPinned((p) => !p);
  //   if (isPinned === false) setIsCollapsed(false);
  // };

  const handleTogglePinnedRecord = () => {
    if (!placement) return;
    const key = buildPinnedKey("placement", placement.id);
    const label = String(placement.jobSeekerName || placement.jobTitle || placement.id);
    let url = `/dashboard/placements/view?id=${placement.id}`;
    if (activeTab && activeTab !== "summary") url += `&tab=${activeTab}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      toast.info("Maximum 10 pinned records reached");
    }
  };

  useEffect(() => {
    const syncPinned = () => {
      if (!placement) return;
      const key = buildPinnedKey("placement", placement.id);
      setIsRecordPinned(isPinnedRecord(key));
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [placement]);

  // Current active tab (sync with ?tab= URL param for shareable links)
  const [activeTab, setActiveTabState] = useState(() =>
    tabFromUrl && PLACEMENT_VIEW_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "summary"
  );

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "summary") params.delete("tab");
    else params.set("tab", tabId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (tabFromUrl && PLACEMENT_VIEW_TAB_IDS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    } else if (!tabFromUrl && activeTab !== "summary") {
      setActiveTabState("summary");
    }
  }, [tabFromUrl]);

  // Field management – panels driven from admin field definitions only
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") {
      return { placementDetails: [], details: [], recentNotes: ["notes"] };
    }
    let placementDetails: string[] = [];
    let details: string[] = [];
    try {
      const pd = localStorage.getItem(PLACEMENT_DETAILS_STORAGE_KEY);
      if (pd) {
        const parsed = JSON.parse(pd);
        if (Array.isArray(parsed) && parsed.length > 0) placementDetails = Array.from(new Set(parsed));
      }
    } catch (_) { }
    try {
      const d = localStorage.getItem(DETAILS_STORAGE_KEY);
      if (d) {
        const parsed = JSON.parse(d);
        if (Array.isArray(parsed) && parsed.length > 0) details = Array.from(new Set(parsed));
      }
    } catch (_) { }
    return { placementDetails, details, recentNotes: ["notes"] };
  });
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Modal-local state for Placement Details edit
  const [modalPlacementDetailsOrder, setModalPlacementDetailsOrder] = useState<string[]>([]);
  const [modalPlacementDetailsVisible, setModalPlacementDetailsVisible] = useState<Record<string, boolean>>({});

  const [modalDetailsOrder, setModalDetailsOrder] = useState<string[]>([]);
  const [modalDetailsVisible, setModalDetailsVisible] = useState<Record<string, boolean>>({});

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
    entityType: "PLACEMENT",
    configType: "header",
    defaultFields: PLACEMENT_DEFAULT_HEADER_FIELDS,
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

  const getHeaderFieldInfo = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found as { key: string; label: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
  };

  const getHeaderFieldLabel = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found?.label || key;
  };

  const getHeaderFieldValue = (key: string) => {
    if (!placement) return "-";
    const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;
    const p = placement as any;
    let v = p[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    v = placement.customFields?.[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    const field = headerFieldCatalog.find((f) => f.key === key);
    if (field) v = placement.customFields?.[field.label];
    return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
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

  // Fetch placement data when component mounts
  useEffect(() => {
    if (placementId) {
      fetchPlacementData(placementId);
    }
  }, [placementId]);

  // Fetch available fields after placement is loaded
  useEffect(() => {
    if (placement && placementId) {
      fetchAvailableFields();
    }
  }, [placement, placementId]);

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const getPlacementEntityType = (pl: any) => {
        const t = String(pl?.placementType || pl?.placement_type || '').toLowerCase();
        if (t.includes('direct')) return 'placements-direct-hire';
        if (t.includes('executive')) return 'placements-executive-search';
        return 'placements';
      };
      const entityType = getPlacementEntityType(placement);
      const response = await fetch(`/api/admin/field-management/${entityType}`);
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

  // Placement Details field catalog: from admin field definitions + record customFields only (no hardcoded standard)
  const placementDetailsFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    return [...fromApi];
  }, [availableFields]);

  // Details panel field catalog: from admin field definitions + record customFields only
  const detailsFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    return [...fromApi];
  }, [availableFields]);

  // When catalog loads, if placementDetails/details visible list is empty, default to all catalog keys
  useEffect(() => {
    const keys = placementDetailsFieldCatalog.map((f) => f.key);
    if (keys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.placementDetails || [];
        if (current.length > 0) return prev;
        return { ...prev, placementDetails: keys };
      });
    }
  }, [placementDetailsFieldCatalog]);

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

  // Sync Placement Details modal state when opening edit for placementDetails
  useEffect(() => {
    if (editingPanel !== "placementDetails") return;
    const current = visibleFields.placementDetails || [];
    const catalogKeys = placementDetailsFieldCatalog.map((f) => f.key);
    const uniqueCatalogKeys = Array.from(new Set(catalogKeys));
    const order = [...current.filter((k) => uniqueCatalogKeys.includes(k))];
    uniqueCatalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    const uniqueOrder = Array.from(new Set(order));
    setModalPlacementDetailsOrder(uniqueOrder);
    setModalPlacementDetailsVisible(
      uniqueCatalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.placementDetails, placementDetailsFieldCatalog]);

  useEffect(() => {
    if (editingPanel !== "details") return;
    const current = visibleFields.details || [];
    const catalogKeys = detailsFieldCatalog.map((f) => f.key);
    const order = [...current.filter((k) => catalogKeys.includes(k))];
    catalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    setModalDetailsOrder(order);
    setModalDetailsVisible(
      catalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.details, detailsFieldCatalog]);

  // Placement Details modal: drag end (reorder)
  // Placement Details modal: save order/visibility and persist for all records
  const handleSavePlacementDetailsFields = useCallback(() => {
    const newOrder = Array.from(new Set(modalPlacementDetailsOrder.filter((k) => modalPlacementDetailsVisible[k])));
    if (typeof window !== "undefined") {
      localStorage.setItem(PLACEMENT_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, placementDetails: newOrder }));
    setEditingPanel(null);
  }, [modalPlacementDetailsOrder, modalPlacementDetailsVisible]);

  const handleSaveDetailsFields = useCallback(() => {
    const newOrder = modalDetailsOrder.filter((k) => modalDetailsVisible[k]);
    if (typeof window !== "undefined") {
      localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, details: newOrder }));
    setEditingPanel(null);
  }, [modalDetailsOrder, modalDetailsVisible]);

  // Handle edit panel click
  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Handle modify button click - redirect to add page in edit mode (same as Organizations/Jobs)
  const handleModifyClick = () => {
    if (placementId) {
      router.push(`/dashboard/placements/add?id=${placementId}`);
    }
  };

  const fetchTasksForPlacement = async (jobId: string | number | undefined, organizationId: string | number | undefined) => {
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
      const placementTasks = (tasksData.tasks || []).filter((task: any) => {
        if (task.is_completed === true || task.status === "Completed") return false;
        const tJob = task.job_id != null ? String(task.job_id) : null;
        const tOrg = task.organization_id != null ? String(task.organization_id) : null;
        const matchJob = jobId != null && tJob && tJob === String(jobId);
        const matchOrg = organizationId != null && tOrg && tOrg === String(organizationId);
        return matchJob || matchOrg;
      });
      setTasks(placementTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasksError(err instanceof Error ? err.message : "An error occurred while fetching tasks");
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Function to fetch placement data
  const fetchPlacementData = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching placement data for ID: ${id}`);
      const response = await fetch(`/api/placements/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        let errorMessage = `Failed to fetch placement: ${response.status} ${response.statusText}`;
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
      console.log("Placement data received:", data);

      // Format the placement data
      let customFieldsObj = {};
      if (data.placement) {
        try {
          if (typeof data.placement.custom_fields === 'string') {
            customFieldsObj = JSON.parse(data.placement.custom_fields);
          } else if (typeof data.placement.custom_fields === 'object') {
            customFieldsObj = data.placement.custom_fields;
          }
        } catch (e) {
          console.error('Error parsing custom fields:', e);
        }
      }

      // Format dates as YYYY-MM-DD for input type="date" compatibility
      const toDateInput = (val: string | null | undefined) => {
        if (!val) return '';
        const d = new Date(val);
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
      };
      const formattedPlacement = {
        id: data.placement.id,
        record_number: data.placement.record_number,
        jobSeekerId: data.placement.jobSeekerId || data.placement.job_seeker_id || '',
        jobSeekerName: data.placement.jobSeekerName || data.placement.job_seeker_name || 'Unknown Job Seeker',
        jobId: data.placement.jobId || data.placement.job_id || '',
        jobTitle: data.placement.jobTitle || data.placement.job_title || data.placement.job_name || 'Unknown Job',
        organizationId: data.placement.organizationId ?? data.placement.organization_id ?? '',
        organizationName: data.placement.organizationName || data.placement.organization_name || '',
        status: data.placement.status || 'Active',
        startDate: toDateInput(data.placement.startDate || data.placement.start_date) || '',
        endDate: toDateInput(data.placement.endDate || data.placement.end_date) || '',
        salary: data.placement.salary ?? '',
        owner: data.placement.owner || data.placement.owner_name || '',
        dateAdded: data.placement.createdAt ? new Date(data.placement.createdAt).toLocaleDateString() : (data.placement.created_at ? new Date(data.placement.created_at).toLocaleDateString() : ''),
        lastContactDate: data.placement.last_contact_date ? new Date(data.placement.last_contact_date).toLocaleDateString() : 'Never contacted',
        createdBy: data.placement.createdByName || data.placement.created_by_name || 'Unknown',
        placement_type: data.placement.placement_type || 'Contract',
        placementType: data.placement.placement_type || 'Contract',
        customFields: customFieldsObj,  
        archived_at: data.placement.archivedAt || "",
      };

      console.log("Formatted placement:", formattedPlacement);
      setPlacement(formattedPlacement);

      // After loading placement data, fetch notes, history, documents, and tasks
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
      fetchTasksForPlacement(
        formattedPlacement.jobId,
        formattedPlacement.organizationId
      );
    } catch (err) {
      console.error("Error fetching placement:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching placement details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch notes for placement
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);
    setNoteError(null);

    try {
      const response = await fetch(`/api/placements/${id}/notes`);

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

  // Fetch history for placement
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/placements/${id}/history`);

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

  // Reset note form aboutReferences when placement loads
  useEffect(() => {
    if (placement && placementId) {
      const defaultRef = {
        id: placement.id,
        type: "Placement",
        display: `${formatRecordId(placement.record_number ?? placement.id, "placement")} ${placement.jobSeekerName || ""} - ${placement.jobTitle || ""}`.trim() || `Placement ${formatRecordId(placement.record_number ?? placement.id, "placement")}`,
        value: `#${placement.id}`,
      };
      setNoteForm((prev) => ({
        ...prev,
        about: defaultRef.display,
        aboutReferences: [defaultRef],
      }));
    }
  }, [placement?.id, placementId]);

  // Fetch action fields for notes (placements field-management or default)
  useEffect(() => {
    const fetchActionFieldsForNotes = async () => {
      setIsLoadingActionFields(true);
      try {
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );
        const getPlacementEntityType = (pl: any) => {
          const t = String(pl?.placementType || pl?.placement_type || '').toLowerCase();
          if (t.includes('direct')) return 'placements-direct-hire';
          if (t.includes('executive')) return 'placements-executive-search';
          return 'placements';
        };
        const entityType = getPlacementEntityType(placement);
        const response = await fetch(`/api/admin/field-management/${entityType}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const raw = await response.text();
          let data: any = {};
          try {
            data = JSON.parse(raw);
          } catch { }
          const fields = data.customFields || data.fields || data.data?.fields || [];
          const fieldNamesToCheck = ["field_500", "actions", "action"];
          const field500 = (fields as any[]).find(
            (f: any) =>
              fieldNamesToCheck.includes(f.field_name?.toLowerCase()) ||
              fieldNamesToCheck.includes(f.field_label?.toLowerCase())
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
            } else if (typeof options === "object") {
              setActionFields(
                Object.entries(options).map(([key, value]) => ({
                  id: key,
                  field_label: String(value),
                  field_name: key,
                }))
              );
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
          { id: "Email", field_label: "Email", field_name: "Email" },
        ]);
      } finally {
        setIsLoadingActionFields(false);
      }
    };
    fetchActionFieldsForNotes();
  }, [placement?.placementType, placement?.placement_type]);

  // Search for references for About field (same as organization)
  const searchAboutReferences = async (query: string) => {
    setIsLoadingAboutSearch(true);
    setShowAboutDropdown(true);
    try {
      const searchTerm = (query || "").trim();
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const headers = { Authorization: `Bearer ${token}` };
      const [jobsRes, orgsRes, jobSeekersRes, leadsRes, tasksRes, placementsRes, hiringManagersRes] =
        await Promise.allSettled([
          fetch("/api/jobs", { headers }),
          fetch("/api/organizations", { headers }),
          fetch("/api/job-seekers", { headers }),
          fetch("/api/leads", { headers }),
          fetch("/api/tasks", { headers }),
          fetch("/api/placements", { headers }),
          fetch("/api/hiring-managers", { headers }),
        ]);
      const suggestions: any[] = [];
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
            display: `${formatRecordId(lead.id, "lead")} ${lead.name || lead.company_name || "Unnamed"}`,
            value: formatRecordId(lead.id, "lead"),
          });
        });
      }
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
      if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
        const data = await placementsRes.value.json();
        const placements = searchTerm
          ? (data.placements || []).filter(
              (p: any) =>
                p.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.jobSeekerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.id?.toString().includes(searchTerm)
            )
          : (data.placements || []);
        placements.forEach((p: any) => {
          suggestions.push({
            id: p.id,
            type: "Placement",
            display: `#${p.id} ${p.jobSeekerName || "Unnamed"} - ${p.jobTitle || "Untitled"}`,
            value: `#${p.id}`,
          });
        });
      }
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
      const selectedIds = noteForm.aboutReferences.map((ref) => ref.id);
      const filtered = suggestions.filter((s) => !selectedIds.includes(s.id));
      setAboutSuggestions(filtered.slice(0, 10));
    } catch (err) {
      console.error("Error searching about references:", err);
      setAboutSuggestions([]);
    } finally {
      setIsLoadingAboutSearch(false);
    }
  };

  const handleAboutReferenceSelect = (reference: any) => {
    setNoteForm((prev) => {
      const newReferences = [...prev.aboutReferences, reference];
      return {
        ...prev,
        aboutReferences: newReferences,
        about: newReferences.map((r) => r.display).join(", "),
      };
    });
    setAboutSearchQuery("");
    setShowAboutDropdown(false);
    setAboutSuggestions([]);
  };

  const removeAboutReference = (index: number) => {
    setNoteForm((prev) => {
      const newReferences = prev.aboutReferences.filter((_, i) => i !== index);
      return {
        ...prev,
        aboutReferences: newReferences,
        about: newReferences.length > 0 ? newReferences.map((r) => r.display).join(", ") : "",
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

  const navigateToReference = (ref: any) => {
    if (!ref || !ref.id) return;
    const refType = (ref.type || "").toLowerCase().replace(/\s+/g, "");
    const refId = ref.id;
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
    if (route) router.push(route);
  };

  const handleCloseAddNoteModal = () => {
    setShowAddNote(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        aboutInputRef.current &&
        !aboutInputRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest("[data-about-dropdown]")
      ) {
        setShowAboutDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        const internalUsers = (data.users || []).filter((user: any) =>
          user.user_type === "internal" ||
          user.role === "admin" ||
          user.role === "user" ||
          (!user.user_type && user.email)
        );
        setUsers(internalUsers);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (showAddNote) fetchUsers();
  }, [showAddNote]);

  // Close About and Email dropdowns when clicking outside
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

  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);
    try {
      const response = await fetch(`/api/placements/${id}/documents`, {
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setPendingFiles(fileArray);
      if (fileArray.length === 1) {
        setFileDetailsName(fileArray[0].name.replace(/\.[^/.]+$/, ""));
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }

    event.target.value = "";
  };

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
      if (fileArray.length === 1) {
        setFileDetailsName(fileArray[0].name.replace(/\.[^/.]+$/, ""));
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }
  };

  const handleConfirmFileDetails = async () => {
    if (pendingFiles.length === 0 || !placementId) return;

    setShowFileDetailsModal(false);
    const filesToUpload = [...pendingFiles];
    setPendingFiles([]);

    setUploadErrors({});
    const newUploadProgress = { ...uploadProgress };

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

        const response = await fetch(
          `/api/placements/${placementId}/documents/upload`,
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
          await fetchDocuments(placementId);
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
      }
    }
  };

  const handleAddDocument = async () => {
    if (!placementId || !newDocumentName.trim()) return;

    try {
      const response = await fetch(`/api/placements/${placementId}/documents`, {
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
        await fetchDocuments(placementId);
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

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    if (!placementId) return;

    try {
      const response = await fetch(
        `/api/placements/${placementId}/documents/${documentId}`,
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

      if (response.ok) {
        fetchDocuments(placementId);
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete document");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      toast.error("An error occurred while deleting the document");
    }
  };

  const handleUpdateDocument = async () => {
    if (!editingDocument?.id || !placementId || !editDocumentName.trim()) return;

    try {
      const response = await fetch(
        `/api/placements/${placementId}/documents/${editingDocument.id}`,
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

  const handleEditDocument = (doc: any) => {
    setEditingDocument(doc);
    setEditDocumentName(doc?.document_name || "");
    setEditDocumentType(doc?.document_type || "General");
    setShowEditDocumentModal(true);
  };

  const documentColumnsCatalog = useMemo(
    () => [
      { key: "document_name", label: "Document Name", sortable: true, filterType: "text" as const },
      { key: "document_type", label: "Type", sortable: true, filterType: "select" as const },
      { key: "created_by_name", label: "Created By", sortable: true, filterType: "text" as const },
      { key: "created_at", label: "Created At", sortable: true, filterType: "text" as const },
    ],
    []
  );

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
      case "created_by_name":
        return doc.created_by_name || "System";
      case "created_at":
        return doc.created_at ? new Date(doc.created_at).toLocaleString() : "N/A";
      default:
        return "—";
    }
  };

  const documentTypeOptions = useMemo(() => {
    const types = new Set<string>();
    documents.forEach((doc) => {
      if (doc.document_type) types.add(doc.document_type);
    });
    return Array.from(types).map((t) => ({ label: t, value: t }));
  }, [documents]);

  const filteredAndSortedDocuments = useMemo(() => {
    let result = [...documents];

    Object.entries(documentColumnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;
      result = result.filter((doc) => {
        const value = getDocumentColumnValue(doc, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();
        const columnInfo = getDocumentColumnInfo(columnKey);
        if (columnInfo?.filterType === "select") return valueStr === filterStr;
        return valueStr.includes(filterStr);
      });
    });

    const activeSorts = Object.entries(documentColumnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
      const [sortKey, sortDir] = activeSorts[0];
      result.sort((a, b) => {
        let aValue: any = getDocumentColumnValue(a, sortKey);
        let bValue: any = getDocumentColumnValue(b, sortKey);
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

  const handleDocumentColumnSort = (columnKey: string) => {
    setDocumentColumnSorts((prev) => {
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

  const handleDocumentColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = documentColumnFields.indexOf(active.id as string);
    const newIndex = documentColumnFields.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      setDocumentColumnFields(arrayMove(documentColumnFields, oldIndex, newIndex));
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

  const handleGoBack = () => {
    router.push("/dashboard/placements");
  };

  // Print handler: ensure Summary tab is active when printing (same behavior as Jobs view)
  const handlePrint = () => {
    const printContent = document.getElementById("printable-summary");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tabTitle = activeTab?.toUpperCase() || "Placement SUMMARY";

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

  const handleEmailJobSeeker = async () => {
    const jobSeekerId = placement?.jobSeekerId;
    if (!jobSeekerId) {
      toast.error("Job Seeker not available for this placement.");
      return;
    }

    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch(`/api/job-seekers/${jobSeekerId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // Handle non-JSON responses
      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch job seeker details");
      }

      const email: string | undefined =
        data?.jobSeeker?.email ||
        data?.job_seeker?.email ||
        data?.jobseeker?.email;

      if (!email || email === "No email provided") {
        toast.error("Job seeker email not available");
        return;
      }

      // Use mailto link to open default email application (e.g., Outlook Desktop) in popup style
      window.location.href = `mailto:${email}`;
    } catch (err) {
      console.error("Error opening email compose:", err);
      toast.error(err instanceof Error ? err.message : "Failed to open email compose");
    }
  };

  const handleEmailBillingContacts = async () => {
    const jobId = placement?.jobId;
    if (!jobId) {
      toast.error("Job not available for this placement.");
      return;
    }

    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch(`/api/jobs/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // Handle non-JSON responses
      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch job details");
      }

      const job = data?.job || data?.job_data || data;
      if (!job) {
        toast.error("Billing contact email(s) not available");
        return;
      }

      // Extract billing contact emails from multiple possible sources (priority-based)
      const emailSet = new Set<string>();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

      // Helper function to recursively extract emails from any value
      const extractEmailsFromValue = (value: any): void => {
        if (value === null || value === undefined) return;

        if (typeof value === "string") {
          // Check if the string itself is a valid email
          const trimmed = value.trim();
          if (emailRegex.test(trimmed)) {
            emailSet.add(trimmed.toLowerCase());
          }
          // Also check for emails within the string (space/comma/semicolon separated)
          const emailMatches = trimmed.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/gi);
          if (emailMatches) {
            emailMatches.forEach((match) => {
              const trimmedMatch = match.trim();
              if (emailRegex.test(trimmedMatch)) {
                emailSet.add(trimmedMatch.toLowerCase());
              }
            });
          }
          return;
        }

        if (Array.isArray(value)) {
          value.forEach((item) => extractEmailsFromValue(item));
          return;
        }

        if (typeof value === "object") {
          // Check common email properties first
          if (value.email && typeof value.email === "string") {
            extractEmailsFromValue(value.email);
          }
          if (value.email_address && typeof value.email_address === "string") {
            extractEmailsFromValue(value.email_address);
          }
          // Recursively scan all values
          Object.values(value).forEach((val) => extractEmailsFromValue(val));
        }
      };

      // Priority 1: Preferred structured fields
      // job.billing_contact_email
      if (job.billing_contact_email) {
        extractEmailsFromValue(job.billing_contact_email);
      }

      // job.billing_contacts (snake_case)
      if (job.billing_contacts) {
        extractEmailsFromValue(job.billing_contacts);
      }

      // job.billingContacts (camelCase)
      if (job.billingContacts) {
        extractEmailsFromValue(job.billingContacts);
      }

      // Priority 2: contacts array where type === "billing" (case-insensitive)
      if (Array.isArray(job.contacts)) {
        job.contacts.forEach((contact: any) => {
          const contactType = (contact?.type || contact?.contact_type || "").toLowerCase();
          if (contactType === "billing") {
            const email = contact?.email || contact?.email_address;
            if (email && emailRegex.test(email.trim())) {
              emailSet.add(email.trim().toLowerCase());
            }
          }
        });
      }

      // Priority 3: Fallback - scan custom_fields for ALL valid emails
      if (emailSet.size === 0) {
        const customFields = job.custom_fields || job.customFields;
        if (customFields) {
          // Parse if string
          let parsedCustomFields: any = customFields;
          if (typeof customFields === "string") {
            try {
              parsedCustomFields = JSON.parse(customFields);
            } catch {
              // If parsing fails, treat as plain string and extract emails
              extractEmailsFromValue(customFields);
              parsedCustomFields = null;
            }
          }

          // Scan all values in custom_fields recursively
          if (parsedCustomFields && typeof parsedCustomFields === "object") {
            extractEmailsFromValue(parsedCustomFields);
          }
        }
      }

      // Normalize and deduplicate (already done by Set)
      const uniqueEmails = Array.from(emailSet);

      if (uniqueEmails.length === 0) {
        toast.error("Billing contact email(s) not available");
        return;
      }

      // Use mailto link to open default email application (e.g., Outlook Desktop) in popup style
      window.location.href = `mailto:${uniqueEmails.join(";")}`;
    } catch (err) {
      console.error("Error opening email compose:", err);
      toast.error(err instanceof Error ? err.message : "Failed to open email compose");
    }
  };

  const handleEmailTimeCardApprovers = async () => {
    const jobId = placement?.jobId;
    if (!jobId) {
      toast.error("Job not available for this placement.");
      return;
    }

    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch(`/api/jobs/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // Handle non-JSON responses
      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch job details");
      }

      const job = data?.job || data?.job_data || data;
      if (!job) {
        toast.error("Timecard approver email(s) not available");
        return;
      }

      // Extract timecard approver emails from multiple possible sources (priority-based)
      const emailSet = new Set<string>();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

      // Helper function to recursively extract emails from any value
      const extractEmailsFromValue = (value: any): void => {
        if (value === null || value === undefined) return;

        if (typeof value === "string") {
          // Check if the string itself is a valid email
          const trimmed = value.trim();
          if (emailRegex.test(trimmed)) {
            emailSet.add(trimmed.toLowerCase());
          }
          // Also check for emails within the string (space/comma/semicolon separated)
          const emailMatches = trimmed.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/gi);
          if (emailMatches) {
            emailMatches.forEach((match) => {
              const trimmedMatch = match.trim();
              if (emailRegex.test(trimmedMatch)) {
                emailSet.add(trimmedMatch.toLowerCase());
              }
            });
          }
          return;
        }

        if (Array.isArray(value)) {
          value.forEach((item) => extractEmailsFromValue(item));
          return;
        }

        if (typeof value === "object") {
          // Check common email properties first
          if (value.email && typeof value.email === "string") {
            extractEmailsFromValue(value.email);
          }
          if (value.email_address && typeof value.email_address === "string") {
            extractEmailsFromValue(value.email_address);
          }
          // Recursively scan all values
          Object.values(value).forEach((val) => extractEmailsFromValue(val));
        }
      };

      // Priority 1: Preferred structured fields
      // job.timecard_approver_email
      if (job.timecard_approver_email) {
        extractEmailsFromValue(job.timecard_approver_email);
      }

      // job.timecard_approvers (snake_case)
      if (job.timecard_approvers) {
        extractEmailsFromValue(job.timecard_approvers);
      }

      // job.timecardApprovers (camelCase)
      if (job.timecardApprovers) {
        extractEmailsFromValue(job.timecardApprovers);
      }

      // Priority 2: contacts array where type includes "timecard" OR "approver" (case-insensitive)
      if (Array.isArray(job.contacts)) {
        job.contacts.forEach((contact: any) => {
          const contactType = (contact?.type || contact?.contact_type || "").toLowerCase();
          if (contactType.includes("timecard") || contactType.includes("approver")) {
            const email = contact?.email || contact?.email_address;
            if (email && emailRegex.test(email.trim())) {
              emailSet.add(email.trim().toLowerCase());
            }
          }
        });
      }

      // Priority 3: Fallback - scan custom_fields for ALL valid emails
      if (emailSet.size === 0) {
        const customFields = job.custom_fields || job.customFields;
        if (customFields) {
          // Parse if string
          let parsedCustomFields: any = customFields;
          if (typeof customFields === "string") {
            try {
              parsedCustomFields = JSON.parse(customFields);
            } catch {
              // If parsing fails, treat as plain string and extract emails
              extractEmailsFromValue(customFields);
              parsedCustomFields = null;
            }
          }

          // Scan all values in custom_fields recursively
          if (parsedCustomFields && typeof parsedCustomFields === "object") {
            extractEmailsFromValue(parsedCustomFields);
          }
        }
      }

      // Normalize and deduplicate (already done by Set)
      const uniqueEmails = Array.from(emailSet);

      if (uniqueEmails.length === 0) {
        toast.error("Timecard approver email(s) not available");
        return;
      }

      // Use mailto link to open default email application (e.g., Outlook Desktop) in popup style
      window.location.href = `mailto:${uniqueEmails.join(";")}`;
    } catch (err) {
      console.error("Error opening email compose:", err);
      toast.error(err instanceof Error ? err.message : "Failed to open email compose");
    }
  };

  const handleActionSelected = (action: string) => {
    if (action === "edit" && placementId) {
      router.push(`/dashboard/placements/add?id=${placementId}`);
    } else if (action === "delete" && placementId) {
      checkPendingDeleteRequest();
      setShowDeleteModal(true);
    } else if (action === "add-task" && placementId) {
      // Navigate to add task page with placement context (same behavior as Jobs -> Add Task)
      router.push(
        `/dashboard/tasks/add?relatedEntity=placement&relatedEntityId=${placementId}`
      );
    } else if (action === "email-job-seeker") {
      handleEmailJobSeeker();
    } else if (action === "email-billing-contact") {
      handleEmailBillingContacts();
    } else if (action === "email-time-card-approver") {
      handleEmailTimeCardApprovers();
    } else if (action === "add-note") {
      setShowAddNote(true);
      // setActiveTab("notes");
    }
  };

  // Function to delete a placement (kept for backward compatibility, but now shows modal)
  const handleDelete = async (id: string) => {
    checkPendingDeleteRequest();
    setShowDeleteModal(true);
  };

  // Check for pending delete request
  const checkPendingDeleteRequest = async () => {
    if (!placementId) return;

    setIsLoadingDeleteRequest(true);
    try {
      const response = await fetch(
        `/api/placements/${placementId}/delete-request?record_type=placement`,
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

    if (!placementId) {
      toast.error("Placement ID is missing");
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

      // Step 1: Add "Delete requested" note to placement
      const noteResponse = await fetch(`/api/placements/${placementId}/notes`, {
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
        `/api/placements/${placementId}/delete-request`,
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
            record_type: "placement",
            record_number: formatRecordId(placement?.record_number ?? placement?.id, "placement"),
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
      if (placementId) {
        fetchNotes(placementId);
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
    if (!unarchiveReason.trim() || !placementId) {
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
      const recordDisplay = placement
        ? `${formatRecordId(placement.record_number ?? placement.id, "placement")} ${placement.jobTitle || placement.job_title || ""}`.trim()
        : formatRecordId(placementId, "placement");
      const res = await fetch(`/api/placements/${placementId}/unarchive-request`, {
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
    if (placementId) {
      checkPendingDeleteRequest();
    }
  }, [placementId]);

  const handleAddNote = async () => {
    if (!placementId) return;
    setValidationErrors({});
    const errors: { action?: string; text?: string; about?: string } = {};
    if (!noteForm.text.trim()) {
      errors.text = "Note text is required";
    }
    if (!noteForm.action || noteForm.action.trim() === "") {
      errors.action = "Action is required";
    }
    if (!noteForm.aboutReferences || noteForm.aboutReferences.length === 0) {
      errors.about = "At least one About/Reference is required";
    }
    if (!noteForm.text || noteForm.text.trim() === "") {
      errors.text = "Note text is required";
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    try {
      const aboutData = (noteForm.aboutReferences || []).map((ref) => ({
        id: ref.id,
        type: ref.type,
        display: ref.display,
        value: ref.value,
      }));
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch(`/api/placements/${placementId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: noteForm.text,
          action: noteForm.action,
          about_references: aboutData.length > 0 ? aboutData : undefined,
          aboutReferences: aboutData.length > 0 ? aboutData : undefined,
          email_notification: Array.isArray(noteForm.emailNotification) ? noteForm.emailNotification : [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.errors) {
          setValidationErrors(errorData.errors);
          return;
        }
        throw new Error(errorData.message || "Failed to add note");
      }

      const data = await response.json();
      setNotes([data.note, ...notes]);
      const defaultRef =
        placement && placementId
          ? {
            id: placement.id,
            type: "Placement",
            display: `${formatRecordId(placement.record_number ?? placement.id, "placement")} ${placement.jobSeekerName || ""} - ${placement.jobTitle || ""}`.trim() || `Placement ${formatRecordId(placement.record_number ?? placement.id, "placement")}`,
            value: `#${placement.id}`,
          }
          : null;
      setNoteForm({
        text: "",
        action: "",
        about: defaultRef ? defaultRef.display : "",
        aboutReferences: defaultRef ? [defaultRef] : [],
        emailNotification: [],
      });
      setAboutSearchQuery("");
      setEmailSearchQuery("");
      setShowEmailDropdown(false);
      setValidationErrors({});
      setShowAddNote(false);
      fetchNotes(placementId);
      fetchHistory(placementId);
      toast.success('Note added successfully');
    } catch (err) {
      console.error('Error adding note:', err);
      toast.error(err instanceof Error ? err.message : 'An error occurred while adding a note');
    }
  };

  const isArchived = !!placement?.archived_at;

  // Render modify tab content - redirect to add page for editing (same pattern as Organizations/Jobs)
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Modify Placement</h2>
      <p className="text-gray-600 mb-4">
        {isArchived
          ? "Archived records cannot be edited."
          : "Click the button below to edit this placement's details including custom fields."}
      </p>
      <button
        onClick={handleModifyClick}
        disabled={isArchived}
        className={`px-4 py-2 rounded ${isArchived ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
      >
        Modify Placement
      </button>
    </div>
  );

  // Render notes tab content (same structure as organization/jobs notes)
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
          <h2 className="text-lg font-semibold">Placement Notes</h2>
          <button
            onClick={() => !isArchived && setShowAddNote(true)}
            disabled={isArchived}
            className={`px-3 py-1 rounded text-sm ${isArchived ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
          >
            Add Note
          </button>
        </div>

        {/* Filters & Sort */}
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
              const aboutRefs = parseAboutReferences(
                (note as any).about_references ?? (note as any).aboutReferences
              );
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
                            Placement
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
                                onClick={() => isClickable && navigateToReference(ref)}
                                disabled={!isClickable}
                                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition-all ${isClickable
                                  ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer"
                                  : "bg-gray-100 text-gray-700 border-gray-200 cursor-default"
                                  }`}
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

  const renderDocsTab = () => {
    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Placement Documents</h2>
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

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
        />

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
              <div
                key={fileName}
                className="bg-red-50 border border-red-200 rounded p-2"
              >
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
          <p className="text-gray-500 italic">No documents available</p>
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

        {selectedDocument && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] flex flex-col">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center shrink-0">
                <h2 className="text-lg font-semibold">{selectedDocument.document_name}</h2>
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
    );
  };

  const renderPlacementDetailsPanel = () => {
    const renderPlacementDetailsRow = (key: string, index: number) => {
      switch (key) {
        // case "candidate":
        //   return (
        //     <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Candidate:</div>
        //       <div className="flex-1 p-2 text-blue-600">{placement.jobSeekerName}</div>
        //     </div>
        //   );
        // case "job":
        //   return (
        //     <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Job:</div>
        //       <div className="flex-1 p-2 text-blue-600">{placement.jobTitle}</div>
        //     </div>
        //   );
        // case "organization":
        //   return (
        //     <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Organization:</div>
        //       <div className="flex-1 p-2">{placement.organizationName || "—"}</div>
        //     </div>
        //   );
        // case "status":
        //   return (
        //     <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Status:</div>
        //       <div className="flex-1 p-2">
        //         <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
        //           {placement.status}
        //         </span>
        //       </div>
        //     </div>
        //   );
        // case "startDate":
        //   return (
        //     <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Start Date:</div>
        //       <div className="flex-1 p-2">{placement.startDate || "-"}</div>
        //     </div>
        //   );
        // case "endDate":
        //   return (
        //     <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">End Date:</div>
        //       <div className="flex-1 p-2">{placement.endDate || "-"}</div>
        //     </div>
        //   );
        // case "salary":
        //   return (
        //     <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Salary:</div>
        //       <div className="flex-1 p-2">{placement.salary || "-"}</div>
        //     </div>
        //   );
        default:
          // Custom field
          const field = availableFields.find(
            (f: any) => (f.field_name || f.field_label || f.id) === key
          );
          const fieldLabel = field?.field_label || field?.field_name || key;
          const fieldValue = placement.customFields?.[fieldLabel] || "-";
          const lookupType = (field as any)?.lookup_type ?? (field as any)?.lookupType ?? (fieldLabel.toLowerCase() === "candidate" || fieldLabel.toLowerCase() === "job seeker" ? "jobSeeker" : fieldLabel.toLowerCase() === "job" ? "job" : fieldLabel.toLowerCase() === "organization" ? "organization" : "");
          const fieldInfo = { key, label: fieldLabel, fieldType: (field as any)?.field_type ?? (field as any)?.fieldType, lookupType, multiSelectLookupType: (field as any)?.multi_select_lookup_type ?? (field as any)?.multiSelectLookupType };
          return (
            <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">{fieldLabel}:</div>
              <div className="flex-1 p-2">
                <FieldValueRenderer
                  value={fieldValue}
                  fieldInfo={fieldInfo}
                  allFields={availableFields as any}
                  valuesRecord={placement.customFields as any}
                  emptyPlaceholder="-"
                  clickable
                />
              </div>
            </div>
          );
      }
    };

    return (
      <PanelWithHeader
        title="Placement Details:"
        onEdit={() => handleEditPanel("placementDetails")}
      >
        <div className="space-y-0 border border-gray-200 rounded">
          {Array.from(new Set(visibleFields.placementDetails || [])).map((key, index) => renderPlacementDetailsRow(key, index))}
        </div>
      </PanelWithHeader>
    );
  };

  const renderDetailsPanel = () => {
    if (!placement) return null;
    const customFieldDefs = (availableFields || []).filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden);
    const renderDetailsRow = (key: string, index: number) => {
      switch (key) {
        // case "owner":
        //   return (
        //     <div key={`details-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Owner:</div>
        //       <div className="flex-1 p-2">{placement.owner || "-"}</div>
        //     </div>
        //   );
        // case "dateAdded":
        //   return (
        //     <div key={`details-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Date Added:</div>
        //       <div className="flex-1 p-2">{placement.dateAdded || "-"}</div>
        //     </div>
        //   );
        // case "lastContactDate":
        //   return (
        //     <div key={`details-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
        //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Last Contact:</div>
        //       <div className="flex-1 p-2">{placement.lastContactDate ?? "-"}</div>
        //     </div>
        //   );
        default: {
          const field = customFieldDefs.find((f: any) => (f.field_name || f.field_key || f.field_label || f.id) === key);
          const fieldLabel = field?.field_label || field?.field_name || key;
          const fieldValue = placement.customFields?.[fieldLabel] ?? "-";
          const lookupType = (field as any)?.lookup_type ?? (field as any)?.lookupType ?? (fieldLabel.toLowerCase() === "candidate" || fieldLabel.toLowerCase() === "job seeker" ? "jobSeeker" : fieldLabel.toLowerCase() === "job" ? "job" : fieldLabel.toLowerCase() === "organization" ? "organization" : "");
          const fieldInfo = { key, label: fieldLabel, fieldType: (field as any)?.field_type ?? (field as any)?.fieldType, lookupType, multiSelectLookupType: (field as any)?.multi_select_lookup_type ?? (field as any)?.multiSelectLookupType };
          return (
            <div key={`details-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">{fieldLabel}:</div>
              <div className="flex-1 p-2">
                <FieldValueRenderer
                  value={fieldValue}
                  fieldInfo={fieldInfo}
                  allFields={customFieldDefs as any}
                  valuesRecord={placement.customFields as any}
                  emptyPlaceholder="-"
                  clickable
                />
              </div>
            </div>
          );
        }
      }
    };
    return (
      <PanelWithHeader title="Details:" onEdit={() => handleEditPanel("details")}>
        <div className="space-y-0 border border-gray-200 rounded">
          {Array.from(new Set(visibleFields.details || [])).map((key, index) => renderDetailsRow(key, index))}
        </div>
      </PanelWithHeader>
    );
  };

  const renderRecentNotesPanel = () => {
    return (
      <PanelWithHeader
        title="Recent Notes"
        onEdit={() => handleEditPanel("recentNotes")}
      >
        <div className="border border-gray-200 rounded">
          {visibleFields.recentNotes.includes("notes") && (
            <div className="p-2">
              {notes.length > 0 ? (
                <div>
                  {notes.slice(0, 3).map((note) => (
                    <div
                      key={note.id}
                      className="mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0"
                    >
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{note.created_by_name || "Unknown User"}</span>
                        <span className="text-gray-500">{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {note.text.length > 100
                          ? `${note.text.substring(0, 100)}...`
                          : note.text}
                      </p>
                    </div>
                  ))}
                  {notes.length > 3 && (
                    <button
                      onClick={() => setActiveTab("notes")}
                      className="text-blue-500 text-sm hover:underline"
                    >
                      View all {notes.length} notes
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 italic">No recent notes</p>
              )}
            </div>
          )}
        </div>
      </PanelWithHeader>
    );
  };

  const renderPanel = useCallback(
    (panelId: string, isOverlay = false) => {
      if (panelId === "placementDetails") {
        return (
          <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
            {renderPlacementDetailsPanel()}
          </SortablePanel>
        );
      }
      if (panelId === "details") {
        return (
          <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
            {renderDetailsPanel()}
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
          <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
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
      }
      return null;
    },
    [availableFields, notes, placement, visibleFields, tasks, isLoadingTasks, tasksError]
  );

  // Render history tab content
  const renderHistoryTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Placement History</h2>

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
            {historyFilters.filteredAndSorted.map((item, index) => {
              // Format the history entry based on action type
              let actionDisplay = "";
              let detailsDisplay: React.ReactNode = "";

              try {
                const details =
                  typeof item.details === "string"
                    ? JSON.parse(item.details)
                    : item.details;

                switch (item.action || item.action_type) {
                  case "CREATE":
                    actionDisplay = "Placement Created";
                    detailsDisplay = `Created by ${item.performed_by_name || item.created_by_name || "Unknown"
                      }`;
                    break;
                  case "UPDATE":
                    actionDisplay = "Placement Updated";
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
                    actionDisplay = item.action || item.action_type || "Unknown Action";
                    detailsDisplay = JSON.stringify(details);
                }
              } catch (e) {
                console.error("Error parsing history details:", e);
                detailsDisplay = "Error displaying details";
              }

              return (
                <div
                  key={item.id || index}
                  className="p-3 border rounded hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-blue-600">
                      {actionDisplay}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(item.performed_at || item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mb-2">{detailsDisplay}</div>
                  <div className="text-sm text-gray-600">
                    By: {item.performed_by_name || item.created_by_name || "Unknown"}
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

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "notes", label: "Notes" },
    { id: "docs", label: "Docs" },
    { id: "history", label: "History" },
  ];

  const actionOptions = isArchived
    ? [{ label: "Unarchive", action: () => setShowUnarchiveModal(true) }]
    : [
        { label: "Add Note", action: () => handleActionSelected("add-note") },
        { label: "Add Task", action: () => handleActionSelected("add-task") },
        { label: "Email Job Seeker", action: () => handleActionSelected("email-job-seeker") },
        { label: "Email Billing Contact(s)", action: () => handleActionSelected("email-billing-contact") },
        { label: "Email Time Card Approver(s)", action: () => handleActionSelected("email-time-card-approver") },
        { label: "Delete", action: () => handleActionSelected("delete") },
      ];

  if (isLoading) {
    return <LoadingScreen message="Loading placement details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Placements
        </button>
      </div>
    );
  }

  if (!placement) {
    return (
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
        <div className="text-gray-700 mb-4">Placement not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Placements
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with placement info and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            <FiBriefcase size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            P {placement.record_number ?? placement.id} {placement.jobSeekerName} - {placement.jobTitle}
            {placement.archived_at && (
              <div className="ml-3">
                <CountdownTimer archivedAt={placement.archived_at} />
              </div>
            )}
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
              headerFields.map((fk) => {
                const info = getHeaderFieldInfo(fk);
                const fieldInfo = info ? { key: info.key, label: info.label, fieldType: info.fieldType, lookupType: info.lookupType, multiSelectLookupType: info.multiSelectLookupType } : { key: fk, label: getHeaderFieldLabel(fk) };
                return (
                  <div key={fk} className="min-w-[140px]">
                    <div className="text-xs text-gray-500">
                      {getHeaderFieldLabel(fk)}
                    </div>
                    <div className="text-sm font-medium">
                      <FieldValueRenderer
                        value={getHeaderFieldValue(fk)}
                        fieldInfo={fieldInfo}
                        emptyPlaceholder="-"
                        clickable
                      />
                    </div>
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
              type="button"
            >
              <Image src="/print.svg" alt="Print" width={20} height={20} />
            </button>

            <button
              onClick={handleTogglePinnedRecord}
              className={`p-1 hover:bg-gray-200 rounded ${isRecordPinned ? "text-yellow-600" : "text-gray-600"}`}
              aria-label={isRecordPinned ? "Unpin" : "Pin"}
              title={isRecordPinned ? "Unpin" : "Pin"}
              disabled={!placement}
              type="button"
            >
              <BsFillPinAngleFill size={18} />
            </button>
            <button
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Reload"
              onClick={() => placementId && fetchPlacementData(placementId)}
              type="button"
            >
              <Image src="/reload.svg" alt="Reload" width={20} height={20} />
            </button>
            <button
              onClick={handleGoBack}
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Close"
              type="button"
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
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}

      {activeTab === "summary" && (
        <div className="relative w-full">
          {/* Pinned side drawer */}
          {/* {isPinned && (
            <div
              className={`mt-12 fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transition-all duration-300 ${isCollapsed ? "w-12" : "w-1/3"} border-l border-gray-300`}
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                  <h3 className="font-semibold text-sm">Placement Summary</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsCollapsed(!isCollapsed)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title={isCollapsed ? "Expand" : "Collapse"}
                      type="button"
                    >
                      {isCollapsed ? "▶" : "◀"}
                    </button>
                    <button
                      onClick={togglePin}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Unpin panel"
                      type="button"
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
                      >
                        <div className="flex flex-col gap-4">
                          <DroppableContainer id="left" items={columns.left}>
                            {columns.left.map((id) => renderPanel(id))}
                          </DroppableContainer>
                          <DroppableContainer id="right" items={columns.right}>
                            {columns.right.map((id) => renderPanel(id))}
                          </DroppableContainer>
                        </div>
                        <DragOverlay dropAnimation={panelDropAnimationConfig}>
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

      <div className="p-4">
        {activeTab === "modify" && renderModifyTab()}

        {/* Notes Tab */}
        {activeTab === "notes" && renderNotesTab()}

        {activeTab === "docs" && renderDocsTab()}

        {/* History Tab */}
        {activeTab === "history" && renderHistoryTab()}
      </div>

      {showAddNote && placement && (
        <AddNoteModal
          open={showAddNote}
          onClose={handleCloseAddNoteModal}
          entityType="placement"
          entityId={placementId}
          entityDisplay={
            placement.jobSeekerName && placement.jobTitle
              ? `${placement.jobSeekerName} - ${placement.jobTitle}`
              : `Placement #${placementId}`
          }
          onSuccess={() => fetchNotes(placementId)}
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
          { value: "General", label: "General" },
          { value: "Contract", label: "Contract" },
          { value: "Agreement", label: "Agreement" },
          { value: "Policy", label: "Policy" },
          { value: "Welcome", label: "Welcome" },
        ]}
        confirmButtonText="Upload"
        zIndex={100}
      />

      {/* Edit Fields Modal - placementDetails and details use SortableFieldsEditModal */}
      {editingPanel === "placementDetails" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Placement Details"
          description="Drag to reorder, check/uncheck to show or hide fields."
          order={modalPlacementDetailsOrder}
          visible={modalPlacementDetailsVisible}
          fieldCatalog={placementDetailsFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={(key) =>
            setModalPlacementDetailsVisible((prev) => ({ ...prev, [key]: !prev[key] }))
          }
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            setModalPlacementDetailsOrder((prev) => {
              const oldIndex = prev.indexOf(active.id as string);
              const newIndex = prev.indexOf(over.id as string);
              if (oldIndex === -1 || newIndex === -1) return prev;
              return arrayMove(prev, oldIndex, newIndex);
            });
          }}
          onSave={handleSavePlacementDetailsFields}
          saveButtonText="Save"
          listMaxHeight="60vh"
        />
      )}
      {editingPanel === "details" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Details"
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
      {editingPanel && editingPanel !== "placementDetails" && editingPanel !== "details" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                    <h3 className="font-medium mb-3">Available Fields from Modify Page:</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                      {isLoadingFields ? (
                        <div className="text-center py-4 text-gray-500">Loading fields...</div>
                      ) : availableFields.length > 0 ? (
                        availableFields.map((field) => {
                          const fieldKey = field.field_name || field.field_label || field.id;
                          const isVisible = visibleFields[editingPanel]?.includes(fieldKey) || false;
                          return (
                            <div key={field.id || fieldKey} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={() => toggleFieldVisibility(editingPanel, fieldKey)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label className="text-sm text-gray-700">
                                  {field.field_label || field.field_name || fieldKey}
                                </label>
                              </div>
                              <span className="text-xs text-gray-500">{field.field_type || 'text'}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          <p>No custom fields available</p>
                          <p className="text-xs mt-1">Fields from the modify page will appear here</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="font-medium mb-3">Standard Fields:</h3>
                    <div className="space-y-2 border border-gray-200 rounded p-3">
                      {(() => {
                        const standardFieldsMap: Record<string, Array<{ key: string; label: string }>> = {
                          details: [
                            { key: 'owner', label: 'Owner' },
                            { key: 'dateAdded', label: 'Date Added' },
                            { key: 'lastContactDate', label: 'Last Contact' }
                          ],
                          recentNotes: [
                            { key: 'notes', label: 'Notes' }
                          ]
                        };

                        const fields = standardFieldsMap[editingPanel] || [];
                        return fields.map((field) => {
                          const isVisible = visibleFields[editingPanel]?.includes(field.key) || false;
                          return (
                            <div key={field.key} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={() => toggleFieldVisibility(editingPanel, field.key)}
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
            </div>
          </div>
        </div>
      )}

      {/* Header Fields Modal - uses universal SortableFieldsEditModal */}
      {showHeaderFieldModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowHeaderFieldModal(false)}
          title="Customize Header Fields"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all placement records."
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
            setHeaderFields(PLACEMENT_DEFAULT_HEADER_FIELDS);
            setHeaderFieldsOrder(PLACEMENT_DEFAULT_HEADER_FIELDS);
          }}
          resetButtonText="Reset"
          listMaxHeight="50vh"
        />
      )}

      {/* Unarchive Request Modal */}
      <RequestActionModal
        open={showUnarchiveModal}
        onClose={() => {
          setShowUnarchiveModal(false);
          setUnarchiveReason("");
        }}
        modelType="unarchive"
        entityLabel="Placement"
        recordDisplay={
          placement
            ? `${formatRecordId(placement.record_number ?? placement.id, "placement")} ${placement.jobTitle || placement.job_title || ""}`.trim()
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
              {/* Placement Info */}
              <div className="bg-gray-50 p-4 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Placement to Delete
                </label>
                <p className="text-sm text-gray-900 font-medium">
                  {placement
                    ? `${formatRecordId(placement.record_number ?? placement.id, "placement")} ${placement.jobTitle || placement.job_title || "N/A"}`
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
                  placeholder="Please provide a detailed reason for deleting this placement..."
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
