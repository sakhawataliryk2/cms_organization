"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/lib/apiListParams";
import type { ColumnFilterState, ColumnSortState } from "@/components/SortableColumnHeader";

export const PAGE_SIZE_OPTIONS = [50, 100, 150, 200, 500] as const;

type UseServerEntityListOptions<T> = {
  apiPath: string;
  responseKey: string;
  initialPageSize?: number;
  extraQueryParams?: Record<string, string>;
  enabled?: boolean;
};

export function useServerEntityList<T>({
  apiPath,
  responseKey,
  initialPageSize = 50,
  extraQueryParams = {},
  enabled = true,
}: UseServerEntityListOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [columnSorts, setColumnSorts] = useState<
    Record<string, ColumnSortState>
  >({});
  const [columnFilters, setColumnFilters] = useState<
    Record<string, ColumnFilterState>
  >({});
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedOnceRef = useRef(false);
  const activeFetchControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);
  const queryCacheRef = useRef<
    Map<string, { items: T[]; total: number | null }>
  >(new Map());

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clearCache = useCallback(() => {
    queryCacheRef.current.clear();
  }, []);

  const handleColumnSort = useCallback((columnKey: string) => {
    setColumnSorts((prev) => {
      const current = prev[columnKey];
      if (current === "asc") return { ...prev, [columnKey]: "desc" };
      if (current === "desc") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: "asc" };
    });
    setCurrentPage(1);
    queryCacheRef.current.clear();
  }, []);

  const handleColumnFilter = useCallback((columnKey: string, value: string) => {
    let didChange = false;
    setColumnFilters((prev) => {
      const nextValue = value.trim();
      const prevValue = (prev[columnKey] ?? "").trim();
      if (nextValue === prevValue) return prev;
      didChange = true;
      if (!nextValue) {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: value };
    });
    if (!didChange) return;
    setCurrentPage(1);
    queryCacheRef.current.clear();
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSearchInput("");
    setSearchTerm("");
    setColumnFilters({});
    setColumnSorts({});
    setCurrentPage(1);
    queryCacheRef.current.clear();
  }, []);

  const extraParamsKey = useMemo(
    () => JSON.stringify(extraQueryParams),
    [extraQueryParams],
  );

  const fetchPage = useCallback(
    async (page: number) => {
      if (!enabled) return;

      const normalizedSearch = searchTerm.trim().toLowerCase();
      const activeSorts = Object.entries(columnSorts).filter(
        ([, dir]) => dir !== null,
      );
      const sortKey = activeSorts.length > 0 ? activeSorts[0][0] : "";
      const sortDir = activeSorts.length > 0 ? activeSorts[0][1] : "";
      const activeFilters = Object.fromEntries(
        Object.entries(columnFilters).filter(
          ([, value]) => value != null && String(value).trim() !== "",
        ),
      );
      const filtersKey = JSON.stringify(activeFilters);
      const cacheKey = `${page}|${pageSize}|${normalizedSearch}|${sortKey}|${sortDir}|${filtersKey}|${extraParamsKey}`;
      const cached = queryCacheRef.current.get(cacheKey);
      if (cached) {
        setItems(cached.items);
        setTotalCount(cached.total);
        setIsLoading(false);
        setIsPageLoading(false);
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      activeFetchControllerRef.current?.abort();
      const controller = new AbortController();
      activeFetchControllerRef.current = controller;

      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsPageLoading(true);
      }

      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          ...extraQueryParams,
        });
        if (normalizedSearch !== "") {
          query.set("search", searchTerm.trim());
        }
        if (sortKey) {
          query.set("sort", sortKey);
          query.set("order", sortDir === "asc" ? "ASC" : "DESC");
        }
        if (Object.keys(activeFilters).length > 0) {
          query.set("filters", JSON.stringify(activeFilters));
        }

        const response = await fetch(`${apiPath}?${query.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to fetch records");
        }

        const data = await response.json();
        if (requestId !== latestRequestIdRef.current) return;

        const incoming: T[] = Array.isArray(data?.[responseKey])
          ? data[responseKey]
          : [];
        const total =
          typeof data?.total === "number"
            ? data.total
            : typeof data?.count === "number"
              ? data.count
              : null;

        setTotalCount(total);
        setItems(incoming);
        queryCacheRef.current.set(cacheKey, { items: incoming, total });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "An error occurred while fetching",
        );
      } finally {
        if (requestId !== latestRequestIdRef.current) return;
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
        setIsPageLoading(false);
      }
    },
    [
      enabled,
      apiPath,
      responseKey,
      pageSize,
      searchTerm,
      columnSorts,
      columnFilters,
      extraParamsKey,
      extraQueryParams,
    ],
  );

  useEffect(() => {
    if (!enabled) return;
    void fetchPage(currentPage);
  }, [currentPage, fetchPage, enabled]);

  useEffect(() => {
    return () => activeFetchControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, columnSorts, extraParamsKey]);

  const totalPages =
    totalCount != null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;

  const visibleResultsCount = totalCount ?? items.length;

  const canGoPrev = currentPage > 1 && !isPageLoading && !isLoading;
  const canGoNext =
    (totalPages != null
      ? currentPage < totalPages
      : items.length === pageSize) &&
    !isPageLoading &&
    !isLoading;

  const paginationItems = useMemo<(number | "...")[]>(() => {
    if (totalPages == null || totalPages <= 1) return [1];

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let p = currentPage - 1; p <= currentPage + 1; p += 1) {
      if (p > 1 && p < totalPages) pages.add(p);
    }

    const sorted = Array.from(pages).sort((a, b) => a - b);
    const result: (number | "...")[] = [];
    for (let i = 0; i < sorted.length; i += 1) {
      const value = sorted[i];
      if (i > 0 && value - sorted[i - 1] > 1) result.push("...");
      result.push(value);
    }
    return result;
  }, [currentPage, totalPages]);

  const showTableSkeleton = isLoading || isPageLoading;

  return {
    items,
    setItems,
    searchInput,
    setSearchInput,
    searchTerm,
    columnSorts,
    setColumnSorts,
    columnFilters,
    setColumnFilters,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    totalCount,
    totalPages,
    visibleResultsCount,
    isLoading,
    isPageLoading,
    error,
    setError,
    fetchPage,
    clearCache,
    handleColumnSort,
    handleColumnFilter,
    handleClearAllFilters,
    PAGE_SIZE_OPTIONS,
    canGoPrev,
    canGoNext,
    paginationItems,
    showTableSkeleton,
  };
}
