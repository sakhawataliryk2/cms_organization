"use client";

import { useState, useCallback, useEffect } from "react";

type OrganizationRecord = {
  id: number;
  name?: string;
  state?: string;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
};
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbGripVertical } from "react-icons/tb";

// Excel-like grid: fixed dimensions
const ROW_LABEL_WIDTH = 190;
const HEADER_HEIGHT = 44;
const CELL_WIDTH = 135;
const ROW_HEIGHT = 40;

const availableHeight = typeof window !== "undefined" ? window.innerHeight - HEADER_HEIGHT * 4.5 : 400;
const DATA_ROW_COUNT = Math.max(5, Math.floor(availableHeight / ROW_HEIGHT));

const TBI_COLUMN_LAYOUT_KEY = "tbi-column-layout";

function loadColumnLayout(viewKey: string, schemaColumns: string[]): string[] {
  if (typeof window === "undefined") return [...schemaColumns];
  try {
    const raw = localStorage.getItem(TBI_COLUMN_LAYOUT_KEY);
    if (!raw) return [...schemaColumns];
    const data = JSON.parse(raw) as Record<string, string[]>;
    const saved = data[viewKey];
    if (!Array.isArray(saved) || saved.length === 0) return [...schemaColumns];
    const schemaSet = new Set(schemaColumns);
    const validOrder = saved.filter((h) => schemaSet.has(h));
    const missing = schemaColumns.filter((h) => !validOrder.includes(h));
    return [...validOrder, ...missing];
  } catch {
    return [...schemaColumns];
  }
}

function saveColumnLayout(viewKey: string, visibleOrder: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(TBI_COLUMN_LAYOUT_KEY);
    const data = (raw ? JSON.parse(raw) : {}) as Record<string, string[]>;
    data[viewKey] = visibleOrder;
    localStorage.setItem(TBI_COLUMN_LAYOUT_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function escapeCsvValue(val: string): string {
  if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function SortableHeaderCell({
  id,
  header,
}: {
  id: string;
  header: string;
}) {
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
    ...(isDragging ? { willChange: "transform" as const } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: CELL_WIDTH, minWidth: CELL_WIDTH, height: HEADER_HEIGHT }}
      className="shrink-0 bg-teal-500 text-white px-3 py-2 border-r border-b border-black flex items-center justify-center font-medium text-sm  shadow-sm gap-1 transition-transform duration-200 ease-out"
    >
      <span className="flex-1 truncate text-center">{header}</span>
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none opacity-80 hover:opacity-100"
        title="Drag to reorder column"
      >
        <TbGripVertical size={16} />
      </span>
    </div>
  );
}

export default function TbiPage() {
  const rowLabels = [
    "Organization",
    "Hiring Manager",
    "Job Seeker",
    "Placements",
    "TimeSheets",
    "Exports",
    "Receivables",
    "Front Office",
  ];

  const columnHeadersMap: Record<string, string[]> = {
    Organization: ["Name", "Oasis Key", "Organization ID", "State"],
    "Hiring Manager": ["Name", "Email", "Status", "Organization", "Hiring Manager", "ID #", "UserName", "Phone", "Title"],
    "Job Seeker": ["Name", "Job Seeker ID", "Approved", "Submitted", "Status", "Payroll Cycle", "Phone Number", "Email", "Address", "Skills"],
    Placements: ["ID #", "JobSeeker", "Organization", "PO #", "Start Date", "End Date", "Placement Status", "Job Title", "Salary", "Fee %", "Notes"],
    TimeSheets: ["Name", "JobSeeker ID", "Approved", "Submitted", "Status", "Payroll Cycle", "Phone Number", "Email", "Week Ending", "Hours"],
    Exports: ["Export Name", "Date", "Type", "Status", "Records", "Created By", "File"],
    Receivables: ["Invoice #", "Organization", "Amount", "Due Date", "Status", "Paid Date", "Notes"],
    "Front Office": ["Name", "Email", "Status", "Organization", "Hiring Manager", "ID #", "UserName", "Phone", "Title"],
  };

  const defaultColumns = [
    "Job Code", "Regular Hours", "Paid Time Off", "On Call", "Expense",
    "Organization", "Personal ID", "Status", "FTE", "TIME", "Type", "Total",
    "Tuesday", "Friday", "Saturday", "Sunday", "Monday", "Time Off", "Vacation", "Sick Time",
  ];

  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const getCurrentColumns = () => {
    if (selectedRow && columnHeadersMap[selectedRow]) return columnHeadersMap[selectedRow];
    return defaultColumns;
  };

  const schemaColumns = getCurrentColumns();
  const viewKey = selectedRow ?? "default";
  const [columnOrder, setColumnOrder] = useState<string[]>(() => [...defaultColumns]);

  // Sync column order when view (sidebar) changes: load from localStorage or use schema default
  useEffect(() => {
    setColumnOrder(loadColumnLayout(viewKey, schemaColumns));
  }, [viewKey]);

  // Persist column layout to localStorage when user changes visibility/order (not on view switch)
  useEffect(() => {
    const visible = columnOrder.filter((h) => schemaColumns.includes(h));
    if (visible.length > 0) saveColumnLayout(viewKey, visible);
  }, [columnOrder]);

  // Visible columns: only those in columnOrder that exist in current schema (keeps order)
  const columnHeaders = columnOrder.filter((h) => schemaColumns.includes(h));
  const columnIds = columnHeaders.map((_, i) => `col-${i}`);

  const toggleColumnVisibility = useCallback((header: string) => {
    setColumnOrder((prev) => {
      const inOrder = prev.filter((h) => schemaColumns.includes(h));
      const isVisible = inOrder.includes(header);
      if (isVisible) {
        if (inOrder.length <= 1) return prev;
        return inOrder.filter((h) => h !== header);
      }
      return [...inOrder, header];
    });
  }, [schemaColumns]);

  const [tbiOrganizations, setTbiOrganizations] = useState<OrganizationRecord[]>([]);
  const [tbiOrgsLoading, setTbiOrgsLoading] = useState(false);
  const [tbiOrgsError, setTbiOrgsError] = useState<string | null>(null);

  const [tbiOrganizationsCache, setTbiOrganizationsCache] = useState<OrganizationRecord[] | null>(null);

  useEffect(() => {
    if (selectedRow !== "Organization") {
      setTbiOrganizations([]);
      return;
    }

    // Use cached data if available
    if (tbiOrganizationsCache) {
      setTbiOrganizations(tbiOrganizationsCache);
      return;
    }

    let cancelled = false;
    setTbiOrgsLoading(true);
    setTbiOrgsError(null);

    fetch("/api/organizations/with-approved-placements")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setTbiOrgsLoading(false);
        if (data?.success && Array.isArray(data.organizations)) {
          setTbiOrganizations(data.organizations);
          setTbiOrganizationsCache(data.organizations); // cache for future
        } else {
          setTbiOrganizations([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setTbiOrgsLoading(false);
        setTbiOrgsError(err?.message || "Failed to load organizations");
        setTbiOrganizations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRow, tbiOrganizationsCache]);


  function getOrgCellValue(org: OrganizationRecord, header: string): string {
    const cf = org.custom_fields as Record<string, string> | undefined;
    switch (header) {
      case "Name":
        return org.name ?? "";
      case "Organization ID":
        return org.id != null ? String(org.id) : "";
      case "Oasis Key":
        return (cf?.["Oasis Key"] ?? cf?.oasis_key ?? "") as string;
      case "State":
        return org.state ?? "";
      default:
        return (cf?.[header] ?? (org as Record<string, string>)[header] ?? "") as string;
    }
  }

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columnIds.indexOf(String(active.id));
    const newIndex = columnIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setColumnOrder((prev) => arrayMove(prev, oldIndex, newIndex));
  }, [columnIds]);

  const handleRowClick = (rowLabel: string) => setSelectedRow(rowLabel);

  const toggleDataRow = useCallback((rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }, []);

  const exportSelectedAsCsv = useCallback(() => {
    const headers = columnHeaders;
    const headerLine = headers.map(escapeCsvValue).join(",");
    const sortedRows = Array.from(selectedRows).sort((a, b) => a - b);
    const dataLines = sortedRows.map((rowIndex) => {
      if (selectedRow === "Organization" && tbiOrganizations[rowIndex]) {
        return headers
          .map((h) => escapeCsvValue(getOrgCellValue(tbiOrganizations[rowIndex], h)))
          .join(",");
      }
      return headers.map(() => "").join(",");
    });
    const csv = [headerLine, ...dataLines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tbi-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [columnHeaders, selectedRows, selectedRow, tbiOrganizations]);

  const containerWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const totalColumns = columnHeaders.length;
  const extraCellCount = Math.max(0, Math.floor(containerWidth / CELL_WIDTH) - totalColumns);
  const selectionCount = selectedRows.size;

  return (
    <div
      className="flex flex-col bg-gray-50 -mx-3 -mb-4 -ml-3 md:-mx-6 md:-mb-6 md:-ml-6"
      style={{
        height: "calc(100vh - var(--dashboard-top-offset, 48px) - 1rem)",
        minHeight: 0,
      }}
    >
      {/* Top Header Bar */}
      <div className="shrink-0 bg-gray-700 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Grade Building System</h1>
          <span className="text-sm text-gray-300">v 1.0</span>
          <span className="text-sm text-gray-300">v 1.1</span>
        </div>
        <div className="flex items-center gap-3 relative">
          {selectionCount > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
              >
                {selectionCount} Selected
              </button>
              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[160px]">
                    <button
                      type="button"
                      onClick={exportSelectedAsCsv}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export as CSV
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowColumnsMenu(true)}
            className="bg-white hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
            Columns
          </button>
          <button className="bg-white hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
            Menu
          </button>
        </div>
      </div>

      {/* Sidebar (fixed) + Grid (scrollable) - Excel-like */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: fixed sidebar - row labels only for switching data */}
        <div
          className="shrink-0 flex flex-col border-r-2 border-black bg-gray-100"
          style={{ width: ROW_LABEL_WIDTH, minWidth: ROW_LABEL_WIDTH }}
        >
          {/* Corner cell above row labels */}
          <div
            className="shrink-0 bg-gray-700 border-b-2 border-black"
            style={{ height: HEADER_HEIGHT }}
          />
          {rowLabels.map((rowLabel, rowIndex) => {
            const isSelected = selectedRow === rowLabel;
            return (
              <button
                key={rowLabel}
                type="button"
                onClick={() => handleRowClick(rowLabel)}
                className={`shrink-0 px-3 py-2 border-b border-black flex items-center justify-center font-medium text-sm cursor-pointer transition-colors shadow-sm text-center ${isSelected ? "bg-teal-600 text-white" : "bg-teal-500 text-white hover:bg-teal-600"
                  }`}
                style={{ height: ROW_HEIGHT }}
              >
                {rowLabel}
              </button>
            );
          })}
          {/* Fill remaining sidebar space so it doesn't stretch buttons */}
          <div className="flex-1 min-h-0 bg-gray-100 border-b border-black" />
        </div>

        {/* Right: scrollable grid - column headers + many data rows */}
        <div className="flex-1 min-w-0 overflow-auto bg-white">
          <div className="inline-block min-w-full min-h-full">
            {/* Sticky column headers row – draggable to reorder */}
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
              modifiers={[restrictToHorizontalAxis]}
            >
              <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                <div className="flex sticky top-0 z-20">
                  <div className="shrink-0 bg-teal-500 text-white px-3 py-2 border-r border-b border-black flex items-center justify-center font-medium text-sm  shadow-sm gap-1 transition-transform duration-200 ease-out" style={{ width: 30, minWidth: 30, height: HEADER_HEIGHT }}>
                    #
                  </div>
                  {columnHeaders.map((header, index) => (
                    <SortableHeaderCell
                      key={columnIds[index]}
                      id={columnIds[index]}
                      header={header}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>



            {/* Many data rows - clickable and selectable; Organization view shows orgs with approved placements */}
            {tbiOrgsLoading && selectedRow === "Organization" && (
              <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                Loading...
              </div>
            )}
            {tbiOrgsError && selectedRow === "Organization" && (
              <div className="flex items-center justify-center py-4 text-red-600 text-sm">
                {tbiOrgsError}
              </div>
            )}

            {!tbiOrgsLoading && Array.from({ length: DATA_ROW_COUNT }, (_, rowIndex) => {
              const isRowSelected = selectedRows.has(rowIndex);
              const org = selectedRow === "Organization" ? tbiOrganizations[rowIndex] : null;
              return (
                <div key={rowIndex} className="flex">
                  <div className="shrink-0 bg-teal-500 text-white px-3 py-2 border-r border-b border-black flex items-center justify-center font-medium text-sm  shadow-sm gap-1 transition-transform duration-200 ease-out" style={{ width: 30, minWidth: 30, height: ROW_HEIGHT }}>
                    {rowIndex + 1}
                  </div>
                  {columnHeaders.map((header, colIndex) => {
                    const cellValue = org ? getOrgCellValue(org, header) : "";
                    return (
                      <button
                        type="button"
                        key={colIndex}
                        onClick={() => toggleDataRow(rowIndex)}
                        className={`shrink-0 border-r border-b border-gray-400 flex items-center justify-center text-sm cursor-pointer transition-colors select-none text-left px-1 ${isRowSelected
                          ? "bg-teal-200 ring-1 ring-teal-500"
                          : rowIndex % 2 === 0
                            ? "bg-white hover:bg-gray-100"
                            : "bg-gray-50 hover:bg-gray-100"
                          }`}
                        style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, height: ROW_HEIGHT }}
                      >
                        <span className="truncate w-full text-center">{cellValue || "\u00A0"}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Columns modal – select which columns to show; layout saved to localStorage */}
      {showColumnsMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowColumnsMenu(false)}
        >
          <div
            className="bg-white rounded-sm shadow-xl max-w-md w-full mx-4 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Columns</h3>
              <button
                type="button"
                onClick={() => setShowColumnsMenu(false)}
                className="p-1 rounded hover:bg-gray-200 text-gray-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <p className="px-4 pt-2 pb-1 text-sm text-gray-500 shrink-0">
              Show or hide columns for this view. Your choices are saved automatically.
            </p>
            <div className="overflow-y-auto flex-1 min-h-0 py-2">
              {schemaColumns.map((header) => {
                const isVisible = columnHeaders.includes(header);
                return (
                  <label
                    key={header}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleColumnVisibility(header)}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="truncate">{header}</span>
                  </label>
                );
              })}
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowColumnsMenu(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
