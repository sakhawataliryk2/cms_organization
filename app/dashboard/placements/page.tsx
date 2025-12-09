"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";

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

  // Fetch placements on component mount
  useEffect(() => {
    fetchPlacements();
  }, []);

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
        <div className="flex items-center space-x-4">
          {selectedPlacements.length > 0 && (
            <button
              onClick={deleteSelectedPlacements}
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
              Delete Selected ({selectedPlacements.length})
            </button>
          )}
          {/* <button
            onClick={handleAddPlacement}
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
            Add Placement
          </button> */}
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
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <button
                  onClick={() => handleSort("id")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>ID</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "id" && sortDirection === "asc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                    </svg>
                    <svg
                      className={`w-3 h-3 -mt-1 ${
                        sortField === "id" && sortDirection === "desc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </button>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <button
                  onClick={() => handleSort("candidate_name")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Candidate</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "candidate_name" && sortDirection === "asc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                    </svg>
                    <svg
                      className={`w-3 h-3 -mt-1 ${
                        sortField === "candidate_name" && sortDirection === "desc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </button>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <button
                  onClick={() => handleSort("job_title")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Job</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "job_title" && sortDirection === "asc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                    </svg>
                    <svg
                      className={`w-3 h-3 -mt-1 ${
                        sortField === "job_title" && sortDirection === "desc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </button>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <button
                  onClick={() => handleSort("status")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Status</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "status" && sortDirection === "asc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                    </svg>
                    <svg
                      className={`w-3 h-3 -mt-1 ${
                        sortField === "status" && sortDirection === "desc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </button>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <button
                  onClick={() => handleSort("start_date")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Start Date</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "start_date" && sortDirection === "asc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                    </svg>
                    <svg
                      className={`w-3 h-3 -mt-1 ${
                        sortField === "start_date" && sortDirection === "desc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </button>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <button
                  onClick={() => handleSort("owner")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Owner</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "owner" && sortDirection === "asc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                    </svg>
                    <svg
                      className={`w-3 h-3 -mt-1 ${
                        sortField === "owner" && sortDirection === "desc"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </button>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedPlacements.includes(placement.id)}
                        onChange={() => {}}
                        onClick={(e) => handleSelectPlacement(placement.id, e)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {placement.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {placement.candidate_name || placement.job_seeker_name || "Unknown"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {placement.job_title || placement.job_name || "Unknown"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {placement.status || "Active"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {placement.start_date ? formatDate(placement.start_date) : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {placement.owner || placement.owner_name || "Unassigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPlacement(placement.id);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
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
          Showing <span className="font-medium">{sortedPlacements.length}</span> of{" "}
          <span className="font-medium">{placements.length}</span> placements
        </div>
      </div>
    </div>
  );
}
