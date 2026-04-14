"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiPlus, FiSearch, FiX } from "react-icons/fi";
import StyledReactSelect from "@/components/StyledReactSelect";

// One row in the criteria list
export type AdvancedSearchCriterion = {
  id: string;
  fieldKey: string;
  operator: string;
  value?: string;
  valueFrom?: string;
  valueTo?: string;
};

export type FieldOption = { label: string; value: string };

export type FieldCatalogItem = {
  key: string;
  label: string;
  fieldType?: string;
  lookupType?: string;
  multiSelectLookupType?: string;
  options?: FieldOption[];
};

type OperatorDef = { value: string; label: string };

const RECENT_MAX = 10;
const ANIM_MS = 160;

function makeCriterionId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getScrollParents(element: HTMLElement | null): HTMLElement[] {
  const parents: HTMLElement[] = [];
  let el = element?.parentElement ?? null;
  while (el) {
    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    if (["auto", "scroll", "overlay"].includes(overflowY) || ["auto", "scroll", "overlay"].includes(overflowX)) {
      parents.push(el);
    }
    el = el.parentElement;
  }
  return parents;
}

// Per-admin-field-type operator configuration
function getOperatorsForFieldType(fieldType?: string): OperatorDef[] {
  const t = String(fieldType || "").toLowerCase();

  // text / textarea
  if (t === "text" || t === "textarea") {
    return [
      { value: "contains", label: "Contains" },
      { value: "not_contains", label: "Does Not Contain" },
      { value: "equals", label: "Equals" },
      { value: "starts_with", label: "Starts With" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // email
  if (t === "email") {
    return [
      { value: "contains", label: "Contains" },
      { value: "equals", label: "Equals" },
      { value: "domain_equals", label: "Domain Equals (example: gmail.com)" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // phone
  if (t === "phone") {
    return [
      { value: "equals", label: "Equals" },
      { value: "contains", label: "Contains" },
      { value: "starts_with", label: "Starts With" },
      { value: "area_code_is", label: "Area Code Is" },
      { value: "area_code_is_not", label: "Area Code Is Not" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // number-like: number, percentage, currency
  if (t === "number" || t === "percentage" || t === "percent" || t === "currency") {
    return [
      { value: "equals", label: "Equals" },
      { value: "gt", label: "Greater Than" },
      { value: "lt", label: "Less Than" },
      { value: "between", label: "Between" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // date
  if (t === "date") {
    return [
      { value: "on", label: "On" },
      { value: "before", label: "Before" },
      { value: "after", label: "After" },
      { value: "between", label: "Between" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // datetime
  if (t === "datetime") {
    return [
      { value: "on", label: "On" },
      { value: "before", label: "Before" },
      { value: "after", label: "After" },
      { value: "between", label: "Between" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // select / radio
  if (t === "select" || t === "dropdown" || t === "radio") {
    return [
      { value: "equals", label: "Is" },
      { value: "not_equals", label: "Is Not" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // multiselect / multicheckbox / multiselect_lookup
  if (
    t === "multiselect" ||
    t === "multicheckbox" ||
    t === "multi_select" ||
    t === "multiselect_lookup"
  ) {
    return [
      { value: "include_any", label: "Include Any" },
      { value: "include_all", label: "Include All" },
      { value: "exclude", label: "Exclude" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // checkbox / boolean
  if (t === "checkbox" || t === "boolean" || t === "switch") {
    return [
      { value: "is_checked", label: "Is Checked" },
      { value: "is_not_checked", label: "Is Not Checked" },
    ];
  }

  // lookup
  if (t === "lookup") {
    return [
      { value: "equals", label: "Is" },
      { value: "not_equals", label: "Is Not" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // url
  if (t === "url") {
    return [
      { value: "contains", label: "Contains" },
      { value: "equals", label: "Equals" },
      { value: "starts_with", label: "Starts With" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // link
  if (t === "link") {
    return [
      { value: "contains", label: "Contains" },
      { value: "equals", label: "Equals" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // file
  if (t === "file") {
    return [
      { value: "exists", label: "Exists" },
      { value: "not_exists", label: "Does Not Exist" },
    ];
  }

  // composite
  if (t === "composite") {
    return [
      { value: "contains", label: "Contains" },
      { value: "equals", label: "Equals" },
      { value: "is_empty", label: "Is Empty" },
    ];
  }

  // fallback – treat as text
  return [
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Does Not Contain" },
    { value: "equals", label: "Equals" },
    { value: "starts_with", label: "Starts With" },
    { value: "is_empty", label: "Is Empty" },
  ];
}

function operatorNeedsNoValue(op: string) {
  return (
    op === "is_empty" ||
    op === "exists" ||
    op === "not_exists" ||
    op === "is_checked" ||
    op === "is_not_checked"
  );
}

function operatorNeedsRange(op: string) {
  return op === "between";
}

function operatorNeedsSingleValue(op: string) {
  if (operatorNeedsNoValue(op)) return false;
  if (operatorNeedsRange(op)) return false;
  return true;
}

export interface AdvancedSearchPanelProps {
  open: boolean;
  onClose: () => void;
  fieldCatalog: FieldCatalogItem[];
  onSearch: (criteria: AdvancedSearchCriterion[]) => void;
  /** localStorage key for recent searches (e.g. "organizationAdvancedSearchRecent") */
  recentStorageKey: string;
  /** Optional: initial criteria when opening (e.g. from parent state) */
  initialCriteria?: AdvancedSearchCriterion[];
  /** Anchor element for dropdown positioning */
  anchorEl?: HTMLElement | null;
  /** Optional loading indicator shown in panel header */
  isLoading?: boolean;
  /** Optional results count shown in panel header */
  resultsCount?: number | null;
  /** Optional total count across all records */
  totalResultsCount?: number | null;
  /** Optional count currently displayed after client-side filters */
  displayedResultsCount?: number | null;
  /** Optional singular/plural label, default "records" */
  resultsLabel?: string;
}

export default function AdvancedSearchPanel({
  open,
  onClose,
  fieldCatalog,
  onSearch,
  recentStorageKey,
  initialCriteria = [],
  anchorEl,
  isLoading = false,
  resultsCount = null,
  totalResultsCount = null,
  displayedResultsCount = null,
  resultsLabel = "records",
}: AdvancedSearchPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"search" | "recent">("search");
  const [criteria, setCriteria] = useState<AdvancedSearchCriterion[]>([]);
  const [recentSearches, setRecentSearches] = useState<
    { criteria: AdvancedSearchCriterion[]; label: string }[]
  >([]);
  const [criteriaCollapsed, setCriteriaCollapsed] = useState(false);

  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>(
    { top: 0, left: 0, width: 900 }
  );

  const resolvedTotalCount = totalResultsCount ?? resultsCount;
  const resolvedDisplayedCount =
    displayedResultsCount != null ? displayedResultsCount : resultsCount;
  const showCount =
    resolvedTotalCount != null || resolvedDisplayedCount != null;
  const countText =
    resolvedTotalCount != null &&
    resolvedDisplayedCount != null &&
    resolvedDisplayedCount !== resolvedTotalCount
      ? `${resolvedDisplayedCount} shown / ${resolvedTotalCount} total`
      : `${resolvedTotalCount ?? resolvedDisplayedCount} ${resultsLabel} found`;

  // Mount/unmount with fade animation
  useEffect(() => {
    if (open) {
      setRendered(true);
      requestAnimationFrame(() => setVisible(true));
      return;
    }
    setVisible(false);
    const t = window.setTimeout(() => setRendered(false), ANIM_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // Position under anchor, via portal (fixed coords)
  const reposition = useCallback(() => {
    if (!anchorEl) return;

    const rect = anchorEl.getBoundingClientRect();

    const width = Math.min(
      980,
      Math.max(720, Math.floor(window.innerWidth * 0.86))
    );

    const margin = 8;

    // Center horizontally
    const left = Math.max(
      margin,
      (window.innerWidth - width) / 2
    );

    // Keep vertical position below anchor
    const top = rect.bottom + 8;

    setPos({ top, left, width });
  }, [anchorEl]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => reposition();
    const scrollParents = anchorEl ? getScrollParents(anchorEl) : [];
    /** Only close when the scrolling element is the page or an anchor scroll parent — not nested menus (portals). */
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t === document || t === document.documentElement || t === document.body) {
        onClose();
        return;
      }
      if (
        scrollParents.length > 0 &&
        scrollParents.some((el) => el === t)
      ) {
        onClose();
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    scrollParents.forEach((el) => el.addEventListener("scroll", onScroll));
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      scrollParents.forEach((el) => el.removeEventListener("scroll", onScroll));
    };
  }, [open, onClose, reposition, anchorEl]);

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const el = target instanceof HTMLElement ? target : null;
      const inPanel = panelRef.current?.contains(target);
      const inAnchor = anchorEl?.contains(target as Node);
      const inSelectOverlay =
        el?.closest?.('[role="listbox"]') ||
        el?.closest?.('[role="option"]') ||
        el?.closest?.(".react-select__menu") ||
        el?.closest?.('[class*="react-select"]');
      if (!inPanel && !inAnchor && !inSelectOverlay) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorEl]);

  // Load recent from localStorage
  useEffect(() => {
    if (!open || !recentStorageKey || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(recentStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, RECENT_MAX));
      }
    } catch {
      // ignore
    }
  }, [recentStorageKey, open]);

  // Sync initial criteria when opening
  useEffect(() => {
    if (!open) return;
    setCriteria(
      initialCriteria.length > 0
        ? initialCriteria.map((c) => ({ ...c, id: c.id || makeCriterionId() }))
        : [{ id: makeCriterionId(), fieldKey: "", operator: "", value: "" }]
    );
    setActiveTab("search");
  }, [open, initialCriteria]);

  const getFieldInfo = useCallback(
    (fieldKey: string): FieldCatalogItem | undefined =>
      fieldCatalog.find((f) => f.key === fieldKey),
    [fieldCatalog]
  );

  const addRow = () => {
    setCriteria((prev) => [
      ...prev,
      { id: makeCriterionId(), fieldKey: "", operator: "", value: "" },
    ]);
  };

  const removeRow = (id: string) => {
    setCriteria((prev) => {
      const next = prev.filter((c) => c.id !== id);
      return next.length === 0
        ? [{ id: makeCriterionId(), fieldKey: "", operator: "", value: "" }]
        : next;
    });
  };

  const updateCriterion = (
    id: string,
    patch: Partial<Omit<AdvancedSearchCriterion, "id">>
  ) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const handleClearAll = () => {
    setCriteria([{ id: makeCriterionId(), fieldKey: "", operator: "", value: "" }]);
  };

  const runSearch = useCallback(
    (criteriaToRun: AdvancedSearchCriterion[]) => {
      const valid = criteriaToRun.filter((c) => {
        if (!c.fieldKey || !c.operator) return false;
        if (operatorNeedsNoValue(c.operator)) return true;
        if (operatorNeedsRange(c.operator))
          return (c.valueFrom ?? "").trim() !== "" && (c.valueTo ?? "").trim() !== "";
        return (c.value ?? "").trim() !== "";
      });
      if (valid.length === 0) return;

      const label = valid
        .slice(0, 2)
        .map((c) => {
          const info = getFieldInfo(c.fieldKey);
          const fieldLabel = info?.label ?? c.fieldKey;
          const op = c.operator;
          const val = operatorNeedsRange(op)
            ? `${c.valueFrom}–${c.valueTo}`
            : operatorNeedsNoValue(op)
              ? op.replace(/_/g, " ")
              : c.value;
          return `${fieldLabel}: ${val}`;
        })
        .join("; ");

      setRecentSearches((prev) => {
        const next = [
          { criteria: valid.map((c) => ({ ...c })), label },
          ...prev.filter((r) => JSON.stringify(r.criteria) !== JSON.stringify(valid)),
        ].slice(0, RECENT_MAX);
        try {
          localStorage.setItem(recentStorageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      onSearch(valid);
      onClose();
    },
    [getFieldInfo, onClose, onSearch, recentStorageKey]
  );

  const handleSearchClick = () => runSearch(criteria);

  const loadRecent = (recent: { criteria: AdvancedSearchCriterion[]; label: string }) => {
    setCriteria(
      recent.criteria.length > 0
        ? recent.criteria.map((c) => ({ ...c, id: makeCriterionId() }))
        : [{ id: makeCriterionId(), fieldKey: "", operator: "", value: "" }]
    );
    setActiveTab("search");
    runSearch(recent.criteria);
  };

  const canRun = useMemo(() => {
    if (activeTab !== "search") return false;
    return criteria.some((c) => {
      if (!c.fieldKey || !c.operator) return false;
      if (operatorNeedsNoValue(c.operator)) return true;
      if (operatorNeedsRange(c.operator))
        return (c.valueFrom ?? "").trim() !== "" && (c.valueTo ?? "").trim() !== "";
      return (c.value ?? "").trim() !== "";
    });
  }, [activeTab, criteria]);

  if (!rendered) return null;

  return (
    <div
      ref={panelRef}
      className={`bg-white border border-gray-200 shadow-sm rounded-lg z-9999 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
        } transition-all duration-150 ease-out`}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxWidth: "95vw",
        maxHeight: "80vh",
      }}
    >
      {/* Header row: tabs + status + close */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-3">
          <div className="flex">
            <button
              onClick={() => setActiveTab("search")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "search"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab("recent")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "recent"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              Recent
            </button>
          </div>
          {showCount && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600 whitespace-nowrap">
              {isLoading && (
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
                  aria-label="Loading"
                />
              )}
              <span>{countText}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showCount && (
            <div className="sm:hidden flex items-center gap-2 text-xs text-gray-600 whitespace-nowrap">
              {isLoading && (
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
                  aria-label="Loading"
                />
              )}
              <span>{resolvedTotalCount ?? resolvedDisplayedCount}</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto" style={{ maxHeight: "62vh" }}>
        {activeTab === "search" ? (
          <div className="mb-2">
            <button
              onClick={() => setCriteriaCollapsed(!criteriaCollapsed)}
              className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-700 mb-3"
            >
              <span
                className={`inline-block transition-transform ${criteriaCollapsed ? "" : "rotate-180"
                  }`}
              >
                ▼
              </span>
              Criteria
            </button>

            {!criteriaCollapsed && (
              <div className="space-y-3">
                {criteria.map((row) => (
                  <SearchRow
                    key={row.id}
                    row={row}
                    fieldCatalog={fieldCatalog}
                    getFieldInfo={getFieldInfo}
                    onUpdate={(patch) => updateCriterion(row.id, patch)}
                    onRemove={() => removeRow(row.id)}
                    canRemove={criteria.length > 1}
                  />
                ))}

                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-semibold"
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                    <FiPlus className="w-4 h-4" />
                  </span>
                  Add a Field to Search
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 mb-3">
              Recent retains the last {RECENT_MAX} searches that were performed.
              Click to re-run.
            </p>
            {recentSearches.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                No recent searches yet. Run a search from the Search tab.
              </p>
            ) : (
              recentSearches.map((recent, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => loadRecent(recent)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 text-sm text-gray-700 border border-transparent hover:border-gray-200"
                >
                  <span className="font-medium text-gray-500 text-xs">
                    {recent.criteria.length} condition(s)
                  </span>
                  <br />
                  <span className="truncate block">{recent.label || "Saved search"}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleClearAll}
          className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          CLEAR ALL
        </button>
        <button
          type="button"
          onClick={handleSearchClick}
          disabled={!canRun}
          className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FiSearch className="w-4 h-4" />
          Q SEARCH
        </button>
      </div>
    </div>
  );
}

// Single criterion row: remove button, field dropdown, operator dropdown, value input(s)
function SearchRow({
  row,
  fieldCatalog,
  getFieldInfo,
  onUpdate,
  onRemove,
  canRemove,
}: {
  row: AdvancedSearchCriterion;
  fieldCatalog: FieldCatalogItem[];
  getFieldInfo: (key: string) => FieldCatalogItem | undefined;
  onUpdate: (patch: Partial<AdvancedSearchCriterion>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const fieldInfo = getFieldInfo(row.fieldKey);

  const fieldSelectOptions = useMemo(
    () =>
      fieldCatalog.map((f) => ({
        value: f.key,
        label: f.label,
      })),
    [fieldCatalog]
  );

  const fieldSelectValue = useMemo(() => {
    if (!row.fieldKey) return null;
    const label = fieldInfo?.label ?? row.fieldKey;
    return { value: row.fieldKey, label };
  }, [row.fieldKey, fieldInfo?.label]);
  const rawType = String(fieldInfo?.fieldType || "").toLowerCase();
  const operators = getOperatorsForFieldType(rawType);
  // derive a coarse input kind from admin field_type for rendering inputs
  const kind =
    rawType === "date"
      ? "date"
      : rawType === "datetime"
        ? "datetime"
        : rawType === "time"
          ? "time"
          : rawType === "number" || rawType === "currency"
            ? "number"
            : rawType === "percentage" || rawType === "percent"
              ? "percent"
              : rawType === "select" || rawType === "dropdown" || rawType === "radio"
                ? "select"
                : rawType === "multiselect" ||
                  rawType === "multicheckbox" ||
                  rawType === "multi_select" ||
                  rawType === "multiselect_lookup"
                  ? "multiselect"
                  : rawType === "checkbox" || rawType === "boolean" || rawType === "switch"
                    ? "boolean"
                    : "text";

  const showRange = operatorNeedsRange(row.operator);
  const showNoValue = operatorNeedsNoValue(row.operator);

  const inputType =
    kind === "date" || kind === "datetime"
      ? "date"
      : kind === "time"
        ? "time"
        : kind === "number" || kind === "percent"
          ? "number"
          : "text";

  const numberStep = kind === "percent" ? "0.01" : "any";

  const hasOptions =
    kind === "boolean" ||
    (Array.isArray(fieldInfo?.options) && fieldInfo?.options!.length > 0);
  const wantsMultiChoice =
    kind === "multiselect" || row.operator === "any_of" || row.operator === "none_of";
  const showSelect = (kind === "select" || kind === "multiselect" || kind === "boolean") && hasOptions;

  const booleanOptions: FieldOption[] = [
    { label: "True", value: "true" },
    { label: "False", value: "false" },
  ];

  const selectOptions = kind === "boolean" ? booleanOptions : fieldInfo?.options || [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center w-5 h-5 text-red-500 hover:text-red-600 border border-red-500 hover:border-red-600 rounded-md shrink-0"
          title="Remove row"
          aria-label="Remove row"
        >
          <FiX className="w-4 h-4" />
        </button>
      ) : (
        <div className="w-9 shrink-0" />
      )}

      {/* Field selector (searchable) */}
      <div className="relative min-w-[240px] flex-1 max-w-[340px]">
        <StyledReactSelect
          aria-label="Search field"
          placeholder="Select field…"
          isClearable
          isSearchable
          menuPortalTarget={
            typeof document !== "undefined" ? document.body : null
          }
          menuPosition="fixed"
          options={fieldSelectOptions}
          value={fieldSelectValue}
          onChange={(opt) => {
            const key = opt?.value ?? "";
            onUpdate({
              fieldKey: key,
              operator: "",
              value: undefined,
              valueFrom: undefined,
              valueTo: undefined,
            });
          }}
          styles={{
            menuPortal: (base) => ({ ...base, zIndex: 10050 }),
            menu: (base) => ({ ...base, zIndex: 10050 }),
          }}
        />
      </div>

      {/* Operator selector */}
      <div className="min-w-[220px] flex-1 max-w-[260px]">
        <select
          value={row.operator}
          onChange={(e) =>
            onUpdate({
              operator: e.target.value,
              value: undefined,
              valueFrom: undefined,
              valueTo: undefined,
            })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="">Match type</option>
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value input(s) */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showNoValue ? (
          <div className="flex-1 px-3 py-2 text-sm text-gray-400 italic">
            No value required
          </div>
        ) : showRange ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type={inputType}
              step={inputType === "number" ? numberStep : undefined}
              value={row.valueFrom ?? ""}
              onChange={(e) => onUpdate({ valueFrom: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 w-44"
              placeholder="From"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type={inputType}
              step={inputType === "number" ? numberStep : undefined}
              value={row.valueTo ?? ""}
              onChange={(e) => onUpdate({ valueTo: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 w-44"
              placeholder="To"
            />
          </div>
        ) : row.operator === "within" && (kind === "date" || kind === "datetime") ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              min="0"
              value={row.value ?? ""}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 w-40"
              placeholder="Days"
            />
            <span className="text-sm text-gray-500">days</span>
          </div>
        ) : showSelect && row.operator ? (
          <select
            multiple={wantsMultiChoice}
            value={
              wantsMultiChoice
                ? String(row.value ?? "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
                : row.value ?? ""
            }
            onChange={(e) => {
              if (!wantsMultiChoice) {
                onUpdate({ value: e.target.value });
                return;
              }
              const values = Array.from(e.currentTarget.selectedOptions).map(
                (o) => o.value
              );
              onUpdate({ value: values.join(",") });
            }}
            className={`flex-1 min-w-[220px] px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white ${wantsMultiChoice ? "h-28" : ""
              }`}
          >
            {!wantsMultiChoice && <option value="">Select…</option>}
            {selectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : operatorNeedsSingleValue(row.operator) ? (
          <input
            type={inputType}
            step={inputType === "number" ? numberStep : undefined}
            value={row.value ?? ""}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Value"
            className="flex-1 min-w-[220px] px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
