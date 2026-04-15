"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import LookupField from "@/components/LookupField";
import MultiSelectLookupField from "@/components/MultiSelectLookupField";
import {
  AUTO_CURRENT_DATE,
  AUTO_CURRENT_DATETIME,
  AUTO_CURRENT_OWNER_USER_ID,
} from "@/lib/custom-field-auto-defaults";
import {
  type FieldMappingLookupType,
  fromDatetimeLocalInputValue,
  getDefaultValueHelperText,
  getDefaultValuePlaceholder,
  parseMultiselectDefault,
  toDateInputValue,
  toDatetimeLocalInputValue,
} from "@/lib/field-mapping-default-value";

export interface FieldMappingDefaultValueControlProps {
  fieldType: string;
  options: string[];
  lookupType: FieldMappingLookupType;
  value: string;
  onChange: (value: string) => void;
  locked?: boolean;
  validationError?: string | null;
}

function inputClass(locked: boolean) {
  return `w-full px-3 py-2 border rounded ${locked ? "bg-gray-200 cursor-not-allowed" : ""}`;
}

function lockSelectProps(locked: boolean) {
  return {
    onMouseDown: (e: MouseEvent) => locked && e.preventDefault(),
    onKeyDown: (e: KeyboardEvent) => locked && e.preventDefault(),
    tabIndex: locked ? (-1 as const) : (0 as const),
  };
}

export default function FieldMappingDefaultValueControl({
  fieldType,
  options,
  lookupType,
  value,
  onChange,
  locked = false,
  validationError,
}: FieldMappingDefaultValueControlProps) {
  const ft = fieldType;
  const trimmedOptions = options.map((o) => String(o).trim()).filter(Boolean);
  const hasPicklistOptions = trimmedOptions.length > 0;
  const isPicklistSingle = ft === "select" || ft === "radio";
  const isPicklistMulti = ft === "multiselect" || ft === "multicheckbox";

  const helper = getDefaultValueHelperText(ft);
  const placeholder = getDefaultValuePlaceholder(ft);

  const renderBody = () => {
    if (ft === "file" || ft === "composite") {
      return (
        <div
          className={`${inputClass(true)} text-gray-600 text-sm py-3`}
          aria-readonly
        >
          {ft === "file"
            ? "No default can be set for file uploads."
            : "Composite fields use sub-fields only; no single default."}
        </div>
      );
    }

    if (isPicklistSingle && hasPicklistOptions) {
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!locked)}
          disabled={locked}
          {...lockSelectProps(!!locked)}
        >
          <option value="">— None —</option>
          {trimmedOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (isPicklistMulti && hasPicklistOptions) {
      const selected = parseMultiselectDefault(value);
      return (
        <select
          multiple
          value={selected}
          onChange={(e) => {
            const next = Array.from(e.target.selectedOptions, (o) => o.value);
            onChange(next.join(","));
          }}
          className={`${inputClass(!!locked)} min-h-[100px]`}
          disabled={locked}
          {...lockSelectProps(!!locked)}
        >
          {trimmedOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (isPicklistSingle || isPicklistMulti) {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!locked)}
          placeholder="Add options first, then set default"
          readOnly={locked}
        />
      );
    }

    if (ft === "checkbox") {
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!locked)}
          disabled={locked}
          {...lockSelectProps(!!locked)}
        >
          <option value="">— None —</option>
          <option value="true">Checked (true)</option>
          <option value="false">Unchecked (false)</option>
        </select>
      );
    }

    if (ft === "date") {
      const modeAuto = value === AUTO_CURRENT_DATE;
      return (
        <div className="space-y-2">
          <select
            value={modeAuto ? "auto" : "fixed"}
            onChange={(e) => {
              if (e.target.value === "auto") onChange(AUTO_CURRENT_DATE);
              else onChange("");
            }}
            className={inputClass(!!locked)}
            disabled={locked}
            {...lockSelectProps(!!locked)}
          >
            <option value="fixed">Fixed calendar date</option>
            <option value="auto">Current date when adding a new record</option>
          </select>
          {!modeAuto && (
            <input
              type="date"
              value={toDateInputValue(value)}
              onChange={(e) => onChange(e.target.value)}
              className={inputClass(!!locked)}
              disabled={locked}
            />
          )}
        </div>
      );
    }

    if (ft === "datetime") {
      const modeAuto = value === AUTO_CURRENT_DATETIME;
      return (
        <div className="space-y-2">
          <select
            value={modeAuto ? "auto" : "fixed"}
            onChange={(e) => {
              if (e.target.value === "auto") onChange(AUTO_CURRENT_DATETIME);
              else onChange("");
            }}
            className={inputClass(!!locked)}
            disabled={locked}
            {...lockSelectProps(!!locked)}
          >
            <option value="fixed">Fixed date and time</option>
            <option value="auto">Current date and time when adding a new record</option>
          </select>
          {!modeAuto && (
            <input
              type="datetime-local"
              value={
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test((value || "").trim())
                  ? (value || "").trim().slice(0, 16)
                  : toDatetimeLocalInputValue(value)
              }
              onChange={(e) =>
                onChange(fromDatetimeLocalInputValue(e.target.value))
              }
              className={inputClass(!!locked)}
              disabled={locked}
            />
          )}
        </div>
      );
    }

    if (ft === "number") {
      return (
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const t = e.target.value;
            if (t === "" || t === "-") {
              onChange(t);
              return;
            }
            if (/^-?\d*\.?\d*$/.test(t)) onChange(t);
          }}
          className={inputClass(!!locked)}
          placeholder={placeholder}
          readOnly={locked}
        />
      );
    }

    if (ft === "currency") {
      return (
        <div className="relative w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 select-none pointer-events-none">
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              let v = e.target.value.replace(/[^0-9.]/g, "");
              const parts = v.split(".");
              if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
              if (v.includes(".")) {
                const [intPart, decPart] = v.split(".");
                v = intPart + "." + (decPart ?? "").slice(0, 2);
              }
              onChange(v);
            }}
            className={`${inputClass(!!locked)} pl-7`}
            placeholder={placeholder}
            readOnly={locked}
          />
        </div>
      );
    }

    if (ft === "percentage") {
      return (
        <div className="relative w-full">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              const t = e.target.value;
              if (t === "") {
                onChange("");
                return;
              }
              if (/^\d*\.?\d*$/.test(t)) onChange(t);
            }}
            className={`${inputClass(!!locked)} pr-8`}
            placeholder={placeholder}
            readOnly={locked}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
            %
          </span>
        </div>
      );
    }

    if (ft === "lookup") {
      if (lookupType === "owner") {
        const modeAuto = value === AUTO_CURRENT_OWNER_USER_ID;
        return (
          <div className="space-y-2">
            <select
              value={modeAuto ? "auto" : "fixed"}
              onChange={(e) => {
                if (e.target.value === "auto") onChange(AUTO_CURRENT_OWNER_USER_ID);
                else onChange("");
              }}
              className={inputClass(!!locked)}
              disabled={locked}
              {...lockSelectProps(!!locked)}
            >
              <option value="fixed">Pick a specific user</option>
              <option value="auto">
                Logged-in user when adding a new record
              </option>
            </select>
            {!modeAuto && (
              <LookupField
                value={value}
                onChange={onChange}
                lookupType="owner"
                placeholder="— None —"
                disabled={locked}
              />
            )}
          </div>
        );
      }
      return (
        <LookupField
          value={value}
          onChange={onChange}
          lookupType={lookupType}
          placeholder="— None —"
          disabled={locked}
        />
      );
    }

    if (ft === "multiselect_lookup") {
      return (
        <MultiSelectLookupField
          value={value}
          onChange={(v) =>
            onChange(Array.isArray(v) ? v.filter(Boolean).join(",") : String(v || ""))
          }
          lookupType={lookupType}
          placeholder="Search records…"
          disabled={locked}
        />
      );
    }

    if (ft === "textarea") {
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!locked)}
          placeholder={placeholder}
          rows={3}
          readOnly={locked}
        />
      );
    }

    if (ft === "email") {
      return (
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!locked)}
          placeholder={placeholder}
          readOnly={locked}
        />
      );
    }

    if (ft === "url" || ft === "link") {
      return (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!locked)}
          placeholder={placeholder}
          readOnly={locked}
        />
      );
    }

    if (ft === "phone") {
      return (
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(!!locked)}
          placeholder={placeholder}
          maxLength={24}
          readOnly={locked}
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass(!!locked)}
        placeholder={placeholder}
        readOnly={locked}
      />
    );
  };

  return (
    <div className="space-y-1">
      {renderBody()}
      <p className="text-xs text-gray-500">{helper}</p>
      {validationError ? (
        <p className="text-xs text-red-600" role="alert">
          {validationError}
        </p>
      ) : null}
    </div>
  );
}
