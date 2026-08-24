"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUp,
  FiRefreshCw,
} from "react-icons/fi";
import {
  canMoveSummaryPanel,
  catalogPanelIds,
  getSummaryCatalog,
  layoutsEqual,
  mergeSummaryLayout,
  moveSummaryPanel,
  type SummaryLayout,
  type SummaryMoveDirection,
} from "@/lib/summaryTabLayout";

type Props = {
  section: string;
};

export default function SummaryTabLayoutDesigner({ section }: Props) {
  const catalog = useMemo(() => getSummaryCatalog(section), [section]);
  const catalogIds = useMemo(() => catalogPanelIds(catalog), [catalog]);

  const [savedLayout, setSavedLayout] = useState<SummaryLayout>(
    catalog.systemDefault
  );
  const [draftLayout, setDraftLayout] = useState<SummaryLayout>(
    catalog.systemDefault
  );
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(
    catalog.panels[0]?.id ?? null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  const hasUnsavedChanges = !layoutsEqual(draftLayout, savedLayout);

  const loadLayout = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/admin/field-management/${section}/summary-layout`
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to load Summary Tab layout");
      }
      const merged = mergeSummaryLayout(
        data.layout,
        catalogIds,
        catalog.systemDefault
      );
      setSavedLayout(merged);
      setDraftLayout(merged);
      setSelectedPanelId((current) => {
        if (current && [...merged.left, ...merged.right].includes(current)) {
          return current;
        }
        return merged.left[0] || merged.right[0] || null;
      });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load layout"
      );
    } finally {
      setIsLoading(false);
    }
  }, [section, catalog.systemDefault, catalogIds]);

  useEffect(() => {
    if (!catalog.supported) {
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    void loadLayout();
  }, [catalog.supported, loadLayout]);

  const saveLayout = async (applyToUsers: boolean, resetToSystem = false) => {
    const payloadLayout = resetToSystem
      ? catalog.systemDefault
      : mergeSummaryLayout(draftLayout, catalogIds, catalog.systemDefault);

    if (applyToUsers) setIsApplying(true);
    else setIsSaving(true);

    try {
      const response = await fetch(
        `/api/admin/field-management/${section}/summary-layout`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layout: payloadLayout,
            applyToUsers,
            resetToSystem,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to save layout");
      }
      const merged = mergeSummaryLayout(
        data.layout,
        catalogIds,
        catalog.systemDefault
      );
      setSavedLayout(merged);
      setDraftLayout(merged);
      setShowApplyConfirm(false);

      if (applyToUsers) {
        const count = data.usersUpdated || 0;
        toast.success(
          count > 0
            ? `Summary Tab layout applied to ${count} user${count === 1 ? "" : "s"}`
            : "Summary Tab layout saved (no existing user configs to update)"
        );
      } else if (resetToSystem) {
        toast.success("Summary Tab layout reset to the system default");
      } else {
        toast.success("Summary Tab layout saved");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save layout"
      );
    } finally {
      setIsSaving(false);
      setIsApplying(false);
    }
  };

  const handleMove = (direction: SummaryMoveDirection) => {
    if (!selectedPanelId) return;
    if (!canMoveSummaryPanel(draftLayout, selectedPanelId, direction)) return;
    setDraftLayout(moveSummaryPanel(draftLayout, selectedPanelId, direction));
  };

  if (!catalog.supported) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded p-8 text-center text-gray-600">
          This module does not have a Summary Tab, so layout configuration is
          not available.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {loadError}
        </div>
        <button
          onClick={() => void loadLayout()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (catalog.panels.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded p-8 text-center text-gray-600">
          No Summary Tab panels are defined for this module.
        </div>
      </div>
    );
  }

  const renderColumn = (column: "left" | "right", title: string) => (
    <div className="flex flex-col gap-3 min-h-[280px]">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 px-1">
        {title}
      </div>
      <div className="flex-1 bg-gray-100 border border-dashed border-gray-300 rounded-lg p-3 space-y-3">
        {draftLayout[column].length === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-gray-400">
            No panels in this column
          </div>
        ) : (
          draftLayout[column].map((panelId) => {
            const panel = catalog.panels.find((item) => item.id === panelId);
            if (!panel) return null;
            const selected = selectedPanelId === panel.id;
            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => setSelectedPanelId(panel.id)}
                className={`w-full text-left rounded-md border bg-white shadow-sm transition-all ${
                  selected
                    ? "border-blue-500 ring-2 ring-blue-400 ring-offset-1"
                    : "border-gray-200 hover:border-gray-400"
                }`}
                style={{ minHeight: panel.height }}
              >
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">
                    {panel.title}
                  </span>
                  {selected && (
                    <span className="text-[10px] uppercase tracking-wide text-blue-600 font-semibold">
                      Selected
                    </span>
                  )}
                </div>
                <div className="px-3 py-4 text-xs text-gray-400">
                  Summary panel preview
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const moveDisabled = (direction: SummaryMoveDirection) =>
    !selectedPanelId ||
    isSaving ||
    isApplying ||
    !canMoveSummaryPanel(draftLayout, selectedPanelId, direction);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Summary Tab Layout
          </h2>
          <p className="text-sm text-gray-600">
            Select a panel, then move it in the grid. This preview uses the same
            two-column layout as the module Summary Tab.
            {hasUnsavedChanges && (
              <span className="ml-2 text-amber-700 font-medium">
                Unsaved changes
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadLayout()}
            className="p-2 hover:bg-gray-200 rounded"
            title="Reload saved layout"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={() => setDraftLayout(savedLayout)}
            disabled={!hasUnsavedChanges || isSaving || isApplying}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => setDraftLayout(catalog.systemDefault)}
            disabled={
              layoutsEqual(draftLayout, catalog.systemDefault) ||
              isSaving ||
              isApplying
            }
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset to system default
          </button>
          <button
            type="button"
            onClick={() => void saveLayout(false)}
            disabled={!hasUnsavedChanges || isSaving || isApplying}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save layout"}
          </button>
          <button
            type="button"
            onClick={() => setShowApplyConfirm(true)}
            disabled={isSaving || isApplying}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? "Applying..." : "Save & apply to users"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded p-3">
        <span className="text-sm text-gray-600 mr-1">Move selected panel:</span>
        {(
          [
            ["left", "Move left", FiArrowLeft],
            ["up", "Move up", FiArrowUp],
            ["down", "Move down", FiArrowDown],
            ["right", "Move right", FiArrowRight],
          ] as const
        ).map(([direction, label, Icon]) => (
          <button
            key={direction}
            type="button"
            onClick={() => handleMove(direction)}
            disabled={moveDisabled(direction)}
            className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title={label}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderColumn("left", "Left column")}
        {renderColumn("right", "Right column")}
      </div>

      {showApplyConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-lg w-full mx-4">
            <div className="bg-blue-600 p-4 rounded-t flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">
                Apply Summary Tab layout to all users
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-3">
                This will save the current Summary Tab layout and apply it to
                all existing users for this module.
              </p>
              <p className="text-gray-700 mb-4">
                User-specific Summary Tab layouts will be{" "}
                <strong>overwritten</strong>, matching Field Management column
                and panel defaults.
              </p>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                <p className="text-sm text-yellow-700">
                  This action affects all users and cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowApplyConfirm(false)}
                  disabled={isApplying}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveLayout(true)}
                  disabled={isApplying}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isApplying ? "Applying..." : "Save & apply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
