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
}

// Address field label patterns to detect (case-insensitive)
const ADDRESS_FIELD_LABELS = {
  address: ["address", "address1"],
  address2: ["address2", "address 2"],
  city: ["city"],
  state: ["state"],
  zip: ["zip", "zip code", "postal code"],
};

export function getAddressFields(
  customFields: CustomFieldDefinition[]
): CustomFieldDefinition[] {
  const addressFields: CustomFieldDefinition[] = [];

  // Helper function to normalize and compare labels
  const normalizeLabel = (label: string) => label.toLowerCase().trim();

  // Find each address field by field_label (case-insensitive)
  const addressField = customFields.find((f) =>
    ADDRESS_FIELD_LABELS.address.some(
      (label) => normalizeLabel(f.field_label) === normalizeLabel(label)
    )
  );
  const address2Field = customFields.find((f) =>
    ADDRESS_FIELD_LABELS.address2.some(
      (label) => normalizeLabel(f.field_label) === normalizeLabel(label)
    )
  );
  const cityField = customFields.find((f) =>
    ADDRESS_FIELD_LABELS.city.some(
      (label) => normalizeLabel(f.field_label) === normalizeLabel(label)
    )
  );
  const stateField = customFields.find((f) =>
    ADDRESS_FIELD_LABELS.state.some(
      (label) => normalizeLabel(f.field_label) === normalizeLabel(label)
    )
  );
  const zipField = customFields.find((f) =>
    ADDRESS_FIELD_LABELS.zip.some(
      (label) => normalizeLabel(f.field_label) === normalizeLabel(label)
    )
  );

  // Return any found address fields (don't require all of them)
  if (addressField) addressFields.push(addressField);
  if (address2Field) addressFields.push(address2Field);
  if (cityField) addressFields.push(cityField);
  if (stateField) addressFields.push(stateField);
  if (zipField) addressFields.push(zipField);

  return addressFields;
}

export default function AddressGroupRenderer({
  fields,
  values,
  onChange,
}: AddressGroupRendererProps) {
  // Helper function to normalize and compare labels
  const normalizeLabel = (label: string) => label.toLowerCase().trim();

  // Find each address field by field_label (case-insensitive)
  const addressField = fields.find((f) =>
    ["address", "address1"].some(
      (label) => normalizeLabel(f.field_label) === normalizeLabel(label)
    )
  );
  const address2Field = fields.find((f) =>
    ["address2", "address 2"].some(
      (label) => normalizeLabel(f.field_label) === normalizeLabel(label)
    )
  );
  const cityField = fields.find((f) =>
    normalizeLabel(f.field_label) === "city"
  );
  const stateField = fields.find((f) =>
    normalizeLabel(f.field_label) === "state"
  );
  const zipField = fields.find((f) =>
    ["zip", "zip code", "postal code"].some(
      (label) => normalizeLabel(f.field_label) === normalizeLabel(label)
    )
  );

  // Only return null if NO address-related fields exist at all
  if (!addressField && !address2Field && !cityField && !stateField && !zipField) {
    return null;
  }

  return (
    <div className="mb-3">
      {/* Row 1: Address (left) + Address2 (right) */}
      {(addressField || address2Field) && (
        <div className="flex gap-4 mb-2">
          {/* Address Field */}
          {addressField && (
            <div className="flex-1">
              <div className="flex items-center">
                <label className="w-48 font-medium flex items-center">
                  {addressField.field_label}:
                  {addressField.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <div className="flex-1 relative">
                  <CustomFieldRenderer
                    field={addressField}
                    value={values[addressField.field_name] || ""}
                    onChange={onChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Address2 Field (if exists) */}
          {address2Field && (
            <div className="flex-1">
              <div className="flex items-center">
                <label className="w-48 font-medium flex items-center">
                  {address2Field.field_label}:
                  {address2Field.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <div className="flex-1 relative">
                  <CustomFieldRenderer
                    field={address2Field}
                    value={values[address2Field.field_name] || ""}
                    onChange={onChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row 2: City (left) + State (middle) + Zip (right) */}
      {(cityField || stateField || zipField) && (
        <div className="flex gap-4">
          {/* City Field */}
          {cityField && (
            <div className="flex-1">
              <div className="flex items-center">
                <label className="w-48 font-medium flex items-center">
                  {cityField.field_label}:
                  {cityField.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <div className="flex-1 relative">
                  <CustomFieldRenderer
                    field={cityField}
                    value={values[cityField.field_name] || ""}
                    onChange={onChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* State Field */}
          {stateField && (
            <div className="flex-1">
              <div className="flex items-center">
                <label className="w-48 font-medium flex items-center">
                  {stateField.field_label}:
                  {stateField.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <div className="flex-1 relative">
                  <CustomFieldRenderer
                    field={stateField}
                    value={values[stateField.field_name] || ""}
                    onChange={onChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Zip Field */}
          {zipField && (
            <div className="flex-1">
              <div className="flex items-center">
                <label className="w-48 font-medium flex items-center">
                  {zipField.field_label}:
                  {zipField.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                  {/* Zip lookup icon */}
                  <svg
                    className="w-4 h-4 ml-1 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </label>
                <div className="flex-1 relative">
                  <CustomFieldRenderer
                    field={zipField}
                    value={values[zipField.field_name] || ""}
                    onChange={onChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

