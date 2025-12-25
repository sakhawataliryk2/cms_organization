"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import PanelWithHeader from "@/components/PanelWithHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { formatRecordId } from '@/lib/recordIdFormatter';

export default function OrganizationView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("id");

  const [organization, setOrganization] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Notes and history state
  const [notes, setNotes] = useState<
    Array<{
      id: string;
      text: string;
      created_at: string;
      created_by_name: string;
    }>
  >([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  // Add Note form state - matching jobs view structure
  const [noteForm, setNoteForm] = useState({
    text: "",
    about: organization ? `${organization.id} ${organization.name}` : "",
    copyNote: "No",
    replaceGeneralContactComments: false,
    additionalReferences: "",
    scheduleNextAction: "None",
    emailNotification: "Internal User",
  });
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<Array<any>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newDocumentType, setNewDocumentType] = useState("General");
  const [newDocumentContent, setNewDocumentContent] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  // Hiring Managers (Contacts) state
  const [hiringManagers, setHiringManagers] = useState<Array<any>>([]);
  const [isLoadingHiringManagers, setIsLoadingHiringManagers] = useState(false);
  const [hiringManagersError, setHiringManagersError] = useState<string | null>(
    null
  );

  // Tasks state
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<Array<any>>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  // Tearsheet modal state
  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);
  const [tearsheetForm, setTearsheetForm] = useState({
    name: "",
    visibility: "Existing", // 'New' or 'Existing'
  });
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);

  // Current active tab
  const [activeTab, setActiveTab] = useState("summary");

  // Editable fields in Modify tab
  const [editableFields, setEditableFields] = useState<any>({});

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  useEffect(() => {
    console.log("availableFields:", availableFields);
    console.log("availableFields count:", availableFields?.length);
  }, [availableFields]);

  useEffect(() => {
    console.log("organization.customFields:", organization?.customFields);
  }, [organization]);

  // =====================
  // HEADER FIELDS (Top Row)
  // =====================
  const DEFAULT_HEADER_FIELDS = ["phone", "website"]; // start simple

  const [headerFields, setHeaderFields] = useState<string[]>(
    DEFAULT_HEADER_FIELDS
  );
  const [showHeaderFieldModal, setShowHeaderFieldModal] = useState(false);

  // Build field list: Standard + Custom(from Modify page)
const buildHeaderFieldCatalog = () => {
  const standard = [
    { key: "phone", label: "Phone" },
    { key: "website", label: "Website" },
    { key: "name", label: "Name" },
    { key: "nickname", label: "Nickname" },
    { key: "address", label: "Address" },
  ];

  
  const apiCustom = (availableFields || []).map((f: any) => {
    const k = f.field_name || f.field_key || f.field_label || f.id;
    return {
      key: `custom:${k}`,
      label: f.field_label || f.field_name || String(k),
    };
  });

  const orgCustom = Object.keys(organization?.customFields || {}).map((k) => ({
    key: `custom:${k}`,
    label: k,
  }));

  const merged = [...standard, ...apiCustom, ...orgCustom];
  const seen = new Set<string>();
  return merged.filter((x) => {
    if (seen.has(x.key)) return false;
    seen.add(x.key);
    return true;
  });
};


  const headerFieldCatalog = buildHeaderFieldCatalog();

  const getHeaderFieldValue = (key: string) => {
    if (!organization) return "-";

    // custom fields
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const val = organization.customFields?.[rawKey];
      return val === undefined || val === null || val === ""
        ? "-"
        : String(val);
    }

    // standard fields
    switch (key) {
      case "phone":
        return organization.phone || "(Not provided)";
      case "website":
        return organization.website || "-";
      case "name":
        return organization.name || "-";
      case "nickname":
        return organization.nicknames || "-";
      case "address":
        return organization.address || "-";
      default:
        return "-";
    }
  };

  const getHeaderFieldLabel = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found?.label || key;
  };

  // Save per-organization in localStorage
  useEffect(() => {
    if (!organizationId) return;
    const storageKey = `org_header_fields_${organizationId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHeaderFields(parsed);
      } catch {}
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    const storageKey = `org_header_fields_${organizationId}`;
    localStorage.setItem(storageKey, JSON.stringify(headerFields));
  }, [organizationId, headerFields]);

  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>({
    contactInfo: ["name", "nickname", "phone", "address", "website"],
    about: ["about"],
    recentNotes: ["notes"],
    websiteJobs: ["jobs"],
    ourJobs: ["jobs"],
  });
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Fetch organization data when component mounts
  useEffect(() => {
    if (organizationId) {
      fetchOrganizationData(organizationId);
    }
  }, [organizationId]);

  // Refresh hiring managers and jobs when returning from adding a hiring manager or job
  useEffect(() => {
    const returnToOrgId = sessionStorage.getItem("returnToOrganizationId");
    if (returnToOrgId && returnToOrgId === organizationId) {
      // Clear the flag
      sessionStorage.removeItem("returnToOrganizationId");
      // Refresh hiring managers and jobs
      if (organizationId) {
        fetchHiringManagers(organizationId);
        fetchJobs(organizationId);
      }
    }
  }, [organizationId]);

  // Refresh tasks when hiring managers are loaded (since tasks are filtered by hiring manager IDs)
  useEffect(() => {
    if (organizationId && !isLoadingHiringManagers) {
      fetchTasks(organizationId);
    }
  }, [hiringManagers, organizationId, isLoadingHiringManagers]);

  // Fetch available fields after organization is loaded
  useEffect(() => {
    if (organization && organizationId) {
      fetchAvailableFields();
      // Update note form about field when organization is loaded
      setNoteForm((prev) => ({
        ...prev,
        about: `${organization.id} ${organization.name}`,
      }));
    }
  }, [organization, organizationId]);

  // Fetch users for email notification
  useEffect(() => {
    if (showAddNote) {
      fetchUsers();
    }
  }, [showAddNote]);

  // Fetch users for email notification dropdown
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch("/api/users/active", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
const token = document.cookie.replace(
  /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
  "$1"
);

const response = await fetch("/api/admin/field-management/organizations", {
  headers: { Authorization: `Bearer ${token}` },
});

console.log("field-management status:", response.status);

const raw = await response.text();
console.log("field-management raw:", raw);

let data: any = {};
try {
  data = JSON.parse(raw);
} catch {}

const fields =
  data.fields || data.data?.fields || data.organizationFields || [];
setAvailableFields(fields);
      if (response.ok) {
        const data = await response.json();
        const fields = data.fields || [];
        setAvailableFields(fields);

        // Add custom fields to visible fields if they have values
        if (organization && organization.customFields) {
          const customFieldKeys = Object.keys(organization.customFields);
          customFieldKeys.forEach((fieldKey) => {
            // Add to appropriate panel based on field name
            if (
              fieldKey.toLowerCase().includes("contact") ||
              fieldKey.toLowerCase().includes("phone") ||
              fieldKey.toLowerCase().includes("address")
            ) {
              if (!visibleFields.contactInfo.includes(fieldKey)) {
                setVisibleFields((prev) => ({
                  ...prev,
                  contactInfo: [...prev.contactInfo, fieldKey],
                }));
              }
            }
          });
        }
      }
    } catch (err) {
      console.error("Error fetching available fields:", err);
    } finally {
      setIsLoadingFields(false);
    }
  };

  // Toggle field visibility
  const toggleFieldVisibility = (panelId: string, fieldKey: string) => {
    setVisibleFields((prev) => {
      const panelFields = prev[panelId] || [];
      if (panelFields.includes(fieldKey)) {
        return {
          ...prev,
          [panelId]: panelFields.filter((f) => f !== fieldKey),
        };
      } else {
        return {
          ...prev,
          [panelId]: [...panelFields, fieldKey],
        };
      }
    });
  };

  // Handle edit panel click
  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Initialize editable fields when organization data is loaded
  useEffect(() => {
    if (organization) {
      // Flatten organization data for editing
      const flattenedData = {
        name: organization.name,
        phone: organization.phone,
        website: organization.website,
        contactName: organization.contact.name,
        contactNickname: organization.contact.nickname || "",
        contactPhone: organization.contactPhone || organization.phone || "",
        contactAddress: organization.contact.address,
        contactWebsite: organization.contact.website,
        about: organization.about,
      };
      setEditableFields(flattenedData);
      setOriginalData({ ...flattenedData });
    }
  }, [organization]);

  // Update the fetchOrganizationData function in app/dashboard/organizations/view/page.tsx

  const fetchOrganizationData = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching organization data for ID: ${id}`);
      const response = await fetch(`/api/organizations/${id}`);

      // Log the raw response for debugging
      console.log(
        `API Response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        let errorMessage = `Failed to fetch organization: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error("API error detail:", errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.error("Could not parse error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      // Parse the successful response
      const data = await response.json();
      console.log("Organization data received:", data);

      // Parse custom fields
      let customFieldsObj = {};
      if (data.organization.custom_fields) {
        try {
          if (typeof data.organization.custom_fields === "string") {
            customFieldsObj = JSON.parse(data.organization.custom_fields);
          } else if (typeof data.organization.custom_fields === "object") {
            customFieldsObj = data.organization.custom_fields;
          }
        } catch (e) {
          console.error("Error parsing custom fields:", e);
        }
      }

      // FIXED MAPPING: Map the data correctly to display fields
      const formattedOrg = {
        id: data.organization.id,
        name: data.organization.name || "No name provided",
        phone: data.organization.contact_phone || "(Not provided)",
        website: data.organization.website || "https://example.com",
        nicknames: data.organization.nicknames || "",
        parentOrganization: data.organization.parent_organization || "",
        status: data.organization.status || "Active",
        contractOnFile: data.organization.contract_on_file || "No",
        dateContractSigned: data.organization.date_contract_signed || "",
        yearFounded: data.organization.year_founded || "",
        permFee: data.organization.perm_fee || "",
        numEmployees: data.organization.num_employees || "",
        numOffices: data.organization.num_offices || "",
        contactPhone: data.organization.contact_phone || "",
        address: data.organization.address || "",
        contact: {
          // IMPORTANT: Use correct field for contact name - this was causing "No contact specified"
          name: data.organization.name || "No name provided",
          nickname: data.organization.nicknames || "",
          phone: data.organization.contact_phone || "(Not provided)",
          address: data.organization.address || "No address provided",
          website: data.organization.website || "https://example.com",
        },
        about: data.organization.overview || "No description provided",
        customFields: customFieldsObj,
      };

      console.log("Formatted organization:", formattedOrg);
      setOrganization(formattedOrg);

      // After loading organization data, fetch notes, history, documents, hiring managers, and tasks
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
      fetchHiringManagers(id);
      fetchTasks(id);
    } catch (err) {
      console.error("Error fetching organization:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching organization details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch notes for organization
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);
    setNoteError(null);

    try {
      const response = await fetch(`/api/organizations/${id}/notes`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch notes");
      }

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setNoteError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching notes"
      );
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Fetch history for organization
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/organizations/${id}/history`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch history");
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error("Error fetching history:", err);
      setHistoryError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching history"
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch documents for organization
  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);

    try {
      const response = await fetch(`/api/organizations/${id}/documents`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setDocumentError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching documents"
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // Fetch hiring managers (contacts) for organization
  const fetchHiringManagers = async (organizationId: string) => {
    setIsLoadingHiringManagers(true);
    setHiringManagersError(null);

    try {
      const response = await fetch(`/api/hiring-managers`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch hiring managers");
      }

      const data = await response.json();
      // Filter hiring managers by organization ID
      const orgHiringManagers = (data.hiringManagers || []).filter(
        (hm: any) =>
          hm.organization_id?.toString() === organizationId.toString()
      );
      setHiringManagers(orgHiringManagers);
    } catch (err) {
      console.error("Error fetching hiring managers:", err);
      setHiringManagersError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching hiring managers"
      );
    } finally {
      setIsLoadingHiringManagers(false);
    }
  };

  // Fetch jobs for organization
  const fetchJobs = async (organizationId: string) => {
    setIsLoadingJobs(true);
    setJobsError(null);

    try {
      const response = await fetch(`/api/jobs`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch jobs");
      }

      const data = await response.json();
      // Filter jobs by organization ID
      const orgJobs = (data.jobs || []).filter(
        (job: any) =>
          job.organization_id?.toString() === organizationId.toString()
      );
      setJobs(orgJobs);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setJobsError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching jobs"
      );
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Fetch tasks for organization (only non-completed tasks)
  const fetchTasks = async (organizationId: string) => {
    setIsLoadingTasks(true);
    setTasksError(null);

    try {
      // First, get organization's hiring manager IDs
      const hiringManagerIds = hiringManagers.map((hm) => hm.id);

      // Fetch jobs for this organization
      const jobsResponse = await fetch(`/api/jobs`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      let jobIds: number[] = [];
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        jobIds = (jobsData.jobs || [])
          .filter(
            (job: any) =>
              job.organization_id?.toString() === organizationId.toString()
          )
          .map((job: any) => job.id);
      }

      // Fetch all tasks
      const tasksResponse = await fetch(`/api/tasks`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!tasksResponse.ok) {
        const errorData = await tasksResponse.json();
        throw new Error(errorData.message || "Failed to fetch tasks");
      }

      const tasksData = await tasksResponse.json();

      // Filter tasks:
      // 1. Not completed (status !== "Completed" and is_completed !== true)
      // 2. Related to this organization (through hiring_manager_id, job_id, or organization_id)
      const orgTasks = (tasksData.tasks || []).filter((task: any) => {
        // Exclude completed tasks
        if (task.is_completed === true || task.status === "Completed") {
          return false;
        }

        // Check if task is related to this organization
        return (
          (task.hiring_manager_id &&
            hiringManagerIds.includes(parseInt(task.hiring_manager_id))) ||
          (task.job_id && jobIds.includes(parseInt(task.job_id))) ||
          (task.organization_id &&
            task.organization_id.toString() === organizationId.toString())
        );
      });

      setTasks(orgTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasksError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching tasks"
      );
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Handle adding a new document
  const handleAddDocument = async () => {
    if (!newDocumentName.trim() || !organizationId) return;

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            document_name: newDocumentName,
            document_type: newDocumentType,
            content: newDocumentContent,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add document");
      }

      const data = await response.json();

      // Add the new document to the list
      setDocuments([data.document, ...documents]);

      // Clear the form
      setNewDocumentName("");
      setNewDocumentType("General");
      setNewDocumentContent("");
      setShowAddDocument(false);

      // Show success message
      alert("Document added successfully");
    } catch (err) {
      console.error("Error adding document:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while adding a document"
      );
    }
  };

  // Handle deleting a document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/documents/${documentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete document");
      }

      // Remove the document from the list
      setDocuments(documents.filter((doc) => doc.id !== documentId));

      alert("Document deleted successfully");
    } catch (err) {
      console.error("Error deleting document:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting the document"
      );
    }
  };

  const handleGoBack = () => {
    router.push("/dashboard/organizations");
  };

  // Print handler: ensure Summary tab is active when printing
  const handlePrint = () => {
    const prevTab = activeTab;
    if (prevTab !== "summary") {
      setActiveTab("summary");
      setTimeout(() => {
        window.print();
        setActiveTab(prevTab);
      }, 300);
    } else {
      window.print();
    }
  };

  const refreshPanel = (panelName: string) => {
    console.log(`Refreshing ${panelName} panel`);
    // In a real application, you would refetch data for this panel
  };

  const closePanel = (panelName: string) => {
    console.log(`Closing ${panelName} panel`);
    // In a real application, you would hide or collapse this panel
  };

  const handleActionSelected = (action: string) => {
    if (action === "edit" && organizationId) {
      router.push(`/dashboard/organizations/add?id=${organizationId}`);
    } else if (action === "delete" && organizationId) {
      // Confirm before deleting
      if (confirm("Are you sure you want to delete this organization?")) {
        deleteOrganization(organizationId);
      }
    } else if (action === "add-note") {
      setShowAddNote(true);
      setActiveTab("notes");
    } else if (action === "add-job") {
      // Navigate to add job page with organization context
      if (organizationId) {
        // Store organizationId in sessionStorage to refresh jobs when returning
        sessionStorage.setItem("returnToOrganizationId", organizationId);
        router.push(`/dashboard/jobs/add?organizationId=${organizationId}`);
      } else {
        router.push("/dashboard/jobs/add");
      }
    } else if (action === "add-task") {
      // Navigate to add task page with organization context
      if (organizationId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=organization&relatedEntityId=${organizationId}`
        );
      }
    } else if (action === "add-hiring-manager") {
      // Navigate to add hiring manager page with organization context
      if (organizationId) {
        // Store organizationId in sessionStorage to refresh contacts when returning
        sessionStorage.setItem("returnToOrganizationId", organizationId);
        router.push(
          `/dashboard/hiring-managers/add?organizationId=${organizationId}`
        );
      } else {
        router.push("/dashboard/hiring-managers/add");
      }
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else {
      console.log(`Action selected: ${action}`);
    }
  };

  // Function to delete an organization
  const deleteOrganization = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete organization");
      }

      // Redirect to organizations list after successful deletion
      router.push("/dashboard/organizations");
    } catch (err) {
      console.error("Error deleting organization:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting the organization"
      );
      setIsLoading(false);
    }
  };

  // Handle field changes in the Modify tab
  const handleFieldChange = (fieldName: string, value: string) => {
    setEditableFields({
      ...editableFields,
      [fieldName]: value,
    });
  };

  // Update the saveModifications function in app/dashboard/organizations/view/page.tsx

  const saveModifications = async () => {
    if (!organizationId) return;

    setIsSaving(true);
    try {
      // Debug - log the current editable fields
      console.log("Editable fields before save:", editableFields);

      // Get the currently logged in user from cookies
      const userDataStr = getCookie("user");
      let userId = null;

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr as string);
          userId = userData.id;
          console.log("Current user ID:", userId);
        } catch (e) {
          console.error("Error parsing user data from cookie:", e);
        }
      }

      // Convert editable fields back to API format matching backend expectations
      const apiData = {
        name: editableFields.name,
        nicknames: editableFields.contactNickname,
        website: editableFields.website,
        overview: editableFields.about,
        contact_phone: editableFields.contactPhone,
        address: editableFields.contactAddress, // Use the address from the form
        // Important: Include the user ID so backend knows who's making the update
        created_by: userId,
        // Pass other necessary fields from the original organization
        status: organization.status || "Active",
        parent_organization: organization.parentOrganization || "",
        contract_on_file: organization.contractOnFile || "No",
        contract_signed_by: editableFields.contactName, // This was missing
      };

      console.log("Data being sent to API:", apiData);

      // Send the update request
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiData),
      });

      // Get response as text first for debugging
      const responseText = await response.text();
      console.log("Raw response:", responseText);

      // Try to parse the response
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("API response data:", data);
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        throw new Error("Invalid response format from server");
      }

      // Check for error response
      if (!response.ok) {
        console.error("API error response:", data);
        throw new Error(data.message || "Failed to update organization");
      }

      // Update the organization state with the new data
      setOrganization({
        ...organization,
        name: editableFields.name,
        phone: editableFields.contactPhone,
        website: editableFields.website,
        address: editableFields.contactAddress, // Update address in organization state
        contact: {
          ...organization.contact,
          name: editableFields.contactName,
          nickname: editableFields.contactNickname,
          phone: editableFields.contactPhone,
          address: editableFields.contactAddress,
          website: editableFields.contactWebsite,
        },
        about: editableFields.about,
      });

      setOriginalData({ ...editableFields });

      // Refresh history after update
      fetchHistory(organizationId);

      alert("Organization updated successfully");
    } catch (err) {
      console.error("Error updating organization:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while updating the organization"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel modifications
  const cancelModifications = () => {
    setEditableFields({ ...originalData });
  };

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!noteForm.text.trim() || !organizationId) return;

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
          body: JSON.stringify({
            text: noteForm.text,
            copy_note: noteForm.copyNote === "Yes",
            replace_general_contact_comments:
              noteForm.replaceGeneralContactComments,
            additional_references: noteForm.additionalReferences,
            schedule_next_action: noteForm.scheduleNextAction,
            email_notification: noteForm.emailNotification,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add note");
      }

      const data = await response.json();

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      // Clear the form
      setNoteForm({
        text: "",
        about: organization
          ? `${formatRecordId(organization.id, "organization")} ${
              organization.name
            }`
          : "",
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: "",
        scheduleNextAction: "None",
        emailNotification: "Internal User",
      });
      setShowAddNote(false);

      // Refresh history to show the note addition
      fetchHistory(organizationId);

      // Show success message
      alert("Note added successfully");
    } catch (err) {
      console.error("Error adding note:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while adding a note"
      );
    }
  };

  // Close add note modal
  const handleCloseAddNoteModal = () => {
    setShowAddNote(false);
    setNoteForm({
      text: "",
      about: organization ? `${organization.id} ${organization.name}` : "",
      copyNote: "No",
      replaceGeneralContactComments: false,
      additionalReferences: "",
      scheduleNextAction: "None",
      emailNotification: "Internal User",
    });
  };

  // Handle tearsheet submission
  const handleTearsheetSubmit = async () => {
    if (!tearsheetForm.name.trim()) {
      alert("Please enter a tearsheet name");
      return;
    }

    if (!organizationId) {
      alert("Organization ID is missing");
      return;
    }

    setIsSavingTearsheet(true);
    try {
      const response = await fetch("/api/tearsheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          name: tearsheetForm.name,
          visibility: tearsheetForm.visibility,
          organization_id: organizationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to create tearsheet" }));
        throw new Error(errorData.message || "Failed to create tearsheet");
      }

      alert("Tearsheet created successfully!");
      setShowAddTearsheetModal(false);
      setTearsheetForm({ name: "", visibility: "Existing" });
    } catch (err) {
      console.error("Error creating tearsheet:", err);
      if (err instanceof Error && err.message.includes("Failed to fetch")) {
        alert(
          "Tearsheet creation feature is being set up. The tearsheet will be created once the API is ready."
        );
        setShowAddTearsheetModal(false);
        setTearsheetForm({ name: "", visibility: "Existing" });
      } else {
        alert(
          err instanceof Error
            ? err.message
            : "Failed to create tearsheet. Please try again."
        );
      }
    } finally {
      setIsSavingTearsheet(false);
    }
  };

  // Update the actionOptions to remove the edit option since we'll handle it in Modify tab
  const actionOptions = [
    { label: "Add Note", action: () => handleActionSelected("add-note") },
    {
      label: "Add Hiring Manager",
      action: () => handleActionSelected("add-hiring-manager"),
    },
    { label: "Add Job", action: () => handleActionSelected("add-job") },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
    {
      label: "Add Tearsheet",
      action: () => handleActionSelected("add-tearsheet"),
    },
    { label: "Transfer", action: () => handleActionSelected("transfer") },
    { label: "Delete", action: () => handleActionSelected("delete") },
  ];

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "notes", label: "Notes" },
    { id: "history", label: "History" },
    { id: "quotes", label: "Quotes" },
    { id: "invoices", label: "Invoices" },
    { id: "contacts", label: "Contacts" },
    { id: "docs", label: "Docs" },
    { id: "opportunities", label: "Opportunities" },
  ];

  const quickActions = [
    { id: "client-visit", label: "Client Visit" },
    { id: "jobs", label: "Jobs" },
    { id: "submissions", label: "Submissions" },
    { id: "client-submissions", label: "Client Submissions" },
    { id: "interviews", label: "Interviews" },
    { id: "placements", label: "Placements" },
  ];

  // Handle modify button click - redirect to add page with organization ID
  const handleModifyClick = () => {
    if (organizationId) {
      router.push(`/dashboard/organizations/add?id=${organizationId}`);
    }
  };

  // Update the renderModifyTab function to show a button instead of auto-redirecting
  const renderModifyTab = () => {
    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Modify Organization</h2>
        <p className="text-gray-600 mb-4">
          Click the button below to edit this organization's details.
        </p>
        <button
          onClick={handleModifyClick}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Modify Organization
        </button>
      </div>
    );
  };

  // Render notes tab content
  const renderNotesTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Organization Notes</h2>
        <button
          onClick={() => setShowAddNote(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Add Note
        </button>
      </div>

      {/* Notes List */}
      {isLoadingNotes ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : noteError ? (
        <div className="text-red-500 py-2">{noteError}</div>
      ) : notes.length > 0 ? (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="p-3 border rounded hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-blue-600">
                  {note.created_by_name || "Unknown User"}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(note.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-700">{note.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 italic">No notes have been added yet.</p>
      )}
    </div>
  );

  // Render history tab content
  const renderHistoryTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Organization History</h2>

      {isLoadingHistory ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : historyError ? (
        <div className="text-red-500 py-2">{historyError}</div>
      ) : history.length > 0 ? (
        <div className="space-y-4">
          {history.map((item) => {
            // Format the history entry based on action type
            let actionDisplay = "";
            let detailsDisplay = "";

            try {
              const details =
                typeof item.details === "string"
                  ? JSON.parse(item.details)
                  : item.details;

              switch (item.action) {
                case "CREATE":
                  actionDisplay = "Organization Created";
                  detailsDisplay = `Created by ${
                    item.performed_by_name || "Unknown"
                  }`;
                  break;
                case "UPDATE":
                  actionDisplay = "Organization Updated";
                  if (details && details.before && details.after) {
                    // Create a list of changes
                    const changes = [];
                    for (const key in details.after) {
                      if (details.before[key] !== details.after[key]) {
                        const fieldName = key.replace(/_/g, " ");
                        changes.push(
                          `${fieldName}: "${details.before[key] || ""}" → "${
                            details.after[key] || ""
                          }"`
                        );
                      }
                    }
                    if (changes.length > 0) {
                      detailsDisplay = `Changes: ${changes.join(", ")}`;
                    } else {
                      detailsDisplay = "No changes detected";
                    }
                  }
                  break;
                case "ADD_NOTE":
                  actionDisplay = "Note Added";
                  detailsDisplay = details.text || "";
                  break;
                default:
                  actionDisplay = item.action;
                  detailsDisplay = JSON.stringify(details);
              }
            } catch (e) {
              console.error("Error parsing history details:", e);
              detailsDisplay = "Error displaying details";
            }

            return (
              <div
                key={item.id}
                className="p-3 border rounded hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-blue-600">
                    {actionDisplay}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(item.performed_at).toLocaleString()}
                  </span>
                </div>
                <div className="mb-2">{detailsDisplay}</div>
                <div className="text-sm text-gray-600">
                  By: {item.performed_by_name || "Unknown"}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 italic">No history records available</p>
      )}
    </div>
  );

  if (isLoading) {
    return <LoadingScreen message="Loading organization details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Organizations
        </button>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-gray-700 mb-4">Organization not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Organizations
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with company name and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            {/* <Image
              src="/window.svg"
              alt="Organization"
              width={24}
              height={24}
            /> */}
            <HiOutlineOfficeBuilding size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {formatRecordId(organization.id, "organization")}{" "}
            {organization.name}
          </h1>
        </div>
      </div>

      {/* Phone and Website section */}
      {/* <div className="bg-white border-b border-gray-300 p-3 flex justify-between items-center">
        <div className="flex space-x-8">
          <div>
            <h2 className="text-gray-600">Phone</h2>
            <p className="font-medium">{organization.phone}</p>
          </div>
          <div>
            <h2 className="text-gray-600">Website</h2>
            <a
              href={organization.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:underline"
            >
              {organization.website}
            </a>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ActionDropdown label="Actions" options={actionOptions} />
          <button
            onClick={handlePrint}
            className="p-1 hover:bg-gray-200 rounded"
            aria-label="Print"
          >
            <Image src="/print.svg" alt="Print" width={20} height={20} />
          </button>
          <button
            className="p-1 hover:bg-gray-200 rounded"
            aria-label="Reload"
            onClick={() =>
              organizationId && fetchOrganizationData(organizationId)
            }
          >
            <Image src="/reload.svg" alt="Reload" width={20} height={20} />
          </button>
          <button
            onClick={handleGoBack}
            className="p-1 hover:bg-gray-200 rounded"
            aria-label="Close"
          >
            <Image src="/x.svg" alt="Close" width={20} height={20} />
          </button>
        </div>
      </div> */}

      <div className="bg-white border-b border-gray-300 px-3 py-2">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          {/* LEFT: dynamic fields */}
          <div className="flex flex-wrap gap-x-10 gap-y-2 flex-1 min-w-0">
            {headerFields.length === 0 ? (
              <span className="text-sm text-gray-500">
                No header fields selected
              </span>
            ) : (
              headerFields.map((fk) => (
                <div key={fk} className="min-w-[140px]">
                  <div className="text-xs text-gray-500">
                    {getHeaderFieldLabel(fk)}
                  </div>
                  {fk === "website" ? (
                    <a
                      href={getHeaderFieldValue(fk)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {getHeaderFieldValue(fk)}
                    </a>
                  ) : (
                    <div className="text-sm font-medium text-gray-900">
                      {getHeaderFieldValue(fk)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* RIGHT: actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowHeaderFieldModal(true)}
              className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900"
              title="Customize header fields"
              aria-label="Customize header fields"
            >
              <svg
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                height="16"
                width="16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>

            <ActionDropdown label="Actions" options={actionOptions} />

            <button
              onClick={handlePrint}
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Print"
            >
              <Image src="/print.svg" alt="Print" width={20} height={20} />
            </button>

            <button
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Reload"
              onClick={() =>
                organizationId && fetchOrganizationData(organizationId)
              }
            >
              <Image src="/reload.svg" alt="Reload" width={20} height={20} />
            </button>

            <button
              onClick={handleGoBack}
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Close"
            >
              <Image src="/x.svg" alt="Close" width={20} height={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-gray-300 mt-1 border-b border-gray-400 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 ${
              activeTab === tab.id
                ? "bg-gray-200 rounded-t border-t border-r border-l border-gray-400 font-medium"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => {
              if (tab.id === "modify") {
                handleModifyClick();
              } else {
                setActiveTab(tab.id);
                // Refresh hiring managers when contacts tab is activated
                if (tab.id === "contacts" && organizationId) {
                  fetchHiringManagers(organizationId);
                }
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex bg-gray-300 p-2 space-x-2">
        {quickActions.map((action) => {
          // Special styling for Jobs action with count
          if (action.id === "jobs") {
            return (
              <button
                key={action.id}
                className="bg-green-500 text-white px-4 py-1 rounded-full shadow font-medium"
                onClick={() => setActiveTab("jobs")}
              >
                {isLoadingJobs ? (
                  "Loading..."
                ) : (
                  `${jobs.length} ${jobs.length === 1 ? "Job" : "Jobs"}`
                )}
              </button>
            );
          }
          return (
            <button
              key={action.id}
              className="bg-white px-4 py-1 rounded-full shadow"
            >
              {action.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        {/* Display content based on active tab */}
        {activeTab === "summary" && (
          <div className="grid grid-cols-7 gap-4">
            {/* Left Column - 4/7 width */}
            <div className="col-span-4 space-y-4">
              {/* Organization Contact Info */}
              <PanelWithHeader
                title="Organization Contact Info:"
                onEdit={() => handleEditPanel("contactInfo")}
                // onRefresh={() => refreshPanel('contact')}
                // onClose={() => closePanel('contact')}
              >
                <div className="space-y-0 border border-gray-200 rounded">
                  {visibleFields.contactInfo.includes("name") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-24 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Name:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        {organization.contact.name}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("nickname") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-24 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Nickname:
                      </div>
                      <div className="flex-1 p-2">
                        {organization.contact.nickname || "-"}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("phone") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-24 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Phone:
                      </div>
                      <div className="flex-1 p-2">
                        {organization.contact.phone}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("address") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-24 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Address:
                      </div>
                      <div className="flex-1 p-2">
                        {organization.contact.address}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("website") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-24 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Website:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        <a
                          href={organization.contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {organization.contact.website}
                        </a>
                      </div>
                    </div>
                  )}
                  {/* Display custom fields */}
                  {organization.customFields &&
                    Object.keys(organization.customFields).map((fieldKey) => {
                      if (visibleFields.contactInfo.includes(fieldKey)) {
                        const field = availableFields.find(
                          (f) =>
                            (f.field_name || f.field_label || f.id) === fieldKey
                        );
                        const fieldLabel =
                          field?.field_label || field?.field_name || fieldKey;
                        const fieldValue = organization.customFields[fieldKey];
                        return (
                          <div
                            key={fieldKey}
                            className="flex border-b border-gray-200 last:border-b-0"
                          >
                            <div className="w-24 font-medium p-2 border-r border-gray-200 bg-gray-50">
                              {fieldLabel}:
                            </div>
                            <div className="flex-1 p-2">
                              {String(fieldValue || "-")}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                </div>
              </PanelWithHeader>

              {/* About the Organization */}
              <PanelWithHeader
                title="About the Organization:"
                onEdit={() => handleEditPanel("about")}
                // onRefresh={() => refreshPanel('about')}
                // onClose={() => closePanel('about')}
              >
                <div className="border border-gray-200 rounded">
                  {visibleFields.about.includes("about") && (
                    <div className="p-2">
                      <p className="text-gray-700">{organization.about}</p>
                    </div>
                  )}
                </div>
              </PanelWithHeader>
            </div>

            {/* Right Column - 3/7 width */}
            <div className="col-span-3 space-y-4">
              {/* Recent Notes */}
              <PanelWithHeader
                title="Recent Notes:"
                // onEdit={() => handleEditPanel('recentNotes')}
                // onRefresh={() => refreshPanel('notes')}
                // onClose={() => closePanel('notes')}
              >
                <div className="border border-gray-200 rounded">
                  {visibleFields.recentNotes.includes("notes") && (
                    <div className="p-2">
                      {notes.length > 0 ? (
                        <div>
                          {notes.slice(0, 3).map((note) => (
                            <div
                              key={note.id}
                              className="mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0"
                            >
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">
                                  {note.created_by_name || "Unknown User"}
                                </span>
                                <span className="text-gray-500">
                                  {new Date(note.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">
                                {note.text.length > 100
                                  ? `${note.text.substring(0, 100)}...`
                                  : note.text}
                              </p>
                            </div>
                          ))}
                          {notes.length > 3 && (
                            <button
                              onClick={() => setActiveTab("notes")}
                              className="text-blue-500 text-sm hover:underline"
                            >
                              View all {notes.length} notes
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No recent notes</p>
                      )}
                    </div>
                  )}
                </div>
              </PanelWithHeader>

              {/* Open Jobs from Website */}
              <PanelWithHeader
                title="Open Jobs from Website:"
                onEdit={() => handleEditPanel("websiteJobs")}
                // onRefresh={() => refreshPanel('website-jobs')}
                // onClose={() => closePanel('website-jobs')}
              >
                <div className="border border-gray-200 rounded">
                  {visibleFields.websiteJobs.includes("jobs") && (
                    <div className="p-2">
                      <p className="text-gray-500 italic">No open jobs found</p>
                    </div>
                  )}
                </div>
              </PanelWithHeader>

              {/* Our Open Jobs */}
              <PanelWithHeader
                title="Our Open Jobs:"
                // onEdit={() => handleEditPanel('ourJobs')}
                // onRefresh={() => refreshPanel('our-jobs')}
                // onClose={() => closePanel('our-jobs')}
              >
                <div className="border border-gray-200 rounded">
                  {visibleFields.ourJobs.includes("jobs") && (
                    <div className="p-2">
                      <p className="text-gray-500 italic">No open jobs</p>
                    </div>
                  )}
                </div>
              </PanelWithHeader>

              {/* Open Tasks */}
              <PanelWithHeader title="Open Tasks:">
                <div className="border border-gray-200 rounded">
                  {isLoadingTasks ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : tasksError ? (
                    <div className="p-2 text-red-500 text-sm">{tasksError}</div>
                  ) : tasks.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() =>
                            router.push(`/dashboard/tasks/view?id=${task.id}`)
                          }
                        >
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-medium text-blue-600 hover:underline">
                              {task.title}
                            </h4>
                            {task.priority && (
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  task.priority === "High"
                                    ? "bg-red-100 text-red-800"
                                    : task.priority === "Medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {task.priority}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <div className="flex space-x-3">
                              {task.due_date && (
                                <span>
                                  Due:{" "}
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                              {task.assigned_to_name && (
                                <span>
                                  Assigned to: {task.assigned_to_name}
                                </span>
                              )}
                            </div>
                            {task.status && (
                              <span className="text-gray-600">
                                {task.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 italic">
                      No open tasks
                    </div>
                  )}
                </div>
              </PanelWithHeader>
            </div>
          </div>
        )}

        {/* Modify Tab */}
        {activeTab === "modify" && renderModifyTab()}

        {/* Notes Tab */}
        {activeTab === "notes" && renderNotesTab()}

        {/* History Tab */}
        {activeTab === "history" && renderHistoryTab()}

        {/* Placeholder for other tabs */}
        {activeTab === "quotes" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Quotes</h2>
            <p className="text-gray-500 italic">No quotes available</p>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Invoices</h2>
            <p className="text-gray-500 italic">No invoices available</p>
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Organization Contacts (Hiring Managers)
              </h2>
              <button
                onClick={() => handleActionSelected("add-hiring-manager")}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Add Hiring Manager
              </button>
            </div>

            {isLoadingHiringManagers ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : hiringManagersError ? (
              <div className="text-red-500 py-2">{hiringManagersError}</div>
            ) : hiringManagers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Phone</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hiringManagers.map((hm) => (
                      <tr key={hm.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <button
                            onClick={() =>
                              router.push(
                                `/dashboard/hiring-managers/view?id=${hm.id}`
                              )
                            }
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {hm.full_name || `${hm.first_name} ${hm.last_name}`}
                          </button>
                        </td>
                        <td className="p-3">{hm.title || "-"}</td>
                        <td className="p-3">
                          <a
                            href={`mailto:${hm.email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {hm.email || "-"}
                          </a>
                        </td>
                        <td className="p-3">{hm.phone || "-"}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              hm.status === "Active"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {hm.status || "Active"}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() =>
                              router.push(
                                `/dashboard/hiring-managers/view?id=${hm.id}`
                              )
                            }
                            className="text-blue-500 hover:text-blue-700 text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 italic mb-4">
                  No hiring managers have been added to this organization yet.
                </p>
                <button
                  onClick={() => handleActionSelected("add-hiring-manager")}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add First Hiring Manager
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "docs" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Documents</h2>
              <button
                onClick={() => setShowAddDocument(true)}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Add Document
              </button>
            </div>

            {/* Add Document Form */}
            {showAddDocument && (
              <div className="mb-6 p-4 bg-gray-50 rounded border">
                <h3 className="font-medium mb-2">Add New Document</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Document Name *
                    </label>
                    <input
                      type="text"
                      value={newDocumentName}
                      onChange={(e) => setNewDocumentName(e.target.value)}
                      placeholder="Enter document name"
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Document Type
                    </label>
                    <select
                      value={newDocumentType}
                      onChange={(e) => setNewDocumentType(e.target.value)}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="General">General</option>
                      <option value="Contract">Contract</option>
                      <option value="Agreement">Agreement</option>
                      <option value="Policy">Policy</option>
                      <option value="Welcome">Welcome</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Content
                    </label>
                    <textarea
                      value={newDocumentContent}
                      onChange={(e) => setNewDocumentContent(e.target.value)}
                      placeholder="Enter document content..."
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={6}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-3">
                  <button
                    onClick={() => setShowAddDocument(false)}
                    className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddDocument}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    disabled={!newDocumentName.trim()}
                  >
                    Save Document
                  </button>
                </div>
              </div>
            )}

            {/* Documents List */}
            {isLoadingDocuments ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : documentError ? (
              <div className="text-red-500 py-2">{documentError}</div>
            ) : documents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3 font-medium">
                        Document Name
                      </th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">
                        Auto-Generated
                      </th>
                      <th className="text-left p-3 font-medium">Created By</th>
                      <th className="text-left p-3 font-medium">Created At</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <button
                            onClick={() => setSelectedDocument(doc)}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {doc.document_name}
                          </button>
                        </td>
                        <td className="p-3">{doc.document_type}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              doc.is_auto_generated
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {doc.is_auto_generated ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="p-3">
                          {doc.created_by_name || "System"}
                        </td>
                        <td className="p-3">
                          {new Date(doc.created_at).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic">No documents available</p>
            )}

            {/* Document Viewer Modal */}
            {selectedDocument && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                  <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {selectedDocument.document_name}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Type: {selectedDocument.document_type}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDocument(null)}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <span className="text-2xl font-bold">×</span>
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        Created by{" "}
                        {selectedDocument.created_by_name || "System"} on{" "}
                        {new Date(selectedDocument.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border whitespace-pre-wrap">
                      {selectedDocument.content || "No content available"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "jobs" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Organization Jobs</h2>
              <button
                onClick={() => handleActionSelected("add-job")}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Add Job
              </button>
            </div>

            {isLoadingJobs ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : jobsError ? (
              <div className="text-red-500 py-2">{jobsError}</div>
            ) : jobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3 font-medium">Job Title</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Location</th>
                      <th className="text-left p-3 font-medium">Employment Type</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job: any) => (
                      <tr key={job.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <button
                            onClick={() =>
                              router.push(`/dashboard/jobs/view?id=${job.id}`)
                            }
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {job.job_title || "Untitled Job"}
                          </button>
                        </td>
                        <td className="p-3">{job.category || "-"}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              job.status === "Open"
                                ? "bg-green-100 text-green-800"
                                : job.status === "On Hold"
                                ? "bg-yellow-100 text-yellow-800"
                                : job.status === "Filled"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {job.status || "Open"}
                          </span>
                        </td>
                        <td className="p-3">{job.worksite_location || "-"}</td>
                        <td className="p-3">{job.employment_type || "-"}</td>
                        <td className="p-3">
                          <button
                            onClick={() =>
                              router.push(`/dashboard/jobs/view?id=${job.id}`)
                            }
                            className="text-blue-500 hover:text-blue-700 text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 italic mb-4">
                  No jobs have been added to this organization yet.
                </p>
                <button
                  onClick={() => handleActionSelected("add-job")}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add First Job
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "opportunities" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
            <p className="text-gray-500 italic">No opportunities available</p>
          </div>
        )}
      </div>

      {/* Edit Fields Modal */}
      {editingPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Edit Fields - {editingPanel}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-medium mb-3">
                  Available Fields from Modify Page:
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                  {isLoadingFields ? (
                    <div className="text-center py-4 text-gray-500">
                      Loading fields...
                    </div>
                  ) : availableFields.length > 0 ? (
                    availableFields.map((field) => {
                      const fieldKey =
                        field.field_name || field.field_label || field.id;
                      const isVisible =
                        visibleFields[editingPanel]?.includes(fieldKey) ||
                        false;
                      return (
                        <div
                          key={field.id || fieldKey}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() =>
                                toggleFieldVisibility(editingPanel, fieldKey)
                              }
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm text-gray-700">
                              {field.field_label ||
                                field.field_name ||
                                fieldKey}
                            </label>
                          </div>
                          <span className="text-xs text-gray-500">
                            {field.field_type || "text"}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>No custom fields available</p>
                      <p className="text-xs mt-1">
                        Fields from the modify page will appear here
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-medium mb-3">Standard Fields:</h3>
                <div className="space-y-2 border border-gray-200 rounded p-3">
                  {(() => {
                    const standardFieldsMap: Record<
                      string,
                      Array<{ key: string; label: string }>
                    > = {
                      contactInfo: [
                        { key: "name", label: "Name" },
                        { key: "nickname", label: "Nickname" },
                        { key: "phone", label: "Phone" },
                        { key: "address", label: "Address" },
                        { key: "website", label: "Website" },
                      ],
                      about: [{ key: "about", label: "About" }],
                      recentNotes: [{ key: "notes", label: "Notes" }],
                      websiteJobs: [{ key: "jobs", label: "Jobs" }],
                      ourJobs: [{ key: "jobs", label: "Jobs" }],
                    };

                    const fields = standardFieldsMap[editingPanel] || [];
                    return fields.map((field) => {
                      const isVisible =
                        visibleFields[editingPanel]?.includes(field.key) ||
                        false;
                      return (
                        <div
                          key={field.key}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() =>
                                toggleFieldVisibility(editingPanel, field.key)
                              }
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm text-gray-700">
                              {field.label}
                            </label>
                          </div>
                          <span className="text-xs text-gray-500">
                            standard
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <button
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Image src="/file.svg" alt="Note" width={20} height={20} />
                <h2 className="text-lg font-semibold">Add Note</h2>
              </div>
              <button
                onClick={handleCloseAddNoteModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {/* Note Text Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Text
                  </label>
                  <textarea
                    value={noteForm.text}
                    onChange={(e) =>
                      setNoteForm((prev) => ({ ...prev, text: e.target.value }))
                    }
                    placeholder="Enter your note text here. Reference people and distribution lists using @ (e.g. @John Smith). Reference other records using # (e.g. #Project Manager)."
                    className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                  />
                </div>

                {/* About Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    About
                  </label>
                  <div className="relative">
                    <div className="flex items-center border border-gray-300 rounded p-2 bg-white">
                      <div className="w-6 h-6 rounded-full bg-orange-400 mr-2 flex-shrink-0"></div>
                      <span className="flex-1 text-sm">{noteForm.about}</span>
                      <button
                        onClick={() =>
                          setNoteForm((prev) => ({ ...prev, about: "" }))
                        }
                        className="ml-2 text-gray-500 hover:text-gray-700 text-xs"
                      >
                        CLEAR ALL X
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional References Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional References
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={noteForm.additionalReferences}
                      onChange={(e) =>
                        setNoteForm((prev) => ({
                          ...prev,
                          additionalReferences: e.target.value,
                        }))
                      }
                      placeholder="Reference other records using #"
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                    />
                    <span className="absolute right-2 top-2 text-gray-400 text-sm">
                      Q
                    </span>
                  </div>
                </div>

                {/* Email Notification Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <span className="mr-2">📧</span>
                    Email Notification
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={noteForm.emailNotification}
                      onChange={(e) =>
                        setNoteForm((prev) => ({
                          ...prev,
                          emailNotification: e.target.value,
                        }))
                      }
                      placeholder="Internal User"
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                <button
                  onClick={handleCloseAddNoteModal}
                  className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 font-medium"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleAddNote}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!noteForm.text.trim()}
                >
                  SAVE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Tearsheet Modal */}
      {showAddTearsheetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Tearsheets</h2>
              <button
                onClick={() => {
                  setShowAddTearsheetModal(false);
                  setTearsheetForm({ name: "", visibility: "Existing" });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Tearsheet Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500 mr-1">•</span>
                  Tearsheet name
                </label>
                <input
                  type="text"
                  value={tearsheetForm.name}
                  onChange={(e) =>
                    setTearsheetForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter tearsheet name"
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visibility
                </label>
                <div
                  className="inline-flex rounded-md border border-gray-300 overflow-hidden"
                  role="group"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setTearsheetForm((prev) => ({
                        ...prev,
                        visibility: "New",
                      }))
                    }
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      tearsheetForm.visibility === "New"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-700 border-r border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    New
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTearsheetForm((prev) => ({
                        ...prev,
                        visibility: "Existing",
                      }))
                    }
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      tearsheetForm.visibility === "Existing"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Existing
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowAddTearsheetModal(false);
                  setTearsheetForm({ name: "", visibility: "Existing" });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSavingTearsheet}
              >
                BACK
              </button>
              <button
                onClick={handleTearsheetSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                disabled={isSavingTearsheet || !tearsheetForm.name.trim()}
              >
                SAVE
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header Fields Modal */}
      {showHeaderFieldModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Customize Header Fields</h2>
              <button
                onClick={() => setShowHeaderFieldModal(false)}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-6">
              {/* Left: available fields */}
              <div>
                <h3 className="font-medium mb-3">Available Fields</h3>
                <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                  {headerFieldCatalog.map((f) => {
                    const checked = headerFields.includes(f.key);
                    return (
                      <label
                        key={f.key}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setHeaderFields((prev) => {
                              if (prev.includes(f.key))
                                return prev.filter((x) => x !== f.key);
                              return [...prev, f.key];
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-800">{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Right: selected + reorder */}
              <div>
                <h3 className="font-medium mb-3">Header Order</h3>
                <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                  {headerFields.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">
                      No fields selected
                    </div>
                  ) : (
                    headerFields.map((key, idx) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {getHeaderFieldLabel(key)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Value: {getHeaderFieldValue(key)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                            disabled={idx === 0}
                            onClick={() => {
                              setHeaderFields((prev) => {
                                const copy = [...prev];
                                [copy[idx - 1], copy[idx]] = [
                                  copy[idx],
                                  copy[idx - 1],
                                ];
                                return copy;
                              });
                            }}
                          >
                            ↑
                          </button>
                          <button
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                            disabled={idx === headerFields.length - 1}
                            onClick={() => {
                              setHeaderFields((prev) => {
                                const copy = [...prev];
                                [copy[idx], copy[idx + 1]] = [
                                  copy[idx + 1],
                                  copy[idx],
                                ];
                                return copy;
                              });
                            }}
                          >
                            ↓
                          </button>
                          <button
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                            onClick={() =>
                              setHeaderFields((prev) =>
                                prev.filter((x) => x !== key)
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                    onClick={() => setHeaderFields(DEFAULT_HEADER_FIELDS)}
                  >
                    Reset
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={() => setShowHeaderFieldModal(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
