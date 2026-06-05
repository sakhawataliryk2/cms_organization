'use client'

import { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from "react";
import { useRouter } from "nextjs-toploader/app";
import Image from 'next/image';
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import { IoFilterSharp } from "react-icons/io5";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { FiStar, FiChevronDown, FiX } from "react-icons/fi";
import SortableColumnHeader, {
  type ColumnSortState,
  type ColumnFilterState,
} from "@/components/SortableColumnHeader";
import { SEARCH_DEBOUNCE_MS } from "@/lib/apiListParams";
import ActionDropdown from "@/components/ActionDropdown";
import BulkActionsButton from "@/components/BulkActionsButton";
import BulkOwnershipModal from "@/components/BulkOwnershipModal";
import BulkStatusModal from "@/components/BulkStatusModal";
import BulkTearsheetModal from "@/components/BulkTearsheetModal";
import BulkNoteModal from "@/components/BulkNoteModal";
import BulkTaskModal from "@/components/BulkTaskModal";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import AdvancedSearchPanel, {
  type AdvancedSearchCriterion,
} from "@/components/AdvancedSearchPanel";
import { matchesAdvancedValue } from "@/lib/advancedSearch";
import EntityDeleteModal from "@/components/EntityDeleteModal";
import EntityBulkDeleteModal from "@/components/EntityBulkDeleteModal";

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

const FAVORITES_STORAGE_KEY = "hiringManagersFavorites";

export default function HiringManagerList() {
  const router = useRouter();
  const [selectedHiringManagers, setSelectedHiringManagers] = useState<
    string[]
  >([]);
  const [selectAll, setSelectAll] = useState(false);
  const [hiringManagers, setHiringManagers] = useState<HiringManager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [totalHmCount, setTotalHmCount] = useState<number | null>(null);
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);
  const favoritesMenuRef = useRef<HTMLDivElement>(null);
  const favoritesMenuMobileRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnceRef = useRef(false);
  const activeFetchControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);
  const hmQueryCacheRef = useRef<
    Map<string, { hiringManagers: HiringManager[]; total: number | null }>
  >(new Map());

  const PAGE_SIZE_OPTIONS = [50, 100, 150, 200, 500] as const;

  // Individual row action modals state
  const [showOwnershipModal, setShowOwnershipModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTearsheetModal, setShowTearsheetModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedHmId, setSelectedHmId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<any>(null);

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

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
    setSearchInput(fav.searchTerm || "");
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
      searchTerm: searchInput,
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
    setSearchInput("");
    setSearchTerm("");
    setColumnFilters({});
    setColumnSorts({});
    setAdvancedSearchCriteria([]);
    setSelectedFavoriteId(null);
    hmQueryCacheRef.current.clear();
  };

  const HM_BACKEND_COLUMN_KEYS = [
    "full_name",
    "status",
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
    const coreBackendColumns = HM_BACKEND_COLUMN_KEYS.map((key) => {
      let filterType: "text" | "select" | "number" = "text";
      if (key === "status") filterType = "select";
      return {
        key,
        label: humanize(key),
        sortable: true,
        filterType,
        fieldType: "",
        lookupType: "",
      };
    });

    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const name = String((f as any)?.field_name ?? (f as any)?.fieldName ?? "").trim();
        const fieldType = (f as any)?.field_type;
        const lookupType = (f as any)?.lookup_type || "";
        const label = (f as any)?.field_label ?? (f as any)?.fieldLabel ?? (name ? humanize(name) : "");
        const isBackendCol = name && HM_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        if (name === "status") filterType = "select";

        let options: { label: string; value: string }[] | undefined;
        const rawOptions = (f as any)?.options;
        if (rawOptions) {
          try {
            const parsed = typeof rawOptions === "string" ? JSON.parse(rawOptions) : rawOptions;
            if (Array.isArray(parsed)) {
              options = parsed
                .map((opt: any) => {
                  if (typeof opt === "string") return { label: opt, value: opt };
                  const label = String(opt?.label ?? opt?.value ?? "").trim();
                  const value = String(opt?.value ?? opt?.label ?? "").trim();
                  if (!label && !value) return null;
                  return { label: label || value, value: value || label };
                })
                .filter(Boolean) as { label: string; value: string }[];
            }
          } catch { }
        }

        return {
          fieldType,
          lookupType,
          options,
          key: isBackendCol ? name : `custom:${label || name}`,
          label: String(label || name),
          sortable: isBackendCol,
          filterType,
        };
      });

    const merged = [
      { key: "record_number", label: "Record Number", sortable: true, filterType: "number" as const, fieldType: "", lookupType: "" },
      ...coreBackendColumns,
      ...fromApi,
    ];
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [availableFields]);
  const getColumnLabel = (key: string) =>
    hmColumnsCatalog.find((c) => c.key === key)?.label ?? key;

  const getColumnInfo = (key: string) =>
    hmColumnsCatalog.find((c) => c.key === key);

  const getColumnValue = (hm: any, key: string) => {
    if (key === "record_number") {
      return hm.record_number ?? hm.id;
    }
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = hm?.customFields || hm?.custom_fields || {};
      const val = cf?.[rawKey];
      return val === undefined || val === null || val === "" ? "—" : String(val);
    }

    switch (key) {
      case "full_name":
        return hm.full_name || `${hm.last_name}, ${hm.first_name}`;
      case "status":
        return hm.status || "—";
      case "title":
        return hm.title || "—";
      case "organization_name":
        return hm.organization_name_from_org || hm.organization_name || "—";
      case "email":
        return hm.email || "—";
      case "phone":
        return hm.phone || "—";
      case "created_by_name":
        return hm.created_by_name || "—";
      case "created_at":
        return formatDate(hm.created_at);
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
    entityType: "HIRING_MANAGER",
    configType: "columns",
    defaultFields: [],
  });

  useEffect(() => {
    const catalogKeys = hmColumnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);
    const savedOrder = localStorage.getItem("hiringManagerColumnOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let validOrder = parsed.filter((k: string) => catalogSet.has(k));
          if (catalogSet.has("record_number") && !validOrder.includes("record_number")) {
            validOrder = ["record_number", ...validOrder];
          }
          const wouldCollapseToRecordNumberOnly =
            parsed.length > 1 && validOrder.length === 1 && validOrder[0] === "record_number";
          if (!wouldCollapseToRecordNumberOnly && validOrder.length > 0) {
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
    if (columnFields.length === 0) return;
    const savingOnlyRecordNumber =
      columnFields.length === 1 && columnFields[0] === "record_number";
    if (savingOnlyRecordNumber) {
      try {
        const saved = localStorage.getItem("hiringManagerColumnOrder");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 1) return;
        }
      } catch {
        // ignore
      }
    }
    localStorage.setItem("hiringManagerColumnOrder", JSON.stringify(columnFields));
  }, [columnFields]);

  const fetchHiringManagers = useCallback(
    async (page: number) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const activeSorts = Object.entries(columnSorts).filter(
        ([_, dir]) => dir !== null,
      );
      const sortKey = activeSorts.length > 0 ? activeSorts[0][0] : '';
      const sortDir = activeSorts.length > 0 ? activeSorts[0][1] : '';
      const activeFilters = Object.fromEntries(
        Object.entries(columnFilters).filter(
          ([, value]) => value != null && String(value).trim() !== "",
        ),
      );
      const filtersKey = JSON.stringify(activeFilters);
      const cacheKey = `${page}|${pageSize}|${normalizedSearch}|${sortKey}|${sortDir}|${filtersKey}`;
      const cached = hmQueryCacheRef.current.get(cacheKey);
      if (cached) {
        setHiringManagers(cached.hiringManagers);
        setTotalHmCount(cached.total);
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

        if (sortKey) {
          query.set("sort", sortKey);
          query.set("order", sortDir === "asc" ? "ASC" : "DESC");
        }

        if (Object.keys(activeFilters).length > 0) {
          query.set("filters", JSON.stringify(activeFilters));
        }

        const response = await fetch(`/api/hiring-managers?${query.toString()}`, {
          signal: controller.signal,
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
        if (requestId !== latestRequestIdRef.current) return;

        const incoming: HiringManager[] = Array.isArray(data?.hiringManagers) ? data.hiringManagers : [];
        const total =
          typeof data?.total === "number"
            ? data.total
            : typeof data?.count === "number"
              ? data.count
              : typeof data?.pagination?.total === "number"
                ? data.pagination.total
                : null;
        setTotalHmCount(total);

        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageData = incoming.length > pageSize ? incoming.slice(start, end) : incoming;
        setHiringManagers(pageData);
        hmQueryCacheRef.current.set(cacheKey, {
          hiringManagers: pageData,
          total,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error fetching hiring managers:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching hiring managers"
        );
      } finally {
        if (requestId !== latestRequestIdRef.current) return;
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
        setIsPageLoading(false);
      }
    },
    [pageSize, searchTerm, columnSorts, columnFilters]
  );

  const isAdvancedFullMode = advancedSearchCriteria.length > 0;

  useEffect(() => {
    if (isAdvancedFullMode) return;
    void fetchHiringManagers(currentPage);
  }, [currentPage, fetchHiringManagers, isAdvancedFullMode]);

  useEffect(() => {
    return () => {
      activeFetchControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, columnSorts, advancedSearchCriteria]);

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
    setCurrentPage(1);
    hmQueryCacheRef.current.clear();
  };

  const handleColumnFilter = (columnKey: string, value: string) => {
    let didChange = false;
    setColumnFilters((prev) => {
      const nextValue = value.trim();
      const prevValue = (prev[columnKey] ?? "").trim();
      if (nextValue === prevValue) return prev;

      didChange = true;
      if (!nextValue) {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: value };
    });
    if (!didChange) return;
    setCurrentPage(1);
    hmQueryCacheRef.current.clear();
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

  // Find custom field definitions for individual row actions
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

  // Get unique status values for filter dropdown
  const statusOptions = useMemo(() => {
    if (statusField?.options && statusField.options.length > 0) {
      return statusField.options.map((s: string) => ({ label: s, value: s }));
    }
    const statuses = new Set<string>();
    hiringManagers.forEach((hm) => {
      if (hm.status) statuses.add(hm.status);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [statusField, hiringManagers]);

  const handleIndividualActionSuccess = () => {
    setShowOwnershipModal(false);
    setShowStatusModal(false);
    setShowTearsheetModal(false);
    setShowNoteModal(false);
    setShowTaskModal(false);
    setSelectedHmId(null);
    hmQueryCacheRef.current.clear();
    void fetchHiringManagers(currentPage);
  };

  // CSV Export function for selected records
  const handleCSVExport = () => {
    if (selectedHiringManagers.length === 0) return;

    const selectedData = hiringManagers.filter((hm) =>
      selectedHiringManagers.includes(hm.id)
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
      ...selectedData.map((hm) => {
        const row = columnFields.map((key) =>
          key === "record_number" ? escapeCSV(`HM ${getColumnValue(hm, key)}`) : escapeCSV(getColumnValue(hm, key))
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
    link.setAttribute('download', `hiring-managers-export-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const shouldApplyClientGlobalSearch = totalHmCount == null;
  const shouldApplyClientColumnFilters =
    isAdvancedFullMode || totalHmCount == null;

  // Apply per-column filtering and sorting (exclude archived in main overview)
  const filteredAndSortedHiringManagers = useMemo(() => {
    let result = hiringManagers.filter(
      (hm) => hm.status !== "Archived" && !hm.archived_at
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

    // Apply global search
    if (shouldApplyClientGlobalSearch && deferredSearchTerm.trim() !== "") {
      const term = deferredSearchTerm.toLowerCase();
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
        String(hm.organization_id ?? "").toLowerCase().includes(term)
      );
    }

    if (shouldApplyClientColumnFilters) {
      Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
        if (!filterValue || filterValue.trim() === "") return;

        result = result.filter((hm) => {
          const value = getColumnValue(hm, columnKey);
          const valueStr = String(value).toLowerCase();
          const filterStr = String(filterValue).toLowerCase();

          const columnInfo = getColumnInfo(columnKey);
          if (columnInfo?.filterType === "number") {
            return String(value) === String(filterValue);
          }
          if (columnInfo?.filterType === "select") {
            return valueStr === filterStr;
          }

          return valueStr.includes(filterStr);
        });
      });
    }

    return result;
  }, [
    hiringManagers,
    columnFilters,
    deferredSearchTerm,
    advancedSearchCriteria,
    shouldApplyClientGlobalSearch,
    shouldApplyClientColumnFilters,
  ]);

  const visibleResultsCount =
    totalHmCount != null &&
    advancedSearchCriteria.length === 0 &&
    !shouldApplyClientColumnFilters
      ? totalHmCount
      : filteredAndSortedHiringManagers.length;
  const totalPages = isAdvancedFullMode
    ? 1
    : totalHmCount != null
      ? Math.max(1, Math.ceil(totalHmCount / pageSize))
      : null;
  const canGoPrev = currentPage > 1 && !isPageLoading && !isLoading;
  const canGoNext =
    !isAdvancedFullMode &&
    (totalPages != null
      ? currentPage < totalPages
      : hiringManagers.length === pageSize) &&
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

  const showTableSkeleton = isLoading || isPageLoading;
  const visibleTableColumnKeys = columnFields.filter((k) =>
    hmColumnsCatalog.some((c) => c.key === k)
  );
  const skeletonColumnCount =
    visibleTableColumnKeys.length > 0 ? visibleTableColumnKeys.length : 6;
  const skeletonRowCount = Math.min(pageSize, 12);

  const handleDeleteHiringManager = (hm: any) => {
    setSelectedForDelete(hm);
    setShowDeleteModal(true);
  };

  const handleViewHiringManager = (id: string) => {
    router.push(`/dashboard/hiring-managers/view?id=${id}`);
  };

  const handleViewArchived = () => {
    router.push("/dashboard/hiring-managers/archived");
  };

  const handleAddHiringManager = () => {
    router.push("/dashboard/hiring-managers/add");
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
    e.stopPropagation(); // Prevent row click event

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

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - responsive: search/filters on top, then actions */}
      <div className="p-4 border-b border-gray-200 space-y-3 md:space-y-0 md:flex md:justify-between md:items-center space-x-4 w-full">
        {/* Row 1: Title + Search + Filter + Clear + Add (mobile) */}
        <div className="w-full flex justify-between items-center gap-4">
          <h1 className="text-xl font-bold">Hiring Managers</h1>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search hiring managers..."
                    className="w-full p-2 pl-10 pr-36 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-500">
                    {(isLoading || isPageLoading) && (
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
              {(searchInput || searchTerm ||
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
          <button onClick={handleAddHiringManager} className="md:hidden px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add
          </button>
        </div>

        <div className="hidden md:flex space-x-4 items-center">
          {selectedHiringManagers.length > 0 && (
            <>
              <BulkActionsButton
                selectedCount={selectedHiringManagers.length}
                entityType="hiring-manager"
                entityIds={selectedHiringManagers}
                availableFields={availableFields}
                onSuccess={() => {
                  hmQueryCacheRef.current.clear();
                  void fetchHiringManagers(currentPage);
                  setSelectedHiringManagers([]);
                  setSelectAll(false);
                }}
                onCSVExport={handleCSVExport}
                onDelete={() => setShowBulkDeleteModal(true)}
              />
            </>
          )}
          <div ref={favoritesMenuRef} className="relative">
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
          <button onClick={handleViewArchived} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center">
            Archived
          </button>
          <button onClick={handleAddHiringManager} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add
          </button>
        </div>

        {selectedHiringManagers.length > 0 && (
          <div className="w-full md:hidden">
            <BulkActionsButton
              selectedCount={selectedHiringManagers.length}
              entityType="hiring-manager"
              entityIds={selectedHiringManagers}
              availableFields={availableFields}
              onSuccess={() => {
                hmQueryCacheRef.current.clear();
                void fetchHiringManagers(currentPage);
                setSelectedHiringManagers([]);
                setSelectAll(false);
              }}
              onCSVExport={handleCSVExport}
              onDelete={() => setShowBulkDeleteModal(true)}
            />
          </div>
        )}
        <div className="w-full md:hidden" ref={favoritesMenuMobileRef}>
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
          <button onClick={handleViewArchived} className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center">Archived</button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{error}</p>
        </div>
      )}

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
        recentStorageKey="hiringManagersAdvancedSearchRecent"
        initialCriteria={advancedSearchCriteria}
        anchorEl={advancedSearchButtonRef.current}
      />

      {/* Hiring Managers Table */}
        <div className="overflow-x-auto overflow-y-auto h-[80vh]">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* Fixed checkbox header */}
                  <th className="sticky top-0 z-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </th>

                {/* Fixed Actions header */}
                  <th className="sticky top-0 z-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
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
                        filterType={(columnInfo as any).filterType || "text"}
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
              ) : filteredAndSortedHiringManagers.length > 0 ? (
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
                        options={[
                          { label: "View", action: () => handleViewHiringManager(hm.id) },
                          ...(ownerField ? [{
                            label: "Change Ownership",
                            action: () => {
                              setSelectedHmId(hm.id);
                              setShowOwnershipModal(true);
                            },
                          }] : []),
                          ...(statusField ? [{
                            label: "Change Status",
                            action: () => {
                              setSelectedHmId(hm.id);
                              setShowStatusModal(true);
                            },
                          }] : []),
                          {
                            label: "Add Note",
                            action: () => {
                              setSelectedHmId(hm.id);
                              setShowNoteModal(true);
                            },
                          },
                          {
                            label: "Add To TearSheet",
                            action: () => {
                              setSelectedHmId(hm.id);
                              setShowTearsheetModal(true);
                            },
                          },
                          {
                            label: "Create Task",
                            action: () => {
                              router.push(
                                `/dashboard/tasks/add?relatedEntity=hiring_manager&relatedEntityId=${encodeURIComponent(
                                  hm.id
                                )}`
                              );
                            },
                          },
                          {
                            label: "Delete",
                            action: () => handleDeleteHiringManager(hm),
                          },
                        ]}
                      />
                    </td>

                    {/* Dynamic cells (including Record #) */}
                    {columnFields.filter(k => hmColumnsCatalog.some(c => c.key === k)).map((key) => {
                      if (key === "record_number") {
                        return (
                          <td key={key} className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              HM {getColumnValue(hm, key)}
                            </div>
                          </td>
                        );
                      }
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
                            value={getColumnValue(hm, key)}
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
                    colSpan={3 + visibleTableColumnKeys.length}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                  >
                    {Object.keys(columnFilters).length > 0
                      ? "No hiring managers found matching your filters."
                      : 'No hiring managers found. Click "Add Hiring Manager" to create one.'}
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
            {showTableSkeleton ? (
              <p className="text-sm text-gray-500">Loading results…</p>
            ) : (
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to{" "}
                <span className="font-medium">{filteredAndSortedHiringManagers.length}</span>{" "}
                of{" "}
                <span className="font-medium">{filteredAndSortedHiringManagers.length}</span>{" "}
                results
              </p>
            )}
          </div>
          {!showTableSkeleton && filteredAndSortedHiringManagers.length > 0 && (
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
      {/* Column Modal - uses universal SortableFieldsEditModal */}
      {showColumnModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowColumnModal(false)}
          title="Customize Columns"
          description="Drag to reorder, check/uncheck to show or hide columns in the table. Changes apply to the hiring manager list."
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
          onReset={() => {
            const required = (availableFields || [])
              .filter(f => f.is_required || f.required || f.isRequired)
              .map(f => {
                const name = f.field_name || f.fieldName || "";
                const isBackendCandidate = HM_BACKEND_COLUMN_KEYS.includes(name);
                return isBackendCandidate ? name : `custom:${f.field_label || f.fieldLabel || f.field_name || f.id}`;
              });
            const defaults = Array.from(new Set(["record_number", ...HM_BACKEND_COLUMN_KEYS.slice(0, 4), ...required]));
            setColumnFields(defaults);
          }}
          resetButtonText="Reset"
          listMaxHeight="60vh"
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

      {/* Individual Row Action Modals */}
      {showOwnershipModal && ownerField && selectedHmId && (
        <BulkOwnershipModal
          open={showOwnershipModal}
          onClose={() => {
            setShowOwnershipModal(false);
            setSelectedHmId(null);
          }}
          entityType="hiring-manager"
          entityIds={[selectedHmId]}
          fieldLabel={ownerField.field_label || 'Owner'}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showStatusModal && statusField && selectedHmId && (
        <BulkStatusModal
          open={showStatusModal}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedHmId(null);
          }}
          entityType="hiring-manager"
          entityIds={[selectedHmId]}
          fieldLabel={statusField.field_label || 'Status'}
          options={statusField.options || []}
          availableFields={availableFields}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showTearsheetModal && selectedHmId && (
        <BulkTearsheetModal
          open={showTearsheetModal}
          onClose={() => {
            setShowTearsheetModal(false);
            setSelectedHmId(null);
          }}
          entityType="hiring-manager"
          entityIds={[selectedHmId]}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showNoteModal && selectedHmId && (
        <BulkNoteModal
          open={showNoteModal}
          onClose={() => {
            setShowNoteModal(false);
            setSelectedHmId(null);
          }}
          entityType="hiring-manager"
          entityIds={[selectedHmId]}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showTaskModal && selectedHmId && (
        <BulkTaskModal
          open={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedHmId(null);
          }}
          entityType="hiring-manager"
          entityIds={[selectedHmId]}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      <EntityDeleteModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedForDelete(null); }}
        onSuccess={() => {
          hmQueryCacheRef.current.clear();
          void fetchHiringManagers(currentPage);
        }}
        entityId={selectedForDelete?.id}
        entityData={selectedForDelete}
        entityType="hiring-managers"
      />

      <EntityBulkDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onSuccess={() => {
          hmQueryCacheRef.current.clear();
          void fetchHiringManagers(currentPage);
          setSelectedHiringManagers([]);
          setSelectAll(false);
        }}
        entityIds={selectedHiringManagers}
        entityType="hiring-managers"
        selectedCount={selectedHiringManagers.length}
      />
    </div>
  );
}
