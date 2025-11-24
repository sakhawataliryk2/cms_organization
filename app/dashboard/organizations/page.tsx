"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";

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
}

export default function OrganizationList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>(
    []
  );
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<
    | "id"
    | "name"
    | "status"
    | "contact_phone"
    | "address"
    | "job_orders_count"
    | "placements_count"
    | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

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

  const filteredOrganizations = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (org.website &&
        org.website.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (org.status &&
        org.status.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (org.contact_phone &&
        org.contact_phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (org.address &&
        org.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle sorting
  const handleSort = (
    field:
      | "id"
      | "name"
      | "status"
      | "contact_phone"
      | "address"
      | "job_orders_count"
      | "placements_count"
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

  // Sort the filtered organizations
  const sortedOrganizations = [...filteredOrganizations].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: string | number = "";
    let bValue: string | number = "";

    if (sortField === "id") {
      // Sort numerically by ID
      aValue = parseInt(a.id) || 0;
      bValue = parseInt(b.id) || 0;
    } else if (sortField === "name") {
      aValue = a.name?.toLowerCase() || "";
      bValue = b.name?.toLowerCase() || "";
    } else if (sortField === "status") {
      aValue = a.status?.toLowerCase() || "";
      bValue = b.status?.toLowerCase() || "";
    } else if (sortField === "contact_phone") {
      aValue = a.contact_phone?.toLowerCase() || "";
      bValue = b.contact_phone?.toLowerCase() || "";
    } else if (sortField === "address") {
      aValue = a.address?.toLowerCase() || "";
      bValue = b.address?.toLowerCase() || "";
    } else if (sortField === "job_orders_count") {
      aValue = a.job_orders_count || 0;
      bValue = b.job_orders_count || 0;
    } else if (sortField === "placements_count") {
      aValue = a.placements_count || 0;
      bValue = b.placements_count || 0;
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

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
      setSelectedOrganizations(filteredOrganizations.map((org) => org.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectOrganization = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event

    if (selectedOrganizations.includes(id)) {
      setSelectedOrganizations(
        selectedOrganizations.filter((orgId) => orgId !== id)
      );
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedOrganizations([...selectedOrganizations, id]);
      // If all orgs are now selected, update selectAll state
      if (
        [...selectedOrganizations, id].length === filteredOrganizations.length
      ) {
        setSelectAll(true);
      }
    }
  };

  const deleteSelectedOrganizations = async () => {
    // Don't do anything if no organizations are selected
    if (selectedOrganizations.length === 0) return;

    // Confirm deletion
    const confirmMessage =
      selectedOrganizations.length === 1
        ? "Are you sure you want to delete this organization?"
        : `Are you sure you want to delete these ${selectedOrganizations.length} organizations?`;

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Create promises for all delete operations
      const deletePromises = selectedOrganizations.map((id) =>
        fetch(`/api/organizations/${id}`, {
          method: "DELETE",
        })
      );

      // Execute all delete operations
      const results = await Promise.allSettled(deletePromises);

      // Check for failures
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} organizations`);
      }

      // Refresh organizations after successful deletion
      await fetchOrganizations();

      // Clear selection after deletion
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
    return <LoadingScreen message="Loading organizations..." />;
  }

  if (isDeleting) {
    return <LoadingScreen message="Deleting organizations..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Organizations</h1>
        <div className="flex items-center space-x-4">
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

      {/* Search and Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
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
      </div>

      {/* Organizations Table */}
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
                  onClick={() => handleSort("name")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Company Name</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "name" && sortDirection === "asc"
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
                        sortField === "name" && sortDirection === "desc"
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
                  onClick={() => handleSort("contact_phone")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Phone Number</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "contact_phone" && sortDirection === "asc"
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
                        sortField === "contact_phone" &&
                        sortDirection === "desc"
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
                  onClick={() => handleSort("address")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Address</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "address" && sortDirection === "asc"
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
                        sortField === "address" && sortDirection === "desc"
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
                  onClick={() => handleSort("job_orders_count")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Job Orders</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "job_orders_count" &&
                        sortDirection === "asc"
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
                        sortField === "job_orders_count" &&
                        sortDirection === "desc"
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
                  onClick={() => handleSort("placements_count")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Placements</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "placements_count" &&
                        sortDirection === "asc"
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
                        sortField === "placements_count" &&
                        sortDirection === "desc"
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
            {sortedOrganizations.length > 0 ? (
              sortedOrganizations.map((org) => (
                <tr
                  key={org.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewOrganization(org.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedOrganizations.includes(org.id)}
                        onChange={() => {}}
                        onClick={(e) => handleSelectOrganization(org.id, e)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {org.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {org.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        org.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {org.contact_phone || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {org.address || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {org.job_orders_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {org.placements_count || 0}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            "Are you sure you want to delete this organization?"
                          )
                        ) {
                          setIsDeleting(true);
                          try {
                            const response = await fetch(
                              `/api/organizations/${org.id}`,
                              {
                                method: "DELETE",
                              }
                            );

                            if (!response.ok) {
                              throw new Error("Failed to delete organization");
                            }

                            await fetchOrganizations();
                          } catch (err) {
                            console.error("Error deleting organization:", err);
                            setDeleteError(
                              err instanceof Error
                                ? err.message
                                : "An error occurred"
                            );
                          } finally {
                            setIsDeleting(false);
                          }
                        }
                      }}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                >
                  {searchTerm
                    ? "No organizations found matching your search."
                    : 'No organizations found. Click "Add Organization" to create one.'}
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
              <span className="font-medium">{sortedOrganizations.length}</span>{" "}
              of{" "}
              <span className="font-medium">{sortedOrganizations.length}</span>{" "}
              results
            </p>
          </div>
          {sortedOrganizations.length > 0 && (
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
  );
}
