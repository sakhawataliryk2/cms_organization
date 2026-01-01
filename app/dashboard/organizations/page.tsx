"use client";

import { useState, useEffect, useMemo } from "react";

import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { useListControls } from "@/hooks/useListSortFilter";
import SortFilterBar from "@/components/list/SortFilterBar";
import FiltersModal from "@/components/list/FiltersModal";

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

  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
}



export default function OrganizationList() {
  const router = useRouter();
const list = useListControls({
  defaultSortKey: "id",
  defaultSortDir: "desc",
  sortOptions: [
    { key: "id", label: "ID" },
    { key: "name", label: "Company Name" },
    { key: "status", label: "Status" },
    { key: "contact_phone", label: "Phone Number" },
    { key: "address", label: "Address" },
    { key: "job_orders_count", label: "Job Orders" },
    { key: "placements_count", label: "Placements" },
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
  const ORG_DEFAULT_COLUMNS = [
    "name",
    "status",
    "contact_phone",
    "address",
    "job_orders_count",
    "placements_count",
  ];

  const {
    columnFields,
    setColumnFields,
    showHeaderFieldModal: showColumnModal,
    setShowHeaderFieldModal: setShowColumnModal,
    saveHeaderConfig: saveColumnConfig,
    isSaving: isSavingColumns,
  } = useHeaderConfig({
    entityType: "ORGANIZATION",
    defaultFields: ORG_DEFAULT_COLUMNS,
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

        const res = await fetch("/api/admin/field-management/organizations", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        });

        console.log("field-management status:", res.status);

        const raw = await res.text();
        console.log("field-management raw:", raw);

        let data: any = {};
        try {
          data = JSON.parse(raw);
        } catch {
          data = {};
        }

        const fields =
          data.fields ||
          data.data?.fields ||
          data.organizationFields ||
          data.data ||
          [];

        console.log("parsed fields length:", fields?.length);

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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>(
    []
  );
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // // Sorting state
  // const [sortField, setSortField] = useState<
  //   | "id"
  //   | "name"
  //   | "status"
  //   | "contact_phone"
  //   | "address"
  //   | "job_orders_count"
  //   | "placements_count"
  //   | null
  // >(null);
  // const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  // ✅ Columns Catalog (Standard + Modify Page Custom Fields)
  const humanize = (s: string) =>
    s
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const columnsCatalog = useMemo(() => {
    // ✅ 1) Standard columns (fixed)
    const standard = [
      { key: "name", label: "Company Name", sortable: true },
      { key: "status", label: "Status", sortable: true },
      { key: "contact_phone", label: "Phone Number", sortable: true },
      { key: "address", label: "Address", sortable: true },
      { key: "job_orders_count", label: "Job Orders", sortable: true },
      { key: "placements_count", label: "Placements", sortable: true },
    ];

    // ✅ 2) Custom keys (auto from ALL organizations list)
    const customKeySet = new Set<string>();

    (organizations || []).forEach((org: any) => {
      const cf = org?.customFields || org?.custom_fields || {};
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
  }, [organizations]);

  const getColumnLabel = (key: string) =>
    columnsCatalog.find((c) => c.key === key)?.label || key;

  const getColumnValue = (org: any, key: string) => {
    // ✅ custom columns
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const cf = org?.customFields || org?.custom_fields || {};
      const val = cf?.[rawKey];
      return val === undefined || val === null || val === ""
        ? "N/A"
        : String(val);
    }

    // ✅ standard columns
    switch (key) {
      case "name":
        return org.name || "N/A";
      case "status":
        return org.status || "N/A";
      case "contact_phone":
        return org.contact_phone || "N/A";
      case "address":
        return org.address || "N/A";
      case "job_orders_count":
        return org.job_orders_count || 0;
      case "placements_count":
        return org.placements_count || 0;
      default:
        return "N/A";
    }
  };

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

//   // Handle sorting
//   const handleSort = (
//     field:
//       | "id"
//       | "name"
//       | "status"
//       | "contact_phone"
//       | "address"
//       | "job_orders_count"
//       | "placements_count"
//   ) => {
//     if (sortField === field) {
//       // Toggle direction if same field
//       setSortDirection(sortDirection === "asc" ? "desc" : "asc");
//     } else {
//       // Set new field with ascending direction
//       setSortField(field);
//       setSortDirection("asc");
//     }
//   };
// 
//   // Sort the filtered organizations
//   const sortedOrganizations = [...filteredOrganizations].sort((a, b) => {
//     if (!sortField) return 0;
// 
//     let aValue: string | number = "";
//     let bValue: string | number = "";
// 
//     if (sortField === "id") {
//       // Sort numerically by ID
//       aValue = parseInt(a.id) || 0;
//       bValue = parseInt(b.id) || 0;
//     } else if (sortField === "name") {
//       aValue = a.name?.toLowerCase() || "";
//       bValue = b.name?.toLowerCase() || "";
//     } else if (sortField === "status") {
//       aValue = a.status?.toLowerCase() || "";
//       bValue = b.status?.toLowerCase() || "";
//     } else if (sortField === "contact_phone") {
//       aValue = a.contact_phone?.toLowerCase() || "";
//       bValue = b.contact_phone?.toLowerCase() || "";
//     } else if (sortField === "address") {
//       aValue = a.address?.toLowerCase() || "";
//       bValue = b.address?.toLowerCase() || "";
//     } else if (sortField === "job_orders_count") {
//       aValue = a.job_orders_count || 0;
//       bValue = b.job_orders_count || 0;
//     } else if (sortField === "placements_count") {
//       aValue = a.placements_count || 0;
//       bValue = b.placements_count || 0;
//     }
// 
//     if (sortDirection === "asc") {
//       return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
//     } else {
//       return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
//     }
//   });
const viewOrganizations = useMemo(() => {
  const data = filteredOrganizations;

  return list.applySortFilter<Organization>(data, {
    getValue: (row, key) => {
      if (key.startsWith("custom:")) {
        const rawKey = key.replace("custom:", "");
        const cf =
          (row as any)?.customFields || (row as any)?.custom_fields || {};
        return cf?.[rawKey];
      }
      return (row as any)[key];
    },
  });
}, [filteredOrganizations, list]);

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
                    { label: "Qualified Lead", value: "Qualified Lead" },
                    { label: "Archive", value: "Archive" },
                    { label: "Passive Account", value: "Passive Account" },
                    { label: "Offer Out", value: "Offer Out" },
                    { label: "Yes", value: "Yes" },
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

      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        <div className="relative w-full">
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
            {viewOrganizations.map((org) => (
              <tr
                key={org.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handleViewOrganization(org.id)}
              >
                {/* Fixed checkbox */}
                <td
                  className="px-6 py-4 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectedOrganizations.includes(org.id)}
                    onChange={() => {}}
                    onClick={(e) => handleSelectOrganization(org.id, e)}
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
                          prev === org.id ? null : org.id
                        );
                      }}
                    >
                      Actions ▾
                    </button>

                    {openActionId === org.id && (
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
                              handleViewOrganization(org.id);
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
                                  "Are you sure you want to delete this organization?"
                                )
                              )
                                return;

                              setIsDeleting(true);
                              try {
                                const response = await fetch(
                                  `/api/organizations/${org.id}`,
                                  { method: "DELETE" }
                                );
                                if (!response.ok)
                                  throw new Error(
                                    "Failed to delete organization"
                                  );
                                await fetchOrganizations();
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
                    O {org.id}
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
                        {getColumnValue(org, key)}
                      </span>
                    ) : (
                      getColumnValue(org, key)
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
              <span className="font-medium">{viewOrganizations.length}</span> of{" "}
              <span className="font-medium">{viewOrganizations.length}</span>{" "}
              results
            </p>
          </div>
          {viewOrganizations.length > 0 && (
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
                    onClick={() => setColumnFields(ORG_DEFAULT_COLUMNS)}
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
