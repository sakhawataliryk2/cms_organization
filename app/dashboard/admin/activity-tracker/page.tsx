// app/dashboard/admin/activity-tracker/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiActivity,
  FiArrowLeft,
  FiDownload,
  FiList,
  FiBarChart2,
  FiGrid,
} from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface ActivityRecord {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  metadata: unknown | null;
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

type TabId = "overview" | "activity" | "summary";

const CHART_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#6366f1", "#ef4444", "#84cc16", "#14b8a6",
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "short" });
}

export default function ActivityTrackerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [userId, setUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ActivityResponse | null>(null);

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

      router.replace(
        params.toString()
          ? `/dashboard/admin/activity-tracker?${params.toString()}`
          : "/dashboard/admin/activity-tracker",
        { scroll: false }
      );

      const res = await fetch(`/api/admin/activity?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const json: unknown = await res.json();

      if (!res.ok || !(json as ActivityResponse).success) {
        throw new Error(
          (json as { message?: string }).message || "Failed to load activity"
        );
      }
      setData(json as ActivityResponse);
      setPage(pageToLoad);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load activity"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => fetchActivities(1);
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
    data?.activities?.forEach((a) => {
      if (a.action) set.add(a.action);
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueEntityTypes = useMemo(() => {
    const set = new Set<string>();
    data?.activities?.forEach((a) => {
      if (a.entity_type) set.add(a.entity_type);
    });
    return Array.from(set).sort();
  }, [data]);

  // Chart data for Recharts: by action (from summary)
  const chartByAction = useMemo(() => {
    if (!data?.summary?.length) return [];
    const byAction = new Map<string, number>();
    data.summary.forEach((row) => {
      const prev = byAction.get(row.action) ?? 0;
      byAction.set(row.action, prev + row.count);
    });
    return Array.from(byAction.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data]);

  // Chart data for Recharts: by entity type (from summary)
  const chartByEntityType = useMemo(() => {
    if (!data?.summary?.length) return [];
    const byType = new Map<string, number>();
    data.summary.forEach((row) => {
      const prev = byType.get(row.entity_type) ?? 0;
      byType.set(row.entity_type, prev + row.count);
    });
    return Array.from(byType.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data]);

  // Activity by day for Recharts (from current page activities)
  const chartByDay = useMemo(() => {
    if (!data?.activities?.length) return [];
    const byDay = new Map<string, number>();
    data.activities.forEach((a) => {
      const day = a.created_at ? formatDate(a.created_at) : "";
      if (day) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    });
    return Array.from(byDay.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())
      .slice(-14);
  }, [data]);

  const uniqueUsersCount = useMemo(() => {
    if (!data?.activities?.length) return 0;
    const set = new Set(
      data.activities.map((a) => a.user_id ?? a.user_name ?? "").filter(Boolean)
    );
    return set.size;
  }, [data]);

  const handleExport = () => {
    if (!data?.activities?.length) {
      alert("No activity to export for current filters.");
      return;
    }
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
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Activity_Tracker_${startDate || "all"}_${endDate || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalPages = useMemo(() => {
    if (!data?.pageSize) return 1;
    return Math.max(1, Math.ceil((data.total || 0) / data.pageSize));
  }, [data]);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <FiBarChart2 size={18} /> },
    { id: "activity", label: "Activity list", icon: <FiList size={18} /> },
    { id: "summary", label: "Summary", icon: <FiGrid size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push("/dashboard/admin")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <FiArrowLeft size={20} />
          Back to Admin Center
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-200 bg-gray-50/80 px-4 sm:px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-900 flex items-center justify-center rounded-xl shadow">
                  <FiActivity size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Activity Tracker
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Internal user activity: pages, clicks, form fills, field
                    changes. Last online = most recent activity.
                  </p>
                </div>
              </div>
              <button
                onClick={handleExport}
                disabled={!data?.activities?.length}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FiDownload size={18} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="e.g. 1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Start date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  End date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Action
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">All</option>
                  {uniqueActions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Entity type
                </label>
                <select
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">All</option>
                  {uniqueEntityTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleApplyFilters}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  Apply
                </button>
                <button
                  onClick={handleClearFilters}
                  disabled={isLoading}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              {isLoading && (
                <span className="text-amber-600 font-medium">
                  Loading…
                </span>
              )}
              {data != null && (
                <span className="text-gray-500">
                  <strong className="text-gray-700">{data.total}</strong>{" "}
                  record{data.total === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {error && (
              <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-1 px-4 sm:px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? "border-gray-900 text-gray-900 bg-white"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-4 sm:p-6">
            {/* Overview */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* Stat cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total records
                    </p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {data?.total ?? 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unique users (this page)
                    </p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {uniqueUsersCount}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action types
                    </p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {uniqueActions.length}
                    </p>
                  </div>
                </div>

                {/* Charts row - Recharts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">
                      Activity by action
                    </h3>
                    {chartByAction.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        No data for current filters.
                      </p>
                    ) : (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartByAction}
                            layout="vertical"
                            margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 12 }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={75}
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => (v.length > 14 ? `${v.slice(0, 12)}…` : v)}
                            />
                            <Tooltip
                              formatter={(value: number | undefined) => [value ?? 0, "Count"]}
                              labelFormatter={(label) => `Action: ${label}`}
                              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                            />
                            <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                              {chartByAction.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">
                      Activity by entity type
                    </h3>
                    {chartByEntityType.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        No data for current filters.
                      </p>
                    ) : (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartByEntityType}
                            layout="vertical"
                            margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 12 }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={75}
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => (v.length > 14 ? `${v.slice(0, 12)}…` : v)}
                            />
                            <Tooltip
                              formatter={(value: number | undefined) => [value ?? 0, "Count"]}
                              labelFormatter={(label) => `Entity: ${label}`}
                              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                            />
                            <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                              {chartByEntityType.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">
                    Activity by day (current page)
                  </h3>
                  {chartByDay.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No data for current filters.
                    </p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartByDay}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => {
                              const d = new Date(v);
                              return `${d.getMonth() + 1}/${d.getDate()}`;
                            }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: number | undefined) => [value ?? 0, "Activities"]}
                            labelFormatter={(label) => `Date: ${label}`}
                            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="count"
                            name="Activities"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#colorCount)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Activity list */}
            {activeTab === "activity" && (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                {!data?.activities?.length ? (
                  <div className="p-12 text-center text-gray-500">
                    No activity found for the selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Date / Time
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Action
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Entity
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.activities.map((a) => (
                          <tr
                            key={a.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {a.created_at
                                ? formatDateTime(a.created_at)
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">
                                {a.user_name || "Unknown"}
                              </div>
                              <div className="text-xs text-gray-500">
                                ID: {a.user_id ?? "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                                {a.action}
                              </span>
                              {a.entity_type && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {a.entity_type}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                              {a.entity_label || a.entity_id || "—"}
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              {a.metadata ? (
                                <pre className="text-xs bg-gray-50 rounded-lg p-2 border border-gray-100 overflow-x-auto whitespace-pre-wrap wrap-break-word font-mono text-gray-600">
                                  {JSON.stringify(a.metadata, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(data?.activities?.length ?? 0) > 0 && totalPages > 1 ? (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchActivities(Math.max(1, page - 1))}
                        disabled={page <= 1 || isLoading}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          fetchActivities(Math.min(totalPages, page + 1))
                        }
                        disabled={page >= totalPages || isLoading}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Summary table */}
            {activeTab === "summary" && (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                {!data?.summary?.length ? (
                  <div className="p-12 text-center text-gray-500">
                    No summary for the selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Action
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Entity type
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Count
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.summary.map((row, idx) => (
                          <tr
                            key={`${row.action}-${row.entity_type}`}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                                {row.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {row.entity_type}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              {row.count.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
