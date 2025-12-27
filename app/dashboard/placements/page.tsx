"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";

interface Placement {
  id: string;
  candidate_id?: string;
  candidate_name?: string;
  job_seeker_id?: string;
  job_seeker_name?: string;
  job_id?: string;
  job_title?: string;
  job_name?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  salary?: string;
  owner?: string;
  owner_name?: string;
  created_at: string;
  created_by_name?: string;
}

export default function PlacementList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<
    | "id"
    | "candidate_name"
    | "job_title"
    | "status"
    | "start_date"
    | "owner"
    | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
   const DEFAULT_PLACEMENT_COLUMNS: string[] = [
     "candidate",
     "job",
     "status",
     "start_date",
     "owner",
   ];

   const placementColumnsCatalog = [
     { key: "candidate", label: "Candidate" },
     { key: "job", label: "Job" },
     { key: "status", label: "Status" },
     { key: "start_date", label: "Start Date" },
     { key: "end_date", label: "End Date" },
     { key: "salary", label: "Salary" },
     { key: "owner", label: "Owner" },
     { key: "created_at", label: "Date Added" },
     { key: "created_by", label: "Created By" },
   ];

   const getColumnLabel = (key: string) =>
     placementColumnsCatalog.find((c) => c.key === key)?.label ?? key;

   const getStatusColor = (status?: string) => {
     const s = (status || "").toLowerCase();
     if (s === "active") return "bg-green-100 text-green-800";
     if (s === "completed") return "bg-blue-100 text-blue-800";
     if (s === "terminated") return "bg-red-100 text-red-800";
     return "bg-blue-100 text-blue-800";
   };

   const getColumnValue = (p: Placement, key: string) => {
     switch (key) {
       case "candidate":
         return p.candidate_name || p.job_seeker_name || "Unknown";
       case "job":
         return p.job_title || p.job_name || "Unknown";
       case "status":
         return p.status || "Active";
       case "start_date":
         return p.start_date ? formatDate(p.start_date) : "-";
       case "end_date":
         return p.end_date ? formatDate(p.end_date) : "-";
       case "salary":
         return p.salary || "-";
       case "owner":
         return p.owner || p.owner_name || "Unassigned";
       case "created_at":
         return p.created_at ? formatDate(p.created_at) : "-";
       case "created_by":
         return p.created_by_name || "Unknown";
       default:
         return "—";
     }
   };
 const {
   columnFields,
   setColumnFields,
   showHeaderFieldModal: showColumnModal,
   setShowHeaderFieldModal: setShowColumnModal,
   saveHeaderConfig: saveColumnConfig,
   isSaving: isSavingColumns,
 } = useHeaderConfig({
   entityType: "PLACEMENT",
   configType: "columns",
   defaultFields: DEFAULT_PLACEMENT_COLUMNS,
 });
  // Fetch placements on component mount
  useEffect(() => {
    fetchPlacements();
  }, []);
 useEffect(() => {
   const close = () => setOpenActionId(null);
   window.addEventListener("click", close);
   return () => window.removeEventListener("click", close);
 }, []);
const toggleActionDropdown = (id: string, e: React.MouseEvent) => {
  e.stopPropagation();
  setOpenActionId((prev) => (prev === id ? null : id));
};

  const fetchPlacements = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/placements");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch placements");
      }

      const data = await response.json();
      setPlacements(data.placements || []);
    } catch (err) {
      console.error("Error fetching placements:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching placements"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPlacements = placements.filter(
    (placement) =>
      (placement.candidate_name || placement.job_seeker_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (placement.job_title || placement.job_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (placement.status && placement.status.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (placement.owner || placement.owner_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle sorting
  const handleSort = (
    field:
      | "id"
      | "candidate_name"
      | "job_title"
      | "status"
      | "start_date"
      | "owner"
  ) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort the filtered placements
  const sortedPlacements = [...filteredPlacements].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: string | number = "";
    let bValue: string | number = "";

    if (sortField === "id") {
      // Sort numerically by ID
      aValue = parseInt(a.id) || 0;
      bValue = parseInt(b.id) || 0;
    } else if (sortField === "candidate_name") {
      aValue = (a.candidate_name || a.job_seeker_name || "").toLowerCase();
      bValue = (b.candidate_name || b.job_seeker_name || "").toLowerCase();
    } else if (sortField === "job_title") {
      aValue = (a.job_title || a.job_name || "").toLowerCase();
      bValue = (b.job_title || b.job_name || "").toLowerCase();
    } else if (sortField === "status") {
      aValue = a.status?.toLowerCase() || "";
      bValue = b.status?.toLowerCase() || "";
    } else if (sortField === "start_date") {
      aValue = a.start_date || "";
      bValue = b.start_date || "";
    } else if (sortField === "owner") {
      aValue = (a.owner || a.owner_name || "").toLowerCase();
      bValue = (b.owner || b.owner_name || "").toLowerCase();
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const handleViewPlacement = (id: string) => {
    router.push(`/dashboard/placements/view?id=${id}`);
  };

  const handleAddPlacement = () => {
    router.push("/dashboard/placements/add");
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedPlacements([]);
    } else {
      setSelectedPlacements(filteredPlacements.map((placement) => placement.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectPlacement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event

    if (selectedPlacements.includes(id)) {
      setSelectedPlacements(
        selectedPlacements.filter((placementId) => placementId !== id)
      );
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedPlacements([...selectedPlacements, id]);
      // If all placements are now selected, update selectAll state
      if (
        [...selectedPlacements, id].length === filteredPlacements.length
      ) {
        setSelectAll(true);
      }
    }
  };

  const deleteSelectedPlacements = async () => {
    // Don't do anything if no placements are selected
    if (selectedPlacements.length === 0) return;

    // Confirm deletion
    const confirmMessage =
      selectedPlacements.length === 1
        ? "Are you sure you want to delete this placement?"
        : `Are you sure you want to delete these ${selectedPlacements.length} placements?`;

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Create promises for all delete operations
      const deletePromises = selectedPlacements.map((id) =>
        fetch(`/api/placements/${id}`, {
          method: "DELETE",
        })
      );

      // Execute all delete operations
      const results = await Promise.allSettled(deletePromises);

      // Check for failures
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} placements`);
      }

      // Refresh placements after successful deletion
      await fetchPlacements();

      // Clear selection after deletion
      setSelectedPlacements([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting placements:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting placements"
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

  if (isLoading) {
    return <LoadingScreen message="Loading placements..." />;
  }

  if (isDeleting) {
    return <LoadingScreen message="Deleting placements..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Placements</h1>

        <div className="flex space-x-4">
          {selectedPlacements.length > 0 && (
            <button
              onClick={deleteSelectedPlacements}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
            >
              Delete Selected ({selectedPlacements.length})
            </button>
          )}

          {/* Columns button (same like Tasks) */}
          <button
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Columns
          </button>

          <button
            onClick={handleAddPlacement}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          >
            Add Placement
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

      {/* Search and Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder="Search placements..."
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

      {/* Placements Table */}
      <div className="overflow-x-auto">
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
                <button
                  onClick={() => handleSort("id")}
                  className="hover:text-gray-700"
                >
                  ID
                </button>
              </th>

              {/* Dynamic */}
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
            {sortedPlacements.length > 0 ? (
              sortedPlacements.map((placement) => (
                <tr
                  key={placement.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewPlacement(placement.id)}
                >
                  {/* Fixed checkbox */}
                  <td
                    className="px-6 py-4 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={selectedPlacements.includes(placement.id)}
                      onChange={() => {}}
                      onClick={(e) => handleSelectPlacement(placement.id, e)}
                    />
                  </td>

                  {/* Fixed Actions dropdown (View only) */}
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
                            prev === placement.id ? null : placement.id
                          );
                        }}
                      >
                        Actions ▾
                      </button>

                      {openActionId === placement.id && (
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
                                handleViewPlacement(placement.id);
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Fixed ID */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      P {placement.id}
                    </div>
                  </td>

                  {/* Dynamic cells */}
                  {columnFields.map((key) => (
                    <td
                      key={key}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {key === "status" ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {getColumnValue(placement, key)}
                        </span>
                      ) : (
                        getColumnValue(placement, key)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3 + columnFields.length}
                  className="px-6 py-4 text-center text-gray-500"
                >
                  {searchTerm
                    ? "No placements found matching your search."
                    : "No placements found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination or summary */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{sortedPlacements.length}</span>{" "}
          of <span className="font-medium">{placements.length}</span> placements
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
                  {placementColumnsCatalog.map((c) => {
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
                    onClick={() => setColumnFields(DEFAULT_PLACEMENT_COLUMNS)}
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
    </div>
  );
}
