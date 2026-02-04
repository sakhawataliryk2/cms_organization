"use client";

import { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import PanelWithHeader from "@/components/PanelWithHeader";
import ActionDropdown from "@/components/ActionDropdown";
import { FiX, FiPrinter, FiArrowUp, FiArrowDown, FiFilter } from "react-icons/fi";
import { BsFillPinAngleFill } from "react-icons/bs";
import { TbGripVertical } from "react-icons/tb";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { toast } from "sonner";
import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";
import { FiStar, FiChevronDown } from "react-icons/fi";

type TearsheetFavorite = {
  id: string;
  name: string;
  searchTerm: string;
  columnFilters: Record<string, ColumnFilterState>;
  columnSorts: Record<string, ColumnSortState>;
  columnFields: string[];
  createdAt: number;
};

const FAVORITES_STORAGE_KEY = "tearsheetsFavorites";

type TearsheetRow = {
  id: number;
  name: string;
  job_seeker_count: number;
  hiring_manager_count: number;
  job_order_count: number;
  lead_count: number;
  organization_count?: number;
  placement_count?: number;
  owner_name?: string | null;
  created_at?: string | null;
  last_opened_at?: string | null;
};

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
    if (!showFilter || !filterToggleRef.current || !thRef.current) { setFilterPosition(null); return; }
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

const TEARSHEET_DEFAULT_COLUMNS = [
  "id",
  "name",
  "job_seeker_count",
  "hiring_manager_count",
  "job_order_count",
  "lead_count",
  "organization_count",
  "placement_count",
  "owner_name",
  "created_at",
  "last_opened_at",
] as const;

type RecordItem = {
  id: number;
  name: string;
  email?: string;
  company?: string;
  type: string;
  organization?: string;
  organization_name?: string;
  organization_id?: string;
  placement?: string;
  placement_name?: string;
  placement_id?: string;
};

type User = {
  id: string;
  name: string;
  email: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
};

const TearsheetsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TearsheetRow[]>([]);
  const [isPinned, setIsPinned] = useState(false);

  // Modal state for tearsheet details
  const [selectedTearsheet, setSelectedTearsheet] = useState<{
    id: number;
    name: string;
    records: RecordItem[];
  } | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Linked Organizations modal
  const [linkedOrgsModal, setLinkedOrgsModal] = useState<{
    tearsheetId: number;
    tearsheetName: string;
    organizations: { id: number; name: string }[];
  } | null>(null);
  const [isLoadingLinkedOrgs, setIsLoadingLinkedOrgs] = useState(false);

  // Linked Placements modal
  const [linkedPlacementsModal, setLinkedPlacementsModal] = useState<{
    tearsheetId: number;
    tearsheetName: string;
    placements: Array<{
      id: number;
      job_id: number;
      job_seeker_id: number;
      status: string;
      start_date: string;
      js_first_name?: string;
      js_last_name?: string;
      js_email?: string;
      job_title?: string;
      organization_name?: string;
    }>;
  } | null>(null);
  const [isLoadingLinkedPlacements, setIsLoadingLinkedPlacements] = useState(false);

  // Actions modal state
  const [selectedTearsheetForAction, setSelectedTearsheetForAction] = useState<TearsheetRow | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [internalUsers, setInternalUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);

  const [pinnedKeySet, setPinnedKeySet] = useState<Set<string>>(new Set());

  // Main search (global filter across key fields)
  const [searchTerm, setSearchTerm] = useState("");

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  // Favorites State
  const [favorites, setFavorites] = useState<TearsheetFavorite[]>([]);
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

  const persistFavorites = (updated: TearsheetFavorite[]) => {
    setFavorites(updated);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  };

  const applyFavorite = (fav: TearsheetFavorite) => {
    setSearchTerm(fav.searchTerm || "");
    setColumnFilters(fav.columnFilters || {});
    setColumnSorts(fav.columnSorts || {});
    if (fav.columnFields && fav.columnFields.length > 0) {
      setColumnFields(fav.columnFields);
    }
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

    const newFav: TearsheetFavorite = {
      id: crypto.randomUUID(),
      name: trimmed,
      searchTerm,
      columnFilters,
      columnSorts,
      columnFields,
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
    setSelectedFavoriteId(null);
  };


  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "TEARSHEET",
    defaultFields: [...TEARSHEET_DEFAULT_COLUMNS],
    configType: "columns",
  });

  const columnsCatalog = useMemo(() => {
    return [
      { key: "id", label: "ID", sortable: true, filterType: "number" as const },
      { key: "name", label: "Name", sortable: true, filterType: "text" as const },
      { key: "job_seeker_count", label: "Job Seeker", sortable: true, filterType: "number" as const },
      { key: "hiring_manager_count", label: "Hiring Manager", sortable: true, filterType: "number" as const },
      { key: "job_order_count", label: "Job Order", sortable: true, filterType: "number" as const },
      { key: "lead_count", label: "Lead", sortable: true, filterType: "number" as const },
      { key: "organization_count", label: "Organization", sortable: true, filterType: "number" as const },
      { key: "placement_count", label: "Placement", sortable: true, filterType: "number" as const },
      { key: "owner_name", label: "Owner", sortable: true, filterType: "text" as const },
      { key: "created_at", label: "Date Added", sortable: true, filterType: "text" as const },
      { key: "last_opened_at", label: "Last Date Opened", sortable: true, filterType: "text" as const },
    ];
  }, []);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnFilterType = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.filterType || "text";

  // Load column order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem("tearsheetsColumnOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validOrder = parsed.filter((key) =>
            [...TEARSHEET_DEFAULT_COLUMNS].includes(key)
          );
          if (validOrder.length > 0) {
            setColumnFields(validOrder);
          }
        }
      } catch (e) {
        console.error("Error loading column order:", e);
      }
    }
  }, []);

  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (columnFields.length > 0) {
      localStorage.setItem("tearsheetsColumnOrder", JSON.stringify(columnFields));
    }
  }, [columnFields]);

  const getColumnValue = (row: TearsheetRow, key: string) => {
    switch (key) {
      case "id": return row.id;
      case "name": return row.name;
      case "job_seeker_count": return row.job_seeker_count;
      case "hiring_manager_count": return row.hiring_manager_count;
      case "job_order_count": return row.job_order_count;
      case "lead_count": return row.lead_count;
      case "organization_count": return row.organization_count ?? 0;
      case "placement_count": return row.placement_count ?? 0;
      case "owner_name": return row.owner_name || "-";
      case "created_at": return row.created_at; // Keep raw for sorting
      case "last_opened_at": return row.last_opened_at; // Keep raw for sorting
      default: return "";
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setColumnFields((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over?.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const renderCell = (r: TearsheetRow, key: string) => {
    switch (key) {
      case "id":
        return (
          <button onClick={() => handleTearsheetNameClick(r)} className="">
            TE {r.id || "-"}
          </button>
        );
      case "name":
        return (
          <button
            onClick={() => handleTearsheetNameClick(r)}
            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            {r.name || "-"}
          </button>
        );
      case "job_seeker_count":
        return (
          <button
            onClick={() => handleCountClick(r.id, r.name, 'job_seekers', r.job_seeker_count)}
            className={`${r.job_seeker_count > 0 ? 'text-blue-600 hover:text-blue-800 underline cursor-pointer' : 'text-gray-700'}`}
            disabled={r.job_seeker_count === 0}
          >
            {r.job_seeker_count || 0}
          </button>
        );
      case "hiring_manager_count":
        return (
          <button
            onClick={() => handleCountClick(r.id, r.name, 'hiring_managers', r.hiring_manager_count)}
            className={`${r.hiring_manager_count > 0 ? 'text-blue-600 hover:text-blue-800 underline cursor-pointer' : 'text-gray-700'}`}
            disabled={r.hiring_manager_count === 0}
          >
            {r.hiring_manager_count || 0}
          </button>
        );
      case "job_order_count":
        return (
          <button
            onClick={() => handleCountClick(r.id, r.name, 'jobs', r.job_order_count)}
            className={`${r.job_order_count > 0 ? 'text-blue-600 hover:text-blue-800 underline cursor-pointer' : 'text-gray-700'}`}
            disabled={r.job_order_count === 0}
          >
            {r.job_order_count || 0}
          </button>
        );
      case "lead_count":
        return (
          <button
            onClick={() => handleCountClick(r.id, r.name, 'leads', r.lead_count)}
            className={`${r.lead_count > 0 ? 'text-blue-600 hover:text-blue-800 underline cursor-pointer' : 'text-gray-700'}`}
            disabled={r.lead_count === 0}
          >
            {r.lead_count || 0}
          </button>
        );
      case "organization_count":
        return (
          <button
            onClick={() => handleLinkedOrgsClick(r.id, r.name, r.organization_count ?? 0)}
            className={`${(r.organization_count ?? 0) > 0 ? "text-blue-600 hover:text-blue-800 underline cursor-pointer" : "text-gray-700 cursor-default"}`}
            disabled={(r.organization_count ?? 0) === 0}
          >
            {r.organization_count ?? 0}
          </button>
        );
      case "placement_count":
        return (
          <button
            onClick={() => handleLinkedPlacementsClick(r.id, r.name, r.placement_count ?? 0)}
            className={`${(r.placement_count ?? 0) > 0 ? "text-blue-600 hover:text-blue-800 underline cursor-pointer" : "text-gray-700"}`}
            disabled={(r.placement_count ?? 0) === 0}
          >
            {r.placement_count ?? 0}
          </button>
          );
      case "owner_name":
        return <span className="text-gray-700">{r.owner_name || "-"}</span>;
      case "created_at":
        return <span className="text-gray-700">{formatDateTime(r.created_at)}</span>;
      case "last_opened_at":
        return <span className="text-gray-700">{formatDate(r.last_opened_at)}</span>;
      default:
        return <span className="text-gray-700">{String(getColumnValue(r, key))}</span>;
    }
  };

  const handleColumnSort = (columnKey: string) => {
    setColumnSorts((prev) => {
      const current = prev[columnKey];
      let next: ColumnSortState = "asc";
      if (current === "asc") next = "desc";
      else if (current === "desc") next = null;
      return { [columnKey]: next };
    });
  };

  const handleColumnFilter = (columnKey: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [columnKey]: value || null,
    }));
  };

  const processedRows = useMemo(() => {
    let result = [...rows];

    // 1. Main search (global filter across key fields)
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((row) => {
        const idStr = String(row.id ?? "").toLowerCase();
        const nameStr = (row.name ?? "").toLowerCase();
        const ownerStr = (row.owner_name ?? "").toLowerCase();
        const createdStr = row.created_at ? formatDateTime(row.created_at).toLowerCase() : "";
        const lastOpenedStr = row.last_opened_at ? formatDate(row.last_opened_at).toLowerCase() : "";
        return (
          idStr.includes(term) ||
          nameStr.includes(term) ||
          ownerStr.includes(term) ||
          createdStr.includes(term) ||
          lastOpenedStr.includes(term)
        );
      });
    }

    // 2. Per-column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter((row) => {
          let cellValue = getColumnValue(row, key);
          // For display formatted values in search, we might want to check formatted value too
          if (key === 'created_at') cellValue = formatDateTime(cellValue as string);
          if (key === 'last_opened_at') cellValue = formatDate(cellValue as string);
          
          return String(cellValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    // 3. Sort
    const activeSortColumn = Object.keys(columnSorts).find((key) => columnSorts[key] !== null);
    if (activeSortColumn) {
      const direction = columnSorts[activeSortColumn];
      result.sort((a, b) => {
        let aValue = getColumnValue(a, activeSortColumn);
        let bValue = getColumnValue(b, activeSortColumn);

        // Handle nulls
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue === bValue) return 0;

        // Handle numbers
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === "asc" ? aValue - bValue : bValue - aValue;
        }

        // Handle strings
        const aString = String(aValue).toLowerCase();
        const bString = String(bValue).toLowerCase();

        if (direction === "asc") {
          return aString.localeCompare(bString);
        } else {
          return bString.localeCompare(aString);
        }
      });
    }

    return result;
  }, [rows, columnSorts, columnFilters, searchTerm]);

  // Load pinned state from localStorage
  useEffect(() => {
    const pinned = localStorage.getItem('tearsheetsPinned');
    if (pinned === 'true') {
      setIsPinned(true);
    }
  }, []);

  useEffect(() => {
    const syncPinned = () => {
      const next = new Set<string>();
      rows.forEach((r) => {
        const key = buildPinnedKey("tearsheet", r.id);
        if (isPinnedRecord(key)) next.add(key);
      });
      setPinnedKeySet(next);
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [rows]);

  const handleTogglePinnedTearsheet = (r: TearsheetRow) => {
    const key = buildPinnedKey("tearsheet", r.id);
    const label = r.name || `TE ${r.id}`;
    const url = `/dashboard/tearsheets?id=${r.id}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      toast.info("Maximum 10 pinned records reached");
    }
  };

  const fetchTearsheets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tearsheets", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch tearsheets");
      }
      setRows(data.tearsheets || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch tearsheets");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Track last opened date when viewing tearsheet
  const trackTearsheetView = async (tearsheetId: number) => {
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const response = await fetch(`/api/tearsheets/${tearsheetId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // Refresh tearsheets to update last_opened_at in the UI
        fetchTearsheets();
      }
    } catch (err) {
      console.error('Error tracking tearsheet view:', err);
      // Don't throw - tracking failure shouldn't block user action
    }
  };

  // Close modal and clear URL param
  const handleCloseModal = () => {
    setSelectedTearsheet(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    router.push(`/dashboard/tearsheets?${params.toString()}`);
  };

  // Handle tearsheet name click - show all affiliated records
  const handleTearsheetNameClick = async (tearsheet: TearsheetRow) => {
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", tearsheet.id.toString());
    router.push(`/dashboard/tearsheets?${params.toString()}`);

    setIsLoadingRecords(true);
    setSelectedTearsheet({ id: tearsheet.id, name: tearsheet.name, records: [] });
    
    // Track view
    await trackTearsheetView(tearsheet.id);

    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const allRecords: RecordItem[] = [];

      // Fetch all record types in parallel
      const types = ['job_seekers', 'hiring_managers', 'jobs', 'leads'];
      const promises = types.map(async (type) => {
        try {
          const res = await fetch(`/api/tearsheets/${tearsheet.id}/records?type=${type}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await res.json();
          if (res.ok && data.records) {
            return data.records.map((record: any) => ({
              ...record,
              type,
            }));
          }
          return [];
        } catch (err) {
          console.error(`Error fetching ${type}:`, err);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach((records) => {
        allRecords.push(...records);
      });

      setSelectedTearsheet({
        id: tearsheet.id,
        name: tearsheet.name,
        records: allRecords,
      });
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const handleCountClick = async (tearsheetId: number, tearsheetName: string, type: string, count: number) => {
    if (count === 0) return;

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", tearsheetId.toString());
    router.push(`/dashboard/tearsheets?${params.toString()}`);

    setIsLoadingRecords(true);
    // Track view when clicking count buttons
    await trackTearsheetView(tearsheetId);
    
    try {
      const res = await fetch(`/api/tearsheets/${tearsheetId}/records?type=${type}`);
      const data = await res.json();

      if (res.ok) {
        setSelectedTearsheet({
          id: tearsheetId,
          name: tearsheetName,
          records: (data.records || []).map((r: any) => ({ ...r, type })),
        });
      } else {
        console.error('Failed to fetch records:', data.message);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'job_seekers': 'Job Seekers',
      'hiring_managers': 'Hiring Managers',
      'jobs': 'Job Orders',
      'leads': 'Leads'
    };
    return labels[type] || type;
  };

  const handleLinkedOrgsClick = async (tearsheetId: number, tearsheetName: string, _count: number) => {
    if (_count === 0) return;
    setLinkedOrgsModal({ tearsheetId, tearsheetName, organizations: [] });
    setIsLoadingLinkedOrgs(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const res = await fetch(`/api/tearsheets/${tearsheetId}/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let data: { success?: boolean; organizations?: { id: number; name: string }[] } = {};
      try {
        data = await res.json();
      } catch {
        // non-JSON response (e.g. HTML error page)
      }
      if (res.ok && Array.isArray(data.organizations)) {
        setLinkedOrgsModal({ tearsheetId, tearsheetName, organizations: data.organizations });
      } else {
        // Show error message if organizations array is empty but count was > 0
        if (_count > 0 && (!data.organizations || data.organizations.length === 0)) {
          console.error("Organizations count mismatch:", { _count, organizations: data.organizations });
        }
        setLinkedOrgsModal((prev) => prev ? { ...prev, organizations: [] } : null);
      }
    } catch (err) {
      setLinkedOrgsModal((prev) => prev ? { ...prev, organizations: [] } : null);
    } finally {
      setIsLoadingLinkedOrgs(false);
    }
  };

  const handleLinkedPlacementsClick = async (tearsheetId: number, tearsheetName: string, _count: number) => {
    if (_count === 0) return;
    setLinkedPlacementsModal({ tearsheetId, tearsheetName, placements: [] });
    setIsLoadingLinkedPlacements(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const res = await fetch(`/api/tearsheets/${tearsheetId}/placements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let data: { placements?: any[] } = {};
      try {
        data = await res.json();
      } catch {
        // non-JSON response
      }
      if (res.ok && Array.isArray(data.placements)) {
        setLinkedPlacementsModal({ tearsheetId, tearsheetName, placements: data.placements });
      } else {
        setLinkedPlacementsModal((prev) => prev ? { ...prev, placements: [] } : null);
      }
    } catch {
      setLinkedPlacementsModal((prev) => prev ? { ...prev, placements: [] } : null);
    } finally {
      setIsLoadingLinkedPlacements(false);
    }
  };

  const handleSendInternally = () => {
    setShowSendModal(true);
    fetchInternalUsers();
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  // Fetch internal users for Send Internally
  const fetchInternalUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const response = await fetch("/api/users/active", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Filter to only internal system users
        const internal = (data.users || []).filter((user: any) => {
          return (
            user.user_type === "internal" ||
            user.role === "admin" ||
            user.role === "user" ||
            (!user.user_type && user.email)
          );
        });
        setInternalUsers(internal);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Send email to selected users
  const handleSendEmail = async () => {
    if (!selectedTearsheetForAction || selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    setIsSending(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const baseUrl = window.location.origin;
      const tearsheetUrl = `${baseUrl}/dashboard/tearsheets?id=${selectedTearsheetForAction.id}`;

      const response = await fetch(`/api/tearsheets/${selectedTearsheetForAction.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userIds: selectedUsers,
          tearsheetUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send email');
      }

      toast.success('Email sent successfully');
      setShowSendModal(false);
      setSelectedUsers([]);
      setSelectedTearsheetForAction(null);
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  // Delete tearsheet
  const handleDeleteTearsheet = async () => {
    if (!selectedTearsheetForAction) return;

    setIsDeleting(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const response = await fetch(`/api/tearsheets/${selectedTearsheetForAction.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete tearsheet');
      }

      toast.success('Tearsheet deleted successfully');
      setShowDeleteConfirm(false);
      setSelectedTearsheetForAction(null);
      fetchTearsheets();
    } catch (err) {
      console.error('Error deleting tearsheet:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete tearsheet');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle pin toggle
  const handlePinToggle = () => {
    const newPinnedState = !isPinned;
    setIsPinned(newPinnedState);
    localStorage.setItem('tearsheetsPinned', newPinnedState ? 'true' : 'false');
  };

  // Navigate to record
  const navigateToRecord = (record: RecordItem) => {
    if (record.type === 'job_seekers') {
      router.push(`/dashboard/job-seekers/view?id=${record.id}`);
    } else if (record.type === 'hiring_managers') {
      router.push(`/dashboard/hiring-managers/view?id=${record.id}`);
    } else if (record.type === 'jobs') {
      router.push(`/dashboard/jobs/view?id=${record.id}`);
    } else if (record.type === 'leads') {
      router.push(`/dashboard/leads/view?id=${record.id}`);
    }
  };

  useEffect(() => {
    fetchTearsheets();
  }, []);

  // Handle URL search params to open tearsheet
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && rows.length > 0) {
      const id = parseInt(idParam);
      // Avoid re-opening if already open
      if (selectedTearsheet?.id === id) return;

      const tearsheet = rows.find((r) => r.id === id);
      if (tearsheet) {
        handleTearsheetNameClick(tearsheet);
      }
    }
  }, [searchParams, rows]);

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <PanelWithHeader title="Tearsheets">
        <div className="bg-white rounded-lg shadow">
          {/* Header - match other overviews: count on left, actions on right */}
          <div className="p-4 border-b border-gray-200 space-y-3 md:space-y-0 md:flex md:justify-between md:items-center no-print">
            <div className="text-sm text-gray-600">
              {isLoading ? "Loading..." : `${rows.length} tearsheet(s)`}
            </div>
            <div className="flex items-center space-x-4">
              {(searchTerm || Object.keys(columnFilters).length > 0 || Object.keys(columnSorts).length > 0) && (
                <button
                  onClick={handleClearAllFilters}
                  className="px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors flex items-center gap-1"
                >
                  <FiX size={14} />
                  Clear
                </button>
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
                        Save Current View
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

              <button
                type="button"
                onClick={() => setShowColumnModal(true)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
              >
                Columns
              </button>
              <button
                type="button"
                onClick={fetchTearsheets}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
              >
                Refresh
              </button>
              <button
                onClick={handlePrint}
                className="p-2 text-gray-600 hover:text-gray-800"
                title="Print"
              >
                <FiPrinter size={20} />
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 text-sm text-red-600 border-b border-gray-200">
              {error}
            </div>
          )}

          {/* Main Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search tearsheets..."
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

              {(searchTerm || Object.keys(columnFilters).length > 0 || Object.keys(columnSorts).length > 0) && (
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

          <div className="overflow-x-auto">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-r border-gray-200"
                    >
                      Actions
                    </th>
                    <SortableContext items={columnFields} strategy={horizontalListSortingStrategy}>
                      {columnFields.map((columnKey) => (
                        <SortableColumnHeader
                          key={columnKey}
                          id={columnKey}
                          columnKey={columnKey}
                          label={getColumnLabel(columnKey)}
                          sortState={columnSorts[columnKey] || null}
                          filterValue={columnFilters[columnKey] || null}
                          onSort={() => handleColumnSort(columnKey)}
                          onFilterChange={(val) => handleColumnFilter(columnKey, val)}
                          filterType={getColumnFilterType(columnKey)}
                        />
                      ))}
                    </SortableContext>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={columnFields.length + 1} className="px-6 py-6 text-sm text-gray-500 text-center">
                        Loading tearsheets...
                      </td>
                    </tr>
                  ) : processedRows.length > 0 ? (
                    processedRows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <button
                              type="button"
                              onClick={() => handleTogglePinnedTearsheet(r)}
                              className={`mr-2 p-1 hover:bg-gray-200 rounded ${pinnedKeySet.has(buildPinnedKey("tearsheet", r.id)) ? "text-yellow-600" : "text-gray-600"}`}
                              aria-label={pinnedKeySet.has(buildPinnedKey("tearsheet", r.id)) ? "Unpin" : "Pin"}
                              title={pinnedKeySet.has(buildPinnedKey("tearsheet", r.id)) ? "Unpin" : "Pin"}
                            >
                              <BsFillPinAngleFill size={16} />
                            </button>
                            <ActionDropdown
                              label="Actions"
                              options={[
                                {
                                  label: 'Send Internally',
                                  action: () => {
                                    setSelectedTearsheetForAction(r);
                                    handleSendInternally();
                                  },
                                },
                                {
                                  label: 'Delete',
                                  action: () => {
                                    setSelectedTearsheetForAction(r);
                                    handleDeleteClick();
                                  },
                                },
                              ]}
                              buttonClassName="px-3 py-1 bg-gray-100 border border-gray-300 rounded flex items-center text-gray-600 hover:bg-gray-200 whitespace-nowrap"
                              menuClassName="absolute z-100 mt-1 w-56 bg-white border border-gray-300 shadow-lg text-black rounded z-50"
                            />
                          </div>
                        </td>
                        {columnFields.map((columnKey) => (
                          <td key={`${r.id}-${columnKey}`} className="px-6 py-3 text-sm text-gray-900">
                            {renderCell(r, columnKey)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columnFields.length + 1} className="px-6 py-10 text-sm text-gray-500 text-center">
                        No tearsheets found.
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
                  <span className="font-medium">{processedRows.length}</span>{" "}
                  of{" "}
                  <span className="font-medium">{processedRows.length}</span>{" "}
                  results
                </p>
              </div>
              {processedRows.length > 0 && (
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
        </div>

        {/* Column Customization Modal - match other overviews (Available Columns + Column Order) */}
        {showColumnModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Customize Columns</h2>
                <button
                  onClick={() => setShowColumnModal(false)}
                  className="p-1 rounded hover:bg-gray-200"
                >
                  <span className="text-2xl font-bold">×</span>
                </button>
              </div>

              <div className="p-6 grid grid-cols-2 gap-6">
                {/* Available Columns */}
                <div>
                  <h3 className="font-medium mb-3">Available Columns</h3>
                  <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                    {columnsCatalog.map((c) => {
                      const checked = columnFields.includes(c.key);
                      return (
                        <label
                          key={c.key}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setColumnFields((prev) => {
                                if (prev.includes(c.key))
                                  return prev.filter((x) => x !== c.key);
                                return [...prev, c.key];
                              });
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-800">{c.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Column Order */}
                <div>
                  <h3 className="font-medium mb-3">Column Order</h3>
                  <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                    {columnFields.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">
                        No columns selected
                      </div>
                    ) : (
                      columnFields.map((key, idx) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="text-sm font-medium">
                            {getColumnLabel(key)}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                              disabled={idx === 0}
                              onClick={() => {
                                setColumnFields((prev) => {
                                  const copy = [...prev];
                                  [copy[idx - 1], copy[idx]] = [
                                    copy[idx],
                                    copy[idx - 1],
                                  ];
                                  return copy;
                                });
                              }}
                            >
                              ↑
                            </button>

                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                              disabled={idx === columnFields.length - 1}
                              onClick={() => {
                                setColumnFields((prev) => {
                                  const copy = [...prev];
                                  [copy[idx], copy[idx + 1]] = [
                                    copy[idx + 1],
                                    copy[idx],
                                  ];
                                  return copy;
                                });
                              }}
                            >
                              ↓
                            </button>

                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-red-50 text-red-600 disabled:opacity-40"
                              disabled={columnFields.length <= 1}
                              onClick={() =>
                                setColumnFields((prev) =>
                                  prev.filter((x) => x !== key)
                                )
                              }
                              title="Remove"
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
                      onClick={() => setColumnFields([...TEARSHEET_DEFAULT_COLUMNS])}
                    >
                      Reset
                    </button>

                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSavingColumns}
                      onClick={async () => {
                        const success = await saveColumnConfig();
                        if (success) {
                          setShowColumnModal(false);
                        }
                      }}
                    >
                      {isSavingColumns ? "Saving..." : "Done"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tearsheet Records Modal - Shows all affiliated records */}
        {selectedTearsheet && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      All Records in "{selectedTearsheet.name}"
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedTearsheet.records.length} record(s)
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        handleTogglePinnedTearsheet({
                          id: selectedTearsheet.id,
                          name: selectedTearsheet.name,
                        } as any)
                      }
                      className={`p-1 hover:bg-gray-200 rounded ${
                        pinnedKeySet.has(
                          buildPinnedKey("tearsheet", selectedTearsheet.id)
                        )
                          ? "text-yellow-600"
                          : "text-gray-600"
                      }`}
                      aria-label={
                        pinnedKeySet.has(
                          buildPinnedKey("tearsheet", selectedTearsheet.id)
                        )
                          ? "Unpin"
                          : "Pin"
                      }
                      title={
                        pinnedKeySet.has(
                          buildPinnedKey("tearsheet", selectedTearsheet.id)
                        )
                          ? "Unpin"
                          : "Pin"
                      }
                    >
                      <BsFillPinAngleFill size={20} />
                    </button>
                    <button
                      onClick={handleCloseModal}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <FiX size={24} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Body - Table of Records */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingRecords ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading records...
                  </div>
                ) : selectedTearsheet.records.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedTearsheet.records.map((record, index) => (
                        <tr
                          key={`${record.type}-${record.id}-${index}`}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigateToRecord(record)}
                        >
                          <td className="px-4 py-3 text-sm text-gray-600">{getTypeLabel(record.type)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.email || "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.organization || record.organization_name || record.organization_id || "-"}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No records found
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Linked Organizations Modal */}
        {linkedOrgsModal && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Linked Organizations in &quot;{linkedOrgsModal.tearsheetName}&quot;
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {linkedOrgsModal.organizations.length} organization(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setLinkedOrgsModal(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <FiX size={24} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingLinkedOrgs ? (
                  <div className="text-center py-8 text-gray-500">Loading organizations...</div>
                ) : linkedOrgsModal.organizations.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {linkedOrgsModal.organizations.map((org) => (
                        <tr
                          key={org.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/dashboard/organizations/view?id=${org.id}`)}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-blue-600 hover:text-blue-800 underline">
                            {org.name || `Organization ${org.id}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-500">No linked organizations</div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => setLinkedOrgsModal(null)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Linked Placements Modal */}
        {linkedPlacementsModal && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Linked Placements in &quot;{linkedPlacementsModal.tearsheetName}&quot;
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {linkedPlacementsModal.placements.length} placement(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setLinkedPlacementsModal(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <FiX size={24} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingLinkedPlacements ? (
                  <div className="text-center py-8 text-gray-500">Loading placements...</div>
                ) : linkedPlacementsModal.placements.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Seeker</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {linkedPlacementsModal.placements.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/dashboard/placements/view?id=${p.id}`)}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {[p.js_first_name, p.js_last_name].filter(Boolean).join(" ") || p.job_seeker_id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.job_title || p.job_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.organization_name || "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.status || "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {p.start_date ? formatDate(p.start_date) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-500">No linked placements</div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => setLinkedPlacementsModal(null)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Send Internally Modal */}
        {showSendModal && selectedTearsheetForAction && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Send Tearsheet Internally
                  </h3>
                  <button
                    onClick={() => {
                      setShowSendModal(false);
                      setSelectedUsers([]);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <FiX size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Internal Users
                  </label>
                  {isLoadingUsers ? (
                    <div className="text-sm text-gray-500">Loading users...</div>
                  ) : (
                    <div className="border border-gray-300 rounded max-h-64 overflow-y-auto p-2">
                      {internalUsers.length === 0 ? (
                        <div className="text-sm text-gray-500">No internal users available</div>
                      ) : (
                        internalUsers.map((user) => (
                          <label
                            key={user.id}
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers([...selectedUsers, user.id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">
                              {user.name || user.email}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowSendModal(false);
                    setSelectedUsers([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  disabled={isSending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSending || selectedUsers.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && selectedTearsheetForAction && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Tearsheet
                </h3>
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">
                  Are you sure you want to delete the tearsheet "{selectedTearsheetForAction.name}"?
                </p>
                <p className="text-xs text-gray-500">
                  This will only delete the tearsheet record. Affiliated records (Job Seekers, Hiring Managers, Jobs, Leads) will not be affected.
                </p>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedTearsheetForAction(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTearsheet}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Save Favorite Modal */}
        {showSaveFavoriteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
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
                    placeholder="e.g. My Tearsheets"
                    className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      favoriteNameError ? "border-red-300 bg-red-50" : "border-gray-300"
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
      </PanelWithHeader>
    </>
  );
};

export default TearsheetsPage;
