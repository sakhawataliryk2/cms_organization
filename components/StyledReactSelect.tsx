"use client";

import { useId } from "react";
import Select, { type GroupBase, type Props as SelectProps } from "react-select";

export type StyledSelectOption = {
  label: string;
  value: string;
  isDisabled?: boolean;
  meta?: unknown;
};

type StyledReactSelectProps<IsMulti extends boolean = false> = SelectProps<
  StyledSelectOption,
  IsMulti,
  GroupBase<StyledSelectOption>
> & {
  hasError?: boolean;
  variant?: "default" | "form";
};

export default function StyledReactSelect<IsMulti extends boolean = false>({
  hasError = false,
  variant = "default",
  styles,
  instanceId: instanceIdProp,
  ...props
}: StyledReactSelectProps<IsMulti>) {
  const reactId = useId().replace(/:/g, "");
  const instanceId = instanceIdProp ?? `rs-${reactId}`;
  const isForm = variant === "form";

  return (
    <Select
      {...props}
      instanceId={instanceId}
      styles={{
        control: (base, state) => ({
          ...base,
          ...(isForm
            ? {
                fontSize: "1rem",
                color: "#000000",
                ...(state.isMulti
                  ? {
                      borderColor: hasError
                        ? "#ef4444"
                        : state.isFocused
                          ? "#3b82f6"
                          : "#d1d5db",
                      borderWidth: 1,
                      boxShadow: state.isFocused
                        ? hasError
                          ? "0 0 0 2px rgba(239,68,68,0.28)"
                          : "0 0 0 2px rgba(59,130,246,0.35)"
                        : "none",
                      minHeight: 42,
                      "&:hover": {
                        borderColor: hasError ? "#ef4444" : "#9ca3af",
                      },
                    }
                  : {
                      borderTop: 0,
                      borderLeft: 0,
                      borderRight: 0,
                      borderBottom: "1px solid",
                      borderRadius: 0,
                      boxShadow: "none",
                      borderBottomColor: hasError
                        ? "#ef4444"
                        : state.isFocused
                          ? "#3b82f6"
                          : "#d1d5db",
                      minHeight: 36,
                      "&:hover": {
                        borderBottomColor: hasError ? "#ef4444" : "#d1d5db",
                      },
                    }),
              }
            : {
                borderColor: hasError
                  ? "#ef4444"
                  : state.isFocused
                    ? "#3b82f6"
                    : "#d1d5db",
                borderWidth: 1,
                boxShadow: state.isFocused
                  ? hasError
                    ? "0 0 0 2px rgba(239,68,68,0.28)"
                    : "0 0 0 2px rgba(59,130,246,0.35)"
                  : "none",
                minHeight: 42,
                "&:hover": {
                  borderColor: hasError ? "#ef4444" : "#9ca3af",
                },
              }),
        }),
        valueContainer: (base) => ({
          ...base,
          ...(isForm ? { padding: "6px 8px" } : {}),
        }),
        placeholder: (base) => ({
          ...base,
          color: "#6b7280",
          ...(isForm ? { fontSize: "1rem", color: "#6b7280" } : {}),
        }),
        singleValue: (base) => ({
          ...base,
          ...(isForm ? { fontSize: "1rem", color: "#000000" } : {}),
        }),
        input: (base) => ({
          ...base,
          ...(isForm ? { fontSize: "1rem", color: "#000000" } : {}),
        }),
        dropdownIndicator: (base) => ({
          ...base,
          ...(isForm ? { padding: "4px", color: "#6b7280" } : {}),
        }),
        clearIndicator: (base) => ({
          ...base,
          ...(isForm ? { padding: "4px" } : {}),
        }),
        menu: (base) => ({
          ...base,
          border: "1px solid #d1d5db",
          boxShadow:
            "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          zIndex: 30,
          ...(isForm ? { fontSize: "1rem" } : {}),
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isDisabled
            ? "#f9fafb"
            : state.isFocused
              ? "#eff6ff"
              : "#ffffff",
          color: state.isDisabled ? "#9ca3af" : "#111827",
          cursor: state.isDisabled ? "not-allowed" : "pointer",
        }),
        multiValue: (base) => ({
          ...base,
          backgroundColor: "#dbeafe",
          borderRadius: 6,
        }),
        multiValueLabel: (base) => ({
          ...base,
          color: "#1e40af",
        }),
        multiValueRemove: (base) => ({
          ...base,
          color: "#1e40af",
          ":hover": {
            backgroundColor: "#bfdbfe",
            color: "#1e3a8a",
          },
        }),
        ...styles,
      }}
    />
  );
}
