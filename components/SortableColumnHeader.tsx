"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbGripVertical } from "react-icons/tb";
import { FiArrowUp, FiArrowDown, FiFilter } from "react-icons/fi";
import { COLUMN_FILTER_DEBOUNCE_MS } from "@/lib/apiListParams";

export type ColumnSortState = "asc" | "desc" | null;
export type ColumnFilterState = string | null;

type SortableColumnHeaderProps = {
  id: string;
  columnKey: string;
  label: string;
  sortState: ColumnSortState;
  filterValue: ColumnFilterState;
  onSort: () => void;
  onFilterChange: (value: string) => void;
  filterType: "text" | "select" | "number";
  filterOptions?: { label: string; value: string }[];
  children?: React.ReactNode;
};

export default function SortableColumnHeader({
  id,
  label,
  sortState,
  filterValue,
  onSort,
  onFilterChange,
  filterType,
  filterOptions,
}: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [showFilter, setShowFilter] = useState(false);
  const [draftFilterValue, setDraftFilterValue] = useState(filterValue || "");
  const filterRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thRef = useRef<HTMLTableCellElement | null>(null);
  const [filterPosition, setFilterPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    setDraftFilterValue(filterValue || "");
  }, [filterValue]);

  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  const flushFilterChange = useCallback(
    (value: string) => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
        filterDebounceRef.current = null;
      }
      onFilterChange(value);
    },
    [onFilterChange],
  );

  const scheduleFilterChange = useCallback(
    (value: string) => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
      filterDebounceRef.current = setTimeout(() => {
        filterDebounceRef.current = null;
        onFilterChange(value);
      }, COLUMN_FILTER_DEBOUNCE_MS);
    },
    [onFilterChange],
  );

  const handleDraftFilterChange = (value: string) => {
    setDraftFilterValue(value);
    scheduleFilterChange(value);
  };

  const handleSelectFilterChange = (value: string) => {
    setDraftFilterValue(value);
    flushFilterChange(value);
  };

  const handleClearFilter = () => {
    setDraftFilterValue("");
    flushFilterChange("");
    setShowFilter(false);
  };

  const handleFilterBlur = () => {
    if (filterType === "select") return;
    flushFilterChange(draftFilterValue);
  };

  const hasActiveFilter = Boolean(
    (filterValue && filterValue.trim() !== "") ||
      (draftFilterValue && draftFilterValue.trim() !== ""),
  );

  const updateFilterPosition = useCallback(() => {
    if (!filterToggleRef.current) return;
    const btnRect = filterToggleRef.current.getBoundingClientRect();
    const width = 200;
    let left = btnRect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    setFilterPosition({
      top: btnRect.bottom + 4,
      left,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!showFilter || !filterToggleRef.current) {
      setFilterPosition(null);
      return;
    }

    updateFilterPosition();

    const handleReposition = () => updateFilterPosition();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [showFilter, updateFilterPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(`[data-filter-toggle="${id}"]`)
      ) {
        if (filterType !== "select") {
          flushFilterChange(draftFilterValue);
        }
        setShowFilter(false);
      }
    };

    if (showFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilter, id, filterType, draftFilterValue, flushFilterChange]);

  return (
    <th
      ref={(node) => {
        thRef.current = node;
        setNodeRef(node);
      }}
      style={style}
      className="sticky top-0 z-20 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-r border-gray-200 relative group"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={16} />
        </button>

        <span className="flex-1">{label}</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSort();
          }}
          className="flex flex-col items-center leading-none transition-colors hover:text-gray-700"
          title={
            sortState === null
              ? "Sort ascending"
              : sortState === "asc"
                ? "Sort descending"
                : "Remove sort"
          }
        >
          <FiArrowUp
            size={12}
            className={sortState === "asc" ? "text-blue-600" : "text-gray-300"}
          />
          <FiArrowDown
            size={12}
            className={
              sortState === "desc"
                ? "text-blue-600 -mt-1"
                : "text-gray-300 -mt-1"
            }
          />
        </button>

        <button
          ref={filterToggleRef}
          data-filter-toggle={id}
          onClick={(e) => {
            e.stopPropagation();
            setShowFilter(!showFilter);
          }}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${
            hasActiveFilter ? "text-blue-600" : ""
          }`}
          title="Filter column"
        >
          <FiFilter size={14} />
        </button>
      </div>

      {showFilter &&
        filterPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={filterRef}
            className="bg-white border border-gray-300 shadow-lg rounded p-2 z-[100] min-w-[150px]"
            style={{
              position: "fixed",
              top: filterPosition.top,
              left: filterPosition.left,
              width: filterPosition.width,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {filterType === "text" && (
              <input
                type="text"
                value={draftFilterValue}
                onChange={(e) => handleDraftFilterChange(e.target.value)}
                onBlur={handleFilterBlur}
                placeholder={`Filter ${label.toLowerCase()}...`}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            )}
            {filterType === "number" && (
              <input
                type="number"
                value={draftFilterValue}
                onChange={(e) => handleDraftFilterChange(e.target.value)}
                onBlur={handleFilterBlur}
                placeholder={`Filter ${label.toLowerCase()}...`}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            )}
            {filterType === "select" && filterOptions && (
              <select
                value={draftFilterValue}
                onChange={(e) => handleSelectFilterChange(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              >
                <option value="">All</option>
                {filterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            {hasActiveFilter && (
              <button
                onClick={handleClearFilter}
                className="mt-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
              >
                Clear Filter
              </button>
            )}
          </div>,
          document.body,
        )}
    </th>
  );
}
