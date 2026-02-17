"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { FiPlus, FiSearch, FiX } from "react-icons/fi";

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
}

export default function AdvancedSearchPanel({
  open,
  onClose,
  fieldCatalog,
  onSearch,
  recentStorageKey,
  initialCriteria = [],
  anchorEl,
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
    const left = Math.min(
      window.innerWidth - width - margin,
      Math.max(margin, rect.right - width)
    );
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
    const onScroll = () => reposition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, reposition]);

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inPanel = panelRef.current?.contains(target);
      const inAnchor = anchorEl?.contains(target as Node);
      if (!inPanel && !inAnchor) onClose();
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

  const [fieldSearch, setFieldSearch] = useState("");
  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) return fieldCatalog;
    const q = fieldSearch.toLowerCase();
    return fieldCatalog.filter(
      (f) =>
        f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    );
  }, [fieldCatalog, fieldSearch]);

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
      className={`bg-white border border-gray-200 shadow-2xl rounded-lg z-[9999] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
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
      {/* Header row: tabs + close */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4">
        <div className="flex">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "search"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab("recent")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "recent"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Recent
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Close"
          aria-label="Close"
        >
          <FiX className="w-5 h-5" />
        </button>
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
                className={`inline-block transition-transform ${
                  criteriaCollapsed ? "" : "rotate-180"
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
                    filteredFields={filteredFields}
                    fieldSearch={fieldSearch}
                    onFieldSearchChange={setFieldSearch}
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
  filteredFields,
  fieldSearch,
  onFieldSearchChange,
  getFieldInfo,
  onUpdate,
  onRemove,
  canRemove,
}: {
  row: AdvancedSearchCriterion;
  filteredFields: FieldCatalogItem[];
  fieldSearch: string;
  onFieldSearchChange: (v: string) => void;
  getFieldInfo: (key: string) => FieldCatalogItem | undefined;
  onUpdate: (patch: Partial<AdvancedSearchCriterion>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [fieldDropdownOpen, setFieldDropdownOpen] = useState(false);
  const fieldButtonRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const fieldInfo = getFieldInfo(row.fieldKey);
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

  useLayoutEffect(() => {
    if (!fieldDropdownOpen) {
      setDropdownPos(null);
      return;
    }
    const el = fieldButtonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, [fieldDropdownOpen]);

  useEffect(() => {
    if (!fieldDropdownOpen) return;
    const onResize = () => {
      const el = fieldButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [fieldDropdownOpen]);

  return (
    <div className="flex flex-wrap items-start gap-2">
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center w-9 h-9 rounded-full text-white bg-red-500 hover:bg-red-600 shrink-0"
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
        <button
          type="button"
          ref={fieldButtonRef}
          onClick={() => setFieldDropdownOpen((v) => !v)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
        >
          <span className="truncate">{fieldInfo ? fieldInfo.label : ""}</span>
          <span className="text-gray-400">▼</span>
        </button>

        {fieldDropdownOpen && (
          <>
            {typeof document !== "undefined" &&
              dropdownPos &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[9998]"
                    onMouseDown={() => setFieldDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-xl overflow-hidden"
                    style={{
                      top: dropdownPos.top,
                      left: dropdownPos.left,
                      width: dropdownPos.width,
                      maxHeight: "18rem",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-2 border-b border-gray-100 bg-white sticky top-0">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search fields..."
                        value={fieldSearch}
                        onChange={(e) => onFieldSearchChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Available Fields
                      </p>
                    </div>

                    <div className="overflow-auto" style={{ maxHeight: "14rem" }}>
                      {filteredFields.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => {
                            onUpdate({
                              fieldKey: f.key,
                              operator: "",
                              value: undefined,
                              valueFrom: undefined,
                              valueTo: undefined,
                            });
                            setFieldDropdownOpen(false);
                            onFieldSearchChange("");
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 text-gray-800"
                        >
                          {f.label}
                        </button>
                      ))}
                      {filteredFields.length === 0 && (
                        <p className="px-4 py-2 text-sm text-gray-400">
                          No fields match
                        </p>
                      )}
                    </div>
                  </div>
                </>,
                document.body
              )}
          </>
        )}
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
          className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
            className={`flex-1 min-w-[220px] px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white ${
              wantsMultiChoice ? "h-28" : ""
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
            className="flex-1 min-w-[220px] px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
