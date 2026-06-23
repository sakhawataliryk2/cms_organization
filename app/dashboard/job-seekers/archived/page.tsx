"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "nextjs-toploader/app";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import { useHeaderViewConfig, useUserViewConfig } from "@/hooks/useUserViewConfig";
import { VIEW_ENTITY_TYPES } from "@/lib/viewConfigEntityTypes";
import { catalogKeyFromColumn, remapLegacyCustomKeys, resolveCustomColumnValue } from "@/lib/fieldCatalogKeys";
import { useServerEntityList } from "@/hooks/useServerEntityList";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import CountdownTimer from "@/components/CountdownTimer";
import { IoFilterSharp } from "react-icons/io5";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { FiStar, FiChevronDown, FiChevronLeft, FiX } from "react-icons/fi";
import ActionDropdown from "@/components/ActionDropdown";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import SortableColumnHeader, {
  type ColumnFilterState,
  type ColumnSortState,
} from "@/components/SortableColumnHeader";
import ServerListPagination from "@/components/ServerListPagination";
import AdvancedSearchPanel, {
  type AdvancedSearchCriterion,
} from "@/components/AdvancedSearchPanel";
import { matchesAdvancedValue } from "@/lib/advancedSearch";

interface JobSeeker {
  id: string;
  record_number?: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  last_contact_date: string;
  owner: string;
  created_at: string;
  created_by_name: string;
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
  archived_at?: string | null;
  archive_reason?: string | null;
}

type JobSeekerFavorite = {
  id: string;
  name: string;
  searchTerm: string;
  columnFilters: Record<string, ColumnFilterState>;
  columnSorts: Record<string, ColumnSortState>;
  columnFields: string[];
  advancedSearchCriteria?: AdvancedSearchCriterion[];
  createdAt: number;
};

export default function ArchivedJobSeekersList() {
  const router = useRouter();
  const [archivedActionsOpen, setArchivedActionsOpen] = useState(false);
  const [selectedJobSeekers, setSelectedJobSeekers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const {
    items: jobSeekers,
    searchInput,
    setSearchInput,
    searchTerm,
    columnSorts,
    setColumnSorts,
    columnFilters,
    setColumnFilters,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    totalCount: totalJobSeekersCount,
    totalPages,
    isLoading,
    isPageLoading,
    error,
    fetchPage,
    clearCache,
    handleColumnSort,
    handleColumnFilter,
    handleClearAllFilters: clearListFilters,
    PAGE_SIZE_OPTIONS,
    canGoPrev,
    canGoNext,
    paginationItems,
    showTableSkeleton,
  } = useServerEntityList<JobSeeker>({
    apiPath: "/api/job-seekers",
    responseKey: "jobSeekers",
    extraQueryParams: { archived: "true" },
  });

  const refreshList = useCallback(() => {
    clearCache();
    void fetchPage(currentPage);
  }, [clearCache, fetchPage, currentPage]);

  // Favorites State
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteNameError, setFavoriteNameError] = useState<string | null>(null);

  const { value: favoritesRaw, setValue: setFavoritesConfig } = useUserViewConfig({
    entityType: VIEW_ENTITY_TYPES.jobSeekersArchived,
    key: "favorites",
    defaultValue: [],
  });
  const favorites = (favoritesRaw as JobSeekerFavorite[]) || [];

  const persistFavorites = (updated: JobSeekerFavorite[]) => {
    setFavoritesConfig(updated);
  };

  const applyFavorite = (fav: JobSeekerFavorite) => {
    // 1. Validate columns against current catalog
    const catalogKeys = new Set(jsColumnsCatalog.map((c) => c.key));
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
    setColumnFilters(nextFilters);
    setColumnSorts(nextSorts);
    clearCache();
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

    const newFav: JobSeekerFavorite = {
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
    clearListFilters();
    setAdvancedSearchCriteria([]);
    setSelectedFavoriteId(null);
  };

  const JS_BACKEND_COLUMN_KEYS = [
    "full_name",
    "status",
    "archive_reason",
    "email",
    "phone",
    "last_contact_date",
    "owner",
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

        const res = await fetch("/api/admin/field-management/job-seekers", {
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
          data.jobSeekerFields ||
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

  const jsColumnsCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const name = String((f as any)?.field_name ?? (f as any)?.fieldName ?? "").trim();
        const fieldType = (f as any)?.field_type;
        const lookupType = (f as any)?.lookup_type || "";
        const multiSelectLookupType = (f as any)?.multi_select_lookup_type ?? (f as any)?.multiSelectLookupType ?? "";
        const label = (f as any)?.field_label ?? (f as any)?.fieldLabel ?? (name ? humanize(name) : "");
        const isBackendCol = name && JS_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        if (name === "status" || name === "archive_reason") filterType = "select";
        return {
          fieldType,
          lookupType,
          multiSelectLookupType,
          key: catalogKeyFromColumn(name, String(label || name), !!isBackendCol),
          label: String(label || name),
          name: String(name || label || ""),
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

    const merged = [
      { key: "record_number", label: "Record Number", sortable: true, filterType: "number" as const, fieldType: undefined, lookupType: "", multiSelectLookupType: "" },
      ...fromApi,
    ];
    if (!merged.some((x) => x.key === "archive_reason")) {
      merged.push({
        fieldType: undefined,
        lookupType: "",
        multiSelectLookupType: "",
        key: "archive_reason",
        label: "Archive Reason",
        name: "archive_reason",
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
  }, [availableFields, jobSeekers]);
  const getColumnLabel = (key: string) =>
    jsColumnsCatalog.find((c) => c.key === key)?.label ?? key;

  const getColumnInfo = (key: string) =>
    jsColumnsCatalog.find((c) => c.key === key);

  const getColumnValue = (js: any, key: string) => {
    if (key === "record_number") {
      return js.record_number ?? js.id;
    }
    if (key.startsWith("custom:")) {
      const resolved = resolveCustomColumnValue(js, key, getColumnInfo(key));
      if (resolved === undefined || resolved === null || resolved === "") return "—";
      return String(resolved);
    }

    if (key === "archive_reason") {
      return js.archive_reason || "N/A";
    }
    // Standard backend keys (fallback from API shape)
    const val = js[key];
    if (val === undefined || val === null || val === "") return "—";
    if ((key === "created_at" || key === "last_contact_date") && typeof val === "string") return formatDate(val);
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

  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderViewConfig({
    entityType: VIEW_ENTITY_TYPES.jobSeekersArchived,
    configType: "columns",
    defaultFields: [],
  });

  useEffect(() => {
    const catalogKeys = jsColumnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);

    if (columnFields.length > 0) {
      let validOrder = remapLegacyCustomKeys(columnFields, jsColumnsCatalog).filter(
        (k: string) => catalogSet.has(k)
      );
      if (catalogSet.has("record_number") && !validOrder.includes("record_number")) {
        validOrder = ["record_number", ...validOrder];
      }
      const wouldCollapseToRecordNumberOnly =
        columnFields.length > 1 &&
        validOrder.length === 1 &&
        validOrder[0] === "record_number";
      if (!wouldCollapseToRecordNumberOnly && validOrder.length > 0) {
        if (JSON.stringify(validOrder) !== JSON.stringify(columnFields)) {
          setColumnFields(validOrder);
        }
        return;
      }
    }

    setColumnFields((prev) => (prev.length === 0 ? catalogKeys : prev));
  }, [jsColumnsCatalog, columnFields, setColumnFields]);

  useEffect(() => {
    setCurrentPage(1);
  }, [advancedSearchCriteria, setCurrentPage]);

  const shouldApplyClientColumnFilters =
    advancedSearchCriteria.length > 0 || totalJobSeekersCount == null;

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
    jobSeekers.forEach((js) => {
      if (js.status) statuses.add(js.status);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [jobSeekers]);

  const archiveReasonOptions = useMemo(
    () => [
      { label: "Deletion", value: "Deletion" },
      { label: "Transfer", value: "Transfer" },
    ],
    []
  );

  const filteredAndSortedJobSeekers = useMemo(() => {
    let result = jobSeekers;

    const matchesAdvancedCriterion = (
      js: JobSeeker,
      c: AdvancedSearchCriterion
    ): boolean => {
      const raw = getColumnValue(js, c.fieldKey);
      const colInfo = getColumnInfo(c.fieldKey);
      const fieldType = (colInfo as any)?.fieldType ?? "";
      return matchesAdvancedValue(raw, fieldType, c);
    };

    if (advancedSearchCriteria.length > 0) {
      result = result.filter((js) =>
        advancedSearchCriteria.every((c) => matchesAdvancedCriterion(js, c))
      );
    }

    if (shouldApplyClientColumnFilters) {
      Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
        if (!filterValue || filterValue.trim() === "") return;

        result = result.filter((js) => {
          const value = getColumnValue(js, columnKey);
          const valueStr = String(value).toLowerCase();
          const filterStr = String(filterValue).toLowerCase();
          const columnInfo = getColumnInfo(columnKey);
          if (columnInfo && (columnInfo as any).filterType === "number") {
            return String(value) === String(filterValue);
          }
          if (columnInfo && (columnInfo as any).filterType === "select") {
            return valueStr === filterStr;
          }
          return valueStr.includes(filterStr);
        });
      });
    }

    return result;
  }, [jobSeekers, columnFilters, advancedSearchCriteria, shouldApplyClientColumnFilters]);

  const displayResultsCount =
    totalJobSeekersCount != null &&
    advancedSearchCriteria.length === 0 &&
    !shouldApplyClientColumnFilters
      ? totalJobSeekersCount
      : filteredAndSortedJobSeekers.length;

  const visibleTableColumnKeys = columnFields.filter((k) =>
    jsColumnsCatalog.some((c) => c.key === k)
  );
  const skeletonColumnCount =
    visibleTableColumnKeys.length > 0 ? visibleTableColumnKeys.length : 6;
  const skeletonRowCount = Math.min(pageSize, 12);

  const handleViewJobSeeker = (id: string) => {
    router.push(`/dashboard/job-seekers/view?id=${id}`);
  };

  const handleBackToJobSeekers = () => {
    router.push("/dashboard/job-seekers");
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedJobSeekers([]);
    } else {
      setSelectedJobSeekers(filteredAndSortedJobSeekers.map((js) => js.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectJobSeeker = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (selectedJobSeekers.includes(id)) {
      setSelectedJobSeekers(
        selectedJobSeekers.filter((jsId) => jsId !== id)
      );
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedJobSeekers([...selectedJobSeekers, id]);
      if (
        [...selectedJobSeekers, id].length === filteredAndSortedJobSeekers.length
      ) {
        setSelectAll(true);
      }
    }
  };

  const deleteSelectedJobSeekers = async () => {
    if (selectedJobSeekers.length === 0) return;

    const confirmMessage =
      selectedJobSeekers.length === 1
        ? "Are you sure you want to permanently delete this job seeker?"
        : `Are you sure you want to permanently delete these ${selectedJobSeekers.length} job seekers?`;

    if (!window.confirm(confirmMessage)) return;

    setIsMutating(true);
    setMutationError(null);

    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const deletePromises = selectedJobSeekers.map((id) =>
        fetch(`/api/job-seekers/${id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} job seekers`);
      }

      refreshList();
      setSelectedJobSeekers([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting job seekers:", err);
      setMutationError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting job seekers"
      );
    } finally {
      setIsMutating(false);
    }
  };

  const unarchiveSelectedJobSeekers = async () => {
    if (selectedJobSeekers.length === 0) return;
    if (
      !window.confirm(
        `Unarchive ${selectedJobSeekers.length} record(s)? An unarchive request will be sent.`
      )
    ) {
      return;
    }

    setIsMutating(true);
    setMutationError(null);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      for (const id of selectedJobSeekers) {
        const res = await fetch(`/api/job-seekers/${id}/unarchive-request`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error("Unarchive request failed");
      }
      refreshList();
      setSelectedJobSeekers([]);
      setSelectAll(false);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unarchive failed");
    } finally {
      setIsMutating(false);
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
        {/* Row 1: Back arrow + Title + Search + Filter + Clear */}
        <div className="w-full flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleBackToJobSeekers}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center bg-white text-gray-700"
              title="Back to Job Seekers"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">Archived Job Seekers</h1>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search archived job seekers..."
                  className="w-full p-2 pl-10 pr-36 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-500">
                  {(isLoading || isPageLoading) && (
                    <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  )}
                  <span>{isLoading ? "…" : `${displayResultsCount} found`}</span>
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
                className={`px-4 py-2.5 text-sm font-medium rounded border flex items-center gap-2 ${
                  showAdvancedSearch || advancedSearchCriteria.length > 0
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
        </div>

        <div className="hidden md:flex space-x-4">
          {selectedJobSeekers.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setArchivedActionsOpen((v) => !v)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 flex items-center gap-1"
              >
                Actions ({selectedJobSeekers.length})
                <FiChevronDown className="ml-1" />
              </button>
              {archivedActionsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setArchivedActionsOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-20 py-1">
                    <button
                      onClick={() => { setArchivedActionsOpen(false); deleteSelectedJobSeekers(); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete Permanently
                    </button>
                    <button
                      onClick={() => {
                        setArchivedActionsOpen(false);
                        void unarchiveSelectedJobSeekers();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      disabled={isMutating}
                    >
                      Unarchive
                    </button>
                  </div>
                </>
              )}
            </div>
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
        </div>

        {selectedJobSeekers.length > 0 && (
          <div className="w-full md:hidden relative">
            <button
              onClick={() => setArchivedActionsOpen((v) => !v)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 flex items-center justify-center gap-2"
            >
              Actions ({selectedJobSeekers.length})
              <FiChevronDown />
            </button>
            {archivedActionsOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 py-1">
                <button onClick={() => { setArchivedActionsOpen(false); deleteSelectedJobSeekers(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete Permanently</button>
                <button
                  onClick={() => {
                    setArchivedActionsOpen(false);
                    void unarchiveSelectedJobSeekers();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={isMutating}
                >
                  Unarchive
                </button>
              </div>
            )}
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
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{error}</p>
        </div>
      )}
      {mutationError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{mutationError}</p>
        </div>
      )}

      <AdvancedSearchPanel
        open={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        fieldCatalog={jsColumnsCatalog.map((c) => ({
          key: c.key,
          label: c.label,
          fieldType: (c as any).fieldType,
          lookupType: (c as any).lookupType,
          multiSelectLookupType: (c as any).multiSelectLookupType,
          options: (c as any).options,
        }))}
        onSearch={(criteria) => setAdvancedSearchCriteria(criteria)}
        recentStorageKey="jobSeekersArchivedAdvancedSearchRecent"
        initialCriteria={advancedSearchCriteria}
        anchorEl={advancedSearchButtonRef.current}
      />

      {/* Job Seekers Table */}
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
                        filterType={columnInfo.filterType || "text"}
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
              {showTableSkeleton ? (
                <TableSkeletonRows
                  rowCount={skeletonRowCount}
                  columnCount={skeletonColumnCount}
                />
              ) : filteredAndSortedJobSeekers.length > 0 ? (
                filteredAndSortedJobSeekers.map((js) => (
                  <tr
                    key={js.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewJobSeeker(js.id)}
                  >
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedJobSeekers.includes(js.id)}
                        onChange={() => { }}
                        onClick={(e) => handleSelectJobSeeker(js.id, e)}
                      />
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ActionDropdown
                        label="Actions"
                        options={[
                          { label: "View", action: () => handleViewJobSeeker(js.id) },
                          {
                            label: "Delete Permanently",
                            action: async () => {
                              if (!window.confirm("Are you sure you want to permanently delete this job seeker?")) return;
                              setIsMutating(true);
                              setMutationError(null);
                              try {
                                const token = document.cookie.split("; ").find((row) => row.startsWith("token="))?.split("=")[1];
                                const res = await fetch(`/api/job-seekers/${js.id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                                if (!res.ok) throw new Error("Failed to delete job seeker");
                                refreshList();
                              } catch (err) {
                                setMutationError(err instanceof Error ? err.message : "Delete failed");
                              } finally {
                                setIsMutating(false);
                              }
                            },
                          },
                          {
                            label: "Unarchive",
                            action: async () => {
                              if (!window.confirm("Send unarchive request for this job seeker?")) return;
                              setIsMutating(true);
                              setMutationError(null);
                              try {
                                const token = document.cookie.split("; ").find((row) => row.startsWith("token="))?.split("=")[1];
                                const res = await fetch(`/api/job-seekers/${js.id}/unarchive-request`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                                if (!res.ok) throw new Error("Unarchive request failed");
                                refreshList();
                              } catch (err) {
                                setMutationError(err instanceof Error ? err.message : "Unarchive failed");
                              } finally {
                                setIsMutating(false);
                              }
                            },
                          },
                        ]}
                      />
                    </td>
                    {columnFields.map((key) => {
                      if (key === "record_number") {
                        return (
                          <td key={key} className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-gray-900">JS {getColumnValue(js, key)}</span>
                              {js.archived_at && (
                                <CountdownTimer archivedAt={js.archived_at} />
                              )}
                            </div>
                          </td>
                        );
                      }
                      const colInfo = getColumnInfo(key) as { key: string; label: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
                      const fieldInfo = colInfo
                        ? { key: colInfo.key, label: colInfo.label, fieldType: colInfo.fieldType, lookupType: colInfo.lookupType, multiSelectLookupType: colInfo.multiSelectLookupType }
                        : { key, label: getColumnLabel(key) };
                      const isArchiveReason = getColumnLabel(key).toLowerCase() === "archive reason";
                      return (
                        <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <FieldValueRenderer
                            value={getColumnValue(js, key)}
                            fieldInfo={fieldInfo}
                            emptyPlaceholder="—"
                            clickable
                            stopPropagation
                            forceRenderAsStatus={isArchiveReason}
                            statusVariant={isArchiveReason && String(getColumnValue(js, key) || "").toLowerCase() === "deletion" ? "deletion" : "blue"}
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
                    {searchInput || Object.keys(columnFilters).length > 0 || advancedSearchCriteria.length > 0
                      ? "No archived job seekers match your search."
                      : "No archived job seekers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>

      <ServerListPagination
        entityLabel="job seekers"
        currentPage={currentPage}
        pageSize={pageSize}
        itemsOnPage={filteredAndSortedJobSeekers.length}
        totalCount={totalJobSeekersCount}
        totalPages={totalPages}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        paginationItems={paginationItems}
        isLoading={showTableSkeleton}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
          setSelectedJobSeekers([]);
          setSelectAll(false);
        }}
      />
      {/* Column Modal - uses universal SortableFieldsEditModal */}
      {showColumnModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowColumnModal(false)}
          title="Customize Columns"
          description="Drag to reorder, check/uncheck to show or hide columns in the table. Changes apply to the archived job seeker list."
          order={[
            ...columnFields,
            ...jsColumnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
          ]}
          visible={Object.fromEntries(jsColumnsCatalog.map((c) => [c.key, columnFields.includes(c.key)]))}
          fieldCatalog={jsColumnsCatalog.map((c) => ({ key: c.key, label: c.label }))}
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
              ...jsColumnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
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
          onReset={() => setColumnFields(jsColumnsCatalog.map((c) => c.key))}
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
    </div>
  );
}
