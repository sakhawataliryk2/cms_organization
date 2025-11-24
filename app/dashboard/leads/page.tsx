"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone: string;
  status: string;
  title: string;
  organization_name_from_org?: string;
  organization_id?: string;
  department: string;
  owner: string;
  created_at: string;
  created_by_name?: string;
}

export default function LeadList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
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
    | "email"
    | "phone"
    | "title"
    | "organization"
    | "owner"
    | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch leads on component mount
  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/leads");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch leads");
      }

      const data = await response.json();
      setLeads(data.leads || []);
    } catch (err) {
      console.error("Error fetching leads:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching leads"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLeads = leads.filter(
    (lead) =>
      `${lead.first_name} ${lead.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (lead.full_name &&
        lead.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.email &&
        lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.phone &&
        lead.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.status &&
        lead.status.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.title &&
        lead.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.organization_name_from_org &&
        lead.organization_name_from_org
          .toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      (lead.owner &&
        lead.owner.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle sorting
  const handleSort = (
    field:
      | "id"
      | "name"
      | "status"
      | "email"
      | "phone"
      | "title"
      | "organization"
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

  // Sort the filtered leads
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: string | number = "";
    let bValue: string | number = "";

    if (sortField === "id") {
      // Sort numerically by ID
      aValue = parseInt(a.id) || 0;
      bValue = parseInt(b.id) || 0;
    } else if (sortField === "name") {
      const aName = a.full_name || `${a.last_name || ""}, ${a.first_name || ""}`;
      const bName = b.full_name || `${b.last_name || ""}, ${b.first_name || ""}`;
      aValue = aName.toLowerCase();
      bValue = bName.toLowerCase();
    } else if (sortField === "status") {
      aValue = a.status?.toLowerCase() || "";
      bValue = b.status?.toLowerCase() || "";
    } else if (sortField === "email") {
      aValue = a.email?.toLowerCase() || "";
      bValue = b.email?.toLowerCase() || "";
    } else if (sortField === "phone") {
      aValue = a.phone?.toLowerCase() || "";
      bValue = b.phone?.toLowerCase() || "";
    } else if (sortField === "title") {
      aValue = a.title?.toLowerCase() || "";
      bValue = b.title?.toLowerCase() || "";
    } else if (sortField === "organization") {
      aValue = a.organization_name_from_org?.toLowerCase() || "";
      bValue = b.organization_name_from_org?.toLowerCase() || "";
    } else if (sortField === "owner") {
      aValue = a.owner?.toLowerCase() || "";
      bValue = b.owner?.toLowerCase() || "";
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const handleViewLead = (id: string) => {
    router.push(`/dashboard/leads/view?id=${id}`);
  };

  const handleAddLead = () => {
    router.push("/dashboard/leads/add");
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((lead) => lead.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event

    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((leadId) => leadId !== id));
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedLeads([...selectedLeads, id]);
      // If all leads are now selected, update selectAll state
      if ([...selectedLeads, id].length === filteredLeads.length) {
        setSelectAll(true);
      }
    }
  };

  const deleteSelectedLeads = async () => {
    // Don't do anything if no leads are selected
    if (selectedLeads.length === 0) return;

    // Confirm deletion
    const confirmMessage =
      selectedLeads.length === 1
        ? "Are you sure you want to delete this lead?"
        : `Are you sure you want to delete these ${selectedLeads.length} leads?`;

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Create promises for all delete operations
      const deletePromises = selectedLeads.map((id) =>
        fetch(`/api/leads/${id}`, {
          method: "DELETE",
        })
      );

      // Execute all delete operations
      const results = await Promise.allSettled(deletePromises);

      // Check for failures
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} leads`);
      }

      // Refresh leads after successful deletion
      await fetchLeads();

      // Clear selection after deletion
      setSelectedLeads([]);
      setSelectAll(false);
    } catch (err) {
      console.error("Error deleting leads:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting leads"
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
    return <LoadingScreen message="Loading leads..." />;
  }

  if (isDeleting) {
    return <LoadingScreen message="Deleting leads..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Leads</h1>
        <div className="flex items-center space-x-4">
          {selectedLeads.length > 0 && (
            <button
              onClick={deleteSelectedLeads}
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
              Delete Selected ({selectedLeads.length})
            </button>
          )}
          <button
            onClick={handleAddLead}
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
            Add Lead
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
            placeholder="Search leads..."
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

      {/* Leads Table */}
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
                  <span>Name</span>
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
                  onClick={() => handleSort("email")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Email</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "email" && sortDirection === "asc"
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
                        sortField === "email" && sortDirection === "desc"
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
                  onClick={() => handleSort("phone")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Phone</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "phone" && sortDirection === "asc"
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
                        sortField === "phone" && sortDirection === "desc"
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
                  onClick={() => handleSort("title")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Title</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "title" && sortDirection === "asc"
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
                        sortField === "title" && sortDirection === "desc"
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
                  onClick={() => handleSort("organization")}
                  className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                >
                  <span>Organization</span>
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        sortField === "organization" && sortDirection === "asc"
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
                        sortField === "organization" &&
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
            {sortedLeads.length > 0 ? (
              sortedLeads.map((lead) => {
                const fullName =
                  lead.full_name ||
                  `${lead.last_name || ""}, ${lead.first_name || ""}`;
                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewLead(lead.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => {}}
                          onClick={(e) => handleSelectLead(lead.id, e)}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {lead.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {fullName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          lead.status === "New Lead"
                            ? "bg-blue-100 text-blue-800"
                            : lead.status === "Contacted"
                            ? "bg-yellow-100 text-yellow-800"
                            : lead.status === "Qualified"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {lead.status || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.email || "N/A"}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.phone || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.title || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.organization_name_from_org || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.owner || "N/A"}
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
                              "Are you sure you want to delete this lead?"
                            )
                          ) {
                            setIsDeleting(true);
                            try {
                              const response = await fetch(
                                `/api/leads/${lead.id}`,
                                {
                                  method: "DELETE",
                                }
                              );

                              if (!response.ok) {
                                throw new Error("Failed to delete lead");
                              }

                              await fetchLeads();
                            } catch (err) {
                              console.error("Error deleting lead:", err);
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
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={10}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                >
                  {searchTerm
                    ? "No leads found matching your search."
                    : 'No leads found. Click "Add Lead" to create one.'}
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
              <span className="font-medium">{sortedLeads.length}</span> of{" "}
              <span className="font-medium">{sortedLeads.length}</span> results
            </p>
          </div>
          {sortedLeads.length > 0 && (
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
