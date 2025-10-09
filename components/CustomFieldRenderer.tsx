'use client'

import React from 'react';

interface CustomFieldDefinition {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_hidden: boolean;
  options?: string[];
  placeholder?: string;
  default_value?: string;
  sort_order: number;
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
  className = "w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500" 
}: CustomFieldRendererProps) {
  if (field.is_hidden) return null;

  // Phone number formatting function
  const formatPhoneNumber = (input: string) => {
    // Remove all non-numeric characters
    const cleaned = input.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limited = cleaned.substring(0, 10);
    
    // Format as (000) 000-0000
    if (limited.length >= 6) {
      return `(${limited.substring(0, 3)}) ${limited.substring(3, 6)}-${limited.substring(6)}`;
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
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
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
    case "number":
      return <input {...fieldProps} type="number" />;
    case "date":
      return <input {...fieldProps} type="date" />;
    case "email":
      return <input {...fieldProps} type="email" />;
    case "phone":
      return (
        <input 
          {...fieldProps}
          type="tel"
          onChange={handlePhoneChange}
          maxLength={14} // (000) 000-0000 = 14 characters
          pattern="[0-9]{10}"
          title="Please enter a 10-digit phone number"
        />
      );
    case "url":
      return <input {...fieldProps} type="url" />;
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
          <p className="text-sm text-gray-500 mt-1">Accepted formats: PDF, DOC, DOCX, TXT</p>
        </div>
      );
    default:
      return <input {...fieldProps} type="text" />;
  }
}

// Hook for managing custom fields
export function useCustomFields(entityType: string) {
  const [customFields, setCustomFields] = React.useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, any>>({});
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

  const handleCustomFieldChange = React.useCallback((fieldName: string, value: any) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  const validateCustomFields = React.useCallback(() => {
    for (const field of customFields) {
      if (field.is_required && !field.is_hidden) {
        const value = customFieldValues[field.field_name];
        if (!value || (typeof value === "string" && !value.trim())) {
          return {
            isValid: false,
            message: `${field.field_label} is required`
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
        customFieldsToSend[field.field_label] = customFieldValues[field.field_name];
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
    isLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
    refetch: fetchCustomFields
  };
}
