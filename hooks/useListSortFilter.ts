"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";
export type SortOption = { key: string; label: string };

type Options = {
  defaultSortKey?: string;
  defaultSortDir?: SortDir;
  sortOptions?: SortOption[];
};

export function useListControls(options?: Options) {
  const [sortKey, setSortKey] = useState(
    options?.defaultSortKey ?? "created_at"
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    options?.defaultSortDir ?? "desc"
  );
  const [filters, setFilters] = useState<Record<string, any>>({});

  const sortOptions = options?.sortOptions ?? [];

  const hasFilters = useMemo(() => {
    return Object.values(filters).some((v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === "string" && v.trim() === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    });
  }, [filters]);

  const onChangeSortKey = (k: string) => setSortKey(k);
  const onToggleDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const clearFilters = () => setFilters({});

  function applySortFilter<T>(
    rows: T[],
    cfg: {
      getValue: (row: T, key: string) => any;
      filterFns?: Record<string, (row: T, value: any) => boolean>;
    }
  ) {
    let out = [...rows];

    for (const [k, v] of Object.entries(filters)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;

      const fn = cfg.filterFns?.[k];
      if (fn) out = out.filter((r) => fn(r, v));
    }

    out.sort((a, b) => {
      const av = cfg.getValue(a, sortKey);
      const bv = cfg.getValue(b, sortKey);

      const an =
        typeof av === "number"
          ? av
          : av instanceof Date
          ? av.getTime()
          : Number(av);
      const bn =
        typeof bv === "number"
          ? bv
          : bv instanceof Date
          ? bv.getTime()
          : Number(bv);

      let cmp = 0;

      if (!Number.isNaN(an) && !Number.isNaN(bn)) {
        cmp = an - bn;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    return out;
  }

  return {
    sortKey,
    sortDir,
    filters,
    setFilters,
    clearFilters,
    hasFilters,
    sortOptions,
    onChangeSortKey,
    onToggleDir,
    toggleSort,
    applySortFilter,
  };
}
