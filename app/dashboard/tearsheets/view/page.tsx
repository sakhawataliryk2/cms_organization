"use client";

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import LoadingScreen from "@/components/LoadingScreen";
import PanelWithHeader from "@/components/PanelWithHeader";
import { FiArrowUp, FiArrowDown, FiFilter, FiSearch, FiX } from "react-icons/fi";
import { BsFillPinAngleFill } from "react-icons/bs";
import { TbGripVertical } from "react-icons/tb";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { restrictToWindowEdges, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TEARSHEET_VIEW_TAB_IDS = ["overview", "organizations", "hiring-managers", "jobs", "job-seekers", "leads", "tasks", "placements"];

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

// Sortable Panel Component with drag handle
function SortablePanel({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
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

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 p-1 bg-gray-100 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <TbGripVertical className="no-print w-5 h-5 text-gray-600" />
      </button>
      {children}
    </div>
  );
}

// Sortable Field Row for Edit Modal
function SortableFieldRow({
  id,
  label,
  checked,
  onToggle,
  isOverlay,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 border border-gray-200 rounded bg-white ${isOverlay ? "shadow-lg cursor-grabbing" : "hover:bg-gray-50"} ${isDragging && !isOverlay ? "invisible" : ""}`}
    >
      {!isOverlay && (
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={18} />
        </button>
      )}
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0"
      />
      <span className="text-sm text-gray-700 flex-1 truncate">{label}</span>
    </div>
  );
}

// Droppable Column Container
function DroppableContainer({ id, children, items }: { id: string, children: React.ReactNode, items: string[] }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="flex flex-col gap-4 w-full min-h-[100px]">
        {children}
      </div>
    </SortableContext>
  );
}

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
          {sortState === "asc" ? (
            <FiArrowUp size={14} />
          ) : (
            <FiArrowDown size={14} />
          )}
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

export default function TearsheetView() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const tearsheetId = searchParams.get("id");
  const tabFromUrl = searchParams.get("tab");

  const [activeTab, setActiveTabState] = useState(() =>
    tabFromUrl && TEARSHEET_VIEW_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "overview"
  );

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "overview") params.delete("tab");
    else params.set("tab", tabId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (tabFromUrl && TEARSHEET_VIEW_TAB_IDS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    } else if (!tabFromUrl && activeTab !== "overview") {
      setActiveTabState("overview");
    }
  }, [tabFromUrl]);

  // Tearsheet data
  const [tearsheet, setTearsheet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overview panels state
  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["overview"],
    right: ["statistics"],
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // Tab-specific data
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [hiringManagers, setHiringManagers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobSeekers, setJobSeekers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [placements, setPlacements] = useState<any[]>([]);
  const [isLoadingTabData, setIsLoadingTabData] = useState(false);

  // Column configuration for tab tables
  const [orgColumnFields, setOrgColumnFields] = useState<string[]>(["id", "name"]);
  const [orgColumnSorts, setOrgColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [orgColumnFilters, setOrgColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [orgSearchTerm, setOrgSearchTerm] = useState("");

  const [hmColumnFields, setHmColumnFields] = useState<string[]>(["id", "name", "email", "organization"]);
  const [hmColumnSorts, setHmColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [hmColumnFilters, setHmColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [hmSearchTerm, setHmSearchTerm] = useState("");

  const [jobColumnFields, setJobColumnFields] = useState<string[]>(["id", "title", "organization"]);
  const [jobColumnSorts, setJobColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [jobColumnFilters, setJobColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [jobSearchTerm, setJobSearchTerm] = useState("");

  const [jobSeekerColumnFields, setJobSeekerColumnFields] = useState<string[]>(["id", "name", "email"]);
  const [jobSeekerColumnSorts, setJobSeekerColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [jobSeekerColumnFilters, setJobSeekerColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [jobSeekerSearchTerm, setJobSeekerSearchTerm] = useState("");

  const [leadColumnFields, setLeadColumnFields] = useState<string[]>(["id", "name", "email"]);
  const [leadColumnSorts, setLeadColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [leadColumnFilters, setLeadColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [leadSearchTerm, setLeadSearchTerm] = useState("");

  const [taskColumnFields, setTaskColumnFields] = useState<string[]>(["id", "name", "status", "priority", "due_date", "owner"]);
  const [taskColumnSorts, setTaskColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [taskColumnFilters, setTaskColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [taskSearchTerm, setTaskSearchTerm] = useState("");

  const [placementColumnFields, setPlacementColumnFields] = useState<string[]>(["id", "job_seeker", "job", "status"]);
  const [placementColumnSorts, setPlacementColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [placementColumnFilters, setPlacementColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [placementSearchTerm, setPlacementSearchTerm] = useState("");

  // Panel editing state
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [panelFieldOrder, setPanelFieldOrder] = useState<Record<string, string[]>>({
    overview: ["name", "id", "created", "owner"],
    statistics: ["job_seekers", "hiring_managers", "job_orders", "leads", "organizations", "placements", "tasks"],
  });
  const [panelFieldVisible, setPanelFieldVisible] = useState<Record<string, Record<string, boolean>>>({
    overview: { name: true, id: true, created: true, owner: true },
    statistics: { job_seekers: true, hiring_managers: true, job_orders: true, leads: true, organizations: true, placements: true, tasks: true },
  });
  const [modalFieldOrder, setModalFieldOrder] = useState<string[]>([]);
  const [modalFieldVisible, setModalFieldVisible] = useState<Record<string, boolean>>({});
  const [panelDragActiveId, setPanelDragActiveId] = useState<string | null>(null);

  // Header fields configuration
  const TEARSHEET_DEFAULT_HEADER_FIELDS: string[] = [];
  const {
    headerFields,
    setHeaderFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    saveHeaderConfig,
  } = useHeaderConfig({
    entityType: "TEARSHEET",
    defaultFields: TEARSHEET_DEFAULT_HEADER_FIELDS,
    configType: "header",
  });

  const buildHeaderFieldCatalog = (): Array<{ key: string; label: string }> => {
    // For tearsheets, we can add custom fields if needed
    return [];
  };

  const headerFieldCatalog = buildHeaderFieldCatalog();

  const getHeaderFieldValue = (key: string) => {
    if (!tearsheet) return "-";
    const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;
    const t = tearsheet as any;
    let v = t[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    v = t.customFields?.[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    const field = headerFieldCatalog.find((f) => f.key === key);
    if (field) v = t.customFields?.[field.label];
    return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
  };

  const getHeaderFieldLabel = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found?.label || key;
  };

  // Delete handler
  const handleDelete = async () => {
    if (!tearsheetId) return;

    const confirmMessage = `Are you sure you want to delete tearsheet "${tearsheet?.name || `TE ${tearsheetId}`}"?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const response = await fetch(`/api/tearsheets/${tearsheetId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to delete tearsheet" }));
        throw new Error(errorData.message || "Failed to delete tearsheet");
      }

      toast.success("Tearsheet deleted successfully");
      router.push("/dashboard/tearsheets");
    } catch (err) {
      console.error("Error deleting tearsheet:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete tearsheet. Please try again.");
    }
  };

  // Action options
  const actionOptions = [
    { label: "Add Note", action: () => { } },
    { label: "Delete", action: handleDelete },
  ];

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const measuringConfig = useMemo(() => ({
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  }), []);

  const dropAnimationConfig = useMemo(() => ({
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  }), []);

  // Fetch tearsheet data
  useEffect(() => {
    if (!tearsheetId) {
      setError("Tearsheet ID is required");
      setIsLoading(false);
      return;
    }

    const fetchTearsheet = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
        const response = await fetch(`/api/tearsheets/${tearsheetId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch tearsheet");
        }

        setTearsheet(data.tearsheet);

        // Track view (fail silently if endpoint doesn't exist)
        try {
          await fetch(`/api/tearsheets/${tearsheetId}/view`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        } catch (viewErr) {
          // Silently ignore view tracking errors - this is a non-critical feature
          console.debug('View tracking failed (non-critical):', viewErr);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch tearsheet");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTearsheet();
  }, [tearsheetId]);

  // Fetch organizations count for statistics (always fetch, regardless of active tab)
  useEffect(() => {
    if (!tearsheetId) return;

    const fetchOrganizationsCount = async () => {
      try {
        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
        const response = await fetch(`/api/tearsheets/${tearsheetId}/organizations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        const data = await response.json();
        if (response.ok) {
          setOrganizations(data.organizations || []);
        }
      } catch (err) {
        console.error('Error fetching organizations count:', err);
      }
    };

    fetchOrganizationsCount();
  }, [tearsheetId]);

  // Fetch tab-specific data
  useEffect(() => {
    if (!tearsheetId || !activeTab || activeTab === "overview") return;

    const fetchTabData = async () => {
      setIsLoadingTabData(true);
      try {
        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
        let endpoint = "";
        let setter: (data: any[]) => void;

        switch (activeTab) {
          case "organizations":
            endpoint = `/api/tearsheets/${tearsheetId}/organizations`;
            setter = (data: any) => setOrganizations(data.organizations || []);
            break;
          case "hiring-managers":
            endpoint = `/api/tearsheets/${tearsheetId}/records?type=hiring_managers`;
            setter = (data: any) => setHiringManagers(data.records || []);
            break;
          case "jobs":
            endpoint = `/api/tearsheets/${tearsheetId}/records?type=jobs`;
            setter = (data: any) => setJobs(data.records || []);
            break;
          case "job-seekers":
            endpoint = `/api/tearsheets/${tearsheetId}/records?type=job_seekers`;
            setter = (data: any) => setJobSeekers(data.records || []);
            break;
          case "leads":
            endpoint = `/api/tearsheets/${tearsheetId}/records?type=leads`;
            setter = (data: any) => setLeads(data.records || []);
            break;
          case "tasks":
            endpoint = `/api/tearsheets/${tearsheetId}/records?type=tasks`;
            setter = (data: any) => setTasks(data.records || []);
            break;
          case "placements":
            endpoint = `/api/tearsheets/${tearsheetId}/records?type=placements`;
            setter = (data: any) => setPlacements(data.records || []);
            break;
          default:
            return;
        }

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        const data = await response.json();
        if (response.ok) {
          setter(data);
        }
      } catch (err) {
        console.error(`Error fetching ${activeTab} data:`, err);
      } finally {
        setIsLoadingTabData(false);
      }
    };

    fetchTabData();
  }, [tearsheetId, activeTab]);

  // Pinned record state
  useEffect(() => {
    const syncPinned = () => {
      if (!tearsheet) return;
      const key = buildPinnedKey("tearsheet", tearsheet.id.toString());
      setIsRecordPinned(isPinnedRecord(key));
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [tearsheet]);

  const handleTogglePinnedRecord = () => {
    if (!tearsheet) return;
    const key = buildPinnedKey("tearsheet", tearsheet.id.toString());
    const label = tearsheet.name || `TE ${tearsheet.id}`;
    let url = `/dashboard/tearsheets/view?id=${tearsheet.id}`;
    if (activeTab && activeTab !== "overview") url += `&tab=${activeTab}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      toast.info("Maximum 10 pinned records reached");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGoBack = () => {
    router.push("/dashboard/tearsheets");
  };

  // Panel drag handlers
  const findContainer = useCallback((id: string) => {
    if (id === "left" || id === "right") {
      return id;
    }
    if (columns.left.includes(id)) return "left";
    if (columns.right.includes(id)) return "right";
    return undefined;
  }, [columns]);

  const handlePanelDragStart = useCallback((event: any) => {
    setActiveId(event.active.id);
  }, []);

  const handlePanelDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handlePanelDragOver = useCallback((_event: DragOverEvent) => {
    return;
  }, []);

  const handlePanelDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    setColumns((prev) => {
      const findContainerInState = (id: string) => {
        if (id === "left" || id === "right") return id as "left" | "right";
        if (prev.left.includes(id)) return "left";
        if (prev.right.includes(id)) return "right";
        return undefined;
      };

      const source = findContainerInState(activeId);
      const target = findContainerInState(overId);

      if (!source || !target) return prev;

      if (source === target) {
        if (overId === source) return prev;
        const oldIndex = prev[source].indexOf(activeId);
        const newIndex = prev[source].indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        return {
          ...prev,
          [source]: arrayMove(prev[source], oldIndex, newIndex),
        };
      }

      const sourceItems = prev[source].filter((id) => id !== activeId);
      const targetItems = [activeId, ...prev[target].filter((id) => id !== activeId)];

      return {
        ...prev,
        [source]: sourceItems,
        [target]: targetItems,
      };
    });

    setActiveId(null);
  }, []);

  // Render panels
  const renderPanelPreview = (panelId: string) => {
    const title = panelId === "overview" ? "Tearsheet Overview:" : "Statistics:";
    return (
      <div className="bg-white border border-gray-200 rounded shadow-lg w-[340px] max-w-[90vw]">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-sm">
          {title}
        </div>
        <div className="px-3 py-3 text-sm text-gray-500">Moving panel...</div>
      </div>
    );
  };

  // Field definitions
  const getFieldValue = (panelId: string, fieldKey: string) => {
    if (!tearsheet) return "-";
    const fieldMap: Record<string, Record<string, string | number>> = {
      overview: {
        name: tearsheet.name || "-",
        id: `TE ${tearsheet.id}`,
        created: tearsheet.created_at ? new Date(tearsheet.created_at).toLocaleDateString() : "-",
        owner: tearsheet.owner_name || "-",
      },
      statistics: {
        job_seekers: tearsheet.job_seeker_count || 0,
        hiring_managers: tearsheet.hiring_manager_count || 0,
        job_orders: tearsheet.job_order_count || 0,
        leads: tearsheet.lead_count || 0,
        // Use actual organizations array length (fetched separately to include direct links)
        // This ensures accurate count including organizations directly linked via tearsheet_organizations table
        // Falls back to tearsheet.organization_count during initial render before fetch completes
        organizations: organizations.length || (tearsheet.organization_count || 0),
        placements: tearsheet.placement_count || 0,
        tasks: tearsheet.task_count || 0,
      },
    };
    return fieldMap[panelId]?.[fieldKey] ?? "-";
  };

  const getFieldLabel = (panelId: string, fieldKey: string) => {
    const labelMap: Record<string, Record<string, string>> = {
      overview: {
        name: "Name",
        id: "ID",
        created: "Created",
        owner: "Owner",
      },
      statistics: {
        job_seekers: "Job Seekers",
        hiring_managers: "Hiring Managers",
        job_orders: "Job Orders",
        leads: "Leads",
        organizations: "Organizations",
        placements: "Placements",
        tasks: "Tasks",
      },
    };
    return labelMap[panelId]?.[fieldKey] ?? fieldKey;
  };

  const renderPanel = (panelId: string) => {
    if (panelId === "overview") {
      const visibleFields = (panelFieldOrder.overview || []).filter(
        (key) => panelFieldVisible.overview?.[key] !== false
      );

      return (
        <SortablePanel key={panelId} id={panelId}>
          <PanelWithHeader
            title="Tearsheet Overview:"
            onEdit={() => handleEditPanel("overview")}
          >
            <div className="space-y-0 border border-gray-200 rounded">
              {tearsheet ? (
                visibleFields.length > 0 ? (
                  visibleFields.map((fieldKey) => (
                    <div
                      key={fieldKey}
                      className="flex border-b border-gray-200 last:border-b-0"
                    >
                      <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        {getFieldLabel("overview", fieldKey)}:
                      </div>
                      <div className="flex-1 p-2">
                        {getFieldValue("overview", fieldKey)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-gray-500 italic">No fields visible</div>
                )
              ) : (
                <div className="p-4 text-gray-500 italic">Loading...</div>
              )}
            </div>
          </PanelWithHeader>
        </SortablePanel>
      );
    }

    if (panelId === "statistics") {
      const visibleFields = (panelFieldOrder.statistics || []).filter(
        (key) => panelFieldVisible.statistics?.[key] !== false
      );

      return (
        <SortablePanel key={panelId} id={panelId}>
          <PanelWithHeader
            title="Statistics"
            onEdit={() => handleEditPanel("statistics")}
          >
            <div className="space-y-0 border border-gray-200 rounded">
              {tearsheet ? (
                visibleFields.length > 0 ? (
                  visibleFields.map((fieldKey) => (
                    <div
                      key={fieldKey}
                      className="flex border-b border-gray-200 last:border-b-0"
                    >
                      <div className="w-44 min-w-52 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        {getFieldLabel("statistics", fieldKey)}:
                      </div>
                      <div className="flex-1 p-2">
                        {getFieldValue("statistics", fieldKey)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-gray-500 italic">No fields visible</div>
                )
              ) : (
                <div className="p-4 text-gray-500 italic">Loading...</div>
              )}
            </div>
          </PanelWithHeader>
        </SortablePanel>
      );
    }

    return null;
  };

  // Handle edit panel click
  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
    const currentOrder = panelFieldOrder[panelId] || [];
    const currentVisible = panelFieldVisible[panelId] || {};
    setModalFieldOrder([...currentOrder]);
    setModalFieldVisible({ ...currentVisible });
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Save panel field configuration
  const savePanelFieldConfig = () => {
    if (!editingPanel) return;
    const orderedVisible = modalFieldOrder.filter((key) => modalFieldVisible[key] === true);
    if (orderedVisible.length === 0) {
      toast.error("At least one field must be visible");
      return;
    }
    setPanelFieldOrder((prev) => ({ ...prev, [editingPanel]: orderedVisible }));
    setPanelFieldVisible((prev) => ({ ...prev, [editingPanel]: modalFieldVisible }));
    setEditingPanel(null);
    toast.success("Panel fields updated");
  };

  // Toggle field visibility in modal
  const toggleModalFieldVisible = (key: string) => {
    setModalFieldVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle drag end for field reordering
  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setPanelDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalFieldOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  // Filter and sort helpers
  const filterAndSortData = (
    data: any[],
    searchTerm: string,
    columnFilters: Record<string, ColumnFilterState>,
    columnSorts: Record<string, ColumnSortState>,
    getColumnValue: (row: any, key: string) => any
  ) => {
    let result = [...data];

    // Apply search
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) =>
          String(val || "").toLowerCase().includes(term)
        )
      );
    }

    // Apply filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter((row) => {
          const cellValue = getColumnValue(row, key);
          return String(cellValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    // Apply sorting
    const activeSortColumn = Object.keys(columnSorts).find((key) => columnSorts[key] !== null);
    if (activeSortColumn) {
      const direction = columnSorts[activeSortColumn];
      result.sort((a, b) => {
        let aValue = getColumnValue(a, activeSortColumn);
        let bValue = getColumnValue(b, activeSortColumn);

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue === bValue) return 0;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === "asc" ? aValue - bValue : bValue - aValue;
        }

        const aString = String(aValue).toLowerCase();
        const bString = String(bValue).toLowerCase();

        return direction === "asc"
          ? aString.localeCompare(bString)
          : bString.localeCompare(aString);
      });
    }

    return result;
  };

  // Render table for tab
  const renderTable = (
    data: any[],
    columnFields: string[],
    columnSorts: Record<string, ColumnSortState>,
    columnFilters: Record<string, ColumnFilterState>,
    searchTerm: string,
    setColumnSorts: React.Dispatch<React.SetStateAction<Record<string, ColumnSortState>>>,
    setColumnFilters: React.Dispatch<React.SetStateAction<Record<string, ColumnFilterState>>>,
    getColumnValue: (row: any, key: string) => any,
    getColumnLabel: (key: string) => string,
    getColumnFilterType: (key: string) => "text" | "select" | "number",
    onRowClick?: (row: any) => void
  ) => {
    const filteredData = filterAndSortData(data, searchTerm, columnFilters, columnSorts, getColumnValue);

    const handleColumnSort = (columnKey: string) => {
      setColumnSorts((prev: Record<string, ColumnSortState>) => {
        const current = prev[columnKey];
        let next: ColumnSortState = "asc";
        if (current === "asc") next = "desc";
        else if (current === "desc") next = null;
        return { ...prev, [columnKey]: next };
      });
    };

    const handleColumnFilter = (columnKey: string, value: string) => {
      setColumnFilters((prev: Record<string, ColumnFilterState>) => ({
        ...prev,
        [columnKey]: value || null,
      } as Record<string, ColumnFilterState>));
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 border-b">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full p-2 pl-10 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => {
                if (activeTab === "organizations") setOrgSearchTerm(e.target.value);
                else if (activeTab === "hiring-managers") setHmSearchTerm(e.target.value);
                else if (activeTab === "jobs") setJobSearchTerm(e.target.value);
                else if (activeTab === "job-seekers") setJobSeekerSearchTerm(e.target.value);
                else if (activeTab === "leads") setLeadSearchTerm(e.target.value);
                else if (activeTab === "tasks") setTaskSearchTerm(e.target.value);
                else if (activeTab === "placements") setPlacementSearchTerm(e.target.value);
              }}
            />
          </div>
          {(searchTerm || Object.keys(columnFilters).length > 0) && (
            <button
              onClick={() => {
                if (activeTab === "organizations") {
                  setOrgSearchTerm("");
                  setOrgColumnFilters({});
                } else if (activeTab === "hiring-managers") {
                  setHmSearchTerm("");
                  setHmColumnFilters({});
                } else if (activeTab === "jobs") {
                  setJobSearchTerm("");
                  setJobColumnFilters({});
                } else if (activeTab === "job-seekers") {
                  setJobSeekerSearchTerm("");
                  setJobSeekerColumnFilters({});
                } else if (activeTab === "leads") {
                  setLeadSearchTerm("");
                  setLeadColumnFilters({});
                } else if (activeTab === "tasks") {
                  setTaskSearchTerm("");
                  setTaskColumnFilters({});
                } else if (activeTab === "placements") {
                  setPlacementSearchTerm("");
                  setPlacementColumnFilters({});
                }
              }}
              className="px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 flex items-center gap-2"
            >
              <FiX />
              Clear All
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <DndContext collisionDetection={closestCorners} onDragEnd={(event) => {
            const { active, over } = event;
            if (active.id !== over?.id) {
              const oldIndex = columnFields.indexOf(active.id as string);
              const newIndex = columnFields.indexOf(over?.id as string);
              if (oldIndex !== -1 && newIndex !== -1) {
                if (activeTab === "organizations") setOrgColumnFields(arrayMove(columnFields, oldIndex, newIndex));
                else if (activeTab === "hiring-managers") setHmColumnFields(arrayMove(columnFields, oldIndex, newIndex));
                else if (activeTab === "jobs") setJobColumnFields(arrayMove(columnFields, oldIndex, newIndex));
                  else if (activeTab === "job-seekers") setJobSeekerColumnFields(arrayMove(columnFields, oldIndex, newIndex));
                else if (activeTab === "leads") setLeadColumnFields(arrayMove(columnFields, oldIndex, newIndex));
                else if (activeTab === "tasks") setTaskColumnFields(arrayMove(columnFields, oldIndex, newIndex));
                else if (activeTab === "placements") setPlacementColumnFields(arrayMove(columnFields, oldIndex, newIndex));
              }
            }
          }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableContext items={columnFields} strategy={horizontalListSortingStrategy}>
                    {columnFields.map((columnKey) => (
                      <SortableColumnHeader
                        key={columnKey}
                        id={columnKey}
                        columnKey={columnKey}
                        label={getColumnLabel(columnKey)}
                        sortState={columnSorts[columnKey] || null}
                        filterValue={columnFilters[columnKey] || null}
                        onSort={() => handleColumnSort(columnKey)}
                        onFilterChange={(val) => handleColumnFilter(columnKey, val)}
                        filterType={getColumnFilterType(columnKey)}
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoadingTabData ? (
                  <tr>
                    <td colSpan={columnFields.length} className="px-6 py-6 text-sm text-gray-500 text-center">
                      Loading...
                    </td>
                  </tr>
                ) : filteredData.length > 0 ? (
                  filteredData.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columnFields.map((columnKey) => (
                        <td key={columnKey} className="px-6 py-3 text-sm text-gray-900">
                          {getColumnValue(row, columnKey) || "-"}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columnFields.length} className="px-6 py-10 text-sm text-gray-500 text-center">
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !tearsheet) {
    return (
      <div className="p-4">
        <div className="text-red-600">{error || "Tearsheet not found"}</div>
        <button onClick={handleGoBack} className="mt-4 px-4 py-2 bg-gray-200 rounded">
          Go Back
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "organizations", label: "Organizations" },
    { id: "hiring-managers", label: "Hiring Managers" },
    { id: "jobs", label: "Jobs" },
    { id: "job-seekers", label: "Job Seekers" },
    { id: "leads", label: "Leads" },
    { id: "tasks", label: "Tasks" },
    { id: "placements", label: "Placements" },
  ];

  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with tearsheet name and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            <HiOutlineOfficeBuilding size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            TE {tearsheet.id}{" "}
            {tearsheet.name || `Tearsheet ${tearsheet.id}`}
          </h1>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-3 py-2">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          {/* LEFT: dynamic fields */}
          <div className="flex flex-wrap gap-x-10 gap-y-2 flex-1 min-w-0">
            {headerFields.length === 0 ? (
              <span className="text-sm text-gray-500">
                No header fields selected
              </span>
            ) : (
              headerFields.map((fk) => (
                <div key={fk} className="min-w-[140px]">
                  <div className="text-xs text-gray-500">
                    {getHeaderFieldLabel(fk)}
                  </div>
                  {fk === "website" ? (
                    <a
                      href={getHeaderFieldValue(fk)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {getHeaderFieldValue(fk)}
                    </a>
                  ) : (
                    <div className="text-sm font-medium text-gray-900">
                      {getHeaderFieldValue(fk)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* RIGHT: actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowHeaderFieldModal(true)}
              className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900"
              title="Customize header fields"
              aria-label="Customize header fields"
            >
              <svg
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                height="16"
                width="16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>

            <ActionDropdown label="Actions" options={actionOptions} />

            <button
              onClick={handlePrint}
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Print"
            >
              <Image src="/print.svg" alt="Print" width={20} height={20} />
            </button>

            <button
              onClick={handleTogglePinnedRecord}
              className={`p-1 hover:bg-gray-200 rounded ${isRecordPinned ? "text-yellow-600" : "text-gray-600"}`}
              aria-label={isRecordPinned ? "Unpin" : "Pin"}
              title={isRecordPinned ? "Unpin" : "Pin"}
              disabled={!tearsheet}
            >
              <BsFillPinAngleFill size={18} />
            </button>

            <button
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Reload"
              onClick={() => {
                if (tearsheetId) {
                  const fetchTearsheet = async () => {
                    setIsLoading(true);
                    setError(null);
                    try {
                      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
                      const response = await fetch(`/api/tearsheets/${tearsheetId}`, {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                        cache: 'no-store',
                      });

                      const data = await response.json();
                      if (!response.ok) {
                        throw new Error(data.message || "Failed to fetch tearsheet");
                      }

                      setTearsheet(data.tearsheet);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to fetch tearsheet");
                    } finally {
                      setIsLoading(false);
                    }
                  };
                  fetchTearsheet();
                }
              }}
            >
              <Image src="/reload.svg" alt="Reload" width={20} height={20} />
            </button>

            <button
              onClick={handleGoBack}
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Close"
            >
              <Image src="/x.svg" alt="Close" width={20} height={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-gray-300 mt-1 border-b border-gray-400 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 ${activeTab === tab.id
                ? "bg-gray-200 rounded-t border-t border-r border-l border-gray-400 font-medium"
                : "text-gray-700 hover:bg-gray-200"
              }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        {/* Display content based on active tab */}
        {activeTab === "overview" && (
          <div className="relative">
            <div id="printable-summary" className="overflow-hidden">
              <DndContext modifiers={[restrictToWindowEdges]}
                collisionDetection={closestCorners}
                onDragStart={handlePanelDragStart}
                onDragOver={handlePanelDragOver}
                onDragEnd={handlePanelDragEnd}
                onDragCancel={handlePanelDragCancel}
              >
                <div className="grid grid-cols-[1fr_1fr] gap-4">
                  {/* Left Column - equal width */}
                  <div className="min-w-0">
                    <DroppableContainer id="left" items={columns.left}>
                      {columns.left.map(renderPanel)}
                    </DroppableContainer>
                  </div>

                  {/* Right Column - equal width */}
                  <div className="min-w-0">
                    <DroppableContainer id="right" items={columns.right}>
                      {columns.right.map(renderPanel)}
                    </DroppableContainer>
                  </div>
                </div>
                <DragOverlay>
                  {activeId ? renderPanelPreview(activeId) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        )}

        {activeTab === "organizations" && renderTable(
          organizations,
          orgColumnFields,
          orgColumnSorts,
          orgColumnFilters,
          orgSearchTerm,
          setOrgColumnSorts,
          setOrgColumnFilters,
          (row, key) => {
            if (key === "id") return formatRecordId(row.record_number ?? row.id, "organization");
            if (key === "name") return row.name;
            return row[key] || "-";
          },
          (key) => {
            if (key === "id") return "Record Number";
            if (key === "name") return "Name";
            return key;
          },
          () => "text",
          (row) => router.push(`/dashboard/organizations/view?id=${row.id}`)
        )}

        {activeTab === "hiring-managers" && renderTable(
          hiringManagers,
          hmColumnFields,
          hmColumnSorts,
          hmColumnFilters,
          hmSearchTerm,
          setHmColumnSorts,
          setHmColumnFilters,
          (row, key) => {
            if (key === "id") return formatRecordId(row.record_number ?? row.id, "hiringManager");
            if (key === "name") return row.name;
            if (key === "email") return row.email;
            if (key === "organization") return row.organization || "-";
            return row[key] || "-";
          },
          (key) => {
            if (key === "id") return "Record Number";
            if (key === "name") return "Name";
            if (key === "email") return "Email";
            if (key === "organization") return "Organization";
            return key;
          },
          () => "text",
          (row) => router.push(`/dashboard/hiring-managers/view?id=${row.id}`)
        )}

        {activeTab === "jobs" && renderTable(
          jobs,
          jobColumnFields,
          jobColumnSorts,
          jobColumnFilters,
          jobSearchTerm,
          setJobColumnSorts,
          setJobColumnFilters,
          (row, key) => {
            if (key === "id") return formatRecordId(row.record_number ?? row.id, "job");
            if (key === "title") return row.name;
            if (key === "organization") return row.company || "-";
            return row[key] || "-";
          },
          (key) => {
            if (key === "id") return "Record Number";
            if (key === "title") return "Title";
            if (key === "organization") return "Organization";
            return key;
          },
          () => "text",
          (row) => router.push(`/dashboard/jobs/view?id=${row.id}`)
        )}

        {activeTab === "job-seekers" && renderTable(
          jobSeekers,
          jobSeekerColumnFields,
          jobSeekerColumnSorts,
          jobSeekerColumnFilters,
          jobSeekerSearchTerm,
          setJobSeekerColumnSorts,
          setJobSeekerColumnFilters,
          (row, key) => {
            if (key === "id") return formatRecordId(row.record_number ?? row.id, "jobSeeker");
            if (key === "name") return row.name;
            if (key === "email") return row.email || "-";
            return row[key] || "-";
          },
          (key) => {
            if (key === "id") return "Record Number";
            if (key === "name") return "Name";
            if (key === "email") return "Email";
            return key;
          },
          () => "text",
          (row) => router.push(`/dashboard/job-seekers/view?id=${row.id}`)
        )}

        {activeTab === "leads" && renderTable(
          leads,
          leadColumnFields,
          leadColumnSorts,
          leadColumnFilters,
          leadSearchTerm,
          setLeadColumnSorts,
          setLeadColumnFilters,
          (row, key) => {
            if (key === "id") return formatRecordId(row.record_number ?? row.id, "lead");
            if (key === "name") return row.name;
            if (key === "email") return row.email || "-";
            return row[key] || "-";
          },
          (key) => {
            if (key === "id") return "Record Number";
            if (key === "name") return "Name";
            if (key === "email") return "Email";
            return key;
          },
          () => "text",
          (row) => router.push(`/dashboard/leads/view?id=${row.id}`)
        )}

        {activeTab === "tasks" && renderTable(
          tasks,
          taskColumnFields,
          taskColumnSorts,
          taskColumnFilters,
          taskSearchTerm,
          setTaskColumnSorts,
          setTaskColumnFilters,
          (row, key) => {
            if (key === "id") return formatRecordId(row.record_number ?? row.id, "task");
            if (key === "name") return row.name || row.title || "-";
            if (key === "status") return row.status || "-";
            if (key === "priority") return row.priority || "-";
            if (key === "due_date") return row.due_date ? new Date(row.due_date).toLocaleDateString() : "-";
            if (key === "owner") return row.owner || "-";
            if (key === "assigned_to") return row.assigned_to || "-";
            return row[key] || "-";
          },
          (key) => {
            if (key === "id") return "Record Number";
            if (key === "name") return "Title";
            if (key === "status") return "Status";
            if (key === "priority") return "Priority";
            if (key === "due_date") return "Due Date";
            if (key === "owner") return "Owner";
            if (key === "assigned_to") return "Assigned To";
            return key;
          },
          () => "text",
          (row) => router.push(`/dashboard/tasks/view?id=${row.id}`)
        )}

        {activeTab === "placements" && renderTable(
          placements,
          placementColumnFields,
          placementColumnSorts,
          placementColumnFilters,
          placementSearchTerm,
          setPlacementColumnSorts,
          setPlacementColumnFilters,
          (row, key) => {
            if (key === "id") return formatRecordId(row.record_number ?? row.id, "placement");
            if (key === "job_seeker") return row.job_seeker_name || row.jobSeekerName || row.candidate_name || "-";
            if (key === "job") return row.job_title || row.jobTitle || row.job_name || "-";
            if (key === "status") return row.status || row.stage || "-";
            return row[key] || "-";
          },
          (key) => {
            if (key === "id") return "Record Number";
            if (key === "job_seeker") return "Job Seeker";
            if (key === "job") return "Job";
            if (key === "status") return "Status";
            return key;
          },
          () => "text",
          (row) => router.push(`/dashboard/placements/view?id=${row.id}`)
        )}
      </div>

      {/* Edit Fields Modal */}
      {editingPanel && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Edit Fields - {editingPanel === "overview" ? "Tearsheet Overview" : editingPanel === "statistics" ? "Statistics" : editingPanel}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={(e) => setPanelDragActiveId(e.active.id as string)}
                onDragEnd={handleFieldDragEnd}
                onDragCancel={() => setPanelDragActiveId(null)}
              >
                <p className="text-sm text-gray-600 mb-4">
                  Drag to reorder, check/uncheck to show/hide fields.
                </p>
                <SortableContext
                  items={modalFieldOrder}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                    {modalFieldOrder.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        No fields available
                      </div>
                    ) : (
                      modalFieldOrder.map((key) => {
                        const label = getFieldLabel(editingPanel, key);
                        const isVisible = modalFieldVisible[key] ?? true;
                        return (
                          <SortableFieldRow
                            key={`${editingPanel}-${key}`}
                            id={key}
                            label={label}
                            checked={isVisible}
                            onToggle={() => toggleModalFieldVisible(key)}
                          />
                        );
                      })
                    )}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {panelDragActiveId ? (
                    <SortableFieldRow
                      id={panelDragActiveId}
                      label={getFieldLabel(editingPanel, panelDragActiveId)}
                      checked={modalFieldVisible[panelDragActiveId] ?? true}
                      onToggle={() => { }}
                      isOverlay
                    />
                  ) : null}
                </DragOverlay>
                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                  <button
                    onClick={handleCloseEditModal}
                    className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={savePanelFieldConfig}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={modalFieldOrder.filter((k) => modalFieldVisible[k]).length === 0}
                  >
                    Save
                  </button>
                </div>
              </DndContext>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
