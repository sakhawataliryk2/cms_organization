"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { getCookie } from "cookies-next";
import CustomFieldRenderer, {
  useCustomFields,
  isCustomFieldValueValid,
} from "@/components/CustomFieldRenderer";
import { isValidUSPhoneNumber } from "@/app/utils/phoneValidation";

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
  const relatedEntityIds = searchParams.get("relatedEntityIds"); // Comma-separated IDs for bulk creation
  const organizationNameFromUrl = searchParams.get("organizationName");
  
  // Parse multiple entity IDs if present
  const entityIdsArray = relatedEntityIds 
    ? relatedEntityIds.split(',').map(id => id.trim()).filter(id => id)
    : relatedEntityId 
      ? [relatedEntityId]
      : [];
  
  const isBulkMode = entityIdsArray.length > 1;
  
  // Debug logging for bulk mode detection
  useEffect(() => {
    if (relatedEntityIds || relatedEntityId) {
      console.log('🔍 Task Add Page - Entity Detection:', {
        relatedEntity,
        relatedEntityId,
        relatedEntityIds,
        entityIdsArray,
        isBulkMode,
        count: entityIdsArray.length
      });
    }
  }, [relatedEntity, relatedEntityId, relatedEntityIds, entityIdsArray, isBulkMode]);
  
  // Debug logging
  if (relatedEntity === 'hiring_manager') {
    console.log('📋 Hiring Manager Task Creation:', {
      relatedEntityId,
      relatedEntityIds,
      entityIdsArray,
      isBulkMode,
      count: entityIdsArray.length
    });
  }

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
  
  // Tearsheet selection state
  const [selectedTearsheetIds, setSelectedTearsheetIds] = useState<string[]>([]);
  const [availableTearsheets, setAvailableTearsheets] = useState<any[]>([]);
  const [isLoadingTearsheets, setIsLoadingTearsheets] = useState(false);
  const [tearsheetSearchQuery, setTearsheetSearchQuery] = useState("");
  const [showTearsheetDropdown, setShowTearsheetDropdown] = useState(false);
  const tearsheetDropdownRef = useRef<HTMLDivElement>(null);
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
      if (tearsheetDropdownRef.current && !tearsheetDropdownRef.current.contains(e.target as Node)) {
        setShowTearsheetDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch available tearsheets
  useEffect(() => {
    const fetchTearsheets = async () => {
      setIsLoadingTearsheets(true);
      try {
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );
        const response = await fetch("/api/tearsheets", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableTearsheets(data.tearsheets || []);
        }
      } catch (error) {
        console.error("Error fetching tearsheets:", error);
      } finally {
        setIsLoadingTearsheets(false);
      }
    };
    fetchTearsheets();
  }, []);

  const filteredTearsheets = tearsheetSearchQuery.trim() === ""
    ? availableTearsheets
    : availableTearsheets.filter((ts: any) =>
        ts.name?.toLowerCase().includes(tearsheetSearchQuery.toLowerCase())
      );

  const handleTearsheetToggle = (tearsheetId: string) => {
    setSelectedTearsheetIds((prev) => {
      if (prev.includes(tearsheetId)) {
        return prev.filter((id) => id !== tearsheetId);
      } else {
        return [...prev, tearsheetId];
      }
    });
  };

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
    if (!relatedEntity) return;
    
    // Check if we have IDs (either single or multiple)
    const hasEntityIds = (relatedEntityId && relatedEntityId.trim() !== "") || 
                         (relatedEntityIds && relatedEntityIds.trim() !== "");
    if (!hasEntityIds) return;
    
    const entity = relatedEntity.toLowerCase();
    if (!["job", "job_seeker", "hiring_manager", "lead", "placement"].includes(entity)) return;
    if (customFieldsLoading || customFields.length === 0) return;
    if (hasPrefilledRelatedFromUrlRef.current.has(entity)) return;

    const isLookup = (f: any) => String(f.field_type || "").toLowerCase() === "lookup";
    const lookupType = (f: any) => String(f.lookup_type || "").toLowerCase();

    // Map entity types to their lookup_type values
    const entityLookupTypeMap: Record<string, string[]> = {
      "job": ["jobs", "job"],
      "job_seeker": ["job-seekers", "jobseekers", "job_seeker"],
      "hiring_manager": ["hiring-managers", "hiringmanagers", "hiring_manager"],
      "lead": ["leads", "lead"],
      "placement": ["placements", "placement"],
      "organization": ["organizations", "organization"]
    };
    
    const expectedLookupTypes = entityLookupTypeMap[entity] || [];
    
    // Match ONLY by lookup_type, not by label
    const targetField = customFields.find((f: any) => {
      if (!isLookup(f)) return false;
      const fieldLookupType = lookupType(f);
      return expectedLookupTypes.some(expected => fieldLookupType === expected);
    });

    if (!targetField?.field_name) return;

    hasPrefilledRelatedFromUrlRef.current.add(entity);
    
    // In bulk mode (multiple IDs), use array; otherwise use single ID
    // Handle bulk mode for ALL entity types, not just hiring_manager
    if (entityIdsArray.length > 1) {
      // Bulk mode: pre-populate with array of IDs
      setCustomFieldValues((prev) => ({
        ...prev,
        [targetField.field_name]: entityIdsArray,
      }));
      console.log(`📋 Bulk mode - Pre-filled ${entity} field with IDs:`, entityIdsArray);
    } else {
      // Single mode: use single ID
      const singleId = relatedEntityId || (entityIdsArray.length > 0 ? entityIdsArray[0] : "");
      if (singleId) {
        setCustomFieldValues((prev) => ({
          ...prev,
          [targetField.field_name]: String(singleId),
        }));
        console.log(`📋 Single mode - Pre-filled ${entity} field with ID:`, singleId);
      }
    }
  }, [isEditMode, relatedEntity, relatedEntityId, relatedEntityIds, entityIdsArray, customFieldsLoading, customFields, setCustomFieldValues]);

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

      // IMPORTANT: Check if datetime strings were incorrectly mapped to due_time
      // This can happen if a datetime-local input is mapped to "Due Time" field
      if (apiData.due_time && typeof apiData.due_time === 'string' && apiData.due_time.includes('T')) {
        console.warn('[Task Submit] WARNING: DateTime string found in due_time, will normalize');
        // Move the datetime string to due_date for proper handling
        if (!apiData.due_date || apiData.due_date === '') {
          apiData.due_date = apiData.due_time;
        }
        // due_time will be normalized below to extract just the time part
      }

      // Normalize date fields for backend (PostgreSQL DATE type)
      // Handle datetime strings by splitting into date and time
      const dateCol = "due_date";
      const timeCol = "due_time";
      const rawDate = apiData[dateCol];

      console.log('[Task Submit] Raw due_date before normalization:', rawDate);
      console.log('[Task Submit] Raw due_time before normalization:', apiData[timeCol]);

      if (rawDate !== undefined && rawDate !== null) {
        const dateStr = String(rawDate).trim();
        if (dateStr === "") {
          delete apiData[dateCol];
        } else {
          // Check if it's a datetime string (contains 'T' or space with time)
          if (dateStr.includes("T") || (dateStr.includes(" ") && dateStr.match(/\d{1,2}:\d{2}/))) {
            // Split datetime into date and time parts
            const separator = dateStr.includes("T") ? "T" : " ";
            const [datePart, timePart] = dateStr.split(separator);

            // Extract just the date part (YYYY-MM-DD)
            const dateMatch = datePart.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              apiData[dateCol] = dateMatch[1];

              // If time part exists and due_time is not already set, extract time
              if (timePart && (!apiData[timeCol] || apiData[timeCol] === "")) {
                const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                if (timeMatch) {
                  const [, h, m, sec] = timeMatch;
                  apiData[timeCol] = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(sec || "00").padStart(2, "0")}`;
                  console.log('[Task Submit] Extracted time from datetime string:', apiData[timeCol]);
                }
              }
            } else {
              // Invalid date format, try to extract date part
              console.warn(`[Task Submit] Invalid date format: ${dateStr}, attempting to extract date`);
              const extractedDate = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
              if (extractedDate) {
                apiData[dateCol] = extractedDate[1];
                console.log('[Task Submit] Extracted date:', extractedDate[1]);
              }
            }
          } else {
            // It's already a date-only string, ensure it's in YYYY-MM-DD format
            const dateMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              apiData[dateCol] = dateMatch[1];
            } else {
              // Try to convert MM/DD/YYYY to YYYY-MM-DD
              const slashMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
              if (slashMatch) {
                const [, mm, dd, yyyy] = slashMatch;
                apiData[dateCol] = `${yyyy}-${mm}-${dd}`;
              } else {
                console.warn(`[Task Submit] Could not normalize date format: ${dateStr}`);
              }
            }
          }
        }
      }

      console.log('[Task Submit] Final normalized due_date:', apiData[dateCol]);
      console.log('[Task Submit] Final normalized due_time:', apiData[timeCol]);

      // Normalize time fields for backend (PostgreSQL TIME type)
      // IMPORTANT: Handle case where datetime string might be in due_time field
      const rawTime = apiData[timeCol];
      console.log('[Task Submit] Starting time normalization, rawTime:', rawTime);
      if (rawTime !== undefined && rawTime !== null) {
        const s = String(rawTime).trim();
        console.log('[Task Submit] Time string to normalize:', s);
        if (s === "") {
          delete apiData[timeCol];
        } else {
          // Check if it's a datetime string (contains 'T' or full date)
          if (s.includes("T")) {
            console.log('[Task Submit] Detected datetime string in due_time, extracting time part');
            // Extract time part from datetime string
            const timePart = s.split("T")[1] || "";
            console.log('[Task Submit] Extracted timePart:', timePart);
            const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            console.log('[Task Submit] Time regex match result:', timeMatch);
            if (timeMatch) {
              const [, h, m, sec] = timeMatch;
              apiData[timeCol] = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(sec || "00").padStart(2, "0")}`;
              console.log('[Task Submit] Extracted time from due_time datetime string:', apiData[timeCol]);

              // If due_date is not set, extract date from this datetime string
              if (!apiData[dateCol] || apiData[dateCol] === "") {
                const datePart = s.split("T")[0];
                const dateMatch = datePart.match(/^(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                  apiData[dateCol] = dateMatch[1];
                  console.log('[Task Submit] Extracted date from due_time datetime string:', apiData[dateCol]);
                }
              }
            } else {
              console.warn(`[Task Submit] Could not extract time from datetime string: ${s}, timePart: ${timePart}`);
              delete apiData[timeCol];
            }
          } else if (s.includes(" ") && s.match(/\d{4}-\d{2}-\d{2}/)) {
            // Space-separated datetime string
            const [datePart, timePart] = s.split(" ");
            const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (timeMatch) {
              const [, h, m, sec] = timeMatch;
              apiData[timeCol] = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(sec || "00").padStart(2, "0")}`;
              console.log('[Task Submit] Extracted time from space-separated datetime:', apiData[timeCol]);

              // Extract date if not set
              if (!apiData[dateCol] || apiData[dateCol] === "") {
                const dateMatch = datePart.match(/^(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                  apiData[dateCol] = dateMatch[1];
                }
              }
            } else {
              delete apiData[timeCol];
            }
          } else {
            // It's a time-only string, normalize it
            const timeMatch = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
            if (timeMatch) {
              const [, h, m, sec] = timeMatch;
              apiData[timeCol] = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(sec || "00").padStart(2, "0")}`;
            } else {
              console.warn(`[Task Submit] Invalid time format: ${s}, removing`);
              delete apiData[timeCol];
            }
          }
        }
      }

      console.log('[Task Submit] After time normalization, apiData[timeCol]:', apiData[timeCol]);

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

      // Only set single entity ID if not in bulk mode
      if (!isBulkMode && relatedEntity && relatedEntityId) {
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
      // Normalize and set due_date and due_time
      // Final validation: ensure due_time is never a datetime string
      if (apiData.due_date !== undefined) {
        const normalizedDate = apiData.due_date && String(apiData.due_date).trim() !== "" ? apiData.due_date : null;
        cleanPayload.due_date = normalizedDate;
        console.log('[Task Submit] Normalized due_date:', normalizedDate);
      }
      if (apiData.due_time !== undefined) {
        let finalTime = apiData.due_time;
        // Final safety check: if due_time still contains a datetime string, extract time part
        if (finalTime && typeof finalTime === 'string') {
          const timeStr = String(finalTime).trim();
          if (timeStr.includes('T')) {
            console.warn('[Task Submit] WARNING: due_time still contains datetime string, extracting time part');
            const timePart = timeStr.split('T')[1] || '';
            const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (timeMatch) {
              const [, h, m, sec] = timeMatch;
              finalTime = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(sec || "00").padStart(2, "0")}`;
              console.log('[Task Submit] Final extracted time:', finalTime);
            } else {
              console.warn('[Task Submit] Could not extract time, setting to null');
              finalTime = null;
            }
          } else if (timeStr && !timeStr.match(/^\d{1,2}:\d{2}(?::\d{2})?$/)) {
            // Invalid time format
            console.warn('[Task Submit] Invalid time format:', timeStr);
            finalTime = null;
          }
        }
        cleanPayload.due_time = finalTime;
        console.log('[Task Submit] Final normalized due_time:', cleanPayload.due_time);
      }
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

      // Handle bulk creation for multiple entity IDs
      if (isBulkMode && !isEditMode && relatedEntity && entityIdsArray.length > 0) {
        const results = {
          successful: [] as string[],
          failed: [] as string[],
          errors: [] as Array<{ id: string; error: string }>
        };

        // Determine the entity field name based on entity type
        const entityFieldMap: Record<string, string> = {
          'organization': 'organization_id',
          'job': 'job_id',
          'lead': 'lead_id',
          'hiring_manager': 'hiring_manager_id',
          'job_seeker': 'job_seeker_id',
          'placement': 'placement_id'
        };
        const entityField = entityFieldMap[relatedEntity];

        if (!entityField) {
          setError(`Unsupported entity type: ${relatedEntity}`);
          setIsSubmitting(false);
          return;
        }

        // Get entity IDs from form if multiselect was used, otherwise use entityIdsArray from URL
        let entityIdsToProcess = entityIdsArray;
        
        // Map entity types to their lookup_type values (match ONLY by lookup_type)
        const entityLookupTypeMap: Record<string, string[]> = {
          "job": ["jobs", "job"],
          "job_seeker": ["job-seekers", "jobseekers", "job_seeker"],
          "hiring_manager": ["hiring-managers", "hiringmanagers", "hiring_manager"],
          "lead": ["leads", "lead"],
          "placement": ["placements", "placement"],
          "organization": ["organizations", "organization"]
        };
        
        // Find the related entity field in the form - match ONLY by lookup_type
        const expectedLookupTypes = relatedEntity ? (entityLookupTypeMap[relatedEntity.toLowerCase()] || []) : [];
        const relatedEntityField = expectedLookupTypes.length > 0 ? customFields.find((f: any) => {
          const fieldType = String(f.field_type || "").toLowerCase();
          const fieldLookupType = String(f.lookup_type || "").toLowerCase();
          
          const isLookupField = fieldType === "lookup" || fieldType === "multiselect_lookup";
          if (!isLookupField) return false;
          
          // Match ONLY by lookup_type
          return expectedLookupTypes.some(expected => fieldLookupType === expected);
        }) : null;
        
        if (relatedEntityField) {
          const formValue = customFieldValues[relatedEntityField.field_name];
          if (formValue) {
            // If it's an array (multiselect), use it; otherwise use single value or fallback to URL IDs
            if (Array.isArray(formValue) && formValue.length > 0) {
              entityIdsToProcess = formValue.map(id => String(id));
            } else if (formValue && String(formValue).trim() !== "") {
              entityIdsToProcess = [String(formValue)];
            }
          }
        }

        console.log(`📋 Bulk submit - Processing ${entityIdsToProcess.length} ${relatedEntity} IDs:`, entityIdsToProcess);

        // Create a task for each entity ID
        for (const entityId of entityIdsToProcess) {
          try {
            const taskPayload = {
              ...cleanPayload,
              [entityField]: parseInt(entityId)
            };

            const response = await fetch("/api/tasks", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${document.cookie.replace(
                  /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                  "$1"
                )}`,
              },
              body: JSON.stringify(taskPayload),
            });

            const responseText = await response.text();
            let data: { message?: string; error?: string; errors?: string[]; task?: { id: string } } = {};
            try {
              data = responseText ? JSON.parse(responseText) : {};
            } catch (_) { }

            if (response.ok) {
              results.successful.push(entityId);
              // Associate task with tearsheets if selected
              const createdTaskId = data.task?.id;
              if (createdTaskId && selectedTearsheetIds.length > 0) {
                for (const tearsheetId of selectedTearsheetIds) {
                  try {
                    await fetch(`/api/tearsheets/${tearsheetId}/associate`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${document.cookie.replace(
                          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                          "$1"
                        )}`,
                      },
                      body: JSON.stringify({ task_id: parseInt(createdTaskId) }),
                    });
                  } catch (err) {
                    console.error(`Failed to associate task ${createdTaskId} with tearsheet ${tearsheetId}:`, err);
                  }
                }
              }
            } else {
              const msg =
                data.message ||
                data.error ||
                (Array.isArray(data.errors) ? data.errors.join("; ") : null) ||
                response.statusText ||
                'Failed to create task';
              results.failed.push(entityId);
              results.errors.push({ id: entityId, error: msg });
            }
          } catch (error) {
            results.failed.push(entityId);
            results.errors.push({
              id: entityId,
              error: error instanceof Error ? error.message : 'Failed to create task'
            });
          }
        }

        // Show results
        if (results.failed.length > 0) {
          const errorDetails = results.errors.map(e => `ID ${e.id}: ${e.error}`).join(', ');
          setError(`Created ${results.successful.length} task(s) successfully. Failed for ${results.failed.length} record(s): ${errorDetails}`);
        } else {
          // All successful - navigate back to tasks list
          router.push("/dashboard/tasks");
          return;
        }
      } else {
        // Single task creation/update (existing logic)
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
        } catch (_) { }

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
        
        // Associate task with tearsheets if selected (only for new tasks)
        if (!isEditMode && resultId && selectedTearsheetIds.length > 0) {
          for (const tearsheetId of selectedTearsheetIds) {
            try {
              await fetch(`/api/tearsheets/${tearsheetId}/associate`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${document.cookie.replace(
                    /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
                    "$1"
                  )}`,
                },
                body: JSON.stringify({ task_id: parseInt(resultId) }),
              });
            } catch (err) {
              console.error(`Failed to associate task ${resultId} with tearsheet ${tearsheetId}:`, err);
            }
          }
        }
        
        if (resultId) {
          router.push("/dashboard/tasks/view?id=" + resultId);
        } else {
          router.push("/dashboard/tasks");
        }
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
        message={isEditMode ? "Updating task..." : isBulkMode ? `Creating ${entityIdsArray.length} tasks...` : "Creating task..."}
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
            {isBulkMode && (
              <div className="mr-4 px-3 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">
                Creating tasks for {entityIdsArray.length} {relatedEntity?.replace('_', ' ')} record(s)
              </div>
            )}
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

            {/* Tearsheet Selection Section */}
            <div className="flex items-start gap-2 border-t pt-4 mt-4">
              <label className="w-48 font-medium pt-2">Link to Tearsheets:</label>
              <div className="flex-1 relative" ref={tearsheetDropdownRef}>
                <input
                  type="text"
                  value={tearsheetSearchQuery}
                  onChange={(e) => {
                    setTearsheetSearchQuery(e.target.value);
                    setShowTearsheetDropdown(true);
                  }}
                  onFocus={() => setShowTearsheetDropdown(true)}
                  placeholder="Search tearsheets..."
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  autoComplete="off"
                />
                {showTearsheetDropdown && filteredTearsheets.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-48 overflow-auto">
                    {filteredTearsheets.map((ts: any) => (
                      <div
                        key={ts.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          handleTearsheetToggle(String(ts.id));
                          setTearsheetSearchQuery("");
                          setShowTearsheetDropdown(false);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTearsheetIds.includes(String(ts.id))}
                          onChange={() => {}}
                          className="w-4 h-4"
                        />
                        <span>{ts.name || `TE ${ts.id}`}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedTearsheetIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTearsheetIds.map((id) => {
                      const ts = availableTearsheets.find((t) => String(t.id) === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                        >
                          {ts?.name || `TE ${id}`}
                          <button
                            type="button"
                            onClick={() => handleTearsheetToggle(id)}
                            className="hover:text-blue-600"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

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

                  // Check if this field matches the current relatedEntity (for all entity types)
                  // Match ONLY by lookup_type, not by label
                  const isRelatedEntityField = (() => {
                    if (!relatedEntity) return false;
                    const fieldType = String(field.field_type || "").toLowerCase();
                    const fieldLookupType = String(field.lookup_type || "").toLowerCase();
                    const entity = relatedEntity.toLowerCase();
                    
                    // Check if field type is a lookup
                    const isLookupField = fieldType === "lookup" || fieldType === "multiselect_lookup";
                    if (!isLookupField) return false;
                    
                    // Map entity types to their lookup_type values
                    const entityLookupTypeMap: Record<string, string[]> = {
                      "job": ["jobs", "job"],
                      "job_seeker": ["job-seekers", "jobseekers", "job_seeker"],
                      "hiring_manager": ["hiring-managers", "hiringmanagers", "hiring_manager"],
                      "lead": ["leads", "lead"],
                      "placement": ["placements", "placement"],
                      "organization": ["organizations", "organization"]
                    };
                    
                    const expectedLookupTypes = entityLookupTypeMap[entity] || [];
                    
                    // Match ONLY by lookup_type
                    return expectedLookupTypes.some(expected => fieldLookupType === expected);
                  })();

                  // In bulk mode, convert related entity lookup to multiselect_lookup
                  let fieldToRender: any = field;
                  if (isBulkMode && isRelatedEntityField) {
                    // Convert single lookup to multiselect_lookup for bulk operations
                    fieldToRender = {
                      ...field,
                      field_type: "multiselect_lookup"
                    };
                    console.log(`🔄 Bulk mode detected: Converting ${relatedEntity} field to multiselect_lookup`, {
                      originalType: field.field_type,
                      newType: fieldToRender.field_type,
                      lookupType: field.lookup_type,
                      entityIds: entityIdsArray,
                      relatedEntity
                    });
                  }

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
                  if (dynamicOwnerOptions && dynamicOwnerOptions.length > 0) {
                    fieldToRender = { ...fieldToRender, options: dynamicOwnerOptions };
                  }

                  // Get field value - will be array for multiselect in bulk mode, string for single select
                  let fieldValue = customFieldValues[field.field_name];
                  
                  // Ensure proper format: array for multiselect, string for single select
                  // Handle bulk mode for ALL related entity fields, not just hiring_manager
                  if (isBulkMode && isRelatedEntityField) {
                    // In bulk mode, ensure it's an array
                    if (!Array.isArray(fieldValue)) {
                      fieldValue = fieldValue ? [String(fieldValue)] : [];
                    }
                    // If empty and we have entity IDs, use them
                    if (fieldValue.length === 0 && entityIdsArray.length > 0) {
                      fieldValue = [...entityIdsArray]; // Create a copy
                      // Update state if needed
                      if (!customFieldValues[field.field_name] || 
                          (Array.isArray(customFieldValues[field.field_name]) && 
                           customFieldValues[field.field_name].length === 0)) {
                        handleCustomFieldChange(field.field_name, fieldValue);
                      }
                    }
                    console.log(`📋 Bulk mode - ${relatedEntity} field value:`, {
                      fieldName: field.field_name,
                      fieldValue,
                      entityIdsArray,
                      isArray: Array.isArray(fieldValue),
                      relatedEntity
                    });
                  } else if (!isBulkMode && isRelatedEntityField) {
                    // In single mode, ensure it's a string
                    if (Array.isArray(fieldValue)) {
                      fieldValue = fieldValue.length > 0 ? String(fieldValue[0]) : "";
                    } else {
                      fieldValue = fieldValue ? String(fieldValue) : "";
                    }
                    // If empty and we have entity ID, use it
                    if (!fieldValue && (relatedEntityId || entityIdsArray.length > 0)) {
                      fieldValue = relatedEntityId || entityIdsArray[0];
                      if (!customFieldValues[field.field_name]) {
                        handleCustomFieldChange(field.field_name, fieldValue);
                      }
                    }
                    console.log(`📋 Single mode - ${relatedEntity} field value:`, {
                      fieldName: field.field_name,
                      fieldValue,
                      relatedEntityId,
                      entityIdsArray,
                      relatedEntity
                    });
                  } else {
                    // For other fields, use default behavior
                    fieldValue = fieldValue || "";
                  }
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
                        {field.is_required &&
                          (isCustomFieldValueValid(field, fieldValue) ? (
                            <span className="text-green-500 ml-1">✔</span>
                          ) : (
                            <span className="text-red-500 ml-1">*</span>
                          ))}
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
                            value={fieldValue}
                            allFields={customFields}
                            values={customFieldValues}
                            onChange={handleCustomFieldChange}
                            className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
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
              className={`px-4 py-2 rounded ${isSubmitting || !isFormValid
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
