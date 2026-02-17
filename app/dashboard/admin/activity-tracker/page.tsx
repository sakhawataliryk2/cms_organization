// app/dashboard/admin/activity-tracker/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiActivity, FiArrowLeft, FiDownload } from "react-icons/fi";

interface ActivityRecord {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  metadata: any | null;
  created_at: string;
}

interface SummaryRow {
  action: string;
  entity_type: string;
  count: number;
}

interface ActivityResponse {
  success: boolean;
  activities: ActivityRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary: SummaryRow[];
}

export default function ActivityTrackerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ActivityResponse | null>(null);

  // Load initial filters from URL (optional)
  useEffect(() => {
    if (!searchParams) return;

    const spUserId = searchParams.get("userId") || searchParams.get("user_id");
    const spStart = searchParams.get("start") || searchParams.get("startDate");
    const spEnd = searchParams.get("end") || searchParams.get("endDate");
    const spAction = searchParams.get("action");
    const spEntityType =
      searchParams.get("entityType") || searchParams.get("entity_type");
    const spPage = searchParams.get("page");

    if (spUserId) setUserId(spUserId);
    if (spStart) setStartDate(spStart);
    if (spEnd) setEndDate(spEnd);
    if (spAction) setActionFilter(spAction);
    if (spEntityType) setEntityTypeFilter(spEntityType);
    if (spPage) setPage(parseInt(spPage, 10) || 1);
  }, [searchParams]);

  const fetchActivities = async (pageToLoad = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      if (actionFilter) params.set("action", actionFilter);
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      params.set("page", String(pageToLoad));

      // Update URL (without full navigation)
      const qs = params.toString();
      router.replace(
        qs ? `/dashboard/admin/activity-tracker?${qs}` : "/dashboard/admin/activity-tracker",
        { scroll: false }
      );

      const res = await fetch(`/api/admin/activity?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: any = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load activity");
      }

      setData(json as ActivityResponse);
      setPage(pageToLoad);
    } catch (err: any) {
      console.error("Error loading activity:", err);
      setError(err.message || "Failed to load activity");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchActivities(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => {
    fetchActivities(1);
  };

  const handleClearFilters = () => {
    setUserId("");
    setStartDate("");
    setEndDate("");
    setActionFilter("");
    setEntityTypeFilter("");
    fetchActivities(1);
  };

  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    data?.activities.forEach((a) => {
      if (a.action) set.add(a.action);
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueEntityTypes = useMemo(() => {
    const set = new Set<string>();
    data?.activities.forEach((a) => {
      if (a.entity_type) set.add(a.entity_type);
    });
    return Array.from(set).sort();
  }, [data]);

  const handleExport = () => {
    if (!data || !data.activities || data.activities.length === 0) {
      alert("No activity to export for current filters.");
      return;
    }

    // Build CSV (Excel-compatible)
    const headers = [
      "Date/Time",
      "User ID",
      "User Name",
      "Action",
      "Entity Type",
      "Entity ID",
      "Entity Label",
      "Metadata",
    ];

    const rows = data.activities.map((a) => [
      a.created_at,
      a.user_id ?? "",
      a.user_name ?? "",
      a.action,
      a.entity_type ?? "",
      a.entity_id ?? "",
      a.entity_label ?? "",
      a.metadata ? JSON.stringify(a.metadata) : "",
    ]);

    const all = [headers, ...rows];

    const csv = all
      .map((row) =>
        row
          .map((value) => {
            const v = String(value ?? "");
            const escaped = v.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const startPart = startDate || "all";
    const endPart = endDate || "all";
    link.href = url;
    link.download = `Activity_Tracker_${startPart}_${endPart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalPages = useMemo(() => {
    if (!data || !data.pageSize) return 1;
    return Math.max(1, Math.ceil((data.total || 0) / data.pageSize));
  }, [data]);

  return (
    <div className="bg-gray-200 min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push("/dashboard/admin")}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-4 sm:mb-6"
        >
          <FiArrowLeft size={20} />
          Back to Admin Center
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black flex items-center justify-center rounded-sm">
                <FiActivity size={28} color="white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Activity Tracker
                </h1>
                <p className="text-gray-500 text-xs sm:text-sm">
                  Per-person activity overview and exportable CSV
                </p>
              </div>
            </div>

            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={!data || !data.activities || data.activities.length === 0}
            >
              <FiDownload size={16} />
              Export CSV
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                User ID (optional)
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                {uniqueActions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Entity Type
              </label>
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Entity Types</option>
                {uniqueEntityTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              onClick={handleApplyFilters}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100"
              disabled={isLoading}
            >
              Clear
            </button>
            {isLoading && (
              <span className="text-xs text-gray-500">Loading activity...</span>
            )}
            {data && (
              <span className="text-xs text-gray-500">
                {data.total} record{data.total === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {error && (
            <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          {/* Summary */}
          {data && data.summary && data.summary.length > 0 && (
            <div className="mb-4 border border-gray-200 rounded p-3 bg-gray-50">
              <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Summary (by action & entity type)
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-1 text-left font-medium text-gray-700">
                        Action
                      </th>
                      <th className="px-2 py-1 text-left font-medium text-gray-700">
                        Entity Type
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-gray-700">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.map((row) => (
                      <tr key={`${row.action}-${row.entity_type}`} className="border-t">
                        <td className="px-2 py-1 text-gray-800">{row.action}</td>
                        <td className="px-2 py-1 text-gray-600">
                          {row.entity_type}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-800">
                          {row.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity table */}
          <div className="border border-gray-200 rounded overflow-x-auto bg-white">
            {!data || !data.activities || data.activities.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 italic">
                No activity found for the selected filters.
              </p>
            ) : (
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">
                      Date / Time
                    </th>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">
                      User
                    </th>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">
                      Action
                    </th>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">
                      Entity
                    </th>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.activities.map((a) => (
                    <tr key={a.id} className="border-t hover:bg-gray-50">
                      <td className="px-2 py-2 align-top text-gray-700 whitespace-nowrap">
                        {a.created_at
                          ? new Date(a.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-2 py-2 align-top text-gray-700">
                        <div className="text-xs sm:text-sm font-medium">
                          {a.user_name || "Unknown"}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          ID: {a.user_id ?? "?"}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top text-gray-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                          {a.action}
                        </span>
                        {a.entity_type && (
                          <div className="text-[11px] text-gray-500 mt-1">
                            {a.entity_type}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top text-gray-700">
                        {a.entity_label || a.entity_id || "-"}
                      </td>
                      <td className="px-2 py-2 align-top text-gray-600 max-w-xs">
                        {a.metadata ? (
                          <pre className="text-[11px] whitespace-pre-wrap break-normal bg-gray-50 rounded p-1 border border-gray-100">
                            {JSON.stringify(a.metadata, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-[11px] text-gray-400">
                            No details
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs sm:text-sm">
              <span className="text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const newPage = Math.max(1, page - 1);
                    if (newPage !== page) fetchActivities(newPage);
                  }}
                  disabled={page <= 1 || isLoading}
                  className="px-2 py-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 hover:bg-gray-100"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    const newPage = Math.min(totalPages, page + 1);
                    if (newPage !== page) fetchActivities(newPage);
                  }}
                  disabled={page >= totalPages || isLoading}
                  className="px-2 py-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
