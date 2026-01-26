"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { FiArrowUp, FiArrowDown, FiFilter } from "react-icons/fi";

interface Job {
  id: string;
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
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

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
          title={
            sortState === "asc"
              ? "Sort descending"
              : sortState === "desc"
                ? "Clear sort"
                : "Sort ascending"
          }
        >
          {sortState === "asc" ? (
            <FiArrowUp size={14} />
          ) : sortState === "desc" ? (
            <FiArrowDown size={14} />
          ) : (
            <div className="w-3.5 h-3.5 border border-gray-300 rounded" />
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
          className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 shadow-lg p-2 mt-1 min-w-[150px]"
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

const JOB_DEFAULT_COLUMNS = [
  "id",
  "job_title",
  "job_type",
  "category",
  "organization_name",
  "worksite_location",
  "status",
  "created_at",
  "created_by_name",
] as const;

export default function JobList() {
  const router = useRouter();
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-column sorting state
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});

  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "JOB",
    defaultFields: [...JOB_DEFAULT_COLUMNS],
    configType: "columns",
  });

  // Load column order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem("jobsColumnOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validOrder = parsed.filter((key) =>
            [...JOB_DEFAULT_COLUMNS, ...columnFields].includes(key)
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
      localStorage.setItem("jobsColumnOrder", JSON.stringify(columnFields));
    }
  }, [columnFields]);

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

  const columnsCatalog = useMemo(() => {
    const standard = [
      { key: "id", label: "ID", sortable: true, filterType: "text" as const },
      { key: "job_title", label: "Job Title", sortable: true, filterType: "text" as const },
      { key: "job_type", label: "Job Type", sortable: true, filterType: "text" as const },
      { key: "category", label: "Category", sortable: true, filterType: "text" as const },
      { key: "organization_name", label: "Organization", sortable: true, filterType: "text" as const },
      { key: "worksite_location", label: "Location", sortable: true, filterType: "text" as const },
      { key: "status", label: "Status", sortable: true, filterType: "select" as const },
      { key: "created_at", label: "Created At", sortable: true, filterType: "text" as const },
      { key: "created_by_name", label: "Created By", sortable: true, filterType: "text" as const },
    ];

    const customKeySet = new Set<string>();
    jobs.forEach((job) => {
      const cf = job?.customFields || job?.custom_fields || {};
      Object.keys(cf).forEach((k) => customKeySet.add(k));
    });

    const custom = Array.from(customKeySet).map((k) => ({
      key: `custom:${k}`,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      sortable: false,
      filterType: "text" as const,
    }));

    return [...standard, ...custom];
  }, [jobs]);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnInfo = (key: string) =>
    columnsCatalog.find((c) => c.key === key);

  const getColumnValue = (job: any, key: string) => {
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = job?.customFields || job?.custom_fields || {};
      return cf?.[rawKey] || "-";
    }
    const v = job?.[key];
    if (v === null || v === undefined || v === "") return "-";
    if (key === 'id') return `J ${v}`;
    return String(v);
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
    let result = [...jobs];

    // Apply global search
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (job) =>
          job.job_title?.toLowerCase().includes(term) ||
          job.job_type?.toLowerCase().includes(term) ||
          job.organization_name?.toLowerCase().includes(term) ||
          job.id?.toString().toLowerCase().includes(term) ||
          job.category?.toLowerCase().includes(term) ||
          (job.status || "").toLowerCase().includes(term)
      );
    }

    // Apply filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((job) => {
        let value = getColumnValue(job, columnKey);
        // Clean up display values for comparison
        if (columnKey === 'id') value = job.id; // Compare raw ID for filtering usually, or display? Let's use display since filter is text input usually

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
        let aValue: any = getColumnValue(a, sortKey);
        let bValue: any = getColumnValue(b, sortKey);

        // Handle dates properly
        if (sortKey === 'created_at') {
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
        } else if (sortKey === 'id') {
          // extract number from "J 123" or just use raw id which is numeric string usually
          aValue = parseInt(a.id) || a.id;
          bValue = parseInt(b.id) || b.id;
        }

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
  }, [jobs, columnFilters, columnSorts, searchTerm]);

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

  const deleteSelectedJobs = async () => {
    if (selectedJobs.length === 0) return;

    const confirmMessage =
      selectedJobs.length === 1
        ? "Are you sure you want to delete this job?"
        : `Are you sure you want to delete these ${selectedJobs.length} jobs?`;

    if (!window.confirm(confirmMessage)) return;

    setIsLoading(true);

    try {
      const deletePromises = selectedJobs.map((id) =>
        fetch(`/api/jobs/${id}`, {
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
        throw new Error(`Failed to delete ${failures.length} jobs`);
      }

      await fetchJobs();
      setSelectedJobs([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting jobs:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting jobs"
      );
    } finally {
      setIsLoading(false);
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
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Jobs</h1>
        <div className="flex space-x-4">
          {selectedJobs.length > 0 && (
            <>
              <button
                onClick={exportJobsToXML}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Export to XML ({selectedJobs.length})
              </button>
              <button
                onClick={deleteSelectedJobs}
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
                Delete Selected ({selectedJobs.length})
              </button>
            </>
          )}

          <button
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Columns
          </button>

          <button
            onClick={handleAddJob}
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
            Add Job
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
        <div className="relative">
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
      </div>

      {/* Jobs Table */}
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

                <SortableContext
                  items={columnFields}
                  strategy={horizontalListSortingStrategy}
                >
                  {columnFields.map((key) => {
                    const columnInfo = getColumnInfo(key);
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
                        filterType={columnInfo?.filterType || 'text'}
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
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionId((prev) =>
                              prev === job.id ? null : job.id
                            );
                          }}
                        >
                          Actions ▾
                        </button>

                        {openActionId === job.id && (
                          <div
                            className="absolute left-0 mt-2 w-44 rounded border bg-white shadow-lg z-[9999] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col">
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionId(null);
                                  handleViewJob(job.id);
                                }}
                              >
                                View
                              </button>

                              <button
                                className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-gray-50"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setOpenActionId(null);
                                  await exportSingleJobToXML(job.id);
                                }}
                              >
                                Export to XML
                              </button>

                              <button
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setOpenActionId(null);

                                  if (
                                    !window.confirm(
                                      "Are you sure you want to delete this job?"
                                    )
                                  )
                                    return;

                                  setIsLoading(true);
                                  try {
                                    await fetch(`/api/jobs/${job.id}`, {
                                      method: "DELETE",
                                      headers: {
                                        Authorization: `Bearer ${document.cookie.replace(
                                          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                                          "$1"
                                        )}`,
                                      },
                                    });
                                    await fetchJobs();
                                  } finally {
                                    setIsLoading(false);
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

                    {columnFields.map((colKey) => (
                      <td key={colKey} className="px-6 py-4 whitespace-nowrap">
                        {colKey === 'status' ? (
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              job.status
                            )}`}
                          >
                            {job.status}
                          </span>
                        ) : colKey === 'job_title' ? (
                          <>
                            <div className="text-sm font-medium text-gray-900">
                              {job.job_title}
                            </div>
                            <div className="text-sm text-gray-500">
                              {job.employment_type}
                            </div>
                          </>
                        ) : colKey === 'job_type' ? (
                          <>
                            <div className="capitalize text-sm font-medium text-gray-900">
                              {job.job_type || "-"}
                            </div>
                          </>
                        ) : colKey === 'organization_name' ? (
                          <div className="text-sm text-blue-600">
                            {getColumnValue(job, colKey)}
                          </div>
                        ) : colKey === 'created_at' ? (
                          <div className="text-sm text-gray-500">
                            {formatDate(job.created_at)}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">
                            {getColumnValue(job, colKey)}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columnFields.length + 2}
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

      {/* Pagination (Simplified, could be enhanced) */}
      <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">1</span> to{" "}
            <span className="font-medium">{filteredAndSortedJobs.length}</span> of{" "}
            <span className="font-medium">{filteredAndSortedJobs.length}</span> results
          </p>
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
                    onClick={() => setColumnFields([...JOB_DEFAULT_COLUMNS])}
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
    </div>
  );
}
