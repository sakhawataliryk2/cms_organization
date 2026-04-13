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
  entity_type?: "organization" | "hiring-manager" | "job-seeker" | "job";
}

interface AddressGroupRendererProps {
  fields: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  isEditMode?: boolean;
}

export const ADDRESS_FIELD_NAMES = [
  {
    entity_type: "hiring-managers",
    address: ["Field_12"],
    address2: ["Field_13"],
    city: ["Field_14"],
    state: ["Field_15"],
    zip: ["Field_17"],
  },
  {
    entity_type: "organizations",
    address: ["Field_8"],
    address2: ["Field_9"],
    city: ["Field_10"],
    state: ["Field_11"],
    zip: ["Field_12"],
  },
  {
    entity_type: "jobs",
    address: ["Field_12"],
    address2: ["Field_13"],
    city: ["Field_14"],
    state: ["Field_15"],
    zip: ["Field_17"],
  },
  {
    entity_type: "job-seekers",
    address: ["Field_15"],
    address2: ["Field_16"],
    city: ["Field_17"],
    state: ["Field_18"],
    zip: ["Field_19"],
  },
  {
    entity_type: "leads",
    address: ["Field_7"],
    address2: ["Field_8"],
    city: ["Field_9"],
    state: ["Field_10"],
    zip: ["Field_11"],
  }
];

export function getAddressFields(customFields: CustomFieldDefinition[], entityType?: string) {
  const mapping = ADDRESS_FIELD_NAMES.find(m => m.entity_type === entityType);

  if (!mapping) {
    // If no entityType provided or found in mapping, return empty array as safety
    return [];
  }

  const pick = (names: string[]) =>
    customFields.find((f) => names.includes(f.field_name));

  const address = pick(mapping.address);
  const address2 = pick(mapping.address2);
  const city = pick(mapping.city);
  const state = pick(mapping.state);
  const zip = pick(mapping.zip);

  return [address, address2, city, state, zip].filter(
    Boolean
  ) as CustomFieldDefinition[];
}

/** Check a single address field value (same rules as AddressGroupRenderer). */
function checkAddressFieldComplete(
  field: CustomFieldDefinition,
  values: Record<string, any>,
  entityType?: string
): boolean {
  const value = values?.[field.field_name] ?? "";
  if (field.field_type === "select") {
    if (
      !value ||
      String(value).trim() === "" ||
      String(value).trim().toLowerCase() === "select an option"
    )
      return false;
    return true;
  }
  if (!value || String(value).trim() === "") return false;

  const mapping = ADDRESS_FIELD_NAMES.find(m => m.entity_type === entityType);
  const isZipCodeField =
    mapping?.zip.includes(field.field_name) ||
    field.field_label?.toLowerCase().includes("zip") ||
    field.field_label?.toLowerCase().includes("postal code") ||
    field.field_name?.toLowerCase().includes("zip");

  if (isZipCodeField) return /^\d{5}$/.test(String(value).trim());
  return true;
}

/** Returns true when all address fields in the group have valid values (for ✔ / * label). */
export function isAddressGroupValid(
  fields: CustomFieldDefinition[],
  values: Record<string, any>,
  entityType?: string
): boolean {
  if (!fields.length) return false;
  return fields.every((f) => checkAddressFieldComplete(f, values, entityType));
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-500 shrink-0 pointer-events-none"
      viewBox="0 0 20 20"
      fill="currentColor"
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
  entityType,
}: {
  field: CustomFieldDefinition;
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  hidePlaceholder?: boolean;
  withSearchIcon?: boolean;
  entityType?: string;
}) {
  const selectRef = React.useRef<HTMLSelectElement>(null);
  const value = values?.[field.field_name] ?? "";

  const handleRowClick = () => {
    if (selectRef.current) {
      selectRef.current.focus();
      selectRef.current.click();
    }
  };

  const isValid = () => {
    if (field.field_type === "select") {
      if (
        !value ||
        String(value).trim() === "" ||
        String(value).trim().toLowerCase() === "select an option"
      ) {
        return false;
      }
      return true;
    }

    const hasValue = value && String(value).trim() !== "";
    if (!hasValue) return false;

    const mapping = ADDRESS_FIELD_NAMES.find(m => m.entity_type === entityType);
    const isZipCodeField =
      mapping?.zip.includes(field.field_name) ||
      field.field_label?.toLowerCase().includes("zip") ||
      field.field_label?.toLowerCase().includes("postal code") ||
      field.field_name?.toLowerCase().includes("zip");

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
    <div className="min-w-0 w-full">
      <div
        onClick={field.field_type === "select" ? handleRowClick : undefined}
        className={`
          flex items-center gap-2 py-2.5 px-3 pl-4
          border-b border-gray-300
          transition-colors duration-200
          focus-within:border-blue-500
          ${field.field_type === "select" ? "cursor-pointer" : ""}
        `}
      >
        {field.is_required && (
          <span
            className={`shrink-0 text-sm font-semibold ${fieldIsValid ? "text-green-500" : "text-red-500"}`}
            aria-hidden="true"
          >
            {fieldIsValid ? "✔" : "*"}
          </span>
        )}

        {withSearchIcon && <SearchIcon />}

        <div
          className="address-input flex-1 min-w-0 [&_select]:pr-3"
          ref={(el) => {
            if (el && field.field_type === "select") {
              const select = el.querySelector("select");
              if (select) {
                selectRef.current = select;
              }
            }
          }}
        >
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
  entityType,
}: AddressGroupRendererProps & { entityType?: string }) {
  const mapping = ADDRESS_FIELD_NAMES.find(m => m.entity_type === entityType);

  const addressField = fields.find((f) => mapping?.address.includes(f.field_name));
  const address2Field = fields.find((f) => mapping?.address2.includes(f.field_name));
  const cityField = fields.find((f) => mapping?.city.includes(f.field_name));
  const stateField = fields.find((f) => mapping?.state.includes(f.field_name));
  const zipField = fields.find((f) => mapping?.zip.includes(f.field_name));

  if (
    !addressField &&
    !address2Field &&
    !cityField &&
    !stateField &&
    !zipField
  ) {
    return null;
  }

  const checkFieldComplete = (field: CustomFieldDefinition | undefined): boolean =>
    !field || checkAddressFieldComplete(field, values, entityType);

  const isAddressComplete = addressField ? checkFieldComplete(addressField) : false;
  const isAddress2Complete = address2Field ? checkFieldComplete(address2Field) : true;
  const isCityComplete = cityField ? checkFieldComplete(cityField) : false;
  const isStateComplete = stateField ? checkFieldComplete(stateField) : true;
  const isZipComplete = zipField ? checkFieldComplete(zipField) : false;

  const allFieldsComplete =
    isAddressComplete &&
    isAddress2Complete &&
    isCityComplete &&
    isStateComplete &&
    isZipComplete;

  return (
    <div className="address-underline rounded-lg py-2">

      {/* Row 1: Address & Address 2 */}
      {(addressField || address2Field) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
          {addressField && (
            <div className="space-y-1">
              <UnderlineField
                field={addressField}
                values={values}
                onChange={onChange}
                entityType={entityType}
              />
            </div>
          )}
          {address2Field && (
            <div className="space-y-1">
              <UnderlineField
                field={address2Field}
                values={values}
                onChange={onChange}
                entityType={entityType}
              />
            </div>
          )}
        </div>
      )}

      {/* Row 2: City, State, ZIP */}
      {(cityField || stateField || zipField) && (
        <div className="flex flex-wrap gap-6">
          {cityField && (
            <div className="space-y-1 flex-1 min-w-[140px]">
              <UnderlineField
                field={cityField}
                values={values}
                onChange={onChange}
                entityType={entityType}
              />
            </div>
          )}
          {stateField && (
            <div className="space-y-1 flex-1 min-w-[140px]">
              <CustomFieldRenderer
                field={stateField}
                value={values?.[stateField.field_name] ?? ""}
                onChange={onChange}
              />
            </div>
          )}
          {zipField && (
            <div className="space-y-1 flex-1 min-w-[140px]">
              <UnderlineField
                field={zipField}
                values={values}
                onChange={onChange}
                entityType={entityType}
              />
            </div>
          )}
        </div>
      )}

      {/* Success message */}
      {allFieldsComplete && (
        <div className="mt-5 p-4 bg-green-50 border border-green-200 rounded-lg transition-all duration-300">
          <p className="text-green-800 text-sm font-medium flex items-center gap-2">
            <span className="text-green-600" aria-hidden="true">
              ✓
            </span>
            Address information complete.
          </p>
        </div>
      )}
    </div>
  );
}

