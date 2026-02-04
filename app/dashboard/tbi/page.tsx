"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

type OrganizationRecord = {
  id: number;
  name?: string;
  state?: string;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
};

type PlacementRecord = {
  id: number;
  jobSeekerId?: number;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  jobSeekerName?: string;
  jobSeekerEmail?: string | null;
  jobSeekerPhone?: string | null;
  jobTitle?: string | null;
  organizationName?: string | null;
  [key: string]: unknown;
};
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbGripVertical, TbBinoculars } from "react-icons/tb";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import OrganizationDetailPanel from "./OrganizationDetailPanel";

type TimePeriodType = "week" | "customRange" | "all";

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

function getWeekEnd(monday: Date): Date {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  return end;
}

function formatDateRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })} to ${end.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}`;
}

function isDateInRange(d: Date, start: Date, end: Date): boolean {
  const t = d.getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return t >= s && t <= e;
}

type TimesheetRow = {
  id: number;
  [key: string]: string | number | undefined;
};

function placementToTimesheetRow(p: PlacementRecord): TimesheetRow {
  const row: TimesheetRow = {
    id: p.id,
    "Placement Number": String(p.id),
    Organization: p.organizationName ?? "",
    "Job Seeker": p.jobSeekerName ?? "",
    "Regular Pay": "",
    "Overtime Pay": "",
    PTO: "",
    "Timesheet Type": "",
    "Regular Hours": "",
    "Overtime Hours": "",
    "PTO Hours": "",
    "Bill Regular Hours": "",
    "Bill Overtime Hours": "",
    "End Date": p.endDate ?? "",
    Status: p.status ?? "",
    "Worker Comp Code": "",
    "Job Title": p.jobTitle ?? "",
    "PO Number": "",
    "Deduction Code": "",
    "Deduction Amount": "",
    State: "",
    "Pay Double Time": "",
    "Time Card Approver(s)": "",
    "Bill Double Time": "",
    "Double time": "",
    Expenses: "",
    "Approved By": "",
    "Time Card": "",
    "Score Card": "",
  };
  return row;
}

const TIMESHEETS_TABLE_COLUMNS_LIST = [
  "Placement Number",
  "Organization",
  "Job Seeker",
  "Regular Pay",
  "Overtime Pay",
  "PTO",
  "Timesheet Type",
  "Regular Hours",
  "Overtime Hours",
  "PTO Hours",
  "Bill Regular Hours",
  "Bill Overtime Hours",
  "End Date",
  "Status",
  "Worker Comp Code",
  "Job Title",
  "PO Number",
  "Deduction Code",
  "Deduction Amount",
  "State",
  "Pay Double Time",
  "Time Card Approver(s)",
  "Bill Double Time",
  "Double time",
  "Expenses",
  "Approved By",
  "Time Card",
  "Score Card",
] as const;

// Excel-like grid: fixed dimensions
const ROW_LABEL_WIDTH = 190;
const HEADER_HEIGHT = 44;
const CELL_WIDTH = 135;
const ROW_HEIGHT = 40;
const ACTIONS_CELL_WIDTH = 80;

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
  ];

  const columnHeadersMap: Record<string, string[]> = {
    Organization: ["Name", "Oasis Key", "Organization ID", "State"],
    "Hiring Manager": ["Name", "Organization", "Email", "Organization", "Status", "ID Number"],
    "Job Seeker": ["Name", "Submitted", "Approved", "ID Number", "Payroll Type", "State", "Status"],
    Placements: [
      "Timesheet week start",
      "Job Seeker",
      "Organization",
      "Status of Placement",
      "Worker Comp Code",
      "Placement ID",
      "Start Date",
      "End Date",
      "Job Title",
      "Timesheet Hour entry",
      "State",
      "Pay Rate",
      "Bill Rate",
      "Primary Approver",
      "Job Seeker Email"
    ],
    TimeSheets: ["Name", "JobSeeker ID", "Approved", "Submitted", "Status", "Payroll Cycle", "Phone Number", "Email", "Week Ending", "Hours"],
    Exports: ["Documents", "ID Number", "Date Exported", "Report Name", "Status"],
    Receivables: ["Invoice #", "Organization", "Amount", "Due Date", "Status", "Paid Date", "Notes"],
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
  const [detailOrganization, setDetailOrganization] = useState<OrganizationRecord | null>(null);

  // TimeSheets layout state
  const [timePeriod, setTimePeriod] = useState<TimePeriodType>("week");
  const [timesheetsWeekStart, setTimesheetsWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [timesheetsCalendarMonth, setTimesheetsCalendarMonth] = useState<Date>(() => new Date());
  const [timesheetsSearchTerm, setTimesheetsSearchTerm] = useState("");
  const [timesheetsSelectedIds, setTimesheetsSelectedIds] = useState<Set<number>>(new Set());
  const timesheetsWeekEnd = useMemo(() => getWeekEnd(timesheetsWeekStart), [timesheetsWeekStart]);
  const timesheetsDateRangeLabel = useMemo(
    () => formatDateRange(timesheetsWeekStart, timesheetsWeekEnd),
    [timesheetsWeekStart, timesheetsWeekEnd]
  );

  const [timesheetsPlacements, setTimesheetsPlacements] = useState<PlacementRecord[]>([]);
  const [timesheetsLoading, setTimesheetsLoading] = useState(false);
  const [timesheetsError, setTimesheetsError] = useState<string | null>(null);

  // Each row = one approved contract placement whose schedule end date is on or before the selected calendar range
  const timesheetsRows = useMemo(() => {
    const approved = timesheetsPlacements.filter(
      (p) => (p.status || "").toLowerCase() === "approved"
    );
    let byDate: PlacementRecord[] = approved;
    if (timePeriod === "week") {
      const rangeEnd = timesheetsWeekEnd.getTime();
      byDate = approved.filter((p) => {
        const end = p.endDate;
        if (!end) return true; // no end date = include (e.g. ongoing)
        const endTime = new Date(end).getTime();
        return endTime <= rangeEnd;
      });
    }
    if (timePeriod === "customRange") {
      const rangeEnd = timesheetsWeekEnd.getTime();
      byDate = approved.filter((p) => {
        const end = p.endDate;
        if (!end) return true;
        return new Date(end).getTime() <= rangeEnd;
      });
    }
    const term = timesheetsSearchTerm.trim().toLowerCase();
    if (!term) return byDate.map(placementToTimesheetRow);
    return byDate
      .filter((p) => {
        const name = (p.jobSeekerName || "").toLowerCase();
        const id = String(p.jobSeekerId ?? p.id ?? "").toLowerCase();
        const email = (p.jobSeekerEmail || "").toLowerCase();
        const title = (p.jobTitle || "").toLowerCase();
        return name.includes(term) || id.includes(term) || email.includes(term) || title.includes(term);
      })
      .map(placementToTimesheetRow);
  }, [timesheetsPlacements, timePeriod, timesheetsWeekEnd, timesheetsSearchTerm]);

  const timesheetsCalendarDays = useMemo(() => {
    const year = timesheetsCalendarMonth.getFullYear();
    const month = timesheetsCalendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const firstWeekday = (first.getDay() + 6) % 7;
    const days: { date: Date; isCurrentMonth: boolean; isInWeek: boolean }[] = [];
    const startOffset = firstWeekday;
    const totalCells = 42;
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(year, month, i - startOffset + 1);
      const isCurrentMonth = d.getMonth() === month;
      days.push({
        date: d,
        isCurrentMonth,
        isInWeek: isDateInRange(d, timesheetsWeekStart, timesheetsWeekEnd),
      });
    }
    return days;
  }, [timesheetsCalendarMonth, timesheetsWeekStart, timesheetsWeekEnd]);

  const toggleTimesheetsSelectAll = useCallback(() => {
    if (timesheetsSelectedIds.size >= timesheetsRows.length) {
      setTimesheetsSelectedIds(new Set());
    } else {
      setTimesheetsSelectedIds(new Set(timesheetsRows.map((r) => r.id)));
    }
  }, [timesheetsRows, timesheetsSelectedIds.size]);

  const toggleTimesheetsRow = useCallback((id: number) => {
    setTimesheetsSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [timesheetsColumnOrder, setTimesheetsColumnOrder] = useState<string[]>(() => [...TIMESHEETS_TABLE_COLUMNS_LIST]);

  useEffect(() => {
    if (selectedRow === "TimeSheets") {
      setTimesheetsColumnOrder(loadColumnLayout("TimeSheets", [...TIMESHEETS_TABLE_COLUMNS_LIST]));
    }
  }, [selectedRow]);

  useEffect(() => {
    if (timesheetsColumnOrder.length > 0) {
      saveColumnLayout("TimeSheets", timesheetsColumnOrder);
    }
  }, [timesheetsColumnOrder]);

  const handleTimeSheetsColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = timesheetsColumnOrder.indexOf(String(active.id));
    const newIndex = timesheetsColumnOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setTimesheetsColumnOrder((prev) => arrayMove(prev, oldIndex, newIndex));
  }, [timesheetsColumnOrder]);

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

  useEffect(() => {
    if (selectedRow !== "TimeSheets") {
      setTimesheetsPlacements([]);
      return;
    }
    let cancelled = false;
    setTimesheetsLoading(true);
    setTimesheetsError(null);
    fetch("/api/placements")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setTimesheetsLoading(false);
        if (data?.placements && Array.isArray(data.placements)) {
          setTimesheetsPlacements(
            data.placements.map((p: Record<string, unknown>) => ({
              id: Number(p.id),
              jobSeekerId: p.jobSeekerId != null ? Number(p.jobSeekerId) : undefined,
              status: typeof p.status === "string" ? p.status : undefined,
              startDate: p.startDate ?? p.start_date ?? undefined,
              endDate: p.endDate ?? p.end_date ?? undefined,
              jobSeekerName: p.jobSeekerName ?? p.job_seeker_name ?? undefined,
              jobSeekerEmail: p.jobSeekerEmail ?? p.job_seeker_email ?? undefined,
              jobSeekerPhone: p.jobSeekerPhone ?? p.job_seeker_phone ?? undefined,
              jobTitle: p.jobTitle ?? p.job_title ?? undefined,
              organizationName: p.organizationName ?? p.organization_name ?? undefined,
            }))
          );
        } else {
          setTimesheetsPlacements([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setTimesheetsLoading(false);
        setTimesheetsError(err?.message || "Failed to load placements");
        setTimesheetsPlacements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRow]);

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
        return (cf?.["State"] ?? "") as string;
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
  const fixedGridWidth = 30 + ACTIONS_CELL_WIDTH; // # column + Actions column
  const gridAreaWidth = containerWidth - ROW_LABEL_WIDTH;
  const columnsToFill = Math.floor((gridAreaWidth - fixedGridWidth) / CELL_WIDTH);
  const extraCellCount = Math.max(0, columnsToFill - totalColumns);
  const timesheetsExtraCellCount = Math.max(0, columnsToFill - timesheetsColumnOrder.length);
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
      <div className="shrink-0 bg-gray-700 text-white px-6 py-4 flex justify-end items-center shadow-md">
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
        </div>
      </div>

      {/* Sidebar (fixed) + Grid (scrollable) - Excel-like */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: fixed sidebar - row labels align with grid rows (no corner cell) */}
        <div
          className="shrink-0 flex flex-col border-r-2 border-black bg-gray-100"
          style={{ width: ROW_LABEL_WIDTH, minWidth: ROW_LABEL_WIDTH }}
        >
          <div className="flex-1 min-h-0 flex flex-col">
            {rowLabels.map((rowLabel) => {
              const isSelected = selectedRow === rowLabel;
              return (
                <button
                  key={rowLabel}
                  type="button"
                  onClick={() => handleRowClick(rowLabel)}
                  className={`flex-1 min-h-0 px-3 py-2 border-b border-black flex items-center justify-center font-medium text-sm cursor-pointer transition-colors shadow-sm text-center ${isSelected ? "bg-green-600 text-white" : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                >
                  {rowLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: TimeSheets layout (filter+calendar + table) or default grid */}
        {selectedRow === "TimeSheets" ? (
          <div className="flex-1 min-w-0 flex overflow-hidden">
            {/* TimeSheets left panel: filter, time period, calendar */}
            <div
              className="shrink-0 flex flex-col border-r border-gray-200 bg-gray-50 overflow-y-auto"
              style={{ width: 280, minWidth: 280 }}
            >
              <div className="p-4 border-b border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter Timesheets</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter Timesheets..."
                    value={timesheetsSearchTerm}
                    onChange={(e) => setTimesheetsSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="p-4 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2">SELECT TIME PERIOD BY</div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setTimePeriod("week")}
                    className={`px-3 py-2 text-sm font-medium rounded text-left ${timePeriod === "week" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimePeriod("customRange")}
                    className={`px-3 py-2 text-sm font-medium rounded text-left ${timePeriod === "customRange" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Custom Range
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimePeriod("all")}
                    className={`px-3 py-2 text-sm font-medium rounded text-left ${timePeriod === "all" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  >
                    All
                  </button>
                </div>
              </div>
              {timePeriod === "week" && (
                <>
                  <div className="px-4 pb-2 text-sm text-gray-600">
                    {timesheetsDateRangeLabel}
                  </div>
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">
                        {timesheetsCalendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setTimesheetsCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                          className="p-1 rounded hover:bg-gray-200 text-gray-600"
                          aria-label="Previous month"
                        >
                          <FiChevronLeft size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimesheetsCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                          className="p-1 rounded hover:bg-gray-200 text-gray-600"
                          aria-label="Next month"
                        >
                          <FiChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                      {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
                        <div key={day} className="py-1 font-medium text-gray-500">
                          {day}
                        </div>
                      ))}
                      {timesheetsCalendarDays.map((cell, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const mon = getMonday(cell.date);
                            setTimesheetsWeekStart(mon);
                          }}
                          className={`py-1.5 rounded text-sm ${
                            !cell.isCurrentMonth ? "text-gray-300" : cell.isInWeek ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {cell.date.getDate()}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* TimeSheets grid – same design as Organization: #, Actions, sortable column headers, data rows */}
            <div className="flex-1 min-w-0 overflow-auto bg-white">
              {timesheetsError && (
                <div className="px-4 py-2 text-sm text-red-600 shrink-0">{timesheetsError}</div>
              )}
              {timesheetsLoading && (
                <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                  Loading placements...
                </div>
              )}
              {!timesheetsLoading && (
                <div className="inline-block min-w-full min-h-full">
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={handleTimeSheetsColumnDragEnd}
                    modifiers={[restrictToHorizontalAxis]}
                  >
                    <SortableContext items={timesheetsColumnOrder} strategy={horizontalListSortingStrategy}>
                      <div className="flex sticky top-0 z-20">
                        <div className="shrink-0 bg-teal-500 text-white px-3 py-2 border-r border-b border-black flex items-center justify-center font-medium text-sm shadow-sm gap-1 transition-transform duration-200 ease-out" style={{ width: 30, minWidth: 30, height: HEADER_HEIGHT }}>
                          #
                        </div>
                        <div
                          className="shrink-0 bg-teal-500 text-white px-2 py-2 border-r border-b border-black flex items-center justify-center font-medium text-sm shadow-sm"
                          style={{ width: ACTIONS_CELL_WIDTH, minWidth: ACTIONS_CELL_WIDTH, height: HEADER_HEIGHT }}
                        >
                          Actions
                        </div>
                        {timesheetsColumnOrder.map((header) => (
                          <SortableHeaderCell key={header} id={header} header={header} />
                        ))}
                        {Array.from({ length: timesheetsExtraCellCount }, (_, i) => (
                          <div
                            key={`ts-empty-h-${i}`}
                            className="shrink-0 bg-teal-500 text-white border-r border-b border-black"
                            style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, height: HEADER_HEIGHT }}
                            aria-hidden
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {timesheetsRows.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-sm text-gray-500 px-4">
                      {timesheetsPlacements.length === 0
                        ? "No placements loaded."
                        : "No approved contract placements with schedule end date on or before the selected period."}
                    </div>
                  ) : (
                    timesheetsRows.map((row, rowIndex) => {
                      const isRowSelected = timesheetsSelectedIds.has(row.id);
                      return (
                        <div key={row.id} className="flex">
                          <div className="shrink-0 bg-teal-500 text-white px-3 py-2 border-r border-b border-black flex items-center justify-center font-medium text-sm shadow-sm gap-1 transition-transform duration-200 ease-out" style={{ width: 30, minWidth: 30, height: ROW_HEIGHT }}>
                            {rowIndex + 1}
                          </div>
                          <div
                            className={`shrink-0 border-r border-b border-gray-400 flex items-center justify-center gap-1.5 ${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                            style={{ width: ACTIONS_CELL_WIDTH, minWidth: ACTIONS_CELL_WIDTH, height: ROW_HEIGHT }}
                          >
                            <span className="p-1.5 shrink-0 inline-flex items-center justify-center text-gray-300" aria-hidden><TbBinoculars size={20} /></span>
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={() => toggleTimesheetsRow(row.id)}
                              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0"
                              aria-label={`Select row ${rowIndex + 1}`}
                            />
                          </div>
                          {timesheetsColumnOrder.map((col) => (
                            <div
                              key={col}
                              className={`shrink-0 border-r border-b border-gray-400 flex items-center justify-center text-sm select-none text-left px-1 ${isRowSelected ? "bg-teal-200 ring-1 ring-teal-500" : rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                              style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, height: ROW_HEIGHT }}
                            >
                              <span className="truncate w-full text-center">{String(row[col] ?? "") || "\u00A0"}</span>
                            </div>
                          ))}
                          {Array.from({ length: timesheetsExtraCellCount }, (_, i) => (
                            <div
                              key={`ts-empty-${row.id}-${i}`}
                              className={`shrink-0 border-r border-b border-gray-400 ${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                              style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, height: ROW_HEIGHT }}
                              aria-hidden
                            />
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
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
                  <div
                    className="shrink-0 bg-teal-500 text-white px-2 py-2 border-r border-b border-black flex items-center justify-center font-medium text-sm shadow-sm"
                    style={{ width: ACTIONS_CELL_WIDTH, minWidth: ACTIONS_CELL_WIDTH, height: HEADER_HEIGHT }}
                  >
                    Actions
                  </div>
                  {columnHeaders.map((header, index) => (
                    <SortableHeaderCell
                      key={columnIds[index]}
                      id={columnIds[index]}
                      header={header}
                    />
                  ))}
                  {Array.from({ length: extraCellCount }, (_, i) => (
                    <div
                      key={`empty-h-${i}`}
                      className="shrink-0 bg-teal-500 text-white border-r border-b border-black"
                      style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, height: HEADER_HEIGHT }}
                      aria-hidden
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
                  <div
                    className={`shrink-0 border-r border-b border-gray-400 flex items-center justify-center gap-1.5 ${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    style={{ width: ACTIONS_CELL_WIDTH, minWidth: ACTIONS_CELL_WIDTH, height: ROW_HEIGHT }}
                  >
                    {selectedRow === "Organization" && org ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailOrganization(org);
                        }}
                        className="p-1.5 rounded text-gray-600 hover:bg-teal-100 hover:text-teal-700 transition-colors shrink-0 inline-flex items-center justify-center"
                        title="View details"
                        aria-label="View organization details"
                      >
                        <TbBinoculars size={20} />
                      </button>
                    ) : (
                      <span className="p-1.5 shrink-0 inline-flex items-center justify-center text-gray-300" aria-hidden><TbBinoculars size={20} /></span>
                    )}
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => toggleDataRow(rowIndex)}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0"
                      aria-label={`Select row ${rowIndex + 1}`}
                    />
                  </div>
                  {columnHeaders.map((header, colIndex) => {
                    const cellValue = org ? getOrgCellValue(org, header) : "";
                    return (
                      <div
                        key={colIndex}
                        className={`shrink-0 border-r border-b border-gray-400 flex items-center justify-center text-sm select-none text-left px-1 ${isRowSelected
                          ? "bg-teal-200 ring-1 ring-teal-500"
                          : rowIndex % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50"
                          }`}
                        style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, height: ROW_HEIGHT }}
                      >
                        <span className="truncate w-full text-center">{cellValue || "\u00A0"}</span>
                      </div>
                    );
                  })}
                  {Array.from({ length: extraCellCount }, (_, i) => (
                    <div
                      key={`empty-${rowIndex}-${i}`}
                      className={`shrink-0 border-r border-b border-gray-400 ${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                      style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH, height: ROW_HEIGHT }}
                      aria-hidden
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {/* Organization detail panel – slide-over from right */}
      {detailOrganization && (
        <OrganizationDetailPanel
          organization={detailOrganization}
          onClose={() => setDetailOrganization(null)}
          onSave={() => {}}
          onDelete={() => {}}
        />
      )}

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
