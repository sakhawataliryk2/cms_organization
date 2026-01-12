"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { useListControls } from "@/hooks/useListSortFilter";
import SortFilterBar from "@/components/list/SortFilterBar";
import FiltersModal from "@/components/list/FiltersModal";

interface JobSeeker {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  last_contact_date: string;
  owner: string;
  created_by_name: string;
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
}

export default function JobSeekerList() {
  const router = useRouter();
  
  const list = useListControls({
    defaultSortKey: "id",
    defaultSortDir: "desc",
    sortOptions: [
      { key: "id", label: "ID" },
      { key: "full_name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status" },
      { key: "last_contact_date", label: "Last Contact" },
      { key: "owner", label: "Owner" },
    ],
  });

  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Record<string, any>>({});

  useEffect(() => {
    if (showFilters) setDraftFilters(list.filters);
  }, [showFilters, list.filters]);

  const [openActionId, setOpenActionId] = useState<string | null>(null);
  useEffect(() => {
    const close = () => setOpenActionId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // =====================
  // TABLE COLUMNS (Overview List)
  // =====================
  const JOB_SEEKER_DEFAULT_COLUMNS = [
    "full_name",
    "email",
    "phone",
    "status",
    "last_contact_date",
    "owner",
  ];

  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "JOB_SEEKER",
    defaultFields: JOB_SEEKER_DEFAULT_COLUMNS,
    configType: "columns",
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
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );

        const res = await fetch("/api/admin/field-management/job-seekers", {
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
          data.jobSeekerFields ||
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

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobSeekers, setSelectedJobSeekers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [jobSeekers, setJobSeekers] = useState<JobSeeker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ✅ Columns Catalog (Standard + Custom Fields)
  const humanize = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const columnsCatalog = useMemo(() => {
    // ✅ 1) Standard columns (fixed)
    const standard = [
      { key: "full_name", label: "Name", sortable: true },
      { key: "email", label: "Email", sortable: true },
      { key: "phone", label: "Phone", sortable: true },
      { key: "status", label: "Status", sortable: true },
      { key: "last_contact_date", label: "Last Contact", sortable: true },
      { key: "owner", label: "Owner", sortable: true },
    ];

    // ✅ 2) Custom keys (auto from ALL job seekers list)
    const customKeySet = new Set<string>();

    (jobSeekers || []).forEach((js: any) => {
      const cf = js?.customFields || js?.custom_fields || {};
      Object.keys(cf).forEach((k) => customKeySet.add(k));
    });

    const custom = Array.from(customKeySet).map((k) => ({
      key: `custom:${k}`,
      label: humanize(k),
      sortable: false,
    }));

    // ✅ 3) merge + unique
    const merged = [...standard, ...custom];
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [jobSeekers]);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnValue = (js: any, key: string) => {
    // ✅ custom columns
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = js?.customFields || js?.custom_fields || {};
      const val = cf?.[rawKey];
      return val === undefined || val === null || val === ""
        ? "N/A"
        : String(val);
    }

    // ✅ standard columns
    switch (key) {
      case "full_name":
        return js.full_name || "N/A";
      case "email":
        return js.email || "N/A";
      case "phone":
        return js.phone || "N/A";
      case "status":
        return js.status || "N/A";
      case "last_contact_date":
        return js.last_contact_date || "N/A";
      case "owner":
        return js.owner || js.created_by_name || "Unassigned";
      default:
        return "N/A";
    }
  };

  // Fetch job seekers data when component mounts
  useEffect(() => {
    fetchJobSeekers();
  }, []);

  const fetchJobSeekers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/job-seekers", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch job seekers");
      }

      const data = await response.json();
      console.log("Job seekers data:", data);
      setJobSeekers(data.jobSeekers || []);
    } catch (err) {
      console.error("Error fetching job seekers:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching job seekers"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredJobSeekers = jobSeekers.filter(
    (jobSeeker) =>
      jobSeeker.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jobSeeker.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jobSeeker.id?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  const viewJobSeekers = useMemo(() => {
    const data = filteredJobSeekers;

    return list.applySortFilter<JobSeeker>(data, {
      getValue: (row, key) => {
        if (key.startsWith("custom:")) {
          const rawKey = key.replace("custom:", "");
          const cf =
            (row as any)?.customFields || (row as any)?.custom_fields || {};
          return cf?.[rawKey];
        }
        if (key === "id") {
          return parseInt((row as any).id) || 0;
        }
        if (key === "last_contact_date") {
          return (row as any).last_contact_date
            ? new Date((row as any).last_contact_date).getTime()
            : 0;
        }
        if (key === "owner") {
          return (row as any).owner || (row as any).created_by_name || "";
        }
        return (row as any)[key];
      },
      filterFns: {
        status: (row, value) => {
          if (!value) return true;
          return (row as any).status?.toLowerCase() === value.toLowerCase();
        },
      },
    });
  }, [filteredJobSeekers, list]);

  const handleViewJobSeeker = (id: string) => {
    router.push(`/dashboard/job-seekers/view?id=${id}`);
  };

  const handleAddJobSeeker = () => {
    router.push("/dashboard/job-seekers/add");
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedJobSeekers([]);
    } else {
      setSelectedJobSeekers(
        viewJobSeekers.map((jobSeeker) => jobSeeker.id)
      );
    }
    setSelectAll(!selectAll);
  };

  const handleSelectJobSeeker = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event

    if (selectedJobSeekers.includes(id)) {
      setSelectedJobSeekers(
        selectedJobSeekers.filter((jobSeekerId) => jobSeekerId !== id)
      );
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedJobSeekers([...selectedJobSeekers, id]);
      // If all job seekers are now selected, update selectAll state
      if ([...selectedJobSeekers, id].length === viewJobSeekers.length) {
        setSelectAll(true);
      }
    }
  };

  const deleteSelectedJobSeekers = async () => {
    // Don't do anything if no job seekers are selected
    if (selectedJobSeekers.length === 0) return;

    // Confirm deletion
    const confirmMessage =
      selectedJobSeekers.length === 1
        ? "Are you sure you want to delete this job seeker?"
        : `Are you sure you want to delete these ${selectedJobSeekers.length} job seekers?`;

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    setError(null);

    try {
      // Create promises for all delete operations
      const deletePromises = selectedJobSeekers.map((id) =>
        fetch(`/api/job-seekers/${id}`, {
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
        throw new Error(`Failed to delete ${failures.length} job seekers`);
      }

      // Refresh job seekers after successful deletion
      await fetchJobSeekers();

      // Clear selection after deletion
      setSelectedJobSeekers([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting job seekers:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting job seekers"
      );
    } finally {
      setIsDeleting(false);
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
    switch (status?.toLowerCase()) {
      case "new lead":
        return "bg-blue-100 text-blue-800";
      case "active":
        return "bg-green-100 text-green-800";
      case "qualified":
        return "bg-purple-100 text-purple-800";
      case "placed":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading job seekers..." />;
  }

  if (isDeleting) {
    return <LoadingScreen message="Deleting job seekers..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Job Seekers</h1>
        <div className="flex items-center space-x-4">
          {selectedJobSeekers.length > 0 && (
            <button
              onClick={deleteSelectedJobSeekers}
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
              Delete Selected ({selectedJobSeekers.length})
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
                    { label: "New Lead", value: "New Lead" },
                    { label: "Active", value: "Active" },
                    { label: "Qualified", value: "Qualified" },
                    { label: "Placed", value: "Placed" },
                    { label: "Inactive", value: "Inactive" },
                  ],
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
            onClick={handleAddJobSeeker}
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
            Add Job Seeker
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
            placeholder="Search job seekers..."
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

      {/* Job Seekers Table */}
      <div className="overflow-x-auto">
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

              {/* Fixed Actions header (LOCKED) */}
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
            {viewJobSeekers.length > 0 ? (
              viewJobSeekers.map((jobSeeker) => (
                <tr
                  key={jobSeeker.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewJobSeeker(jobSeeker.id)}
                >
                  {/* Fixed checkbox */}
                  <td
                    className="px-6 py-4 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={selectedJobSeekers.includes(jobSeeker.id)}
                      onChange={() => {}}
                      onClick={(e) => handleSelectJobSeeker(jobSeeker.id, e)}
                    />
                  </td>

                  {/* Fixed Actions (LOCKED dropdown) */}
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
                        className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenActionId((prev) =>
                            prev === jobSeeker.id ? null : jobSeeker.id
                          );
                        }}
                      >
                        Actions ▾
                      </button>

                      {openActionId === jobSeeker.id && (
                        <div
                          className="absolute left-0 mt-2 w-44 rounded border bg-white shadow-lg z-[9999] overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col">
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewJobSeeker(jobSeeker.id);
                                setOpenActionId(null);
                              }}
                            >
                              View
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/dashboard/job-seekers/add?id=${jobSeeker.id}`
                                );
                                setOpenActionId(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setOpenActionId(null);

                                if (
                                  !window.confirm(
                                    "Are you sure you want to delete this job seeker?"
                                  )
                                )
                                  return;

                                setIsDeleting(true);
                                try {
                                  const response = await fetch(
                                    `/api/job-seekers/${jobSeeker.id}`,
                                    {
                                      method: "DELETE",
                                      headers: {
                                        Authorization: `Bearer ${document.cookie.replace(
                                          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                                          "$1"
                                        )}`,
                                      },
                                    }
                                  );
                                  if (!response.ok)
                                    throw new Error(
                                      "Failed to delete job seeker"
                                    );
                                  await fetchJobSeekers();
                                } catch (err) {
                                  setError(
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

                  {/* Fixed ID */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    JS {jobSeeker.id}
                  </td>

                  {/* Dynamic columns */}
                  {columnFields.map((key) => (
                    <td
                      key={key}
                      className="px-6 py-4 whitespace-nowrap text-sm"
                    >
                      {key === "status" ? (
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            getColumnValue(jobSeeker, key)
                          )}`}
                        >
                          {getColumnValue(jobSeeker, key)}
                        </span>
                      ) : key === "email" ? (
                        <div className="text-sm text-blue-600">
                          {getColumnValue(jobSeeker, key)}
                        </div>
                      ) : key === "last_contact_date" ? (
                        <span className="text-sm text-gray-500">
                          {getColumnValue(jobSeeker, key) !== "N/A"
                            ? formatDate(getColumnValue(jobSeeker, key))
                            : "Not contacted"}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-900">
                          {getColumnValue(jobSeeker, key)}
                        </span>
                      )}
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
                    ? "No job seekers found matching your search."
                    : 'No job seekers found. Click "Add Job Seeker" to create one.'}
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
              <span className="font-medium">{viewJobSeekers.length}</span> of{" "}
              <span className="font-medium">{viewJobSeekers.length}</span>{" "}
              results
            </p>
          </div>
          {viewJobSeekers.length > 0 && (
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

      {/* Column Modal */}
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
                              const newFields = [...columnFields];
                              [newFields[idx], newFields[idx - 1]] = [
                                newFields[idx - 1],
                                newFields[idx],
                              ];
                              setColumnFields(newFields);
                            }}
                            title="Move up"
                          >
                            ↑
                          </button>

                          <button
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                            disabled={idx === columnFields.length - 1}
                            onClick={() => {
                              const newFields = [...columnFields];
                              [newFields[idx], newFields[idx + 1]] = [
                                newFields[idx + 1],
                                newFields[idx],
                              ];
                              setColumnFields(newFields);
                            }}
                            title="Move down"
                          >
                            ↓
                          </button>

                          <button
                            className="px-2 py-1 border rounded text-xs hover:bg-red-50 text-red-600"
                            onClick={() => {
                              setColumnFields((prev) =>
                                prev.filter((x) => x !== key)
                              );
                            }}
                            title="Remove"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                    onClick={() => setColumnFields(JOB_SEEKER_DEFAULT_COLUMNS)}
                  >
                    Reset
                  </button>

                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      const success = await saveColumnConfig();
                      if (success) {
                        setShowColumnModal(false);
                      }
                    }}
                    disabled={isSavingColumns}
                  >
                    {isSavingColumns ? "Saving..." : "Done"}
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
