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
import { FiBriefcase, FiLock, FiUnlock } from "react-icons/fi";
import { BsFillPinAngleFill } from "react-icons/bs";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";

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

// Default header fields for Placements module - defined outside component to ensure stable reference
const PLACEMENT_DEFAULT_HEADER_FIELDS = ["status", "owner"];

// Constants for Placement Details persistence
const PLACEMENT_DETAILS_DEFAULT_FIELDS = ['candidate', 'job', 'status', 'startDate', 'endDate', 'salary'];
const PLACEMENT_DETAILS_STORAGE_KEY = "placementDetailsFields";

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

// Sortable row for Placement Details edit modal (vertical drag + checkbox + label)
function SortablePlacementDetailsFieldRow({
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
  const style: CSSProperties = {
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

export default function PlacementView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placementId = searchParams.get("id");

  const [placement, setPlacement] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // Notes and history state
  const [notes, setNotes] = useState<
    Array<{
      id: string;
      text: string;
      created_at: string;
      created_by_name: string;
    }>
  >([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");

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

  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["placementDetails"],
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

  const dropAnimationConfig = useMemo(
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
    const url = `/dashboard/placements/view?id=${placement.id}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      window.alert("Maximum 10 pinned records reached");
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

  // Current active tab
  const [activeTab, setActiveTab] = useState("summary");

  // Editable fields in Modify tab
  const [editableFields, setEditableFields] = useState<any>({});

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>({
    placementDetails: Array.from(new Set(PLACEMENT_DETAILS_DEFAULT_FIELDS)),
    details: ['owner', 'dateAdded', 'lastContactDate'],
    recentNotes: ['notes']
  });
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Modal-local state for Placement Details edit
  const [modalPlacementDetailsOrder, setModalPlacementDetailsOrder] = useState<string[]>([]);
  const [modalPlacementDetailsVisible, setModalPlacementDetailsVisible] = useState<Record<string, boolean>>({});
  const [placementDetailsDragActiveId, setPlacementDetailsDragActiveId] = useState<string | null>(null);

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

  // Build field list: Standard + Custom
  const buildHeaderFieldCatalog = () => {
    const standard = [
      { key: "status", label: "Status" },
      { key: "owner", label: "Owner" },
      { key: "jobSeekerName", label: "Job Seeker" },
      { key: "jobTitle", label: "Job Title" },
      { key: "startDate", label: "Start Date" },
      { key: "endDate", label: "End Date" },
      { key: "salary", label: "Salary" },
      { key: "dateAdded", label: "Date Added" },
      { key: "lastContactDate", label: "Last Contact Date" },
    ];

    const apiCustom = (availableFields || []).map((f: any) => {
      const k = f.field_name || f.field_key || f.field_label || f.id;
      return {
        key: `custom:${k}`,
        label: f.field_label || f.field_name || String(k),
      };
    });

    const placementCustom = Object.keys(placement?.customFields || {}).map((k) => ({
      key: `custom:${k}`,
      label: k,
    }));

    const merged = [...standard, ...apiCustom, ...placementCustom];
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  };

  const headerFieldCatalog = buildHeaderFieldCatalog();

  const getHeaderFieldValue = (key: string) => {
    if (!placement) return "-";

    // custom fields
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const val = placement.customFields?.[rawKey];
      return val === undefined || val === null || val === ""
        ? "-"
        : String(val);
    }

    // standard fields
    switch (key) {
      case "status":
        return placement.status || "-";
      case "owner":
        return placement.owner || "Unassigned";
      case "jobSeekerName":
        return placement.jobSeekerName || "-";
      case "jobTitle":
        return placement.jobTitle || "-";
      case "startDate":
        return placement.startDate || "-";
      case "endDate":
        return placement.endDate || "-";
      case "salary":
        return placement.salary || "-";
      case "dateAdded":
        return placement.dateAdded || "-";
      case "lastContactDate":
        return placement.lastContactDate || "-";
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
      const response = await fetch('/api/admin/field-management/placements');
      if (response.ok) {
        const data = await response.json();
        const fields = data.customFields || [];
        setAvailableFields(fields);
        
        // Add custom fields to visible fields if they have values
        if (placement && placement.customFields) {
          const customFieldKeys = Object.keys(placement.customFields);
          customFieldKeys.forEach(fieldKey => {
            // Add to appropriate panel based on field name
            if (fieldKey.toLowerCase().includes('candidate') || fieldKey.toLowerCase().includes('job') || fieldKey.toLowerCase().includes('status')) {
              if (!visibleFields.placementDetails.includes(fieldKey)) {
                setVisibleFields(prev => ({
                  ...prev,
                  placementDetails: [...prev.placementDetails, fieldKey]
                }));
              }
            }
          });
        }
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

  // Placement Details field catalog: standard + all custom (for edit modal and display order)
  const placementDetailsFieldCatalog = useMemo(() => {
    const standard: { key: string; label: string }[] = [
      { key: 'candidate', label: 'Candidate' },
      { key: 'job', label: 'Job' },
      { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'salary', label: 'Salary' },
    ];
    const customFromDefs = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    const keysFromDefs = new Set(customFromDefs.map((c) => c.key));
    const standardKeys = new Set(standard.map((s) => s.key));
    const customFromPlacement = Object.keys(placement?.customFields || {})
      .filter((k) => !keysFromDefs.has(k) && !standardKeys.has(k))
      .map((k) => ({ key: k, label: k }));
    
    // Deduplicate by key property
    const allFields = [...standard, ...customFromDefs, ...customFromPlacement];
    const seenKeys = new Set<string>();
    return allFields.filter((f) => {
      if (seenKeys.has(f.key)) return false;
      seenKeys.add(f.key);
      return true;
    });
  }, [availableFields, placement?.customFields]);

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

  // Placement Details modal: drag end (reorder)
  const handlePlacementDetailsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setPlacementDetailsDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalPlacementDetailsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // Placement Details modal: save order/visibility and persist for all records
  const handleSavePlacementDetailsFields = useCallback(() => {
    const newOrder = Array.from(new Set(modalPlacementDetailsOrder.filter((k) => modalPlacementDetailsVisible[k])));
    if (typeof window !== "undefined") {
      localStorage.setItem(PLACEMENT_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, placementDetails: newOrder }));
    setEditingPanel(null);
  }, [modalPlacementDetailsOrder, modalPlacementDetailsVisible]);

  // Handle edit panel click
  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Initialize editable fields when placement data is loaded
  useEffect(() => {
    if (placement) {
      // Flatten placement data for editing
      const flattenedData = {
        candidate: placement.jobSeekerName || '',
        job: placement.jobTitle || '',
        status: placement.status || '',
        startDate: placement.startDate || '',
        endDate: placement.endDate || '',
        salary: placement.salary || '',
        owner: placement.owner || '',
      };
      setEditableFields(flattenedData);
      setOriginalData(flattenedData);
    }
  }, [placement]);

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

      console.log(`API Response status: ${response.status} ${response.statusText}`);

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

      const formattedPlacement = {
        id: data.placement.id,
        jobSeekerId: data.placement.jobSeekerId || data.placement.job_seeker_id || '',
        jobSeekerName: data.placement.jobSeekerName || data.placement.job_seeker_name || 'Unknown Job Seeker',
        jobId: data.placement.jobId || data.placement.job_id || '',
        jobTitle: data.placement.jobTitle || data.placement.job_title || data.placement.job_name || 'Unknown Job',
        status: data.placement.status || 'Active',
        startDate: data.placement.startDate ? new Date(data.placement.startDate).toLocaleDateString() : (data.placement.start_date ? new Date(data.placement.start_date).toLocaleDateString() : ''),
        endDate: data.placement.endDate ? new Date(data.placement.endDate).toLocaleDateString() : (data.placement.end_date ? new Date(data.placement.end_date).toLocaleDateString() : ''),
        salary: data.placement.salary || '',
        owner: data.placement.owner || data.placement.owner_name || '',
        dateAdded: data.placement.createdAt ? new Date(data.placement.createdAt).toLocaleDateString() : (data.placement.created_at ? new Date(data.placement.created_at).toLocaleDateString() : ''),
        lastContactDate: data.placement.last_contact_date ? new Date(data.placement.last_contact_date).toLocaleDateString() : 'Never contacted',
        createdBy: data.placement.createdByName || data.placement.created_by_name || 'Unknown',
        customFields: customFieldsObj,
      };

      console.log("Formatted placement:", formattedPlacement);
      setPlacement(formattedPlacement);

      // After loading placement data, fetch notes and history
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
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
        setFileDetailsName(fileArray[0].name.split(".")[0]);
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
        setFileDetailsName(fileArray[0].name.split(".")[0]);
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
          filesToUpload.length === 1 ? fileDetailsName : file.name.split(".")[0]
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
          fetchDocuments(placementId);
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
        fetchDocuments(placementId);
      } else {
        const data = await response.json();
        alert(data.message || "Failed to add document");
      }
    } catch (err) {
      console.error("Error adding document:", err);
      alert("An error occurred while adding the document");
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
        alert(data.message || "Failed to delete document");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("An error occurred while deleting the document");
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

      alert("Document updated successfully");
    } catch (err) {
      console.error("Error updating document:", err);
      alert(
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

  const handleDownloadDocument = (doc: any) => {
    if (doc.file_path) {
      const path = String(doc.file_path).startsWith("/")
        ? String(doc.file_path)
        : `/${doc.file_path}`;
      window.open(path, "_blank");
      return;
    }

    if (doc.content) {
      const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${doc.document_name || "document"}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert("This document has no file or content to download.");
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
      alert("Job Seeker not available for this placement.");
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
        alert("Job seeker email not available");
        return;
      }

      // Use mailto link to open default email application (e.g., Outlook Desktop) in popup style
      window.location.href = `mailto:${email}`;
    } catch (err) {
      console.error("Error opening email compose:", err);
      alert(err instanceof Error ? err.message : "Failed to open email compose");
    }
  };

  const handleEmailBillingContacts = async () => {
    const jobId = placement?.jobId;
    if (!jobId) {
      alert("Job not available for this placement.");
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
        alert("Billing contact email(s) not available");
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
        alert("Billing contact email(s) not available");
        return;
      }

      // Use mailto link to open default email application (e.g., Outlook Desktop) in popup style
      window.location.href = `mailto:${uniqueEmails.join(";")}`;
    } catch (err) {
      console.error("Error opening email compose:", err);
      alert(err instanceof Error ? err.message : "Failed to open email compose");
    }
  };

  const handleEmailTimeCardApprovers = async () => {
    const jobId = placement?.jobId;
    if (!jobId) {
      alert("Job not available for this placement.");
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
        alert("Timecard approver email(s) not available");
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
        alert("Timecard approver email(s) not available");
        return;
      }

      // Use mailto link to open default email application (e.g., Outlook Desktop) in popup style
      window.location.href = `mailto:${uniqueEmails.join(";")}`;
    } catch (err) {
      console.error("Error opening email compose:", err);
      alert(err instanceof Error ? err.message : "Failed to open email compose");
    }
  };

  const handleActionSelected = (action: string) => {
    if (action === "edit" && placementId) {
      router.push(`/dashboard/placements/add?id=${placementId}`);
    } else if (action === "delete" && placementId) {
      handleDelete(placementId);
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
      setActiveTab("notes");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this placement?")) return;

    try {
      const response = await fetch(`/api/placements/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete placement");
      }

      router.push("/dashboard/placements");
    } catch (err) {
      console.error("Error deleting placement:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting the placement"
      );
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !placementId) return;

    try {
      const response = await fetch(`/api/placements/${placementId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: newNote,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add note");
      }

      const data = await response.json();

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      // Clear the form
      setNewNote("");
      setShowAddNote(false);

      // Refresh history
      fetchHistory(placementId);
    } catch (err) {
      console.error("Error adding note:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while adding a note"
      );
    }
  };

  // Render modify tab content
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Modify Placement</h2>
      <div className="space-y-4">
        <div className="flex items-center">
          <label className="w-48 font-medium">Candidate:</label>
          <input
            type="text"
            value={editableFields.candidate || ''}
            onChange={(e) => setEditableFields({ ...editableFields, candidate: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="Candidate name"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Job:</label>
          <input
            type="text"
            value={editableFields.job || ''}
            onChange={(e) => setEditableFields({ ...editableFields, job: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="Job title"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Status:</label>
          <select
            value={editableFields.status || ''}
            onChange={(e) => setEditableFields({ ...editableFields, status: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="Pending">Pending</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Terminated">Terminated</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Start Date:</label>
          <input
            type="date"
            value={editableFields.startDate || ''}
            onChange={(e) => setEditableFields({ ...editableFields, startDate: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">End Date:</label>
          <input
            type="date"
            value={editableFields.endDate || ''}
            onChange={(e) => setEditableFields({ ...editableFields, endDate: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Salary:</label>
          <input
            type="text"
            value={editableFields.salary || ''}
            onChange={(e) => setEditableFields({ ...editableFields, salary: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="Salary"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Owner:</label>
          <input
            type="text"
            value={editableFields.owner || ''}
            onChange={(e) => setEditableFields({ ...editableFields, owner: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="Owner"
          />
        </div>
        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={() => {
              setEditableFields(originalData);
            }}
            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setIsSaving(true);
              try {
                const response = await fetch(`/api/placements/${placementId}`, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(editableFields),
                });

                if (!response.ok) {
                  throw new Error("Failed to update placement");
                }

                await fetchPlacementData(placementId!);
                alert("Placement updated successfully");
              } catch (err) {
                console.error("Error updating placement:", err);
                alert("Failed to update placement");
              } finally {
                setIsSaving(false);
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );

  // Render notes tab content
  const renderNotesTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Placement Notes</h2>
        <button
          onClick={() => setShowAddNote(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Add Note
        </button>
      </div>

      {/* Add Note Form */}
      {showAddNote && (
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <h3 className="font-medium mb-2">Add New Note</h3>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter your note here..."
            className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowAddNote(false)}
              className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNote}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              disabled={!newNote.trim()}
            >
              Save Note
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {isLoadingNotes ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : noteError ? (
        <div className="text-red-500 py-2">{noteError}</div>
      ) : notes.length > 0 ? (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="p-3 border rounded hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-blue-600">
                  {note.created_by_name || "Unknown User"}
                </span>
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
                  <div className="flex-1 min-h-[60vh] rounded border overflow-hidden bg-gray-100">
                    <iframe
                      src={selectedDocument.file_path}
                      title={selectedDocument.document_name}
                      className="w-full h-full min-h-[60vh] border-0"
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
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
        case "candidate":
          return (
            <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Candidate:</div>
              <div className="flex-1 p-2 text-blue-600">{placement.jobSeekerName}</div>
            </div>
          );
        case "job":
          return (
            <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Job:</div>
              <div className="flex-1 p-2 text-blue-600">{placement.jobTitle}</div>
            </div>
          );
        case "status":
          return (
            <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Status:</div>
              <div className="flex-1 p-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                  {placement.status}
                </span>
              </div>
            </div>
          );
        case "startDate":
          return (
            <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Start Date:</div>
              <div className="flex-1 p-2">{placement.startDate || "-"}</div>
            </div>
          );
        case "endDate":
          return (
            <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">End Date:</div>
              <div className="flex-1 p-2">{placement.endDate || "-"}</div>
            </div>
          );
        case "salary":
          return (
            <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Salary:</div>
              <div className="flex-1 p-2">{placement.salary || "-"}</div>
            </div>
          );
        default:
          // Custom field
          const field = availableFields.find(
            (f: any) => (f.field_name || f.field_label || f.id) === key
          );
          const fieldLabel = field?.field_label || field?.field_name || key;
          const fieldValue = placement.customFields?.[key] || "-";
          return (
            <div key={`placementDetails-${key}-${index}`} className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{fieldLabel}:</div>
              <div className="flex-1 p-2">{String(fieldValue)}</div>
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
    return (
      <PanelWithHeader title="Details:" onEdit={() => handleEditPanel("details")}>
        <div className="space-y-0 border border-gray-200 rounded">
          {visibleFields.details.includes("owner") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Owner:</div>
              <div className="flex-1 p-2">{placement.owner || "-"}</div>
            </div>
          )}
          {visibleFields.details.includes("dateAdded") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Date Added:</div>
              <div className="flex-1 p-2">{placement.dateAdded || "-"}</div>
            </div>
          )}
          {visibleFields.details.includes("lastContactDate") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Last Contact:</div>
              <div className="flex-1 p-2">{placement.lastContactDate}</div>
            </div>
          )}
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
      return null;
    },
    [availableFields, notes, placement, visibleFields]
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
        <div className="space-y-4">
          {history.map((item, index) => {
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
                  detailsDisplay = `Created by ${
                    item.performed_by_name || item.created_by_name || "Unknown"
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
                                    <span className="font-semibold text-gray-700 min-w-[120px]">Custom Field ({cfKey}):</span>
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
                        const fieldName = key.replace(/_/g, " ");
                        changes.push(
                          <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-sm">
                            <span className="font-semibold text-gray-700 capitalize min-w-[120px]">{fieldName}:</span>
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="text-red-600 bg-red-50 px-1 rounded line-through decoration-red-400 opacity-80">
                                {formatValue(beforeVal)}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-700 bg-green-50 px-1 rounded font-medium">
                                {formatValue(afterVal)}
                              </span>
                            </div>
                          </div>
                        );
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
  
  const actionOptions = [
    { label: "Add Note", action: () => handleActionSelected("add-note") },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
    { label: "Email Job Seeker", action: () => handleActionSelected("email-job-seeker") },
    { label: "Email Billing Contact(s)", action: () => handleActionSelected("email-billing-contact") },
    { label: "Email Time Card Approver(s)", action: () => handleActionSelected("email-time-card-approver") },
    // { label: "Edit", action: () => handleActionSelected("edit") },
    { label: "Delete", action: () => handleActionSelected("delete") },
  ];

  if (isLoading) {
    return <LoadingScreen message="Loading placement details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
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
      <div className="bg-white p-6 rounded-lg shadow-md">
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
            {placement.id} {placement.jobSeekerName} - {placement.jobTitle}
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
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 ${
              activeTab === tab.id
                ? "bg-gray-200 rounded-t border-t border-r border-l border-gray-400 font-medium"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
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
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <DroppableContainer id="left" items={columns.left}>
                      {columns.left.map((id) => renderPanel(id))}
                    </DroppableContainer>
                  </div>
                  <div>
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

      <div className="p-4">
        {/* Display content based on active tab */}

        {/* Modify Tab */}
        {activeTab === "modify" && renderModifyTab()}

        {/* Notes Tab */}
        {activeTab === "notes" && renderNotesTab()}

        {activeTab === "docs" && renderDocsTab()}

        {/* History Tab */}
        {activeTab === "history" && renderHistoryTab()}
      </div>

      {showFileDetailsModal && pendingFiles.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 bg-opacity-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm File Details</h3>
            <div className="space-y-4">
              {pendingFiles.length === 1 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">File Name *</label>
                    <input
                      type="text"
                      value={fileDetailsName}
                      onChange={(e) => setFileDetailsName(e.target.value)}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter file name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Document Type</label>
                    <select
                      value={fileDetailsType}
                      onChange={(e) => setFileDetailsType(e.target.value)}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus://ring-blue-500"
                    >
                      <option value="General">General</option>
                      <option value="Contract">Contract</option>
                      <option value="Agreement">Agreement</option>
                      <option value="Policy">Policy</option>
                      <option value="Welcome">Welcome</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm text-gray-700 font-medium mb-2">
                    You selected {pendingFiles.length} files
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                    {pendingFiles.map((file) => (
                      <li key={file.name} className="truncate">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    Each file will use its filename as the document name and "General" as the type.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowFileDetailsModal(false);
                  setPendingFiles([]);
                }}
                className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFileDetails}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50"
                disabled={pendingFiles.length === 1 && !fileDetailsName.trim()}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fields Modal */}
      {editingPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Edit Fields - {editingPanel === "placementDetails" ? "Placement Details" : editingPanel}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              {editingPanel === "placementDetails" && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={(e) => setPlacementDetailsDragActiveId(e.active.id as string)}
                  onDragEnd={handlePlacementDetailsDragEnd}
                  onDragCancel={() => setPlacementDetailsDragActiveId(null)}
                >
                  <div className="mb-4">
                    <h3 className="font-medium mb-3">Drag to reorder, check/uncheck to show/hide:</h3>
                    <SortableContext
                      items={modalPlacementDetailsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                        {modalPlacementDetailsOrder.map((key, index) => {
                          const field = placementDetailsFieldCatalog.find((f) => f.key === key);
                          if (!field) return null;
                          return (
                            <SortablePlacementDetailsFieldRow
                              key={`placementDetails-${key}-${index}`}
                              id={key}
                              label={field.label}
                              checked={modalPlacementDetailsVisible[key] || false}
                              onToggle={() =>
                                setModalPlacementDetailsVisible((prev) => ({
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
                      {placementDetailsDragActiveId ? (
                        (() => {
                          const field = placementDetailsFieldCatalog.find((f) => f.key === placementDetailsDragActiveId);
                          return field ? (
                            <SortablePlacementDetailsFieldRow
                              id={placementDetailsDragActiveId}
                              label={field.label}
                              checked={modalPlacementDetailsVisible[placementDetailsDragActiveId] || false}
                              onToggle={() => {}}
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
                      onClick={handleSavePlacementDetailsFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </DndContext>
              )}
              {editingPanel !== "placementDetails" && (
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
              )}
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
                    onClick={() => setHeaderFields(PLACEMENT_DEFAULT_HEADER_FIELDS)}
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

