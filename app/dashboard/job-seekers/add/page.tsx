"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/components/LoadingScreen";
import { validateEmail } from "@/lib/validation/emailValidation";
import { validateAddress } from "@/lib/validation/addressValidation";
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

// Define field type for typesafety
interface FormField {
  id: string;
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "tel"
    | "date"
    | "select"
    | "textarea"
    | "file"
    | "number";
  required: boolean;
  visible: boolean;
  options?: string[]; // For select fields
  placeholder?: string;
  value: string;
  locked?: boolean; // For locked fields like last contact date
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function AddJobSeeker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobSeekerId = searchParams.get("id");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!jobSeekerId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!jobSeekerId);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const hasFetchedRef = useRef(false); // Track if we've already fetched job seeker data

  // Email and address validation states
  const [emailValidation, setEmailValidation] = useState<{
    isValid: boolean;
    message: string;
    isChecking: boolean;
  }>({ isValid: true, message: "", isChecking: false });

  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean;
    message: string;
    isChecking: boolean;
    suggestions?: any[];
  }>({ isValid: true, message: "", isChecking: false });

  // This state will hold the dynamic form fields configuration
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const {
    customFields,
    customFieldValues,
    setCustomFieldValues, // ✅ Extract setCustomFieldValues like Organizations
    isLoading: customFieldsLoading,
    handleCustomFieldChange,
    validateCustomFields,
    getCustomFieldsForSubmission,
  } = useCustomFields("job-seekers");

  // Initialize with default fields
  useEffect(() => {
    // Get current user from cookies
    const userCookie = document.cookie.replace(
      /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    );
    if (userCookie) {
      try {
        const userData = JSON.parse(decodeURIComponent(userCookie));
        setCurrentUser(userData);
      } catch (e) {
        console.error("Error parsing user cookie:", e);
      }
    }

    // Fetch active users for owner dropdown
    fetchActiveUsers();

    // Initialize form fields with locked last contact date
    setFormFields([
      {
        id: "firstName",
        name: "firstName",
        label: "First Name",
        type: "text",
        required: true,
        visible: true,
        value: "",
      },
      {
        id: "lastName",
        name: "lastName",
        label: "Last Name",
        type: "text",
        required: true,
        visible: true,
        value: "",
      },
      {
        id: "email",
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        visible: true,
        value: "",
      },
      {
        id: "phone",
        name: "phone",
        label: "Phone",
        type: "tel",
        required: true,
        visible: true,
        value: "",
      },
      {
        id: "mobilePhone",
        name: "mobilePhone",
        label: "Mobile Phone",
        type: "tel",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "address",
        name: "address",
        label: "Address",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "city",
        name: "city",
        label: "City",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "state",
        name: "state",
        label: "State",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "zip",
        name: "zip",
        label: "ZIP Code",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "status",
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        visible: true,
        options: ["New lead", "Active", "Qualified", "Placed", "Inactive"],
        value: "New lead",
      },
      {
        id: "currentOrganization",
        name: "currentOrganization",
        label: "Current Organization",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "title",
        name: "title",
        label: "Title",
        type: "text",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "resumeText",
        name: "resumeText",
        label: "Resume Text",
        type: "textarea",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "resumeUpload",
        name: "resumeUpload",
        label: "Upload Resume",
        type: "file",
        required: false,
        visible: true,
        value: "",
      },
      {
        id: "skills",
        name: "skills",
        label: "Skills",
        type: "textarea",
        required: false,
        visible: true,
        value: "",
        placeholder: "Enter skills separated by commas",
      },
      {
        id: "desiredSalary",
        name: "desiredSalary",
        label: "Desired Salary",
        type: "text",
        required: false,
        visible: true,
        value: "",
        placeholder: "e.g. $75,000",
      },
      {
        id: "owner",
        name: "owner",
        label: "Owner",
        type: "select",
        required: false,
        visible: true,
        value: currentUser?.name || "",
        options: [], // Will be populated with active users
      },
      {
        id: "dateAdded",
        name: "dateAdded",
        label: "Date Added",
        type: "date",
        required: false,
        visible: true,
        value: new Date().toISOString().split("T")[0],
      },
      {
        id: "lastContactDate",
        name: "lastContactDate",
        label: "Last Contact Date",
        type: "date",
        required: false,
        visible: true,
        value: "",
        locked: true, // This field is now locked and auto-updated
      },
    ]);
  }, []);

  // Fetch active users
  const fetchActiveUsers = async () => {
    try {
      const response = await fetch("/api/users/active");
      if (response.ok) {
        const data = await response.json();
        setActiveUsers(data.users || []);

        // Update owner field options
        setFormFields((prev) =>
          prev.map((field) =>
            field.id === "owner"
              ? { ...field, options: data.users.map((user: User) => user.name) }
              : field
          )
        );
      }
    } catch (error) {
      console.error("Error fetching active users:", error);
    }
  };

  // Memoize fetchJobSeeker to prevent it from being recreated on every render
  const fetchJobSeeker = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      console.log(`Fetching job seeker data for ID: ${id}`);
      const response = await fetch(`/api/job-seekers/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch job seeker details");
      }

      const data = await response.json();
      console.log("Job seeker data received:", data);

      if (!data.jobSeeker) {
        throw new Error("No job seeker data received");
      }

      // Map API data to form fields
      const jobSeeker = data.jobSeeker;

      // Parse existing custom fields from the job seeker
      let existingCustomFields: Record<string, any> = {};
      if (jobSeeker.custom_fields) {
        try {
          existingCustomFields =
            typeof jobSeeker.custom_fields === "string"
              ? JSON.parse(jobSeeker.custom_fields)
              : jobSeeker.custom_fields;
        } catch (e) {
          console.error("Error parsing existing custom fields:", e);
        }
      }

      // ✅ Map custom fields from field_label (database key) to field_name (form key)
      // Custom fields are stored with field_label as keys, but form uses field_name
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

      // ✅ Second, map standard job seeker fields to custom fields based on field labels
      // This ensures that standard fields like "first_name", "last_name" etc. populate custom fields
      // with matching labels like "First Name", "Last Name", etc.
      if (customFields.length > 0) {
        const standardFieldMapping: Record<string, string> = {
          // First Name variations
          "First Name": jobSeeker.first_name || "",
          "First": jobSeeker.first_name || "",
          "FName": jobSeeker.first_name || "",
          // Last Name variations
          "Last Name": jobSeeker.last_name || "",
          "Last": jobSeeker.last_name || "",
          "LName": jobSeeker.last_name || "",
          // Email variations
          "Email": jobSeeker.email || "",
          "Email Address": jobSeeker.email || "",
          "E-mail": jobSeeker.email || "",
          // Phone variations
          "Phone": jobSeeker.phone || "",
          "Phone Number": jobSeeker.phone || "",
          "Telephone": jobSeeker.phone || "",
          "Mobile Phone": jobSeeker.mobile_phone || "",
          "Mobile": jobSeeker.mobile_phone || "",
          "Cell Phone": jobSeeker.mobile_phone || "",
          // Address variations
          "Address": jobSeeker.address || "",
          "Street Address": jobSeeker.address || "",
          "City": jobSeeker.city || "",
          "State": jobSeeker.state || "",
          "ZIP Code": jobSeeker.zip || "",
          "ZIP": jobSeeker.zip || "",
          "Zip Code": jobSeeker.zip || "",
          "Postal Code": jobSeeker.zip || "",
          // Status variations
          "Status": jobSeeker.status || "New lead",
          "Current Status": jobSeeker.status || "New lead",
          // Organization variations
          "Current Organization": jobSeeker.current_organization || "",
          "Organization": jobSeeker.current_organization || "",
          "Company": jobSeeker.current_organization || "",
          // Title variations
          "Title": jobSeeker.title || "",
          "Job Title": jobSeeker.title || "",
          "Position": jobSeeker.title || "",
          // Resume variations
          "Resume Text": jobSeeker.resume_text || "",
          "Resume": jobSeeker.resume_text || "",
          "CV": jobSeeker.resume_text || "",
          // Skills variations
          "Skills": jobSeeker.skills || "",
          "Skill Set": jobSeeker.skills || "",
          "Technical Skills": jobSeeker.skills || "",
          // Salary variations
          "Desired Salary": jobSeeker.desired_salary || "",
          "Salary": jobSeeker.desired_salary || "",
          "Expected Salary": jobSeeker.desired_salary || "",
          // Owner variations
          "Owner": jobSeeker.owner || "",
          "Assigned To": jobSeeker.owner || "",
          "Assigned Owner": jobSeeker.owner || "",
          // Date variations
          "Date Added": jobSeeker.date_added
            ? jobSeeker.date_added.split("T")[0]
            : "",
          "Added Date": jobSeeker.date_added
            ? jobSeeker.date_added.split("T")[0]
            : "",
          "Created Date": jobSeeker.date_added
            ? jobSeeker.date_added.split("T")[0]
            : "",
          "Last Contact Date": jobSeeker.last_contact_date
            ? jobSeeker.last_contact_date.split("T")[0]
            : "",
          "Last Contact": jobSeeker.last_contact_date
            ? jobSeeker.last_contact_date.split("T")[0]
            : "",
        };

        customFields.forEach((field) => {
          // Only set if not already set from existingCustomFields
          if (mappedCustomFieldValues[field.field_name] === undefined) {
            // Try to find matching standard field by field_label
            const standardValue = standardFieldMapping[field.field_label];
            if (standardValue !== undefined && standardValue !== "") {
              mappedCustomFieldValues[field.field_name] = standardValue;
            }
          }
        });
      }

      console.log("Custom Field Values Loaded (mapped):", mappedCustomFieldValues);
      console.log("Original custom fields from DB:", existingCustomFields);
      console.log("Custom Fields Definitions:", customFields.map(f => ({ name: f.field_name, label: f.field_label })));

      // ✅ Set the mapped custom field values (field_name as keys) - same as Organizations
      setCustomFieldValues(mappedCustomFieldValues);

      // Update formFields with existing job seeker data
      setFormFields((prevFields) => {
        const updatedFields = [...prevFields];

        // Helper function to find and update a field
        const updateField = (id: string, value: any) => {
          const fieldIndex = updatedFields.findIndex(
            (field) => field.id === id
          );
          if (fieldIndex !== -1) {
            updatedFields[fieldIndex] = {
              ...updatedFields[fieldIndex],
              value: value !== null && value !== undefined ? String(value) : "",
            };
          }
        };

        // Update standard fields
        updateField("firstName", jobSeeker.first_name);
        updateField("lastName", jobSeeker.last_name);
        updateField("email", jobSeeker.email);
        updateField("phone", jobSeeker.phone);
        updateField("mobilePhone", jobSeeker.mobile_phone);
        updateField("address", jobSeeker.address);
        updateField("city", jobSeeker.city);
        updateField("state", jobSeeker.state);
        updateField("zip", jobSeeker.zip);
        updateField("status", jobSeeker.status);
        updateField("currentOrganization", jobSeeker.current_organization);
        updateField("title", jobSeeker.title);
        updateField("resumeText", jobSeeker.resume_text);
        updateField("skills", jobSeeker.skills);
        updateField("desiredSalary", jobSeeker.desired_salary);
        updateField("owner", jobSeeker.owner);
        updateField(
          "dateAdded",
          jobSeeker.date_added ? jobSeeker.date_added.split("T")[0] : ""
        );
        // Note: lastContactDate is locked, so we don't update it

        return updatedFields;
      });

      setIsEditMode(true);
      console.log("Job seeker data loaded successfully");
    } catch (err) {
      console.error("Error fetching job seeker:", err);
      setLoadError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching job seeker details"
      );
    } finally {
      setIsLoading(false);
    }
  }, [customFields, setCustomFieldValues]);

  // If jobSeekerId is present, fetch the job seeker data
  // Wait for customFields to load before fetching to ensure proper mapping
  useEffect(() => {
    // Only fetch if we have a jobSeekerId, customFields are loaded, and we haven't fetched yet
    if (jobSeekerId && !customFieldsLoading && customFields.length > 0 && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchJobSeeker(jobSeekerId);
    }
    // Reset the ref when jobSeekerId changes or is removed
    if (!jobSeekerId) {
      hasFetchedRef.current = false;
    }
  }, [jobSeekerId, customFieldsLoading, customFields.length, fetchJobSeeker]);

  // ✅ Sync formFields changes to custom fields (two-way binding)
  // When user types in basic fields, update matching custom fields
  useEffect(() => {
    // Only sync if custom fields are loaded and we're not currently fetching
    if (customFieldsLoading || customFields.length === 0 || isLoading) {
      return;
    }

    // Map of form field IDs to their possible labels (for matching with custom field labels)
    // This ensures custom fields with various label variations are mapped correctly
    const formFieldToLabelMap: Record<string, string[]> = {
      firstName: ["First Name", "First", "FName"],
      lastName: ["Last Name", "Last", "LName"],
      email: ["Email", "Email Address", "E-mail"],
      phone: ["Phone", "Phone Number", "Telephone"],
      mobilePhone: ["Mobile Phone", "Mobile", "Cell Phone"],
      address: ["Address", "Street Address"],
      city: ["City"],
      state: ["State"],
      zip: ["ZIP Code", "ZIP", "Zip Code", "Postal Code"],
      status: ["Status", "Current Status"],
      currentOrganization: ["Current Organization", "Organization", "Company"],
      title: ["Title", "Job Title", "Position"],
      resumeText: ["Resume Text", "Resume", "CV"],
      skills: ["Skills", "Skill Set", "Technical Skills"],
      desiredSalary: ["Desired Salary", "Salary", "Expected Salary"],
      owner: ["Owner", "Assigned To", "Assigned Owner"],
      dateAdded: ["Date Added", "Added Date", "Created Date"],
    };

    // Get current form field values
    const formFieldValues: Record<string, string> = {};
    formFields.forEach((field) => {
      if (field.visible && !field.locked) {
        formFieldValues[field.id] = field.value;
      }
    });

    // Update custom fields based on form field values
    // Use a functional update to avoid dependency on customFieldValues
    setCustomFieldValues((prevCustomFields) => {
      const updatedCustomFields: Record<string, any> = { ...prevCustomFields };
      let hasChanges = false;

      customFields.forEach((customField) => {
        // Find matching form field by checking if custom field label matches any label in the map
        const matchingFormFieldId = Object.keys(formFieldToLabelMap).find(
          (formFieldId) => {
            const possibleLabels = formFieldToLabelMap[formFieldId];
            return possibleLabels.includes(customField.field_label);
          }
        );

        if (matchingFormFieldId && formFieldValues[matchingFormFieldId] !== undefined) {
          const formValue = formFieldValues[matchingFormFieldId];
          const currentCustomValue = updatedCustomFields[customField.field_name];

          // Only update if value has changed
          if (currentCustomValue !== formValue) {
            updatedCustomFields[customField.field_name] = formValue;
            hasChanges = true;
          }
        }
      });

      // Only return updated object if there are changes, otherwise return previous to prevent unnecessary re-renders
      return hasChanges ? updatedCustomFields : prevCustomFields;
    });
  }, [formFields, customFields, customFieldsLoading, isLoading, setCustomFieldValues]);

  // Email validation with debounce
  //   useEffect(() => {
  //     const emailField = formFields.find((f) => f.id === "email");
  //     if (emailField && emailField.value && emailField.value.includes("@")) {
  //       const timeoutId = setTimeout(() => {
  //         validateEmailField(emailField.value);
  //       }, 1000);

  //       return () => clearTimeout(timeoutId);
  //     }
  //   }, [formFields.find((f) => f.id === "email")?.value]);

  // Address validation with debounce
  //   useEffect(() => {
  //     const addressField = formFields.find((f) => f.id === "address");
  //     const cityField = formFields.find((f) => f.id === "city");
  //     const stateField = formFields.find((f) => f.id === "state");

  //     if (addressField?.value && cityField?.value && stateField?.value) {
  //       const timeoutId = setTimeout(() => {
  //         validateAddressField({
  //           address: addressField.value,
  //           city: cityField.value,
  //           state: stateField.value,
  //           zip: formFields.find((f) => f.id === "zip")?.value || "",
  //         });
  //       }, 1500);

  //       return () => clearTimeout(timeoutId);
  //     }
  //   }, [
  //     formFields.find((f) => f.id === "address")?.value,
  //     formFields.find((f) => f.id === "city")?.value,
  //     formFields.find((f) => f.id === "state")?.value,
  //     formFields.find((f) => f.id === "zip")?.value,
  //   ]);

  // const validateEmailField = async (email: string) => {
  //     setEmailValidation({ isValid: true, message: '', isChecking: true });

  //     try {
  //         const result = await validateEmail(email);
  //         setEmailValidation({
  //             isValid: result.isValid,
  //             message: result.message,
  //             isChecking: false
  //         });
  //     } catch (error) {
  //         setEmailValidation({
  //             isValid: false,
  //             message: 'Email validation service unavailable',
  //             isChecking: false
  //         });
  //     }
  // };

  // const validateAddressField = async (addressData: any) => {
  //     setAddressValidation({ isValid: true, message: '', isChecking: true });

  //     try {
  //         const result = await validateAddress(addressData);
  //         setAddressValidation({
  //             isValid: result.isValid,
  //             message: result.message,
  //             isChecking: false,
  //             suggestions: result.suggestions
  //         });
  //     } catch (error) {
  //         setAddressValidation({
  //             isValid: false,
  //             message: 'Address validation service unavailable',
  //             isChecking: false
  //         });
  //     }
  // };


  // Handle input change
  const handleChange = (id: string, value: string) => {
    // Don't allow changes to locked fields
    const field = formFields.find((f) => f.id === id);
    if (field?.locked) return;

    setFormFields(
      formFields.map((field) => (field.id === id ? { ...field, value } : field))
    );
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check email validation
    if (!emailValidation.isValid) {
      setError("Please provide a valid email address");
      return;
    }

    // Check address validation if address is provided
    const hasAddress = formFields.some(
      (f) => (f.id === "address" || f.id === "city") && f.value.trim()
    );

    if (hasAddress && !addressValidation.isValid) {
      setError(
        "Please provide a valid address or use one of the suggested addresses"
      );
      return;
    }

    // Validate required custom fields
    const customFieldValidation = validateCustomFields();
    if (!customFieldValidation.isValid) {
      setError(customFieldValidation.message);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // ✅ CRITICAL: Get custom fields from the hook (same pattern as Organizations)
      const customFieldsToSend = getCustomFieldsForSubmission();

      // 🔍 DEBUG: Log to see what we're getting
      console.log("=== DEBUG START ===");
      console.log("customFieldValues from state:", customFieldValues);
      console.log("customFieldsToSend from hook:", customFieldsToSend);
      console.log("Type of customFieldsToSend:", typeof customFieldsToSend);
      console.log(
        "Is customFieldsToSend empty?",
        Object.keys(customFieldsToSend).length === 0
      );
      console.log("=== DEBUG END ===");

      // Create an object with all field values (only visible ones)
      const formDataObj = formFields.reduce((acc, field) => {
        if (field.visible && !field.locked) {
          acc[field.name] = field.value;
        }
        return acc;
      }, {} as Record<string, any>);

      // ✅ Map custom fields to standard fields if they exist (same pattern as Organizations)
      const firstName =
        customFieldsToSend["First Name"] ||
        formDataObj.firstName ||
        "";

      const lastName =
        customFieldsToSend["Last Name"] ||
        formDataObj.lastName ||
        "";

      const email =
        customFieldsToSend["Email"] ||
        formDataObj.email ||
        "";

      const phone =
        customFieldsToSend["Phone"] ||
        formDataObj.phone ||
        "";

      const mobilePhone =
        customFieldsToSend["Mobile Phone"] ||
        formDataObj.mobilePhone ||
        "";

      const address =
        customFieldsToSend["Address"] ||
        formDataObj.address ||
        "";

      const city =
        customFieldsToSend["City"] ||
        formDataObj.city ||
        "";

      const state =
        customFieldsToSend["State"] ||
        formDataObj.state ||
        "";

      const zip =
        customFieldsToSend["ZIP Code"] ||
        customFieldsToSend["ZIP"] ||
        formDataObj.zip ||
        "";

      const status =
        customFieldsToSend["Status"] ||
        formDataObj.status ||
        "New lead";

      const currentOrganization =
        customFieldsToSend["Current Organization"] ||
        formDataObj.currentOrganization ||
        "";

      const title =
        customFieldsToSend["Title"] ||
        formDataObj.title ||
        "";

      const resumeText =
        customFieldsToSend["Resume Text"] ||
        formDataObj.resumeText ||
        "";

      const skills =
        customFieldsToSend["Skills"] ||
        formDataObj.skills ||
        "";

      const desiredSalary =
        customFieldsToSend["Desired Salary"] ||
        formDataObj.desiredSalary ||
        "";

      const owner =
        customFieldsToSend["Owner"] ||
        formDataObj.owner ||
        (currentUser ? currentUser.name : "");

      const dateAdded =
        customFieldsToSend["Date Added"] ||
        formDataObj.dateAdded ||
        new Date().toISOString().split("T")[0];

      // ✅ Build the API payload (same pattern as Organizations)
      // Ensure custom_fields is always a valid object (not integer or other types)
      const customFieldsForDB: Record<string, any> = {};
      
      // Include all custom fields, even if they're empty strings (but filter out undefined/null)
      Object.keys(customFieldsToSend).forEach((key) => {
        const value = customFieldsToSend[key];
        // Include all values except undefined and null (allow empty strings)
        if (value !== undefined && value !== null) {
          customFieldsForDB[key] = value;
        }
      });

      const apiData: Record<string, any> = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        mobilePhone: mobilePhone,
        address: address,
        city: city,
        state: state,
        zip: zip,
        status: status,
        currentOrganization: currentOrganization,
        title: title,
        resumeText: resumeText,
        skills: skills,
        desiredSalary: desiredSalary,
        owner: owner,
        dateAdded: dateAdded,
        // ✅ CRITICAL: Always send custom_fields as a valid JSON object
        custom_fields: customFieldsForDB,
      };

      // 🔍 DEBUG: Log the final payload
      console.log("=== FINAL PAYLOAD ===");
      console.log("Full apiData:", JSON.stringify(apiData, null, 2));
      console.log("apiData.custom_fields:", apiData.custom_fields);
      console.log(
        "Type of apiData.custom_fields:",
        typeof apiData.custom_fields
      );
      console.log(
        "Is apiData.custom_fields an object?",
        typeof apiData.custom_fields === "object" && !Array.isArray(apiData.custom_fields)
      );
      console.log("=== END PAYLOAD ===");

      // Validate that custom_fields is always a plain object
      if (
        typeof apiData.custom_fields !== "object" ||
        apiData.custom_fields === null ||
        Array.isArray(apiData.custom_fields)
      ) {
        console.error("ERROR: custom_fields is not a valid object!", apiData.custom_fields);
        apiData.custom_fields = {};
      }

      // Ensure custom_fields is a plain object
      try {
        apiData.custom_fields = JSON.parse(JSON.stringify(apiData.custom_fields));
      } catch (e) {
        console.error("ERROR: Failed to serialize custom_fields!", e);
        apiData.custom_fields = {};
      }

      // Final validation - ensure custom_fields is definitely an object
      if (typeof apiData.custom_fields !== "object" || apiData.custom_fields === null) {
        console.error("FINAL VALIDATION FAILED: custom_fields is still not an object!", apiData.custom_fields);
        apiData.custom_fields = {};
      }

      // Remove any potential conflicting keys
      delete (apiData as any).customFields;
      
      // Log final payload before sending
      console.log("=== FINAL VALIDATION ===");
      console.log("custom_fields type:", typeof apiData.custom_fields);
      console.log("custom_fields value:", apiData.custom_fields);
      console.log("custom_fields is object:", typeof apiData.custom_fields === "object" && !Array.isArray(apiData.custom_fields));
      console.log("All keys in apiData:", Object.keys(apiData));
      console.log("=== END VALIDATION ===");

      const formData = apiData;

      console.log(
        `${isEditMode ? "Updating" : "Creating"} job seeker data:`,
        formData
      );

      // Choose the appropriate API endpoint and method
      const url = isEditMode
        ? `/api/job-seekers/${jobSeekerId}`
        : "/api/job-seekers";
      const method = isEditMode ? "PUT" : "POST";

      // Send the data to the backend API
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Failed to ${isEditMode ? "update" : "create"} job seeker`
        );
      }

      // Navigate to the job seeker view page
      const resultId = isEditMode
        ? jobSeekerId
        : data.jobSeeker
        ? data.jobSeeker.id
        : null;
      if (resultId) {
        router.push("/dashboard/job-seekers/view?id=" + resultId);
      } else {
        router.push("/dashboard/job-seekers");
      }
    } catch (error) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} job seeker:`,
        error
      );
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // Show loading screen when submitting
  if (isSubmitting) {
    return (
      <LoadingScreen
        message={
          isEditMode ? "Updating job seeker..." : "Creating job seeker..."
        }
      />
    );
  }

  // Show loading screen when loading existing job seeker data
  if (isLoading) {
    return <LoadingScreen message="Loading job seeker data..." />;
  }

  // Show error if job seeker loading fails
  if (loadError) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{loadError}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Job Seekers
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
            <Image
              src="/file.svg"
              alt="Job Seeker"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-xl font-bold">
              {isEditMode ? "Edit" : "Add"} Job Seeker
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* <button
              onClick={() =>
                router.push(
                  "/dashboard/admin/field-mapping?section=job-seekers"
                )
              }
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
            {/* {formFields.map((field, index) => (
              <div key={field.id} className="flex items-center">
                <label className="w-48 font-medium">
                  {field.label}:
                  {field.locked && (
                    <span className="ml-1 text-xs text-gray-500">(Auto)</span>
                  )}
                </label>

                <div className="flex-1 relative">
                  {field.type === "text" ||
                  field.type === "email" ||
                  field.type === "tel" ? (
                    <div className="relative">
                      <input
                        type={field.type}
                        name={field.name}
                        value={field.value}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className={`w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 ${
                          field.locked ? "bg-gray-100 cursor-not-allowed" : ""
                        } ${
                          field.id === "email" && !emailValidation.isValid
                            ? "border-red-500"
                            : ""
                        }`}
                        required={field.required}
                        disabled={field.locked}
                        readOnly={field.locked}
                      />

                      {field.id === "email" && field.value && (
                        <div className="absolute right-2 top-2">
                          {emailValidation.isChecking ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                          ) : (
                            <span
                              className={
                                emailValidation.isValid
                                  ? "text-green-500"
                                  : "text-red-500"
                              }
                            >
                              {emailValidation.isValid ? "✓" : "✗"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : field.type === "date" ? (
                    <div className="relative">
                      <input
                        type="date"
                        name={field.name}
                        value={field.value}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className={`w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 ${
                          field.locked ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        required={field.required}
                        disabled={field.locked}
                        readOnly={field.locked}
                      />
                      {!field.locked && (
                        <button
                          type="button"
                          className="absolute right-2 top-2"
                        >
                          <Image
                            src="/calendar.svg"
                            alt="Calendar"
                            width={16}
                            height={16}
                          />
                        </button>
                      )}
                    </div>
                  ) : field.type === "select" ? (
                    <select
                      name={field.name}
                      value={field.value}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
                      required={field.required}
                      disabled={field.locked}
                    >
                      <option value="">Select {field.label}</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      name={field.name}
                      value={field.value}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      rows={field.name === "resumeText" ? 5 : 3}
                      placeholder={field.placeholder}
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      required={field.required}
                      disabled={field.locked}
                    />
                  ) : field.type === "file" ? (
                    <div>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                        className="w-full p-2 text-gray-700"
                        required={field.required}
                        disabled={field.locked}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Accepted formats: PDF, DOC, DOCX
                      </p>
                    </div>
                  ) : null}

                  {field.required && !field.locked && (
                    <span className="absolute text-red-500 left-[-10px] top-2">
                      *
                    </span>
                  )}
                </div>
              </div>
            ))} */}

            {/* Custom Fields Section */}
            {customFields.length > 0 && (
              <>
                {/* <div className="mt-8 mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                                        Additional Information
                                    </h3>
                                </div> */}

                {customFields.map((field) => {
                  // Don't render hidden fields at all (neither label nor input)
                  if (field.is_hidden) return null;

                  const fieldValue = customFieldValues[field.field_name] || "";

                  return (
                    <div key={field.id} className="flex items-center mb-3">
                      <label className="w-48 font-medium flex items-center">
                        {field.field_label}:
                        {field.is_required &&
                          (fieldValue.trim() !== "" ? (
                            <span className="text-green-500 ml-1">✔</span>
                          ) : (
                            <span className="text-red-500 ml-1">*</span>
                          ))}
                      </label>

                      <div className="flex-1 relative">
                        <CustomFieldRenderer
                          field={field}
                          value={fieldValue}
                          onChange={handleCustomFieldChange}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Email validation message */}
          {!emailValidation.isValid && emailValidation.message && (
            <div className="text-red-500 text-sm">
              Email: {emailValidation.message}
            </div>
          )}

          {/* Address validation message and suggestions */}
          {!addressValidation.isValid && addressValidation.message && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
              <div className="text-yellow-700 text-sm mb-2">
                Address: {addressValidation.message}
              </div>
              {addressValidation.suggestions &&
                addressValidation.suggestions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-2">
                      Suggested addresses:
                    </p>
                    {addressValidation.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          // Apply suggested address
                          setFormFields((prev) =>
                            prev.map((field) => {
                              if (field.id === "address")
                                return { ...field, value: suggestion.address };
                              if (field.id === "city")
                                return { ...field, value: suggestion.city };
                              if (field.id === "state")
                                return { ...field, value: suggestion.state };
                              if (field.id === "zip")
                                return { ...field, value: suggestion.zip };
                              return field;
                            })
                          );
                        }}
                        className="block w-full text-left p-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 mb-1"
                      >
                        {suggestion.formatted}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Form Buttons */}
          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={handleGoBack}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={
                !emailValidation.isValid ||
                (!addressValidation.isValid &&
                  formFields.some(
                    (f) =>
                      (f.id === "address" || f.id === "city") && f.value.trim()
                  ))
              }
            >
              {isEditMode ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
