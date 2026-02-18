"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  FiActivity, FiUsers, FiEye, FiClock, FiMousePointer, 
  FiEdit3, FiArrowLeft, FiDownload, FiRefreshCw,
  FiTrendingUp, FiMonitor, FiSmartphone, FiTablet
} from "react-icons/fi";

interface DashboardData {
  sessions: {
    stats: {
      total_sessions: number;
      active_sessions: number;
      total_duration: number;
      avg_duration: number;
      total_pages: number;
      total_actions: number;
      unique_users: number;
    };
    daily: Array<{
      date: string;
      sessions: number;
      total_duration: number;
      avg_duration: number;
      pages_visited: number;
      actions: number;
    }>;
    devices: Array<{
      device_type: string;
      count: number;
      avg_duration: number;
    }>;
  };
  pages: {
    popularPages: Array<{
      page_path: string;
      page_title: string;
      view_count: number;
      unique_users: number;
      avg_time_on_page: number;
      avg_scroll_depth: number;
      total_clicks: number;
    }>;
    dailyViews: Array<{
      date: string;
      views: number;
      unique_users: number;
      sessions: number;
    }>;
    topReferrers: Array<{
      referrer: string;
      count: number;
    }>;
    utmBreakdown: Array<{
      utm_source: string;
      utm_medium: string;
      utm_campaign: string;
      count: number;
    }>;
  };
  fieldChanges: {
    topFields: Array<{
      field_name: string;
      field_label: string;
      change_count: number;
      users_making_changes: number;
      entities_affected: number;
    }>;
    byEntityType: Array<{
      entity_type: string;
      change_count: number;
      users: number;
      entities: number;
    }>;
    byUser: Array<{
      user_id: number;
      user_name: string;
      change_count: number;
      entity_types_touched: number;
    }>;
    dailyChanges: Array<{
      date: string;
      changes: number;
    }>;
  };
  activities: Array<{
    action: string;
    entity_type: string;
    count: number;
  }>;
}

type TabType = "overview" | "sessions" | "pages" | "changes" | "activity";

export default function AnalyticsDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  
  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);

      const res = await fetch(`/api/analytics/dashboard?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load analytics");
      }

      setData(json as DashboardData);
    } catch (err: any) {
      console.error("Error loading analytics:", err);
      setError(err.message || "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatNumber = (num: number) => {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: FiTrendingUp },
    { id: "sessions", label: "Sessions", icon: FiClock },
    { id: "pages", label: "Page Views", icon: FiEye },
    { id: "changes", label: "Field Changes", icon: FiEdit3 },
    { id: "activity", label: "Activity Log", icon: FiActivity },
  ];

  const renderOverview = () => {
    if (!data) return null;

    const { sessions, pages, fieldChanges } = data;

    return (
      <div className="space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(sessions.stats.total_sessions)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FiClock className="text-blue-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{sessions.stats.unique_users} unique users</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Avg. Session Time</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatDuration(sessions.stats.avg_duration)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FiTrendingUp className="text-green-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Total: {formatDuration(sessions.stats.total_duration)}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Page Views</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(sessions.stats.total_pages)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FiEye className="text-purple-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{sessions.stats.total_actions} actions recorded</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Field Changes</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(fieldChanges.dailyChanges.reduce((a, b) => a + b.changes, 0))}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FiEdit3 className="text-orange-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{fieldChanges.byUser.length} users made changes</p>
          </div>
        </div>

        {/* Daily Sessions Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Sessions & Activity</h3>
          <div className="h-64 flex items-end gap-2">
            {sessions.daily.slice(0, 14).reverse().map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${Math.min(100, (day.sessions / Math.max(...sessions.daily.map(d => d.sessions), 1)) * 100)}%` }}
                  title={`${day.sessions} sessions, ${formatDuration(day.total_duration)} total`}
                />
                <span className="text-[10px] text-gray-500 mt-1">
                  {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Pages & Field Changes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Pages */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Most Visited Pages</h3>
            <div className="space-y-3">
              {pages.popularPages.slice(0, 8).map((page, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                        {page.page_title || page.page_path}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{page.page_path}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatNumber(page.view_count)}</p>
                    <p className="text-xs text-gray-500">{formatDuration(page.avg_time_on_page)} avg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Field Changes by Entity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Changes by Entity Type</h3>
            <div className="space-y-3">
              {fieldChanges.byEntityType.slice(0, 8).map((entity, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-800 capitalize">{entity.entity_type}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatNumber(entity.change_count)}</p>
                    <p className="text-xs text-gray-500">{entity.users} users</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Device Usage</h3>
          <div className="flex items-center justify-around">
            {sessions.devices.map((device, idx) => {
              const Icon = device.device_type === "mobile" ? FiSmartphone : 
                          device.device_type === "tablet" ? FiTablet : FiMonitor;
              const color = device.device_type === "mobile" ? "bg-blue-500" : 
                           device.device_type === "tablet" ? "bg-purple-500" : "bg-gray-500";
              
              return (
                <div key={idx} className="text-center">
                  <div className={`w-16 h-16 ${color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                    <Icon className="text-white" size={28} />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{formatNumber(device.count)}</p>
                  <p className="text-xs text-gray-500 capitalize">{device.device_type}</p>
                  <p className="text-xs text-gray-400">{formatDuration(device.avg_duration)} avg</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderSessions = () => {
    if (!data) return null;
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Session Analytics</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.sessions.stats.total_sessions)}</p>
              <p className="text-xs text-gray-500">Total Sessions</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{data.sessions.stats.active_sessions}</p>
              <p className="text-xs text-gray-500">Active Now</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{formatDuration(data.sessions.stats.avg_duration)}</p>
              <p className="text-xs text-gray-500">Avg Duration</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.sessions.stats.unique_users)}</p>
              <p className="text-xs text-gray-500">Unique Users</p>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-gray-700 mb-3">Daily Sessions (Last 14 Days)</h4>
          <div className="h-48 flex items-end gap-1">
            {data.sessions.daily.slice(0, 14).reverse().map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-green-500 rounded-t"
                  style={{ height: `${Math.min(100, (day.sessions / Math.max(...data.sessions.daily.map(d => d.sessions), 1)) * 100)}%` }}
                />
                <span className="text-[9px] text-gray-500 mt-1 truncate w-full text-center">
                  {new Date(day.date).toLocaleDateString("en-US", { day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Session Duration Distribution</h3>
          <div className="space-y-2">
            {data.sessions.daily.slice(0, 10).map((day, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-xs text-gray-500 w-20">
                  {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded"
                    style={{ width: `${Math.min(100, (day.avg_duration / 3600) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-16 text-right">{formatDuration(day.avg_duration)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPages = () => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Page Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Page</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Views</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Unique</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Avg Time</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Scroll %</th>
                </tr>
              </thead>
              <tbody>
                {data.pages.popularPages.map((page, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{page.page_title || "Untitled"}</p>
                      <p className="text-xs text-gray-500">{page.page_path}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatNumber(page.view_count)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(page.unique_users)}</td>
                    <td className="px-4 py-3 text-right">{formatDuration(page.avg_time_on_page)}</td>
                    <td className="px-4 py-3 text-right">{Math.round(page.avg_scroll_depth)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {data.pages.topReferrers.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Referrers</h3>
            <div className="space-y-2">
              {data.pages.topReferrers.map((ref, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600 truncate flex-1">{ref.referrer || "Direct"}</span>
                  <span className="text-sm font-medium text-gray-900 ml-4">{formatNumber(ref.count)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChanges = () => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Most Changed Fields</h3>
          <div className="space-y-3">
            {data.fieldChanges.topFields.map((field, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800">{field.field_label || field.field_name}</p>
                    <p className="text-xs text-gray-500">{field.field_name} • {field.entities_affected} records</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{formatNumber(field.change_count)}</p>
                  <p className="text-xs text-gray-500">{field.users_making_changes} users</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Users by Changes</h3>
          <div className="space-y-3">
            {data.fieldChanges.byUser.map((user, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {user.user_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{user.user_name || "Unknown"}</p>
                    <p className="text-xs text-gray-500">{user.entity_types_touched} entity types</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{formatNumber(user.change_count)}</p>
                  <p className="text-xs text-gray-500">changes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderActivity = () => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity Summary</h3>
          <div className="space-y-3">
            {data.activities.map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800">{activity.action}</p>
                    <p className="text-xs text-gray-500 capitalize">{activity.entity_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{formatNumber(activity.count)}</p>
                  <p className="text-xs text-gray-500">occurrences</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <button
            onClick={() => router.push("/dashboard/admin")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <FiArrowLeft size={20} />
            <span>Back to Admin</span>
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <FiRefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <FiActivity size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">User Analytics Dashboard</h1>
              <p className="text-gray-500 text-sm">Comprehensive user activity tracking and analytics</p>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Apply
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-500">
              <FiRefreshCw className="animate-spin" size={24} />
              <span>Loading analytics...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {activeTab === "overview" && renderOverview()}
            {activeTab === "sessions" && renderSessions()}
            {activeTab === "pages" && renderPages()}
            {activeTab === "changes" && renderChanges()}
            {activeTab === "activity" && renderActivity()}
          </>
        )}
      </div>
    </div>
  );
}
