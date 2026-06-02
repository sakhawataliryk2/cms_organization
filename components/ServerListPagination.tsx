"use client";

type ServerListPaginationProps = {
  entityLabel: string;
  currentPage: number;
  pageSize: number;
  itemsOnPage: number;
  totalCount: number | null;
  totalPages: number | null;
  pageSizeOptions: readonly number[];
  canGoPrev: boolean;
  canGoNext: boolean;
  paginationItems: (number | "...")[];
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export default function ServerListPagination({
  entityLabel,
  currentPage,
  pageSize,
  itemsOnPage,
  totalCount,
  totalPages,
  pageSizeOptions,
  canGoPrev,
  canGoNext,
  paginationItems,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: ServerListPaginationProps) {
  const showingFrom =
    totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = (currentPage - 1) * pageSize + itemsOnPage;

  return (
    <div className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 sm:px-6 overflow-x-auto min-w-0">
      <div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading results…</p>
        ) : (
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{showingFrom}</span> to{" "}
            <span className="font-medium">{showingTo}</span> of{" "}
            {totalCount != null ? (
              <span className="font-medium">{totalCount}</span>
            ) : (
              <span className="font-medium">{itemsOnPage}</span>
            )}{" "}
            {entityLabel}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={`${entityLabel}-page-size`} className="text-sm text-gray-600">
          Rows per page
        </label>
        <select
          id={`${entityLabel}-page-size`}
          value={pageSize}
          disabled={isLoading}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={!canGoPrev}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          First
        </button>
        <button
          type="button"
          onClick={() => canGoPrev && onPageChange(Math.max(1, currentPage - 1))}
          disabled={!canGoPrev}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
        >
          <span aria-hidden="true">‹</span>
          Previous
        </button>
        <div className="flex items-center gap-1">
          {paginationItems.map((item, idx) =>
            item === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1 text-sm text-gray-500 select-none"
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                disabled={isLoading || item === currentPage}
                className={`min-w-[2.4rem] px-3 py-1.5 border rounded text-sm font-medium transition-colors ${
                  item === currentPage
                    ? "border-gray-300 bg-white text-gray-900 shadow-sm"
                    : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50"
                } disabled:cursor-not-allowed`}
                aria-current={item === currentPage ? "page" : undefined}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          onClick={() => canGoNext && onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
        >
          Next
          <span aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          onClick={() => totalPages != null && onPageChange(totalPages)}
          disabled={totalPages == null || !canGoNext}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Last
        </button>
      </div>
    </div>
  );
}
