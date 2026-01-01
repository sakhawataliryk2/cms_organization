"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
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
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
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
const DEFAULT_LEAD_COLUMNS: string[] = [
  "name",
  "status",
  "email",
  "phone",
  "title",
  "organization",
  "owner",
];

// Column Catalog (field mappings like)

const humanize = (s: string) =>
  s
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const columnsCatalog = useMemo(() => {
  const standard = [
    { key: "name", label: "Name", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "phone", label: "Phone", sortable: true },
    { key: "title", label: "Title", sortable: true },
    { key: "organization", label: "Organization", sortable: true },
    { key: "owner", label: "Owner", sortable: true },
  ];

  const customKeySet = new Set<string>();
  (leads || []).forEach((l: any) => {
    const cf = l?.customFields || l?.custom_fields || {};
    Object.keys(cf).forEach((k) => customKeySet.add(k));
  });

  const custom = Array.from(customKeySet).map((k) => ({
    key: `custom:${k}`,
    label: humanize(k),
    sortable: false,
  }));

  const merged = [...standard, ...custom];
  const seen = new Set<string>();
  return merged.filter((x) => {
    if (seen.has(x.key)) return false;
    seen.add(x.key);
    return true;
  });
}, [leads]);

const getColumnLabel = (key: string) =>
  columnsCatalog.find((c) => c.key === key)?.label ?? key;

const getColumnValue = (lead: any, key: string) => {
  if (key.startsWith("custom:")) {
    const rawKey = key.replace("custom:", "");
    const cf = lead?.customFields || lead?.custom_fields || {};
    const val = cf?.[rawKey];
    return val === undefined || val === null || val === ""
      ? "N/A"
      : String(val);
  }

  const fullName =
    lead.full_name ||
    `${lead.last_name || ""}, ${lead.first_name || ""}`.trim();

  switch (key) {
    case "name":
      return fullName || "N/A";
    case "status":
      return lead.status || "N/A";
    case "email":
      return lead.email || "N/A";
    case "phone":
      return lead.phone || "N/A";
    case "title":
      return lead.title || "N/A";
    case "organization":
      return lead.organization_name_from_org || lead.organization_id || "N/A";
    case "owner":
      return lead.owner || "N/A";
    default:
      return "—";
  }
};


const [openActionId, setOpenActionId] = useState<string | null>(null);

const {
  columnFields, 
  setColumnFields, 
  showHeaderFieldModal: showColumnModal,
  setShowHeaderFieldModal: setShowColumnModal,
  saveHeaderConfig: saveColumnConfig,
  isSaving: isSavingColumns,
} = useHeaderConfig({
  entityType: "LEAD",
  configType: "columns",
  defaultFields: DEFAULT_LEAD_COLUMNS,
});


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
            onClick={() => setShowColumnModal(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
          >
            Columns
          </button>

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
                  onClick={() => handleSort("id")}
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
                  {/* sorting optional: agar sorting chahiye to yahan button add kar dena */}
                  {getColumnLabel(key)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {sortedLeads.map((lead) => (
              <tr
                key={lead.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handleViewLead(lead.id)}
              >
                {/* Fixed checkbox */}
                <td
                  className="px-6 py-4 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectedLeads.includes(lead.id)}
                    onChange={() => {}}
                    onClick={(e) => handleSelectLead(lead.id, e)}
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
                          prev === lead.id ? null : lead.id
                        );
                      }}
                    >
                      Actions ▾
                    </button>

                    {openActionId === lead.id && (
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
                              handleViewLead(lead.id);
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
                                  "Are you sure you want to delete this lead?"
                                )
                              )
                                return;

                              setIsDeleting(true);
                              try {
                                const response = await fetch(
                                  `/api/leads/${lead.id}`,
                                  { method: "DELETE" }
                                );
                                if (!response.ok)
                                  throw new Error("Failed to delete lead");
                                await fetchLeads();
                              } catch (err) {
                                setDeleteError(
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
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    L {lead.id}
                  </div>
                </td>

                {/* Dynamic cells */}
                {columnFields.map((key) => (
                  <td
                    key={key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {key === "status" ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {getColumnValue(lead, key)}
                      </span>
                    ) : key === "email" ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {getColumnValue(lead, key)}
                      </a>
                    ) : (
                      getColumnValue(lead, key)
                    )}
                  </td>
                ))}
              </tr>
            ))}
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
                  {columnsCatalog.map((c)  => {
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
                    onClick={() => setColumnFields(DEFAULT_LEAD_COLUMNS)}
                  >
                    Reset
                  </button>

                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={!!isSavingColumns}
                    onClick={async () => {
                      const ok = await saveColumnConfig(); // your hook method
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
