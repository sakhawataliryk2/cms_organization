"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { getCookie } from "cookies-next";
import CustomFieldRenderer, {
  useCustomFields,
} from "@/components/CustomFieldRenderer";

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

interface User {
  id: string;
  name: string;
  email: string;
}

// Map admin field labels to backend columns (snake_case for API); unmapped labels go to custom_fields only
const BACKEND_COLUMN_BY_LABEL: Record<string, string> = {
  "Task Title": "title", Title: "title",
  "Description": "description", "Task Description": "description", Details: "description",
  "Owner": "owner",
  "Status": "status", "Current Status": "status", "Task Status": "status",
  "Priority": "priority", "Task Priority": "priority",
  "Assigned To": "assigned_to", Assigned: "assigned_to", Assignee: "assigned_to",
  "Due Date": "due_date", Due: "due_date",
  "Due Time": "due_time", Time: "due_time",
};

export default function AddTask() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("id");
  const relatedEntity = searchParams.get("relatedEntity");
  const relatedEntityId = searchParams.get("relatedEntityId");
  const organizationNameFromUrl = searchParams.get("organizationName");

  const [isEditMode, setIsEditMode] = useState(!!taskId);
  const [isLoadingTask, setIsLoadingTask] = useState(!!taskId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false); // Track if we've already fetched task data
  const hasPrefilledOrgFromUrlRef = useRef(false); // Prefill Organization from relatedEntityId once
  const hasPrefilledRelatedFromUrlRef = useRef<Set<string>>(new Set()); // Prefill Job / Job Seeker / Hiring Manager once per entity type
  const [assignedToDropdownOpen, setAssignedToDropdownOpen] = useState(false);
  const assignedToDropdownRef = useRef<HTMLDivElement>(null);
  // Helper function to convert reminder string (e.g., "5 minutes", "1 hour") to minutes
  const parseReminderToMinutes = (reminderValue: string | number | null | undefined): number | null => {
    if (!reminderValue) return null;
    if (typeof reminderValue === 'number') return reminderValue;
  
    const str = String(reminderValue).toLowerCase().trim();
    if (str === '' || str === 'none' || str === 'null') return null;
  
    // Improved regex to handle plurals and common abbreviations
    const match = str.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?|days?|d)?/i);
    if (!match) return null;
  
    const num = parseInt(match[1], 10);
    const unit = match[2]?.toLowerCase() || 'minute';
  
    if (unit.startsWith('d')) return num * 1440; // days to minutes
    if (unit.startsWith('h')) return num * 60;   // hours to minutes
    return num; // minutes
  };
  
  
  // Helper function to convert minutes to reminder string format
  const minutesToReminderString = (minutes: number | null | undefined): string => {
    if (!minutes || minutes <= 0) return '';
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    const days = Math.floor(minutes / 1440);
    return days === 1 ? '1 day' : `${days} days`;
  };

  // Close Assigned To dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assignedToDropdownRef.current && !assignedToDropdownRef.current.contains(e.target as Node)) {
        setAssignedToDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Use the custom fields hook
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues,
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("tasks");

  // Initialize and load users
  useEffect(() => {
    fetchActiveUsers();
  }, []);

  // Load current user from cookie (set at login)
  useEffect(() => {
    try {
      const rawUser = getCookie("user");
      if (rawUser) {
        const parsed =
          typeof rawUser === "string"
            ? JSON.parse(rawUser)
            : JSON.parse(String(rawUser));
        if (parsed?.id) {
          setCurrentUser({
            id: String(parsed.id),
            name: String(parsed.name || ""),
            email: String(parsed.email || ""),
          });
          return;
        }
      }

      // Fallback: decode token payload to extract userId
      const rawToken = getCookie("token");
      const tokenStr = rawToken ? String(rawToken) : "";
      const payloadB64 = tokenStr.split(".")[1];
      if (payloadB64) {
        const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
        const decoded = JSON.parse(json);
        const uid = decoded?.userId ?? decoded?.id ?? decoded?.user?.id;
        if (uid !== undefined && uid !== null) {
          setCurrentUser({ id: String(uid), name: "", email: "" });
        }
      }
    } catch (e) {
      console.error("Error parsing user cookie:", e);
    }
  }, []);

  // If we only have currentUser.id (from token) but no name, derive it from activeUsers
  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.name) return;
    if (!activeUsers || activeUsers.length === 0) return;

    const found = activeUsers.find((u) => String(u.id) === String(currentUser.id));
    if (found) {
      setCurrentUser({
        id: String(found.id),
        name: String(found.name || ""),
        email: String(found.email || ""),
      });
    }
  }, [activeUsers, currentUser?.id, currentUser?.name]);

  // Auto-populate Owner field for new tasks
  useEffect(() => {
    if (isEditMode) return;
    if (!currentUser?.name) return;
    if (!customFields || customFields.length === 0) return;

    const ownerField = customFields.find(
      (f: any) => {
        const label = String(f.field_label || "").toLowerCase();
        const name = String(f.field_name || "").toLowerCase();
        const key = String(f.field_key || "").toLowerCase();
        return label === "owner" || name === "owner" || name === "field_17" || name === "field17" || key === "owner";
      }
    );

    if (!ownerField?.field_name) return;

    setCustomFieldValues((prev) => {
      const existing = prev?.[ownerField.field_name];
      if (existing !== undefined && existing !== null && String(existing).trim() !== "") {
        return prev;
      }
      return {
        ...prev,
        [ownerField.field_name]: currentUser.name,
      };
    });
  }, [isEditMode, currentUser, customFields, setCustomFieldValues]);

  // Prefill Organization from URL when opened from organization (relatedEntity=organization&relatedEntityId=...)
  useEffect(() => {
    if (isEditMode) return;
    if (relatedEntity !== "organization" || !relatedEntityId) return;
    if (customFieldsLoading || customFields.length === 0) return;
    if (hasPrefilledOrgFromUrlRef.current) return;

    // Match Organization field by label (any variant) or by lookup type for organizations
    const orgField = customFields.find((f: any) => {
      const label = String(f.field_label || "").toLowerCase();
      const isOrgLabel =
        label === "organization" ||
        label === "organization name" ||
        label === "company" ||
        label.includes("organization");
      const isOrgLookup =
        String(f.field_type || "").toLowerCase() === "lookup" &&
        String(f.lookup_type || "").toLowerCase() === "organizations";
      return isOrgLabel || isOrgLookup;
    });

    if (!orgField?.field_name) return;

    // LookupField uses <select> with value=option.id, so we must set the organization ID not the name
    const isLookup = String(orgField.field_type || "").toLowerCase() === "lookup";
    const valueToSet = isLookup ? String(relatedEntityId) : (organizationNameFromUrl?.trim() || "");

    const applyOrgValue = (val: string) => {
      if (val === "") return;
      hasPrefilledOrgFromUrlRef.current = true;
      setCustomFieldValues((prev) => ({
        ...prev,
        [orgField.field_name]: val,
      }));
    };

    if (isLookup) {
      applyOrgValue(valueToSet);
      return;
    }

    const nameToSet = organizationNameFromUrl?.trim();
    if (nameToSet) {
      applyOrgValue(nameToSet);
      return;
    }

    (async () => {
      try {
        const response = await fetch(`/api/organizations/${relatedEntityId}`);
        if (response.ok) {
          const data = await response.json();
          const orgName = data.organization?.name || "";
          if (orgName) {
            applyOrgValue(orgName);
          }
        }
      } catch (e) {
        console.error("Error fetching organization for task prefill:", e);
      }
    })();
  }, [isEditMode, relatedEntity, relatedEntityId, organizationNameFromUrl, customFieldsLoading, customFields, setCustomFieldValues]);

  // Prefill Job, Job Seeker, or Hiring Manager from URL (relatedEntity & relatedEntityId)
  useEffect(() => {
    if (isEditMode) return;
    if (!relatedEntity || !relatedEntityId) return;
    const entity = relatedEntity.toLowerCase();
    if (!["job", "job_seeker", "hiring_manager", "lead", "placement"].includes(entity)) return;
    if (customFieldsLoading || customFields.length === 0) return;
    if (hasPrefilledRelatedFromUrlRef.current.has(entity)) return;

    const isLookup = (f: any) => String(f.field_type || "").toLowerCase() === "lookup";
    const lookupType = (f: any) => String(f.lookup_type || "").toLowerCase();

    let targetField: any = null;
    if (entity === "job") {
      targetField = customFields.find((f: any) => {
        const label = String(f.field_label || "").toLowerCase();
        return (
          (isLookup(f) && lookupType(f) === "jobs") ||
          (label.includes("job") && !label.includes("seeker"))
        );
      });
    } else if (entity === "job_seeker") {
      targetField = customFields.find(
        (f: any) =>
          (isLookup(f) && lookupType(f) === "job-seekers") ||
          String(f.field_label || "").toLowerCase().includes("job seeker") ||
          String(f.field_label || "").toLowerCase().includes("jobseeker")
      );
    } else if (entity === "hiring_manager") {
      targetField = customFields.find(
        (f: any) =>
          (isLookup(f) && lookupType(f) === "hiring-managers") ||
          String(f.field_label || "").toLowerCase().includes("hiring manager")
      );
    } else if (entity === "lead") {
      targetField = customFields.find((f: any) => {
        const label = String(f.field_label || "").toLowerCase();
        return (
          (isLookup(f) && (lookupType(f) === "leads" || lookupType(f) === "lead")) ||
          (label.includes("lead") && !label.includes("manager"))
        );
      });
    } else if (entity === "placement") {
      targetField = customFields.find(
        (f: any) =>
          (isLookup(f) && lookupType(f) === "placements") ||
          String(f.field_label || "").toLowerCase().includes("placement")
      );
    }

    if (!targetField?.field_name) return;

    hasPrefilledRelatedFromUrlRef.current.add(entity);
    setCustomFieldValues((prev) => ({
      ...prev,
      [targetField.field_name]: String(relatedEntityId),
    }));
  }, [isEditMode, relatedEntity, relatedEntityId, customFieldsLoading, customFields, setCustomFieldValues]);

  // Fetch active users for assignment dropdown
  const fetchActiveUsers = async () => {
    try {
      const response = await fetch("/api/users/active");
      if (response.ok) {
        const data = await response.json();
        setActiveUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching active users:", error);
    }
  };

  // Memoize fetchTaskData to prevent it from being recreated on every render
  const fetchTaskData = useCallback(async (id: string) => {
    setIsLoadingTask(true);
    setLoadError(null);

    try {
      console.log(`Fetching task data for ID: ${id}`);
      const response = await fetch(`/api/tasks/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch task details");
      }

      const data = await response.json();
      console.log("Task data received:", data);

      if (!data.task) {
        throw new Error("No task data received");
      }

      const task = data.task;

      // Parse existing custom fields from the task
      let existingCustomFields: Record<string, any> = {};
      if (task.custom_fields) {
        try {
          existingCustomFields =
            typeof task.custom_fields === "string"
              ? JSON.parse(task.custom_fields)
              : task.custom_fields;
        } catch (e) {
          console.error("Error parsing existing custom fields:", e);
        }
      }

      // Map custom fields from field_label (database key) to field_name (form key)
      const mappedCustomFieldValues: Record<string, any> = {};

      // First, map any existing custom field values from the database
      if (customFields.length > 0 && Object.keys(existingCustomFields).length > 0) {
        customFields.forEach((field) => {
          // Try to find the value by field_label (as stored in DB)
          const value = existingCustomFields[field.field_label];
          if (value !== undefined) {
            // Map to field_name for the form
            mappedCustomFieldValues[field.field_name] = value;
          }
        });
      }

      // Second, map standard task fields to custom fields based on field labels
      if (customFields.length > 0) {
        const standardFieldMapping: Record<string, string> = {
          // Title variations
          "Task Title": task.title || "",
          "Title": task.title || "",
          // Status variations
          "Status": task.status || "Open",
          "Current Status": task.status || "Open",
          "Task Status": task.status || "Open",
          // Priority variations
          "Priority": task.priority || "Medium",
          "Task Priority": task.priority || "Medium",
          // Assigned To variations
          "Assigned To": task.assigned_to_name || task.assigned_to || "",
          "Assigned": task.assigned_to_name || task.assigned_to || "",
          "Assignee": task.assigned_to_name || task.assigned_to || "",
          // Owner variations (for edit form and autopopulate consistency)
          "Owner": task.owner || task.owner_name || "",
          // Due Date variations
          "Due Date": task.due_date ? task.due_date.split("T")[0] : "",
          "Due": task.due_date ? task.due_date.split("T")[0] : "",
          // Due Time variations
          "Due Time": task.due_time || "",
          "Time": task.due_time || "",
          // Description variations
          "Description": task.description || "",
          "Task Description": task.description || "",
          "Details": task.description || "",
          // Notes variations
          "Notes": task.notes || "",
          "Task Notes": task.notes || "",
          // Type variations
          "Type": task.type || "",
          "Task Type": task.type || "",
          // Related Entity variations
          "Related Entity": task.related_entity || "",
          "Related": task.related_entity || "",
          // Related Entity ID variations
          "Related Entity ID": task.related_entity_id || "",
          "Related ID": task.related_entity_id || "",
          // Date Added variations
          "Date Added": task.created_at ? task.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
          "Created Date": task.created_at ? task.created_at.split("T")[0] : "",
          // Reminder variations - convert minutes to string format
          "Reminder": task.reminder_minutes_before_due != null ? minutesToReminderString(task.reminder_minutes_before_due) : "",
        };

        // For each custom field, try to populate from mapped values or standard fields
        customFields.forEach((field) => {
          // First check if we have a value from existing custom fields
          if (mappedCustomFieldValues[field.field_name] === undefined) {
            // Try to get value from standard field mapping using field_label
            const standardValue = standardFieldMapping[field.field_label];
            if (standardValue !== undefined) {
              mappedCustomFieldValues[field.field_name] = standardValue;
            }
          }
        });
      }

      // Set the mapped custom field values
      setCustomFieldValues(mappedCustomFieldValues);
    } catch (err) {
      console.error("Error fetching task:", err);
      setLoadError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching task details"
      );
    } finally {
      setIsLoadingTask(false);
    }
  }, [customFields, setCustomFieldValues]);

  // If taskId is present, fetch the task data
  // Wait for customFields to load before fetching to ensure proper mapping
  useEffect(() => {
    // Only fetch if we have a taskId, customFields are loaded, and we haven't fetched yet
    if (taskId && !customFieldsLoading && customFields.length > 0 && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchTaskData(taskId);
    }
    // Reset the ref when taskId changes or is removed
    if (!taskId) {
      hasFetchedRef.current = false;
    }
  }, [taskId, customFieldsLoading, customFields.length, fetchTaskData]);

  // Real-time sync: When custom field values change, update corresponding standard fields if needed
  // Note: This is optional - we're primarily mapping custom fields to standard fields on submit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required custom fields
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) {
      setError(customFieldValidation.message);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const customFieldsToSend = getCustomFieldsForSubmission();
      const apiData: Record<string, any> = {};
      const customFieldsForDB: Record<string, any> = {};

      // Every form field goes into custom_fields (for both create and edit). Same as organizations.
      // Labels in BACKEND_COLUMN_BY_LABEL also go to top-level columns for API compatibility.
      Object.entries(customFieldsToSend).forEach(([label, value]) => {
        if (value === undefined || value === null) return;
        const column = BACKEND_COLUMN_BY_LABEL[label];
        if (column) {
          apiData[column] = value;
        }
        customFieldsForDB[label] = value;
      });

      // Normalize time fields for backend (PostgreSQL TIME type)
      const timeCol = "due_time";
      const rawTime = apiData[timeCol];
      if (rawTime !== undefined && rawTime !== null) {
        const s = String(rawTime).trim();
        if (s === "") {
          delete apiData[timeCol];
        } else {
          if (s.includes("T")) {
            const timePart = s.split("T")[1] || "";
            const [h, m, sec] = timePart.split(":");
            if (h != null && m != null) {
              apiData[timeCol] = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(sec || "00").padStart(2, "0")}`;
            }
          } else {
            const timeMatch = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
            if (timeMatch) {
              const [, h, m, sec] = timeMatch;
              apiData[timeCol] = `${h!.padStart(2, "0")}:${m!.padStart(2, "0")}:${(sec || "00").padStart(2, "0")}`;
            }
          }
        }
      }

      // assigned_to: convert user name/option text to numeric user ID
      const rawAssignedTo = apiData.assigned_to;
      if (rawAssignedTo !== undefined && rawAssignedTo !== null && String(rawAssignedTo).trim() !== "") {
        const value = String(rawAssignedTo).trim();
        let assignedToId: number | null = null;
        const userByName = activeUsers.find((u) => u.name === value || u.email === value);
        if (userByName) {
          assignedToId = Number(userByName.id);
        } else {
          const optionMatch = value.match(/Option\s*(\d+)/i);
          if (optionMatch && activeUsers.length > 0) {
            const userIndex = parseInt(optionMatch[1], 10) - 1;
            if (userIndex >= 0 && userIndex < activeUsers.length) {
              assignedToId = Number(activeUsers[userIndex].id);
            }
          } else {
            const parsed = Number(value);
            if (!isNaN(parsed) && parsed > 0 && activeUsers.some((u) => Number(u.id) === parsed)) {
              assignedToId = parsed;
            }
          }
        }
        apiData.assigned_to = assignedToId;
      }

      apiData.custom_fields = typeof customFieldsForDB === "object" && !Array.isArray(customFieldsForDB) && customFieldsForDB !== null
        ? JSON.parse(JSON.stringify(customFieldsForDB))
        : {};

      if (relatedEntity && relatedEntityId) {
        const rid = Number(relatedEntityId);
        switch (relatedEntity) {
          case "organization":
            apiData.organization_id = rid;
            break;
          case "job":
            apiData.job_id = rid;
            break;
          case "lead":
            apiData.lead_id = rid;
            break;
          case "hiring_manager":
            apiData.hiring_manager_id = rid;
            break;
          case "job_seeker":
            apiData.job_seeker_id = rid;
            break;
          case "placement":
            apiData.placement_id = rid;
            break;
        }
      }

      delete (apiData as any).customFields;

      const cleanPayload: Record<string, any> = {};
      if (apiData.title !== undefined) cleanPayload.title = apiData.title ?? "";
      if (apiData.description !== undefined) cleanPayload.description = apiData.description ?? "";
      if (apiData.owner !== undefined) cleanPayload.owner = apiData.owner ?? "";
      if (apiData.status !== undefined) cleanPayload.status = apiData.status ?? "Open";
      if (apiData.priority !== undefined) cleanPayload.priority = apiData.priority ?? "";
      if (apiData.assigned_to !== undefined) cleanPayload.assigned_to = apiData.assigned_to ?? null;
      if (apiData.due_date !== undefined) cleanPayload.due_date = apiData.due_date && String(apiData.due_date).trim() !== "" ? apiData.due_date : null;
      if (apiData.due_time !== undefined) cleanPayload.due_time = apiData.due_time;
      if (apiData.organization_id !== undefined) cleanPayload.organization_id = apiData.organization_id;
      if (apiData.job_id !== undefined) cleanPayload.job_id = apiData.job_id;
      if (apiData.lead_id !== undefined) cleanPayload.lead_id = apiData.lead_id;
      if (apiData.hiring_manager_id !== undefined) cleanPayload.hiring_manager_id = apiData.hiring_manager_id;
      if (apiData.job_seeker_id !== undefined) cleanPayload.job_seeker_id = apiData.job_seeker_id;
      if (apiData.placement_id !== undefined) cleanPayload.placement_id = apiData.placement_id;
      // Map Reminder custom field to reminder_minutes_before_due
      // Check if there's a custom field with label "Reminder"
      const reminderField = customFields.find(f => f.field_label === "Reminder");
      if (reminderField && customFieldValues[reminderField.field_name]) {
        const reminderValue = customFieldValues[reminderField.field_name];
        const minutes = parseReminderToMinutes(reminderValue);
        if (minutes !== null && minutes > 0) {
          cleanPayload.reminder_minutes_before_due = minutes;
        } else {
          cleanPayload.reminder_minutes_before_due = null;
        }
      } else {
        // If no Reminder custom field, set to null
        cleanPayload.reminder_minutes_before_due = null;
      }

      cleanPayload.custom_fields =
        typeof apiData.custom_fields === "object" && apiData.custom_fields !== null && !Array.isArray(apiData.custom_fields)
          ? JSON.parse(JSON.stringify(apiData.custom_fields))
          : {};

      const url = isEditMode ? `/api/tasks/${taskId}` : "/api/tasks";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify(cleanPayload),
      });

      const responseText = await response.text();
      let data: { message?: string; error?: string; errors?: string[]; task?: { id: string } } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (_) {}

      if (!response.ok) {
        const msg =
          data.message ||
          data.error ||
          (Array.isArray(data.errors) ? data.errors.join("; ") : null) ||
          response.statusText ||
          `Failed to ${isEditMode ? "update" : "create"} task`;
        setError(msg);
        setIsSubmitting(false);
        return;
      }

      console.log(
        `Task ${isEditMode ? "updated" : "created"} successfully:`,
        data
      );

      const resultId = isEditMode ? taskId : data.task ? data.task.id : null;
      if (resultId) {
        router.push("/dashboard/tasks/view?id=" + resultId);
      } else {
        router.push("/dashboard/tasks");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const isFormValid = useMemo(() => {
    const customFieldValidation = validateCustomFields();
    return customFieldValidation.isValid;
  }, [customFieldValues, validateCustomFields]);

  // Show loading screen when submitting
  if (isSubmitting) {
    return (
      <LoadingScreen
        message={isEditMode ? "Updating task..." : "Creating task..."}
      />
    );
  }

  // Show loading screen when loading existing task data or custom fields
  if (isLoadingTask || customFieldsLoading) {
    return <LoadingScreen message="Loading task form..." />;
  }

  // Show error if task loading fails
  if (loadError) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{loadError}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Tasks
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto py-4 px-4 sm:py-8 sm:px-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
        {/* Header with X button */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div className="flex items-center">
            {/* <Image
              src="/checklist.svg"
              alt="Task"
              width={24}
              height={24}
              className="mr-2"
            /> */}
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Task
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* <button
                            onClick={() => router.push('/dashboard/admin/field-mapping?section=tasks')}
                            className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded"
                        >
                            Manage Fields
                        </button> */}
            <button
              onClick={handleGoBack}
              className="text-gray-500 hover:text-gray-700"
            >
              <span className="text-2xl font-bold">X</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded">
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Standard Task Fields */}
            {/* {formFields
                            .filter(field => field.visible)
                            .map((field) => (
                                <div key={field.id} className="flex items-center">
                                    <label className="w-48 font-medium">
                                        {field.label}:
                                    </label>

                                    <div className="flex-1 relative">
                                        {field.type === 'checkbox' ? (
                                            <input
                                                type="checkbox"
                                                name={field.name}
                                                checked={field.checked || false}
                                                onChange={(e) => handleChange(field.id, '', e.target.checked)}
                                                className="p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                                required={field.required}
                                            />
                                        ) : field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'url' ? (
                                            <input
                                                type={field.type}
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                placeholder={field.placeholder}
                                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                                required={field.required}
                                            />
                                        ) : field.type === 'number' ? (
                                            <input
                                                type="number"
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                placeholder={field.placeholder}
                                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                                required={field.required}
                                            />
                                        ) : field.type === 'date' || field.type === 'time' ? (
                                            <input
                                                type={field.type}
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                                required={field.required}
                                            />
                                        ) : field.type === 'select' ? (
                                            <select
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                                                required={field.required}
                                            >
                                                {!field.required && <option value="">Select {field.label}</option>}
                                                {field.options?.map((option) => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                name={field.name}
                                                value={field.value}
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                rows={3}
                                                placeholder={field.placeholder}
                                                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                                required={field.required}
                                            />
                                        ) : field.type === 'file' ? (
                                            <input
                                                type="file"
                                                onChange={(e) => handleChange(field.id, e.target.value)}
                                                className="w-full p-2 text-gray-700"
                                                required={field.required}
                                            />
                                        ) : null}

                                        {field.required && (
                                            <span className="absolute text-red-500 left-[-10px] top-2">*</span>
                                        )}
                                    </div>
                                </div>
                            ))} */}

            {/* Custom Fields Section */}
            {customFields.length > 0 && (
              <>
                {customFields.map((field) => {
                  // Don't render hidden fields at all (neither label nor input)
                  if (field.is_hidden) return null;

                  const isOwnerField =
                    String(field.field_label || "").toLowerCase() === "owner" ||
                    String(field.field_name || "").toLowerCase() === "field_17" ||
                    String(field.field_name || "").toLowerCase() === "field17" ||
                    String(field.field_name || "").toLowerCase() === "owner";

                  const labelLower = String(field.field_label || "").toLowerCase();
                  const nameLower = String(field.field_name || "").toLowerCase();
                  const isAssignedField =
                    labelLower === "assigned to" ||
                    labelLower === "assigned" ||
                    labelLower === "assignee" ||
                    labelLower.includes("assigned") ||
                    labelLower.includes("assignee") ||
                    nameLower.includes("assigned") ||
                    nameLower.includes("assignee");

                  const dynamicOwnerOptions =
                    isOwnerField &&
                    String(field.field_type || "").toLowerCase() === "select" &&
                    activeUsers.length > 0
                      ? Array.from(
                          new Set(
                            [
                              ...activeUsers
                                .map((u) => String(u.name || "").trim())
                                .filter(Boolean),
                              String(currentUser?.name || "").trim(),
                            ].filter(Boolean)
                          )
                        )
                      : null;

                  // Assigned To is rendered as type-to-match (autocomplete), not dropdown
                  const fieldToRender: any =
                    dynamicOwnerOptions && dynamicOwnerOptions.length > 0
                      ? { ...field, options: dynamicOwnerOptions }
                      : field;

                  const rawVal = customFieldValues[field.field_name];
                      const isValid = field.is_required && rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "";
                      const assignedToValue = String(customFieldValues[field.field_name] ?? "").trim();
                      const assignedToMatches = isAssignedField && activeUsers.length > 0
                        ? activeUsers.filter(
                            (u) =>
                              String(u.name || "").toLowerCase().includes(assignedToValue.toLowerCase()) ||
                              String(u.email || "").toLowerCase().includes(assignedToValue.toLowerCase())
                          )
                        : [];
                      return (
                    <div key={field.id} className="flex items-center gap-2">
                      <label className="w-48 font-medium">
                        {field.field_label}:
                        {field.is_required && !isValid && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                        {isValid && (
                          <span className="ml-1 text-green-600" title="Valid" aria-hidden="true">✓</span>
                        )}
                      </label>
                      <div className="flex-1 relative flex items-center gap-2" ref={isAssignedField ? assignedToDropdownRef : undefined}>
                        {isAssignedField ? (
                          <>
                            <input
                              type="text"
                              value={assignedToValue}
                              onChange={(e) => handleCustomFieldChange(field.field_name, e.target.value)}
                              onFocus={() => setAssignedToDropdownOpen(true)}
                              placeholder="Type to search by name or email..."
                              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              autoComplete="off"
                            />
                            {assignedToDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-48 overflow-auto">
                                {assignedToValue.length === 0
                                  ? activeUsers.map((u) => (
                                      <button
                                        key={u.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                        onClick={() => {
                                          handleCustomFieldChange(field.field_name, String(u.name || "").trim());
                                          setAssignedToDropdownOpen(false);
                                        }}
                                      >
                                        {u.name || ""}{u.email ? ` (${u.email})` : ""}
                                      </button>
                                    ))
                                  : assignedToMatches.length > 0
                                    ? assignedToMatches.map((u) => (
                                        <button
                                          key={u.id}
                                          type="button"
                                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                          onClick={() => {
                                            handleCustomFieldChange(field.field_name, String(u.name || "").trim());
                                            setAssignedToDropdownOpen(false);
                                          }}
                                        >
                                          {u.name || ""}{u.email ? ` (${u.email})` : ""}
                                        </button>
                                      ))
                                    : (
                                        <div className="px-3 py-2 text-sm text-gray-500">No matching user</div>
                                      )}
                              </div>
                            )}
                          </>
                        ) : (
                          <CustomFieldRenderer
                            field={fieldToRender}
                            value={customFieldValues[field.field_name]}
                            onChange={handleCustomFieldChange}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="h-20" aria-hidden="true" />
          <div className="sticky bottom-0 left-0 right-0 z-10 -mx-4 -mb-4 px-4 py-4 sm:-mx-6 sm:-mb-6 sm:px-6 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.08)] flex justify-end space-x-4">
            <button
              type="button"
              onClick={handleGoBack}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className={`px-4 py-2 rounded ${
                isSubmitting || !isFormValid
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              {isEditMode ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
