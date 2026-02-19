"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbGripVertical } from "react-icons/tb";
import { FiSearch, FiX } from "react-icons/fi";

export interface SortableFieldCatalogEntry {
  key: string;
  label: string;
}

export interface SortableFieldsEditModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when modal should close (Cancel or overlay) */
  onClose: () => void;
  /** Modal title (e.g. "Edit Fields - Organization Contact Info") */
  title: string;
  /** Short description above the list */
  description?: string;
  /** Current order of field keys (determines list order) */
  order: string[];
  /** Visibility map: key -> show/hide */
  visible: Record<string, boolean>;
  /** Catalog to resolve key -> label */
  fieldCatalog: SortableFieldCatalogEntry[];
  /** Toggle visibility for a field key */
  onToggle: (key: string) => void;
  /** Called when drag ends; parent should update order state using arrayMove(order, oldIndex, newIndex) */
  onDragEnd: (event: DragEndEvent) => void;
  /** Called when Save is clicked */
  onSave: () => void;
  /** Show loading state when catalog is empty */
  isLoading?: boolean;
  /** Save button label */
  saveButtonText?: string;
  /** Disable save (e.g. when no visible fields) */
  isSaveDisabled?: boolean;
  /** Optional list max height (default "50vh") */
  listMaxHeight?: string;
  /** Optional reset handler (e.g. restore default fields); when set, a Reset button is shown */
  onReset?: () => void;
  /** Label for the Reset button (default "Reset") */
  resetButtonText?: string;
}

// Internal sortable row (drag handle + checkbox + label)
function SortableFieldRow({
  id,
  label,
  checked,
  onToggle,
  isOverlay,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 border border-gray-200 rounded bg-white ${isOverlay ? "shadow-lg cursor-grabbing" : "hover:bg-gray-50"} ${isDragging && !isOverlay ? "invisible" : ""}`}
    >
      {!isOverlay && (
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none shrink-0"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={18} />
        </button>
      )}
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        disabled={isOverlay}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0"
      />
      <span className="text-sm text-gray-700 flex-1 truncate">{label}</span>
    </div>
  );
}

/**
 * Universal modal for editing a sortable list of fields with visibility toggles.
 * Use in organizations (contact info), leads (contact info), or any module that needs
 * "drag to reorder, check/uncheck to show/hide" with Save/Cancel.
 */
export default function SortableFieldsEditModal({
  open,
  onClose,
  title,
  description,
  order,
  visible,
  fieldCatalog,
  onToggle,
  onDragEnd,
  onSave,
  isLoading = false,
  saveButtonText = "Save",
  isSaveDisabled = false,
  listMaxHeight = "50vh",
  onReset,
  resetButtonText = "Reset",
}: SortableFieldsEditModalProps) {
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) setSearchQuery("");
  }, [open]);

  const getLabel = (key: string) => fieldCatalog.find((f) => f.key === key)?.label ?? key;
  const searchLower = searchQuery.trim().toLowerCase();
  const filteredOrder = useMemo(
    () =>
      searchLower
        ? order.filter(
          (key) =>
            getLabel(key).toLowerCase().includes(searchLower) || key.toLowerCase().includes(searchLower)
        )
        : order,
    [order, searchLower, fieldCatalog]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dropAnimationConfig = useMemo(
    () => ({
      sideEffects: defaultDropAnimationSideEffects({
        styles: { active: { opacity: "0.5" } },
      }),
    }),
    []
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    onDragEnd(event);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[93vh] overflow-y-auto">
        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-200">
            <span className="text-2xl font-bold"><FiX size={18} /></span>
          </button>
        </div>
        <div className="p-6 relative">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(e) => setDragActiveId(e.active.id as string)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragActiveId(null)}
          >
            <div className="relative">

              {description && <p className="text-sm text-gray-600 mb-4">{description}</p>}
              <div className="relative mb-3">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search fields..."
                  className={`w-full pl-9 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${searchQuery ? "pr-8" : "pr-3"}`}
                  aria-label="Search fields"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <SortableContext items={filteredOrder} strategy={verticalListSortingStrategy}>
                <div
                  className="space-y-2 overflow-y-auto border border-gray-200 rounded p-3"
                  style={{ maxHeight: "50vh" }}
                >
                  {isLoading && fieldCatalog.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">Loading fields...</div>
                  ) : filteredOrder.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      {searchQuery ? "No fields match your search." : "No fields to display."}
                    </div>
                  ) : (
                    filteredOrder.map((key, index) => (
                      <SortableFieldRow
                        key={`field-${key}-${index}`}
                        id={key}
                        label={getLabel(key)}
                        checked={visible[key] ?? false}
                        onToggle={() => onToggle(key)}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={dropAnimationConfig}>
                {dragActiveId ? (
                  <SortableFieldRow
                    id={dragActiveId}
                    label={getLabel(dragActiveId)}
                    checked={visible[dragActiveId] ?? false}
                    onToggle={() => { }}
                    isOverlay
                  />
                ) : null}
              </DragOverlay>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-300 mt-4 bg-white">
                {onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-00"
                  >
                    {resetButtonText}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  className="px-4 py-2 border border-gray-300 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaveDisabled}
                >
                  {saveButtonText}
                </button>
              </div>
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
