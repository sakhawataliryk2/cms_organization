"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FiArrowUp, FiArrowDown, FiFilter, FiX } from "react-icons/fi";
import { TbGripVertical } from "react-icons/tb";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type OrganizationRecord = {
  id: number;
  name?: string;
  state?: string;
  contact_phone?: string;
  address?: string;
  address2?: string;
  city?: string;
  zip_code?: string;
  custom_fields?: Record<string, unknown>;
  placements?: PlacementRecord[];
  [key: string]: unknown;
};

type TabId = "edit" | "placements" | "audit" | "billing";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type PlacementRecord = {
  id: number | string;
  approver?: string;
  candidate?: string;
  title?: string;
  status?: string;
  createdByName?: string;
  jobSeekerName?: string;
  jobTitle?: string;
  startDate?: string;
  endDate?: string | null;
  [key: string]: unknown;
};

function toPlacementRecord(item: unknown): PlacementRecord | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const rawId =
    raw.id ??
    raw.placementId ??
    raw.placement_id ??
    raw.jobPlacementId ??
    raw.job_placement_id ??
    raw.assignmentId ??
    raw.assignment_id ??
    null;

  const fallbackParts = [
    raw.organizationId ?? raw.organization_id,
    raw.jobId ?? raw.job_id,
    raw.jobSeekerId ?? raw.job_seeker_id,
    raw.startDate ?? raw.start_date,
  ]
    .map((value) => (value == null ? "" : String(value)))
    .filter(Boolean);
  const fallbackId =
    fallbackParts.length > 0
      ? fallbackParts.join("-")
      : `placement-${Math.random().toString(36).slice(2, 10)}`;

  const createdByName =
    (raw.createdByName as string | undefined) ??
    (raw.created_by_name as string | undefined) ??
    (raw.approver as string | undefined);
  const jobSeekerName =
    (raw.jobSeekerName as string | undefined) ??
    (raw.job_seeker_name as string | undefined) ??
    (raw.candidate as string | undefined);
  const jobTitle =
    (raw.jobTitle as string | undefined) ??
    (raw.job_title as string | undefined) ??
    (raw.title as string | undefined);
  const status =
    (raw.status as string | undefined) ??
    (raw.placementStatus as string | undefined) ??
    (raw.placement_status as string | undefined);

  return {
    id: (rawId as number | string | null) ?? fallbackId,
    approver:
      (raw.approver as string | undefined) ??
      createdByName ??
      (typeof raw.createdBy === "string" ? raw.createdBy : undefined),
    candidate: (raw.candidate as string | undefined) ?? jobSeekerName,
    title: (raw.title as string | undefined) ?? jobTitle,
    status,
    createdByName,
    jobSeekerName,
    jobTitle,
    startDate:
      (raw.startDate as string | undefined) ??
      (raw.start_date as string | undefined) ??
      undefined,
    endDate:
      (raw.endDate as string | undefined) ??
      (raw.end_date as string | null | undefined) ??
      undefined,
  };
}

function normalizePlacementRecords(input: unknown[]): PlacementRecord[] {
  return input
    .map(toPlacementRecord)
    .filter((record): record is PlacementRecord => record !== null);
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

const PLACEMENT_COLUMNS = [
  { key: "approver", label: "Approver", filterType: "text" as const },
  { key: "candidate", label: "Candidate", filterType: "text" as const },
  { key: "title", label: "Title", filterType: "text" as const },
  { key: "status", label: "Status", filterType: "select" as const },
] as const;

const PLACEMENT_COLUMN_KEYS = PLACEMENT_COLUMNS.map((c) => c.key);
const PLACEMENT_COLUMN_MAP = Object.fromEntries(PLACEMENT_COLUMNS.map((c) => [c.key, c]));

function PlacementColumnHeader({
  id,
  columnKey,
  label,
  sortState,
  filterValue,
  onSort,
  onFilterChange,
  filterType,
  filterOptions,
}: {
  id: string;
  columnKey: string;
  label: string;
  sortState: ColumnSortState;
  filterValue: ColumnFilterState;
  onSort: () => void;
  onFilterChange: (value: string) => void;
  filterType: "text" | "select";
  filterOptions?: { label: string; value: string }[];
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
  };

  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const thRef = useRef<HTMLTableCellElement | null>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!showFilter || !filterToggleRef.current || !thRef.current) {
      setFilterPosition(null);
      return;
    }
    const btnRect = filterToggleRef.current.getBoundingClientRect();
    const thRect = thRef.current.getBoundingClientRect();
    setFilterPosition({
      top: btnRect.bottom + 4,
      left: thRect.left,
      width: Math.max(150, Math.min(250, thRect.width)),
    });
  }, [showFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(`[data-filter-toggle="${columnKey}"]`)
      ) {
        setShowFilter(false);
      }
    };
    if (showFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilter, columnKey]);

  return (
    <th
      ref={(node) => {
        thRef.current = node;
        setNodeRef(node);
      }}
      style={style}
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-r border-gray-200 relative group"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={16} />
        </button>
        <span className="flex-1">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSort();
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title={sortState === "asc" ? "Sort descending" : "Sort ascending"}
        >
          {sortState === "asc" ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
        </button>
        <button
          ref={filterToggleRef}
          type="button"
          data-filter-toggle={columnKey}
          onClick={(e) => {
            e.stopPropagation();
            setShowFilter(!showFilter);
          }}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${filterValue ? "text-blue-600" : ""}`}
          title="Filter column"
        >
          <FiFilter size={14} />
        </button>
      </div>
      {showFilter && filterPosition && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={filterRef}
            className="bg-white border border-gray-300 shadow-lg rounded p-2 z-100 min-w-[150px]"
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
                value={filterValue || ""}
                onChange={(e) => onFilterChange(e.target.value)}
                placeholder={`Filter ${label.toLowerCase()}...`}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            )}
            {filterType === "select" && filterOptions && (
              <select
                value={filterValue || ""}
                onChange={(e) => onFilterChange(e.target.value)}
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
            {filterValue && (
              <button
                type="button"
                onClick={() => {
                  onFilterChange("");
                  setShowFilter(false);
                }}
                className="mt-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
              >
                Clear Filter
              </button>
            )}
          </div>,
          document.body
        )}
    </th>
  );
}

function getCf(org: OrganizationRecord, key: string): string {
  const cf = org.custom_fields as Record<string, string> | undefined;
  if (!cf) return "";
  return (cf[key] ?? (org as Record<string, string>)[key] ?? "") as string;
}

type Props = {
  organization: OrganizationRecord;
  onClose: () => void;
  onSave?: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
};

export default function OrganizationDetailPanel({ organization, onClose, onSave, onDelete }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("edit");

  const companyName = organization.name ?? "";
  const phone = organization.contact_phone ?? getCf(organization, "Phone") ?? "";
  const integrationId = getCf(organization, "Integration ID") || String(organization.id ?? "");
  const contractTermsNet = getCf(organization, "Contract TERMS NET") || "30";
  const permTermsNet = getCf(organization, "Perm TERMS NET") || "30";
  const address = organization.address ?? getCf(organization, "Address") ?? "";
  const address2 = organization.address2 ?? getCf(organization, "Address 2") ?? "";
  const city = organization.city ?? getCf(organization, "City") ?? "";
  const stateProvince = organization.state ?? getCf(organization, "State") ?? "";
  const zipPostal = organization.zip_code ?? getCf(organization, "ZIP") ?? "";
  const country = getCf(organization, "Country") || "United States";
  const startDayOfWeek = getCf(organization, "Start Day of Week") || "Monday";
  const iasisKey = getCf(organization, "Oasis Key") ?? getCf(organization, "IASIS KEY") ?? "";

  const [form, setForm] = useState({
    companyName,
    phone,
    integrationId,
    contractTermsNet,
    permTermsNet,
    address,
    address2,
    city,
    stateProvince,
    zipPostal,
    country,
    startDayOfWeek,
    iasisKey,
  });

  const [placementsData, setPlacementsData] = useState<PlacementRecord[]>(() =>
    normalizePlacementRecords(
      Array.isArray(organization.placements)
        ? (organization.placements as unknown[])
        : []
    )
  );
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [placementsSearchTerm, setPlacementsSearchTerm] = useState("");
  const [placementsColumnSorts, setPlacementsColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [placementsColumnFilters, setPlacementsColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [placementsColumnOrder, setPlacementsColumnOrder] = useState<string[]>(() => [...PLACEMENT_COLUMN_KEYS]);
  const [placementsPageSize, setPlacementsPageSize] = useState(25);
  const [placementsPage, setPlacementsPage] = useState(1);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState<Set<string>>(new Set());

  const togglePlacementSelection = (id: number | string) => {
    const key = String(id);
    setSelectedPlacementIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  function getPlacementCellValue(p: PlacementRecord, key: string): string {
    switch (key) {
      case "approver":
        return p.approver ?? p.createdByName ?? "";
      case "candidate":
        return p.candidate ?? p.jobSeekerName ?? "";
      case "title":
        return p.title ?? p.jobTitle ?? "";
      case "status":
        return p.status ?? "";
      default:
        return String((p as Record<string, unknown>)[key] ?? "");
    }
  }

  const filteredAndSortedPlacements = useMemo(() => {
    let result = [...placementsData];
    const term = placementsSearchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((p) => {
        const approver = (p.approver ?? p.createdByName ?? "").toLowerCase();
        const candidate = (p.candidate ?? p.jobSeekerName ?? "").toLowerCase();
        const title = (p.title ?? p.jobTitle ?? "").toLowerCase();
        const status = (p.status ?? "").toLowerCase();
        const id = String(p.id ?? "").toLowerCase();
        return approver.includes(term) || candidate.includes(term) || title.includes(term) || status.includes(term) || id.includes(term);
      });
    }
    PLACEMENT_COLUMNS.forEach(({ key }) => {
      const filterVal = placementsColumnFilters[key];
      if (!filterVal || filterVal.trim() === "") return;
      result = result.filter((p) => {
        const val = getPlacementCellValue(p, key).toLowerCase();
        return val.includes(filterVal.toLowerCase());
      });
    });
    const activeSort = Object.entries(placementsColumnSorts).find(([, dir]) => dir !== null);
    if (activeSort) {
      const [sortKey, sortDir] = activeSort;
      result.sort((a, b) => {
        const aVal = getPlacementCellValue(a, sortKey);
        const bVal = getPlacementCellValue(b, sortKey);
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [placementsData, placementsSearchTerm, placementsColumnFilters, placementsColumnSorts]);

  const handleSelectAllPlacements = useCallback(() => {
    const filteredIds = new Set(filteredAndSortedPlacements.map((p) => String(p.id)));
    const allSelected = filteredAndSortedPlacements.length > 0 && filteredAndSortedPlacements.every((p) => selectedPlacementIds.has(String(p.id)));
    if (allSelected) {
      setSelectedPlacementIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedPlacementIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [filteredAndSortedPlacements, selectedPlacementIds]);

  const placementsSelectAllChecked =
    filteredAndSortedPlacements.length > 0 &&
    filteredAndSortedPlacements.every((p) => selectedPlacementIds.has(String(p.id)));
  const placementsSelectAllIndeterminate =
    filteredAndSortedPlacements.some((p) => selectedPlacementIds.has(String(p.id))) && !placementsSelectAllChecked;

  const placementsSelectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = placementsSelectAllRef.current;
    if (el) el.indeterminate = placementsSelectAllIndeterminate;
  }, [placementsSelectAllIndeterminate]);

  const placementsTotal = filteredAndSortedPlacements.length;
  const placementsPageCount = Math.max(1, Math.ceil(placementsTotal / placementsPageSize));
  const placementsPageClamped = Math.min(Math.max(1, placementsPage), placementsPageCount);
  const placementsStart = placementsTotal === 0 ? 0 : (placementsPageClamped - 1) * placementsPageSize + 1;
  const placementsEnd = Math.min(placementsPageClamped * placementsPageSize, placementsTotal);
  const placementsSlice = useMemo(() => {
    const start = (placementsPageClamped - 1) * placementsPageSize;
    return filteredAndSortedPlacements.slice(start, start + placementsPageSize);
  }, [filteredAndSortedPlacements, placementsPageClamped, placementsPageSize]);

  const hasPlacementsFilters = placementsSearchTerm.trim() !== "" || Object.values(placementsColumnFilters).some((v) => v && v.trim() !== "");
  const handleClearPlacementsFilters = () => {
    setPlacementsSearchTerm("");
    setPlacementsColumnFilters({});
    setPlacementsPage(1);
  };

  const handlePlacementsColumnSort = (key: string) => {
    setPlacementsColumnSorts((prev) => {
      const curr = prev[key];
      const next: ColumnSortState = curr === "asc" ? "desc" : "asc";
      return { [key]: next };
    });
    setPlacementsPage(1);
  };

  const handlePlacementsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = placementsColumnOrder.indexOf(active.id as string);
    const newIndex = placementsColumnOrder.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      setPlacementsColumnOrder(arrayMove(placementsColumnOrder, oldIndex, newIndex));
    }
  };

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    placementsData.forEach((p) => {
      const s = p.status;
      if (s) statuses.add(s);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [placementsData]);
  const handleExportPlacements = () => {
    const toExport = filteredAndSortedPlacements.filter((p) => selectedPlacementIds.has(String(p.id)));
    if (toExport.length === 0) return;
    const header = ["Approver", "Candidate", "Title", "Status"];
    const escapeCsvValue = (value: unknown) => {
      const safe = value ?? "";
      const text = String(safe).replace(/"/g, '""');
      return `"${text}"`;
    };
    const rows = toExport.map((placement) => [
      placement.approver ?? placement.createdByName ?? "",
      placement.candidate ?? placement.jobSeekerName ?? "",
      placement.title ?? placement.jobTitle ?? "",
      placement.status ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = (form.companyName || `organization-${organization.id}`).replace(/\s+/g, "_");
    anchor.href = url;
    anchor.download = `${baseName.toLowerCase()}-placements.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  useEffect(() => {
    const initialPlacements = normalizePlacementRecords(
      Array.isArray(organization.placements)
        ? (organization.placements as unknown[])
        : []
    );
    setPlacementsData(initialPlacements);
    setPlacementsPage(1);
    setSelectedPlacementIds(new Set());

    if (!organization.id) {
      setPlacementsLoading(false);
      setPlacementsError(null);
      return;
    }

    let ignore = false;
    setPlacementsLoading(true);
    setPlacementsError(null);

    fetch(`/api/placements/organization/${organization.id}`)
      .then(async (res) => {
        let payload: unknown;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        if (ignore) return;
        const success =
          !!payload &&
          typeof payload === "object" &&
          (payload as { success?: boolean }).success;
        const placements = (payload as { placements?: unknown[] | null })?.placements;
        if (!res.ok || !success || !Array.isArray(placements)) {
          const message =
            (payload as { message?: string } | null)?.message ??
            "Unable to load placements.";
          setPlacementsError(message);
          setPlacementsLoading(false);
          return;
        }
        setPlacementsData(normalizePlacementRecords(placements));
        setPlacementsLoading(false);
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setPlacementsError(
          error instanceof Error ? error.message : "Unable to load placements."
        );
        setPlacementsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [organization.id, organization.placements]);

  useEffect(() => {
    if (placementsPage > placementsPageCount && placementsPageCount > 0) {
      setPlacementsPage(placementsPageCount);
    }
  }, [placementsPage, placementsPageCount]);

  const tabItems: { id: TabId; label: string }[] = [
    { id: "edit", label: "EDIT" },
    { id: "placements", label: "PLACEMENTS" },
    { id: "audit", label: "AUDIT TRAIL" },
    { id: "billing", label: "BILLING CONTACT" },
  ];

  const handleSave = () => {
    onSave?.(form as unknown as Record<string, unknown>);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header – blue bar */}
        <div className="shrink-0 bg-[#2563eb] text-white flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-white/90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <h2 className="text-xl font-semibold">{form.companyName || "Organization"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded border border-white/80 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs – dark grey bar, EDIT active */}
        <div className="shrink-0 bg-gray-600 flex">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium uppercase tracking-wide transition-colors ${
                activeTab === tab.id
                  ? "bg-gray-500 text-white border-b-2 border-blue-400"
                  : "text-white/90 hover:bg-gray-500/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content – scrollable form (only EDIT tab content for now) */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          {activeTab === "edit" && (
            <div className="px-6 py-6 space-y-6">
              {/* General Information */}
              <section>
                <div className="flex items-center gap-2 mb-4 py-2 px-3 -mx-3 bg-gray-100 rounded-sm">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Section options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    General Information
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Company Name
                    </label>
                    <div className="flex-1 flex items-center gap-2 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={form.companyName}
                        onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                        className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                      <span className="text-green-600 shrink-0" aria-hidden>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Phone
                    </label>
                    <div className="flex-1 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Integration ID
                    </label>
                    <div className="flex-1 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={form.integrationId}
                        onChange={(e) => setForm((p) => ({ ...p, integrationId: e.target.value }))}
                        className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Invoice Information */}
              <section>
                <div className="flex items-center gap-2 mb-4 py-2 px-3 -mx-3 bg-gray-100 rounded-sm">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Section options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Invoice Information
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Contract TERMS NET
                    </label>
                    <div className="flex-1 flex items-center gap-2 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={form.contractTermsNet}
                        onChange={(e) => setForm((p) => ({ ...p, contractTermsNet: e.target.value }))}
                        className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                      <span className="text-green-600 shrink-0" aria-hidden>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Perm TERMS NET
                    </label>
                    <div className="flex-1 flex items-center gap-2 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={form.permTermsNet}
                        onChange={(e) => setForm((p) => ({ ...p, permTermsNet: e.target.value }))}
                        className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                      <span className="text-green-600 shrink-0" aria-hidden>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Billing */}
              <section>
                <div className="flex items-center gap-2 mb-4 py-2 px-3 -mx-3 bg-gray-100 rounded-sm">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Section options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Billing
                  </h3>
                </div>
                <div className="space-y-4">
                  {[
                    { key: "address" as const, label: "Address", value: form.address },
                    { key: "address2" as const, label: "Address 2", value: form.address2 },
                    { key: "city" as const, label: "City", value: form.city },
                    { key: "stateProvince" as const, label: "State/Province", value: form.stateProvince },
                    { key: "zipPostal" as const, label: "ZIP/Postal Code", value: form.zipPostal },
                    { key: "country" as const, label: "Country", value: form.country },
                  ].map(({ key, label, value }) => (
                    <div key={key} className="flex items-center gap-4">
                      <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {label}
                      </label>
                      <div className="flex-1 border-b border-gray-300 pb-1">
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={value}
                          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                          className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Timesheets */}
              <section>
                <div className="flex items-center gap-2 mb-4 py-2 px-3 -mx-3 bg-gray-100 rounded-sm">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Section options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Timesheets
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Start Day of Week
                    </label>
                    <div className="flex-1 border-b border-gray-300 pb-1 flex items-center gap-1 relative">
                      <select
                        value={form.startDayOfWeek}
                        onChange={(e) => setForm((p) => ({ ...p, startDayOfWeek: e.target.value }))}
                        className="flex-1 min-w-0 border-none outline-none text-gray-900 text-sm py-0.5 appearance-none cursor-pointer pr-7 bg-transparent"
                      >
                        {DAYS_OF_WEEK.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="w-5 h-5 text-gray-500 pointer-events-none absolute right-0 top-1/2 -translate-y-1/2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      IASIS Key
                    </label>
                    <div className="flex-1 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={form.iasisKey}
                        onChange={(e) => setForm((p) => ({ ...p, iasisKey: e.target.value }))}
                        className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-6 pb-4">
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-sm uppercase tracking-wide rounded shadow-sm transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-sm uppercase tracking-wide rounded shadow-sm transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save
                </button>
              </div>
            </div>
          )}

          {activeTab === "placements" && (
            <div className="px-6 py-4 flex flex-col min-h-0 flex-1">
              {/* Search */}
              <div className="p-4 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search placements..."
                      className="w-full p-2 pl-10 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={placementsSearchTerm}
                      onChange={(e) => {
                        setPlacementsSearchTerm(e.target.value);
                        setPlacementsPage(1);
                      }}
                    />
                    <div className="absolute left-3 top-2.5 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {hasPlacementsFilters && (
                    <button
                      type="button"
                      onClick={handleClearPlacementsFilters}
                      className="px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors flex items-center gap-2"
                    >
                      <FiX />
                      Clear All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleExportPlacements}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={placementsTotal === 0 || placementsLoading || selectedPlacementIds.size === 0}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {placementsError && (
                <div className="px-4 py-2 text-sm text-red-600 shrink-0">{placementsError}</div>
              )}

              {/* Table */}
              <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-lg">
                {placementsLoading ? (
                  <div className="px-4 py-12 text-sm text-gray-500 text-center">
                    Loading placements...
                  </div>
                ) : (
                  <DndContext collisionDetection={closestCenter} onDragEnd={handlePlacementsDragEnd} modifiers={[restrictToHorizontalAxis]}>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 w-12">
                            <input
                              ref={placementsSelectAllRef}
                              type="checkbox"
                              checked={placementsSelectAllChecked}
                              onChange={handleSelectAllPlacements}
                              disabled={filteredAndSortedPlacements.length === 0}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Select all placements"
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                            ID
                          </th>
                          <SortableContext items={placementsColumnOrder} strategy={horizontalListSortingStrategy}>
                            {placementsColumnOrder.map((key) => {
                              const col = PLACEMENT_COLUMN_MAP[key];
                              if (!col) return null;
                              return (
                                <PlacementColumnHeader
                                  key={key}
                                  id={key}
                                  columnKey={key}
                                  label={col.label}
                                  sortState={placementsColumnSorts[key] ?? null}
                                  filterValue={placementsColumnFilters[key] ?? null}
                                  onSort={() => handlePlacementsColumnSort(key)}
                                  onFilterChange={(value) => {
                                    setPlacementsColumnFilters((prev) => ({ ...prev, [key]: value || null }));
                                    setPlacementsPage(1);
                                  }}
                                  filterType={col.filterType}
                                  filterOptions={key === "status" ? statusOptions : undefined}
                                />
                              );
                            })}
                          </SortableContext>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {placementsSlice.length === 0 ? (
                          <tr>
                            <td colSpan={2 + placementsColumnOrder.length} className="px-6 py-12 text-center text-sm text-gray-500">
                              {placementsSearchTerm || Object.values(placementsColumnFilters).some((v) => v) ? "No placements found matching your search." : "No placements available."}
                            </td>
                          </tr>
                        ) : (
                          placementsSlice.map((placement) => (
                            <tr
                              key={placement.id}
                              onClick={() => {
                                onClose();
                                router.push(`/dashboard/placements/view?id=${placement.id}`);
                              }}
                              className="hover:bg-gray-50 cursor-pointer"
                            >
                              <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedPlacementIds.has(String(placement.id))}
                                  onChange={() => togglePlacementSelection(placement.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  aria-label={`Select placement ${placement.id}`}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                P {placement.id}
                              </td>
                              {placementsColumnOrder.map((key) => (
                                <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {key === "status" ? (
                                    <span
                                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                        (placement.status || "").toLowerCase() === "active" ||
                                        (placement.status || "").toLowerCase() === "approved"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-gray-100 text-gray-600"
                                      }`}
                                    >
                                      {getPlacementCellValue(placement, key) || "Unknown"}
                                    </span>
                                  ) : (
                                    getPlacementCellValue(placement, key) || "—"
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </DndContext>
                )}
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    {[10, 25, 50, 100].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setPlacementsPageSize(size);
                          setPlacementsPage(1);
                        }}
                        className={`px-3 py-1 text-sm rounded ${
                          placementsPageSize === size ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{placementsStart}</span> to{" "}
                    <span className="font-medium">{placementsEnd}</span> of{" "}
                    <span className="font-medium">{placementsTotal}</span> results
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlacementsPage((p) => Math.max(1, p - 1))}
                    disabled={placementsPageClamped <= 1 || placementsLoading}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {placementsPageClamped} of {placementsPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPlacementsPage((p) => Math.min(placementsPageCount, p + 1))}
                    disabled={placementsPageClamped >= placementsPageCount || placementsLoading}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab !== "edit" && activeTab !== "placements" && (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">
              {activeTab === "audit" && "Audit trail — coming soon."}
              {activeTab === "billing" && "Billing contact — coming soon."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
