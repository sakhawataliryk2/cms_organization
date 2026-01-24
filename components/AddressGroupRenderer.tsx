"use client";

import React from "react";
import CustomFieldRenderer from "./CustomFieldRenderer";

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

interface AddressGroupRendererProps {
  fields: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  isEditMode?: boolean;
}

const ADDRESS_FIELD_LABELS = {
  address: ["address", "address1"],
  address2: ["address2", "address 2"],
  city: ["city"],
  state: ["state"],
  zip: ["zip", "zip code", "postal code"],
};

export function getAddressFields(customFields: CustomFieldDefinition[]) {
  const normalize = (s: string) => (s || "").toLowerCase().trim();

  const pick = (labels: string[]) =>
    customFields.find((f) =>
      labels.some((l) => normalize(f.field_label) === normalize(l))
    );

  const address = pick(ADDRESS_FIELD_LABELS.address);
  const address2 = pick(ADDRESS_FIELD_LABELS.address2);
  const city = pick(ADDRESS_FIELD_LABELS.city);
  const state = pick(ADDRESS_FIELD_LABELS.state);
  const zip = pick(ADDRESS_FIELD_LABELS.zip);

  return [address, address2, city, state, zip].filter(
    Boolean
  ) as CustomFieldDefinition[];
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>

  );
}

function UnderlineField({
  field,
  values,
  onChange,
  hidePlaceholder = false,
  withSearchIcon = false,
}: {
  field: CustomFieldDefinition;
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  hidePlaceholder?: boolean;
  withSearchIcon?: boolean;
}) {
  const value = values?.[field.field_name] ?? "";

  // Check if field has a valid value
  const isValid = () => {
    // For select fields, check if a valid option is selected
    if (field.field_type === "select") {
      if (!value || String(value).trim() === "" || String(value).trim().toLowerCase() === "select an option") {
        return false;
      }
      return true;
    }

    const hasValue = value && String(value).trim() !== "";
    if (!hasValue) return false;

    // Special validation for ZIP code (must be exactly 5 digits)
    // Check by both label and field_name (Field_24)
    const isZipCodeField =
      field.field_label?.toLowerCase().includes("zip") ||
      field.field_label?.toLowerCase().includes("postal code") ||
      field.field_name?.toLowerCase().includes("zip") ||
      field.field_name === "Field_24" || // ZIP Code
      field.field_name === "field_24";

    if (isZipCodeField) {
      return /^\d{5}$/.test(String(value).trim());
    }

    return true;
  };

  const fieldIsValid = isValid();

  const safeField: CustomFieldDefinition = {
    ...field,
    placeholder: hidePlaceholder ? "" : field.field_label,
  };

  return (
    <div className="min-w-0">
      <div className="border-b border-gray-300 flex items-center gap-2">
        {/* Red circle or green checkmark at the beginning - consistent with other fields */}
        {field.is_required && (
          fieldIsValid ? (
            <span className="text-green-500 text-sm transition-opacity duration-300 ease-in-out flex-shrink-0">
              ✔
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full inline-block bg-red-500 transition-colors duration-300 flex-shrink-0" />
          )
        )}

        {withSearchIcon && <SearchIcon />}

        <div className="address-input flex-1">
          <CustomFieldRenderer
            field={safeField}
            value={value}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
}

export default function AddressGroupRenderer({
  fields,
  values,
  onChange,
  isEditMode = false,
}: AddressGroupRendererProps) {
  const normalize = (s: string) => (s || "").toLowerCase().trim();

  const addressField = fields.find((f) =>
    ["address", "address1"].some(
      (l) => normalize(f.field_label) === normalize(l)
    )
  );

  const address2Field = fields.find((f) =>
    ["address2", "address 2"].some(
      (l) => normalize(f.field_label) === normalize(l)
    )
  );

  const cityField = fields.find((f) => normalize(f.field_label) === "city");
  const stateField = fields.find((f) => normalize(f.field_label) === "state");

  const zipField = fields.find((f) =>
    ["zip", "zip code", "postal code"].some(
      (l) => normalize(f.field_label) === normalize(l)
    )
  );

  if (!addressField && !address2Field && !cityField && !stateField && !zipField)
    return null;

  // Check if a field is complete (filled and valid)
  const checkFieldComplete = (field: CustomFieldDefinition | undefined): boolean => {
    if (!field) return true; // Field doesn't exist, consider it complete for validation purposes
    const value = values?.[field.field_name] ?? "";

    // For select fields, empty string means "Select an option" (not selected)
    if (field.field_type === "select") {
      if (!value || String(value).trim() === "" || String(value).trim().toLowerCase() === "select an option") {
        return false;
      }
      return true;
    }

    if (!value || String(value).trim() === "") return false;

    // Special validation for ZIP code (must be exactly 5 digits)
    // Check by both label and field_name (Field_24)
    const isZipCodeField =
      field.field_label?.toLowerCase().includes("zip") ||
      field.field_label?.toLowerCase().includes("postal code") ||
      field.field_name?.toLowerCase().includes("zip") ||
      field.field_name === "Field_24" || // ZIP Code
      field.field_name === "field_24";
    if (isZipCodeField) {
      return /^\d{5}$/.test(String(value).trim());
    }

    return true;
  };

  // Check if all main address fields are complete
  // Address, City, State, and ZIP Code must be filled
  // Address 2: if it exists in the form, it must be filled; if it doesn't exist, we don't check it
  const isAddressComplete = addressField ? checkFieldComplete(addressField) : false;
  const isAddress2Complete = address2Field ? checkFieldComplete(address2Field) : true; // If Address 2 field doesn't exist, consider it complete
  const isCityComplete = cityField ? checkFieldComplete(cityField) : false;
  const isStateComplete = stateField ? checkFieldComplete(stateField) : true; // State might be optional, but if it exists and is required, check it
  const isZipComplete = zipField ? checkFieldComplete(zipField) : false;

  // All main address fields are complete (Address, City, State, ZIP Code)
  // Address 2 is optional, so if it doesn't exist, we only check Address, City, State, and ZIP Code
  const allFieldsComplete = isAddressComplete && isAddress2Complete && isCityComplete && isStateComplete && isZipComplete;

  return (
    <div className="address-underline">
      {/* Row 1 */}
      {(addressField || address2Field) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
          {addressField && (
            <UnderlineField
              field={addressField}
              values={values}
              onChange={onChange}
            />
          )}
          {address2Field && (
            <UnderlineField
              field={address2Field}
              values={values}
              onChange={onChange}
            />
          )}
        </div>
      )}

      {/* Row 2 */}
      {(cityField || stateField || zipField) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-3 mt-3">
          {cityField && (
            <UnderlineField
              field={cityField}
              values={values}
              onChange={onChange}
            />
          )}
          {stateField && (
            <UnderlineField
              withSearchIcon
              field={stateField}
              values={values}
              onChange={onChange}
            />
          )}
          {zipField && (
            <UnderlineField
              field={zipField}
              values={values}
              onChange={onChange}
            />
          )}
        </div>
      )}

      {/* Success message when all fields are complete */}
      {allFieldsComplete && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md transition-all duration-300 ease-in-out transform opacity-100">
          <p className="text-green-700 text-sm font-medium flex items-center">
            <span className="mr-2">✅</span>
            Address information complete.
          </p>
        </div>
      )}
    </div>
  );

}
