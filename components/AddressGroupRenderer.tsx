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

/** Check a single address field value (same rules as AddressGroupRenderer). */
function checkAddressFieldComplete(
  field: CustomFieldDefinition,
  values: Record<string, any>
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
  const isZipCodeField =
    field.field_label?.toLowerCase().includes("zip") ||
    field.field_label?.toLowerCase().includes("postal code") ||
    field.field_name?.toLowerCase().includes("zip");
  if (isZipCodeField) return /^\d{5}$/.test(String(value).trim());
  return true;
}

/** Returns true when all address fields in the group have valid values (for ✔ / * label). */
export function isAddressGroupValid(
  fields: CustomFieldDefinition[],
  values: Record<string, any>
): boolean {
  if (!fields.length) return false;
  return fields.every((f) => checkAddressFieldComplete(f, values));
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400 shrink-0"
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

    // Use label/type only — no field_name (Field_24) so mapping per entity is respected
    const isZipCodeField =
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
        className={`
          flex items-center gap-3 py-2.5 px-1
          border-b border-gray-300
          transition-colors duration-200
          focus-within:border-blue-500
        `}
      >
        {field.is_required && (
          fieldIsValid ? (
            <span
              className="text-green-600 text-sm shrink-0 transition-opacity duration-300"
              aria-hidden="true"
            >
              ✔
            </span>
          ) : (
            <span
              className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 transition-colors duration-300"
              aria-hidden="true"
            />
          )
        )}

        {withSearchIcon && <SearchIcon />}

        <div className="address-input flex-1 min-w-0">
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
    !field || checkAddressFieldComplete(field, values);

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
              />
            </div>
          )}
          {address2Field && (
            <div className="space-y-1">
              <UnderlineField
                field={address2Field}
                values={values}
                onChange={onChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Row 2: City, State, ZIP */}
      {(cityField || stateField || zipField) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cityField && (
            <div className="space-y-1">
              <UnderlineField
                field={cityField}
                values={values}
                onChange={onChange}
              />
            </div>
          )}
          {stateField && (
            <div className="space-y-1">
              <UnderlineField
                withSearchIcon
                field={stateField}
                values={values}
                onChange={onChange}
              />
            </div>
          )}
          {zipField && (
            <div className="space-y-1">
              <UnderlineField
                field={zipField}
                values={values}
                onChange={onChange}
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
