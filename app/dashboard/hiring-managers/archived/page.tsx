'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LoadingScreen from '@/components/LoadingScreen';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import CountdownTimer from "@/components/CountdownTimer";
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
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import AdvancedSearchPanel, {
  type AdvancedSearchCriterion,
} from "@/components/AdvancedSearchPanel";
import { matchesAdvancedValue } from "@/lib/advancedSearch";

interface HiringManager {
  id: string;
  record_number?: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  title: string;
  organization_id?: string | number | null;
  organization_name?: string | null;
  organization_name_from_org?: string | null;
  status: string;
  created_at: string;
  created_by_name: string;
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
  archived_at?: string | null;
  archive_reason?: string | null;
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

type HiringManagerFavorite = {
  id: string;
  name: string;
  searchTerm: string;
  columnFilters: Record<string, ColumnFilterState>;
  columnSorts: Record<string, ColumnSortState>;
  columnFields: string[];
  advancedSearchCriteria?: AdvancedSearchCriterion[];
  createdAt: number;
};

const FAVORITES_STORAGE_KEY = "hiringManagersArchivedFavorites";

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

export default function ArchivedHiringManagersList() {
  const router = useRouter();
  const [selectedHiringManagers, setSelectedHiringManagers] = useState<
    string[]
  >([]);
  const [selectAll, setSelectAll] = useState(false);
  const [hiringManagers, setHiringManagers] = useState<HiringManager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);

  // Favorites State
  const [favorites, setFavorites] = useState<HiringManagerFavorite[]>([]);
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
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
        }
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  // Favorites Logic
  const persistFavorites = (updated: HiringManagerFavorite[]) => {
    setFavorites(updated);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  };

  const applyFavorite = (fav: HiringManagerFavorite) => {
    // 1. Validate columns against current catalog
    const catalogKeys = new Set(hmColumnsCatalog.map((c) => c.key));
    const validColumnFields = (fav.columnFields || []).filter((k) =>
      catalogKeys.has(k)
    );

    // 2. Restore filters (only valid ones)
    const nextFilters: Record<string, ColumnFilterState> = {};
    for (const [k, v] of Object.entries(fav.columnFilters || {})) {
      if (!catalogKeys.has(k)) continue;
      if (!v || !v.trim()) continue;
      nextFilters[k] = v;
    }

    // 3. Restore sorts (only valid ones)
    const nextSorts: Record<string, ColumnSortState> = {};
    for (const [k, v] of Object.entries(fav.columnSorts || {})) {
      if (!catalogKeys.has(k)) continue;
      if (v !== "asc" && v !== "desc") continue;
      nextSorts[k] = v;
    }

    // 4. Apply everything
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

    const newFav: HiringManagerFavorite = {
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

  const HM_BACKEND_COLUMN_KEYS = [
    "full_name",
    "status",
    "archive_reason",
    "title",
    "organization_name",
    "email",
    "phone",
    "created_by_name",
    "created_at",
  ];
  // =====================
  // AVAILABLE FIELDS (from Modify Page)
  // =====================
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  const normalizeFields = (payload: any) => {
    const root =
      payload?.customFields ?? // ✅ same as view file
      payload?.fields ??
      payload?.data?.fields ??
      payload?.data?.data?.fields ??
      payload?.hiringManagerFields ??
      payload?.data ??
      payload?.data?.data ??
      [];

    const list: any[] = Array.isArray(root) ? root : [];

    const flat = list.flatMap((x: any) => {
      if (!x) return [];
      if (Array.isArray(x.fields)) return x.fields;
      if (Array.isArray(x.children)) return x.children;
      return [x];
    });

    return flat.filter(Boolean);
  };

  useEffect(() => {
    const fetchAvailableFields = async () => {
      setIsLoadingFields(true);
      try {
        const token = document.cookie
          .split("; ")
          .find((r) => r.startsWith("token="))
          ?.split("=")[1];

        const res = await fetch("/api/admin/field-management/hiring-managers", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        });

        const raw = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(raw);
        } catch { }

        const fields =
          data.customFields ||
          data.fields ||
          data.data?.fields ||
          data.hiringManagerFields ||
          data.data ||
          [];

        console.log("LIST field-management status:", res.status);
        console.log("LIST fields count:", fields.length);
        console.log("LIST fields sample:", fields.slice(0, 5));

        setAvailableFields(fields);
      } catch (e) {
        console.error("LIST field-management error:", e);
        setAvailableFields([]);
      } finally {
        setIsLoadingFields(false);
      }
    };

    fetchAvailableFields();
  }, []);

  const humanize = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const hmColumnsCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const name = String((f as any)?.field_name ?? (f as any)?.fieldName ?? "").trim();
        const fieldType = (f as any)?.field_type;
        const lookupType = (f as any)?.lookup_type || "";
        const label = (f as any)?.field_label ?? (f as any)?.fieldLabel ?? (name ? humanize(name) : "");
        const isBackendCol = name && HM_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        if (name === "status" || name === "archive_reason") filterType = "select";
        return {
          fieldType,
          lookupType,
          multiSelectLookupType: (f as any)?.multi_select_lookup_type ?? (f as any)?.multiSelectLookupType ?? "",
          key: isBackendCol ? name : `custom:${label || name}`,
          label: String(label || name),
          sortable: isBackendCol,
          filterType,
        };
      });

      // console.log("availableFields", availableFields);

    // console.log("fromApi", fromApi);

    // const customKeySet = new Set<string>();
    // (hiringManagers || []).forEach((hm: any) => {
    //   const cf = hm?.customFields || hm?.custom_fields || {};
    //   Object.keys(cf).forEach((k) => customKeySet.add(k));
    // });
    // const alreadyHaveCustom = new Set(
    //   fromApi.filter((c) => c.key.startsWith("custom:")).map((c) => c.key.replace("custom:", ""))
    // );
    // const fromList = Array.from(customKeySet)
    //   .filter((k) => !alreadyHaveCustom.has(k))
    //   .map((k) => ({
    //     key: `custom:${k}`,
    //     label: humanize(k),
    //     sortable: false,
    //     filterType: "text" as const,
    //   }));

    const merged = [...fromApi];
    if (!merged.some((x) => x.key === "archive_reason")) {
      merged.push({
        fieldType: undefined,
        lookupType: "",
        multiSelectLookupType: "",
        key: "archive_reason",
        label: "Archive Reason",
        sortable: true,
        filterType: "select",
      });
    }
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [availableFields, hiringManagers]);
  const getColumnLabel = (key: string) =>
    hmColumnsCatalog.find((c) => c.key === key)?.label ?? key;

  const getColumnInfo = (key: string) =>
    hmColumnsCatalog.find((c) => c.key === key);

  const getColumnValue = (hm: any, key: string) => {
    // ✅ custom
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = hm?.customFields || hm?.custom_fields || {};
      const val = cf?.[rawKey];
      return val === undefined || val === null || val === "" ? "—" : String(val);
    }

    if (key === "archive_reason") {
      return hm.archive_reason || "N/A";
    }
    // Standard backend keys (fallback from API shape)
    const val = hm[key];
    if (val === undefined || val === null || val === "") return "—";
    if (key === "created_at" && typeof val === "string") return formatDate(val);
    return String(val);

    // ✅ standard (commented original)
    // switch (key) {
    //   case "full_name":
    //     return hm.full_name || `${hm.last_name}, ${hm.first_name}`;
    //   case "status":
    //     return hm.status || "—";
    //   case "title":
    //     return hm.title || "—";
    //   case "organization_name": {
    //     const orgId = hm.organization_id != null && hm.organization_id !== "" ? String(hm.organization_id) : null;
    //     const orgName = hm.organization_name_from_org || hm.organization_name || null;
    //     console.log("organization_name", orgId, orgName);
    //     if (orgId && orgName) return `${orgId} - ${orgName}`;
    //     if (orgName) return orgName;
    //     if (orgId) return orgId;
    //     return "—";
    //   }
    //   case "email":
    //     return hm.email || "—";
    //   case "phone":
    //     return hm.phone || "—";
    //   case "created_by_name":
    //     return hm.created_by_name || "—";
    //   case "created_at":
    //     return formatDate(hm.created_at);
    //   default:
    //     return "—";
    // }
  };

  // Fetch hiring managers data when component mounts
  useEffect(() => {
    fetchHiringManagers();
  }, []);
  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "HIRING_MANAGER",
    configType: "columns",
    defaultFields: [],
  });

  useEffect(() => {
    const catalogKeys = hmColumnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);
    const savedOrder = localStorage.getItem("hiringManagerArchivedColumnOrder");
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
  }, [hmColumnsCatalog]);

  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (columnFields.length > 0) {
      localStorage.setItem("hiringManagerArchivedColumnOrder", JSON.stringify(columnFields));
    }
  }, [columnFields]);

  const fetchHiringManagers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/hiring-managers", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch hiring managers");
      }

      const data = await response.json();
      console.log("Hiring managers data:", data);
      setHiringManagers(data.hiringManagers || []);
    } catch (err) {
      console.error("Error fetching hiring managers:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching hiring managers"
      );
    } finally {
      setIsLoading(false);
    }
  };

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

  // Get unique status values for filter dropdown
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    hiringManagers.forEach((hm) => {
      if (hm.status) statuses.add(hm.status);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [hiringManagers]);

  const archiveReasonOptions = useMemo(
    () => [
      { label: "Deletion", value: "Deletion" },
      { label: "Transfer", value: "Transfer" },
    ],
    []
  );

  // Apply per-column filtering and sorting (only archived records)
  const filteredAndSortedHiringManagers = useMemo(() => {
    let result = hiringManagers.filter(
      (hm) => hm.status === "Archived" || !!hm.archived_at
    );

    const matchesAdvancedCriterion = (
      hm: HiringManager,
      c: AdvancedSearchCriterion
    ): boolean => {
      const raw = getColumnValue(hm, c.fieldKey);
      const colInfo = getColumnInfo(c.fieldKey);
      const fieldType = (colInfo as any)?.fieldType ?? "";
      return matchesAdvancedValue(raw, fieldType, c);
    };

    if (advancedSearchCriteria.length > 0) {
      result = result.filter((hm) =>
        advancedSearchCriteria.every((c) => matchesAdvancedCriterion(hm, c))
      );
    }

    // Apply filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((hm) => {
        const value = getColumnValue(hm, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        // For number columns, do exact match
        const columnInfo = getColumnInfo(columnKey);
        if (columnInfo && (columnInfo as any).filterType === "number") {
          return String(value) === String(filterValue);
        }

        // For text columns, do contains match
        return valueStr.includes(filterStr);
      });
    });

    // Apply global search
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((hm) =>
        (hm.full_name || `${hm.last_name || ""} ${hm.first_name || ""}` || "")
          .toLowerCase()
          .includes(term) ||
        String(hm.id || "").toLowerCase().includes(term) ||
        String(hm.record_number ?? "").toLowerCase().includes(term) ||
        (hm.email || "").toLowerCase().includes(term) ||
        (hm.title || "").toLowerCase().includes(term) ||
        (hm.organization_name || "").toLowerCase().includes(term) ||
        (hm.organization_name_from_org || "").toLowerCase().includes(term) ||
        String(hm.organization_id ?? "").toLowerCase().includes(term) ||
        (hm.archive_reason || "").toLowerCase().includes(term)
      );
    }

    // Apply sorting (multiple columns supported, but we'll use the first active sort)
    const activeSorts = Object.entries(columnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
      // Sort by the first active sort column
      const [sortKey, sortDir] = activeSorts[0];
      result.sort((a, b) => {
        const aValue = getColumnValue(a, sortKey);
        const bValue = getColumnValue(b, sortKey);

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
  }, [hiringManagers, columnFilters, columnSorts, searchTerm, advancedSearchCriteria]);

  const handleViewHiringManager = (id: string) => {
    router.push(`/dashboard/hiring-managers/view?id=${id}`);
  };

  const handleBackToHiringManagers = () => {
    router.push("/dashboard/hiring-managers");
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedHiringManagers([]);
    } else {
      setSelectedHiringManagers(filteredAndSortedHiringManagers.map((hm) => hm.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectHiringManager = (id: string, e: React.MouseEvent) => {

    if (selectedHiringManagers.includes(id)) {
      setSelectedHiringManagers(
        selectedHiringManagers.filter((hmId) => hmId !== id)
      );
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedHiringManagers([...selectedHiringManagers, id]);
      // If all hiring managers are now selected, update selectAll state
      if (
        [...selectedHiringManagers, id].length === filteredAndSortedHiringManagers.length
      ) {
        setSelectAll(true);
      }
    }
  };

  const deleteSelectedHiringManagers = async () => {
    if (selectedHiringManagers.length === 0) return;

    const confirmMessage =
      selectedHiringManagers.length === 1
        ? "Are you sure you want to delete this hiring manager?"
        : `Are you sure you want to delete these ${selectedHiringManagers.length} hiring managers?`;

    if (!window.confirm(confirmMessage)) return;

    setIsLoading(true);

    try {
      // Create promises for all delete operations
      const deletePromises = selectedHiringManagers.map((id) =>
        fetch(`/api/hiring-managers/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        })
      );

      // Execute all delete operations
      const results = await Promise.allSettled(deletePromises);

      // Check for failures
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} hiring managers`);
      }

      // Refresh hiring managers after successful deletion
      await fetchHiringManagers();

      // Clear selection after deletion
      setSelectedHiringManagers([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting hiring managers:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting hiring managers"
      );
    } finally {
      setIsLoading(false);
    }
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      case "on leave":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading archived hiring managers..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - responsive: mobile = title+add row, then full-width Favorites, Columns */}
      <div className="p-4 border-b border-gray-200 space-y-3 md:space-y-0 md:flex md:justify-between md:items-center">
        <div className="flex justify-between items-center gap-4">
          <h1 className="text-xl font-bold">Archived Hiring Managers</h1>
          <button onClick={handleBackToHiringManagers} className="md:hidden px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center shrink-0 bg-white">
            Back to Hiring Managers
          </button>
        </div>

        <div className="hidden md:flex space-x-4">
          {selectedHiringManagers.length > 0 && (
            <button onClick={deleteSelectedHiringManagers} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              Delete Selected ({selectedHiringManagers.length})
            </button>
          )}
          <div className="relative">
            <button onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 bg-white">
              <FiStar className={selectedFavoriteId ? "text-yellow-400 fill-current" : "text-gray-400"} />
              <span className="max-w-[100px] truncate">{selectedFavoriteId ? favorites.find((f) => f.id === selectedFavoriteId)?.name || "Favorites" : "Favorites"}</span>
              <FiChevronDown />
            </button>
            {favoritesMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <button onClick={handleOpenSaveFavoriteModal} className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium flex items-center gap-2"><FiStar className="text-blue-500" /> Save Current Search</button>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {favorites.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No saved favorites yet</p> : favorites.map((fav) => (
                    <div key={fav.id} className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${selectedFavoriteId === fav.id ? "bg-blue-50" : ""}`} onClick={() => applyFavorite(fav)}>
                      <span className="text-sm text-gray-700 truncate flex-1">{fav.name}</span>
                      <button onClick={(e) => handleDeleteFavorite(fav.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Delete favorite"><FiX size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setShowColumnModal(true)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center">Columns</button>
          <button onClick={handleBackToHiringManagers} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center">
            Back to Hiring Managers
          </button>
        </div>

        {selectedHiringManagers.length > 0 && (
          <div className="w-full md:hidden">
            <button onClick={deleteSelectedHiringManagers} className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-2">Delete Selected ({selectedHiringManagers.length})</button>
          </div>
        )}
        <div className="w-full md:hidden">
          <div className="relative">
            <button onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)} className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-between gap-2 bg-white">
              <span className="flex items-center gap-2"><FiStar className={selectedFavoriteId ? "text-yellow-400 fill-current" : "text-gray-400"} /><span className="truncate">{selectedFavoriteId ? favorites.find((f) => f.id === selectedFavoriteId)?.name || "Favorites" : "Favorites"}</span></span>
              <FiChevronDown className="shrink-0" />
            </button>
            {favoritesMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <button onClick={handleOpenSaveFavoriteModal} className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium flex items-center gap-2"><FiStar className="text-blue-500" /> Save Current Search</button>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {favorites.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No saved favorites yet</p> : favorites.map((fav) => (
                    <div key={fav.id} className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${selectedFavoriteId === fav.id ? "bg-blue-50" : ""}`} onClick={() => applyFavorite(fav)}>
                      <span className="text-sm text-gray-700 truncate flex-1">{fav.name}</span>
                      <button onClick={(e) => handleDeleteFavorite(fav.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Delete favorite"><FiX size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="w-full md:hidden">
          <button onClick={() => setShowColumnModal(true)} className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center">Columns</button>
        </div>
        <div className="w-full md:hidden">
          <button onClick={handleBackToHiringManagers} className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center">Back to Hiring Managers</button>
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search archived hiring managers..."
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
        fieldCatalog={hmColumnsCatalog.map((c) => ({
          key: c.key,
          label: c.label,
          fieldType: (c as any).fieldType,
          lookupType: (c as any).lookupType,
          multiSelectLookupType: (c as any).multiSelectLookupType,
          options: (c as any).options,
        }))}
        onSearch={(criteria) => setAdvancedSearchCriteria(criteria)}
        recentStorageKey="hiringManagersArchivedAdvancedSearchRecent"
        initialCriteria={advancedSearchCriteria}
        anchorEl={advancedSearchButtonRef.current}
      />

      {/* Hiring Managers Table */}
      <div className="overflow-x-auto">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* Fixed checkbox header */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </th>

                {/* Fixed Actions header */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>

                {/* Fixed ID header */}
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
                        filterType={(columnInfo as any).filterType || "text"}
                        filterOptions={
                          key === "status"
                            ? statusOptions
                            : key === "archive_reason"
                              ? archiveReasonOptions
                              : undefined
                        }
                      />
                    );
                  })}
                </SortableContext>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedHiringManagers.length > 0 ? (
                filteredAndSortedHiringManagers.map((hm) => (
                  <tr
                    key={hm.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewHiringManager(hm.id)}
                  >
                    {/* Fixed checkbox */}
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedHiringManagers.includes(hm.id)}
                        onChange={() => { }}
                        onClick={(e) => handleSelectHiringManager(hm.id, e)}
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
                          { label: "View", action: () => handleViewHiringManager(hm.id) },
                          {
                            label: "Delete",
                            action: async () => {
                              if (
                                !window.confirm(
                                  "Are you sure you want to delete this hiring manager?"
                                )
                              )
                                return;
                              setIsLoading(true);
                              try {
                                const token = document.cookie
                                  .split("; ")
                                  .find((row) => row.startsWith("token="))
                                  ?.split("=")[1];
                                const res = await fetch(
                                  `/api/hiring-managers/${hm.id}`,
                                  {
                                    method: "DELETE",
                                    headers: token
                                      ? { Authorization: `Bearer ${token}` }
                                      : undefined,
                                  }
                                );
                                if (!res.ok)
                                  throw new Error(
                                    "Failed to delete hiring manager"
                                  );
                                await fetchHiringManagers();
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Delete failed"
                                );
                              } finally {
                                setIsLoading(false);
                              }
                            },
                          },
                        ]}
                      />
                    </td>

                    {/* Fixed ID */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-900">HM {hm.record_number ?? hm.id}</span>
                        {hm.archived_at && (
                          <CountdownTimer archivedAt={hm.archived_at} />
                        )}
                      </div>
                    </td>

                    {/* Dynamic cells */}
                    {columnFields.map((key) => {
                        const colInfo = getColumnInfo(key) as { key: string; label: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
                        const fieldInfo = colInfo
                          ? { key: colInfo.key, label: colInfo.label, fieldType: colInfo.fieldType, lookupType: colInfo.lookupType, multiSelectLookupType: colInfo.multiSelectLookupType }
                          : { key, label: getColumnLabel(key) };
                        const isArchiveReason = getColumnLabel(key).toLowerCase() === "archive reason";
                        return (
                          <td
                            key={key}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            <FieldValueRenderer
                              value={getColumnValue(hm, key)}
                              fieldInfo={fieldInfo}
                              emptyPlaceholder="—"
                              clickable
                              stopPropagation
                              forceRenderAsStatus={isArchiveReason}
                              statusVariant={isArchiveReason && String(getColumnValue(hm, key) || "").toLowerCase() === "deletion" ? "deletion" : "blue"}
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
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                  >
                    {Object.keys(columnFilters).length > 0
                      ? "No archived hiring managers match your filters."
                      : searchTerm
                        ? "No archived hiring managers match your search."
                        : "No archived hiring managers found."}
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
              <span className="font-medium">{filteredAndSortedHiringManagers.length}</span>{" "}
              of{" "}
              <span className="font-medium">{filteredAndSortedHiringManagers.length}</span>{" "}
              results
            </p>
          </div>
          {filteredAndSortedHiringManagers.length > 0 && (
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
          description="Drag to reorder, check/uncheck to show or hide columns in the archived hiring manager list."
          order={[
            ...columnFields,
            ...hmColumnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
          ]}
          visible={Object.fromEntries(hmColumnsCatalog.map((c) => [c.key, columnFields.includes(c.key)]))}
          fieldCatalog={hmColumnsCatalog.map((c) => ({ key: c.key, label: c.label }))}
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
              ...hmColumnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
            ];
            const oldIndex = fullOrder.indexOf(active.id as string);
            const newIndex = fullOrder.indexOf(over.id as string);
            if (oldIndex === -1 || newIndex === -1) return;
            const newOrder = arrayMove(fullOrder, oldIndex, newIndex);
            setColumnFields(newOrder.filter((k) => columnFields.includes(k)));
          }}
          onSave={async () => {
            const ok = await saveColumnConfig();
            if (ok) setShowColumnModal(false);
          }}
          saveButtonText="Done"
          isSaveDisabled={!!isSavingColumns}
          onReset={() => setColumnFields(hmColumnsCatalog.map((c) => c.key))}
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
                  placeholder="e.g. Active Hiring Managers"
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
    </div>
  );
}
