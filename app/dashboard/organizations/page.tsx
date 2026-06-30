"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  useDeferredValue,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "nextjs-toploader/app";
import Link from "next/link";
import { TableSkeletonRows } from "@/components/TableSkeletonRows";
import { useHeaderViewConfig, useUserViewConfig } from "@/hooks/useUserViewConfig";
import { VIEW_ENTITY_TYPES } from "@/lib/viewConfigEntityTypes";
import { catalogKeyFromColumn, remapLegacyCustomKeys, resolveCustomColumnValue, formatColumnValueOrNA } from "@/lib/fieldCatalogKeys";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { IoFilterSharp } from "react-icons/io5";
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
import ActionDropdown from "@/components/ActionDropdown";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import BulkActionsButton from "@/components/BulkActionsButton";
import BulkOwnershipModal from "@/components/BulkOwnershipModal";
import BulkStatusModal from "@/components/BulkStatusModal";
import BulkTearsheetModal from "@/components/BulkTearsheetModal";
import EntityBulkArchiveModal from "@/components/EntityBulkArchiveModal";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import AdvancedSearchPanel, {
  type AdvancedSearchCriterion,
} from "@/components/AdvancedSearchPanel";
import { matchesAdvancedValue } from "@/lib/advancedSearch";
import SortableColumnHeader, {
  type ColumnFilterState,
  type ColumnSortState,
} from "@/components/SortableColumnHeader";
import { SEARCH_DEBOUNCE_MS } from "@/lib/apiListParams";
import { toast } from "sonner";
import { formatRecordId } from "@/lib/recordIdFormatter";

interface Organization {
  record_number: number;
  id: string;
  name: string;
  nicknames?: string;
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
  archived_at?: string | null;
  archive_reason?: string | null;
}

type OrganizationFavorite = {
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

export default function OrganizationList() {
  const router = useRouter();

  // =====================
  // TABLE COLUMNS (Overview List) – driven by admin field-management only
  // =====================
  const ORG_BACKEND_COLUMN_KEYS = [
    "name",
    "nicknames",
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
  } = useHeaderViewConfig({
    entityType: VIEW_ENTITY_TYPES.organizations,
    defaultFields: [], // populated from columnsCatalog when ready
    configType: "columns",
  });

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<
    Record<string, ColumnSortState>
  >({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<
    Record<string, ColumnFilterState>
  >({});

  const { value: favoritesRaw, setValue: setFavoritesConfig } = useUserViewConfig({
    entityType: VIEW_ENTITY_TYPES.organizations,
    key: "favorites",
    defaultValue: [],
  });
  const favorites = (favoritesRaw as OrganizationFavorite[]) || [];
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string>("");

  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const favoritesMenuRef = useRef<HTMLDivElement>(null);
  const favoritesMenuMobileRef = useRef<HTMLDivElement>(null);

  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteNameError, setFavoriteNameError] = useState<string | null>(
    null,
  );

  // Handle column sort toggle — re-fetches from server with sort params
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
    organizationsQueryCacheRef.current.clear();
  };

  // Handle column filter change — applied after debounce in header inputs
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
    organizationsQueryCacheRef.current.clear();
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
          "$1",
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

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [totalOrganizationsCount, setTotalOrganizationsCount] = useState<
    number | null
  >(null);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>(
    [],
  );
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancedOrganizationsDataset, setAdvancedOrganizationsDataset] =
    useState<Organization[] | null>(null);
  const [isAdvancedDatasetLoading, setIsAdvancedDatasetLoading] =
    useState(false);
  const hasLoadedOnceRef = useRef(false);
  const activeFetchControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);
  const organizationsQueryCacheRef = useRef<
    Map<string, { organizations: Organization[]; total: number | null }>
  >(new Map());
  const advancedOrganizationsCacheRef = useRef<Map<string, Organization[]>>(
    new Map(),
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);

  // Individual row action modals state
  const [showOwnershipModal, setShowOwnershipModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTearsheetModal, setShowTearsheetModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Single delete request state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ reason: "" });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [selectedOrgForDelete, setSelectedOrgForDelete] = useState<string | null>(null);
  const [selectedOrgForDeleteData, setSelectedOrgForDeleteData] = useState<Organization | null>(null);
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<any>(null);
  const [isLoadingDeleteRequest, setIsLoadingDeleteRequest] = useState(false);
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false);
  const [dependencyCounts, setDependencyCounts] = useState<any>(null);
  const [showDependencyWarningModal, setShowDependencyWarningModal] = useState(false);
  const [deleteActionType, setDeleteActionType] = useState<"standard" | "cascade">("standard");
  const [cascadeUserConsent, setCascadeUserConsent] = useState(false);

  // Bulk delete state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState(false);
  const [bulkDeleteForm, setBulkDeleteForm] = useState({ reason: "" });
  const [isSubmittingBulkDelete, setIsSubmittingBulkDelete] = useState(false);
  const [bulkDeleteResults, setBulkDeleteResults] = useState<{ success: number; failed: number; errors: { name: string; error: string }[] } | null>(null);

  // Columns Catalog
  const humanize = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const columnsCatalog = useMemo(() => {
    const coreBackendColumns = ORG_BACKEND_COLUMN_KEYS.map((key) => {
      let filterType: "text" | "select" | "number" = "text";
      if (key === "status") filterType = "select";
      else if (key === "job_orders_count" || key === "placements_count") {
        filterType = "number";
      }

      return {
        key,
        label: humanize(key),
        name: key,
        sortable: true,
        filterType,
        fieldType: "",
        lookupType: "",
        multiSelectLookupType: "",
        options: undefined as { label: string; value: string }[] | undefined,
      };
    });

    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const name = String(
          (f as any)?.field_name ?? (f as any)?.fieldName ?? "",
        ).trim();
        const label =
          (f as any)?.field_label ??
          (f as any)?.fieldLabel ??
          (name ? humanize(name) : "");
        const isBackendCol = name && ORG_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        if (name === "status") filterType = "select";
        else if (name === "job_orders_count" || name === "placements_count")
          filterType = "number";
        // Normalize select options (admin-center fields)
        let options: { label: string; value: string }[] | undefined = undefined;
        const rawOptions = (f as any)?.options;
        if (rawOptions) {
          try {
            const parsed =
              typeof rawOptions === "string"
                ? JSON.parse(rawOptions)
                : rawOptions;
            if (Array.isArray(parsed)) {
              options = parsed
                .map((opt: any) => {
                  if (typeof opt === "string")
                    return { label: opt, value: opt };
                  const label = String(opt?.label ?? opt?.value ?? "").trim();
                  const value = String(opt?.value ?? opt?.label ?? "").trim();
                  if (!label && !value) return null;
                  return { label: label || value, value: value || label };
                })
                .filter(Boolean) as { label: string; value: string }[];
            } else if (typeof parsed === "object" && parsed !== null) {
              options = Object.entries(parsed).map(([k, v]) => ({
                label: String(v),
                value: String(k),
              }));
            }
          } catch {
            // ignore
          }
        }

        return {
          key: catalogKeyFromColumn(name, String(label || name), !!isBackendCol),
          label: String(label || name),
          name: String(name || label || ""),
          sortable: isBackendCol,
          filterType,
          fieldType: (f as any)?.field_type ?? (f as any)?.fieldType ?? "",
          lookupType: (f as any)?.lookup_type ?? (f as any)?.lookupType ?? "",
          multiSelectLookupType:
            (f as any)?.multi_select_lookup_type ??
            (f as any)?.multiSelectLookupType ??
            "",
          options,
        };
      });

    // const customKeySet = new Set<string>();
    // (organizations || []).forEach((org: any) => {
    //   const cf = org?.customFields || org?.custom_fields || {};
    //   Object.keys(cf).forEach((k) => customKeySet.add(k));
    // });
    // const alreadyHaveCustom = new Set(
    //   fromApi.filter((c) => c.key.startsWith("custom:")).map((c) => c.key.replace("custom:", ""))
    // );
    // const fromData = Array.from(customKeySet)
    //   .filter((k) => !alreadyHaveCustom.has(k))
    //   .map((k) => ({
    //     key: `custom:${k}`,
    //     label: humanize(k),
    //     sortable: false,
    //     filterType: "text" as const,
    //   }));

    const merged = [
      {
        key: "record_number",
        label: "Record Number",
        sortable: true,
        filterType: "number" as const,
      },
      ...coreBackendColumns,
      ...fromApi,
    ];
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [organizations, availableFields]);

  // When catalog is ready, default columnFields to all catalog keys if empty (or validate saved)
  useEffect(() => {
    const catalogKeys = columnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);

    if (columnFields.length > 0) {
      let validOrder = remapLegacyCustomKeys(columnFields, columnsCatalog).filter(
        (k: string) => catalogSet.has(k)
      );
      if (
        catalogSet.has("record_number") &&
        !validOrder.includes("record_number")
      ) {
        validOrder = ["record_number", ...validOrder];
      }
      const wouldCollapseToRecordNumberOnly =
        columnFields.length > 1 &&
        validOrder.length === 1 &&
        validOrder[0] === "record_number";
      const isOnlyRecordNumberPreference =
        validOrder.length === 1 && validOrder[0] === "record_number";
      const shouldIgnoreStaleRecordOnlyPreference =
        isOnlyRecordNumberPreference && catalogKeys.length > 1;
      if (
        !wouldCollapseToRecordNumberOnly &&
        !shouldIgnoreStaleRecordOnlyPreference &&
        validOrder.length > 0
      ) {
        if (JSON.stringify(validOrder) !== JSON.stringify(columnFields)) {
          setColumnFields(validOrder);
        }
        return;
      }
    }

    if (columnFields.length === 0) {
      setColumnFields(catalogKeys);
      return;
    }

    const isOnlyRecordNumber =
      columnFields.length === 1 && columnFields[0] === "record_number";
    if (isOnlyRecordNumber && catalogKeys.length > 1) {
      setColumnFields(catalogKeys);
    }
  }, [columnsCatalog, columnFields, setColumnFields]);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnInfo = (key: string) =>
    columnsCatalog.find((c) => c.key === key);

  const getColumnValue = (org: any, key: string) => {
    if (key === "record_number") {
      return org.record_number ?? org.id;
    }
    if (key.startsWith("custom:")) {
      const resolved = resolveCustomColumnValue(org, key, getColumnInfo(key));
      return formatColumnValueOrNA(resolved);
    }

    switch (key) {
      case "name":
        return org.name || "N/A";
      case "nicknames":
        return org.nicknames || "N/A";
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

  // Apply a single advanced-search criterion to an org (returns true if org matches)
  const matchesAdvancedCriterion = (
    org: Organization,
    c: AdvancedSearchCriterion,
  ): boolean => {
    const raw = getColumnValue(org, c.fieldKey);
    const colInfo = getColumnInfo(c.fieldKey);
    const fieldType = (colInfo as any)?.fieldType ?? "";
    return matchesAdvancedValue(raw, fieldType, c);
  };

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchOrganizations = useCallback(
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
      const cached = organizationsQueryCacheRef.current.get(cacheKey);
      if (cached) {
        setOrganizations(cached.organizations);
        setTotalOrganizationsCount(cached.total);
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

        const response = await fetch(`/api/organizations?${query.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to fetch organizations");
        }

        const data = await response.json();
        if (requestId !== latestRequestIdRef.current) return;

        const incomingOrganizations: Organization[] = Array.isArray(
          data?.organizations,
        )
          ? data.organizations
          : [];
        const total =
          typeof data?.total === "number"
            ? data.total
            : typeof data?.count === "number"
              ? data.count
              : typeof data?.pagination?.total === "number"
                ? data.pagination.total
                : null;
        setTotalOrganizationsCount(total);

        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageOrganizations =
          incomingOrganizations.length > pageSize
            ? incomingOrganizations.slice(start, end)
            : incomingOrganizations;
        setOrganizations(pageOrganizations);
        organizationsQueryCacheRef.current.set(cacheKey, {
          organizations: pageOrganizations,
          total,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error fetching organizations:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching organizations",
        );
      } finally {
        if (requestId !== latestRequestIdRef.current) return;
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
        setIsPageLoading(false);
      }
    },
    [pageSize, searchTerm, columnSorts, columnFilters],
  );

  const isAdvancedFullMode = advancedSearchCriteria.length > 0;

  useEffect(() => {
    if (isAdvancedFullMode) return;
    void fetchOrganizations(currentPage);
  }, [currentPage, fetchOrganizations, isAdvancedFullMode]);

  useEffect(() => {
    return () => {
      activeFetchControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, columnSorts, advancedSearchCriteria]);

  useEffect(() => {
    if (!isAdvancedFullMode) {
      setAdvancedOrganizationsDataset(null);
      setIsAdvancedDatasetLoading(false);
      return;
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const cacheKey = normalizedSearch;
    const cached = advancedOrganizationsCacheRef.current.get(cacheKey);
    if (cached) {
      setAdvancedOrganizationsDataset(cached);
      return;
    }

    let cancelled = false;
    const loadAllOrganizations = async () => {
      setIsAdvancedDatasetLoading(true);
      setAdvancedOrganizationsDataset([]);
      try {
        const limit = 500;
        let page = 1;
        let total: number | null = null;
        const all: Organization[] = [];

        while (true) {
          const query = new URLSearchParams({
            page: String(page),
            limit: String(limit),
          });
          if (normalizedSearch !== "") {
            query.set("search", searchTerm.trim());
          }

          const response = await fetch(
            `/api/organizations?${query.toString()}`,
          );
          if (!response.ok)
            throw new Error(
              "Failed to fetch organizations for advanced search",
            );
          const data = await response.json();
          const batch: Organization[] = Array.isArray(data?.organizations)
            ? data.organizations
            : [];
          total =
            typeof data?.total === "number"
              ? data.total
              : typeof data?.count === "number"
                ? data.count
                : typeof data?.pagination?.total === "number"
                  ? data.pagination.total
                  : null;
          all.push(...batch);
          if (!cancelled) {
            // Progressive rendering: show batches as they arrive rather than
            // waiting for the full dataset.
            setAdvancedOrganizationsDataset((prev) => [
              ...(prev ?? []),
              ...batch,
            ]);
          }

          if (batch.length < limit) break;
          if (total != null && all.length >= total) break;
          page += 1;
        }

        if (!cancelled) {
          advancedOrganizationsCacheRef.current.set(cacheKey, all);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Error loading full organizations dataset for advanced search:",
            err,
          );
          setAdvancedOrganizationsDataset([]);
        }
      } finally {
        if (!cancelled) setIsAdvancedDatasetLoading(false);
      }
    };

    void loadAllOrganizations();
    return () => {
      cancelled = true;
    };
  }, [isAdvancedFullMode, searchTerm]);

  // Find custom field definitions for individual row actions
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

  // Get unique status values for filter dropdown
  const statusOptions = useMemo(() => {
    if (statusField?.options && statusField.options.length > 0) {
      return statusField.options.map((s: string) => ({ label: s, value: s }));
    }
    const statuses = new Set<string>();
    organizations.forEach((org) => {
      if (org.status) statuses.add(org.status);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [statusField, organizations]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const shouldApplyClientGlobalSearch = totalOrganizationsCount == null;
  const totalPages = isAdvancedFullMode
    ? 1
    : totalOrganizationsCount != null
      ? Math.max(1, Math.ceil(totalOrganizationsCount / pageSize))
      : null;
  const canGoPrev = currentPage > 1 && !isPageLoading && !isLoading;
  const canGoNext =
    !isAdvancedFullMode &&
    (totalPages != null
      ? currentPage < totalPages
      : organizations.length === pageSize) &&
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

  const handleIndividualActionSuccess = () => {
    organizationsQueryCacheRef.current.clear();
    advancedOrganizationsCacheRef.current.clear();
    setShowOwnershipModal(false);
    setShowStatusModal(false);
    setShowTearsheetModal(false);
    setSelectedOrgId(null);
    void fetchOrganizations(currentPage);
  };

  const applyFavorite = (fav: OrganizationFavorite) => {
    const catalogKeys = new Set(columnsCatalog.map((c) => c.key));
    const validColumnFields = (fav.columnFields || []).filter((k) =>
      catalogKeys.has(k),
    );

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

    setSearchInput(fav.searchTerm || "");
    setSearchTerm(fav.searchTerm || "");
    setColumnFilters(nextFilters);
    setColumnSorts(nextSorts);
    if (validColumnFields.length > 0) setColumnFields(validColumnFields);
    setAdvancedSearchCriteria(fav.advancedSearchCriteria ?? []);
  };

  const persistFavorites = (next: OrganizationFavorite[]) => {
    setFavoritesConfig(next);
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
    organizationsQueryCacheRef.current.clear();
  };

  const shouldApplyClientColumnFilters =
    isAdvancedFullMode || totalOrganizationsCount == null;

  // Apply per-column filtering and sorting (exclude archived in main overview)
  const filteredAndSortedOrganizations = useMemo(() => {
    const sourceOrganizations = isAdvancedFullMode
      ? (advancedOrganizationsDataset ?? [])
      : organizations;
    let result = sourceOrganizations.filter(
      (org) => org.status !== "Archived" && !org.archived_at,
    );

    // Apply global search (fallback when server total is unavailable)
    if (shouldApplyClientGlobalSearch && deferredSearchTerm.trim() !== "") {
      const term = deferredSearchTerm.toLowerCase();
      const recordNumberSearch = /^\d+$/.test(deferredSearchTerm.trim())
        ? Number.parseInt(deferredSearchTerm.trim(), 10)
        : null;
      result = result.filter((org) => {
        if (recordNumberSearch !== null) {
          return Number(org.record_number) === recordNumberSearch;
        }
        return (
          (org.name || "").toLowerCase().includes(term) ||
          String(org.id || "")
            .toLowerCase()
            .includes(term) ||
          (org.status || "").toLowerCase().includes(term) ||
          (org.contact_phone || "").toLowerCase().includes(term) ||
          (org.address || "").toLowerCase().includes(term)
        );
      });
    }

    // Apply column filters client-side only in advanced mode or offline fallback
    if (shouldApplyClientColumnFilters) {
      Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
        if (!filterValue || filterValue.trim() === "") return;

        result = result.filter((org) => {
          const value = getColumnValue(org, columnKey);
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

    // Apply advanced search criteria (AND)
    if (advancedSearchCriteria.length > 0) {
      result = result.filter((org) =>
        advancedSearchCriteria.every((c) => matchesAdvancedCriterion(org, c)),
      );
    }

    return result;
  }, [
    organizations,
    advancedOrganizationsDataset,
    isAdvancedFullMode,
    columnFilters,
    deferredSearchTerm,
    advancedSearchCriteria,
    shouldApplyClientGlobalSearch,
    shouldApplyClientColumnFilters,
  ]);
  const visibleResultsCount =
    totalOrganizationsCount != null &&
    advancedSearchCriteria.length === 0 &&
    !shouldApplyClientColumnFilters
      ? totalOrganizationsCount
      : filteredAndSortedOrganizations.length;

  const showTableSkeleton = isLoading || isPageLoading;
  const visibleTableColumnKeys = columnFields.filter((k) =>
    columnsCatalog.some((c) => c.key === k),
  );
  const skeletonColumnCount =
    visibleTableColumnKeys.length > 0 ? visibleTableColumnKeys.length : 6;
  const skeletonRowCount = Math.min(pageSize, 12);

  const handleViewArchived = () => {
    router.push("/dashboard/organizations/archived");
  };

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
      setSelectedOrganizations(
        filteredAndSortedOrganizations.map((org) => org.id),
      );
    }
    setSelectAll(!selectAll);
  };

  const handleSelectOrganization = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (selectedOrganizations.includes(id)) {
      setSelectedOrganizations(
        selectedOrganizations.filter((orgId) => orgId !== id),
      );
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedOrganizations([...selectedOrganizations, id]);
      if (
        [...selectedOrganizations, id].length ===
        filteredAndSortedOrganizations.length
      ) {
        setSelectAll(true);
      }
    }
  };

  // CSV Export function for selected records
  const handleCSVExport = () => {
    if (selectedOrganizations.length === 0) return;

    const selectedData = organizations.filter((org) =>
      selectedOrganizations.includes(org.id),
    );

    // Get headers from currently displayed columns
    const headers = columnFields.map((key) => getColumnLabel(key));

    // Escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Create CSV rows
    const csvRows = [
      headers.map(escapeCSV).join(","),
      ...selectedData.map((org) => {
        const row = columnFields.map((key) =>
          key === "record_number"
            ? escapeCSV(`O ${getColumnValue(org, key)}`)
            : escapeCSV(getColumnValue(org, key)),
        );
        return row.join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `organizations-export-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── Single Delete Request Flow ────────────────────────────────────────────
  const getAuthToken = () =>
    document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

  const getCurrentUser = () => {
    try {
      const raw = document.cookie.replace(/(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/, "$1");
      return raw ? JSON.parse(decodeURIComponent(raw)) : null;
    } catch { return null; }
  };

  const checkPendingDeleteRequest = async (orgId: string) => {
    setIsLoadingDeleteRequest(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/delete-request`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingDeleteRequest(data.deleteRequest || null);
      } else {
        setPendingDeleteRequest(null);
      }
    } catch {
      setPendingDeleteRequest(null);
    } finally {
      setIsLoadingDeleteRequest(false);
    }
  };

  const checkDependencies = async (orgId: string) => {
    setIsLoadingDependencies(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/dependencies`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDependencyCounts(data.counts);
        const hasDeps = data.counts && (
          (data.counts.hiring_managers > 0) ||
          (data.counts.jobs > 0) ||
          (data.counts.placements > 0) ||
          (data.counts.child_organizations > 0) ||
          (data.counts.details?.hiring_managers?.length > 0) ||
          (data.counts.details?.jobs?.length > 0) ||
          (data.counts.details?.placements?.length > 0) ||
          (data.counts.details?.child_organizations?.length > 0)
        );
        if (hasDeps) {
          setShowDependencyWarningModal(true);
        } else {
          setDeleteActionType("standard");
          setShowDeleteModal(true);
        }
      } else {
        setShowDeleteModal(true);
      }
    } catch {
      setShowDeleteModal(true);
    } finally {
      setIsLoadingDependencies(false);
    }
  };

  const handleSingleDelete = async (org: Organization) => {
    setSelectedOrgForDelete(org.id);
    setSelectedOrgForDeleteData(org);
    setDeleteForm({ reason: "" });
    setDeleteActionType("standard");
    setCascadeUserConsent(false);
    await checkPendingDeleteRequest(org.id);
    await checkDependencies(org.id);
  };

  const handleDeleteRequestSubmit = async () => {
    if (!deleteForm.reason.trim()) {
      toast.error("Please enter a reason for deletion");
      return;
    }
    if (!selectedOrgForDelete) {
      toast.error("Organization ID is missing");
      return;
    }
    setIsSubmittingDelete(true);
    try {
      const currentUser = getCurrentUser();

      // Add "Delete requested" note
      await fetch(`/api/organizations/${selectedOrgForDelete}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          text: `Delete requested by ${currentUser?.name || "Unknown User"} – Pending payroll approval`,
          action: "Delete Request",
          about: selectedOrgForDeleteData
            ? `${formatRecordId(selectedOrgForDeleteData.record_number ?? selectedOrgForDeleteData.id, "organization")} ${selectedOrgForDeleteData.name}`
            : "",
        }),
      });

      // Create delete request
      const deleteReqRes = await fetch(`/api/organizations/${selectedOrgForDelete}/delete-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          reason: deleteForm.reason.trim(),
          record_type: "organization",
          record_number: selectedOrgForDeleteData
            ? formatRecordId(selectedOrgForDeleteData.record_number ?? selectedOrgForDeleteData.id, "organization")
            : "",
          requested_by: currentUser?.id || currentUser?.name || "Unknown",
          requested_by_email: currentUser?.email || "",
          action_type: deleteActionType,
          dependencies_summary: dependencyCounts || {},
          user_consent: deleteActionType === "cascade" ? cascadeUserConsent : false,
        }),
      });

      if (!deleteReqRes.ok) {
        const errData = await deleteReqRes.json().catch(() => ({ message: "Failed to create delete request" }));
        throw new Error(errData.message || "Failed to create delete request");
      }

      toast.success("Delete request submitted successfully. Payroll will be notified via email.");
      setShowDeleteModal(false);
      setDeleteForm({ reason: "" });
      setSelectedOrgForDelete(null);
      setSelectedOrgForDeleteData(null);
      setPendingDeleteRequest(null);
      setCascadeUserConsent(false);
      organizationsQueryCacheRef.current.clear();
      advancedOrganizationsCacheRef.current.clear();
      void fetchOrganizations(currentPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit delete request");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // ─── Bulk Delete Request Flow ─────────────────────────────────────────────
  const handleBulkDeleteRequestSubmit = async () => {
    if (!bulkDeleteForm.reason.trim()) {
      toast.error("Please enter a reason for deletion");
      return;
    }
    if (selectedOrganizations.length === 0) return;

    setIsSubmittingBulkDelete(true);
    setBulkDeleteResults(null);

    const currentUser = getCurrentUser();
    const successes: string[] = [];
    const failures: { name: string; error: string }[] = [];

    for (const orgId of selectedOrganizations) {
      try {
        const org = organizations.find((o) => o.id === orgId);
        const orgName = org ? `${formatRecordId(org.record_number ?? org.id, "organization")} ${org.name}` : orgId;

        const res = await fetch(`/api/organizations/${orgId}/delete-request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            reason: bulkDeleteForm.reason.trim(),
            record_type: "organization",
            record_number: org ? formatRecordId(org.record_number ?? org.id, "organization") : "",
            requested_by: currentUser?.id || currentUser?.name || "Unknown",
            requested_by_email: currentUser?.email || "",
            action_type: "standard",
            dependencies_summary: {},
            user_consent: false,
          }),
        });

        if (res.ok) {
          successes.push(orgId);
        } else {
          const errData = await res.json().catch(() => ({ message: "Request failed" }));
          failures.push({ name: orgName, error: errData.message || "Request failed" });
        }
      } catch (err) {
        const org = organizations.find((o) => o.id === orgId);
        const orgName = org ? `${formatRecordId(org.record_number ?? org.id, "organization")} ${org.name}` : orgId;
        failures.push({ name: orgName, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    setBulkDeleteResults({ success: successes.length, failed: failures.length, errors: failures });

    if (failures.length === 0) {
      toast.success(`Delete requests submitted for all ${successes.length} organizations. Verification emails will be sent to payroll.`);
      setShowBulkDeleteModal(false);
      setBulkDeleteForm({ reason: "" });
      setBulkDeleteResults(null);
      setSelectedOrganizations([]);
      setSelectAll(false);
      organizationsQueryCacheRef.current.clear();
      advancedOrganizationsCacheRef.current.clear();
      void fetchOrganizations(currentPage);
    } else if (successes.length > 0) {
      toast.warning(`Delete requests submitted for ${successes.length} organizations. ${failures.length} failed.`);
    } else {
      toast.error("Failed to submit any delete requests.");
    }

    setIsSubmittingBulkDelete(false);
  };

  // console.log('filteredAndSortedOrganizations', filteredAndSortedOrganizations)

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - responsive: mobile = title+add row, then full-width Favorites, then full-width Columns */}
      <div className="p-4 border-b border-gray-200 space-y-3 md:space-y-0 md:flex md:justify-between md:items-center space-x-4 w-full ">
        {/* Row 1: Title + Add (mobile) / Title only (desktop) */}
        <div className="w-full flex justify-between items-center gap-4">
          <h1 className="text-xl font-bold">Organizations</h1>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search organizations..."
                  className="w-full p-2 pl-10 pr-36 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-500">
                  {(isLoading || isPageLoading || isAdvancedDatasetLoading) && (
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
          {/* Add Organization - visible on mobile only; desktop version below */}
          <button
            onClick={handleAddOrganization}
            className="md:hidden px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center shrink-0"
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
            Add
          </button>
        </div>

        {/* Desktop: Favorites, Delete Selected, Columns, Add - single row */}
        <div className="hidden md:flex items-center gap-2 flex-nowrap shrink-0">
          {/* Favorites Dropdown - ref on wrapper so click-outside works for both desktop and mobile */}
          <div ref={favoritesMenuRef} className="relative">
            <button
              onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 bg-white"
            >
              <FiStar
                className={
                  selectedFavoriteId
                    ? "text-yellow-400 fill-current"
                    : "text-gray-400"
                }
              />
              <span className="max-w-[100px] truncate">
                {selectedFavoriteId
                  ? favorites.find((f) => f.id === selectedFavoriteId)?.name ||
                    "Favorites"
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
                        className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                          selectedFavoriteId === fav.id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => {
                          setSelectedFavoriteId(fav.id);
                          applyFavorite(fav);
                          setFavoritesMenuOpen(false);
                        }}
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">
                          {fav.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = favorites.filter(
                              (f) => f.id !== fav.id,
                            );
                            persistFavorites(updated);
                            if (selectedFavoriteId === fav.id) {
                              setSelectedFavoriteId("");
                            }
                          }}
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

          {selectedOrganizations.length > 0 && (
            <div className="shrink-0">
              <BulkActionsButton
                selectedCount={selectedOrganizations.length}
                entityType="organization"
                entityIds={selectedOrganizations}
                availableFields={availableFields}
                onSuccess={() => {
                  organizationsQueryCacheRef.current.clear();
                  advancedOrganizationsCacheRef.current.clear();
                  void fetchOrganizations(currentPage);
                  setSelectedOrganizations([]);
                  setSelectAll(false);
                }}
                onCSVExport={handleCSVExport}
                onDelete={() => {
                  setBulkDeleteForm({ reason: "" });
                  setBulkDeleteResults(null);
                  setShowBulkDeleteModal(true);
                }}
                onArchive={() => setShowBulkArchiveModal(true)}
              />
            </div>
          )}

          <button
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center shrink-0 whitespace-nowrap"
          >
            Columns
          </button>
          <button
            onClick={handleViewArchived}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center shrink-0 whitespace-nowrap"
          >
            Archived
          </button>
          <button
            onClick={handleAddOrganization}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center shrink-0 whitespace-nowrap"
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
            Add
          </button>
        </div>

        {/* Mobile: Favorites - full width */}
        <div className="w-full md:hidden" ref={favoritesMenuMobileRef}>
          <div className="relative">
            <button
              onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)}
              className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-between gap-2 bg-white"
            >
              <span className="flex items-center gap-2">
                <FiStar
                  className={
                    selectedFavoriteId
                      ? "text-yellow-400 fill-current"
                      : "text-gray-400"
                  }
                />
                <span className="truncate">
                  {selectedFavoriteId
                    ? favorites.find((f) => f.id === selectedFavoriteId)
                        ?.name || "Favorites"
                    : "Favorites"}
                </span>
              </span>
              <FiChevronDown className="shrink-0" />
            </button>
            {favoritesMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
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
                        className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${selectedFavoriteId === fav.id ? "bg-blue-50" : ""}`}
                        onClick={() => {
                          setSelectedFavoriteId(fav.id);
                          applyFavorite(fav);
                          setFavoritesMenuOpen(false);
                        }}
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">
                          {fav.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = favorites.filter(
                              (f) => f.id !== fav.id,
                            );
                            persistFavorites(updated);
                            if (selectedFavoriteId === fav.id)
                              setSelectedFavoriteId("");
                          }}
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
        </div>

        {/* Mobile: Bulk Actions and Delete Selected - full width (when any selected) */}
        {selectedOrganizations.length > 0 && (
          <div className="w-full md:hidden space-y-2">
            <BulkActionsButton
              selectedCount={selectedOrganizations.length}
              entityType="organization"
              entityIds={selectedOrganizations}
              availableFields={availableFields}
              onSuccess={() => {
                organizationsQueryCacheRef.current.clear();
                advancedOrganizationsCacheRef.current.clear();
                void fetchOrganizations(currentPage);
                setSelectedOrganizations([]);
                setSelectAll(false);
              }}
              onCSVExport={handleCSVExport}
              onDelete={() => {
                setBulkDeleteForm({ reason: "" });
                setBulkDeleteResults(null);
                setShowBulkDeleteModal(true);
              }}
              onArchive={() => setShowBulkArchiveModal(true)}
            />
            <button
              onClick={() => {
                setBulkDeleteForm({ reason: "" });
                setBulkDeleteResults(null);
                setShowBulkDeleteModal(true);
              }}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
          </div>
        )}

        {/* Mobile: Columns - full width */}
        <div className="w-full md:hidden">
          <button
            onClick={() => setShowColumnModal(true)}
            className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center"
          >
            Columns
          </button>
        </div>
        {/* Mobile: Archived - full width */}
        <div className="w-full md:hidden">
          <button
            onClick={handleViewArchived}
            className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center"
          >
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

      <div className="w-full max-w-full overflow-x-hidden">
        <div className="overflow-x-auto overflow-y-auto h-[80vh]">
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
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
                    {columnFields
                      .filter((k) => columnsCatalog.some((c) => c.key === k))
                      .map((key) => {
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
                            onFilterChange={(value) =>
                              handleColumnFilter(key, value)
                            }
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
                ) : filteredAndSortedOrganizations.length > 0 ? (
                  filteredAndSortedOrganizations.map((org) => {
                    const orgViewHref = `/dashboard/organizations/view?id=${org.id}`;
                    return (
                      <tr
                        key={org.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("a,button,input,[role='button']"))
                            return;
                          const rowLink = e.currentTarget.querySelector(
                            "a[data-row-link='true']",
                          ) as HTMLAnchorElement | null;
                          rowLink?.click();
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
                            checked={selectedOrganizations.includes(org.id)}
                            onChange={() => {}}
                            onClick={(e) => handleSelectOrganization(org.id, e)}
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
                              {
                                label: "View",
                                action: () => handleViewOrganization(org.id),
                              },
                              ...(ownerField
                                ? [
                                    {
                                      label: "Change Ownership",
                                      action: () => {
                                        setSelectedOrgId(org.id);
                                        setShowOwnershipModal(true);
                                      },
                                    },
                                  ]
                                : []),
                              ...(statusField
                                ? [
                                    {
                                      label: "Change Status",
                                      action: () => {
                                        setSelectedOrgId(org.id);
                                        setShowStatusModal(true);
                                      },
                                    },
                                  ]
                                : []),
                              {
                                label: "Add To TearSheet",
                                action: () => {
                                  setSelectedOrgId(org.id);
                                  setShowTearsheetModal(true);
                                },
                              },
                              {
                                label: "Delete",
                                action: () => handleSingleDelete(org),
                              },
                            ]}
                          />
                        </td>

                        {/* Dynamic columns (including Record #) */}
                        {columnFields
                          .filter((k) =>
                            columnsCatalog.some((c) => c.key === k),
                          )
                          .map((key) => {
                            if (key === "record_number") {
                              return (
                                <td
                                  key={key}
                                  className="px-6 py-4 text-black whitespace-nowrap"
                                >
                                  <Link
                                    href={orgViewHref}
                                    data-row-link="true"
                                    className="text-black no-underline hover:no-underline focus:no-underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    O {getColumnValue(org, key)}
                                  </Link>
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
                                  multiSelectLookupType: (colInfo as any)
                                    .multiSelectLookupType,
                                }
                              : { key, label: getColumnLabel(key) };
                            return (
                              <td
                                key={key}
                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                              >
                                <FieldValueRenderer
                                  value={getColumnValue(org, key)}
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
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3 + visibleTableColumnKeys.length}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                    >
                      {searchTerm ||
                      Object.keys(columnFilters).length > 0 ||
                      advancedSearchCriteria.length > 0
                        ? "No organizations found matching your search."
                        : 'No organizations found. Click "Add Organization" to create one.'}
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
                    ? filteredAndSortedOrganizations.length === 0
                      ? 0
                      : 1
                    : totalOrganizationsCount === 0
                      ? 0
                      : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {isAdvancedFullMode
                    ? filteredAndSortedOrganizations.length
                    : (currentPage - 1) * pageSize + organizations.length}
                </span>{" "}
                of{" "}
                {isAdvancedFullMode ? (
                  <span className="font-medium">
                    {filteredAndSortedOrganizations.length}
                  </span>
                ) : totalOrganizationsCount != null ? (
                  <span className="font-medium">{totalOrganizationsCount}</span>
                ) : (
                  <span className="font-medium">{organizations.length}</span>
                )}{" "}
                organizations
                {!isAdvancedFullMode &&
                filteredAndSortedOrganizations.length !==
                  organizations.length ? (
                  <>
                    {" "}
                    (
                    <span className="font-medium">
                      {filteredAndSortedOrganizations.length}
                    </span>{" "}
                    shown after filters)
                  </>
                ) : null}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="organizations-page-size"
              className="text-sm text-gray-600"
            >
              Rows per page
            </label>
            <select
              id="organizations-page-size"
              value={pageSize}
              disabled={showTableSkeleton}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
                setSelectedOrganizations([]);
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
              onClick={() =>
                canGoPrev && setCurrentPage((p) => Math.max(1, p - 1))
              }
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
                    disabled={
                      isLoading || isPageLoading || item === currentPage
                    }
                    className={`min-w-[2.4rem] px-3 py-1.5 border rounded text-sm font-medium transition-colors ${
                      item === currentPage
                        ? "border-gray-300 bg-white text-gray-900 shadow-sm"
                        : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50"
                    } disabled:cursor-not-allowed`}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {item}
                  </button>
                ),
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
          description="Drag to reorder, check/uncheck to show or hide columns in the table. Changes apply to the organization list."
          order={[
            ...columnFields,
            ...columnsCatalog
              .filter((c) => !columnFields.includes(c.key))
              .map((c) => c.key),
          ]}
          visible={Object.fromEntries(
            columnsCatalog.map((c) => [c.key, columnFields.includes(c.key)]),
          )}
          fieldCatalog={columnsCatalog.map((c) => ({
            key: c.key,
            label: c.label,
          }))}
          onToggle={(key) => {
            if (columnFields.includes(key)) {
              setColumnFields(columnFields.filter((x) => x !== key));
            } else {
              setColumnFields([...columnFields, key]);
            }
          }}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const fullOrder = [
              ...columnFields,
              ...columnsCatalog
                .filter((c) => !columnFields.includes(c.key))
                .map((c) => c.key),
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
            const requiredCustom = (availableFields || [])
              .filter((f) => f.is_required || f.required || f.isRequired)
              .map((f) => {
                const name = String(f.field_name ?? f.fieldName ?? "").trim();
                const label =
                  f.field_label ?? f.fieldLabel ?? (name ? humanize(name) : "");
                const isBackendCol =
                  name && ORG_BACKEND_COLUMN_KEYS.includes(name);
                return catalogKeyFromColumn(name, String(label || name), !!isBackendCol);
              });
            const defaults = Array.from(
              new Set(["record_number", "name", "status", ...requiredCustom]),
            );
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
              <h3 className="font-semibold text-gray-800">
                Save Search as Favorite
              </h3>
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
                  placeholder="e.g. Active Organizations"
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                    favoriteNameError
                      ? "border-red-300 bg-red-50"
                      : "border-gray-300"
                  }`}
                  autoFocus
                />
                {favoriteNameError && (
                  <p className="text-xs text-red-500 mt-1">
                    {favoriteNameError}
                  </p>
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
                  {advancedSearchCriteria.length > 0 && (
                    <li>
                      {advancedSearchCriteria.length} advanced search
                      condition(s)
                    </li>
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
      {showOwnershipModal && ownerField && selectedOrgId && (
        <BulkOwnershipModal
          open={showOwnershipModal}
          onClose={() => {
            setShowOwnershipModal(false);
            setSelectedOrgId(null);
          }}
          entityType="organization"
          entityIds={[selectedOrgId]}
          fieldLabel={ownerField.field_label || "Owner"}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showStatusModal && statusField && selectedOrgId && (
        <BulkStatusModal
          open={showStatusModal}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedOrgId(null);
          }}
          entityType="organization"
          entityIds={[selectedOrgId]}
          fieldLabel={statusField.field_label || "Status"}
          options={statusField.options || []}
          availableFields={availableFields}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showTearsheetModal && selectedOrgId && (
        <BulkTearsheetModal
          open={showTearsheetModal}
          onClose={() => {
            setShowTearsheetModal(false);
            setSelectedOrgId(null);
          }}
          entityType="organization"
          entityIds={[selectedOrgId]}
          onSuccess={handleIndividualActionSuccess}
        />
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
        recentStorageKey="organizationAdvancedSearchRecent"
        initialCriteria={advancedSearchCriteria}
        anchorEl={advancedSearchButtonRef.current}
        isLoading={isPageLoading || isAdvancedDatasetLoading}
        resultsCount={visibleResultsCount}
        resultsLabel="records"
      />

      {/* ─── Single Delete Request Modal ────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-999">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {deleteActionType === "cascade" ? "Request Cascade Deletion" : "Request Deletion"}
              </h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteForm({ reason: "" });
                  setSelectedOrgForDelete(null);
                  setSelectedOrgForDeleteData(null);
                  setCascadeUserConsent(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
              {selectedOrgForDeleteData && (
                <div className="bg-gray-50 p-4 rounded">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization to Delete
                  </label>
                  <p className="text-sm text-gray-900 font-medium">
                    {formatRecordId(selectedOrgForDeleteData.record_number ?? selectedOrgForDeleteData.id, "organization")} {selectedOrgForDeleteData.name}
                  </p>
                  {deleteActionType === "cascade" && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-2">
                      Cascade Delete Mode
                    </span>
                  )}
                </div>
              )}

              {pendingDeleteRequest && pendingDeleteRequest.status === "pending" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Pending Request:</strong> A delete request is already pending payroll approval.
                  </p>
                </div>
              )}

              {pendingDeleteRequest && pendingDeleteRequest.status === "denied" && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-sm text-red-800">
                    <strong>Previous Request Denied:</strong> {pendingDeleteRequest.denial_reason || "No reason provided"}
                  </p>
                </div>
              )}

              {deleteActionType === "cascade" && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-sm text-red-800 mb-3">
                    <strong>Warning:</strong> You are requesting cascade archival. Linked records will not all be deleted; dependency rules below will be applied:
                  </p>
                  <ul className="list-disc list-inside text-xs text-red-700 mb-3 space-y-1">
                    {dependencyCounts?.hiring_managers > 0 && <li>{dependencyCounts.hiring_managers} Hiring Managers - will be archived.</li>}
                    {dependencyCounts?.jobs > 0 && <li>{dependencyCounts.jobs} Jobs - will be archived.</li>}
                    {dependencyCounts?.placements > 0 && <li>{dependencyCounts.placements} Placements - organization link will be cleared where applicable.</li>}
                    {dependencyCounts?.child_organizations > 0 && <li>{dependencyCounts.child_organizations} Child Organizations - parent organization will be cleared.</li>}
                    {dependencyCounts?.leads > 0 && <li>{dependencyCounts.leads} Leads - organization link will be cleared where applicable.</li>}
                    {dependencyCounts?.job_seekers > 0 && <li>{dependencyCounts.job_seekers} Job Seekers - organization lookup will be cleared where applicable.</li>}
                    {dependencyCounts?.notes > 0 && <li>{dependencyCounts.notes} Notes - retained on the archived organization.</li>}
                    {dependencyCounts?.documents > 0 && <li>{dependencyCounts.documents} Documents - retained on the archived organization.</li>}
                  </ul>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cascadeUserConsent}
                      onChange={(e) => setCascadeUserConsent(e.target.checked)}
                      className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm text-red-900">
                      I understand this will archive the organization and apply the dependency rules listed above.
                    </span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500 mr-1">•</span>
                  Reason for Deletion
                </label>
                <textarea
                  value={deleteForm.reason}
                  onChange={(e) =>
                    setDeleteForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Please provide a detailed reason for deleting this organization..."
                  className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${!deleteForm.reason.trim()
                    ? "border-red-300 focus:ring-red-500"
                    : "border-gray-300 focus:ring-blue-500"
                  }`}
                  rows={5}
                  required
                />
                {!deleteForm.reason.trim() && (
                  <p className="mt-1 text-sm text-red-500">Reason is required</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will create a delete request. Payroll will be notified via email and must approve or deny it. If approved, the organization is archived and linked records are handled per dependency rules.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteForm({ reason: "" });
                  setSelectedOrgForDelete(null);
                  setSelectedOrgForDeleteData(null);
                  setCascadeUserConsent(false);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmittingDelete}
              >
                CANCEL
              </button>
              <button
                onClick={handleDeleteRequestSubmit}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                disabled={
                  isSubmittingDelete ||
                  !deleteForm.reason.trim() ||
                  (pendingDeleteRequest && pendingDeleteRequest.status === "pending") ||
                  (deleteActionType === "cascade" && !cascadeUserConsent)
                }
              >
                {isSubmittingDelete ? "SUBMITTING..." : "SUBMIT DELETE REQUEST"}
                {!isSubmittingDelete && (
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dependency Warning Modal ───────────────────────────────────── */}
      {showDependencyWarningModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-999">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Linked Records Found</h2>
              <button
                onClick={() => {
                  setShowDependencyWarningModal(false);
                  setSelectedOrgForDelete(null);
                  setSelectedOrgForDeleteData(null);
                }}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-orange-100 p-2 rounded-full">
                    <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">
                    This organization has linked records. Choose transfer to move records, or cascade archival to apply per-record dependency rules.
                  </p>
                </div>
              </div>

              {dependencyCounts?.details?.hiring_managers?.length > 0 && (
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Hiring Managers ({dependencyCounts.details.hiring_managers.length})
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">Action if cascade is approved: these records will be archived.</p>
                  </div>
                </div>
              )}

              {dependencyCounts?.details?.jobs?.length > 0 && (
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Jobs ({dependencyCounts.details.jobs.length})
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">Action if cascade is approved: these records will be archived.</p>
                  </div>
                </div>
              )}

              {dependencyCounts?.details?.placements?.length > 0 && (
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Placements ({dependencyCounts.details.placements.length})
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">Action if cascade is approved: organization linkage will be cleared where applicable.</p>
                  </div>
                </div>
              )}

              {dependencyCounts?.details?.child_organizations?.length > 0 && (
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Child Organizations ({dependencyCounts.details.child_organizations.length})
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">Action if cascade is approved: parent organization link will be cleared.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 space-y-3">
              <button
                onClick={() => {
                  setShowDependencyWarningModal(false);
                  setSelectedOrgForDelete(null);
                  setSelectedOrgForDeleteData(null);
                }}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDependencyWarningModal(false);
                  setDeleteActionType("cascade");
                  setShowDeleteModal(true);
                }}
                className="w-full flex justify-center items-center px-4 py-2 border border-red-300 rounded shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                Request Cascade Deletion (Apply Dependency Rules)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Delete Modal ──────────────────────────────────────────── */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-999">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Request Deletion for {selectedOrganizations.length} Organizations</h2>
              <button
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkDeleteForm({ reason: "" });
                  setBulkDeleteResults(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
              {bulkDeleteResults ? (
                <div className="space-y-4">
                  <div className={`rounded p-4 ${bulkDeleteResults.failed === 0 ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
                    <p className={`text-sm font-medium ${bulkDeleteResults.failed === 0 ? "text-green-800" : "text-yellow-800"}`}>
                      {bulkDeleteResults.success} delete request(s) submitted successfully.
                      {bulkDeleteResults.failed > 0 && ` ${bulkDeleteResults.failed} failed.`}
                    </p>
                  </div>
                  {bulkDeleteResults.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-4">
                      <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                      <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                        {bulkDeleteResults.errors.map((e, i) => (
                          <li key={i}>{e.name}: {e.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowBulkDeleteModal(false);
                      setBulkDeleteForm({ reason: "" });
                      setBulkDeleteResults(null);
                      setSelectedOrganizations([]);
                      setSelectAll(false);
                      organizationsQueryCacheRef.current.clear();
                      advancedOrganizationsCacheRef.current.clear();
                      void fetchOrganizations(currentPage);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                  >
                    DONE
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 p-4 rounded">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Selected Organizations
                    </label>
                    <p className="text-sm text-gray-900 font-medium">
                      {selectedOrganizations.length} organization(s) selected
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="text-red-500 mr-1">•</span>
                      Reason for Deletion (shared for all)
                    </label>
                    <textarea
                      value={bulkDeleteForm.reason}
                      onChange={(e) =>
                        setBulkDeleteForm((prev) => ({ ...prev, reason: e.target.value }))
                      }
                      placeholder="Please provide a detailed reason for deleting these organizations..."
                      className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${!bulkDeleteForm.reason.trim()
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300 focus:ring-blue-500"
                      }`}
                      rows={5}
                      required
                    />
                    {!bulkDeleteForm.reason.trim() && (
                      <p className="mt-1 text-sm text-red-500">Reason is required</p>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Delete requests will be created for each selected organization. Payroll will receive individual verification emails for each organization and must approve or deny them independently.
                    </p>
                  </div>
                </>
              )}
            </div>

            {!bulkDeleteResults && (
              <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowBulkDeleteModal(false);
                    setBulkDeleteForm({ reason: "" });
                    setBulkDeleteResults(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmittingBulkDelete}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleBulkDeleteRequestSubmit}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                  disabled={isSubmittingBulkDelete || !bulkDeleteForm.reason.trim()}
                >
                  {isSubmittingBulkDelete ? "SUBMITTING..." : "SUBMIT DELETE REQUESTS"}
                  {!isSubmittingBulkDelete && (
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <EntityBulkArchiveModal
        open={showBulkArchiveModal}
        onClose={() => setShowBulkArchiveModal(false)}
        onSuccess={() => {
          organizationsQueryCacheRef.current.clear();
          advancedOrganizationsCacheRef.current.clear();
          void fetchOrganizations(currentPage);
          setSelectedOrganizations([]);
          setSelectAll(false);
        }}
        entityIds={selectedOrganizations}
        entityType="organizations"
        selectedCount={selectedOrganizations.length}
      />
    </div>
  );
}
