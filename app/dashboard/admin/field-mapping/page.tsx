// app/dashboard/admin/field-mapping/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useTopLoader } from "nextjs-toploader";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCenter,
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
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  FiChevronLeft,
  FiChevronsLeft,
  FiRefreshCw,
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiX,
  FiArrowLeft,
  FiInfo,
  FiArrowUp,
  FiArrowDown,
  FiFilter,
} from "react-icons/fi";
import { TbGripVertical } from "react-icons/tb";
import { entityFieldConfigs } from "@/lib/field-mapping-configs";
import { validateFieldMappingDefaultValue } from "@/lib/field-mapping-default-value";
import FieldMappingDefaultValueControl from "@/components/FieldMappingDefaultValueControl";
import type { FieldMappingLookupType } from "@/lib/field-mapping-default-value";

const LOOKUP_TYPES: FieldMappingLookupType[] = [
  "organizations",
  "hiring-managers",
  "job-seekers",
  "jobs",
  "owner",
];

function coerceLookupType(raw: unknown): FieldMappingLookupType {
  const s = String(raw ?? "").trim();
  return LOOKUP_TYPES.includes(s as FieldMappingLookupType)
    ? (s as FieldMappingLookupType)
    : "organizations";
}

// Define Field interface for type safety
interface CustomField {
  id: string;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_hidden: boolean;
  is_read_only?: boolean;
  sort_order: number;
  options?: string[];
  placeholder?: string;
  default_value?: string;
  lookup_type?: string;
  sub_field_ids?: number[] | string[];
  dependent_on_field_id?: string | null;
  created_by_name?: string;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

interface HistoryEntry {
  id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  changed_fields?: string[];
  performed_by_name: string;
  performed_at: string;
}

// Reusable Sortable & Filterable Header Component
interface SortableFilterableHeaderProps {
  label: string;
  columnKey: string;
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  filterValue: string;
  onSort: (key: string) => void;
  onFilterChange: (key: string, value: string) => void;
  filterType?: "text" | "boolean" | "number" | "date";
  filterPlaceholder?: string;
}

const SortableFilterableHeader = ({
  label,
  columnKey,
  sortConfig,
  filterValue,
  onSort,
  onFilterChange,
  filterType = "text",
  filterPlaceholder = "Filter...",
}: SortableFilterableHeaderProps) => {
  const isSorted = sortConfig?.key === columnKey;
  const sortDirection = isSorted ? sortConfig.direction : null;

  return (
    <th className="p-3 font-normal">
      <div className="flex flex-col gap-1">
        {/* Header with Sort Controls */}
        <div className="flex items-center gap-1">
          <span className="text-sm">{label}</span>
          <button
            onClick={() => onSort(columnKey)}
            className="p-1 hover:bg-gray-200 rounded flex items-center"
            title={
              isSorted
                ? `Sorted ${sortDirection === "asc" ? "ascending" : "descending"} - Click to ${sortDirection === "asc" ? "descend" : "ascend"}`
                : "Click to sort"
            }
          >
            {sortDirection === "asc" ? (
              <FiArrowUp size={14} className="text-blue-600" />
            ) : sortDirection === "desc" ? (
              <FiArrowDown size={14} className="text-blue-600" />
            ) : (
              <div className="flex flex-col">
                <FiArrowUp size={10} className="text-gray-400 -mb-1" />
                <FiArrowDown size={10} className="text-gray-400" />
              </div>
            )}
          </button>
        </div>

        {/* Filter Control */}
        <div className="relative">
          {filterType === "boolean" ? (
            <select
              value={filterValue}
              onChange={(e) => onFilterChange(columnKey, e.target.value)}
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          ) : (
            <input
              type={filterType === "number" ? "number" : filterType === "date" ? "date" : "text"}
              value={filterValue}
              onChange={(e) => onFilterChange(columnKey, e.target.value)}
              placeholder={filterPlaceholder}
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {filterValue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange(columnKey, "");
              }}
              className="absolute right-1 top-1 text-gray-400 hover:text-gray-600"
              title="Clear filter"
            >
              <FiX size={12} />
            </button>
          )}
        </div>
      </div>
    </th>
  );
};

const FieldMapping = () => {
  const MAX_FIELDS_PER_SECTION = 500;
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const topLoader = useTopLoader();
  const section = searchParams.get("section") || "jobs";

  const [showCount, setShowCount] = useState("200");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<CustomField | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFieldNamingModal, setShowFieldNamingModal] = useState(false);
  const [fieldHistory, setFieldHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [fieldColumnNames, setFieldColumnNames] = useState<{
    [key: string]: string;
  }>({
    field1: "Field Label",
    field2: "Field Name",
    field3: "Field Type",
    field4: "Hidden",
    field5: "Required",
    field6: "Sort Order",
    field7: "Last Modified",
    field8: "Modified By",
  });
  const [editFormData, setEditFormData] = useState({
    fieldName: "",
    fieldLabel: "",
    fieldType: "text",
    isRequired: false,
    isHidden: false,
    isReadOnly: false,
    sortOrder: 0,
    options: [] as string[],
    placeholder: "",
    defaultValue: "",
    lookupType: "organizations" as FieldMappingLookupType,
    subFieldIds: [] as string[],
    isDependent: false,
    dependentOnFieldId: "",
  });
  const fieldLocks = useMemo(() => {
    if (!section || !editFormData.fieldName) return null;
    const configs = entityFieldConfigs[section] || [];
    return configs.find((c) => c.name === editFormData.fieldName) || null;
  }, [section, editFormData.fieldName]);
  const [defaultValueValidationError, setDefaultValueValidationError] = useState<
    string | null
  >(null);
  /** Live duplicate field_label within module (admin); server + browser cache ~2 min. */
  const [labelDuplicate, setLabelDuplicate] = useState<{
    conflictingFieldName?: string;
  } | null>(null);
  const labelCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSavingField, setIsSavingField] = useState(false);
  const [orderedFields, setOrderedFields] = useState<CustomField[]>([]);
  const [savedOrderSnapshot, setSavedOrderSnapshot] = useState<CustomField[]>([]);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  // Filtering state (per column)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    field_name: "",
    field_label: "",
    field_type: "",
    is_hidden: "",
    is_required: "",
    sort_order: "",
    updated_at: "",
    updated_by: "",
  });

  const editTypeOptions = [
    "text",
    "email",
    "phone",
    "number",
    "percentage",
    "date",
    "currency",
    "datetime",
    "textarea",
    "select",
    "multiselect",
    "multicheckbox",
    "checkbox",
    "radio",
    "url",
    "link",
    "file",
    "lookup",
    "multiselect_lookup",
    "composite",
  ];

  // Load custom fields on component mount
  useEffect(() => {
    fetchCustomFields();
  }, [section]);

  useEffect(() => {
    if (!showEditForm && !showAddForm) {
      setLabelDuplicate(null);
      return;
    }
    if (fieldLocks?.is_label_locked) {
      setLabelDuplicate(null);
      return;
    }
    const label = editFormData.fieldLabel.trim();
    if (!label) {
      setLabelDuplicate(null);
      return;
    }

    const ac = new AbortController();
    if (labelCheckTimerRef.current) {
      clearTimeout(labelCheckTimerRef.current);
    }
    labelCheckTimerRef.current = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({
          entity_type: section,
          field_label: label,
        });
        if (selectedField?.id) {
          qs.set("exclude_id", String(selectedField.id));
        }
        const res = await fetch(
          `/api/custom-fields/check-label-unique?${qs.toString()}`,
          { signal: ac.signal, cache: "no-store" }
        );
        const data = await res.json();
        if (!data.success) {
          setLabelDuplicate(null);
          return;
        }
        if (data.unique) {
          setLabelDuplicate(null);
        } else {
          setLabelDuplicate({
            conflictingFieldName: data.conflicting_field_name,
          });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setLabelDuplicate(null);
        }
      }
    }, 450);

    return () => {
      ac.abort();
      if (labelCheckTimerRef.current) {
        clearTimeout(labelCheckTimerRef.current);
        labelCheckTimerRef.current = null;
      }
    };
  }, [
    showEditForm,
    showAddForm,
    editFormData.fieldLabel,
    section,
    selectedField?.id,
    fieldLocks?.is_label_locked,
  ]);

  const fetchCustomFields = async () => {
    topLoader.start();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/field-management/${section}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch custom fields");
      }

      const sortedByOrder = [...(data.customFields || [])].sort(
        (a: CustomField, b: CustomField) =>
          (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
          (b.sort_order ?? Number.MAX_SAFE_INTEGER)
      );
      setCustomFields(sortedByOrder);
      setOrderedFields(sortedByOrder);
      setSavedOrderSnapshot(sortedByOrder);
    } catch (err) {
      console.error("Error fetching custom fields:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
      topLoader.done();
    }
  };

  const fetchFieldHistory = async (fieldId: string) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/admin/field-management/fields/${fieldId}/history`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch custom field history");
      }

      setFieldHistory(data.history || []);
    } catch (err) {
      console.error("Error fetching field history:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching history"
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFieldClick = (field: CustomField) => {
    topLoader.start();
    setDefaultValueValidationError(null);
    setLabelDuplicate(null);
    setSelectedField(field);
    const subIds = field.sub_field_ids;
    const depId = (field as any).dependent_on_field_id;
    setEditFormData({
      fieldName: field.field_name,
      fieldLabel: field.field_label,
      fieldType: field.field_type,
      isRequired: field.is_required,
      isHidden: field.is_hidden,
      isReadOnly: Boolean((field as any).is_read_only),
      sortOrder: field.sort_order,
      options: Array.isArray(field.options)
        ? (field.options as string[]).map((o) => String(o).trim()).filter(Boolean)
        : [],
      placeholder: (field.placeholder || "").trim(),
      defaultValue: (field.default_value || "").trim(),
      lookupType: coerceLookupType((field as any).lookup_type),
      subFieldIds: Array.isArray(subIds) ? subIds.map(String) : [],
      isDependent: Boolean(depId),
      dependentOnFieldId: depId != null ? String(depId) : "",
    });
    setShowEditForm(true);
    window.setTimeout(() => topLoader.done(), 240);
  };

  const handleShowHistory = async (field: CustomField) => {
    setSelectedField(field);
    setShowHistoryModal(true);
    topLoader.start();
    try {
      await fetchFieldHistory(field.id);
    } finally {
      topLoader.done();
    }
  };

  const handleAddField = () => {
    setDefaultValueValidationError(null);
    setLabelDuplicate(null);
    if (customFields.length >= MAX_FIELDS_PER_SECTION) {
      toast.error(`You can add up to ${MAX_FIELDS_PER_SECTION} fields per section.`);
      return;
    }
    // Generate the next sequential field name
    const nextFieldNumber = getNextFieldNumber();
    const autoGeneratedFieldName = `Field_${nextFieldNumber}`;

    setEditFormData({
      fieldName: autoGeneratedFieldName,
      fieldLabel: "",
      fieldType: "text",
      isRequired: false,
      isHidden: false,
      isReadOnly: false,
      sortOrder: customFields.length + 1,
      options: [],
      placeholder: "",
      defaultValue: "",
      lookupType: "organizations",
      subFieldIds: [],
      isDependent: false,
      dependentOnFieldId: "",
    });
    setSelectedField(null);
    topLoader.start();
    setShowAddForm(true);
    window.setTimeout(() => topLoader.done(), 240);
  };

  // Helper function to generate the next field number
  const getNextFieldNumber = () => {
    // Extract all existing field numbers from field names
    const existingNumbers = customFields
      .map((field) => {
        const match = field.field_name.match(/^Field_(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((num) => num > 0);

    // Find the highest number and add 1
    const maxNumber =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return maxNumber + 1;
  };

  const handleEditFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setEditFormData((prev) => {
      const newData = {
        ...prev,
        [name]:
          type === "checkbox"
            ? checked
            : type === "number"
              ? parseInt(value) || 0
              : value,
      };

      if (name === "fieldType") {
        newData.defaultValue = "";
      }
      if (name === "lookupType") {
        newData.defaultValue = "";
      }

      // Read-only: when checked, required is auto-disabled
      if (name === "isReadOnly" && checked === true) {
        newData.isRequired = false;
      }
      // Critical: Enforce Hidden & Required mutual exclusivity
      if (name === "isRequired" && checked === true) {
        newData.isHidden = false;
      } else if (name === "isHidden" && checked === true) {
        newData.isRequired = false;
      }

      return newData;
    });
    if (name === "fieldType" || name === "lookupType") {
      setDefaultValueValidationError(null);
    }
  };

  const handleDefaultValueChange = (next: string) => {
    setDefaultValueValidationError(null);
    setEditFormData((prev) => ({ ...prev, defaultValue: next }));
  };

  const handleOptionChange = (index: number, value: string) => {
    setEditFormData((prev) => {
      const next = [...prev.options];
      if (index === 0 && next.length === 0) {
        return { ...prev, options: [value] };
      }
      if (index >= 0 && index < next.length) next[index] = value;
      return { ...prev, options: next };
    });
  };

  const handleAddOption = () => {
    setEditFormData((prev) => ({ ...prev, options: [...prev.options, ""] }));
  };

  const handleRemoveOption = (index: number) => {
    setEditFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };


  const handleSaveField = async () => {
      let apiData: Record<string, unknown>;
      let response: Response;
      if (!selectedField && customFields.length >= MAX_FIELDS_PER_SECTION) {
        toast.error(
          `Maximum limit reached: You can only add up to ${MAX_FIELDS_PER_SECTION} fields per section.`
        );
        return;
      }

      const trimmedOptionList = editFormData.options
        .map((o: string) => o.trim())
        .filter(Boolean);
      const defaultCheck = validateFieldMappingDefaultValue({
        fieldType: editFormData.fieldType,
        value: editFormData.defaultValue,
        options: trimmedOptionList,
        lookupType: editFormData.lookupType,
      });
      if (!defaultCheck.ok) {
        setDefaultValueValidationError(defaultCheck.message);
        toast.error(defaultCheck.message);
        return;
      }
      if (
        labelDuplicate &&
        editFormData.fieldLabel.trim() &&
        !fieldLocks?.is_label_locked
      ) {
        toast.error(
          `This label is already used in this module (field name: ${labelDuplicate.conflictingFieldName || "other"}).`
        );
        return;
      }
      setDefaultValueValidationError(null);
      const defaultValueForApi =
        defaultCheck.normalized.trim() !== "" ? defaultCheck.normalized : null;

      setIsSavingField(true);
      try {
      if (selectedField) {
        // Update existing field - only send changed fields
        apiData = {
          fieldLabel: editFormData.fieldLabel,
          fieldType: editFormData.fieldType,
          isRequired: editFormData.isRequired,
          isHidden: editFormData.isHidden,
          isReadOnly: editFormData.isReadOnly,
          sortOrder: editFormData.sortOrder,
          options:
            editFormData.options.length > 0
              ? editFormData.options.map((o: string) => o.trim()).filter(Boolean)
              : null,
          placeholder: editFormData.placeholder || null,
          defaultValue: defaultValueForApi,
          lookupType:
            editFormData.fieldType === "lookup" || editFormData.fieldType === "multiselect_lookup"
              ? editFormData.lookupType
              : null,
          subFieldIds:
            editFormData.fieldType === "composite" && editFormData.subFieldIds.length > 0
              ? editFormData.subFieldIds.map((id) => (typeof id === "string" && /^\d+$/.test(id) ? parseInt(id, 10) : id))
              : undefined,
          dependentOnFieldId:
            editFormData.isDependent && editFormData.dependentOnFieldId
              ? editFormData.dependentOnFieldId
              : null,
        };

        console.log("Updating field with data:", apiData);
        console.log("Field ID:", selectedField.id);

        response = await fetch(
          `/api/admin/field-management/fields/${selectedField.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(apiData),
          }
        );
      } else {
        // Create new field - include all required fields
        apiData = {
          entityType: section,
          fieldName: editFormData.fieldName,
          fieldLabel: editFormData.fieldLabel,
          fieldType: editFormData.fieldType,
          isRequired: editFormData.isRequired,
          isHidden: editFormData.isHidden,
          isReadOnly: editFormData.isReadOnly,
          sortOrder: editFormData.sortOrder,
          options:
            editFormData.options.length > 0
              ? editFormData.options.map((o: string) => o.trim()).filter(Boolean)
              : null,
          placeholder: editFormData.placeholder || null,
          defaultValue: defaultValueForApi,
          lookupType:
            editFormData.fieldType === "lookup" || editFormData.fieldType === "multiselect_lookup"
              ? editFormData.lookupType
              : null,
          subFieldIds:
            editFormData.fieldType === "composite" && editFormData.subFieldIds.length > 0
              ? editFormData.subFieldIds.map((id) => (typeof id === "string" && /^\d+$/.test(id) ? parseInt(id, 10) : id))
              : undefined,
          dependentOnFieldId:
            editFormData.isDependent && editFormData.dependentOnFieldId
              ? editFormData.dependentOnFieldId
              : null,
        };

        console.log("Creating field with data:", apiData);

        response = await fetch(`/api/admin/field-management/${section}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiData),
        });
      }

      const data = await response.json();
      console.log("Response status:", response.status);
      console.log("Response data:", data);

      if (!response.ok) {
        if (response.status === 409) {
          const cfn =
            data.conflictingFieldName ?? data.conflicting_field_name;
          if (cfn) {
            setLabelDuplicate({ conflictingFieldName: String(cfn) });
          }
        }
        toast.error(data.message || "Failed to save field");
        return;
      }

      // Refresh the fields list
      await fetchCustomFields();

      // Close the form
      setShowEditForm(false);
      setShowAddForm(false);
      setSelectedField(null);
      } catch (err) {
        console.error("Error saving field:", err);
        toast.error(
          err instanceof Error
            ? err.message
            : "An error occurred while saving the field"
        );
      } finally {
        setIsSavingField(false);
      }
  };

  // Fixed toggle functions with API calls - with mutual exclusivity
  const toggleFieldRequired = async (field: CustomField) => {
    try {
      // If setting Required to true, ensure Hidden is false
      const newRequiredValue = !field.is_required;
      const updateData: any = { isRequired: newRequiredValue };

      // Critical: If Required is being set to true, also set Hidden to false
      if (newRequiredValue === true) {
        updateData.isHidden = false;
      }

      console.log("Toggling field required status:", updateData);
      console.log("Field ID:", field.id);
      console.log("API URL:", `/api/admin/field-management/fields/${field.id}`);

      const response = await fetch(
        `/api/admin/field-management/fields/${field.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      console.log("Toggle required response status:", response.status);
      console.log("Toggle required response headers:", response.headers);

      let data;
      try {
        data = await response.json();
        console.log("Toggle required response data:", data);
      } catch (jsonError) {
        console.error("Error parsing JSON response:", jsonError);
        const textResponse = await response.text();
        console.log("Raw response text:", textResponse);
        throw new Error("Invalid response format from server");
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      // Refresh the fields list
      await fetchCustomFields();
    } catch (err) {
      console.error("Error updating field:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while updating the custom field";
      toast.error(`Failed to update field status: ${errorMessage}`);
    }
  };

  const toggleFieldHidden = async (field: CustomField) => {
    try {
      // If setting Hidden to true, ensure Required is false
      const newHiddenValue = !field.is_hidden;
      const updateData: any = { isHidden: newHiddenValue };

      // Critical: If Hidden is being set to true, also set Required to false
      if (newHiddenValue === true) {
        updateData.isRequired = false;
      }

      console.log("Toggling field hidden status:", updateData);
      console.log("Field ID:", field.id);
      console.log("API URL:", `/api/admin/field-management/fields/${field.id}`);

      const response = await fetch(
        `/api/admin/field-management/fields/${field.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      console.log("Toggle hidden response status:", response.status);
      console.log("Toggle hidden response headers:", response.headers);

      let data;
      try {
        data = await response.json();
        console.log("Toggle hidden response data:", data);
      } catch (jsonError) {
        console.error("Error parsing JSON response:", jsonError);
        const textResponse = await response.text();
        console.log("Raw response text:", textResponse);
        throw new Error("Invalid response format from server");
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      // Refresh the fields list
      await fetchCustomFields();
    } catch (err) {
      console.error("Error updating field:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while updating the custom field";
      toast.error(`Failed to update field status: ${errorMessage}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const hasActiveFilters = Object.values(columnFilters).some(
    (value) => value.trim() !== ""
  );
  const canDragReorder =
    !sortConfig && !hasActiveFilters && !isLoading;
  const fieldsSource = orderedFields.length > 0 ? orderedFields : customFields;
  const hasUnsavedOrderChanges =
    orderedFields.length === savedOrderSnapshot.length &&
    orderedFields.some(
      (field, index) => String(field.id) !== String(savedOrderSnapshot[index]?.id)
    );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const dropAnimationConfig = useMemo(
    () => ({
      duration: 140,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      sideEffects: defaultDropAnimationSideEffects({
        styles: { active: { opacity: "0.65" } },
      }),
    }),
    []
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    if (!canDragReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedFields((prev) => {
      const oldIndex = prev.findIndex((field) => String(field.id) === String(active.id));
      const newIndex = prev.findIndex((field) => String(field.id) === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((field, index) => ({
        ...field,
        sort_order: index + 1,
      }));
    });
  };

  const handleSaveFieldOrder = async () => {
    if (!hasUnsavedOrderChanges) return;
    setIsSavingOrder(true);

    const previousSnapshot = [...savedOrderSnapshot];
    try {
      const payload = {
        items: orderedFields.map((field, index) => ({
          id: Number(field.id),
          sort_order: index + 1,
        })),
      };
      const response = await fetch(
        `/api/admin/field-management/${section}/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to save field order");
      }

      const sortedByOrder = [...(data.customFields || [])].sort(
        (a: CustomField, b: CustomField) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      setCustomFields(sortedByOrder);
      setOrderedFields(sortedByOrder);
      setSavedOrderSnapshot(sortedByOrder);
      toast.success("Field order saved");
    } catch (err) {
      setOrderedFields(previousSnapshot);
      toast.error(
        err instanceof Error ? err.message : "Failed to save field order"
      );
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDiscardFieldOrder = () => {
    setOrderedFields(savedOrderSnapshot);
    setDragActiveId(null);
  };

  const handleGoBack = () => {
    router.push("/dashboard/admin/field-management");
  };

  const handleUpdateColumnName = (fieldKey: string, newName: string) => {
    setFieldColumnNames((prev) => ({
      ...prev,
      [fieldKey]: newName,
    }));
  };

  // Field Naming Modal Component
  const FieldNamingModal = ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
        <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
          <div className="bg-gray-200 p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Field Column Definitions</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-200">
              <FiX size={20} />
            </button>
          </div>
          <div className="p-6">
            <p className="text-gray-600 mb-4">
              The table columns are numbered for easy reference. You can
              customize the column names below:
            </p>
            <div className="space-y-4">
              {Object.entries(fieldColumnNames).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-4">
                  <div className="w-20 font-semibold text-blue-600 capitalize">
                    {key.replace("field", "Field ")}:
                  </div>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      handleUpdateColumnName(key, e.target.value)
                    }
                    className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded border-l-4 border-blue-500">
              <h3 className="font-semibold text-blue-800 mb-2">
                Field Customization
              </h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Click on Field 4 (Hidden) to toggle field visibility</li>
                <li>
                  • Click on Field 5 (Required) to toggle whether the field is
                  mandatory
                </li>
                <li>• Click the edit icon to modify field properties</li>
                <li>
                  • Use "Add Custom Field" to create new fields with custom
                  names
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryModal = () => {
    if (!showHistoryModal || !selectedField) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
        <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
          <div className="bg-gray-200 p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              History for "{selectedField.field_label}"
            </h2>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="p-1 rounded hover:bg-gray-200"
            >
              <FiX size={20} />
            </button>
          </div>
          <div className="p-6">
            {isLoadingHistory ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : fieldHistory.length > 0 ? (
              <div className="space-y-4">
                {fieldHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${entry.action === "CREATE"
                            ? "bg-green-100 text-green-800"
                            : entry.action === "UPDATE"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                            }`}
                        >
                          {entry.action}
                        </span>
                        <span className="ml-2 font-medium">
                          {entry.performed_by_name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDate(entry.performed_at)}
                      </span>
                    </div>

                    {entry.action === "UPDATE" &&
                      entry.changed_fields &&
                      entry.changed_fields.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm font-medium text-gray-700 mb-1">
                            Changed fields: {entry.changed_fields.join(", ")}
                          </div>
                          {entry.old_values && entry.new_values && (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="font-medium text-red-600">
                                  Before:
                                </div>
                                <pre className="bg-red-50 p-2 rounded text-xs overflow-auto">
                                  {JSON.stringify(entry.old_values, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="font-medium text-green-600">
                                  After:
                                </div>
                                <pre className="bg-green-50 p-2 rounded text-xs overflow-auto">
                                  {JSON.stringify(entry.new_values, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-center py-8">
                No history records found
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Handle column sorting
  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        // Toggle direction if same column
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      // New column, default to ascending
      return { key, direction: "asc" };
    });
  };

  // Handle column filtering
  const handleFilterChange = (columnKey: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [columnKey]: value,
    }));
  };

  // Apply column filters
  const filteredFields = fieldsSource.filter((field) => {
    // Field Name filter
    if (
      columnFilters.field_name &&
      !field.field_name
        .toLowerCase()
        .includes(columnFilters.field_name.toLowerCase())
    ) {
      return false;
    }

    // Field Label filter
    if (
      columnFilters.field_label &&
      !field.field_label
        .toLowerCase()
        .includes(columnFilters.field_label.toLowerCase())
    ) {
      return false;
    }

    // Field Type filter
    if (
      columnFilters.field_type &&
      !field.field_type
        .toLowerCase()
        .includes(columnFilters.field_type.toLowerCase())
    ) {
      return false;
    }

    // Hidden filter (boolean)
    if (columnFilters.is_hidden) {
      const filterValue = columnFilters.is_hidden.toLowerCase();
      if (filterValue === "yes" || filterValue === "true" || filterValue === "1") {
        if (!field.is_hidden) return false;
      } else if (filterValue === "no" || filterValue === "false" || filterValue === "0") {
        if (field.is_hidden) return false;
      } else if (filterValue !== "") {
        // Partial match on string representation
        if (!String(field.is_hidden).toLowerCase().includes(filterValue)) {
          return false;
        }
      }
    }

    // Required filter (boolean)
    if (columnFilters.is_required) {
      const filterValue = columnFilters.is_required.toLowerCase();
      if (filterValue === "yes" || filterValue === "true" || filterValue === "1") {
        if (!field.is_required) return false;
      } else if (filterValue === "no" || filterValue === "false" || filterValue === "0") {
        if (field.is_required) return false;
      } else if (filterValue !== "") {
        if (!String(field.is_required).toLowerCase().includes(filterValue)) {
          return false;
        }
      }
    }

    // Sort Order filter (number)
    if (
      columnFilters.sort_order &&
      !String(field.sort_order)
        .toLowerCase()
        .includes(columnFilters.sort_order.toLowerCase())
    ) {
      return false;
    }

    // Updated At filter (date)
    if (
      columnFilters.updated_at &&
      !formatDate(field.updated_at)
        .toLowerCase()
        .includes(columnFilters.updated_at.toLowerCase())
    ) {
      return false;
    }

    // Updated By filter
    if (
      columnFilters.updated_by &&
      !(field.updated_by_name || field.created_by_name || "System")
        .toLowerCase()
        .includes(columnFilters.updated_by.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  // Apply sorting
  const sortedFields = [...filteredFields].sort((a, b) => {
    if (!sortConfig) return 0;

    const { key, direction } = sortConfig;
    let aValue: any;
    let bValue: any;

    switch (key) {
      case "field_name":
        aValue = a.field_name.toLowerCase();
        bValue = b.field_name.toLowerCase();
        break;
      case "field_label":
        aValue = a.field_label.toLowerCase();
        bValue = b.field_label.toLowerCase();
        break;
      case "field_type":
        aValue = a.field_type.toLowerCase();
        bValue = b.field_type.toLowerCase();
        break;
      case "is_hidden":
        aValue = a.is_hidden ? 1 : 0;
        bValue = b.is_hidden ? 1 : 0;
        break;
      case "is_required":
        aValue = a.is_required ? 1 : 0;
        bValue = b.is_required ? 1 : 0;
        break;
      case "sort_order":
        aValue = a.sort_order;
        bValue = b.sort_order;
        break;
      case "updated_at":
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
        break;
      case "updated_by":
        aValue = (a.updated_by_name || a.created_by_name || "System").toLowerCase();
        bValue = (b.updated_by_name || b.created_by_name || "System").toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const visibleFields = sortedFields.slice(0, parseInt(showCount));
  const visibleFieldIds = useMemo(
    () => visibleFields.map((field) => String(field.id)),
    [visibleFields]
  );
  const activeDragField =
    dragActiveId != null
      ? visibleFields.find((field) => String(field.id) === String(dragActiveId)) ||
      orderedFields.find((field) => String(field.id) === String(dragActiveId))
      : null;

  const SortableTableRow = ({ field }: { field: CustomField }) => {
    const locks = useMemo(() => {
      if (!section) return null;
      return entityFieldConfigs[section]?.find((c) => c.name === field.field_name) || null;
    }, [field.field_name]);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
      useSortable({
        id: String(field.id),
        disabled: !canDragReorder,
        transition: {
          duration: 160,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      willChange: "transform",
    };

    return (
      <tr
        ref={setNodeRef}
        style={style}
        onClick={() => handleFieldClick(field)}
        className={`border-t border-gray-200 hover:bg-gray-50 cursor-pointer ${isDragging ? "invisible" : ""}`}
      >
        <td className="p-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex space-x-1">
            <button
              {...attributes}
              {...listeners}
              disabled={!canDragReorder}
              className={`p-1 text-gray-400 hover:text-gray-600 touch-none shrink-0 ${canDragReorder ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50"}`}
              title={
                canDragReorder
                  ? "Drag to reorder"
                  : "Clear table sort/filter to enable drag reorder"
              }
              onClick={(e) => e.stopPropagation()}
            >
              <TbGripVertical size={16} />
            </button>
            <button
              onClick={() => handleFieldClick(field)}
              className="text-blue-500 hover:text-blue-700"
              title="Edit"
            >
              <FiEdit2 size={14} />
            </button>
            <button
              onClick={() => handleShowHistory(field)}
              className="text-green-500 hover:text-green-700"
              title="View History"
            >
              <FiClock size={14} />
            </button>
          </div>
        </td>
        <td className="p-3">
          <span className="text-sm font-mono">{field.field_name}</span>
        </td>
        <td className="p-3 text-sm font-medium">{field.field_label}</td>
        <td className="p-3 text-sm">{field.field_type}</td>
        <td className="p-3 text-center">
          <button
            onClick={(e) => {
              if (locks?.is_hidden_locked) return;
              e.preventDefault();
              e.stopPropagation();
              toggleFieldHidden(field);
            }}
            disabled={field.is_required} // Keep original disabled for business logic
            className={`h-4 w-4 rounded flex items-center justify-center ${field.is_required
              ? "bg-gray-200 cursor-not-allowed opacity-50"
              : locks?.is_hidden_locked
                ? "bg-gray-200 cursor-not-allowed"
                : field.is_hidden
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-gray-200 hover:bg-gray-400"
              }`}
            title={
              locks?.is_hidden_locked
                ? "Hidden status is locked"
                : field.is_required
                  ? "Cannot hide a required field - Uncheck Required first"
                  : field.is_hidden
                    ? "Hidden - Click to show"
                    : "Visible - Click to hide"
            }
          >
            {field.is_hidden && !field.is_required && (
              <span className="text-xs leading-none">✓</span>
            )}
          </button>
        </td>
        <td className="p-3 text-center">
          <button
            onClick={(e) => {
              if (locks?.is_required_locked) return;
              e.preventDefault();
              e.stopPropagation();
              toggleFieldRequired(field);
            }}
            disabled={field.is_hidden} // Keep original disabled for business logic
            className={`h-4 w-4 rounded flex items-center justify-center ${field.is_hidden
              ? "bg-gray-200 cursor-not-allowed opacity-50"
              : locks?.is_required_locked
                ? "bg-gray-200 cursor-not-allowed"
                : field.is_required
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-gray-200 hover:bg-gray-400"
              }`}
            title={
              locks?.is_required_locked
                ? "Required status is locked"
                : field.is_hidden
                  ? "Cannot require a hidden field - Uncheck Hidden first"
                  : field.is_required
                    ? "Required - Click to make optional"
                    : "Optional - Click to make required"
            }
          >
            {field.is_required && !field.is_hidden && (
              <span className="text-xs leading-none">✓</span>
            )}
          </button>
        </td>
        <td className="p-3">
          <span className="text-sm px-2 py-1">
            {field.sort_order}
          </span>
        </td>
        <td className="p-3 text-sm">{formatDate(field.updated_at)}</td>
        <td className="p-3 text-sm">
          {field.updated_by_name || field.created_by_name || "System"}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-gray-200 min-h-screen">
      {/* Header Bar */}
      <div className="bg-gray-50 border-b border-gray-300 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm">
            <button
              onClick={handleGoBack}
              className="hover:bg-gray-200 p-1 rounded mr-2 flex items-center"
              title="Go back to Field Management"
            >
              <FiArrowLeft size={16} className="mr-1" />
              Back
            </button>
            <span className="font-medium capitalize">
              {section.replace("-", " ")}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFieldNamingModal(true)}
              className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              title="View field column definitions"
            >
              <FiInfo size={14} className="mr-1" />
              Field Guide
            </button>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-100 p-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="text-sm mr-2">Show</span>
            <select
              value={showCount}
              onChange={(e) => setShowCount(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
            <span className="text-sm ml-2">entries</span>
          </div>
          <button
            onClick={fetchCustomFields}
            className="p-1 hover:bg-gray-200 rounded"
            title="Refresh"
          >
            <FiRefreshCw size={16} />
          </button>
          <span className="text-sm">Refresh</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDiscardFieldOrder}
            disabled={!hasUnsavedOrderChanges || isSavingOrder}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Discard unsaved order changes"
          >
            Discard Order
          </button>
          <button
            onClick={handleSaveFieldOrder}
            disabled={!hasUnsavedOrderChanges || isSavingOrder}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save field order"
          >
            {isSavingOrder ? "Saving..." : "Save Order"}
          </button>
          <button
            onClick={handleAddField}
            disabled={true}
            className="flex items-center px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed opacity-70"
            title="Adding new custom fields is currently disabled"
          >
            <FiPlus size={16} className="mr-1" />
            Add Custom Field
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-xs text-gray-600 bg-blue-50 border-b border-blue-200">
        {canDragReorder
          ? "Drag fields using the handle in Actions, then click Save Order."
          : "Drag reordering is available only when no table sort/filter is active."}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
          {error}
        </div>
      )}

      {/* Loading Display */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Table Container */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event) => setDragActiveId(String(event.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragActiveId(null)}
            autoScroll={true}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <div className="bg-white shadow overflow-x-auto relative">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm">
                    <th className="p-3 font-normal w-16">Actions</th>

                    <SortableFilterableHeader
                      label={fieldColumnNames.field2}
                      columnKey="field_name"
                      sortConfig={sortConfig}
                      filterValue={columnFilters.field_name}
                      onSort={handleSort}
                      onFilterChange={handleFilterChange}
                      filterType="text"
                      filterPlaceholder="Filter name..."
                    />

                    <SortableFilterableHeader
                      label={fieldColumnNames.field1}
                      columnKey="field_label"
                      sortConfig={sortConfig}
                      filterValue={columnFilters.field_label}
                      onSort={handleSort}
                      onFilterChange={handleFilterChange}
                      filterType="text"
                      filterPlaceholder="Filter label..."
                    />

                    <SortableFilterableHeader
                      label={fieldColumnNames.field3}
                      columnKey="field_type"
                      sortConfig={sortConfig}
                      filterValue={columnFilters.field_type}
                      onSort={handleSort}
                      onFilterChange={handleFilterChange}
                      filterType="text"
                      filterPlaceholder="Filter type..."
                    />

                    <SortableFilterableHeader
                      label={fieldColumnNames.field4}
                      columnKey="is_hidden"
                      sortConfig={sortConfig}
                      filterValue={columnFilters.is_hidden}
                      onSort={handleSort}
                      onFilterChange={handleFilterChange}
                      filterType="boolean"
                      filterPlaceholder="All"
                    />

                    <SortableFilterableHeader
                      label={fieldColumnNames.field5}
                      columnKey="is_required"
                      sortConfig={sortConfig}
                      filterValue={columnFilters.is_required}
                      onSort={handleSort}
                      onFilterChange={handleFilterChange}
                      filterType="boolean"
                      filterPlaceholder="All"
                    />

                    <SortableFilterableHeader
                      label={fieldColumnNames.field6}
                      columnKey="sort_order"
                      sortConfig={sortConfig}
                      filterValue={columnFilters.sort_order}
                      onSort={handleSort}
                      onFilterChange={handleFilterChange}
                      filterType="number"
                      filterPlaceholder="Filter order..."
                    />

                    <SortableFilterableHeader
                      label={fieldColumnNames.field7}
                      columnKey="updated_at"
                      sortConfig={sortConfig}
                      filterValue={columnFilters.updated_at}
                      onSort={handleSort}
                      onFilterChange={handleFilterChange}
                      filterType="text"
                      filterPlaceholder="Filter date..."
                    />

                    <SortableFilterableHeader
                      label={fieldColumnNames.field8}
                      columnKey="updated_by"
                      sortConfig={sortConfig}
                      filterValue={columnFilters.updated_by}
                      onSort={handleSort}
                      onFilterChange={handleFilterChange}
                      filterType="text"
                      filterPlaceholder="Filter user..."
                    />
                  </tr>
                </thead>
                <SortableContext
                  items={visibleFieldIds}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody>
                    {visibleFields.map((field) => (
                      <SortableTableRow key={field.id} field={field} />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </div>
            <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeDragField ? (
                <div className="flex items-center gap-2 p-2 border border-gray-200 rounded bg-white shadow-lg cursor-grabbing min-w-[420px]">
                  <span className="p-1 text-gray-400 shrink-0">
                    <TbGripVertical size={16} />
                  </span>
                  <span className="text-sm font-medium text-gray-800">
                    {activeDragField.field_label}
                  </span>
                  <span className="text-xs text-gray-500 truncate">
                    ({activeDragField.field_name})
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Footer Info */}
          <div className="bg-gray-200 p-2 text-sm text-gray-600">
            Showing {visibleFields.length} of {sortedFields.length} entries (Total: {customFields.length})
          </div>
        </>
      )}

      {/* Edit/Add Form Modal */}
      {(showEditForm || showAddForm) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Edit Custom Field
              </h2>
              <div className="space-x-2">
                <button
                  type="button"
                  disabled={isSavingField}
                  onClick={() => {
                    setShowEditForm(false);
                    setShowAddForm(false);
                    setSelectedField(null);
                    setDefaultValueValidationError(null);
                    setLabelDuplicate(null);
                    setIsSavingField(false);
                  }}
                  className="px-4 py-1 bg-gray-200 border border-gray-300 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveField}
                  disabled={isSavingField}
                  aria-busy={isSavingField}
                  className="inline-flex items-center justify-center gap-1.5 min-w-[7.5rem] px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSavingField ? (
                    <>
                      <FiRefreshCw
                        className="shrink-0 animate-spin"
                        size={14}
                        aria-hidden
                      />
                      <span>{selectedField ? "Updating…" : "Creating…"}</span>
                    </>
                  ) : selectedField ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Name: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fieldName"
                    value={editFormData.fieldName}
                    // readOnly
                    onChange={handleEditFormChange}
                    className={`w-full px-3 py-2 border rounded bg-gray-200 cursor-not-allowed bg-gray-150`}
                    placeholder="e.g., company_size"
                    pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                    title={
                      !selectedField
                        ? "Field name is auto-generated for new fields"
                        : "Must start with a letter and contain only letters, numbers, and underscores"
                    }
                    required
                    disabled={!selectedField} // Auto-generated for new fields, editable for existing fields
                    readOnly // Make it read-only for new fields
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {!selectedField
                      ? "Field name is automatically generated in sequential order (Field_1, Field_2, etc.)"
                      : "Must start with a letter and contain only letters, numbers, and underscores"}
                  </p>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    htmlFor="field-mapping-field-label"
                  >
                    Field Label: <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-mapping-field-label"
                    type="text"
                    name="fieldLabel"
                    value={editFormData.fieldLabel}
                    onChange={handleEditFormChange}
                    className={`w-full px-3 py-2 border rounded ${fieldLocks?.is_label_locked ? "bg-gray-200" : ""} ${labelDuplicate && !fieldLocks?.is_label_locked ? "border-red-500 ring-1 ring-red-200" : ""}`}
                    placeholder="e.g., Company Size"
                    required
                    readOnly={!!fieldLocks?.is_label_locked}
                    aria-invalid={labelDuplicate && !fieldLocks?.is_label_locked ? true : undefined}
                    aria-describedby={
                      labelDuplicate && !fieldLocks?.is_label_locked
                        ? "field-mapping-label-duplicate-hint"
                        : undefined
                    }
                  />
                  {labelDuplicate && !fieldLocks?.is_label_locked && (
                    <p
                      id="field-mapping-label-duplicate-hint"
                      className="text-xs text-red-600 mt-1.5"
                      role="alert"
                    >
                      This label is already used by{" "}
                      <span className="font-mono font-semibold">
                        {labelDuplicate.conflictingFieldName || "another field"}
                      </span>{" "}
                      in this module. Labels must be unique (case-insensitive).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Type: <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="fieldType"
                    value={editFormData.fieldType}
                    onChange={handleEditFormChange}
                    className={`w-full px-3 py-2 border rounded ${fieldLocks?.is_field_type_locked ? "bg-gray-200" : ""}`}
                    required
                    onMouseDown={(e) => fieldLocks?.is_field_type_locked && e.preventDefault()}
                    onKeyDown={(e) => fieldLocks?.is_field_type_locked && e.preventDefault()}
                    tabIndex={fieldLocks?.is_field_type_locked ? -1 : 0}
                  >
                    {editTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === "currency"
                          ? "Currency ($)"
                          : option === "multiselect"
                            ? "Multi-select"
                            : option === "multicheckbox"
                              ? "Multi-checkbox"
                              : option === "composite"
                                ? "Composite (sub-fields)"
                                : option === "link"
                                  ? "Link / URL"
                                  : option === "multiselect_lookup"
                                    ? "Multi-select lookup (searchable)"
                                    : option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Placeholder:
                  </label>
                  <input
                    type="text"
                    name="placeholder"
                    value={editFormData.placeholder}
                    onChange={handleEditFormChange}
                    className={`w-full px-3 py-2 border rounded ${fieldLocks?.is_placeholder_locked ? "bg-gray-200" : ""}`}
                    placeholder="Placeholder text for the field"
                    readOnly={!!fieldLocks?.is_placeholder_locked}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Value:
                  </label>
                  <FieldMappingDefaultValueControl
                    fieldType={editFormData.fieldType}
                    options={editFormData.options}
                    lookupType={editFormData.lookupType}
                    value={editFormData.defaultValue}
                    onChange={handleDefaultValueChange}
                    locked={!!fieldLocks?.is_default_value_locked}
                    validationError={defaultValueValidationError}
                  />
                </div>

                {(editFormData.fieldType === "select" ||
                  editFormData.fieldType === "radio" ||
                  editFormData.fieldType === "multiselect" ||
                  editFormData.fieldType === "multicheckbox") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Options (each value in its own field):
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Add one option per input. Existing options are shown below; add more with the button.
                      </p>
                      <div className="space-y-2">
                        {(editFormData.options.length === 0 ? [""] : editFormData.options).map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleOptionChange(idx, e.target.value)}
                              className={`flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldLocks?.is_options_locked ? "bg-gray-200" : ""}`}
                              placeholder={`Option ${idx + 1}`}
                              readOnly={!!fieldLocks?.is_options_locked}
                            />
                            <button
                              type="button"
                              onClick={() => !fieldLocks?.is_options_locked && handleRemoveOption(idx)}
                              className={`p-2 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 ${fieldLocks?.is_options_locked ? "bg-gray-200 opacity-50 cursor-not-allowed" : ""}`}
                              title="Remove option"
                              disabled={editFormData.options.length <= 1 || !!fieldLocks?.is_options_locked}
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => !fieldLocks?.is_options_locked && handleAddOption()}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 ${fieldLocks?.is_options_locked ? "bg-gray-200 opacity-50 cursor-not-allowed" : ""}`}
                          disabled={!!fieldLocks?.is_options_locked}
                        >
                          <FiPlus size={16} />
                          Add option
                        </button>
                      </div>
                    </div>
                  )}

                {editFormData.fieldType === "composite" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sub-fields (select existing fields to group):
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Choose fields from this entity (e.g. Address, City, State, ZIP) to show together. Each sub-field keeps its own validation and type.
                    </p>
                    <select
                      multiple
                      value={editFormData.subFieldIds}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                        setEditFormData((prev) => ({ ...prev, subFieldIds: selected }));
                      }}
                      className="w-full px-3 py-2 border rounded min-h-[120px]"
                    >
                      {customFields
                        .filter(
                          (f) =>
                            f.field_type !== "composite" &&
                            (selectedField ? String(f.id) !== String(selectedField.id) : true)
                        )
                        .map((f) => (
                          <option key={f.id} value={String(f.id)}>
                            {f.field_label} ({f.field_type})
                          </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Hold Ctrl/Cmd to select multiple.
                    </p>
                  </div>
                )}

                {(editFormData.fieldType === "lookup" || editFormData.fieldType === "multiselect_lookup") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lookup Type: <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="lookupType"
                      value={editFormData.lookupType}
                      onChange={handleEditFormChange}
                      className="w-full px-3 py-2 border rounded"
                      required
                    >
                      <option value="organizations">Organizations</option>
                      <option value="hiring-managers">Hiring Managers</option>
                      <option value="job-seekers">Job Seekers</option>
                      <option value="jobs">Jobs</option>
                      <option value="owner">Owner</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {editFormData.fieldType === "multiselect_lookup"
                        ? "Multi-select lookup: searchable type-to-match; user can select multiple values."
                        : "Select which type of records this field should look up"}
                    </p>
                  </div>
                )}

                {/* Dependent on another field — available for all field types except composite */}
                {editFormData.fieldType !== "composite" && (
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isDependent"
                        checked={editFormData.isDependent}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditFormData((prev) => ({
                            ...prev,
                            isDependent: checked,
                            dependentOnFieldId: checked ? prev.dependentOnFieldId : "",
                          }));
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm">Dependent on another field</span>
                    </label>
                    {editFormData.isDependent && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Depends on (field):
                        </label>
                        <select
                          value={editFormData.dependentOnFieldId}
                          onChange={(e) =>
                            setEditFormData((prev) => ({
                              ...prev,
                              dependentOnFieldId: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border rounded text-sm"
                        >
                          <option value="">Select a field...</option>
                          {customFields
                            .filter(
                              (f) =>
                                !f.is_hidden &&
                                (selectedField ? String(f.id) !== String(selectedField.id) : true)
                            )
                            .map((f) => (
                              <option key={f.id} value={String(f.id)}>
                                {f.field_label || f.field_name} ({f.field_type})
                              </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          This field will be disabled until the selected field has a value. Only non-hidden fields from this section are listed.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className={`flex items-center ${fieldLocks?.is_required_locked ? "cursor-not-allowed opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      name="isRequired"
                      checked={editFormData.isRequired}
                      onChange={handleEditFormChange}
                      disabled={!!fieldLocks?.is_required_locked || editFormData.isHidden || editFormData.isReadOnly}
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${fieldLocks?.is_required_locked ? "bg-gray-300 cursor-not-allowed" : ""} ${(editFormData.isHidden || editFormData.isReadOnly) ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    />
                    <span className={`ml-2 text-sm ${(fieldLocks?.is_required_locked || editFormData.isHidden || editFormData.isReadOnly) ? "text-gray-500" : ""}`}>
                      Required
                      {editFormData.isHidden && !fieldLocks?.is_required_locked && (
                        <span className="text-xs text-gray-400 block">(Cannot require hidden fields)</span>
                      )}
                      {editFormData.isReadOnly && !editFormData.isHidden && !fieldLocks?.is_required_locked && (
                        <span className="text-xs text-gray-400 block">(Disabled when Read-only)</span>
                      )}
                    </span>
                  </label>

                  <label className={`flex items-center ${fieldLocks?.is_read_only_locked ? "cursor-not-allowed opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      name="isReadOnly"
                      checked={editFormData.isReadOnly}
                      onChange={handleEditFormChange}
                      disabled={!!fieldLocks?.is_read_only_locked}
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${fieldLocks?.is_read_only_locked ? "bg-gray-300 cursor-not-allowed" : ""}`}
                    />
                    <span className={`ml-2 text-sm ${fieldLocks?.is_read_only_locked ? "text-gray-500" : ""}`}>
                      Read-only
                    </span>
                  </label>

                  <label className={`flex items-center ${fieldLocks?.is_hidden_locked ? "cursor-not-allowed opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      name="isHidden"
                      checked={editFormData.isHidden}
                      onChange={handleEditFormChange}
                      disabled={!!fieldLocks?.is_hidden_locked || editFormData.isRequired}
                      className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${fieldLocks?.is_hidden_locked ? "bg-gray-300 cursor-not-allowed" : ""} ${editFormData.isRequired ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    />
                    <span className={`ml-2 text-sm ${(fieldLocks?.is_hidden_locked || editFormData.isRequired) ? "text-gray-500" : ""}`}>
                      Hidden
                      {editFormData.isRequired && !fieldLocks?.is_hidden_locked && (
                        <span className="text-xs text-gray-400 block">(Cannot hide required fields)</span>
                      )}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {renderHistoryModal()}

      {/* Field Naming Modal */}
      <FieldNamingModal
        isOpen={showFieldNamingModal}
        onClose={() => setShowFieldNamingModal(false)}
      />
    </div>
  );
};

export default FieldMapping;
