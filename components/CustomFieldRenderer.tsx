"use client";

import React from "react";
import LookupField from "./LookupField";
import MultiSelectLookupField, { type MultiSelectLookupType } from "./MultiSelectLookupField";
import { FiCalendar, FiLock } from "react-icons/fi";
import { isValidUSPhoneNumber } from "@/app/utils/phoneValidation";

interface CustomFieldDefinition {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_hidden: boolean;
  is_read_only?: boolean;
  options?: string[] | string | Record<string, unknown> | null;
  placeholder?: string | null;
  default_value?: string | null;
  sort_order: number;
  lookup_type?: "organizations" | "hiring-managers" | "job-seekers" | "jobs";
  sub_field_ids?: number[] | string[];
  /** When set, this field is disabled until the referenced field has a value */
  dependent_on_field_id?: string | null;
}

/** Optional context for lookups (e.g. organizationId to filter hiring-managers by org) */
export interface CustomFieldRendererContext {
  organizationId?: string;
}

interface CustomFieldRendererProps {
  field: CustomFieldDefinition;
  value: any;
  onChange: (fieldName: string, value: any) => void;
  className?: string;
  textareaRows?: number;
  /** All fields for same entity (needed for composite to resolve sub-fields) */
  allFields?: CustomFieldDefinition[];
  /** Full values record (needed for composite so sub-fields get values by field_name) */
  values?: Record<string, any>;
  /** Optional context (e.g. organizationId) for lookup filtering */
  context?: CustomFieldRendererContext;
}

export default function CustomFieldRenderer({
  field,
  value,
  onChange,
  className = "w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500",
  textareaRows = 3,
  allFields = [],
  values: valuesRecord,
  context,
}: CustomFieldRendererProps) {
  const readOnly = Boolean((field as any).is_read_only);

  // Dependent on another field: disabled until that field has a value
  const dependentOnFieldId = (field as any).dependent_on_field_id;
  const dependentOnFieldName = React.useMemo(() => {
    if (!dependentOnFieldId || !allFields?.length) return null;
    const dep = allFields.find(
      (f: any) => String(f.id) === String(dependentOnFieldId)
    );
    return dep?.field_name ?? null;
  }, [dependentOnFieldId, allFields]);
  const parentValue = valuesRecord && dependentOnFieldName != null ? valuesRecord[dependentOnFieldName] : undefined;
  const isParentEmpty =
    parentValue === undefined ||
    parentValue === null ||
    (typeof parentValue === "string" && parentValue.trim() === "") ||
    (Array.isArray(parentValue) && parentValue.length === 0);
  const isDisabledByDependency = Boolean(dependentOnFieldId && isParentEmpty);

  // Clear this field's value when dependency becomes empty (parent cleared or changed)
  React.useEffect(() => {
    if (!dependentOnFieldId || !isDisabledByDependency) return;
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value) && value.length === 0) return;
    onChange(field.field_name, Array.isArray(value) ? [] : "");
  }, [isDisabledByDependency, dependentOnFieldId, field.field_name, onChange]);

  // Track if we've auto-populated the date to prevent infinite loops
  const hasAutoFilledRef = React.useRef(false);

  // Helper function to convert YYYY-MM-DD to mm/dd/yyyy
  const formatDateToMMDDYYYY = React.useCallback((dateStr: string): string => {
    if (!dateStr || dateStr.trim() === "") return "";
    try {
      // Check if it's already in mm/dd/yyyy format
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        return dateStr;
      }
      // Convert from YYYY-MM-DD to mm/dd/yyyy
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split("-");
        return `${month}/${day}/${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }, []);

  // Helper function to convert mm/dd/yyyy to YYYY-MM-DD
  const formatDateToYYYYMMDD = React.useCallback((dateStr: string): string => {
    if (!dateStr || dateStr.trim() === "") return "";
    try {
      // Check if it's already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      // Convert from mm/dd/yyyy to YYYY-MM-DD
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split("/");
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }, []);

  // Auto-populate today's date for ALL date fields (Date Added, W9 Last Inserted Date, General Liabilities date updated, Worker Compensation Date, etc.)
  React.useEffect(() => {
    if (field.field_type === "date" && !value && !hasAutoFilledRef.current) {
      // Get today's date in mm/dd/yyyy format
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const year = today.getFullYear();
      const formattedDate = `${month}/${day}/${year}`;
      // Set the value via onChange (store as mm/dd/yyyy for display, will convert to YYYY-MM-DD on submit)
      onChange(field.field_name, formattedDate);
      hasAutoFilledRef.current = true;
    }
    // Reset the ref if value changes externally (e.g., when editing)
    if (value) {
      hasAutoFilledRef.current = false;
    }
  }, [field.field_type, field.field_label, field.field_name, value, onChange]);

  const normalizedOptions = React.useMemo<string[]>(() => {
    if (!field.options) {
      return [];
    }

    if (Array.isArray(field.options)) {
      return field.options.filter(
        (option): option is string =>
          typeof option === "string" && option.trim().length > 0
      );
    }

    if (typeof field.options === "string") {
      const trimmed = field.options.trim();
      if (!trimmed) {
        return [];
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((option): option is string => typeof option === "string")
            .map((option) => option.trim())
            .filter((option) => option.length > 0);
        }
      } catch {
        // Fallback: assume newline-delimited list
        return trimmed
          .split(/\r?\n/)
          .map((option) => option.trim())
          .filter((option) => option.length > 0);
      }
    }

    if (typeof field.options === "object") {
      return Object.values(field.options)
        .filter((option): option is string => typeof option === "string")
        .map((option) => option.trim())
        .filter((option) => option.length > 0);
    }

    return [];
  }, [field.options]);

  const isCredentialsMultiSelect =
    field.field_type === "select" &&
    String(field.field_label || "")
      .trim()
      .toLowerCase() === "credentials";

  // Check if field is an address field (Full Address)
  const isAddressField = (label?: string): boolean => {
    const normalize = (value?: string): string =>
      (value ?? "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const isCloseMatch = (word: string, target: string): boolean => {
      if (word === target) return true;
      if (Math.abs(word.length - target.length) > 1) return false;

      let mismatches = 0;
      for (let i = 0; i < Math.min(word.length, target.length); i++) {
        if (word[i] !== target[i]) mismatches++;
        if (mismatches > 1) return false;
      }

      return true;
    };

    const l = normalize(label);
    const words = l.split(" ").filter(Boolean);

    const hasFull = words.some(w => isCloseMatch(w, "full"));
    const hasAddress = words.some(w => isCloseMatch(w, "address"));

    return hasFull && hasAddress;
  };

  const fieldIsAddressField = isAddressField(field.field_label);

  if (field.is_hidden) return null;

  function formatNumberWithCommas(value: string | number) {
    let num = Number(value);
    if (isNaN(num)) return "";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Format salary values for display
  const formatSalaryValue = (val: any) => {
    if (field.field_name === "minSalary" || field.field_name === "maxSalary") {
      if (val && !isNaN(parseFloat(val))) {
        return parseFloat(val).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        });
      }
      return "";
    }
    return val || "";
  };

  // Phone number formatting function
  const formatPhoneNumber = (input: string) => {
    // Remove all non-numeric characters
    const cleaned = input.replace(/\D/g, "");

    // Limit to 10 digits
    const limited = cleaned.substring(0, 10);

    // Format as (000) 000-0000
    if (limited.length >= 6) {
      return `(${limited.substring(0, 3)}) ${limited.substring(
        3,
        6
      )}-${limited.substring(6)}`;
    } else if (limited.length >= 3) {
      return `(${limited.substring(0, 3)}) ${limited.substring(3)}`;
    } else if (limited.length > 0) {
      return `(${limited}`;
    }
    return limited;
  };

  // Handle phone number input changes with cursor position preservation
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    const oldValue = value || "";
    
    // Count digits in old and new values to detect if user is adding or deleting
    const oldDigits = oldValue.replace(/\D/g, "");
    const newDigits = input.replace(/\D/g, "");
    const isAdding = newDigits.length > oldDigits.length;
    const isDeleting = newDigits.length < oldDigits.length;
    
    // Count how many digits are before the cursor in the old value
    const beforeCursor = oldValue.substring(0, cursorPosition);
    const digitsBeforeCursor = beforeCursor.replace(/\D/g, "").length;
    
    // Format the new value
    const formatted = formatPhoneNumber(input);
    
    let newCursorPosition = formatted.length;
    
    if (isDeleting) {
      // When deleting, maintain cursor position relative to digit count
      let digitCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          digitCount++;
          if (digitCount === digitsBeforeCursor) {
            newCursorPosition = i + 1;
            break;
          }
        }
      }
      // If deleting at the start
      if (digitsBeforeCursor === 0 && formatted.length > 0 && formatted[0] === '(') {
        newCursorPosition = 1;
      }
    } else if (isAdding) {
      // When adding, advance cursor to after the newly added digit
      // Count digits in the formatted string up to where we should be
      const targetDigitCount = digitsBeforeCursor + 1; // One more digit than before
      let digitCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          digitCount++;
          if (digitCount === targetDigitCount) {
            newCursorPosition = i + 1;
            break;
          }
        }
      }
      // If we've reached max digits, put cursor at end
      if (newDigits.length >= 10) {
        newCursorPosition = formatted.length;
      }
    } else {
      // No change in digit count (e.g., replacing a digit), maintain relative position
      let digitCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          digitCount++;
          if (digitCount === digitsBeforeCursor) {
            newCursorPosition = i + 1;
            break;
          }
        }
      }
    }
    
    onChange(field.field_name, formatted);
    
    // Restore cursor position after React updates
    requestAnimationFrame(() => {
      e.target.setSelectionRange(newCursorPosition, newCursorPosition);
    });
  };

  const fieldProps = {
    id: field.field_name,
    value: value || "",
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => (readOnly ? undefined : onChange(field.field_name, e.target.value)),
    className,
    placeholder: field.placeholder || "",
    required: field.is_required,
    readOnly,
    disabled: readOnly,
  };

  // Special props for salary fields (without onChange)
  const salaryFieldProps = {
    id: field.field_name,
    className,
    placeholder: field.placeholder || "",
    required: field.is_required,
  };

  // Display combined address value if this is an address field
  if (fieldIsAddressField && allFields && valuesRecord) {
    const normalize = (s: string) => (s || "").toLowerCase().trim();

    const findAddressField = (labels: string[]) =>
      allFields.find((f) =>
        labels.some((l) => normalize(f.field_label) === normalize(l))
      );

    const addressField = findAddressField(["address", "address1"]);
    const address2Field = findAddressField(["address2", "address 2"]);
    const cityField = findAddressField(["city"]);
    const stateField = findAddressField(["state"]);
    const zipField = findAddressField(["zip", "zip code", "postal code"]);

    // Get values from the address sub-fields
    const address = addressField ? (valuesRecord[addressField.field_name] || "").trim() : "";
    const address2 = address2Field ? (valuesRecord[address2Field.field_name] || "").trim() : "";
    const city = cityField ? (valuesRecord[cityField.field_name] || "").trim() : "";
    const state = stateField ? (valuesRecord[stateField.field_name] || "").trim() : "";
    const zip = zipField ? (valuesRecord[zipField.field_name] || "").trim() : "";

    // Combine city and state
    const cityState = [city, state].filter(Boolean).join(", ");
    
    // Combine all parts: Address, Address 2, City/State, Zip
    const combinedParts = [address, address2, cityState, zip].filter(Boolean);
    const autoCombinedAddress = combinedParts.join(", ");

    // Update Full Address when individual address fields change
    React.useEffect(() => {
      // Always update Full Address with combined value when individual fields change
      // Only update if the combined value is different from current value
      if (autoCombinedAddress && autoCombinedAddress !== (value || "")) {
        onChange(field.field_name, autoCombinedAddress);
      }
    }, [address, address2, city, state, zip, field.field_name, onChange]);

    // Display as editable text field
    // onChange updates only the Full Address field, not the sub-fields
    return (
      <input
        id={field.field_name}
        type="text"
        readOnly
        // disabled
        value={value || ""}
        onChange={(e) => {
          // Update only the Full Address field, don't affect sub-fields
          onChange(field.field_name, e.target.value);
        }}
        className={className}
        placeholder={field.placeholder || ""}
        required={field.is_required}
      />
    );
  }

  switch (field.field_type) {
    case "textarea":
      return (
        <textarea
          {...fieldProps}
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          rows={textareaRows}
        />
      );
    case "select":
      if (isCredentialsMultiSelect) {
        const selectedValues = Array.isArray(value)
          ? value.map((v) => String(v))
          : typeof value === "string" && value.trim() !== ""
            ? value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
            : [];

        return (
          <div
            id={field.field_name}
            className="w-full p-2 border border-gray-300 rounded"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {normalizedOptions.map((option) => {
                const checked = selectedValues.includes(option);
                return (
                  <label
                    key={option}
                    className="flex items-center gap-2 text-sm text-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...selectedValues, option]))
                          : selectedValues.filter((v) => v !== option);
                        onChange(field.field_name, next);
                      }}
                      className="h-4 w-4"
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      }
      return (
        <select {...fieldProps}>
          <option value="">Select an option</option>
          {normalizedOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="space-y-2">
          {normalizedOptions.length === 0 ? (
            <div className="text-sm text-red-500">
              No options configured for this field.
            </div>
          ) : (
            normalizedOptions.map((option) => (
              <label
                key={`${field.field_name}-${option}`}
                className="flex items-center space-x-2 text-sm"
              >
                <input
                  type="radio"
                  name={field.field_name}
                  value={option}
                  checked={value === option}
                  onChange={() => onChange(field.field_name, option)}
                  required={field.is_required}
                />
                <span>{option}</span>
              </label>
            ))
          )}
        </div>
      );
    case "checkbox":
      return (
        <input
          type="checkbox"
          id={field.field_name}
          checked={value === "true" || value === true}
          onChange={(e) => (readOnly ? undefined : onChange(field.field_name, e.target.checked))}
          className="h-4 w-4"
          disabled={readOnly}
        />
      );
    case "multiselect":
    case "multicheckbox": {
      const selectedValues = Array.isArray(value)
        ? value.map((v) => String(v))
        : typeof value === "string" && value.trim() !== ""
          ? value.split(",").map((v) => v.trim()).filter(Boolean)
          : [];
      const count = selectedValues.length;
      const labelSingular = (field.field_label || "item").toLowerCase().replace(/\s*\(s\)$/, "");
      const labelPlural = count === 1 ? labelSingular : `${labelSingular}s`;
      const removeItem = (item: string) => {
        if (readOnly) return;
        onChange(
          field.field_name,
          selectedValues.filter((v) => v !== item)
        );
      };
      return (
        <div
          id={field.field_name}
          className="w-full p-4 border border-gray-200 rounded-lg bg-white"
        >
          {/* Vertical list of checkboxes */}
          <div className="space-y-3">
            {normalizedOptions.length === 0 ? (
              <span className="text-sm text-gray-500">No options configured.</span>
            ) : (
              normalizedOptions.map((option) => {
                const checked = selectedValues.includes(option);
                return (
                  <label
                    key={option}
                    className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (readOnly) return;
                        const next = e.target.checked
                          ? Array.from(new Set([...selectedValues, option]))
                          : selectedValues.filter((v) => v !== option);
                        onChange(field.field_name, next);
                      }}
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      disabled={readOnly}
                    />
                    <span className="text-gray-700">{option}</span>
                  </label>
                );
              })
            )}
          </div>
          {/* Separator */}
          <div className="border-t border-gray-200 my-4" />
          {/* Selected count + pill tags */}
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Selected: {count} {labelPlural}
            </p>
            {count > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedValues.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-sm"
                  >
                    {item}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="p-0.5 rounded-full hover:bg-blue-100 text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                        aria-label={`Remove ${item}`}
                      >
                        <span className="sr-only">Remove</span>
                        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    case "composite": {
      const subIds = (field as any).sub_field_ids;
      const ids = Array.isArray(subIds) ? subIds.map(String) : [];
      const subFields = ids.length > 0 && allFields.length > 0
        ? ids
          .map((id) => allFields.find((f) => String(f.id) === String(id)))
          .filter(Boolean) as CustomFieldDefinition[]
        : [];
      if (subFields.length === 0) {
        return (
          <div className="text-sm text-gray-500 py-2 border border-dashed border-gray-300 rounded px-2">
            Configure sub-fields in Admin → Field Mapping (Composite type).
          </div>
        );
      }
      const record = valuesRecord ?? (typeof value === "object" && value !== null ? value : {});
      return (
        <div className="space-y-3 border border-gray-200 rounded p-3 bg-gray-50/50">
          {subFields.map((sub) => (
            <div key={sub.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{sub.field_label}</label>
              <CustomFieldRenderer
                field={sub}
                value={record[sub.field_name]}
                onChange={onChange}
                className={className}
                textareaRows={textareaRows}
                allFields={allFields}
                values={valuesRecord}
              />
            </div>
          ))}
        </div>
      );
    }
    case "link":
    case "url":
      return (
        <input
          {...fieldProps}
          type="url"
          pattern="(https?://|www\.).+"
          title="Please enter a valid URL starting with http://, https://, or www."
          required={field.is_required}
        />
      );
    case "number": {
      // Check if this field is for job salaries
      if (
        field.field_name === "minSalary" ||
        field.field_name === "maxSalary"
      ) {
        // Show formatted number when value is a number (e.g. from API/blur); show raw string while typing so backspace works
        const displayValue =
          typeof value === "number" && !Number.isNaN(value)
            ? formatSalaryValue(value)
            : value === "" || value === undefined || value === null
              ? ""
              : String(value);

        return (
          <input
            {...salaryFieldProps}
            type="text" // Text so we can add "$" & commas
            value={displayValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              let inputValue = e.target.value.replace(/[^0-9.]/g, ""); // Remove non-numeric except decimal

              // Handle multiple decimal points
              const decimalCount = (inputValue.match(/\./g) || []).length;
              if (decimalCount > 1) {
                inputValue = inputValue.substring(
                  0,
                  inputValue.lastIndexOf(".")
                );
              }

              // Limit decimal places to 2
              if (inputValue.includes(".")) {
                const parts = inputValue.split(".");
                if (parts[1] && parts[1].length > 2) {
                  inputValue = parts[0] + "." + parts[1].substring(0, 2);
                }
              }

              // Store raw string while typing so backspace/editing works; only convert to number on blur
              onChange(field.field_name, inputValue === "" ? "" : inputValue);
            }}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
              const inputValue = e.target.value.replace(/[^0-9.]/g, "");
              if (inputValue === "") {
                onChange(field.field_name, "");
                return;
              }
              const number = parseFloat(inputValue);
              if (!Number.isNaN(number)) {
                onChange(field.field_name, number);
              }
            }}
            placeholder="$XX,XXX.XX"
          />
        );
      }

      // Check if this is a ZIP code field (even if defined as "number" type, treat as text for leading zeros)
      // Use label/type only — no field_name (Field_24 etc.) so mapping per entity is respected.
      const isZipCodeFieldNumber =
        field.field_label?.toLowerCase().includes("zip") ||
        field.field_label?.toLowerCase().includes("postal code") ||
        field.field_name?.toLowerCase().includes("zip");

      if (isZipCodeFieldNumber) {
        // ZIP codes should be treated as text (not number) to preserve leading zeros
        // Must be exactly 5 digits
        return (
          <input
            id={field.field_name}
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={value ?? ""}
            onChange={(e) => {
              // Only allow digits, max 5 characters
              const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 5);
              e.target.value = digitsOnly;
              // Store as string to preserve leading zeros
              onChange(field.field_name, digitsOnly);
            }}
            placeholder={field.placeholder || "12345"}
            required={field.is_required}
            className={className}
          />
        );
      }

      // Check if this is a year field (Year Founded, etc.)
      const isYearField =
        field.field_label?.toLowerCase().includes("year") ||
        field.field_name?.toLowerCase().includes("year");

      // Check if this is a numeric field that allows values >= 0 (Number of Employees, Offices, Oasis Key)
      // Use label/type only — no field_name (Field_32 etc.) so mapping per entity is respected.
      const isNonNegativeField =
        field.field_label?.toLowerCase().includes("employees") ||
        field.field_label?.toLowerCase().includes("offices") ||
        field.field_label?.toLowerCase().includes("oasis key") ||
        field.field_name?.toLowerCase().includes("employees") ||
        field.field_name?.toLowerCase().includes("offices") ||
        field.field_name?.toLowerCase().includes("oasis");

      if (isYearField) {
        // Year fields: 2000-2100, max 4 digits
        return (
          <input
            {...fieldProps}
            type="number"
            min="2000"
            max="2100"
            maxLength={4}
            onInput={(e) => {
              const target = e.target as HTMLInputElement;
              if (target.value.length > 4) {
                target.value = target.value.slice(0, 4);
              }
            }}
          />
        );
      }

      if (isNonNegativeField) {
        // Fields that allow values >= 0: Number of Employees, Offices, Oasis Key
        return (
          <input
            {...fieldProps}
            type="number"
            min="0"
            step="1"
            onChange={(e) => {
              const numValue = parseFloat(e.target.value);
              if (e.target.value !== "" && !isNaN(numValue)) {
                if (numValue < 0) {
                  // Set validation error for negative values
                  e.target.setCustomValidity("Value must be 0 or greater");
                  e.target.classList.add("border-red-500");
                } else {
                  e.target.setCustomValidity("");
                  e.target.classList.remove("border-red-500");
                }
              } else {
                e.target.setCustomValidity("");
                e.target.classList.remove("border-red-500");
              }
              fieldProps.onChange(e);
            }}
            onBlur={(e) => {
              const numValue = parseFloat(e.target.value);
              if (e.target.value !== "" && !isNaN(numValue) && numValue < 0) {
                e.target.setCustomValidity("Value must be 0 or greater");
                e.target.classList.add("border-red-500");
              } else {
                e.target.setCustomValidity("");
                e.target.classList.remove("border-red-500");
              }
            }}
          />
        );
      }

      // Default number field (no special restrictions)
      return (
        <input
          {...fieldProps}
          type="number"
        />
      );
    }

    case "percentage":
      return (
        <div className="relative w-full">
          {/* % sign (static) */}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 select-none">
            %
          </span>

          <input
            id={field.field_name}
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={value ?? ""}
            onChange={(e) => {
              const inputValue = e.target.value;

              // Allow empty value
              if (inputValue === "") {
                onChange(field.field_name, "");
                return;
              }

              // Parse the number
              const numValue = parseFloat(inputValue);

              // Check if valid number
              if (isNaN(numValue)) {
                return; // Don't update if invalid
              }

              // Enforce range: 0 to 100
              if (numValue < 0) {
                onChange(field.field_name, "0");
                return;
              }

              if (numValue > 100) {
                onChange(field.field_name, "100");
                return;
              }

              // Valid value within range
              onChange(field.field_name, numValue.toString());
            }}
            onBlur={(e) => {
              // Ensure value is within range on blur
              const inputValue = e.target.value;
              if (inputValue === "") {
                return;
              }

              const numValue = parseFloat(inputValue);
              if (!isNaN(numValue)) {
                if (numValue < 0) {
                  onChange(field.field_name, "0");
                  e.target.value = "0";
                } else if (numValue > 100) {
                  onChange(field.field_name, "100");
                  e.target.value = "100";
                }
              }
            }}
            placeholder={field.placeholder || "0"}
            required={field.is_required}
            className={`${className} pr-8`}
          />
        </div>
      );

    // case "number":
    //   return (
    //     <input
    //       {...fieldProps}
    //       type="number"
    //       min="2000"
    //       max="2100"
    //       maxLength={4}
    //       onInput={(e) => {
    //         const target = e.target as HTMLInputElement;
    //         if (target.value.length > 4) {
    //           target.value = target.value.slice(0, 4);
    //         }
    //       }}
    //     />
    //   );
    case "date": {
      // Treat "Date Added" fields as read-only with a lock icon (label only)
      const isDateAddedField =
        field.field_label?.toLowerCase() === "date added";

      // Common display value (mm/dd/yyyy)
      const todayDefault = () => {
        const today = new Date();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const y = today.getFullYear();
        return `${m}/${d}/${y}`;
      };
      const displayReadOnlyValue = value ? formatDateToMMDDYYYY(String(value)) : todayDefault();

      if (isDateAddedField) {
        return (
          <div className="relative flex items-center">
            <input
              id={field.field_name}
              type="text"
              value={displayReadOnlyValue}
              readOnly
              className={`${className} bg-gray-100 cursor-not-allowed`}
            />
            <FiLock className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        );
      }

      // Calendar popup state
      // Calendar popup state
      const [showCalendar, setShowCalendar] = React.useState(false);
      const [currentMonth, setCurrentMonth] = React.useState(new Date());
      const calendarRef = React.useRef<HTMLDivElement>(null);

      // Parse current value to Date object
      const getCurrentDate = React.useMemo(() => {
        if (!value || value === "") {
          return new Date();
        }
        try {
          let dateStr = String(value);
          // If it's in mm/dd/yyyy format, convert to YYYY-MM-DD
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [month, day, year] = dateStr.split("/");
            dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? new Date() : date;
        } catch {
          return new Date();
        }
      }, [value]);

      // Format date value for display (mm/dd/yyyy)
      const displayValue = React.useMemo(() => {
        if (!value || value === "") {
          const today = new Date();
          const month = String(today.getMonth() + 1).padStart(2, "0");
          const day = String(today.getDate()).padStart(2, "0");
          const year = today.getFullYear();
          return `${month}/${day}/${year}`;
        }
        return formatDateToMMDDYYYY(String(value));
      }, [value, formatDateToMMDDYYYY]);

      // Handle date selection from calendar
      const handleDateSelect = (selectedDate: Date) => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        onChange(field.field_name, dateStr);
        setShowCalendar(false);
      };

      // Handle manual input with mm/dd/yyyy formatting
      const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputValue = e.target.value;
        const digitsOnly = inputValue.replace(/\D/g, "");

        let formatted = "";
        if (digitsOnly.length > 0) {
          formatted = digitsOnly.substring(0, 2);
        }
        if (digitsOnly.length >= 3) {
          formatted += "/" + digitsOnly.substring(2, 4);
        }
        if (digitsOnly.length >= 5) {
          formatted += "/" + digitsOnly.substring(4, 8);
        }

        if (formatted.length > 10) {
          formatted = formatted.substring(0, 10);
        }

        e.target.value = formatted;

        if (formatted.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) {
          const [month, day, year] = formatted.split("/");
          const dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            onChange(field.field_name, dateStr);
          } else {
            onChange(field.field_name, formatted);
          }
        } else {
          onChange(field.field_name, formatted);
        }
      };

      // Calendar functions
      const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      };

      const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
      };

      const getCalendarDays = () => {
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);
        const days: (Date | null)[] = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
          days.push(null);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
          days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
        }

        return days;
      };

      const navigateMonth = (direction: "prev" | "next") => {
        setCurrentMonth((prev) => {
          const newDate = new Date(prev);
          if (direction === "prev") {
            newDate.setMonth(prev.getMonth() - 1);
          } else {
            newDate.setMonth(prev.getMonth() + 1);
          }
          return newDate;
        });
      };

      const goToToday = () => {
        const today = new Date();
        setCurrentMonth(today);
        handleDateSelect(today);
      };

      const clearDate = () => {
        onChange(field.field_name, "");
        setShowCalendar(false);
      };

      // Close calendar when clicking outside
      React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
            setShowCalendar(false);
          }
        };

        if (showCalendar) {
          document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }, [showCalendar]);

      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      const calendarDays = getCalendarDays();
      const currentDateObj = getCurrentDate;

      return (
        <div className="relative" ref={calendarRef}>
          <div className="relative flex items-center">
            <input
              id={field.field_name}
              type="text"
              value={displayValue}
              onChange={handleDateChange}
              placeholder="mm/dd/yyyy"
              className={className}
              required={field.is_required}
              maxLength={10}
              onBlur={(e) => {
                const inputValue = e.target.value.trim();
                if (inputValue && inputValue.length === 10) {
                  const [month, day, year] = inputValue.split("/");
                  const dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                  const date = new Date(dateStr);
                  if (!isNaN(date.getTime())) {
                    onChange(field.field_name, dateStr);
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              title="Open calendar"
            >
              <FiCalendar className="w-5 h-5" />
            </button>
          </div>

          {showCalendar && (
            <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => navigateMonth("prev")}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Previous month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateMonth("next")}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Next month"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-600 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const isToday =
                    day.getDate() === new Date().getDate() &&
                    day.getMonth() === new Date().getMonth() &&
                    day.getFullYear() === new Date().getFullYear();

                  const isSelected =
                    day.getDate() === currentDateObj.getDate() &&
                    day.getMonth() === currentDateObj.getMonth() &&
                    day.getFullYear() === currentDateObj.getFullYear();

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => handleDateSelect(day)}
                      className={`
                        aspect-square flex items-center justify-center text-sm rounded
                        ${isSelected
                          ? "bg-blue-600 text-white font-semibold"
                          : isToday
                            ? "bg-blue-100 text-blue-700 font-semibold"
                            : "hover:bg-gray-100 text-gray-700"
                        }
                      `}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              {/* Calendar Footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={goToToday}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={clearDate}
                  className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    case "datetime":
      const inputType =
        field.field_type === "datetime" ? "datetime-local" : field.field_type;

      return (
        <input
          {...fieldProps}
          type={inputType}
          value={value ? value.slice(0, 16) : ""}
          onChange={(e) => onChange(field.field_name, e.target.value)}
        />
      );
    // case "datetime":
    //   // Handle datetime-local input for Date and Time fields
    //   // Convert ISO timestamp to datetime-local format (YYYY-MM-DDTHH:mm)
    //   const formatDateTimeForInput = (isoString: string | null | undefined): string => {
    //     if (!isoString) return "";
    //     try {
    //       const date = new Date(isoString);
    //       if (isNaN(date.getTime())) return "";
    //       // Format as YYYY-MM-DDTHH:mm for datetime-local input
    //       const year = date.getFullYear();
    //       const month = String(date.getMonth() + 1).padStart(2, "0");
    //       const day = String(date.getDate()).padStart(2, "0");
    //       const hours = String(date.getHours()).padStart(2, "0");
    //       const minutes = String(date.getMinutes()).padStart(2, "0");
    //       return `${year}-${month}-${day}T${hours}:${minutes}`;
    //     } catch (error) {
    //       console.error("Error formatting datetime:", error);
    //       return "";
    //     }
    //   };

    //   // Convert datetime-local format back to ISO timestamp
    //   const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //     const inputValue = e.target.value;
    //     if (!inputValue) {
    //       onChange(field.field_name, "");
    //       return;
    //     }
    //     try {
    //       // datetime-local format is YYYY-MM-DDTHH:mm
    //       // Convert to ISO string
    //       const date = new Date(inputValue);
    //       if (!isNaN(date.getTime())) {
    //         onChange(field.field_name, date.toISOString());
    //       } else {
    //         onChange(field.field_name, "");
    //       }
    //     } catch (error) {
    //       console.error("Error parsing datetime:", error);
    //       onChange(field.field_name, "");
    //     }
    //   };

    //   return (
    //     <input
    //       {...fieldProps}
    //       type="datetime-local"
    //       value={formatDateTimeForInput(value)}
    //       onChange={handleDateTimeChange}
    //       onClick={(e) => {
    //         // Only call showPicker on click (user gesture), not on focus
    //         const target = e.target as HTMLInputElement;
    //         if (target.showPicker && typeof target.showPicker === 'function') {
    //           try {
    //             target.showPicker();
    //           } catch (error) {
    //             // Silently ignore if showPicker is not supported or fails
    //             // The native datetime picker will still work normally
    //           }
    //         }
    //       }}
    //     />
    //   );
    // case "date":
    //   return <input {...fieldProps} type="date" />;
    case "email":
      return <input {...fieldProps} type="email" />;
    case "phone":
      return (
        <input
          {...fieldProps}
          type="tel"
          onChange={handlePhoneChange}
          maxLength={14} // (000) 000-0000 = 14 characters
          title="Phone number will be automatically formatted as (000) 000-0000"
        />
      );
    case "currency":
      return (
        <div className="relative w-full">
          {/* $ sign (static) */}
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 select-none">
            $
          </span>

          <input
            id={field.field_name}
            type="text"
            inputMode="decimal"
            value={value ?? ""}
            onChange={(e) => {
              // Allow only digits + one dot, max 2 decimals
              let v = e.target.value;

              // remove everything except digits and dot
              v = v.replace(/[^0-9.]/g, "");

              // allow only one dot
              const parts = v.split(".");
              if (parts.length > 2) {
                v = parts[0] + "." + parts.slice(1).join("");
              }

              // limit to 2 decimals
              if (v.includes(".")) {
                const [intPart, decPart] = v.split(".");
                v = intPart + "." + (decPart ?? "").slice(0, 2);
              }

              onChange(field.field_name, v);
            }}
            placeholder={field.placeholder || "0.00"}
            required={field.is_required}
            className={`${className} pl-8`}
          />
        </div>
      );

    case "file":
      return readOnly ? (
        <div className="py-2 px-2 border border-gray-200 rounded bg-gray-50 text-gray-700 text-sm">
          {value && (typeof value === "string" || value?.name) ? (typeof value === "string" ? value : value.name) : "—"}
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onChange(field.field_name, e.target.files[0]);
              }
            }}
            className="w-full p-2 text-gray-700"
            required={field.is_required}
          />
          <p className="text-sm text-gray-500 mt-1">
            Accepted formats: PDF, DOC, DOCX, TXT
          </p>
        </div>
      );
    case "lookup":
      return readOnly || isDisabledByDependency ? (
        <div className="py-2 px-2 border border-gray-200 rounded bg-gray-50 text-gray-700">
          {isDisabledByDependency
            ? "— (select dependent field first)"
            : value && String(value).trim() !== ""
              ? String(value)
              : "—"}
        </div>
      ) : (
        <LookupField
          value={value || ""}
          onChange={(val) => onChange(field.field_name, val)}
          lookupType={field.lookup_type || "organizations"}
          placeholder={field.placeholder || "Select an option"}
          required={field.is_required}
          className={className}
          disabled={readOnly || isDisabledByDependency}
        />
      );
    case "multiselect_lookup":
      return readOnly || isDisabledByDependency ? (
        <div className="py-2 px-2 border border-gray-200 rounded bg-gray-50 text-gray-700">
          {isDisabledByDependency
            ? "— (select dependent field first)"
            : Array.isArray(value)
              ? value.join(", ")
              : value && String(value).trim() !== ""
                ? String(value)
                : "—"}
        </div>
      ) : (
        <MultiSelectLookupField
          value={value ?? []}
          onChange={(val) => onChange(field.field_name, Array.isArray(val) ? val : val)}
          lookupType={(field.lookup_type as MultiSelectLookupType) || "organizations"}
          placeholder={field.placeholder || "Type to search..."}
          required={field.is_required}
          className={className}
          disabled={readOnly || isDisabledByDependency}
          filterByParam={
            field.lookup_type === "hiring-managers" && context?.organizationId
              ? { key: "organization_id", value: context.organizationId }
              : undefined
          }
        />
      );
    default:
      // Check if this is a ZIP code field (label/type only — no field_name)
      const isZipCodeField =
        field.field_label?.toLowerCase().includes("zip") ||
        field.field_label?.toLowerCase().includes("postal code") ||
        field.field_name?.toLowerCase().includes("zip") ||
        field.field_name?.toLowerCase().includes("postal");

      return (
        <div style={{ position: "relative", width: "100%" }}>
          <input
            {...fieldProps}
            type="text"
            spellCheck={true}
            autoCorrect="on"
            autoCapitalize="sentences"
            maxLength={isZipCodeField ? 5 : undefined}
            inputMode={isZipCodeField ? "numeric" : "text"}
            onChange={(e) => {
              if (isZipCodeField) {
                // Only allow digits, max 5 characters
                const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 5);
                e.target.value = digitsOnly;
                onChange(field.field_name, digitsOnly);
              } else {
                fieldProps.onChange(e);
              }
            }}
            style={{ paddingRight: "25px" }} // thoda space right pe icon ke liye
          />

          {/* Show check icon for Job Title field (by label, not field_name) */}
          {field.field_label?.toLowerCase().includes("job title") &&
            (value && value.trim() !== "" ? (
              <span
                style={{
                  color: "green",
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "16px",
                  fontWeight: "bold",
                }}
              >
                ✔
              </span>
            ) : (
              <span
                style={{
                  color: "red",
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "18px",
                  fontWeight: "bold",
                }}
              >
                *
              </span>
            ))}
        </div>
      );
  }
}

export function useCustomFields(entityType: string) {
  const [customFields, setCustomFields] = React.useState<
    CustomFieldDefinition[]
  >([]);
  const [customFieldValues, setCustomFieldValues] = React.useState<
    Record<string, any>
  >({});
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchCustomFields = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/field-management/${entityType}`);
      const data = await response.json();

      if (response.ok) {
        const sortedFields = (data.customFields || []).sort(
          (a: CustomFieldDefinition, b: CustomFieldDefinition) =>
            a.sort_order - b.sort_order
        );
        setCustomFields(sortedFields);

        // Initialize custom field values
        setCustomFieldValues((prev) => {
          const next: Record<string, any> = {};
          sortedFields.forEach((field: CustomFieldDefinition) => {
            if (prev[field.field_name] !== undefined) {
              next[field.field_name] = prev[field.field_name];
              return;
            }
            next[field.field_name] = field.default_value || "";
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Error fetching custom fields:", err);
    } finally {
      setIsLoading(false);
    }
  }, [entityType]);

  const handleCustomFieldChange = React.useCallback(
    (fieldName: string, value: any) => {
      setCustomFieldValues((prev) => ({
        ...prev,
        [fieldName]: value,
      }));
    },
    []
  );

  const validateCustomFields = React.useCallback(() => {
    // Helper function to check if field has a valid value (matches UI logic)
    const hasValidValue = (field: CustomFieldDefinition, value: any): boolean => {
      // Handle null, undefined, or empty values
      if (value === null || value === undefined) return false;
      if (
        field.field_type === "select" &&
        String(field.field_label || "").trim().toLowerCase() === "credentials" &&
        Array.isArray(value)
      ) {
        return value.map((v) => String(v).trim()).filter(Boolean).length > 0;
      }
      // Multiselect / multicheckbox / multiselect_lookup: value can be array or comma-separated string
      if (
        field.field_type === "multiselect" ||
        field.field_type === "multicheckbox" ||
        field.field_type === "multiselect_lookup"
      ) {
        if (Array.isArray(value)) {
          return value.map((v) => String(v).trim()).filter(Boolean).length > 0;
        }
        const trimmed = String(value).trim();
        if (trimmed.includes(",")) {
          return trimmed.split(",").map((v) => v.trim()).filter(Boolean).length > 0;
        }
        return trimmed.length > 0;
      }
      const trimmed = String(value).trim();

      // Special validation for select fields - check if "Select an option" is selected
      if (field.field_type === "select") {
        if (trimmed === "" || trimmed.toLowerCase() === "select an option") {
          return false;
        }
        // For multi-select fields (comma-separated), check if at least one value is selected
        if (trimmed.includes(",")) {
          const values = trimmed.split(",").map(v => v.trim()).filter(Boolean);
          return values.length > 0;
        }
        return true;
      }

      // Empty string means no value selected (especially for select fields)
      if (trimmed === "") return false;

      // Special validation for date fields
      if (field.field_type === "date") {
        // Special check for "Date Added" - always valid as it's auto-populated/read-only (label only)
        if (field.field_label?.toLowerCase() === "date added") {
          return true;
        }

        // Accept both YYYY-MM-DD (storage format) and mm/dd/yyyy (display format)
        let dateToValidate = trimmed;

        // If it's in mm/dd/yyyy format, convert to YYYY-MM-DD
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
          const [month, day, year] = trimmed.split("/");
          dateToValidate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        // Check if it's a valid date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateToValidate)) return false;

        const date = new Date(dateToValidate);
        if (isNaN(date.getTime())) return false;

        // Additional validation: check if the date components match
        // Note: new Date("YYYY-MM-DD") parses as UTC, so we must use UTC methods
        // to avoid timezone issues causing validation failures (e.g. 2024-01-29 becoming 28th in EST)
        const [year, month, day] = dateToValidate.split("-");
        if (date.getUTCFullYear() !== parseInt(year) ||
          date.getUTCMonth() + 1 !== parseInt(month) ||
          date.getUTCDate() !== parseInt(day)) {
          return false; // Invalid date (e.g., 02/30/2024)
        }

        return true;
      }

      // Special validation for ZIP code (must be exactly 5 digits) — label/type only
      const isZipCodeField =
        field.field_label?.toLowerCase().includes("zip") ||
        field.field_label?.toLowerCase().includes("postal code") ||
        field.field_name?.toLowerCase().includes("zip");
      if (isZipCodeField) {
        return /^\d{5}$/.test(trimmed);
      }

      // Special validation for numeric fields that allow values >= 0 — label/type only
      const isNonNegativeField =
        field.field_label?.toLowerCase().includes("employees") ||
        field.field_label?.toLowerCase().includes("offices") ||
        field.field_label?.toLowerCase().includes("oasis key") ||
        field.field_name?.toLowerCase().includes("employees") ||
        field.field_name?.toLowerCase().includes("offices") ||
        field.field_name?.toLowerCase().includes("oasis");
      if (isNonNegativeField && field.field_type === "number") {
        const numValue = parseFloat(trimmed);
        // Allow values >= 0 (0, 1, 2, etc.)
        if (isNaN(numValue) || numValue < 0) {
          return false;
        }
      }

      // Special validation for phone fields (exclude date fields e.g. Start Date)
      // Only use field_type or label — do NOT use field_name (e.g. Field_5) as proxy for phone,
      // since the same field name can be mapped to different labels per entity (e.g. Title vs Main Phone).
      const isDateFieldForPhone =
        field.field_type === "date" ||
        field.field_label?.toLowerCase().includes("date");
      const isPhoneField =
        !isDateFieldForPhone &&
        (field.field_type === "phone" ||
          field.field_label?.toLowerCase().includes("phone"));
      if (isPhoneField && trimmed !== "") {
        // Phone must be complete: exactly 10 digits formatted as (000) 000-0000
        // Remove all non-numeric characters to check digit count
        const digitsOnly = trimmed.replace(/\D/g, "");
        // Must have exactly 10 digits
        if (digitsOnly.length !== 10) {
          return false;
        }
        // Check if formatted correctly as (000) 000-0000
        const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
        if (!phoneRegex.test(trimmed)) return false;
        // NANP: valid area code (2-9), exchange (2-9), and area code in US list
        return isValidUSPhoneNumber(trimmed);
      }

      // Special validation for URL fields (Organization Website, etc.) — field_type/label only
      const isUrlField =
        field.field_type === "url" ||
        field.field_label?.toLowerCase().includes("website") ||
        field.field_label?.toLowerCase().includes("url");
      if (isUrlField && trimmed !== "") {
        // URL must start with http://, https://, or www.
        const urlPattern = /^(https?:\/\/|www\.).+/i;
        if (!urlPattern.test(trimmed)) {
          return false;
        }

        // Stricter validation: Check for complete domain structure
        // For www. URLs: must have www.domain.tld format (at least www. + domain + . + tld)
        // For http:// URLs: must have http://domain.tld format
        let urlToValidate = trimmed;
        if (trimmed.toLowerCase().startsWith('www.')) {
          // Check if www. URL has complete domain (at least www.domain.tld)
          // Remove www. and check if remaining has at least one dot (domain.tld)
          const domainPart = trimmed.substring(4); // Remove "www."
          if (!domainPart.includes('.') || domainPart.split('.').length < 2) {
            return false; // Incomplete domain like "www.al"
          }
          // Check if domain part has valid structure (at least domain.tld)
          const domainParts = domainPart.split('.');
          if (domainParts.length < 2 || domainParts[0].length === 0 || domainParts[domainParts.length - 1].length < 2) {
            return false; // Invalid domain structure
          }
          urlToValidate = `https://${trimmed}`;
        } else {
          // For http:// or https:// URLs, check if domain part is complete
          const urlWithoutProtocol = trimmed.replace(/^https?:\/\//i, '');
          if (!urlWithoutProtocol.includes('.') || urlWithoutProtocol.split('.').length < 2) {
            return false; // Incomplete domain
          }
          const domainParts = urlWithoutProtocol.split('/')[0].split('.');
          if (domainParts.length < 2 || domainParts[0].length === 0 || domainParts[domainParts.length - 1].length < 2) {
            return false; // Invalid domain structure
          }
          urlToValidate = trimmed;
        }

        // Final validation: try to create a URL object to check if it's valid
        try {
          const urlObj = new URL(urlToValidate);
          // Additional check: ensure hostname has at least one dot (domain.tld)
          if (!urlObj.hostname || !urlObj.hostname.includes('.') || urlObj.hostname.split('.').length < 2) {
            return false;
          }
          // Ensure TLD is at least 2 characters
          const hostnameParts = urlObj.hostname.split('.');
          if (hostnameParts[hostnameParts.length - 1].length < 2) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      }

      return true;
    };

    for (const field of customFields) {
      if (field.is_required && !field.is_hidden) {
        const value = customFieldValues[field.field_name];
        if (!hasValidValue(field, value)) {
          let errorMessage = `${field.field_label} is required`;

          // Add specific error messages for validation failures (label/type only)
          const isZipCodeField =
            field.field_label?.toLowerCase().includes("zip") ||
            field.field_label?.toLowerCase().includes("postal code") ||
            field.field_name?.toLowerCase().includes("zip");
          if (isZipCodeField && value && String(value).trim() !== "") {
            errorMessage = `${field.field_label} must be exactly 5 digits`;
          }

          const isNonNegativeField =
            field.field_label?.toLowerCase().includes("employees") ||
            field.field_label?.toLowerCase().includes("offices") ||
            field.field_label?.toLowerCase().includes("oasis key") ||
            field.field_name?.toLowerCase().includes("employees") ||
            field.field_name?.toLowerCase().includes("offices") ||
            field.field_name?.toLowerCase().includes("oasis");
          if (isNonNegativeField && value && !isNaN(parseFloat(String(value)))) {
            const numValue = parseFloat(String(value));
            if (numValue < 0) {
              errorMessage = `${field.field_label} must be 0 or greater`;
            }
          }

          // Add specific error message for phone validation failures (exclude date fields e.g. Start Date)
          const isDateField =
            field.field_type === "date" ||
            field.field_label?.toLowerCase().includes("date");
          const isPhoneFieldError =
            !isDateField &&
            (field.field_type === "phone" ||
              field.field_label?.toLowerCase().includes("phone"));
          if (isPhoneFieldError && value && String(value).trim() !== "") {
            const trimmed = String(value).trim();
            const digitsOnly = trimmed.replace(/\D/g, "");
            if (digitsOnly.length !== 10) {
              errorMessage = `${field.field_label} must be a complete 10-digit phone number`;
            } else {
              if (!isValidUSPhoneNumber(trimmed)) {
                errorMessage = `${field.field_label} contains an invalid area code or exchange code (must start with 2-9)`;
              }
            }
          }

          // Add specific error message for URL validation failures (field_type/label only)
          const isUrlFieldError =
            field.field_type === "url" ||
            field.field_label?.toLowerCase().includes("website") ||
            field.field_label?.toLowerCase().includes("url");
          if (isUrlFieldError && value && String(value).trim() !== "") {
            const trimmed = String(value).trim();
            const urlPattern = /^(https?:\/\/|www\.).+/i;
            if (!urlPattern.test(trimmed)) {
              errorMessage = `${field.field_label} must start with http://, https://, or www.`;
            } else {
              try {
                // If URL starts with www., prepend https:// for validation
                const urlToValidate = trimmed.toLowerCase().startsWith('www.')
                  ? `https://${trimmed}`
                  : trimmed;
                new URL(urlToValidate);
              } catch {
                errorMessage = `${field.field_label} must be a valid URL`;
              }
            }
          }

          return {
            isValid: false,
            message: errorMessage,
          };
        }
      }
    }
    return { isValid: true, message: "" };
  }, [customFields, customFieldValues]);

  const getCustomFieldsForSubmission = React.useCallback(() => {
    const customFieldsToSend: Record<string, any> = {};
    customFields.forEach((field) => {
      if (!field.is_hidden) {
        let valueToSend = customFieldValues[field.field_name];

        // Convert date fields from mm/dd/yyyy to YYYY-MM-DD for backend
        if (field.field_type === "date" && valueToSend) {
          const dateStr = String(valueToSend).trim();
          // If it's in mm/dd/yyyy format, convert to YYYY-MM-DD
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [month, day, year] = dateStr.split("/");
            valueToSend = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
          // If it's already in YYYY-MM-DD format, use as-is
        }

        customFieldsToSend[field.field_label] = valueToSend;
      }
    });
    return customFieldsToSend;
  }, [customFields, customFieldValues]);

  React.useEffect(() => {
    fetchCustomFields();
  }, [fetchCustomFields]);

  return {
    customFields,
    customFieldValues,
    setCustomFieldValues, // ✅ yeh line zaroor add karo
    isLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
    refetch: fetchCustomFields,
  };
}
