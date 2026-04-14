"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import Image from "next/image";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { IoFilterSharp } from "react-icons/io5";
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
import { toast } from "sonner";

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

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200, 500] as const;

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
  const searchParams = useSearchParams();

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
    if (columnFields.length === 0) return;
    // Don't overwrite a multi-column preference with only record_number (e.g. after API or initial load)
    const savingOnlyRecordNumber =
      columnFields.length === 1 && columnFields[0] === "record_number";
    if (savingOnlyRecordNumber) {
      try {
        const saved = localStorage.getItem("jobsColumnOrder");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 1) return;
        }
      } catch {
        // ignore
      }
    }
    localStorage.setItem("jobsColumnOrder", JSON.stringify(columnFields));
  }, [columnFields]);

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [totalJobsCount, setTotalJobsCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancedJobsDataset, setAdvancedJobsDataset] = useState<Job[] | null>(null);
  const [isAdvancedDatasetLoading, setIsAdvancedDatasetLoading] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const activeFetchControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);
  const jobsQueryCacheRef = useRef<Map<string, { jobs: Job[]; total: number | null }>>(new Map());
  const advancedJobsCacheRef = useRef<Map<string, Job[]>>(new Map());

  // Individual row action modals state
  const [showOwnershipModal, setShowOwnershipModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTearsheetModal, setShowTearsheetModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // XML Feed In
  const [showXmlFeedModal, setShowXmlFeedModal] = useState(false);
  const [showXmlMappingModal, setShowXmlMappingModal] = useState(false);
  const [xmlFeedInput, setXmlFeedInput] = useState("");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlParsedJobs, setXmlParsedJobs] = useState<Record<string, string>[]>([]);
  const [xmlFieldNames, setXmlFieldNames] = useState<string[]>([]);
  const [xmlFieldMapping, setXmlFieldMapping] = useState<Record<string, string>>({});
  const [xmlImportLoading, setXmlImportLoading] = useState(false);
  const [xmlImportResult, setXmlImportResult] = useState<{ created: number; failed: number; errors: { index: number; message: string }[] } | null>(null);
  const [xmlMappingSearch, setXmlMappingSearch] = useState("");
  const [xmlMappingOpenFor, setXmlMappingOpenFor] = useState<string | null>(null);
  const xmlMappingSearchRef = useRef<HTMLInputElement>(null);
  const xmlMappingDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (xmlMappingOpenFor !== null) {
      setXmlMappingSearch("");
      const t = setTimeout(() => xmlMappingSearchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [xmlMappingOpenFor]);

  useEffect(() => {
    if (!showXmlMappingModal) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (xmlMappingDropdownRef.current?.contains(target) || target.closest?.("[data-xml-mapping-dropdown]")) return;
      setXmlMappingOpenFor(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showXmlMappingModal]);

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
  const xmlSystemFieldOptions = useMemo(() => {
    // Only show admin custom fields here (non-hidden). No standard/system fields.
    const custom = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any, idx: number) => {
        const label = (f.field_label ?? f.field_name ?? "").trim() || "Unnamed";
        const name = (f.field_name ?? f.id ?? `field_${idx}`).toString().trim();
        return {
          optionId: `custom-${name}-${idx}`,
          label,
          value: `custom:${label}`,
        };
      });
    return custom;
  }, [availableFields]);

  const xmlSystemFieldOptionsFiltered = useMemo(() => {
    const q = xmlMappingSearch.trim().toLowerCase();
    if (!q) return xmlSystemFieldOptions;
    return xmlSystemFieldOptions.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }, [xmlSystemFieldOptions, xmlMappingSearch]);


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

  const findFieldByLabel = (label: string) => {
    return availableFields.find((f) => {
      const fieldLabel = (f.field_label || "").toLowerCase();
      const fieldName = (f.field_name || "").toLowerCase();
      const searchLabel = label.toLowerCase();
      return fieldLabel === searchLabel || fieldName === searchLabel;
    });
  };

  const ownerField = findFieldByLabel("Owner");
  const statusField = findFieldByLabel("Status");

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

    const nextSearch = fav.searchTerm || "";
    setSearchInput(nextSearch);
    setSearchTerm(nextSearch);
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
      searchTerm: searchInput,
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
    setSearchInput("");
    setSearchTerm("");
    setColumnFilters({});
    setColumnSorts({});
    setAdvancedSearchCriteria([]);
    setSelectedFavoriteId("");
  };

  // Debounce keystrokes so heavy filtering is not recalculated on each key press
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchJobs = useCallback(
    async (page: number) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const cacheKey = `${page}|${pageSize}|${normalizedSearch}`;
      const cached = jobsQueryCacheRef.current.get(cacheKey);
      if (cached) {
        setJobs(cached.jobs);
        setTotalJobsCount(cached.total);
        setIsLoading(false);
        setIsPageLoading(false);
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      if (activeFetchControllerRef.current) {
        activeFetchControllerRef.current.abort();
      }
      const controller = new AbortController();
      activeFetchControllerRef.current = controller;

      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsPageLoading(true);
      }

      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (normalizedSearch !== "") {
          query.set("search", searchTerm.trim());
        }

        const response = await fetch(`/api/jobs?${query.toString()}`, {
          signal: controller.signal,
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
        if (requestId !== latestRequestIdRef.current) {
          return;
        }
        const incomingJobs: Job[] = Array.isArray(data?.jobs) ? data.jobs : [];
        const total =
          typeof data?.total === "number"
            ? data.total
            : typeof data?.count === "number"
              ? data.count
              : typeof data?.pagination?.total === "number"
                ? data.pagination.total
                : null;

        setTotalJobsCount(total);
        if (total == null && incomingJobs.length > pageSize * 2) {
          console.warn("Jobs API did not return total and appears unpaginated.");
        }

        // Fallback: some backends ignore page/limit and return the full dataset.
        // Enforce page-size rendering on the client so each page shows exact rows.
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageJobs =
          incomingJobs.length > pageSize
            ? incomingJobs.slice(start, end)
            : incomingJobs;

        setJobs(pageJobs);
        jobsQueryCacheRef.current.set(cacheKey, { jobs: pageJobs, total });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Error fetching jobs:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching jobs"
        );
      } finally {
        if (requestId !== latestRequestIdRef.current) {
          return;
        }
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
        setIsPageLoading(false);
      }
    },
    [pageSize, searchTerm]
  );

  const isAdvancedFullMode = advancedSearchCriteria.length > 0;

  // Fetch page whenever page number or size changes
  useEffect(() => {
    if (isAdvancedFullMode) return;
    void fetchJobs(currentPage);
  }, [currentPage, fetchJobs, isAdvancedFullMode]);

  useEffect(() => {
    return () => {
      activeFetchControllerRef.current?.abort();
    };
  }, []);

  // Reset to first page whenever client-side filters/search criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, columnSorts, advancedSearchCriteria]);

  useEffect(() => {
    if (!isAdvancedFullMode) {
      setAdvancedJobsDataset(null);
      setIsAdvancedDatasetLoading(false);
      return;
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const cacheKey = normalizedSearch;
    const cached = advancedJobsCacheRef.current.get(cacheKey);
    if (cached) {
      setAdvancedJobsDataset(cached);
      return;
    }

    let cancelled = false;
    const loadAllJobs = async () => {
      setIsAdvancedDatasetLoading(true);
      try {
        const limit = 500;
        let page = 1;
        let total: number | null = null;
        const all: Job[] = [];

        while (true) {
          const query = new URLSearchParams({
            page: String(page),
            limit: String(limit),
          });
          if (normalizedSearch !== "") {
            query.set("search", searchTerm.trim());
          }

          const response = await fetch(`/api/jobs?${query.toString()}`);
          if (!response.ok) throw new Error("Failed to fetch jobs for advanced search");
          const data = await response.json();
          const batch: Job[] = Array.isArray(data?.jobs) ? data.jobs : [];
          total =
            typeof data?.total === "number"
              ? data.total
              : typeof data?.count === "number"
                ? data.count
                : typeof data?.pagination?.total === "number"
                  ? data.pagination.total
                  : null;
          all.push(...batch);

          if (batch.length < limit) break;
          if (total != null && all.length >= total) break;
          page += 1;
        }

        if (!cancelled) {
          advancedJobsCacheRef.current.set(cacheKey, all);
          setAdvancedJobsDataset(all);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading full jobs dataset for advanced search:", err);
          setAdvancedJobsDataset([]);
        }
      } finally {
        if (!cancelled) setIsAdvancedDatasetLoading(false);
      }
    };

    void loadAllJobs();
    return () => {
      cancelled = true;
    };
  }, [isAdvancedFullMode, searchTerm]);

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
      .map((f: any, idx: number) => {
        const name = String((f as any)?.field_name ?? (f as any)?.fieldName ?? "").trim();
        const label = (f as any)?.field_label ?? (f as any)?.fieldLabel ?? (name ? humanize(name) : "");
        const isBackendCol = name && JOB_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        if (name === "status") filterType = "select";
        const customKey = isBackendCol ? name : `custom:${label || name}:${name || `f${idx}`}`;
        return {
          key: customKey,
          label: String(label),
          name: String(name),
          sortable: isBackendCol,
          filterType,
          fieldType: (f as any)?.field_type ?? (f as any)?.fieldType ?? "",
          lookupType: (f as any)?.lookup_type ?? (f as any)?.lookupType ?? "",
          multiSelectLookupType: (f as any)?.multiselect_lookup ?? (f as any)?.multiSelectLookupType ?? "",
          customFieldLabel: isBackendCol ? undefined : (label || name),
        };
      });

    console.log("availableFields", availableFields);

    const merged = [
      { key: "record_number", label: "Record Number", sortable: true, filterType: "number" as const, fieldType: "", lookupType: "", multiSelectLookupType: "", customFieldLabel: undefined as string | undefined },
      ...fromApi,
    ];
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [availableFields]);

  const columnCatalogKeys = useMemo(() => columnsCatalog.map((c) => c.key), [columnsCatalog]);

  const getRequiredAdminColumnKeys = useCallback(() => {
    const requiredNames = new Set(
      (availableFields || [])
        .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden && (f.is_required || f.required || f.isRequired))
        .map((f: any) => String((f.field_name ?? f.fieldName ?? "").trim()).toLowerCase())
        .filter(Boolean)
    );

    const required = columnsCatalog.filter((c) => {
      if (c.key === "record_number") return true;
      if (!("name" in c) || !c.name) return false;
      return requiredNames.has(String(c.name).trim().toLowerCase());
    });

    return Array.from(new Set(required.map((c) => c.key)));
  }, [availableFields, columnsCatalog]);

  const sanitizeColumnKeys = useCallback(
    (keys: unknown[]) => {
      const cleaned: string[] = [];
      const catalogSet = new Set(columnCatalogKeys);
      for (const key of keys) {
        if (typeof key !== "string") continue;
        if (!catalogSet.has(key)) continue;
        if (cleaned.includes(key)) continue;
        cleaned.push(key);
      }
      return cleaned;
    },
    [columnCatalogKeys]
  );

  // When catalog is ready, default columnFields to all catalog keys if empty (or validate saved)
  useEffect(() => {
    const catalogKeys = columnCatalogKeys;
    if (catalogKeys.length === 0) return;

    const savedOrder = localStorage.getItem("jobsColumnOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let validOrder = sanitizeColumnKeys(parsed);
          if (catalogKeys.includes("record_number") && !validOrder.includes("record_number")) {
            validOrder = ["record_number", ...validOrder];
          }
          const wouldCollapseToRecordNumberOnly =
            parsed.length > 1 && validOrder.length === 1 && validOrder[0] === "record_number";
          if (!wouldCollapseToRecordNumberOnly && validOrder.length > 0) {
            if (JSON.stringify(validOrder) !== JSON.stringify(parsed)) {
              localStorage.setItem("jobsColumnOrder", JSON.stringify(validOrder));
            }
            setColumnFields(validOrder);
            return;
          }
        }
      } catch {
        // ignore invalid storage contents
      }
    }

    const defaultColumns = getRequiredAdminColumnKeys();
    setColumnFields((prev) => (prev.length === 0 ? defaultColumns : prev));
  }, [columnCatalogKeys, getRequiredAdminColumnKeys, sanitizeColumnKeys]);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnInfo = (key: string) =>
    columnsCatalog.find((c) => c.key === key);

  const getColumnValue = (job: any, key: string) => {
    if (key === "record_number") {
      return job.record_number ?? job.id;
    }
    if (key.startsWith("custom:")) {
      const colInfo = getColumnInfo(key);
      const lookupKey = (colInfo as any)?.customFieldLabel ?? key.replace("custom:", "").replace(/:[^:]+$/, "");
      const cf = job?.customFields || job?.custom_fields || {};
      const val = cf?.[lookupKey];
      return val === undefined || val === null || val === ""
        ? "N/A"
        : String(val);
    }

    switch (key) {
      case "job_title":
        return job.job_title || "N/A";
      case "job_type":
        return job.job_type || "N/A";
      case "category":
        return job.category || "N/A";
      case "organization_name":
        return job.organization_name || "N/A";
      case "worksite_location":
        return job.worksite_location || "N/A";
      case "status":
        return job.status || "N/A";
      case "created_at":
        return job.created_at
          ? new Date(job.created_at).toLocaleDateString()
          : "N/A";
      case "created_by_name":
        return job.created_by_name || "N/A";
      default:
        return "N/A";
    }
  };

  // Status filter: legacy column + custom Field_4 (label e.g. "Status") when present
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    const cfLabel = statusField?.field_label
      ? String(statusField.field_label).trim()
      : "";
    jobs.forEach((job) => {
      if (job.status) statuses.add(job.status);
      if (cfLabel) {
        const cf = job.customFields || job.custom_fields || {};
        const v = cf[cfLabel];
        if (v != null && String(v).trim() !== "") statuses.add(String(v).trim());
      }
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [jobs, statusField]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const shouldApplyClientGlobalSearch = totalJobsCount == null;
  const totalPages =
    isAdvancedFullMode
      ? 1
      : totalJobsCount != null
        ? Math.max(1, Math.ceil(totalJobsCount / pageSize))
        : null;
  const canGoPrev = currentPage > 1 && !isPageLoading && !isLoading;
  const canGoNext =
    !isAdvancedFullMode &&
    (totalPages != null ? currentPage < totalPages : jobs.length === pageSize) &&
    !isPageLoading &&
    !isLoading;
  const paginationItems = useMemo<(number | "...")[]>(() => {
    if (totalPages == null || totalPages <= 1) return [1];

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let p = currentPage - 1; p <= currentPage + 1; p += 1) {
      if (p > 1 && p < totalPages) pages.add(p);
    }

    const sorted = Array.from(pages).sort((a, b) => a - b);
    const items: (number | "...")[] = [];
    for (let i = 0; i < sorted.length; i += 1) {
      const value = sorted[i];
      if (i > 0 && value - sorted[i - 1] > 1) items.push("...");
      items.push(value);
    }
    return items;
  }, [currentPage, totalPages]);
  const filteredAndSortedJobs = useMemo(() => {
    // Exclude archived jobs from main listing (same as Organization)
    const sourceJobs = isAdvancedFullMode ? (advancedJobsDataset ?? []) : jobs;
    let result = sourceJobs.filter((job) => job.status !== "Archived" && !job.archived_at);

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
    if (shouldApplyClientGlobalSearch && deferredSearchTerm.trim() !== "") {
      const term = deferredSearchTerm.toLowerCase();
      result = result.filter((job) => {
        const idMatch =
          String(job.id || "").toLowerCase().includes(term) ||
          `j${job.id}`.toLowerCase().includes(term) ||
          String(job.record_number ?? "").toLowerCase().includes(term);
        const coreMatch =
          (job.job_title || "").toLowerCase().includes(term) ||
          (job.job_type || "").toLowerCase().includes(term) ||
          (job.organization_name || "").toLowerCase().includes(term) ||
          (job.category || "").toLowerCase().includes(term) ||
          (job.status || "").toLowerCase().includes(term) ||
          (job.worksite_location || "").toLowerCase().includes(term);
        const cf = job.customFields || job.custom_fields || {};
        const customMatch = Object.values(cf).some((val) =>
          String(val || "").toLowerCase().includes(term)
        );
        return idMatch || coreMatch || customMatch;
      });
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
  }, [jobs, advancedJobsDataset, isAdvancedFullMode, columnFilters, columnSorts, deferredSearchTerm, advancedSearchCriteria, shouldApplyClientGlobalSearch]);
  const visibleResultsCount =
    totalJobsCount != null && advancedSearchCriteria.length === 0 && Object.keys(columnFilters).length === 0
      ? totalJobsCount
      : filteredAndSortedJobs.length;

  const showTableSkeleton = isLoading || isPageLoading;
  const visibleTableColumnKeys = columnFields.filter((k) =>
    columnsCatalog.some((c) => c.key === k)
  );
  const skeletonColumnCount =
    visibleTableColumnKeys.length > 0 ? visibleTableColumnKeys.length : 6;
  const skeletonRowCount = Math.min(pageSize, 12);

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
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
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

  const testXMLFeedOut = async () => {
    try {
      const response = await fetch("/api/jobs/xml", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch XML feed");
      }

      const xmlBlob = await response.blob();
      const url = window.URL.createObjectURL(xmlBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `jobs-xml-feed-${new Date().toISOString().slice(0, 10)}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error fetching XML feed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while fetching XML feed"
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
    const headers = columnFields.map((key) => getColumnLabel(key));

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
        const row = columnFields.map((key) =>
          key === "record_number" ? escapeCSV(`J ${getColumnValue(job, key)}`) : escapeCSV(getColumnValue(job, key))
        );
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

  const handleIndividualActionSuccess = () => {
    jobsQueryCacheRef.current.clear();
    advancedJobsCacheRef.current.clear();
    void fetchJobs(currentPage);
    setSelectedJobId(null);
    setShowOwnershipModal(false);
    setShowStatusModal(false);
    setShowTearsheetModal(false);
    setShowNoteModal(false);
  };

  // ——— XML Feed In: parse XML string into jobs array and unique field names ———
  function parseXmlFeed(xmlString: string): { jobs: Record<string, string>[]; fieldNames: string[] } {
    let raw = xmlString.trim();
    if (!raw) return { jobs: [], fieldNames: [] };

    // If content looks like a fragment (starts with closing tag or has no single root), wrap in root so parser can parse it
    if (raw.startsWith("</") || (!raw.startsWith("<?xml") && !raw.startsWith("<source") && !raw.startsWith("<jobs") && !raw.startsWith("<feed") && !raw.startsWith("<root") && !/^<[a-zA-Z][\w.-]*>/.test(raw))) {
      raw = `<root>${raw}</root>`;
    }

    const parser = new DOMParser();
    let doc = parser.parseFromString(raw, "text/xml");

    // If parser put an error in the doc, try wrapping in root (handles fragments)
    const parserError = doc.querySelector("parsererror");
    if (parserError && raw.includes("<job")) {
      doc = parser.parseFromString(`<root>${xmlString.trim()}</root>`, "text/xml");
    }

    // Collect <job> elements case-insensitively (XML getElementsByTagName is case-sensitive)
    const jobElements: Element[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName?.toLowerCase() === "job") jobElements.push(el);
        for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
      }
    };
    walk(doc.documentElement || doc.body || doc);

    const jobs: Record<string, string>[] = [];
    const fieldNameSet = new Set<string>();

    for (let i = 0; i < jobElements.length; i++) {
      const jobEl = jobElements[i];
      const row: Record<string, string> = {};
      const children = jobEl.children;
      for (let j = 0; j < children.length; j++) {
        const child = children[j];
        const tag = child.tagName?.toLowerCase?.() || "";
        if (!tag) continue;
        const text = (child.textContent || "").trim();
        row[tag] = text;
        fieldNameSet.add(tag);
      }
      jobs.push(row);
    }

    // If no jobs but XML clearly contains <job>, re-parse with content wrapped in root (handles fragments)
    if (jobs.length === 0 && /<job[\s>]/i.test(xmlString)) {
      const wrapped = `<root>${xmlString.trim()}</root>`;
      const doc2 = parser.parseFromString(wrapped, "text/xml");
      const jobElements2: Element[] = [];
      const walk2 = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.tagName?.toLowerCase() === "job") jobElements2.push(el);
          for (let i = 0; i < el.children.length; i++) walk2(el.children[i]);
        }
      };
      walk2(doc2.documentElement || doc2.body || doc2);
      for (let i = 0; i < jobElements2.length; i++) {
        const jobEl = jobElements2[i];
        const row: Record<string, string> = {};
        for (let j = 0; j < jobEl.children.length; j++) {
          const child = jobEl.children[j];
          const tag = child.tagName?.toLowerCase?.() || "";
          if (!tag) continue;
          row[tag] = (child.textContent || "").trim();
          fieldNameSet.add(tag);
        }
        jobs.push(row);
      }
    }
    return { jobs, fieldNames: Array.from(fieldNameSet).sort() };
  }

  // System field options: backend columns + admin custom fields (non-hidden only)

  // Default XML tag → admin custom field mapping (used when opening mapping modal)
  // Note: right-side options are custom fields only, so we map to `custom:<field_label>`
  const normalizeForXmlAutoMap = (s: string) =>
    String(s || "")
      .toLowerCase()
      .replace(/%/g, " percent ")
      .replace(/[_\-]+/g, " ")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const xmlAutoMapCandidates: Record<string, string[]> = useMemo(
    () => ({
      title: ["Job Title", "Title"],
      description: ["Job Description", "Description", "Job Description Going to Job Board"],
      company: ["Company", "Organization", "Organization Name", "Client", "Client Name"],
      jobtype: ["Job Type", "Type", "Employment Type"],
      category: ["Category", "Department"],
      salary: ["Salary", "Pay", "Compensation"],
      streetaddress: ["Address", "Street Address", "Worksite Location", "Location"],
      city: ["City", "Worksite City"],
      state: ["State", "Worksite State"],
      postalcode: ["Zip", "Postal Code", "Zip Code"],
      country: ["Country"],
      url: ["URL", "Job URL", "Link"],
      referencenumber: ["Reference Number", "Reference #", "Job Id", "Job ID"],
      firstname: ["First Name", "Contact First Name"],
      lastname: ["Last Name", "Contact Last Name"],
      applyemail: ["Apply Email", "Email", "Contact Email"],
      expirationdate: ["Expiration Date", "Closing Date"],
      date: ["Date", "Date Added", "Posted Date", "Date Posted"],
      job_description: ["Job Description", "Description"],
    }),
    []
  );

  const nonHiddenCustomFieldLabels = useMemo(() => {
    const labels = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => String((f.field_label ?? f.field_name ?? "").trim()))
      .filter(Boolean);
    // Keep unique labels (some installs may have duplicates)
    return Array.from(new Set(labels));
  }, [availableFields]);

  const findBestCustomFieldLabel = (xmlTagName: string): string | null => {
    const xmlKeyNorm = normalizeForXmlAutoMap(xmlTagName);
    const candidates = xmlAutoMapCandidates[xmlKeyNorm] || xmlAutoMapCandidates[xmlTagName.toLowerCase().trim()] || [];
    const wanted = [xmlTagName, xmlKeyNorm, ...candidates].map(normalizeForXmlAutoMap).filter(Boolean);
    if (wanted.length === 0) return null;

    let best: { label: string; score: number } | null = null;
    for (const label of nonHiddenCustomFieldLabels) {
      const labelNorm = normalizeForXmlAutoMap(label);
      if (!labelNorm) continue;
      for (const w of wanted) {
        if (labelNorm === w) return label; // exact match
        let score = 0;
        if (labelNorm.includes(w) || w.includes(labelNorm)) score = 0.8;
        else {
          const lw = new Set(labelNorm.split(" ").filter(Boolean));
          const ww = w.split(" ").filter(Boolean);
          const overlap = ww.filter((x) => lw.has(x)).length;
          if (ww.length) score = overlap / ww.length;
        }
        if (score > 0.5 && (!best || score > best.score)) best = { label, score };
      }
    }
    return best?.label ?? null;
  };

  const handleOpenXmlFeedModal = () => {
    setXmlFeedInput("");
    setXmlFile(null);
    setXmlParsedJobs([]);
    setXmlFieldNames([]);
    setXmlFieldMapping({});
    setXmlImportResult(null);
    setXmlMappingOpenFor(null);
    setXmlMappingSearch("");
    setShowXmlMappingModal(false);
    setShowXmlFeedModal(true);
  };

  useEffect(() => {
    if (searchParams && searchParams.get("xmlImport") === "true") {
      handleOpenXmlFeedModal();
      router.replace("/dashboard/jobs", { scroll: false });
    }
  }, [searchParams]);

  const handleXmlFeedNext = () => {
    let xml = xmlFeedInput.trim();
    if (!xml) {
      toast.error("Please paste XML content or select an XML file.");
      return;
    }
    try {
      const { jobs, fieldNames } = parseXmlFeed(xml);
      if (jobs.length === 0 || fieldNames.length === 0) {
        toast.error("No <job> elements or fields found in the XML.");
        return;
      }
      setXmlParsedJobs(jobs);
      setXmlFieldNames(fieldNames);
      const initialMapping: Record<string, string> = {};
      fieldNames.forEach((name) => {
        const bestLabel = findBestCustomFieldLabel(name);
        if (bestLabel) initialMapping[name] = `custom:${bestLabel}`;
      });
      setXmlFieldMapping(initialMapping);
      setShowXmlFeedModal(false);
      setShowXmlMappingModal(true);
    } catch (e) {
      toast.error("Invalid XML or no job elements found.");
    }
  };

  const handleXmlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Please select an .xml file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || "";
      setXmlFeedInput(text);
      setXmlFile(file);
      try {
        const { jobs, fieldNames } = parseXmlFeed(text);
        if (jobs.length === 0 || fieldNames.length === 0) {
          toast.error("No <job> elements or fields found in the file.");
          return;
        }
        setXmlParsedJobs(jobs);
        setXmlFieldNames(fieldNames);
        const initialMapping: Record<string, string> = {};
        fieldNames.forEach((name) => {
          const bestLabel = findBestCustomFieldLabel(name);
          if (bestLabel) initialMapping[name] = `custom:${bestLabel}`;
        });
        setXmlFieldMapping(initialMapping);
      } catch {
        toast.error("Invalid XML in file.");
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleXmlMappingImport = async () => {
    setXmlImportLoading(true);
    setXmlImportResult(null);
    try {
      const jobsToSend: any[] = [];
      for (const row of xmlParsedJobs) {
        const custom_fields: Record<string, string> = {};
        const payload: Record<string, any> = { custom_fields };

        for (const [xmlFieldName, systemValue] of Object.entries(xmlFieldMapping)) {
          if (!systemValue || !xmlFieldName) continue;
          const raw = row[xmlFieldName];
          if (raw === undefined || raw === null) continue;
          const value = String(raw).trim();
          if (value === "") continue;

          if (systemValue.startsWith("custom:")) {
            const label = systemValue.replace(/^custom:/, "");
            custom_fields[label] = value;
          } else if (systemValue === "__salary") {
            custom_fields["Salary"] = value;
          } else {
            payload[systemValue] = value;
          }
        }
        payload.custom_fields = custom_fields;
        jobsToSend.push(payload);
      }

      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const BATCH_SIZE = 100;
      let totalCreated = 0;
      let totalFailed = 0;
      const allErrors: { index: number; message: string }[] = [];

      for (let offset = 0; offset < jobsToSend.length; offset += BATCH_SIZE) {
        const batch = jobsToSend.slice(offset, offset + BATCH_SIZE);
        const res = await fetch("/api/jobs/import", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ jobs: batch }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Import failed");
        totalCreated += data.created ?? 0;
        totalFailed += data.failed ?? 0;
        const errors = (data.errors ?? []).map((e: { index: number; message: string }) => ({
          index: e.index + offset,
          message: e.message,
        }));
        allErrors.push(...errors);
      }

      setXmlImportResult({
        created: totalCreated,
        failed: totalFailed,
        errors: allErrors,
      });
      if (totalCreated > 0) {
        jobsQueryCacheRef.current.clear();
        advancedJobsCacheRef.current.clear();
        setCurrentPage(1);
        void fetchJobs(1);
        toast.success(`Imported ${totalCreated} job(s).`);
      }
      if (totalFailed > 0) toast.error(`${totalFailed} job(s) failed to import.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setXmlImportLoading(false);
    }
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

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - responsive: search/filters on top, then actions */}
      <div className="p-4 border-b border-gray-200 space-y-3 md:space-y-0 md:flex md:justify-between md:items-center space-x-4 w-full">
        {/* Row 1: Title + Search + Filter + Clear + Add (mobile) */}
        <div className="w-full flex justify-between items-center gap-4">
          <h1 className="text-xl font-bold">Jobs</h1>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search jobs..."
                  className="w-full p-2 pl-10 pr-36 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-500">
                {(isLoading || isPageLoading || isAdvancedDatasetLoading) && (
                    <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  )}
                  <span>{isLoading ? "…" : `${visibleResultsCount} found`}</span>
                </div>
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
              <button
                ref={advancedSearchButtonRef}
                type="button"
                onClick={() => setShowAdvancedSearch((v) => !v)}
                className={`px-4 py-2.5 text-sm font-medium rounded border flex items-center gap-2 ${showAdvancedSearch || advancedSearchCriteria.length > 0
                  ? "bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <IoFilterSharp /> Filter
              </button>
              {(searchInput ||
                Object.keys(columnFilters).length > 0 ||
                Object.keys(columnSorts).length > 0 ||
                advancedSearchCriteria.length > 0) && (
                  <button
                    onClick={handleClearAllFilters}
                    className="px-4 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors flex items-center gap-2"
                  >
                    <FiX />
                    Clear All
                  </button>
                )}
            </div>
          </div>
          <button
            onClick={handleAddJob}
            className="md:hidden px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add
          </button>
        </div>

        <div className="hidden md:flex space-x-4 items-center">
          {/* <div>
            <button
              onClick={testXMLFeedOut}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
            >
              Test XML feed out
            </button>
          </div> */}
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
                jobsQueryCacheRef.current.clear();
                advancedJobsCacheRef.current.clear();
                void fetchJobs(currentPage);
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
            Add
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
                jobsQueryCacheRef.current.clear();
                advancedJobsCacheRef.current.clear();
                void fetchJobs(currentPage);
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
        isLoading={isLoading || isPageLoading || isAdvancedDatasetLoading}
        resultsCount={visibleResultsCount}
        resultsLabel="records"
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

                  {/* Draggable Dynamic headers (includes Record #) */}
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
                {showTableSkeleton ? (
                  <TableSkeletonRows
                    rowCount={skeletonRowCount}
                    columnCount={skeletonColumnCount}
                  />
                ) : filteredAndSortedJobs.length > 0 ? (
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

                      {/* Dynamic columns (including Record #) */}
                      {columnFields.map((key) => {
                        if (key === "record_number") {
                          return (
                            <td key={key} className="px-6 py-4 text-black whitespace-nowrap">
                              J {getColumnValue(job, key)}
                            </td>
                          );
                        }
                        const colInfo = getColumnInfo(key);
                        const fieldInfo = colInfo
                          ? {
                            key: colInfo.key,
                            label: colInfo.label,
                            name: (colInfo as any).name,
                            fieldType: (colInfo as any).fieldType,
                            lookupType: (colInfo as any).lookupType,
                            multiSelectLookupType: (colInfo as any).multiSelectLookupType,
                          }
                          : { key, label: getColumnLabel(key), name: key };
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
                              // entityType="jobs"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3 + visibleTableColumnKeys.length}
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
        <div className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 sm:px-6 overflow-x-auto min-w-0">
          <div>
            {showTableSkeleton && !isAdvancedFullMode ? (
              <p className="text-sm text-gray-500">Loading results…</p>
            ) : (
              <p className="text-sm text-gray-700">
                Showing{" "}
                <span className="font-medium">
                  {isAdvancedFullMode
                    ? (filteredAndSortedJobs.length === 0 ? 0 : 1)
                    : (totalJobsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1)}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {isAdvancedFullMode
                    ? filteredAndSortedJobs.length
                    : (currentPage - 1) * pageSize + jobs.length}
                </span>{" "}
                of{" "}
                {isAdvancedFullMode ? (
                  <span className="font-medium">{filteredAndSortedJobs.length}</span>
                ) : totalJobsCount != null ? (
                  <span className="font-medium">{totalJobsCount}</span>
                ) : (
                  <span className="font-medium">{jobs.length}</span>
                )}{" "}
                jobs
                {!isAdvancedFullMode && filteredAndSortedJobs.length !== jobs.length ? (
                  <>
                    {" "}(
                    <span className="font-medium">{filteredAndSortedJobs.length}</span> shown
                    after filters)
                  </>
                ) : null}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="jobs-page-size" className="text-sm text-gray-600">
              Rows per page
            </label>
            <select
              id="jobs-page-size"
              value={pageSize}
              disabled={showTableSkeleton}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
                setSelectedJobs([]);
                setSelectAll(false);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={!canGoPrev}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => canGoPrev && setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!canGoPrev}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
            >
              <span aria-hidden="true">‹</span>
              Previous
            </button>
            <div className="flex items-center gap-1">
              {paginationItems.map((item, idx) =>
                item === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-sm text-gray-500 select-none"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    disabled={isLoading || isPageLoading || item === currentPage}
                    className={`min-w-[2.4rem] px-3 py-1.5 border rounded text-sm font-medium transition-colors ${
                      item === currentPage
                        ? "border-gray-300 bg-white text-gray-900 shadow-sm"
                        : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50"
                    } disabled:cursor-not-allowed`}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => canGoNext && setCurrentPage((p) => p + 1)}
              disabled={!canGoNext}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
            >
              Next
              <span aria-hidden="true">›</span>
            </button>
            <button
              type="button"
              onClick={() => totalPages != null && setCurrentPage(totalPages)}
              disabled={totalPages == null || !canGoNext}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Last
            </button>
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
          order={Array.from(
            new Set([
              ...columnFields,
              ...columnsCatalog.map((c) => c.key),
            ])
          )}
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
          onReset={() => {
            const defaultColumns = getRequiredAdminColumnKeys();
            setColumnFields(defaultColumns.length > 0 ? defaultColumns : columnCatalogKeys);
          }}
          resetButtonText="Reset"
        />
      )}
      {/* Save Favorite Modal */}
      {showSaveFavoriteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999 p-4">
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

      {/* XML Feed In — Step 1: Paste or select XML */}
      {showXmlFeedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">XML Feed In</h3>
              <button onClick={() => setShowXmlFeedModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600">
                Paste your XML feed below or select an .xml file. The feed should contain <code className="bg-gray-100 px-1 rounded">&lt;job&gt;</code> elements with child tags (e.g. title, description, company).
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paste XML or select file</label>
                <textarea
                  value={xmlFeedInput}
                  onChange={(e) => setXmlFeedInput(e.target.value)}
                  placeholder="Paste XML content here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-md font-mono text-sm"
                />
                <div className="mt-2">
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleXmlFileChange}
                    className="text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-gray-50"
                  />
                  {xmlFile && <span className="ml-2 text-sm text-gray-500">{xmlFile.name}</span>}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowXmlFeedModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">
                Cancel
              </button>
              <button onClick={handleXmlFeedNext} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium">
                Next: Map fields
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XML Feed In — Step 2: Map XML fields to system fields */}
      {showXmlMappingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Map XML fields to system fields</h3>
              <button
                onClick={() => {
                  setShowXmlMappingModal(false);
                  setXmlImportResult(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-4">
                Map each XML field (left) to a system or admin center field (right). Unmapped fields are ignored. Found <strong>{xmlParsedJobs.length}</strong> job(s).
              </p>
              {xmlImportResult && (
                <div className="mb-4 p-3 rounded-md bg-gray-50 border border-gray-200 text-sm">
                  <span className="text-green-600 font-medium">{xmlImportResult.created} created</span>
                  {xmlImportResult.failed > 0 && (
                    <span className="text-red-600 font-medium ml-2">{xmlImportResult.failed} failed</span>
                  )}
                  {xmlImportResult.errors.length > 0 && (
                    <ul className="mt-1 text-red-600 list-disc list-inside">
                      {xmlImportResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>Row {err.index + 1}: {err.message}</li>
                      ))}
                      {xmlImportResult.errors.length > 5 && (
                        <li>… and {xmlImportResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="font-medium text-gray-700">XML field name</div>
                <div className="font-medium text-gray-700">Map to system field</div>
                {xmlFieldNames.map((name) => {
                  const value = xmlFieldMapping[name] ?? "";
                  const selectedOpt = xmlSystemFieldOptions.find((o) => o.value === value);
                  const isOpen = xmlMappingOpenFor === name;
                  return (
                    <div key={name} className="contents">
                      <label className="text-sm text-gray-800 truncate" title={name}>{name}</label>
                      <div className="relative" data-xml-mapping-dropdown ref={isOpen ? xmlMappingDropdownRef : undefined}>
                        {!isOpen ? (
                          <button
                            type="button"
                            onClick={() => setXmlMappingOpenFor(name)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-left bg-white hover:bg-gray-50 flex items-center justify-between gap-1"
                          >
                            <span className="truncate">{selectedOpt?.label ?? "— Select field —"}</span>
                            <FiChevronDown className="shrink-0 text-gray-400" size={14} />
                          </button>
                        ) : (
                          <div className="border border-gray-300 rounded text-sm bg-white shadow-lg overflow-hidden">
                            <input
                              ref={xmlMappingSearchRef}
                              type="text"
                              value={xmlMappingSearch}
                              onChange={(e) => setXmlMappingSearch(e.target.value)}
                              placeholder="Search fields..."
                              className="w-full px-2 py-1.5 border-b border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="max-h-48 overflow-y-auto">
                              {xmlSystemFieldOptionsFiltered.length === 0 ? (
                                <div className="px-2 py-2 text-gray-500 text-xs">No matches</div>
                              ) : (
                                xmlSystemFieldOptionsFiltered.map((opt) => (
                                  <button
                                    key={opt.optionId}
                                    type="button"
                                    onClick={() => {
                                      setXmlFieldMapping((prev) => ({ ...prev, [name]: opt.value }));
                                      setXmlMappingOpenFor(null);
                                    }}
                                    className={`w-full text-left px-2 py-1.5 hover:bg-blue-50 text-sm ${opt.value === value ? "bg-blue-50 font-medium" : ""}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowXmlMappingModal(false);
                  setXmlImportResult(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Close
              </button>
              <button
                onClick={handleXmlMappingImport}
                disabled={xmlImportLoading}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:opacity-50"
              >
                {xmlImportLoading ? "Importing…" : "Import jobs"}
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
