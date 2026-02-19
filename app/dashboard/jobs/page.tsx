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
import BulkActionsButton from "@/components/BulkActionsButton";
import BulkOwnershipModal from "@/components/BulkOwnershipModal";
import BulkStatusModal from "@/components/BulkStatusModal";
import BulkTearsheetModal from "@/components/BulkTearsheetModal";
import BulkNoteModal from "@/components/BulkNoteModal";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import AdvancedSearchPanel, {
  type AdvancedSearchCriterion,
} from "@/components/AdvancedSearchPanel";
import { matchesAdvancedValue } from "@/lib/advancedSearch";

interface Job {
  id: string;
  record_number?: number;
  job_title: string;
  job_type: string;
  category: string;
  organization_name: string;
  worksite_location: string;
  status: string;
  created_at: string;
  employment_type: string;
  created_by_name: string;
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
  archived_at?: string | null;
  archive_reason?: string | null;
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

type JobsFavorite = {
  id: string;
  name: string;
  searchTerm: string;
  columnFilters: Record<string, ColumnFilterState>;
  columnSorts: Record<string, ColumnSortState>;
  columnFields: string[];
  advancedSearchCriteria?: AdvancedSearchCriterion[];
  createdAt: number;
};

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

export default function JobList() {
  const router = useRouter();

  const FAVORITES_STORAGE_KEY = "jobsFavorites";

  // =====================
  // TABLE COLUMNS (Overview List) – driven by admin field-management only
  // =====================
  const JOB_BACKEND_COLUMN_KEYS = [
    "job_title",
    "job_type",
    "category",
    "organization_name",
    "worksite_location",
    "status",
    "created_at",
    "created_by_name",
  ];

  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "JOB",
    defaultFields: [], // populated from columnsCatalog when ready
    configType: "columns",
  });

  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (columnFields.length > 0) {
      localStorage.setItem("jobsColumnOrder", JSON.stringify(columnFields));
    }
  }, [columnFields]);

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Individual row action modals state
  const [showOwnershipModal, setShowOwnershipModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTearsheetModal, setShowTearsheetModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<JobsFavorite[]>([]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string>("");
  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const favoritesMenuRef = useRef<HTMLDivElement>(null);
  const favoritesMenuMobileRef = useRef<HTMLDivElement>(null);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteNameError, setFavoriteNameError] = useState<string | null>(null);

  // =====================
  // AVAILABLE FIELDS (from Modify Page)
  // =====================
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  useEffect(() => {
    const fetchAvailableFields = async () => {
      setIsLoadingFields(true);
      try {
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );

        const res = await fetch("/api/admin/field-management/jobs", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        });

        const raw = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(raw);
        } catch {
          data = {};
        }

        const fields =
          data.fields ||
          data.data?.fields ||
          data.customFields ||
          data.data?.customFields ||
          data.jobFields ||
          data.data ||
          [];

        setAvailableFields(Array.isArray(fields) ? fields : []);
      } catch (e) {
        console.error("Error fetching available fields:", e);
        setAvailableFields([]);
      } finally {
        setIsLoadingFields(false);
      }
    };

    fetchAvailableFields();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavorites(parsed);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!favoritesMenuOpen) return;
      const target = e.target as Node;
      const inDesktop = favoritesMenuRef.current?.contains(target);
      const inMobile = favoritesMenuMobileRef.current?.contains(target);
      if (!inDesktop && !inMobile) setFavoritesMenuOpen(false);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [favoritesMenuOpen]);

  const applyFavorite = (fav: JobsFavorite) => {
    const catalogKeys = new Set(columnsCatalog.map((c) => c.key));
    const validColumnFields = (fav.columnFields || []).filter((k) => catalogKeys.has(k));

    const nextFilters: Record<string, ColumnFilterState> = {};
    for (const [k, v] of Object.entries(fav.columnFilters || {})) {
      if (!catalogKeys.has(k)) continue;
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      nextFilters[k] = v;
    }

    const nextSorts: Record<string, ColumnSortState> = {};
    for (const [k, v] of Object.entries(fav.columnSorts || {})) {
      if (!catalogKeys.has(k)) continue;
      if (v !== "asc" && v !== "desc" && v !== null) continue;
      if (v === null) continue;
      nextSorts[k] = v;
    }

    setSearchTerm(fav.searchTerm || "");
    setColumnFilters(nextFilters);
    setColumnSorts(nextSorts);
    if (validColumnFields.length > 0) setColumnFields(validColumnFields);
    setAdvancedSearchCriteria(fav.advancedSearchCriteria ?? []);
  };

  const persistFavorites = (next: JobsFavorite[]) => {
    setFavorites(next);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
  };

  const handleOpenSaveFavoriteModal = () => {
    setFavoriteName("");
    setFavoriteNameError(null);
    setShowSaveFavoriteModal(true);
  };

  const handleConfirmSaveFavorite = () => {
    const trimmed = favoriteName.trim();
    if (!trimmed) {
      setFavoriteNameError("Please enter a name.");
      return;
    }

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const next: JobsFavorite = {
      id,
      name: trimmed,
      searchTerm,
      columnFilters,
      columnSorts,
      columnFields,
      advancedSearchCriteria:
        advancedSearchCriteria.length > 0 ? advancedSearchCriteria : undefined,
      createdAt: Date.now(),
    };

    const updated = [next, ...favorites];
    persistFavorites(updated);
    setSelectedFavoriteId(next.id);
    setShowSaveFavoriteModal(false);
  };

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
    setColumnSorts({});
    setAdvancedSearchCriteria([]);
    setSelectedFavoriteId("");
  };

  // Fetch jobs data when component mounts
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/jobs", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }

      const data = await response.json();
      console.log("Jobs data:", data);
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching jobs"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Columns Catalog
  const humanize = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const columnsCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const name = String((f as any)?.field_name ?? (f as any)?.fieldName ?? "").trim();
        const label = (f as any)?.field_label ?? (f as any)?.fieldLabel ?? (name ? humanize(name) : "");
        const isBackendCol = name && JOB_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        if (name === "status") filterType = "select";
        return {
          key: isBackendCol ? name : `custom:${label || name}`,
          label: String(label || name),
          sortable: isBackendCol,
          filterType,
          fieldType: (f as any)?.field_type ?? (f as any)?.fieldType ?? "",
          lookupType: (f as any)?.lookup_type ?? (f as any)?.lookupType ?? "",
          multiSelectLookupType: (f as any)?.multiselect_lookup ?? (f as any)?.multiSelectLookupType ?? "",
        };
      });

    console.log("availableFields", availableFields);
    // console.log("fromApi", fromApi);

    const customKeySet = new Set<string>();
    (jobs || []).forEach((job: any) => {
      const cf = job?.customFields || job?.custom_fields || {};
      Object.keys(cf).forEach((k) => customKeySet.add(k));
    });
    const alreadyHaveCustom = new Set(
      fromApi.filter((c) => c.key.startsWith("custom:")).map((c) => c.key.replace("custom:", ""))
    );
    const fromData = Array.from(customKeySet)
      .filter((k) => !alreadyHaveCustom.has(k))
      .map((k) => ({
        key: `custom:${k}`,
        label: humanize(k),
        sortable: false,
        filterType: "text" as const,
      }));

    const merged = [...fromApi, ...fromData];
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [jobs, availableFields]);

  // When catalog is ready, default columnFields to all catalog keys if empty (or validate saved)
  useEffect(() => {
    const catalogKeys = columnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);
    const savedOrder = localStorage.getItem("jobsColumnOrder");
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
  }, [columnsCatalog]);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnInfo = (key: string) =>
    columnsCatalog.find((c) => c.key === key);

  const getColumnValue = (job: any, key: string) => {
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = job?.customFields || job?.custom_fields || {};
      const val = cf?.[rawKey];
      return val === undefined || val === null || val === ""
        ? "N/A"
        : String(val);
    }

    // switch (key) {
    //   case "job_title":
    //     return job.job_title || "N/A";
    //   case "job_type":
    //     return job.job_type || "N/A";
    //   case "category":
    //     return job.category || "N/A";
    //   case "organization_name":
    //     return job.organization_name || "N/A";
    //   case "worksite_location":
    //     return job.worksite_location || "N/A";
    //   case "status":
    //     return job.status || "N/A";
    //   case "created_at":
    //     return job.created_at ? new Date(job.created_at).toLocaleDateString() : "N/A";
    //   case "created_by_name":
    //     return job.created_by_name || "N/A";
    //   default:
    //     return "N/A";
    // }
  };

  // Get unique status values for filter dropdown
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    jobs.forEach((job) => {
      if (job.status) statuses.add(job.status);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [jobs]);

  const filteredAndSortedJobs = useMemo(() => {
    // Exclude archived jobs from main listing (same as Organization)
    let result = jobs.filter((job) => job.status !== "Archived" && !job.archived_at);

    const matchesAdvancedCriterion = (
      job: Job,
      c: AdvancedSearchCriterion
    ): boolean => {
      const raw = getColumnValue(job, c.fieldKey);
      const colInfo = getColumnInfo(c.fieldKey);
      const fieldType = (colInfo as any)?.fieldType ?? "";
      return matchesAdvancedValue(raw, fieldType, c);
    };

    if (advancedSearchCriteria.length > 0) {
      result = result.filter((job) =>
        advancedSearchCriteria.every((c) => matchesAdvancedCriterion(job, c))
      );
    }

    // Apply global search
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (job) =>
          (job.job_title || "").toLowerCase().includes(term) ||
          String(job.id || "").toLowerCase().includes(term) ||
          String(job.record_number ?? "").toLowerCase().includes(term) ||
          (job.job_type || "").toLowerCase().includes(term) ||
          (job.organization_name || "").toLowerCase().includes(term) ||
          (job.category || "").toLowerCase().includes(term) ||
          (job.status || "").toLowerCase().includes(term) ||
          (job.worksite_location || "").toLowerCase().includes(term)
      );
    }

    // Apply filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((job) => {
        const value = getColumnValue(job, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        // For number columns, do exact match
        const columnInfo = getColumnInfo(columnKey);
        if ((columnInfo?.filterType as string) === "number") {
          return String(value) === String(filterValue);
        }

        // For text columns, do contains match
        return valueStr.includes(filterStr);
      });
    });

    // Apply sorting
    const activeSorts = Object.entries(columnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
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
  }, [jobs, columnFilters, columnSorts, searchTerm, advancedSearchCriteria]);

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

  const handleViewJob = (id: string) => {
    router.push(`/dashboard/jobs/view?id=${id}`);
  };

  const handleAddJob = () => {
    router.push("/dashboard/jobs/add");
  };

  const handleViewArchived = () => {
    router.push("/dashboard/jobs/archived");
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(filteredAndSortedJobs.map((job) => job.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (selectedJobs.includes(id)) {
      setSelectedJobs(selectedJobs.filter((jobId) => jobId !== id));
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedJobs([...selectedJobs, id]);
      if ([...selectedJobs, id].length === filteredAndSortedJobs.length) {
        setSelectAll(true);
      }
    }
  };


  const exportJobsToXML = async () => {
    if (selectedJobs.length === 0) return;

    try {
      const jobIds = selectedJobs.join(',');
      const response = await fetch(`/api/jobs/export/xml?ids=${jobIds}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\\s*)token\\s*=\\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export jobs');
      }

      const xmlBlob = await response.blob();
      const url = window.URL.createObjectURL(xmlBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jobs_export_${Date.now()}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting jobs:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'An error occurred while exporting jobs'
      );
    }
  };

  const exportSingleJobToXML = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/export/xml?ids=${jobId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\\s*)token\\s*=\\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export job');
      }

      const xmlBlob = await response.blob();
      const url = window.URL.createObjectURL(xmlBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job_${jobId}_export_${Date.now()}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting job:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'An error occurred while exporting job'
      );
    }
  };

  // CSV Export function for selected records
  const handleCSVExport = () => {
    if (selectedJobs.length === 0) return;

    const selectedData = jobs.filter((job) =>
      selectedJobs.includes(job.id)
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
      ...selectedData.map((job) => {
        const row = [
          `J ${job.record_number ?? job.id}`,
          ...columnFields.map((key) => escapeCSV(getColumnValue(job, key)))
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
    link.setAttribute('download', `jobs-export-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    fetchJobs();
    setSelectedJobId(null);
    setShowOwnershipModal(false);
    setShowStatusModal(false);
    setShowTearsheetModal(false);
    setShowNoteModal(false);
  };

  const getStatusColor = (status: string) => {
    if (!status) return "bg-gray-100 text-gray-800";
    switch (status.toLowerCase()) {
      case "open":
        return "bg-green-100 text-green-800";
      case "on hold":
        return "bg-yellow-100 text-yellow-800";
      case "filled":
        return "bg-blue-100 text-blue-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading jobs..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - responsive: mobile = title+add row, then full-width Favorites, Columns */}
      <div className="p-4 border-b border-gray-200 space-y-3 md:space-y-0 md:flex md:justify-between md:items-center">
        <div className="flex justify-between items-center gap-4">
          <h1 className="text-xl font-bold">Jobs</h1>
          <button
            onClick={handleAddJob}
            className="md:hidden px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Job
          </button>
        </div>

        <div className="hidden md:flex space-x-4">
          <div ref={favoritesMenuRef} className="relative">
            <button
              onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 bg-white"
            >
              <FiStar className={selectedFavoriteId ? "text-yellow-400 fill-current" : "text-gray-400"} />
              <span className="max-w-[100px] truncate">
                {selectedFavoriteId ? favorites.find((f) => f.id === selectedFavoriteId)?.name || "Favorites" : "Favorites"}
              </span>
              <FiChevronDown />
            </button>
            {favoritesMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <button onClick={handleOpenSaveFavoriteModal} className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium flex items-center gap-2">
                    <FiStar className="text-blue-500" /> Save Current Search
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {favorites.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No saved favorites yet</p>
                  ) : (
                    favorites.map((fav) => (
                      <div key={fav.id} className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${selectedFavoriteId === fav.id ? "bg-blue-50" : ""}`} onClick={() => { setSelectedFavoriteId(fav.id); applyFavorite(fav); setFavoritesMenuOpen(false); }}>
                        <span className="text-sm text-gray-700 truncate flex-1">{fav.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); const updated = favorites.filter((f) => f.id !== fav.id); persistFavorites(updated); if (selectedFavoriteId === fav.id) setSelectedFavoriteId(""); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Delete favorite"><FiX size={14} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {selectedJobs.length > 0 && (
            <BulkActionsButton
              selectedCount={selectedJobs.length}
              entityType="job"
              entityIds={selectedJobs}
              availableFields={availableFields}
              onSuccess={() => {
                fetchJobs();
                setSelectedJobs([]);
                setSelectAll(false);
              }}
              onCSVExport={handleCSVExport}
            />
          )}
          <button onClick={() => setShowColumnModal(true)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center">Columns</button>
          <button onClick={handleViewArchived} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center">
            Archived
          </button>
          <button onClick={handleAddJob} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add Job
          </button>
        </div>

        <div className="w-full md:hidden" ref={favoritesMenuMobileRef}>
          <div className="relative">
            <button onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)} className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-between gap-2 bg-white">
              <span className="flex items-center gap-2">
                <FiStar className={selectedFavoriteId ? "text-yellow-400 fill-current" : "text-gray-400"} />
                <span className="truncate">{selectedFavoriteId ? favorites.find((f) => f.id === selectedFavoriteId)?.name || "Favorites" : "Favorites"}</span>
              </span>
              <FiChevronDown className="shrink-0" />
            </button>
            {favoritesMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <button onClick={handleOpenSaveFavoriteModal} className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium flex items-center gap-2"><FiStar className="text-blue-500" /> Save Current Search</button>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {favorites.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No saved favorites yet</p> : favorites.map((fav) => (
                    <div key={fav.id} className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${selectedFavoriteId === fav.id ? "bg-blue-50" : ""}`} onClick={() => { setSelectedFavoriteId(fav.id); applyFavorite(fav); setFavoritesMenuOpen(false); }}>
                      <span className="text-sm text-gray-700 truncate flex-1">{fav.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); const updated = favorites.filter((f) => f.id !== fav.id); persistFavorites(updated); if (selectedFavoriteId === fav.id) setSelectedFavoriteId(""); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Delete favorite"><FiX size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {selectedJobs.length > 0 && (
          <div className="w-full md:hidden">
            <BulkActionsButton
              selectedCount={selectedJobs.length}
              entityType="job"
              entityIds={selectedJobs}
              availableFields={availableFields}
              onSuccess={() => {
                fetchJobs();
                setSelectedJobs([]);
                setSelectAll(false);
              }}
              onCSVExport={handleCSVExport}
            />
          </div>
        )}
        <div className="w-full md:hidden">
          <button onClick={() => setShowColumnModal(true)} className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center">Columns</button>
        </div>
        <div className="w-full md:hidden">
          <button onClick={handleViewArchived} className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center">
            Archived
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
              placeholder="Search jobs..."
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

      {/* Advanced Search Panel */}
      <AdvancedSearchPanel
        open={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        fieldCatalog={columnsCatalog.map((c) => ({
          key: c.key,
          label: c.label,
          fieldType: (c as any).fieldType,
          lookupType: (c as any).lookupType,
          multiSelectLookupType: (c as any).multiSelectLookupType,
          options: (c as any).options,
        }))}
        onSearch={(criteria) => setAdvancedSearchCriteria(criteria)}
        recentStorageKey="jobsAdvancedSearchRecent"
        initialCriteria={advancedSearchCriteria}
        anchorEl={advancedSearchButtonRef.current}
      />

      <div className="w-full max-w-full overflow-x-hidden">
        <div className="overflow-x-auto">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>

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
                            key === "status" ? statusOptions : undefined
                          }
                        />
                      );
                    })}
                  </SortableContext>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedJobs.length > 0 ? (
                  filteredAndSortedJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleViewJob(job.id)}
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          checked={selectedJobs.includes(job.id)}
                          onChange={() => { }}
                          onClick={(e) => handleSelectJob(job.id, e)}
                        />
                      </td>

                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionDropdown
                          label="Actions"
                          options={[
                            { label: "View", action: () => handleViewJob(job.id) },
                            {
                              label: "Export to XML",
                              action: () => exportSingleJobToXML(job.id),
                            },
                            ...(ownerField ? [{
                              label: "Change Ownership",
                              action: () => {
                                setSelectedJobId(job.id);
                                setShowOwnershipModal(true);
                              },
                            }] : []),
                            ...(statusField ? [{
                              label: "Change Status",
                              action: () => {
                                setSelectedJobId(job.id);
                                setShowStatusModal(true);
                              },
                            }] : []),
                            {
                              label: "Add Note",
                              action: () => {
                                setSelectedJobId(job.id);
                                setShowNoteModal(true);
                              },
                            },
                            {
                              label: "Add To TearSheet",
                              action: () => {
                                setSelectedJobId(job.id);
                                setShowTearsheetModal(true);
                              },
                            },
                            {
                              label: "Create Task",
                              action: () => {
                                router.push(`/dashboard/tasks/add?relatedEntity=job&relatedEntityId=${job.id}`);
                              },
                            },
                          ]}
                        />
                      </td>

                      <td className="px-6 py-4 text-black whitespace-nowrap">J {job?.record_number ?? job?.id}</td>
                      {columnFields.map((key) => {
                        const colInfo = getColumnInfo(key);
                        const fieldInfo = colInfo
                          ? {
                              key: colInfo.key,
                              label: colInfo.label,
                              fieldType: (colInfo as any).fieldType,
                              lookupType: (colInfo as any).lookupType,
                              multiSelectLookupType: (colInfo as any).multiSelectLookupType,
                            }
                          : { key, label: getColumnLabel(key) };
                        return (
                          <td
                            key={key}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            <FieldValueRenderer
                              value={getColumnValue(job, key)}
                              fieldInfo={fieldInfo}
                              emptyPlaceholder="N/A"
                              clickable
                              stopPropagation
                              className=""
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
                      {searchTerm
                        ? "No jobs found matching your search."
                        : 'No jobs found. Click "Add Job" to create one.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 overflow-x-auto min-w-0">
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
                <span className="font-medium">{filteredAndSortedJobs.length}</span>{" "}
                of{" "}
                <span className="font-medium">{filteredAndSortedJobs.length}</span>{" "}
                results
              </p>
            </div>
            {filteredAndSortedJobs.length > 0 && (
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

      {/* Column Customization Modal - uses universal SortableFieldsEditModal */}
      {showColumnModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowColumnModal(false)}
          title="Customize Columns"
          description="Drag to reorder, check/uncheck to show or hide columns in the table. Changes apply to the job list."
          order={[
            ...columnFields,
            ...columnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
          ]}
          visible={Object.fromEntries(columnsCatalog.map((c) => [c.key, columnFields.includes(c.key)]))}
          fieldCatalog={columnsCatalog.map((c) => ({ key: c.key, label: c.label }))}
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
              ...columnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
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
          isSaveDisabled={isSavingColumns}
          onReset={() => setColumnFields(columnsCatalog.map((c) => c.key))}
          resetButtonText="Reset"
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
                  placeholder="e.g. Active Jobs"
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
      {showOwnershipModal && ownerField && selectedJobId && (
        <BulkOwnershipModal
          open={showOwnershipModal}
          onClose={() => {
            setShowOwnershipModal(false);
            setSelectedJobId(null);
          }}
          entityType="job"
          entityIds={[selectedJobId]}
          fieldLabel={ownerField.field_label || 'Owner'}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showStatusModal && statusField && selectedJobId && (
        <BulkStatusModal
          open={showStatusModal}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedJobId(null);
          }}
          entityType="job"
          entityIds={[selectedJobId]}
          fieldLabel={statusField.field_label || 'Status'}
          options={statusField.options || []}
          availableFields={availableFields}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showTearsheetModal && selectedJobId && (
        <BulkTearsheetModal
          open={showTearsheetModal}
          onClose={() => {
            setShowTearsheetModal(false);
            setSelectedJobId(null);
          }}
          entityType="job"
          entityIds={[selectedJobId]}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showNoteModal && selectedJobId && (
        <BulkNoteModal
          open={showNoteModal}
          onClose={() => {
            setShowNoteModal(false);
            setSelectedJobId(null);
          }}
          entityType="job"
          entityIds={[selectedJobId]}
          onSuccess={handleIndividualActionSuccess}
        />
      )}
    </div>
  );
}
