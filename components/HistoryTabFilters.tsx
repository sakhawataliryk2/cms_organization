"use client";

import React from "react";

export type HistorySortOrder = "asc" | "desc";

export function useHistoryFilters(history: Array<any>) {
  const [sortOrder, setSortOrder] = React.useState<HistorySortOrder>("desc");
  const [userFilter, setUserFilter] = React.useState("");

  const getUserName = (item: any) =>
    item.performed_by_name || item.created_by_name || "Unknown";
  const getDate = (item: any) =>
    new Date(item.performed_at || item.created_at || 0).getTime();

  const filteredAndSorted = React.useMemo(() => {
    let out = [...history];
    if (userFilter.trim()) {
      const uf = userFilter.trim().toLowerCase();
      out = out.filter((item) =>
        (getUserName(item) || "").toLowerCase().includes(uf)
      );
    }
    out.sort((a, b) => {
      const diff = getDate(a) - getDate(b);
      return sortOrder === "asc" ? diff : -diff;
    });
    return out;
  }, [history, userFilter, sortOrder]);

  const uniqueUsers = React.useMemo(
    () =>
      [...new Set(history.map(getUserName).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b))
      ),
    [history]
  );

  return {
    filteredAndSorted,
    sortOrder,
    setSortOrder,
    userFilter,
    setUserFilter,
    uniqueUsers,
  };
}

interface HistoryTabFiltersProps {
  sortOrder: HistorySortOrder;
  onSortOrderChange: (v: HistorySortOrder) => void;
  userFilter: string;
  onUserFilterChange: (v: string) => void;
  uniqueUsers: string[];
  disabled?: boolean;
}

export default function HistoryTabFilters({
  sortOrder,
  onSortOrderChange,
  userFilter,
  onUserFilterChange,
  uniqueUsers,
  disabled = false,
}: HistoryTabFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">
          Sort by Date:
        </label>
        <select
          className="px-3 py-1.5 border rounded text-sm bg-white disabled:opacity-50"
          value={sortOrder}
          onChange={(e) =>
            onSortOrderChange(e.target.value as HistorySortOrder)
          }
          disabled={disabled}
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <label className="text-sm font-medium text-gray-600 shrink-0">
          Filter by User:
        </label>
        <input
          type="text"
          placeholder="Search user name..."
          className="flex-1 min-w-[120px] max-w-[200px] px-3 py-1.5 border rounded text-sm disabled:opacity-50"
          value={userFilter}
          onChange={(e) => onUserFilterChange(e.target.value)}
          disabled={disabled}
        />
        <select
          className="px-3 py-1.5 border rounded text-sm bg-white disabled:opacity-50 min-w-[140px]"
          value={userFilter}
          onChange={(e) => onUserFilterChange(e.target.value)}
          disabled={disabled}
          title="Quick select user"
        >
          <option value="">All Users</option>
          {uniqueUsers.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
