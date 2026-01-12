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
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
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
  const hasValue = value && String(value).trim() !== "";

  const safeField: CustomFieldDefinition = {
    ...field,
    placeholder: hidePlaceholder ? "" : field.field_label,
  };

  return (
    <div className="min-w-0">
      <div className="border-b border-gray-300 flex items-center gap-2">
        {field.is_required && (
          <span
            className={`w-2 h-2 rounded-full inline-block ${
              hasValue ? "bg-green-500" : "bg-red-500"
            }`}
          />
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
    </div>
  );

}
