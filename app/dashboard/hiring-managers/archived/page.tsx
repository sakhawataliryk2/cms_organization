'use client'

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "nextjs-toploader/app";
import LoadingScreen from "@/components/LoadingScreen";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { useServerEntityList } from "@/hooks/useServerEntityList";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import { IoFilterSharp } from "react-icons/io5";
import CountdownTimer from "@/components/CountdownTimer";
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

const FAVORITES_STORAGE_KEY = "hiringManagersArchivedFavorites";

export default function ArchivedHiringManagersList() {
  const router = useRouter();

  const {
    items: hiringManagers,
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
    totalCount: totalHiringManagersCount,
    totalPages,
    visibleResultsCount,
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
  } = useServerEntityList<HiringManager>({
    apiPath: "/api/hiring-managers",
    responseKey: "hiringManagers",
    extraQueryParams: { archivedOnly: "1" },
  });

  const refreshList = () => {
    clearCache();
    void fetchPage(currentPage);
  };

  const [selectedHiringManagers, setSelectedHiringManagers] = useState<
    string[]
  >([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);

  // Favorites State
  const [favorites, setFavorites] = useState<HiringManagerFavorite[]>([]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const favoritesMenuRef = useRef<HTMLDivElement>(null);
  const favoritesMenuMobileRef = useRef<HTMLDivElement>(null);
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

  // Favorites Logic
  const persistFavorites = (updated: HiringManagerFavorite[]) => {
    setFavorites(updated);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
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

  // =====================
  // AVAILABLE FIELDS (from Modify Page)
  // =====================
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

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

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(date);
  };

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

    if (key === "archive_reason") {
      return hm.archive_reason || "N/A";
    }
    const val = hm[key];
    if (val === undefined || val === null || val === "") return "—";
    if (key === "created_at" && typeof val === "string") return formatDate(val);
    return String(val);
  };

  useEffect(() => {
    const catalogKeys = hmColumnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);
    const savedOrder = localStorage.getItem("hiringManagerArchivedColumnOrder");
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
  }, [hmColumnsCatalog, setColumnFields]);

  useEffect(() => {
    if (columnFields.length === 0) return;
    const savingOnlyRecordNumber =
      columnFields.length === 1 && columnFields[0] === "record_number";
    if (savingOnlyRecordNumber) {
      try {
        const saved = localStorage.getItem("hiringManagerArchivedColumnOrder");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 1) return;
        }
      } catch {
        // ignore
      }
    }
    localStorage.setItem("hiringManagerArchivedColumnOrder", JSON.stringify(columnFields));
  }, [columnFields]);

  const applyFavorite = (fav: HiringManagerFavorite) => {
    const catalogKeys = new Set(hmColumnsCatalog.map((c) => c.key));
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

    setSearchInput(fav.searchTerm || "");
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
    clearListFilters();
    setAdvancedSearchCriteria([]);
    setSelectedFavoriteId(null);
  };

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

  const displayedHiringManagers = useMemo(() => {
    if (advancedSearchCriteria.length === 0) return hiringManagers;

    const matchesAdvancedCriterion = (
      hm: HiringManager,
      c: AdvancedSearchCriterion
    ): boolean => {
      const raw = getColumnValue(hm, c.fieldKey);
      const colInfo = getColumnInfo(c.fieldKey);
      const fieldType = (colInfo as any)?.fieldType ?? "";
      return matchesAdvancedValue(raw, fieldType, c);
    };

    return hiringManagers.filter((hm) =>
      advancedSearchCriteria.every((c) => matchesAdvancedCriterion(hm, c))
    );
  }, [hiringManagers, advancedSearchCriteria, hmColumnsCatalog]);

  const visibleTableColumnKeys = columnFields.filter((k) =>
    hmColumnsCatalog.some((c) => c.key === k)
  );
  const skeletonColumnCount =
    visibleTableColumnKeys.length > 0 ? visibleTableColumnKeys.length : 6;
  const skeletonRowCount = Math.min(pageSize, 12);

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
      setSelectedHiringManagers(displayedHiringManagers.map((hm) => hm.id));
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
      if (
        [...selectedHiringManagers, id].length === displayedHiringManagers.length
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

    setIsDeleting(true);
    setDeleteError(null);

    try {
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

      const results = await Promise.allSettled(deletePromises);
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} hiring managers`);
      }

      refreshList();
      setSelectedHiringManagers([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting hiring managers:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting hiring managers"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDeleting) {
    return <LoadingScreen message="Deleting hiring managers..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - responsive: search/filters on top, then actions */}
      <div className="p-4 border-b border-gray-200 space-y-3 md:space-y-0 md:flex md:justify-between md:items-center space-x-4 w-full">
        {/* Row 1: Back arrow + Title + Search + Filter + Clear */}
        <div className="w-full flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleBackToHiringManagers}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center bg-white text-gray-700"
              title="Back to Hiring Managers"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">Archived Hiring Managers</h1>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search archived hiring managers..."
                  className="w-full p-2 pl-10 pr-36 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-500">
                  {(isLoading || isPageLoading) && (
                    <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  )}
                  <span>
                    {isLoading ? "…" : `${visibleResultsCount} found`}
                  </span>
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
          {selectedHiringManagers.length > 0 && (
            <button onClick={deleteSelectedHiringManagers} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              Delete Selected ({selectedHiringManagers.length})
            </button>
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
        </div>

        {selectedHiringManagers.length > 0 && (
          <div className="w-full md:hidden">
            <button onClick={deleteSelectedHiringManagers} className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-2">Delete Selected ({selectedHiringManagers.length})</button>
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
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{error}</p>
        </div>
      )}

      {deleteError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{deleteError}</p>
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
        recentStorageKey="hiringManagersArchivedAdvancedSearchRecent"
        initialCriteria={advancedSearchCriteria}
        anchorEl={advancedSearchButtonRef.current}
      />

      <div className="w-full max-w-full overflow-x-hidden">
        {/* Hiring Managers Table */}
        <div className="overflow-x-auto overflow-y-auto h-[80vh]">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky top-0 z-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </th>

                  <th className="sticky top-0 z-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Actions
                  </th>

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
                {showTableSkeleton ? (
                  <TableSkeletonRows
                    rowCount={skeletonRowCount}
                    columnCount={skeletonColumnCount}
                  />
                ) : displayedHiringManagers.length > 0 ? (
                  displayedHiringManagers.map((hm) => (
                    <tr
                      key={hm.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleViewHiringManager(hm.id)}
                    >
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
                                setIsDeleting(true);
                                setDeleteError(null);
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
                                  refreshList();
                                } catch (err) {
                                  setDeleteError(
                                    err instanceof Error
                                      ? err.message
                                      : "Delete failed"
                                  );
                                } finally {
                                  setIsDeleting(false);
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
                                <span className="text-sm font-medium text-gray-900">HM {getColumnValue(hm, key)}</span>
                                {hm.archived_at && (
                                  <CountdownTimer archivedAt={hm.archived_at} />
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
                      colSpan={3 + visibleTableColumnKeys.length}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                    >
                      {Object.keys(columnFilters).length > 0 || advancedSearchCriteria.length > 0
                        ? "No archived hiring managers match your filters."
                        : searchInput
                          ? "No archived hiring managers match your search."
                          : "No archived hiring managers found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>

        <ServerListPagination
          entityLabel="hiring managers"
          currentPage={currentPage}
          pageSize={pageSize}
          itemsOnPage={displayedHiringManagers.length}
          totalCount={totalHiringManagersCount}
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
            setSelectedHiringManagers([]);
            setSelectAll(false);
          }}
        />
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
                  {advancedSearchCriteria.length > 0 && (
                    <li>{advancedSearchCriteria.length} advanced search criteria</li>
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
