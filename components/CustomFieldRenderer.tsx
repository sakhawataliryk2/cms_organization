"use client";

import React from "react";
import LookupField from "./LookupField";

interface CustomFieldDefinition {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_hidden: boolean;
  options?: string[] | string | Record<string, unknown> | null;
  placeholder?: string | null;
  default_value?: string | null;
  sort_order: number;
  lookup_type?: "organizations" | "hiring-managers" | "job-seekers" | "jobs";
}

interface CustomFieldRendererProps {
  field: CustomFieldDefinition;
  value: any;
  onChange: (fieldName: string, value: any) => void;
  className?: string;
}

export default function CustomFieldRenderer({
  field,
  value,
  onChange,
  className = "w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500",
}: CustomFieldRendererProps) {
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

  // Handle phone number input changes
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatPhoneNumber(input);
    onChange(field.field_name, formatted);
  };

  const fieldProps = {
    id: field.field_name,
    value: value || "",
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => onChange(field.field_name, e.target.value),
    className,
    placeholder: field.placeholder || "",
    required: field.is_required,
  };

  // Special props for salary fields (without onChange)
  const salaryFieldProps = {
    id: field.field_name,
    className,
    placeholder: field.placeholder || "",
    required: field.is_required,
  };

  switch (field.field_type) {
    case "textarea":
      return (
        <textarea
          {...fieldProps}
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          rows={3}
        />
      );
    case "select":
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
          onChange={(e) => onChange(field.field_name, e.target.checked)}
          className="h-4 w-4"
        />
      );
    case "number": {
      // Check if this field is for job salaries
      if (
        field.field_name === "minSalary" ||
        field.field_name === "maxSalary"
      ) {
        return (
          <input
            {...salaryFieldProps}
            type="text" // Text so we can add "$" & commas
            value={formatSalaryValue(value)}
            onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
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

              let number = parseFloat(inputValue);

              if (!isNaN(number) && inputValue !== "") {
                // Format as $XX,XXX.XX
                const formatted = number.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                });
                e.target.value = formatted;
                // Call onChange with the numeric value for storage
                onChange(field.field_name, number);
              } else if (inputValue === "") {
                e.target.value = "";
                onChange(field.field_name, "");
              }
            }}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
              // Ensure proper formatting on blur
              let inputValue = e.target.value.replace(/[^0-9.]/g, "");
              let number = parseFloat(inputValue);

              if (!isNaN(number) && inputValue !== "") {
                const formatted = number.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                });
                e.target.value = formatted;
                onChange(field.field_name, number);
              }
            }}
            placeholder="$XX,XXX.XX"
          />
        );
      }

      // Check if this is a ZIP code field (even if defined as "number" type, treat as text for leading zeros)
      const isZipCodeFieldNumber =
        field.field_label?.toLowerCase().includes("zip") ||
        field.field_label?.toLowerCase().includes("postal code") ||
        field.field_name?.toLowerCase().includes("zip") ||
        field.field_name === "Field_24" || // ZIP Code
        field.field_name === "field_24";

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
      // Check by both label and field_name (Field_32, Field_25, Field_31)
      const isNonNegativeField =
        field.field_label?.toLowerCase().includes("employees") ||
        field.field_label?.toLowerCase().includes("offices") ||
        field.field_label?.toLowerCase().includes("oasis key") ||
        field.field_name?.toLowerCase().includes("employees") ||
        field.field_name?.toLowerCase().includes("offices") ||
        field.field_name?.toLowerCase().includes("oasis") ||
        field.field_name === "Field_32" || // # of employees
        field.field_name === "field_32" ||
        field.field_name === "Field_25" || // # of offices
        field.field_name === "field_25" ||
        field.field_name === "Field_31" || // Oasis Key
        field.field_name === "field_31";

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
    case "date":
      // Format date value for display (mm/dd/yyyy)
      // Show today's date when field is empty (for all date fields)
      const displayValue = React.useMemo(() => {
        if (!value || value === "") {
          // Show today's date as default when field is empty
          const today = new Date();
          const month = String(today.getMonth() + 1).padStart(2, "0");
          const day = String(today.getDate()).padStart(2, "0");
          const year = today.getFullYear();
          return `${month}/${day}/${year}`;
        }
        return formatDateToMMDDYYYY(String(value));
      }, [value, formatDateToMMDDYYYY]);

      // Handle date input with mm/dd/yyyy formatting
      const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputValue = e.target.value;
        
        // Remove all non-digit characters
        const digitsOnly = inputValue.replace(/\D/g, "");
        
        // Format as user types: mm/dd/yyyy
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
        
        // Limit to mm/dd/yyyy format (10 characters)
        if (formatted.length > 10) {
          formatted = formatted.substring(0, 10);
        }
        
        // Update the input value
        e.target.value = formatted;
        
        // Convert to YYYY-MM-DD for storage if complete
        if (formatted.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) {
          const [month, day, year] = formatted.split("/");
          const dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          // Validate the date
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            // Store as YYYY-MM-DD for backend compatibility
            onChange(field.field_name, dateStr);
          } else {
            // Invalid date, store as-is for now (will be caught by validation)
            onChange(field.field_name, formatted);
          }
        } else {
          // Incomplete date, store as-is for display
          onChange(field.field_name, formatted);
        }
      };

      return (
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
            // Validate on blur
            const inputValue = e.target.value.trim();
            if (inputValue && inputValue.length === 10) {
              const [month, day, year] = inputValue.split("/");
              const dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                // Valid date, ensure it's stored as YYYY-MM-DD
                onChange(field.field_name, dateStr);
              }
            }
          }}
        />
      );
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
    case "file":
      return (
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
      return (
        <LookupField
          value={value || ""}
          onChange={(val) => onChange(field.field_name, val)}
          lookupType={field.lookup_type || "organizations"}
          placeholder={field.placeholder || "Select an option"}
          required={field.is_required}
          className={className}
        />
      );
    default:
      // Check if this is a ZIP code field
      // Check by both label and field_name (Field_24)
      const isZipCodeField =
        field.field_label?.toLowerCase().includes("zip") ||
        field.field_label?.toLowerCase().includes("postal code") ||
        field.field_name?.toLowerCase().includes("zip") ||
        field.field_name?.toLowerCase().includes("postal") ||
        field.field_name === "Field_24" || // ZIP Code
        field.field_name === "field_24";

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

          {/* Sirf Job Title field ke liye icon show kare */}
          {field.field_name === "jobTitle" &&
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

// Hook for managing custom fields
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
        const customFieldValues: Record<string, any> = {};
        sortedFields.forEach((field: CustomFieldDefinition) => {
          customFieldValues[field.field_name] = field.default_value || "";
        });
        setCustomFieldValues(customFieldValues);
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
      const trimmed = String(value).trim();
      // Empty string means no value selected (especially for select fields)
      if (trimmed === "") return false;
      
      // Special validation for date fields
      if (field.field_type === "date") {
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
        const [year, month, day] = dateToValidate.split("-");
        if (date.getFullYear() !== parseInt(year) ||
            date.getMonth() + 1 !== parseInt(month) ||
            date.getDate() !== parseInt(day)) {
          return false; // Invalid date (e.g., 02/30/2024)
        }
        
        return true;
      }
      
      // Special validation for ZIP code (must be exactly 5 digits)
      // Check by both label and field_name (Field_24)
      const isZipCodeField =
        field.field_label?.toLowerCase().includes("zip") ||
        field.field_label?.toLowerCase().includes("postal code") ||
        field.field_name?.toLowerCase().includes("zip") ||
        field.field_name === "Field_24" || // ZIP Code
        field.field_name === "field_24";
      if (isZipCodeField) {
        return /^\d{5}$/.test(trimmed);
      }
      
      // Special validation for numeric fields that allow values >= 0
      // Check by both label and field_name (Field_32, Field_25, Field_31)
      const isNonNegativeField =
        field.field_label?.toLowerCase().includes("employees") ||
        field.field_label?.toLowerCase().includes("offices") ||
        field.field_label?.toLowerCase().includes("oasis key") ||
        field.field_name?.toLowerCase().includes("employees") ||
        field.field_name?.toLowerCase().includes("offices") ||
        field.field_name?.toLowerCase().includes("oasis") ||
        field.field_name === "Field_32" || // # of employees
        field.field_name === "field_32" ||
        field.field_name === "Field_25" || // # of offices
        field.field_name === "field_25" ||
        field.field_name === "Field_31" || // Oasis Key
        field.field_name === "field_31";
      if (isNonNegativeField && field.field_type === "number") {
        const numValue = parseFloat(trimmed);
        // Allow values >= 0 (0, 1, 2, etc.)
        if (isNaN(numValue) || numValue < 0) {
          return false;
        }
      }
      
      // Special validation for phone fields (Main Phone, etc.)
      // Check by both field_type and field_name (Field_5)
      const isPhoneField =
        field.field_type === "phone" ||
        field.field_label?.toLowerCase().includes("phone") ||
        field.field_name === "Field_5" || // Main Phone
        field.field_name === "field_5";
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
        return phoneRegex.test(trimmed);
      }
      
      // Special validation for URL fields (Organization Website, etc.)
      // Check by both field_type and field_name (Field_4)
      const isUrlField =
        field.field_type === "url" ||
        field.field_label?.toLowerCase().includes("website") ||
        field.field_label?.toLowerCase().includes("url") ||
        field.field_name === "Field_4" || // Organization Website
        field.field_name === "field_4";
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
          
          // Add specific error messages for validation failures
          const isZipCodeField =
            field.field_label?.toLowerCase().includes("zip") ||
            field.field_label?.toLowerCase().includes("postal code") ||
            field.field_name?.toLowerCase().includes("zip") ||
            field.field_name === "Field_24" || // ZIP Code
            field.field_name === "field_24";
          if (isZipCodeField && value && String(value).trim() !== "") {
            errorMessage = `${field.field_label} must be exactly 5 digits`;
          }
          
          const isNonNegativeField =
            field.field_label?.toLowerCase().includes("employees") ||
            field.field_label?.toLowerCase().includes("offices") ||
            field.field_label?.toLowerCase().includes("oasis key") ||
            field.field_name?.toLowerCase().includes("employees") ||
            field.field_name?.toLowerCase().includes("offices") ||
            field.field_name?.toLowerCase().includes("oasis") ||
            field.field_name === "Field_32" || // # of employees
            field.field_name === "field_32" ||
            field.field_name === "Field_25" || // # of offices
            field.field_name === "field_25" ||
            field.field_name === "Field_31" || // Oasis Key
            field.field_name === "field_31";
          if (isNonNegativeField && value && !isNaN(parseFloat(String(value)))) {
            const numValue = parseFloat(String(value));
            if (numValue < 0) {
              errorMessage = `${field.field_label} must be 0 or greater`;
            }
          }
          
          // Add specific error message for phone validation failures
          // Check by both field_type and field_name (Field_5)
          const isPhoneFieldError =
            field.field_type === "phone" ||
            field.field_label?.toLowerCase().includes("phone") ||
            field.field_name === "Field_5" || // Main Phone
            field.field_name === "field_5";
          if (isPhoneFieldError && value && String(value).trim() !== "") {
            const trimmed = String(value).trim();
            const digitsOnly = trimmed.replace(/\D/g, "");
            if (digitsOnly.length !== 10) {
              errorMessage = `${field.field_label} must be a complete 10-digit phone number`;
            } else {
              const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
              if (!phoneRegex.test(trimmed)) {
                errorMessage = `${field.field_label} must be formatted as (000) 000-0000`;
              }
            }
          }
          
          // Add specific error message for URL validation failures
          // Check by both field_type and field_name (Field_4)
          const isUrlFieldError =
            field.field_type === "url" ||
            field.field_label?.toLowerCase().includes("website") ||
            field.field_label?.toLowerCase().includes("url") ||
            field.field_name === "Field_4" || // Organization Website
            field.field_name === "field_4";
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
