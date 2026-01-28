"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
import {
  FiArrowUp,
  FiArrowDown,
  FiFilter,
  FiStar,
  FiChevronDown,
  FiX,
} from "react-icons/fi";

interface Organization {
  id: string;
  name: string;
  website: string;
  status: string;
  contact_phone: string;
  address: string;
  created_at: string;
  created_by_name: string;
  job_orders_count?: number;
  placements_count?: number;
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

type OrganizationFavorite = {
  id: string;
  name: string;
  searchTerm: string;
  columnFilters: Record<string, ColumnFilterState>;
  columnSorts: Record<string, ColumnSortState>;
  columnFields: string[];
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

  // Close filter on outside click
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
      ref={setNodeRef}
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

      {/* Filter Dropdown */}
      {showFilter && (
        <div
          ref={filterRef}
          className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 shadow-lg p-2 mt-1"
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
              className="mt-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Clear Filter
            </button>
          )}
        </div>
      )}
    </th>
  );
}

export default function OrganizationList() {
  const router = useRouter();

  const FAVORITES_STORAGE_KEY = "organizationFavorites";

  // =====================
  // TABLE COLUMNS (Overview List)
  // =====================
  const ORG_DEFAULT_COLUMNS = [
    "name",
    "status",
    "contact_phone",
    "address",
    "job_orders_count",
    "placements_count",
  ];

  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "ORGANIZATION",
    defaultFields: ORG_DEFAULT_COLUMNS,
    configType: "columns",
  });

  // Load column order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem("organizationColumnOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Only use saved order if it contains valid column keys
          const validOrder = parsed.filter((key) =>
            [...ORG_DEFAULT_COLUMNS, ...columnFields].includes(key)
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
      localStorage.setItem("organizationColumnOrder", JSON.stringify(columnFields));
    }
  }, [columnFields]);

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  const [favorites, setFavorites] = useState<OrganizationFavorite[]>([]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string>("");

  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const favoritesMenuRef = useRef<HTMLDivElement>(null);

  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteNameError, setFavoriteNameError] = useState<string | null>(null);

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

        const res = await fetch("/api/admin/field-management/organizations", {
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
          data.organizationFields ||
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
      if (!favoritesMenuRef.current) return;
      if (!favoritesMenuRef.current.contains(e.target as Node)) {
        setFavoritesMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [favoritesMenuOpen]);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [openActionId, setOpenActionId] = useState<string | null>(null);
  useEffect(() => {
    const close = () => setOpenActionId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Columns Catalog
  const humanize = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const columnsCatalog = useMemo(() => {
    const standard = [
      { key: "name", label: "Company Name", sortable: true, filterType: "text" as const },
      { key: "status", label: "Status", sortable: true, filterType: "select" as const },
      { key: "contact_phone", label: "Phone Number", sortable: true, filterType: "text" as const },
      { key: "address", label: "Address", sortable: true, filterType: "text" as const },
      { key: "job_orders_count", label: "Job Orders", sortable: true, filterType: "number" as const },
      { key: "placements_count", label: "Placements", sortable: true, filterType: "number" as const },
    ];

    const customKeySet = new Set<string>();
    (organizations || []).forEach((org: any) => {
      const cf = org?.customFields || org?.custom_fields || {};
      Object.keys(cf).forEach((k) => customKeySet.add(k));
    });

    const custom = Array.from(customKeySet).map((k) => {
      const kNorm = String(k || "").toLowerCase();
      const fieldDef = availableFields.find((f) => {
        const nameNorm = String((f as any)?.field_name ?? (f as any)?.fieldName ?? "").toLowerCase();
        const labelNorm = String((f as any)?.field_label ?? (f as any)?.fieldLabel ?? "").toLowerCase();
        return nameNorm === kNorm || labelNorm === kNorm;
      });
      const fieldLabel = (fieldDef as any)?.field_label ?? (fieldDef as any)?.fieldLabel;
      return {
        key: `custom:${k}`,
        label: fieldLabel ? String(fieldLabel) : humanize(k),
        sortable: false,
        filterType: "text" as const,
      };
    });

    const merged = [...standard, ...custom];
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [organizations, availableFields]);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnInfo = (key: string) =>
    columnsCatalog.find((c) => c.key === key);

  const getColumnValue = (org: any, key: string) => {
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = org?.customFields || org?.custom_fields || {};
      const val = cf?.[rawKey];
      return val === undefined || val === null || val === ""
        ? "N/A"
        : String(val);
    }

    switch (key) {
      case "name":
        return org.name || "N/A";
      case "status":
        return org.status || "N/A";
      case "contact_phone":
        return org.contact_phone || "N/A";
      case "address":
        return org.address || "N/A";
      case "job_orders_count":
        return org.job_orders_count || 0;
      case "placements_count":
        return org.placements_count || 0;
      default:
        return "N/A";
    }
  };

  // Fetch organizations on component mount
  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/organizations");

      if (!response.ok) {
        // console.log('response', response)
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch organizations");
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      console.error("Error fetching organizations:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching organizations"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique status values for filter dropdown
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    organizations.forEach((org) => {
      if (org.status) statuses.add(org.status);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [organizations]);

  const applyFavorite = (fav: OrganizationFavorite) => {
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
  };

  const persistFavorites = (next: OrganizationFavorite[]) => {
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
    const next: OrganizationFavorite = {
      id,
      name: trimmed,
      searchTerm,
      columnFilters,
      columnSorts,
      columnFields,
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
    setSelectedFavoriteId("");
  };

  // Apply per-column filtering and sorting
  const filteredAndSortedOrganizations = useMemo(() => {
    let result = [...organizations];

    // Apply global search
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((org) =>
        (org.name || "").toLowerCase().includes(term) ||
        String(org.id || "").toLowerCase().includes(term) ||
        (org.status || "").toLowerCase().includes(term) ||
        (org.contact_phone || "").toLowerCase().includes(term) ||
        (org.address || "").toLowerCase().includes(term)
      );
    }

    // Apply filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((org) => {
        const value = getColumnValue(org, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        // For number columns, do exact match
        const columnInfo = getColumnInfo(columnKey);
        if (columnInfo?.filterType === "number") {
          return String(value) === String(filterValue);
        }

        // For text columns, do contains match
        return valueStr.includes(filterStr);
      });
    });

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
  }, [organizations, columnFilters, columnSorts, searchTerm]);

  const handleViewOrganization = (id: string) => {
    router.push(`/dashboard/organizations/view?id=${id}`);
  };

  const handleAddOrganization = () => {
    router.push("/dashboard/organizations/add");
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedOrganizations([]);
    } else {
      setSelectedOrganizations(filteredAndSortedOrganizations.map((org) => org.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectOrganization = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (selectedOrganizations.includes(id)) {
      setSelectedOrganizations(selectedOrganizations.filter((orgId) => orgId !== id));
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedOrganizations([...selectedOrganizations, id]);
      if (
        [...selectedOrganizations, id].length === filteredAndSortedOrganizations.length
      ) {
        setSelectAll(true);
      }
    }
  };

  const deleteSelectedOrganizations = async () => {
    if (selectedOrganizations.length === 0) return;

    const confirmMessage =
      selectedOrganizations.length === 1
        ? "Are you sure you want to delete this organization?"
        : `Are you sure you want to delete these ${selectedOrganizations.length} organizations?`;

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const deletePromises = selectedOrganizations.map((id) =>
        fetch(`/api/organizations/${id}`, {
          method: "DELETE",
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} organizations`);
      }

      await fetchOrganizations();
      setSelectedOrganizations([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting organizations:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting organizations"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading organizations..." />;
  }

  if (isDeleting) {
    return <LoadingScreen message="Deleting organizations..." />;
  }

  // console.log('filteredAndSortedOrganizations', filteredAndSortedOrganizations)

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Organizations</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2" ref={favoritesMenuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFavoritesMenuOpen((v) => !v)}
                className="px-3 py-2 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center gap-2 text-sm"
                title="Favorites"
              >
                <FiStar size={16} className={selectedFavoriteId ? "text-yellow-500" : "text-gray-500"} />
                <span className="max-w-[180px] truncate">
                  {selectedFavoriteId
                    ? favorites.find((f) => f.id === selectedFavoriteId)?.name || "Favorites"
                    : "Favorites"}
                </span>
                <FiChevronDown size={16} className="text-gray-500" />
              </button>

              {favoritesMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded border bg-white shadow-lg z-9999 overflow-hidden">
                  <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700">Favorites</div>
                    <button
                      className="p-1 rounded hover:bg-gray-200"
                      onClick={() => setFavoritesMenuOpen(false)}
                      title="Close"
                    >
                      <FiX size={16} />
                    </button>
                  </div>

                  {favorites.length === 0 ? (
                    <div className="p-3 text-sm text-gray-600">
                      <div className="font-medium">No favorites yet</div>
                      <div className="mt-1">Save your current search + layout to reuse it later.</div>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-auto">
                      {favorites.map((f) => {
                        const active = f.id === selectedFavoriteId;
                        return (
                          <button
                            key={f.id}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                              active ? "bg-blue-50" : "bg-white"
                            }`}
                            onClick={() => {
                              setSelectedFavoriteId(f.id);
                              applyFavorite(f);
                              setFavoritesMenuOpen(false);
                            }}
                            title="Apply favorite"
                          >
                            <span className={`truncate ${active ? "text-blue-700 font-medium" : "text-gray-800"}`}>
                              {f.name}
                            </span>
                            {active && <span className="text-xs text-blue-700">Active</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-3 border-t bg-white flex gap-2">
                    <button
                      onClick={() => {
                        setFavoritesMenuOpen(false);
                        handleOpenSaveFavoriteModal();
                      }}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center justify-center gap-2"
                      title="Save current view to Favorites"
                    >
                      <FiStar size={16} />
                      Save Current View
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleOpenSaveFavoriteModal}
              className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 text-sm"
              title="Save current view to Favorites"
            >
              <FiStar size={16} />
              Save
            </button>
          </div>

          {selectedOrganizations.length > 0 && (
            <button
              onClick={deleteSelectedOrganizations}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Delete Selected ({selectedOrganizations.length})
            </button>
          )}

          <button
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Columns
          </button>
          <button
            onClick={handleAddOrganization}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Add Organization
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{error}</p>
        </div>
      )}

      {/* Delete Error message */}
      {deleteError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{deleteError}</p>
        </div>
      )}

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search organizations..."
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

          <button
            onClick={handleClearAllFilters}
            className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
            title="Clear search, filters, and sorting"
            disabled={
              !searchTerm &&
              Object.keys(columnFilters).length === 0 &&
              Object.keys(columnSorts).length === 0 &&
              !selectedFavoriteId
            }
          >
            Clear All
          </button>
        </div>
      </div>

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

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Id
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
              {/* {filteredAndSortedOrganizations.map((org) => (
                <tr key={org?.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{org?.id}</td>
                </tr>
              ))}  */}
              {filteredAndSortedOrganizations.map((org) => (

                <tr
                  key={org.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewOrganization(org.id)}
                >
                  {/* Fixed checkbox */}
                  <td
                    className="px-6 py-4 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={selectedOrganizations.includes(org.id)}
                      onChange={() => { }}
                      onClick={(e) => handleSelectOrganization(org.id, e)}
                    />
                  </td>

                  
                  {/* Fixed Actions */}
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="relative inline-block text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="px-3 py-1.5 border border-black text-black rounded text-sm hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenActionId((prev) =>
                            prev === org.id ? null : org.id
                          );
                        }}
                      >
                        Actions ▾
                      </button>

                      {openActionId === org.id && (
                        <div
                          className="absolute left-0 mt-2 w-44 rounded border bg-white shadow-lg z-[9999] overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col">
                            <button
                              className="w-full text-black text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionId(null);
                                handleViewOrganization(org.id);
                              }}
                            >
                              View
                            </button>

                            <button
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setOpenActionId(null);

                                if (
                                  !window.confirm(
                                    "Are you sure you want to delete this organization?"
                                  )
                                )
                                  return;

                                setIsDeleting(true);
                                try {
                                  const response = await fetch(
                                    `/api/organizations/${org.id}`,
                                    { method: "DELETE" }
                                  );
                                  if (!response.ok)
                                    throw new Error(
                                      "Failed to delete organization"
                                    );
                                  await fetchOrganizations();
                                } catch (err) {
                                  setDeleteError(
                                    err instanceof Error
                                      ? err.message
                                      : "An error occurred"
                                  );
                                } finally {
                                  setIsDeleting(false);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-black whitespace-nowrap">O {org?.id}</td>

                  {/* Dynamic cells */}
                  {columnFields.map((key) => (
                    <td
                      key={key}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {key === "status" ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          {getColumnValue(org, key)}
                        </span>
                      ) : (
                        getColumnValue(org, key)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
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
                {filteredAndSortedOrganizations.length}
              </span>{" "}
              of{" "}
              <span className="font-medium">
                {filteredAndSortedOrganizations.length}
              </span>{" "}
              results
            </p>
          </div>
          {filteredAndSortedOrganizations.length > 0 && (
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

      {/* Column Customization Modal */}
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
              {/* Available */}
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

              {/* Order */}
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
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                            onClick={() =>
                              setColumnFields((prev) =>
                                prev.filter((x) => x !== key)
                              )
                            }
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
                    onClick={() => setColumnFields(ORG_DEFAULT_COLUMNS)}
                  >
                    Reset
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={isSavingColumns}
                    onClick={async () => {
                      const ok = await saveColumnConfig();
                      if (ok) setShowColumnModal(false);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSaveFavoriteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={() => setShowSaveFavoriteModal(false)}
        >
          <div
            className="bg-white rounded shadow-xl w-full max-w-md mx-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Save to Favorites</h2>
              <button
                onClick={() => setShowSaveFavoriteModal(false)}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Favorite name
              </label>
              <input
                type="text"
                value={favoriteName}
                onChange={(e) => {
                  setFavoriteName(e.target.value);
                  if (favoriteNameError) setFavoriteNameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmSaveFavorite();
                  if (e.key === "Escape") setShowSaveFavoriteModal(false);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {favoriteNameError && (
                <div className="mt-2 text-sm text-red-600">{favoriteNameError}</div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveFavoriteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSaveFavorite}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
