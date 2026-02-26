"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
import { IoFilterSharp } from "react-icons/io5";
import { FiArrowUp, FiArrowDown, FiFilter, FiStar, FiChevronDown, FiChevronLeft, FiX } from "react-icons/fi";
import ActionDropdown from "@/components/ActionDropdown";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import CountdownTimer from "@/components/CountdownTimer";
import SortableFieldsEditModal from "@/components/SortableFieldsEditModal";
import AdvancedSearchPanel, {
  type AdvancedSearchCriterion,
} from "@/components/AdvancedSearchPanel";
import { matchesAdvancedValue } from "@/lib/advancedSearch";

interface Task {
  id: string;
  record_number?: number;
  title: string;
  description?: string;
  is_completed: boolean;
  due_date?: string;
  due_time?: string;
  job_seeker_name?: string;
  hiring_manager_name?: string;
  job_title?: string;
  lead_name?: string;
  placement_id?: string;
  owner?: string;
  priority: string;
  status: string;
  created_by_name?: string;
  assigned_to_name?: string;
  created_at: string;
  archived_at?: string | null;
  archive_reason?: string | null;
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

type TaskFavorite = {
  id: string;
  name: string;
  searchTerm: string;
  columnFilters: Record<string, ColumnFilterState>;
  columnSorts: Record<string, ColumnSortState>;
  columnFields: string[];
  advancedSearchCriteria?: AdvancedSearchCriterion[];
  createdAt: number;
};

const FAVORITES_STORAGE_KEY = "tasksArchivedFavorites";

const formatDateTime = (date?: string, time?: string) => {
  if (!date) return "";
  try {
    const dateObj = new Date(date);
    let formatted = new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(dateObj);
    if (time) formatted += ` ${time}`;
    return formatted;
  } catch {
    return "";
  }
};

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
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={16} />
        </button>
        <span className="flex-1">{label}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSort();
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title={sortState === "asc" ? "Sort descending" : "Sort ascending"}
        >
          {sortState === "asc" ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
        </button>
        <button
          ref={filterToggleRef}
          data-filter-toggle={id}
          onClick={(e) => {
            e.stopPropagation();
            setShowFilter(!showFilter);
          }}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${filterValue ? "text-blue-600" : ""}`}
          title="Filter column"
        >
          <FiFilter size={14} />
        </button>
      </div>
      {showFilter &&
        filterPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={filterRef}
            className="bg-white border border-gray-300 shadow-lg rounded p-2 z-[100] min-w-[150px]"
            style={{
              position: "fixed",
              top: filterPosition.top,
              left: filterPosition.left,
              width: filterPosition.width,
            }}
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
          </div>,
          document.body
        )}
    </th>
  );
}

function normalizeFields(payload: any) {
  const root =
    payload?.customFields ??
    payload?.fields ??
    payload?.data?.fields ??
    payload?.data?.data?.fields ??
    payload?.taskFields ??
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
}

export default function ArchivedTasksList() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState<
    AdvancedSearchCriterion[]
  >([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const advancedSearchButtonRef = useRef<HTMLButtonElement>(null);
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [favorites, setFavorites] = useState<TaskFavorite[]>([]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteNameError, setFavoriteNameError] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  const TASK_BACKEND_COLUMN_KEYS = [
    "title",
    "status",
    "archive_reason",
    "completed",
    "due",
    "job_seeker",
    "hiring_manager",
    "job",
    "lead",
    "placement",
    "owner",
    "priority",
    "dateCreated",
    "createdBy",
    "assignedTo",
  ];

  const humanize = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const taskColumnsCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const name = String((f?.field_name ?? f?.fieldName ?? "")).trim();
        const label = (f?.field_label ?? f?.fieldLabel ?? (name ? humanize(name) : "")) as string;
        const isBackendCol = name && TASK_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        if (name === "status" || name === "priority" || name === "completed" || name === "archive_reason")
          filterType = "select";
        return {
          key: isBackendCol ? name : `custom:${label || name}`,
          label: String(label || name),
          sortable: true,
          filterType,
          fieldType: f?.field_type,
          lookupType: f?.lookup_type || "",
        };
      });
    const merged = [
      { key: "record_number", label: "Record Number", sortable: true, filterType: "number" as const, fieldType: "", lookupType: "" },
      ...fromApi,
    ];
    if (!merged.some((x) => x.key === "archive_reason")) {
      merged.push({
        key: "archive_reason",
        label: "Archive Reason",
        sortable: true,
        filterType: "select" as const,
        fieldType: "",
        lookupType: "",
      });
    }
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [availableFields]);

  const getColumnLabel = (key: string) => taskColumnsCatalog.find((c) => c.key === key)?.label ?? key;
  const getColumnInfo = (key: string) => taskColumnsCatalog.find((c) => c.key === key);

  const getColumnValue = (task: any, key: string) => {
    if (key === "record_number") {
      return task.record_number ?? task.id;
    }
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = task?.customFields || task?.custom_fields || {};
      const val = cf?.[rawKey];
      return val === undefined || val === null || val === "" ? "—" : String(val);
    }
    if (key === "archive_reason") return task.archive_reason || "—";
    if (key === "title") return task.title || "—";
    if (key === "status") return task.status || "—";
    if (key === "completed") return task.is_completed ? "Yes" : "No";
    if (key === "due") return formatDateTime(task.due_date, task.due_time) || "—";
    if (key === "job_seeker") return task.job_seeker_name || "—";
    if (key === "hiring_manager") return task.hiring_manager_name || "—";
    if (key === "job") return task.job_title || "—";
    if (key === "lead") return task.lead_name || "—";
    if (key === "placement") return task.placement_id || "—";
    if (key === "owner") return task.owner || task.created_by_name || "—";
    if (key === "priority") return task.priority || "—";
    if (key === "dateCreated") return task.created_at ? new Date(task.created_at).toLocaleDateString() : "—";
    if (key === "createdBy") return task.created_by_name || "—";
    if (key === "assignedTo") return task.assigned_to_name || "—";
    const val = task[key];
    return val === undefined || val === null || val === "" ? "—" : String(val);
  };

  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "TASK",
    configType: "columns",
    defaultFields: [],
  });

  useEffect(() => {
    const catalogKeys = taskColumnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);
    const savedOrder = localStorage.getItem("tasksArchivedColumnOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let validOrder = parsed.filter((k: string) => catalogSet.has(k));
          if (catalogSet.has("record_number") && !validOrder.includes("record_number")) {
            validOrder = ["record_number", ...validOrder];
          }
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
  }, [taskColumnsCatalog]);

  useEffect(() => {
    if (columnFields.length > 0) {
      localStorage.setItem("tasksArchivedColumnOrder", JSON.stringify(columnFields));
    }
  }, [columnFields]);

  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setFavorites(parsed);
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  useEffect(() => {
    const fetchAvailableFields = async () => {
      setIsLoadingFields(true);
      try {
        const token = document.cookie
          .split("; ")
          .find((r) => r.startsWith("token="))
          ?.split("=")[1];
        const res = await fetch("/api/admin/field-management/tasks", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        });
        const raw = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(raw);
        } catch {
          // ignore
        }
        const fields = normalizeFields(data);
        setAvailableFields(Array.isArray(fields) ? fields : []);
      } catch (e) {
        console.error("Error fetching task fields:", e);
        setAvailableFields([]);
      } finally {
        setIsLoadingFields(false);
      }
    };
    fetchAvailableFields();
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = document.cookie
        .split("; ")
        .find((r) => r.startsWith("token="))
        ?.split("=")[1];
      const response = await fetch("/api/tasks", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError(err instanceof Error ? err.message : "An error occurred while fetching tasks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    tasks.forEach((t) => {
      if (t.status) statuses.add(t.status);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [tasks]);

  const archiveReasonOptions = useMemo(
    () => [
      { label: "Deletion", value: "Deletion" },
      { label: "Transfer", value: "Transfer" },
    ],
    []
  );

  const priorityOptions = useMemo(() => {
    const priorities = new Set<string>();
    tasks.forEach((t) => {
      if (t.priority) priorities.add(t.priority);
    });
    return Array.from(priorities).map((p) => ({ label: p, value: p }));
  }, [tasks]);

  const filteredAndSortedTasks = useMemo(() => {
    let result = tasks.filter((t) => t.status === "Archived" || !!t.archived_at);

    const matchesAdvancedCriterion = (
      t: Task,
      c: AdvancedSearchCriterion
    ): boolean => {
      const raw = getColumnValue(t, c.fieldKey);
      const colInfo = getColumnInfo(c.fieldKey);
      const fieldType = (colInfo as any)?.fieldType ?? "";
      return matchesAdvancedValue(raw, fieldType, c);
    };

    if (advancedSearchCriteria.length > 0) {
      result = result.filter((t) =>
        advancedSearchCriteria.every((c) => matchesAdvancedCriterion(t, c))
      );
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (task) =>
          (task.title || "").toLowerCase().includes(term) ||
          String(task.id || "").toLowerCase().includes(term) ||
          String(task.record_number ?? "").toLowerCase().includes(term) ||
          (task.status || "").toLowerCase().includes(term) ||
          (task.job_seeker_name || "").toLowerCase().includes(term) ||
          (task.hiring_manager_name || "").toLowerCase().includes(term) ||
          (task.job_title || "").toLowerCase().includes(term) ||
          (task.lead_name || "").toLowerCase().includes(term) ||
          (task.owner || "").toLowerCase().includes(term) ||
          (task.archive_reason || "").toLowerCase().includes(term)
      );
    }

    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;
      result = result.filter((task) => {
        const value = getColumnValue(task, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();
        const columnInfo = getColumnInfo(columnKey);
        if (columnInfo && (columnInfo as any).filterType === "number") {
          return String(value) === String(filterValue);
        }
        return valueStr.includes(filterStr);
      });
    });

    const activeSorts = Object.entries(columnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
      const [sortKey, sortDir] = activeSorts[0];
      result.sort((a, b) => {
        const aValue = getColumnValue(a, sortKey);
        const bValue = getColumnValue(b, sortKey);
        const aNum = typeof aValue === "number" ? aValue : Number(aValue);
        const bNum = typeof bValue === "number" ? bValue : Number(bValue);
        let cmp = 0;
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) cmp = aNum - bNum;
        else
          cmp = String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [tasks, columnFilters, columnSorts, searchTerm, advancedSearchCriteria]);

  const handleBackToTasks = () => router.push("/dashboard/tasks");
  const handleViewTask = (id: string) => router.push(`/dashboard/tasks/view?id=${id}`);

  const handleColumnSort = (columnKey: string) => {
    setColumnSorts((prev) => {
      const current = prev[columnKey];
      if (current === "asc") return { ...prev, [columnKey]: "desc" };
      if (current === "desc") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: "asc" };
    });
  };

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columnFields.indexOf(active.id as string);
    const newIndex = columnFields.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      setColumnFields(arrayMove(columnFields, oldIndex, newIndex));
    }
  };

  const handleSelectAll = () => {
    if (selectAll) setSelectedTasks([]);
    else setSelectedTasks(filteredAndSortedTasks.map((t) => t.id));
    setSelectAll(!selectAll);
  };

  const handleSelectTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTasks.includes(id)) {
      setSelectedTasks(selectedTasks.filter((tid) => tid !== id));
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedTasks([...selectedTasks, id]);
      if ([...selectedTasks, id].length === filteredAndSortedTasks.length) setSelectAll(true);
    }
  };

  const deleteSelectedTasks = async () => {
    if (selectedTasks.length === 0) return;
    const confirmMessage =
      selectedTasks.length === 1
        ? "Are you sure you want to delete this task?"
        : `Are you sure you want to delete these ${selectedTasks.length} tasks?`;
    if (!window.confirm(confirmMessage)) return;
    setIsLoading(true);
    try {
      const token = document.cookie
        .split("; ")
        .find((r) => r.startsWith("token="))
        ?.split("=")[1];
      const deletePromises = selectedTasks.map((id) =>
        fetch(`/api/tasks/${id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      );
      const results = await Promise.allSettled(deletePromises);
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) throw new Error(`Failed to delete ${failures.length} tasks`);
      await fetchTasks();
      setSelectedTasks([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting tasks:", err);
      setError(err instanceof Error ? err.message : "An error occurred while deleting tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const persistFavorites = (updated: TaskFavorite[]) => {
    setFavorites(updated);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  };

  const applyFavorite = (fav: TaskFavorite) => {
    const catalogKeys = new Set(taskColumnsCatalog.map((c) => c.key));
    const validColumnFields = (fav.columnFields || []).filter((k) => catalogKeys.has(k));
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
    if (validColumnFields.length > 0) setColumnFields(validColumnFields);
    setAdvancedSearchCriteria(fav.advancedSearchCriteria ?? []);
    setSelectedFavoriteId(fav.id);
    setFavoritesMenuOpen(false);
  };

  const handleOpenSaveFavoriteModal = () => {
    setFavoriteName("");
    setFavoriteNameError(null);
    setShowSaveFavoriteModal(true);
  };

  const handleConfirmSaveFavorite = () => {
    const trimmed = favoriteName.trim();
    if (!trimmed) {
      setFavoriteNameError("Please enter a name for this favorite.");
      return;
    }
    const newFav: TaskFavorite = {
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
    persistFavorites([newFav, ...favorites]);
    setSelectedFavoriteId(newFav.id);
    setShowSaveFavoriteModal(false);
  };

  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.filter((f) => f.id !== id);
    persistFavorites(updated);
    if (selectedFavoriteId === id) setSelectedFavoriteId(null);
  };

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
    setColumnSorts({});
    setAdvancedSearchCriteria([]);
    setSelectedFavoriteId(null);
  };

  if (isLoading) {
    return <LoadingScreen message="Loading archived tasks..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - responsive: search/filters on top, then actions */}
      <div className="p-4 border-b border-gray-200 space-y-3 md:space-y-0 md:flex md:justify-between md:items-center space-x-4 w-full">
        {/* Row 1: Back arrow + Title + Search + Filter + Clear */}
        <div className="w-full flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleBackToTasks}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center bg-white text-gray-700"
              title="Back to Tasks"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">Archived Tasks</h1>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search archived tasks..."
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
              {(searchTerm ||
                Object.keys(columnFilters).length > 0 ||
                Object.keys(columnSorts).length > 0 ||
                advancedSearchCriteria.length > 0) && (
                <button
                  onClick={handleClearAllFilters}
                  className="px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors flex items-center gap-2"
                >
                  <FiX /> Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-4">
          {selectedTasks.length > 0 && (
            <button
              onClick={deleteSelectedTasks}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
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
              Delete Selected ({selectedTasks.length})
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 bg-white"
            >
              <FiStar
                className={selectedFavoriteId ? "text-yellow-400 fill-current" : "text-gray-400"}
              />
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
                    <p className="text-xs text-gray-400 text-center py-4">No saved favorites yet</p>
                  ) : (
                    favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                          selectedFavoriteId === fav.id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => applyFavorite(fav)}
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">{fav.name}</span>
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
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Columns
          </button>
        </div>

        {selectedTasks.length > 0 && (
          <div className="w-full md:hidden">
            <button
              onClick={deleteSelectedTasks}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-2"
            >
              Delete Selected ({selectedTasks.length})
            </button>
          </div>
        )}
        <div className="w-full md:hidden">
          <div className="relative">
            <button
              onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)}
              className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-between gap-2 bg-white"
            >
              <span className="flex items-center gap-2">
                <FiStar
                  className={selectedFavoriteId ? "text-yellow-400 fill-current" : "text-gray-400"}
                />
                <span className="truncate">
                  {selectedFavoriteId
                    ? favorites.find((f) => f.id === selectedFavoriteId)?.name || "Favorites"
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
                    <p className="text-xs text-gray-400 text-center py-4">No saved favorites yet</p>
                  ) : (
                    favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                          selectedFavoriteId === fav.id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => applyFavorite(fav)}
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">{fav.name}</span>
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
        </div>
        <div className="w-full md:hidden">
          <button
            onClick={() => setShowColumnModal(true)}
            className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center"
          >
            Columns
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{error}</p>
        </div>
      )}

      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search archived tasks..."
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
              Filters
            </button>
            {(searchTerm ||
              Object.keys(columnFilters).length > 0 ||
              Object.keys(columnSorts).length > 0 ||
              advancedSearchCriteria.length > 0) && (
              <button
                onClick={handleClearAllFilters}
                className="px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors flex items-center gap-2"
              >
                <FiX /> Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      <AdvancedSearchPanel
        open={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        fieldCatalog={taskColumnsCatalog.map((c) => ({
          key: c.key,
          label: c.label,
          fieldType: (c as any).fieldType,
          lookupType: (c as any).lookupType,
          multiSelectLookupType: (c as any).multiSelectLookupType,
          options: (c as any).options,
        }))}
        onSearch={(criteria) => setAdvancedSearchCriteria(criteria)}
        recentStorageKey="tasksArchivedAdvancedSearchRecent"
        initialCriteria={advancedSearchCriteria}
        anchorEl={advancedSearchButtonRef.current}
      />

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
                        filterType={(columnInfo as any).filterType || "text"}
                        filterOptions={
                          key === "status"
                            ? statusOptions
                            : key === "archive_reason"
                              ? archiveReasonOptions
                              : key === "priority"
                                ? priorityOptions
                                : undefined
                        }
                      />
                    );
                  })}
                </SortableContext>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedTasks.length > 0 ? (
                filteredAndSortedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewTask(task.id)}
                  >
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedTasks.includes(task.id)}
                        onChange={() => {}}
                        onClick={(e) => handleSelectTask(task.id, e)}
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
                          { label: "View", action: () => handleViewTask(task.id) },
                          {
                            label: "Delete",
                            action: async () => {
                              if (
                                !window.confirm(
                                  "Are you sure you want to delete this task?"
                                )
                              )
                                return;
                              setIsLoading(true);
                              try {
                                const token = document.cookie
                                  .split("; ")
                                  .find((r) => r.startsWith("token="))
                                  ?.split("=")[1];
                                const res = await fetch(`/api/tasks/${task.id}`, {
                                  method: "DELETE",
                                  headers: token
                                    ? { Authorization: `Bearer ${token}` }
                                    : undefined,
                                });
                                if (!res.ok) throw new Error("Failed to delete task");
                                await fetchTasks();
                              } catch (err) {
                                setError(
                                  err instanceof Error ? err.message : "Delete failed"
                                );
                              } finally {
                                setIsLoading(false);
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
                              <span className="text-sm font-medium text-gray-900">T {getColumnValue(task, key)}</span>
                              {task.archived_at && (
                                <CountdownTimer archivedAt={task.archived_at} />
                              )}
                            </div>
                          </td>
                        );
                      }
                      const colInfo = getColumnInfo(key) as
                        | {
                            key: string;
                            label: string;
                            fieldType?: string;
                            lookupType?: string;
                          }
                        | undefined;
                      const fieldInfo = colInfo
                        ? {
                            key: colInfo.key,
                            label: colInfo.label,
                            fieldType: colInfo.fieldType,
                            lookupType: colInfo.lookupType,
                          }
                        : { key, label: getColumnLabel(key) };
                      const isArchiveReason =
                        getColumnLabel(key).toLowerCase() === "archive reason";
                      return (
                        <td
                          key={key}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          <FieldValueRenderer
                            value={getColumnValue(task, key)}
                            fieldInfo={fieldInfo}
                            emptyPlaceholder="—"
                            clickable
                            stopPropagation
                            forceRenderAsStatus={isArchiveReason}
                            statusVariant={
                              isArchiveReason &&
                              String(getColumnValue(task, key) || "").toLowerCase() ===
                                "deletion"
                                ? "deletion"
                                : "blue"
                            }
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
                      ? "No archived tasks match your filters."
                      : searchTerm
                        ? "No archived tasks match your search."
                        : "No archived tasks found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>

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
              <span className="font-medium">{filteredAndSortedTasks.length}</span> of{" "}
              <span className="font-medium">{filteredAndSortedTasks.length}</span> results
            </p>
          </div>
        </div>
      </div>

      {showColumnModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowColumnModal(false)}
          title="Customize Columns"
          description="Drag to reorder, check/uncheck to show or hide columns in the archived task list."
          order={[
            ...columnFields,
            ...taskColumnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
          ]}
          visible={Object.fromEntries(taskColumnsCatalog.map((c) => [c.key, columnFields.includes(c.key)]))}
          fieldCatalog={taskColumnsCatalog.map((c) => ({ key: c.key, label: c.label }))}
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
              ...taskColumnsCatalog.filter((c) => !columnFields.includes(c.key)).map((c) => c.key),
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
          onReset={() => setColumnFields(taskColumnsCatalog.map((c) => c.key))}
          resetButtonText="Reset"
          listMaxHeight="60vh"
        />
      )}

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
                  placeholder="e.g. Archived Tasks"
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
                  {searchTerm && <li>Search term: &quot;{searchTerm}&quot;</li>}
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
