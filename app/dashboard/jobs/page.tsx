"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { useListControls } from "@/hooks/useListSortFilter";
import SortFilterBar from "@/components/list/SortFilterBar";
import FiltersModal from "@/components/list/FiltersModal";


interface Job {
  id: string;
  job_title: string;
  category: string;
  organization_name: string;
  worksite_location: string;
  status: string;
  created_at: string;
  employment_type: string;
  created_by_name: string;
}

const JOB_DEFAULT_COLUMNS = [
  "id",
  "job_title",
  "category",
  "organization_name",
  "worksite_location",
  "status",
  "created_at",
  "created_by_name",
] as const;

type JobColumnKey = (typeof JOB_DEFAULT_COLUMNS)[number];

export default function JobList() {
  const router = useRouter();
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const list = useListControls({
    defaultSortKey: "id",
    defaultSortDir: "desc",
    sortOptions: [
      { key: "id", label: "ID" },
      { key: "job_title", label: "Job Title" },
      { key: "category", label: "Category" },
      { key: "organization_name", label: "Organization" },
      { key: "worksite_location", label: "Location" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Created At" },
      { key: "created_by_name", label: "Created By" },
    ],
  });

  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Record<string, any>>({});

  useEffect(() => {
    if (showFilters) setDraftFilters(list.filters);
  }, [showFilters, list.filters]);

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

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const columnsCatalog = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];

    const sample = jobs[0] as any;

    const ignore = new Set(["updated_at", "deleted_at"]);

    return Object.keys(sample)
      .filter((key) => !ignore.has(key))
      .map((key) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        sortable: true,
      }));
  }, [jobs]);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnValue = (job: any, key: string) => {
    const v = job?.[key];
    if (v === null || v === undefined || v === "") return "-";
    return String(v);
  };

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs data when component mounts
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    // Continued from the previous code - updating app/dashboard/jobs/page.tsx

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

  const filteredJobs = jobs.filter(
    (job) =>
      job.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const viewJobs = useMemo(() => {
    const data = filteredJobs;

    return list.applySortFilter<Job>(data, {
      getValue: (row, key) => {
        if (key.startsWith("custom:")) {
          const rawKey = key.replace("custom:", "");
          const cf =
            (row as any)?.customFields || (row as any)?.custom_fields || {};
          return cf?.[rawKey];
        }
        // Handle date fields
        if (key === "created_at") {
          return new Date((row as any)[key]).getTime();
        }
        return (row as any)[key];
      },
      filterFns: {
        status: (row, value) => {
          if (!value || value === "") return true;
          return (row as any).status?.toLowerCase() === value.toLowerCase();
        },
        category: (row, value) => {
          if (!value || value === "") return true;
          return (row as any).category
            ?.toLowerCase()
            .includes(value.toLowerCase());
        },
      },
    });
  }, [filteredJobs, list]);

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
      setSelectedJobs(viewJobs.map((job) => job.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event

    if (selectedJobs.includes(id)) {
      setSelectedJobs(selectedJobs.filter((jobId) => jobId !== id));
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedJobs([...selectedJobs, id]);
      // If all jobs are now selected, update selectAll state
      if ([...selectedJobs, id].length === viewJobs.length) {
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
      // Create promises for all delete operations
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

      // Execute all delete operations
      const results = await Promise.allSettled(deletePromises);

      // Check for failures
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} jobs`);
      }

      // Refresh jobs after successful deletion
      await fetchJobs();

      // Clear selection after deletion
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
          )}
          <SortFilterBar
            sortKey={list.sortKey}
            sortDir={list.sortDir}
            onChangeSortKey={list.onChangeSortKey}
            onToggleDir={list.onToggleDir}
            sortOptions={list.sortOptions}
            onOpenFilters={() => setShowFilters(true)}
            onClearFilters={list.clearFilters}
            hasFilters={list.hasFilters}
          />

          {showFilters && (
            <FiltersModal
              open={showFilters}
              onClose={() => setShowFilters(false)}
              fields={[
                {
                  key: "status",
                  label: "Status",
                  type: "select",
                  options: [
                    { label: "Open", value: "Open" },
                    { label: "On Hold", value: "On Hold" },
                    { label: "Filled", value: "Filled" },
                    { label: "Closed", value: "Closed" },
                  ],
                },
                {
                  key: "category",
                  label: "Category",
                  type: "text",
                },
              ]}
              values={draftFilters}
              onChange={(key: string, value: any) =>
                setDraftFilters((prev) => ({ ...prev, [key]: value }))
              }
              onApply={() => {
                list.setFilters(draftFilters);
                setShowFilters(false);
              }}
              onReset={() => setDraftFilters({})}
            />
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

      {/* Search and Filter */}
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
              {/* Fixed ID header */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => list.toggleSort("id")}
                  className="hover:text-gray-700"
                >
                  ID
                </button>
              </th>
              {/* Dynamic headers */}
              {columnFields.map((key) => (
                <th
                  key={key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {getColumnLabel(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {viewJobs.length > 0 ? (
              viewJobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewJob(job.id)}
                >
                  {/* ✅ Checkbox fixed FIRST */}
                  <td
                    className="px-6 py-4 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={selectedJobs.includes(job.id)}
                      onChange={() => {}}
                      onClick={(e) => handleSelectJob(job.id, e)}
                    />
                  </td>

                  {/* ✅ Actions fixed SECOND (locked) */}
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

                  {/* Fixed ID */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      J {job.id}
                    </div>
                  </td>

                  {/* Dynamic cells */}
                  {columnFields.map((colKey) => {
                    switch (colKey) {
                      case "job_title":
                        return (
                          <td
                            key={colKey}
                            className="px-6 py-4 whitespace-nowrap"
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {job.job_title}
                            </div>
                            <div className="text-sm text-gray-500">
                              {job.employment_type}
                            </div>
                          </td>
                        );

                      case "category":
                        return (
                          <td
                            key={colKey}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {job.category}
                          </td>
                        );

                      case "organization_name":
                        return (
                          <td
                            key={colKey}
                            className="px-6 py-4 whitespace-nowrap"
                          >
                            <div className="text-sm text-blue-600">
                              {job.organization_name || "Not specified"}
                            </div>
                          </td>
                        );

                      case "worksite_location":
                        return (
                          <td
                            key={colKey}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {job.worksite_location || "Not specified"}
                          </td>
                        );

                      case "status":
                        return (
                          <td
                            key={colKey}
                            className="px-6 py-4 whitespace-nowrap"
                          >
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                job.status
                              )}`}
                            >
                              {job.status}
                            </span>
                          </td>
                        );

                      case "created_at":
                        return (
                          <td
                            key={colKey}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {formatDate(job.created_at)}
                          </td>
                        );

                      case "created_by_name":
                        return (
                          <td
                            key={colKey}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {job.created_by_name || "Unknown"}
                          </td>
                        );

                      default:
                        return (
                          <td
                            key={colKey}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            -
                          </td>
                        );
                    }
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columnFields.length + 3}
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
              <span className="font-medium">{viewJobs.length}</span> of{" "}
              <span className="font-medium">{viewJobs.length}</span> results
            </p>
          </div>
          {filteredJobs.length > 0 && (
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
