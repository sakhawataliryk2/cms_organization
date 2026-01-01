"use client";

import React from "react";
import { SortDir } from "@/hooks/useListSortFilter";

type Opt = { key: string; label: string };

export default function SortFilterBar({
  sortKey,
  sortDir,
  onChangeSortKey,
  onToggleDir,
  sortOptions,
  onOpenFilters,
  onClearFilters,
  hasFilters,
}: {
  sortKey: string;
  sortDir: SortDir;
  onChangeSortKey: (k: string) => void;
  onToggleDir: () => void;
  sortOptions: Opt[];
  onOpenFilters: () => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex items-center gap-2">
        <select
          className="px-3 py-2 border rounded text-sm bg-white"
          value={sortKey}
          onChange={(e) => onChangeSortKey(e.target.value)}
        >
          {sortOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
          onClick={onToggleDir}
          title="Toggle sort direction"
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>

        <button
          className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          onClick={onOpenFilters}
        >
          Filters {hasFilters ? "•" : ""}
        </button>

        {hasFilters && (
          <button
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
            onClick={onClearFilters}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
