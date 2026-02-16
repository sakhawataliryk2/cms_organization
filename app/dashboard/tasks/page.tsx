'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
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
import RecordNameResolver from "@/components/RecordNameResolver";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import BulkActionsButton from "@/components/BulkActionsButton";
import BulkOwnershipModal from "@/components/BulkOwnershipModal";
import BulkStatusModal from "@/components/BulkStatusModal";
import BulkNoteModal from "@/components/BulkNoteModal";

interface Task {
  id: string;
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
  createdAt: number;
};

const FAVORITES_STORAGE_KEY = "tasksFavorites";

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
          className="bg-white border border-gray-300 shadow-lg rounded p-2 z-100 min-w-[150px]"
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

const formatDateTime = (date?: string, time?: string) => {
  if (!date) return '';

  try {
    const dateObj = new Date(date);
    let formatted = new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).format(dateObj);

    if (time) {
      formatted += ` ${time}`;
    }

    return formatted;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'in progress':
      return 'bg-blue-100 text-blue-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function TaskList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  
  // Individual row action modals state
  const [showOwnershipModal, setShowOwnershipModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  const TASK_BACKEND_COLUMN_KEYS = [
    "completed",
    "due",
    "job_seeker",
    "hiring_manager",
    "job",
    "lead",
    "placement",
    "owner",
    "priority",
    "status",
    "title",
    "dateCreated",
    "createdBy",
    "assignedTo",
  ];

  const humanizeTask = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const taskColumnsCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const name = String((f as any)?.field_name ?? (f as any)?.fieldName ?? "").trim();
        const label = (f as any)?.field_label ?? (f as any)?.fieldLabel ?? (name ? humanizeTask(name) : "");
        const isBackendCol = name && TASK_BACKEND_COLUMN_KEYS.includes(name);
        let filterType: "text" | "select" | "number" = "text";
        if (name === "status" || name === "priority" || name === "completed") filterType = "select";
        return {
          key: isBackendCol ? name : `custom:${label || name}`,
          label: String(label || name),
          sortable: isBackendCol,
          filterType,
          fieldType: (f as any)?.field_type,
          lookupType: (f as any)?.lookup_type || "",
        };
      });
    return fromApi;
  }, [availableFields]);

  const normalizeFields = (payload: any) => {
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
  };

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
        } catch { }

        const fields = normalizeFields(data);
        setAvailableFields(fields);
      } catch {
        setAvailableFields([]);
      } finally {
        setIsLoadingFields(false);
      }
    };

    fetchAvailableFields();
  }, []);

  const getColumnLabel = (key: string) =>
    taskColumnsCatalog.find((c) => c.key === key)?.label ?? key;

  const getColumnInfo = (key: string) =>
    taskColumnsCatalog.find((c) => c.key === key);

  const getColumnValue = (task: any, key: string) => {
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = task?.customFields || task?.custom_fields || {};
      const val = cf?.[rawKey];
      return val === undefined || val === null || val === "" ? "—" : String(val);
    }

    // switch (key) {
    //   case "completed":
    //     return task.is_completed ? "Yes" : "No";

    //   case "due":
    //     return formatDateTime(task.due_date, task.due_time) || "Not set";

    //   case "job_seeker":
    //     return task.job_seeker_name || "—";

    //   case "hiring_manager":
    //     return task.hiring_manager_name || "—";

    //   case "job":
    //     return task.job_title || "—";

    //   case "lead":
    //     return task.lead_name || "—";

    //   case "placement":
    //     return task.placement_id || "—";

    //   case "owner":
    //     return task.owner || task.created_by_name || "—";

    //   case "priority":
    //     return task.priority || "—";

    //   case "status":
    //     return task.status || "—";

    //   case "title":
    //     return task.title || "—";

    //   case "dateCreated":
    //     return formatDateTime(task.created_at) || "—";

    //   case "createdBy":
    //     return task.created_by_name || "—";

    //   case "assignedTo":
    //     return task.assigned_to_name || "—";

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
  } = useHeaderConfig({
    entityType: "TASK",
    configType: "columns",
    defaultFields: [],
  });

  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (columnFields.length > 0) {
      localStorage.setItem("tasksColumnOrder", JSON.stringify(columnFields));
    }
  }, [columnFields]);

  useEffect(() => {
    const catalogKeys = taskColumnsCatalog.map((c) => c.key);
    if (catalogKeys.length === 0) return;
    const catalogSet = new Set(catalogKeys);
    const savedOrder = localStorage.getItem("tasksColumnOrder");
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
  }, [taskColumnsCatalog]);

  // Favorites State
  const [favorites, setFavorites] = useState<TaskFavorite[]>([]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string>("");
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

  const applyFavorite = (fav: TaskFavorite) => {
    const catalogKeys = new Set(taskColumnsCatalog.map((c) => c.key));
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

  const persistFavorites = (next: TaskFavorite[]) => {
    setFavorites(next);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
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

    const newFav: TaskFavorite = {
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

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
    setColumnSorts({});
    setSelectedFavoriteId("");
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


  // Unique options for select filters
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    tasks.forEach((t) => { if (t.status) statuses.add(t.status); });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [tasks]);

  const priorityOptions = useMemo(() => {
    const priorities = new Set<string>();
    tasks.forEach((t) => { if (t.priority) priorities.add(t.priority); });
    return Array.from(priorities).map((p) => ({ label: p, value: p }));
  }, [tasks]);

  const completedOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];


  // Fetch tasks data when component mounts
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks', {
        headers: {
          'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      console.log('Tasks data:', data);
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedTasks = useMemo(() => {
    // Exclude archived tasks from main list
    let result = tasks.filter((t) => t.status !== "Archived" && !t.archived_at);

    // Apply global search
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((task) => {
        // ID search (support "T123" or just "123")
        const idMatch =
          String(task.id).toLowerCase().includes(term) ||
          `t${task.id}`.toLowerCase().includes(term);

        // Core fields
        const coreMatch =
          (task.title?.toLowerCase().includes(term) ?? false) ||
          (task.description?.toLowerCase().includes(term) ?? false) ||
          (task.owner?.toLowerCase().includes(term) ?? false) ||
          (task.job_seeker_name?.toLowerCase().includes(term) ?? false) ||
          (task.hiring_manager_name?.toLowerCase().includes(term) ?? false) ||
          (task.job_title?.toLowerCase().includes(term) ?? false) ||
          (task.lead_name?.toLowerCase().includes(term) ?? false) ||
          (task.status?.toLowerCase().includes(term) ?? false) ||
          (task.priority?.toLowerCase().includes(term) ?? false);

        // Custom fields search
        const cf = task.customFields || task.custom_fields || {};
        const customMatch = Object.values(cf).some((val) =>
          String(val || "").toLowerCase().includes(term)
        );

        return idMatch || coreMatch || customMatch;
      });
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((task) => {
        const value = getColumnValue(task, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        const columnInfo = getColumnInfo(columnKey);
        if ((columnInfo?.filterType as string) === "number") {
          return String(value) === String(filterValue);
        }

        if (columnInfo?.filterType === "select") {
          return valueStr === filterStr;
        }

        return valueStr.includes(filterStr);
      });
    });

    // Apply sorting
    const activeSorts = Object.entries(columnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
      const [sortKey, sortDir] = activeSorts[0];
      result.sort((a, b) => {
        let aValue = getColumnValue(a, sortKey);
        let bValue = getColumnValue(b, sortKey);

        // Handle dates for "due"
        if (sortKey === "due") {
          aValue = a.due_date ? new Date(a.due_date).getTime().toString() : undefined;
          bValue = b.due_date ? new Date(b.due_date).getTime().toString() : undefined;
        }

        // Handle numeric values
        const aNum = typeof aValue === "string" ? Number(aValue) : Number(aValue);
        const bNum = typeof bValue === "string" ? Number(bValue) : Number(bValue);

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
  }, [tasks, searchTerm, columnFilters, columnSorts]);

  const handleViewTask = (id: string) => {
    router.push(`/dashboard/tasks/view?id=${id}`);
  };

  const handleAddTask = () => {
    router.push('/dashboard/tasks/add');
  };

  const handleViewArchived = () => {
    router.push("/dashboard/tasks/archived");
  };


  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(filteredAndSortedTasks.map(task => task.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event

    if (selectedTasks.includes(id)) {
      setSelectedTasks(selectedTasks.filter(taskId => taskId !== id));
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedTasks([...selectedTasks, id]);
      // If all tasks are now selected, update selectAll state
      if ([...selectedTasks, id].length === filteredAndSortedTasks.length) {
        setSelectAll(true);
      }
    }
  };

  // CSV Export function for selected records
  const handleCSVExport = () => {
    if (selectedTasks.length === 0) return;

    const selectedData = tasks.filter((task) =>
      selectedTasks.includes(task.id)
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
      ...selectedData.map((task) => {
        const row = [
          `T ${task.id}`,
          ...columnFields.map((key) => escapeCSV(getColumnValue(task, key)))
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
    link.setAttribute('download', `tasks-export-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    fetchTasks();
    setSelectedTaskId(null);
    setShowOwnershipModal(false);
    setShowStatusModal(false);
    setShowNoteModal(false);
  };

  const toggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    if (!taskId) {
      console.error('Task ID is required');
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
        },
        body: JSON.stringify({
          isCompleted: !isCompleted,
          status: !isCompleted ? 'Completed' : 'Pending'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      // Refresh tasks
      await fetchTasks();
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating the task');
    }
  };


  if (isLoading) {
    return <LoadingScreen message="Loading tasks..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Tasks</h1>
        <div className="flex space-x-4">
          {selectedTasks.length > 0 && (
            <BulkActionsButton
              selectedCount={selectedTasks.length}
              entityType="task"
              entityIds={selectedTasks}
              availableFields={availableFields}
              onSuccess={() => {
                fetchTasks();
                setSelectedTasks([]);
                setSelectAll(false);
              }}
              onCSVExport={handleCSVExport}
            />
          )}
          <div className="relative" ref={favoritesMenuRef}>
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
                        className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer ${selectedFavoriteId === fav.id ? "bg-blue-50" : ""}`}
                        onClick={() => {
                          setSelectedFavoriteId(fav.id);
                          applyFavorite(fav);
                          setFavoritesMenuOpen(false);
                        }}
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">{fav.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = favorites.filter((f) => f.id !== fav.id);
                            persistFavorites(updated);
                            if (selectedFavoriteId === fav.id) setSelectedFavoriteId("");
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
          <button
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Columns
          </button>
          <button
            onClick={handleViewArchived}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Archived
          </button>
          <button
            onClick={handleAddTask}
            className="hidden md:flex px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Task
          </button>
        </div>
        <div className="flex flex-col gap-2 w-full md:hidden">
          <div className="w-full" ref={favoritesMenuMobileRef}>
            <button
              onClick={() => setFavoritesMenuOpen(!favoritesMenuOpen)}
              className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-between bg-white"
            >
              <span className="flex items-center gap-2">
                <FiStar className={selectedFavoriteId ? "text-yellow-400 fill-current" : "text-gray-400"} />
                {selectedFavoriteId ? favorites.find((f) => f.id === selectedFavoriteId)?.name || "Favorites" : "Favorites"}
              </span>
              <FiChevronDown />
            </button>
            {favoritesMenuOpen && (
              <div className="mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <button
                    onClick={handleOpenSaveFavoriteModal}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium flex items-center gap-2"
                  >
                    <FiStar className="text-blue-500" />
                    Save Current Search
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {favorites.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No saved favorites yet</p>
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
                        <span className="text-sm text-gray-700 truncate flex-1">{fav.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = favorites.filter((f) => f.id !== fav.id);
                            persistFavorites(updated);
                            if (selectedFavoriteId === fav.id) setSelectedFavoriteId("");
                          }}
                          className="text-gray-400 hover:text-red-500 p-1"
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
          {selectedTasks.length > 0 && (
            <div className="w-full md:hidden">
              <BulkActionsButton
                selectedCount={selectedTasks.length}
                entityType="task"
                entityIds={selectedTasks}
                availableFields={availableFields}
                onSuccess={() => {
                  fetchTasks();
                  setSelectedTasks([]);
                  setSelectAll(false);
                }}
                onCSVExport={handleCSVExport}
              />
            </div>
          )}
          <button
            onClick={() => setShowColumnModal(true)}
            className="w-full md:hidden px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Columns
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          <p>{error}</p>
        </div>
      )}

      {/* Search and Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search tasks..."
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

      {/* Tasks Table */}
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="overflow-x-auto">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Fixed checkbox */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </th>

                  {/* Fixed Actions */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>

                  {/* Fixed ID */}
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
                            key === "status"
                              ? statusOptions
                              : key === "priority"
                                ? priorityOptions
                                : key === "completed"
                                  ? completedOptions
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
                      {/* Fixed checkbox */}
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          checked={selectedTasks.includes(task.id)}
                          onChange={() => { }}
                          onClick={(e) => handleSelectTask(task.id, e)}
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
                            { label: "View", action: () => handleViewTask(task.id) },
                            ...(ownerField ? [{
                              label: "Change Ownership",
                              action: () => {
                                setSelectedTaskId(task.id);
                                setShowOwnershipModal(true);
                              },
                            }] : []),
                            ...(statusField ? [{
                              label: "Change Status",
                              action: () => {
                                setSelectedTaskId(task.id);
                                setShowStatusModal(true);
                              },
                            }] : []),
                            {
                              label: "Add Note",
                              action: () => {
                                setSelectedTaskId(task.id);
                                setShowNoteModal(true);
                              },
                            },
                          ]}
                        />
                      </td>

                      {/* Fixed ID */}
                      <td className="px-6 py-4 text-black whitespace-nowrap">
                        T {task?.id}
                      </td>

                      {/* Dynamic cells */}
                      {/* {columnFields.map((key) => (
                        <td
                          key={key}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {key === "completed" ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskComplete(task.id, task.is_completed);
                              }}
                              className={`px-2 py-1 rounded text-xs font-semibold ${task.is_completed
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                }`}
                            >
                              {task.is_completed ? "✓ Yes" : "○ No"}
                            </button>
                          ) : key === "priority" ? (
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(
                                task.priority
                              )}`}
                            >
                              {getColumnValue(task, key)}
                            </span>
                          ) : key === "status" ? (
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                task.status
                              )}`}
                            >
                              {getColumnValue(task, key)}
                            </span>
                          ) : (
                            getColumnValue(task, key)
                          )}
                        </td>
                      ))} */}
                      {columnFields.map((key) => (
                        <td
                          key={key}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {/* {getColumnLabel(key).toLowerCase() === "status" ? (
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100`}
                            >
                              {getColumnValue(task, key)}
                            </span>
                          ) : (getColumnValue(task, key) || "").toLowerCase().includes("@") ? (
                            <a
                              href={`mailto:${getColumnValue(task, key)}`}
                              className="text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {getColumnValue(task, key)}
                            </a>
                          ) : (getColumnValue(task, key) || "").toLowerCase().startsWith("http") || (getColumnValue(task, key) || "").toLowerCase().startsWith("https") ? (
                            <a
                              href={(getColumnValue(task, key) || "")}
                              className="text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >{(getColumnValue(task, key) || "")}</a>
                          ) : (getColumnInfo(key) as any)?.fieldType === "lookup" || (getColumnInfo(key) as any)?.fieldType === "multiselect_lookup" ? (
                            <RecordNameResolver
                              id={String(getColumnValue(task, key) || "") || null}
                              type={(getColumnInfo(key) as any)?.lookupType || (getColumnInfo(key) as any)?.multiSelectLookupType || "tasks"}
                              clickable
                              fallback={String(getColumnValue(task, key) || "") || ""}
                            />
                          ) : /\(\d{3}\)\s\d{3}-\d{4}/.test(getColumnValue(task, key) || "") ? (
                              href={`tel:${(getColumnValue(task, key) || "").replace(/\D/g, "")}`}
                              className="text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >{getColumnValue(task, key)}</a>
                          ) : (
                            getColumnValue(task, key)
                          )} */}
                          <FieldValueRenderer
                            value={getColumnValue(task, key)}
                            fieldInfo={(() => {
                              const info = getColumnInfo(key);
                              return info ? { key: info.key, label: info.label, fieldType: (info as any).fieldType, lookupType: (info as any).lookupType, multiSelectLookupType: (info as any).multiSelectLookupType } : { key, label: getColumnLabel(key) };
                            })() as any}
                            emptyPlaceholder="N/A"
                            clickable
                            stopPropagation
                            className="text-sm text-gray-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3 + columnFields.length}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                    >
                      {searchTerm
                        ? "No tasks found matching your search."
                        : 'No tasks found. Click "Add Task" to create one.'}
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
                <span className="font-medium">{filteredAndSortedTasks.length}</span>{" "}
                of{" "}
                <span className="font-medium">{filteredAndSortedTasks.length}</span>{" "}
                results
              </p>
            </div>
            {filteredAndSortedTasks.length > 0 && (
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
                  {taskColumnsCatalog.map((c) => {
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
                        <span className="text-sm text-gray-800">
                          {c.label}
                        </span>
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
                    onClick={() => setColumnFields(taskColumnsCatalog.map((c) => c.key))}
                  >
                    Reset
                  </button>

                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={!!isSavingColumns}
                    onClick={async () => {
                      const ok = await saveColumnConfig();
                      if (ok !== false) setShowColumnModal(false);
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
                  placeholder="e.g. High Priority Tasks"
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
      {showOwnershipModal && ownerField && selectedTaskId && (
        <BulkOwnershipModal
          open={showOwnershipModal}
          onClose={() => {
            setShowOwnershipModal(false);
            setSelectedTaskId(null);
          }}
          entityType="task"
          entityIds={[selectedTaskId]}
          fieldLabel={ownerField.field_label || 'Owner'}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showStatusModal && statusField && selectedTaskId && (
        <BulkStatusModal
          open={showStatusModal}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedTaskId(null);
          }}
          entityType="task"
          entityIds={[selectedTaskId]}
          fieldLabel={statusField.field_label || 'Status'}
          options={statusField.options || []}
          availableFields={availableFields}
          onSuccess={handleIndividualActionSuccess}
        />
      )}

      {showNoteModal && selectedTaskId && (
        <BulkNoteModal
          open={showNoteModal}
          onClose={() => {
            setShowNoteModal(false);
            setSelectedTaskId(null);
          }}
          entityType="task"
          entityIds={[selectedTaskId]}
          onSuccess={handleIndividualActionSuccess}
        />
      )}
    </div>
  );
}