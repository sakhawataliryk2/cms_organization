"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbGripVertical } from "react-icons/tb";
import { FiArrowUp, FiArrowDown, FiFilter, FiStar, FiChevronDown, FiX } from "react-icons/fi";
import ActionDropdown from "@/components/ActionDropdown";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import CountdownTimer from "@/components/CountdownTimer";
import BulkActionsButton from "@/components/BulkActionsButton";
import BulkOwnershipModal from "@/components/BulkOwnershipModal";
import BulkStatusModal from "@/components/BulkStatusModal";
import BulkTearsheetModal from "@/components/BulkTearsheetModal";
import BulkNoteModal from "@/components/BulkNoteModal";
import { toast } from "sonner";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import AdvancedSearchPanel, {
  type AdvancedSearchCriterion,
} from "@/components/AdvancedSearchPanel";
import { matchesAdvancedValue } from "@/lib/advancedSearch";

type PlacementFavorite = {
  id: string;
  name: string;
  // placement_type: string;
  searchTerm: string;
  columnFilters: Record<string, ColumnFilterState>;
  columnSorts: Record<string, ColumnSortState>;
  columnFields: string[];
  advancedSearchCriteria?: AdvancedSearchCriterion[];
  createdAt: number;
};

const FAVORITES_STORAGE_KEY = "placementsArchivedFavorites";

interface Placement {
  id: string;
  record_number?: number;
  job_seeker_id?: string;
  job_seeker_name?: string;
  job_id?: string;
  job_title?: string;
  job_name?: string;
  status: string;
  placement_type: string;
  start_date?: string;
  end_date?: string;
  salary?: string;
  owner?: string;
  owner_name?: string;
  created_at: string;
  created_by_name?: string;
  archived_at?: string | null;
  archive_reason?: string | null;
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

// Sortable Column Header Component
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
  children,
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
  children?: React.ReactNode;
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
    setFilterPosition({
      top: btnRect.bottom + 4,
      left: thRect.left,
      width: Math.max(150, Math.min(250, thRect.width)),
    });
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
      ref={(node) => {
        thRef.current = node;
        setNodeRef(node);
      }}
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
              onClick={() => { onFilterChange(""); setShowFilter(false); }}
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

const getStatusColor = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "active") return "bg-green-100 text-green-800";
  if (s === "completed") return "bg-blue-100 text-blue-800";
  if (s === "terminated") return "bg-red-100 text-red-800";
  return "bg-blue-100 text-blue-800";
};

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

export default function PlacementList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  
  // Individual row action modals state
  const [showOwnershipModal, setShowOwnershipModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTearsheetModal, setShowTearsheetModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  // Favorites State
  const [favorites, setFavorites] = useState<PlacementFavorite[]>([]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteNameError, setFavoriteNameError] = useState<string | null>(null);

  // Load favorites from local storage
  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  const persistFavorites = (updated: PlacementFavorite[]) => {
    setFavorites(updated);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  };

  const applyFavorite = (fav: PlacementFavorite) => {
    const catalogKeys = new Set(placementColumnsCatalog.map((c) => c.key));
    const validColumnFields = (fav.columnFields || []).filter((k) =>
      catalogKeys.has(k)
    );

    const nextFilters: Record<string, ColumnFilterState> = {};
    for (const [k, v] of Object.entries(fav.columnFilters || {})) {
      if (!catalogKeys.has(k)) continue;
      if (!v || !v.trim()) continue;
      nextFilters[k] = v;
    }

    const nextSorts: Record<string, ColumnSortState> = {};
    for (const [k, v] of Object.entries(fav.columnSorts || {})) {
      if (!catalogKeys.has(k)) continue;
      if (v !== "asc" && v !== "desc") continue;
      nextSorts[k] = v;
    }

    setSearchTerm(fav.searchTerm || "");
    setColumnFilters(nextFilters);
    setColumnSorts(nextSorts);
    if (validColumnFields.length > 0) {
      setColumnFields(validColumnFields);
    }
    setAdvancedSearchCriteria(fav.advancedSearchCriteria ?? []);

    setSelectedFavoriteId(fav.id);
    setFavoritesMenuOpen(false);
  };

  const handleOpenSaveFavoriteModal = () => {
    setFavoriteName("");
    setFavoriteNameError(null);
    setShowSaveFavoriteModal(true);
    setFavoritesMenuOpen(false);
  };

  const handleConfirmSaveFavorite = () => {
    const trimmed = favoriteName.trim();
    if (!trimmed) {
      setFavoriteNameError("Please enter a name for this favorite.");
      return;
    }

    const newFav: PlacementFavorite = {
      id: crypto.randomUUID(),
      name: trimmed,
      searchTerm,
      columnFilters,
      columnSorts,
      columnFields,
      advancedSearchCriteria:
        advancedSearchCriteria.length > 0 ? advancedSearchCriteria : undefined,
      createdAt: Date.now(),
    };

    const updated = [...favorites, newFav];
    persistFavorites(updated);
    setSelectedFavoriteId(newFav.id);
    setShowSaveFavoriteModal(false);
  };

  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.filter((f) => f.id !== id);
    persistFavorites(updated);
    if (selectedFavoriteId === id) {
      setSelectedFavoriteId(null);
    }
  };

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
    setColumnSorts({});
    setAdvancedSearchCriteria([]);
    setSelectedFavoriteId(null);
  };

  const PLACEMENT_BACKEND_COLUMN_KEYS = [
    "candidate",
    "job",
    "placement_type",
    "status",
    "archive_reason",
    "start_date",
    "end_date",
    "salary",
    "owner",
    "created_at",
    "created_by",
  ];

  const humanizePlacement = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const placementColumnsCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const name = String((f as any)?.field_name ?? (f as any)?.fieldName ?? "").trim();
        const label = (f as any)?.field_label ?? (f as any)?.fieldLabel ?? (name ? humanizePlacement(name) : "");
        const isBackendCol = name && PLACEMENT_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        let filterOptions: { label: string; value: string }[] | undefined = undefined;
        if (name === "status") {
          filterType = "select";
          filterOptions = statusOptions;
        }
        if (name === "placement_type") {
          filterType = "select";
          filterOptions = placementTypeOptions;
        }
        if (name === "archive_reason") {
          filterType = "select";
        }
        return {
          key: isBackendCol ? name : `custom:${label || name}`,
          label: String(label || name),
          sortable: isBackendCol,
          filterType,
          filterOptions,
          fieldType: (f as any)?.field_type,
          lookupType: (f as any)?.lookup_type || "",
          multiSelectLookupType: (f as any)?.multi_select_lookup_type ?? (f as any)?.multiSelectLookupType ?? "",
        };
      });
    const merged = [...fromApi];
    if (!merged.some((x) => x.key === "archive_reason")) {
      merged.push({
        key: "archive_reason",
        label: "Archive Reason",
        sortable: true,
        filterType: "select" as const,
        filterOptions: undefined,
        fieldType: "",
        lookupType: "",
        multiSelectLookupType: "",
      });
    }
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [availableFields]);

  const getColumnLabel = (key: string) =>
    placementColumnsCatalog.find((c) => c.key === key)?.label ?? key;

  const getColumnInfo = (key: string) =>
    placementColumnsCatalog.find((c) => c.key === key);

  const getColumnValue = (p: any, key: string) => {
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const val = p?.customFields?.[rawKey];
      return val === undefined || val === null || val === ""
        ? "—"
        : String(val);
    }

    switch (key) {
      case "candidate":
        return p.job_seeker_name || "Unknown";
      case "job":
        return p.job_title || p.job_name || "Unknown";
      case "placement_type":
        return p.placement_type || "Contract";
      case "status":
        return p.status || "Active";
      case "start_date":
        return p.start_date ? formatDate(p.start_date) : "-";
      case "end_date":
        return p.end_date ? formatDate(p.end_date) : "-";
      case "salary":
        return p.salary || "-";
      case "owner":
        return p.owner || p.owner_name || "Unassigned";
      case "created_at":
        return p.created_at ? formatDate(p.created_at) : "-";
      case "created_by":
        return p.created_by_name || "Unknown";
      case "archive_reason":
        return p.archive_reason || "—";
      default:
        return "—";
    }
  };

  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "PLACEMENT",
    configType: "columns",
    defaultFields: [],
  });

  useEffect(() => {
    const catalogKeys = placementColumnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);
    const savedOrder = localStorage.getItem("placementsArchivedColumnOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validOrder = parsed.filter((k: string) => catalogSet.has(k));
          if (validOrder.length > 0) {
            setColumnFields(validOrder);
            return;
          }
        }
      } catch {
        // ignore
      }
    }
    setColumnFields((prev) => (prev.length === 0 ? catalogKeys : prev));
  }, [placementColumnsCatalog]);

  // Handle column sort toggle
  const handleColumnSort = (columnKey: string) => {
    setColumnSorts((prev) => {
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

  // Handle column filter change
  const handleColumnFilter = (columnKey: string, value: string) => {
    setColumnFilters((prev) => {
      if (!value || value.trim() === "") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: value };
    });
  };

  // Handle drag end for column reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columnFields.indexOf(active.id as string);
    const newIndex = columnFields.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(columnFields, oldIndex, newIndex);
      setColumnFields(newOrder);
    }
  };

  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (columnFields.length > 0) {
      localStorage.setItem("placementsArchivedColumnOrder", JSON.stringify(columnFields));
    }
  }, [columnFields]);

  // Unique options for select filters
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    placements.forEach((p) => { if (p.status) statuses.add(p.status); });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [placements]);

  const placementTypeOptions = useMemo(() => {
    const types = new Set<string>();
    placements.forEach((p) => { if (p.placement_type) types.add(p.placement_type); });
    // Ensure the main 3 types are always there if we want, or just what's in the data
    if (types.size === 0) {
      return [
        { label: "Contract", value: "Contract" },
        { label: "Direct Hire", value: "Direct Hire" },
        { label: "Executive Search", value: "Executive Search" }
      ];
    }
    return Array.from(types).map((t) => ({ label: t, value: t }));
  }, [placements]);

  const archiveReasonOptions = useMemo(
    () => [
      { label: "Deletion", value: "Deletion" },
      { label: "Transfer", value: "Transfer" },
    ],
    []
  );

  useEffect(() => {
    const fetchAvailableFields = async () => {
      setIsLoadingFields(true);
      try {
        const res = await fetch("/api/admin/field-management/placements");
        const data = await res.json();

        const fields =
          data.customFields ||
          (data as any).fields ||
          (data as any).data?.customFields ||
          (data as any).data?.fields ||
          (data as any).placementFields ||
          (data as any).data ||
          [];

        setAvailableFields(fields);
      } catch (e) {
        console.error("Failed to load placement fields", e);
        setAvailableFields([]);
      } finally {
        setIsLoadingFields(false);
      }
    };

    fetchAvailableFields();
  }, []);

  // Fetch placements on component mount
  useEffect(() => {
    fetchPlacements();
  }, []);
  const fetchPlacements = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/placements");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch placements");
      }

      const data = await response.json();
      setPlacements(data.placements || []);
    } catch (err) {
      console.error("Error fetching placements:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching placements"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedPlacements = useMemo(() => {
    // Show only archived placements on this page
    let result = placements.filter((p) => p.status === "Archived" || !!p.archived_at);

    const matchesAdvancedCriterion = (
      p: Placement,
      c: AdvancedSearchCriterion
    ): boolean => {
      const raw = getColumnValue(p, c.fieldKey);
      const colInfo = getColumnInfo(c.fieldKey);
      const fieldType = (colInfo as any)?.fieldType ?? "";
      return matchesAdvancedValue(raw, fieldType, c);
    };

    if (advancedSearchCriteria.length > 0) {
      result = result.filter((p) =>
        advancedSearchCriteria.every((c) => matchesAdvancedCriterion(p, c))
      );
    }

    // Apply global search
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((placement) => {
        // ID search and record_number
        const idMatch =
          String(placement.id).toLowerCase().includes(term) ||
          `p${placement.id}`.toLowerCase().includes(term) ||
          String(placement.record_number ?? "").toLowerCase().includes(term);

        // Core fields
        const coreMatch =
          (placement.job_seeker_name || "").toLowerCase().includes(term) ||
          (placement.job_title || placement.job_name || "").toLowerCase().includes(term) ||
          (placement.status || "").toLowerCase().includes(term) ||
          (placement.owner || placement.owner_name || "").toLowerCase().includes(term) ||
          (placement.salary || "").toLowerCase().includes(term) ||
          (placement.archive_reason || "").toLowerCase().includes(term);

        // Dates
        const dateMatch =
          (placement.start_date || "").toLowerCase().includes(term) ||
          (placement.end_date || "").toLowerCase().includes(term) ||
          (placement.created_at || "").toLowerCase().includes(term);

        // Custom fields
        const cf = placement.customFields || placement.custom_fields || {};
        const customMatch = Object.values(cf).some((val) =>
          String(val || "").toLowerCase().includes(term)
        );

        return idMatch || coreMatch || dateMatch || customMatch;
      });
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((p) => {
        const value = getColumnValue(p, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        const columnInfo = getColumnInfo(columnKey);
        if ((columnInfo?.filterType as string) === "number") {
          return String(value) === String(filterValue);
        }
        if (columnInfo?.filterType === "select") {
          return valueStr === filterStr;
        }

        return valueStr.includes(filterStr);
      });
    });

    // Apply sorting
    const activeSorts = Object.entries(columnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
      const [sortKey, sortDir] = activeSorts[0];
      result.sort((a, b) => {
        let aValue = getColumnValue(a, sortKey);
        let bValue = getColumnValue(b, sortKey);

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
  }, [placements, searchTerm, columnFilters, columnSorts, advancedSearchCriteria]);

  // Find custom field definitions for actions
  const findFieldByLabel = (label: string) => {
    return availableFields.find(f => {
      const fieldLabel = (f.field_label || '').toLowerCase();
      const fieldName = (f.field_name || '').toLowerCase();
      const searchLabel = label.toLowerCase();
      return fieldLabel === searchLabel || fieldName === searchLabel;
    });
  };

  const ownerField = findFieldByLabel('Owner');
  const statusField = findFieldByLabel('Status');

  const handleIndividualActionSuccess = () => {
    fetchPlacements();
    setSelectedPlacementId(null);
    setShowOwnershipModal(false);
    setShowStatusModal(false);
    setShowTearsheetModal(false);
    setShowNoteModal(false);
  };

  // Email handlers for single placement
  const handleEmailCandidates = async (placementId: string) => {
    const emailSet = new Set<string>();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    
    const extractEmailsFromValue = (value: any): void => {
      if (!value) return;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (emailRegex.test(trimmed)) emailSet.add(trimmed.toLowerCase());
        const matches = trimmed.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/gi);
        if (matches) matches.forEach(m => {
          const t = m.trim();
          if (emailRegex.test(t)) emailSet.add(t.toLowerCase());
        });
        return;
      }
      if (Array.isArray(value)) value.forEach(extractEmailsFromValue);
      if (typeof value === "object") {
        if (value.email) extractEmailsFromValue(value.email);
        if (value.email_address) extractEmailsFromValue(value.email_address);
        Object.values(value).forEach(extractEmailsFromValue);
      }
    };
    
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      
      const response = await fetch(`/api/placements/${placementId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      const placement = data?.placement || data;
      const jobSeekerId = placement?.jobSeekerId || placement?.job_seeker_id;
      
      if (jobSeekerId) {
        const jsResponse = await fetch(`/api/job-seekers/${jobSeekerId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const jsData = await jsResponse.json();
        const jobSeeker = jsData?.jobSeeker || jsData;
        
        if (jobSeeker?.email) extractEmailsFromValue(jobSeeker.email);
        if (jobSeeker?.email_address) extractEmailsFromValue(jobSeeker.email_address);
        if (jobSeeker?.contact_email) extractEmailsFromValue(jobSeeker.contact_email);
        if (jobSeeker?.contactEmail) extractEmailsFromValue(jobSeeker.contactEmail);
        if (jobSeeker?.contacts) extractEmailsFromValue(jobSeeker.contacts);
        if (Array.isArray(jobSeeker?.contact_info)) {
          jobSeeker.contact_info.forEach((c: any) => {
            const email = c?.email || c?.email_address;
            if (email && emailRegex.test(email.trim())) {
              emailSet.add(email.trim().toLowerCase());
            }
          });
        }
      }
      
      if (emailSet.size === 0) {
        toast.error("Candidate email(s) not available for this placement");
        return;
      }
      
      window.location.href = `mailto:${Array.from(emailSet).join(";")}`;
    } catch (err) {
      toast.error("Failed to open email compose");
    }
  };

  const handleEmailBillingContacts = async (placementId: string) => {
    const emailSet = new Set<string>();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    
    const extractEmailsFromValue = (value: any): void => {
      if (!value) return;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (emailRegex.test(trimmed)) emailSet.add(trimmed.toLowerCase());
        const matches = trimmed.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/gi);
        if (matches) matches.forEach(m => {
          const t = m.trim();
          if (emailRegex.test(t)) emailSet.add(t.toLowerCase());
        });
        return;
      }
      if (Array.isArray(value)) value.forEach(extractEmailsFromValue);
      if (typeof value === "object") {
        if (value.email) extractEmailsFromValue(value.email);
        if (value.email_address) extractEmailsFromValue(value.email_address);
        Object.values(value).forEach(extractEmailsFromValue);
      }
    };
    
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      
      const response = await fetch(`/api/placements/${placementId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      const placement = data?.placement || data;
      const jobId = placement?.jobId || placement?.job_id;
      
      if (jobId) {
        const jobResponse = await fetch(`/api/jobs/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const jobData = await jobResponse.json();
        const job = jobData?.job || jobData;
        
        if (job?.billing_contact_email) extractEmailsFromValue(job.billing_contact_email);
        if (job?.billing_contacts) extractEmailsFromValue(job.billing_contacts);
        if (job?.billingContacts) extractEmailsFromValue(job.billingContacts);
        if (Array.isArray(job?.contacts)) {
          job.contacts.forEach((c: any) => {
            const type = (c?.type || c?.contact_type || "").toLowerCase();
            if (type === "billing") {
              const email = c?.email || c?.email_address;
              if (email && emailRegex.test(email.trim())) {
                emailSet.add(email.trim().toLowerCase());
              }
            }
          });
        }
      }
      
      if (emailSet.size === 0) {
        toast.error("Billing contact email(s) not available for this placement");
        return;
      }
      
      window.location.href = `mailto:${Array.from(emailSet).join(";")}`;
    } catch (err) {
      toast.error("Failed to open email compose");
    }
  };

  const handleEmailApprovers = async (placementId: string) => {
    const emailSet = new Set<string>();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    
    const extractEmailsFromValue = (value: any): void => {
      if (!value) return;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (emailRegex.test(trimmed)) emailSet.add(trimmed.toLowerCase());
        const matches = trimmed.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/gi);
        if (matches) matches.forEach(m => {
          const t = m.trim();
          if (emailRegex.test(t)) emailSet.add(t.toLowerCase());
        });
        return;
      }
      if (Array.isArray(value)) value.forEach(extractEmailsFromValue);
      if (typeof value === "object") {
        if (value.email) extractEmailsFromValue(value.email);
        if (value.email_address) extractEmailsFromValue(value.email_address);
        Object.values(value).forEach(extractEmailsFromValue);
      }
    };
    
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      
      const response = await fetch(`/api/placements/${placementId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      const placement = data?.placement || data;
      const jobId = placement?.jobId || placement?.job_id;
      
      if (jobId) {
        const jobResponse = await fetch(`/api/jobs/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const jobData = await jobResponse.json();
        const job = jobData?.job || jobData;
        
        if (job?.approver_email) extractEmailsFromValue(job.approver_email);
        if (job?.approverEmail) extractEmailsFromValue(job.approverEmail);
        if (job?.approvers) extractEmailsFromValue(job.approvers);
        if (Array.isArray(job?.contacts)) {
          job.contacts.forEach((c: any) => {
            const type = (c?.type || c?.contact_type || "").toLowerCase();
            if (type === "approver" || type === "approval") {
              const email = c?.email || c?.email_address;
              if (email && emailRegex.test(email.trim())) {
                emailSet.add(email.trim().toLowerCase());
              }
            }
          });
        }
        if (Array.isArray(job?.approvers_list)) {
          job.approvers_list.forEach((a: any) => {
            const email = a?.email || a?.email_address;
            if (email && emailRegex.test(email.trim())) {
              emailSet.add(email.trim().toLowerCase());
            }
          });
        }
      }
      
      if (emailSet.size === 0) {
        toast.error("Approver email(s) not available for this placement");
        return;
      }
      
      window.location.href = `mailto:${Array.from(emailSet).join(";")}`;
    } catch (err) {
      toast.error("Failed to open email compose");
    }
  };

  const handleViewPlacement = (id: string) => {
    router.push(`/dashboard/placements/view?id=${id}`);
  };

  const handleAddPlacement = () => {
    router.push("/dashboard/placements/add");
  };

  const handleBackToPlacements = () => {
    router.push("/dashboard/placements");
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedPlacements([]);
    } else {
      setSelectedPlacements(filteredAndSortedPlacements.map((placement) => placement.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectPlacement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event

    if (selectedPlacements.includes(id)) {
      setSelectedPlacements(
        selectedPlacements.filter((placementId) => placementId !== id)
      );
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedPlacements([...selectedPlacements, id]);
      // If all placements are now selected, update selectAll state
      if (
        [...selectedPlacements, id].length === filteredAndSortedPlacements.length
      ) {
        setSelectAll(true);
      }
    }
  };

  // CSV Export function for selected records
  const handleCSVExport = () => {
    if (selectedPlacements.length === 0) return;

    const selectedData = placements.filter((p) =>
      selectedPlacements.includes(p.id)
    );

    // Get headers from currently displayed columns
    const headers = ['ID', ...columnFields.map((key) => getColumnLabel(key))];

    // Escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Create CSV rows
    const csvRows = [
      headers.map(escapeCSV).join(','),
      ...selectedData.map((p) => {
        const row = [
          `P ${p.id}`,
          ...columnFields.map((key) => escapeCSV(getColumnValue(p, key)))
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `placements-export-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  if (isLoading) {
    return <LoadingScreen message="Loading archived placements..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Archived Placements</h1>

        <div className="flex space-x-4">
          {selectedPlacements.length > 0 && (
            <BulkActionsButton
              selectedCount={selectedPlacements.length}
              entityType="placement"
              entityIds={selectedPlacements}
              availableFields={availableFields}
              onSuccess={() => {
                fetchPlacements();
                setSelectedPlacements([]);
                setSelectAll(false);
              }}
              onCSVExport={handleCSVExport}
            />
          )}

          {/* Favorites Dropdown */}
          <div className="relative">
            <button
              onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 bg-white"
            >
              <FiStar className={selectedFavoriteId ? "text-yellow-400 fill-current" : "text-gray-400"} />
              <span className="max-w-[100px] truncate">
                {selectedFavoriteId
                  ? favorites.find((f) => f.id === selectedFavoriteId)?.name || "Favorites"
                  : "Favorites"}
              </span>
              <FiChevronDown />
            </button>

            {favoritesMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <button
                    onClick={handleOpenSaveFavoriteModal}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium flex items-center gap-2"
                  >
                    <FiStar className="text-blue-500" />
                    Save Current Search
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {favorites.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                      No saved favorites yet
                    </p>
                  ) : (
                    favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${selectedFavoriteId === fav.id ? "bg-blue-50" : ""
                          }`}
                        onClick={() => applyFavorite(fav)}
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">
                          {fav.name}
                        </span>
                        <button
                          onClick={(e) => handleDeleteFavorite(fav.id, e)}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          title="Delete favorite"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Columns button (same like Tasks) */}
          <button
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Columns
          </button>

          <button
            onClick={handleBackToPlacements}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Back to Placements
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{error}</p>
        </div>
      )}


      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search archived placements..."
              className="w-full p-2 pl-10 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={advancedSearchButtonRef}
              type="button"
              onClick={() => setShowAdvancedSearch((v) => !v)}
              className={`px-4 py-2 text-sm font-medium rounded border flex items-center gap-2 ${
                showAdvancedSearch || advancedSearchCriteria.length > 0
                  ? "bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Advanced
            </button>
            {(searchTerm ||
              Object.keys(columnFilters).length > 0 ||
              Object.keys(columnSorts).length > 0 ||
              advancedSearchCriteria.length > 0) && (
              <button
                onClick={handleClearAllFilters}
                className="px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors flex items-center gap-2"
              >
                <FiX />
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      <AdvancedSearchPanel
        open={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        fieldCatalog={placementColumnsCatalog.map((c) => ({
          key: c.key,
          label: c.label,
          fieldType: (c as any).fieldType,
          lookupType: (c as any).lookupType,
          multiSelectLookupType: (c as any).multiSelectLookupType,
          options: (c as any).options,
        }))}
        onSearch={(criteria) => setAdvancedSearchCriteria(criteria)}
        recentStorageKey="placementsArchivedAdvancedSearchRecent"
        initialCriteria={advancedSearchCriteria}
        anchorEl={advancedSearchButtonRef.current}
      />

      {/* Placements Table */}
      <div className="overflow-x-auto">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* Fixed checkbox */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </th>


                {/* Fixed Actions */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>

                {/* Fixed ID */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>

                {/* Draggable Dynamic headers */}
                <SortableContext
                  items={columnFields}
                  strategy={horizontalListSortingStrategy}
                >
                  {columnFields.map((key) => {
                    const columnInfo = getColumnInfo(key);
                    if (!columnInfo) return null;

                    return (
                      <SortableColumnHeader
                        key={key}
                        id={key}
                        columnKey={key}
                        label={getColumnLabel(key)}
                        sortState={columnSorts[key] || null}
                        filterValue={columnFilters[key] || null}
                        onSort={() => handleColumnSort(key)}
                        onFilterChange={(value) => handleColumnFilter(key, value)}
                        filterType={columnInfo.filterType}
                        filterOptions={
                          key === "status"
                            ? statusOptions
                            : key === "archive_reason"
                              ? archiveReasonOptions
                              : key === "placement_type"
                                ? placementTypeOptions
                                : undefined
                        }
                      />
                    );
                  })}
                </SortableContext>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedPlacements.length > 0 ? (
                filteredAndSortedPlacements.map((placement) => (
                  <tr
                    key={placement.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      router.push(`/dashboard/placements/view?id=${placement.id}`);
                    }}
                  >
                    {/* Fixed checkbox */}
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedPlacements.includes(placement.id)}
                        onChange={() => { }}
                        onClick={(e) => handleSelectPlacement(placement.id, e)}
                      />
                    </td>

                    {/* Fixed Actions */}
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ActionDropdown
                        label="Actions"
                        disabled
                        options={[
                          { label: "View", action: () => handleViewPlacement(placement.id) },
                          ...(ownerField ? [{
                            label: "Change Ownership",
                            action: () => {
                              setSelectedPlacementId(placement.id);
                              setShowOwnershipModal(true);
                            },
                          }] : []),
                          ...(statusField ? [{
                            label: "Change Status",
                            action: () => {
                              setSelectedPlacementId(placement.id);
                              setShowStatusModal(true);
                            },
                          }] : []),
                          {
                            label: "Add Note",
                            action: () => {
                              setSelectedPlacementId(placement.id);
                              setShowNoteModal(true);
                            },
                          },
                          {
                            label: "Add To TearSheet",
                            action: () => {
                              setSelectedPlacementId(placement.id);
                              setShowTearsheetModal(true);
                            },
                          },
                          {
                            label: "Create Task",
                            action: () => {
                              router.push(`/dashboard/tasks/add?relatedEntity=placement&relatedEntityId=${placement.id}`);
                            },
                          },
                          {
                            label: "Email Candidates",
                            action: () => handleEmailCandidates(placement.id),
                          },
                          {
                            label: "Email Billing Contacts",
                            action: () => handleEmailBillingContacts(placement.id),
                          },
                          {
                            label: "Email Approvers",
                            action: () => handleEmailApprovers(placement.id),
                          },
                        ]}
                      />
                    </td>

                    {/* Fixed ID */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-900">P {placement.record_number ?? placement.id}</span>
                        {placement.archived_at && (
                          <CountdownTimer archivedAt={placement.archived_at} />
                        )}
                      </div>
                    </td>

                    {/* Dynamic cells */}
                    {columnFields.map((key) => {
                      const colInfo = getColumnInfo(key) as { key: string; label: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
                      const fieldInfo = colInfo
                        ? { key: colInfo.key, label: colInfo.label, fieldType: colInfo.fieldType, lookupType: colInfo.lookupType, multiSelectLookupType: colInfo.multiSelectLookupType }
                        : { key, label: getColumnLabel(key) };

                      return (
                        <td
                          key={key}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        // onClick={(e) => e.stopPropagation()}
                        >
                          <FieldValueRenderer
                            value={getColumnValue(placement, key)}
                            fieldInfo={fieldInfo}
                            emptyPlaceholder="—"
                            clickable
                            stopPropagation
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3 + columnFields.length}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    {searchTerm
                      ? "No archived placements match your search."
                      : "No archived placements found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            Previous
          </button>
          <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to{" "}
              <span className="font-medium">
                {filteredAndSortedPlacements.length}
              </span>{" "}
              of{" "}
              <span className="font-medium">
                {filteredAndSortedPlacements.length}
              </span>{" "}
              results
            </p>
          </div>
          {filteredAndSortedPlacements.length > 0 && (
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <span className="sr-only">Previous</span>
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  1
                </button>
                <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <span className="sr-only">Next</span>
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
      {showColumnModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowColumnModal(false)}
          title="Customize Columns"
          description="Drag to reorder, check/uncheck to show or hide columns in the archived placement list."
          order={[
            ...columnFields,
            ...placementColumnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
          ]}
          visible={Object.fromEntries(placementColumnsCatalog.map((c) => [c.key, columnFields.includes(c.key)]))}
          fieldCatalog={placementColumnsCatalog.map((c) => ({ key: c.key, label: c.label }))}
          onToggle={(key) => {
            if (columnFields.includes(key)) {
              setColumnFields((prev) => prev.filter((x) => x !== key));
            } else {
              setColumnFields((prev) => [...prev, key]);
            }
          }}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const fullOrder = [
              ...columnFields,
              ...placementColumnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
            ];
            const oldIndex = fullOrder.indexOf(active.id as string);
            const newIndex = fullOrder.indexOf(over.id as string);
            if (oldIndex === -1 || newIndex === -1) return;
            const newOrder = arrayMove(fullOrder, oldIndex, newIndex);
            setColumnFields(newOrder.filter((k) => columnFields.includes(k)));
          }}
          onSave={async () => {
            const ok = await saveColumnConfig();
            if (ok !== false) setShowColumnModal(false);
          }}
          saveButtonText="Done"
          isSaveDisabled={!!isSavingColumns}
          onReset={() => setColumnFields(placementColumnsCatalog.map((c) => c.key))}
          resetButtonText="Reset"
          listMaxHeight="60vh"
        />
      )}

      {/* Save Favorite Modal */}
      {showSaveFavoriteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-800">Save Search as Favorite</h3>
              <button
                onClick={() => setShowSaveFavoriteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Favorite Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={favoriteName}
                  onChange={(e) => {
                    setFavoriteName(e.target.value);
                    if (e.target.value.trim()) setFavoriteNameError(null);
                  }}
                  placeholder="e.g. High Priority Placements"
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all ${favoriteNameError ? "border-red-300 bg-red-50" : "border-gray-300"
                    }`}
                  autoFocus
                />
                {favoriteNameError && (
                  <p className="text-xs text-red-500 mt-1">{favoriteNameError}</p>
                )}
              </div>

              <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 space-y-1">
                <p className="font-medium flex items-center gap-2">
                  <FiStar className="text-blue-600" size={14} />
                  What will be saved:
                </p>
                <ul className="list-disc list-inside pl-1 opacity-80 space-y-0.5 text-xs">
                  {searchTerm && <li>Search term: "{searchTerm}"</li>}
                  {Object.keys(columnFilters).length > 0 && (
                    <li>{Object.keys(columnFilters).length} active filters</li>
                  )}
                  {Object.keys(columnSorts).length > 0 && (
                    <li>{Object.keys(columnSorts).length} active sorts</li>
                  )}
                  <li>Column visibility and order settings</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowSaveFavoriteModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSaveFavorite}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors font-medium"
              >
                Save Favorite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual row action modals */}
      {showOwnershipModal && ownerField && selectedPlacementId && (
        <BulkOwnershipModal
          open={showOwnershipModal}
          onClose={() => {
            setShowOwnershipModal(false);
            setSelectedPlacementId(null);
          }}
          entityType="placement"
          entityIds={[selectedPlacementId]}
          fieldLabel={ownerField.field_label || 'Owner'}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showStatusModal && statusField && selectedPlacementId && (
        <BulkStatusModal
          open={showStatusModal}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedPlacementId(null);
          }}
          entityType="placement"
          entityIds={[selectedPlacementId]}
          fieldLabel={statusField.field_label || 'Status'}
          options={statusField.options || []}
          availableFields={availableFields}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showTearsheetModal && selectedPlacementId && (
        <BulkTearsheetModal
          open={showTearsheetModal}
          onClose={() => {
            setShowTearsheetModal(false);
            setSelectedPlacementId(null);
          }}
          entityType="placement"
          entityIds={[selectedPlacementId]}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showNoteModal && selectedPlacementId && (
        <BulkNoteModal
          open={showNoteModal}
          onClose={() => {
            setShowNoteModal(false);
            setSelectedPlacementId(null);
          }}
          entityType="placement"
          entityIds={[selectedPlacementId]}
          onSuccess={handleIndividualActionSuccess}
        />
      )}
    </div>
  );
}
