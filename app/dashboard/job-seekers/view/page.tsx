"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import LoadingScreen from "@/components/LoadingScreen";
import PanelWithHeader from "@/components/PanelWithHeader";
import { FaLinkedin, FaFacebookSquare } from "react-icons/fa";
import { sendEmailViaOffice365, isOffice365Authenticated, initializeOffice365Auth, sendCalendarInvite, type EmailMessage, type CalendarEvent } from "@/lib/office365";
import { FiUsers, FiUpload, FiFile, FiX } from "react-icons/fi";
import { TbGripVertical } from "react-icons/tb";
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import OnboardingTab from "./onboarding/OnboardingTab";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable Panel Component with drag handle
function SortablePanel({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 p-1 bg-gray-100 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <TbGripVertical className="w-5 h-5 text-gray-600" />
      </button>
      {children}
    </div>
  );
}

export default function JobSeekerView() {
  const router = useRouter();
  const searchParams = useSearchParams();
    const jobSeekerId = searchParams.get("id");

  const [activeTab, setActiveTab] = useState("summary");
  const [activeQuickTab, setActiveQuickTab] = useState("prescreen");

  // Add states for job seeker data
  const [jobSeeker, setJobSeeker] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes and history state
  const [notes, setNotes] = useState<Array<any>>([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Add Note form state
  const [noteForm, setNoteForm] = useState({
    text: "",
    action: "",
    about: jobSeeker
      ? `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.fullName}`
      : "",
    copyNote: "No",
    replaceGeneralContactComments: false,
    additionalReferences: "",
    scheduleNextAction: "None",
    emailNotification: "Internal User",
  });
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isOffice365Connected, setIsOffice365Connected] = useState(false);
  
  // Action fields state (for dynamic dropdown options)
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>({
    resume: ["profile", "skills", "experience"],
    overview: [
      "status",
      "currentOrganization",
      "title",
      "email",
      "mobilePhone",
    ],
    jobSeekerDetails: [
      "status",
      "currentOrganization",
      "title",
      "email",
      "mobilePhone",
      "address",
      "desiredSalary",
      "dateAdded",
      "lastContactDate",
      "owner",
    ],
  });

  // Panel order state for drag-and-drop
  const [panelOrder, setPanelOrder] = useState<string[]>([
    "resume",
    "overview",
    "jobSeekerDetails",
    "recentNotes",
    "openTasks",
  ]);
  // ===== PENCIL-HEADER-MODAL (Job Seeker Header Fields) =====

  type HeaderFieldDef = {
    key: string;
    label: string;
    type: "standard" | "custom";
  };

  // Standard fields you want to allow in the header row
  const STANDARD_HEADER_FIELDS: HeaderFieldDef[] = [
    { key: "phone", label: "Phone", type: "standard" },
    { key: "email", label: "Email", type: "standard" },
    { key: "status", label: "Status", type: "standard" },
    { key: "currentOrganization", label: "Current Org", type: "standard" },
    { key: "title", label: "Title", type: "standard" },
    { key: "mobilePhone", label: "Mobile", type: "standard" },
    { key: "fullAddress", label: "Address", type: "standard" },
    { key: "desiredSalary", label: "Desired Salary", type: "standard" },
    { key: "dateAdded", label: "Date Added", type: "standard" },
    { key: "lastContactDate", label: "Last Contact", type: "standard" },
    { key: "owner", label: "Owner", type: "standard" },
  ];

  // default layout if nothing saved
  const DEFAULT_HEADER_FIELDS = [
    "phone",
    "email",
    "status",
    "currentOrganization",
    "title",
  ];

  const {
    headerFields,
    setHeaderFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    saveHeaderConfig,
  } = useHeaderConfig({
    entityType: "JOB_SEEKER",
    configType: "header",
    defaultFields: DEFAULT_HEADER_FIELDS,
  });

  // Build definitions list (standard + custom from availableFields/jobSeeker.customFields)
  const headerFieldDefs: HeaderFieldDef[] = (() => {
    const customKeys = new Set<string>();

    // Prefer availableFields (from modify page)
    (availableFields || []).forEach((f: any) => {
      const k = f.field_name || f.field_label || f.id;
      if (k) customKeys.add(String(k));
    });

    // Also include any custom keys present on the record
    if (jobSeeker?.customFields) {
      Object.keys(jobSeeker.customFields).forEach((k) =>
        customKeys.add(String(k))
      );
    }

    const customDefs: HeaderFieldDef[] = Array.from(customKeys).map((k) => {
      const found = (availableFields || []).find((f: any) => {
        const fk = f.field_name || f.field_label || f.id;
        return String(fk) === k;
      });
      const label = found?.field_label || found?.field_name || k;
      return { key: k, label, type: "custom" };
    });

    // keep stable ordering
    customDefs.sort((a, b) => a.label.localeCompare(b.label));

    return [...STANDARD_HEADER_FIELDS, ...customDefs];
  })();


  const getHeaderValue = (key: string): string => {
    if (!jobSeeker) return "-";

    // standard keys live on jobSeeker directly
    const std = (jobSeeker as any)[key];
    if (std !== undefined && std !== null && String(std).trim() !== "")
      return String(std);

    // custom keys live in jobSeeker.customFields
    const custom = jobSeeker.customFields?.[key];
    if (custom !== undefined && custom !== null && String(custom).trim() !== "")
      return String(custom);

    return "-";
  };

  const labelForHeaderKey = (key: string) => {
    const def = headerFieldDefs.find((d) => d.key === key);
    return def?.label || key;
  };

  const toggleHeaderField = (key: string) => {
    setHeaderFields((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const moveHeaderField = (key: string, dir: "up" | "down") => {
    setHeaderFields((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;

      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;

      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const removeHeaderField = (key: string) => {
    setHeaderFields((prev) => prev.filter((k) => k !== key));
  };

  const resetHeaderFields = () => {
    setHeaderFields(DEFAULT_HEADER_FIELDS);
  };

  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<Array<any>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tearsheet modal state
  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);
  const [tearsheetForm, setTearsheetForm] = useState({
    name: "",
    visibility: "Existing", // 'New' or 'Existing'
  });
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);

  // Calendar appointment modal state
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    date: "",
    time: "",
    type: "",
    description: "",
    location: "",
    duration: 30,
    attendees: [] as string[], // Array of user IDs/emails
    sendInvites: true,
  });
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [appointmentUsers, setAppointmentUsers] = useState<any[]>([]);
  const [isLoadingAppointmentUsers, setIsLoadingAppointmentUsers] = useState(false);

  // Onboarding send modal state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Record<string, boolean>>({});
  const onboardingDocs = [
    {
      id: "w4",
      name: "W-4 (Employee's Withholding Certificate)",
      url: "/docs/onboarding/W-4.pdf",
    },
    {
      id: "i9",
      name: "I-9 (Employment Eligibility Verification)",
      url: "/docs/onboarding/I-9.pdf",
    },
    {
      id: "dd",
      name: "Direct Deposit Authorization",
      url: "/docs/onboarding/Direct-Deposit.pdf",
    },
    {
      id: "policy",
      name: "Company Policies Acknowledgement",
      url: "/docs/onboarding/Policies.pdf",
    },
  ];

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendOnboarding = async () => {
    if (!jobSeeker?.email) {
      alert("Job seeker email is missing");
      return;
    }

    const chosen = onboardingDocs.filter((d) => selectedDocs[d.id]);
    const subject = "Onboarding Documents";
    const links =
      chosen.length > 0
        ? "\n\nDocuments:\n" +
          chosen
            .map((d) => `- ${d.name}: ${window.location.origin}${d.url}`)
            .join("\n")
        : "";
    const body =
      "Here are your onboarding documents. Please fill these out and return promptly." +
      links;

    // Use Office 365 if connected, otherwise use mailto
    if (isOffice365Connected) {
      try {
        const emailMessage: EmailMessage = {
          to: [jobSeeker.email],
          subject: subject,
          body: body,
          bodyType: "text",
        };
        await sendEmailViaOffice365(emailMessage);
        alert("Onboarding documents sent successfully via Office 365!");
        setShowOnboardingModal(false);
        setSelectedDocs({});
      } catch (error: any) {
        alert(
          `Failed to send via Office 365: ${error.message}. Falling back to mailto.`
        );
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);
        window.location.href = `mailto:${jobSeeker.email}?subject=${encodedSubject}&body=${encodedBody}`;
        setShowOnboardingModal(false);
        setSelectedDocs({});
      }
    } else {
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      window.location.href = `mailto:${jobSeeker.email}?subject=${encodedSubject}&body=${encodedBody}`;
      setShowOnboardingModal(false);
      setSelectedDocs({});
    }
  };

  // Reference form send modal state
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [selectedReferenceDocs, setSelectedReferenceDocs] = useState<
    Record<string, boolean>
  >({});
  const [referenceEmail, setReferenceEmail] = useState("");
  const referenceDocs = [
    {
      id: "reference-form",
      name: "Reference Request Form",
      url: "/docs/references/Reference-Form.pdf",
    },
    {
      id: "background-check",
      name: "Background Check Authorization",
      url: "/docs/references/Background-Check.pdf",
    },
    {
      id: "employment-verification",
      name: "Employment Verification Form",
      url: "/docs/references/Employment-Verification.pdf",
    },
  ];

  const toggleReferenceDoc = (id: string) => {
    setSelectedReferenceDocs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendReferenceForm = async () => {
    if (!referenceEmail || !referenceEmail.trim()) {
      alert("Please enter a reference email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(referenceEmail.trim())) {
      alert("Please enter a valid email address");
      return;
    }

    const chosen = referenceDocs.filter((d) => selectedReferenceDocs[d.id]);
    const subject = "Reference Request";
    const links =
      chosen.length > 0
        ? "\n\nPlease review and complete the following documents:\n" +
          chosen
            .map((d) => `- ${d.name}: ${window.location.origin}${d.url}`)
            .join("\n")
        : "";
    const body = `Dear Reference,

We are requesting a reference for ${
      jobSeeker?.fullName || "a candidate"
    }. Please review and complete the attached reference documents at your earliest convenience.${links}

Thank you for your time and assistance.

Best regards`;

    // Use Office 365 if connected, otherwise use mailto
    if (isOffice365Connected) {
      try {
        const emailMessage: EmailMessage = {
          to: [referenceEmail.trim()],
          subject: subject,
          body: body,
          bodyType: "text",
        };
        await sendEmailViaOffice365(emailMessage);
        alert("Reference form sent successfully via Office 365!");
        setShowReferenceModal(false);
        setReferenceEmail("");
        setSelectedReferenceDocs({});
      } catch (error: any) {
        alert(
          `Failed to send via Office 365: ${error.message}. Falling back to mailto.`
        );
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);
        window.location.href = `mailto:${referenceEmail.trim()}?subject=${encodedSubject}&body=${encodedBody}`;
        setShowReferenceModal(false);
        setReferenceEmail("");
        setSelectedReferenceDocs({});
      }
    } else {
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      window.location.href = `mailto:${referenceEmail.trim()}?subject=${encodedSubject}&body=${encodedBody}`;
      setShowReferenceModal(false);
      setReferenceEmail("");
      setSelectedReferenceDocs({});
    }
  };


  // Load panel order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem("jobSeekerSummaryPanelOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPanelOrder(parsed);
        }
      } catch (e) {
        console.error("Error parsing saved panel order:", e);
      }
    }
  }, []);

  // Save panel order to localStorage when it changes
  useEffect(() => {
    if (panelOrder.length > 0) {
      localStorage.setItem("jobSeekerSummaryPanelOrder", JSON.stringify(panelOrder));
    }
  }, [panelOrder]);

  // Handle drag end for panel reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Fetch job seeker when component mounts
  useEffect(() => {
    if (jobSeekerId) {
      fetchJobSeeker(jobSeekerId);
    }
  }, [jobSeekerId]);

  // Fetch available fields after job seeker is loaded
  useEffect(() => {
    if (jobSeeker && jobSeekerId) {
      fetchAvailableFields();
      // Update note form about field when job seeker is loaded
      setNoteForm((prev) => ({
        ...prev,
        about: `${jobSeeker.id} ${jobSeeker.fullName}`,
      }));
      // Fetch documents when job seeker is loaded
      fetchDocuments(jobSeekerId);
    }
  }, [jobSeeker, jobSeekerId]);

  // Fetch users for email notification
  useEffect(() => {
    if (showAddNote) {
      fetchUsers();
      fetchActionFields();
    }
  }, [showAddNote]);

  // Fetch users for appointment attendees
  useEffect(() => {
    if (showAppointmentModal) {
      fetchAppointmentUsers();
    }
  }, [showAppointmentModal]);

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
      const response = await fetch("/api/admin/field-management/job-seekers");
      if (response.ok) {
        const data = await response.json();
        const fields = data.fields || [];
        setAvailableFields(fields);

        // Add custom fields to visible fields if they have values
        if (jobSeeker && jobSeeker.customFields) {
          const customFieldKeys = Object.keys(jobSeeker.customFields);
          customFieldKeys.forEach((fieldKey) => {
            if (!visibleFields.jobSeekerDetails.includes(fieldKey)) {
              setVisibleFields((prev) => ({
                ...prev,
                jobSeekerDetails: [...prev.jobSeekerDetails, fieldKey],
              }));
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

  // Fetch action fields (custom fields from Job Seekers field management)
  const fetchActionFields = async () => {
    setIsLoadingActionFields(true);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch("/api/admin/field-management/job-seekers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Get custom fields from the response - handle both response structures
        const fields = data.customFields || data.fields || [];
        // Sort by sort_order if available
        const sortedFields = fields.sort((a: any, b: any) => 
          (a.sort_order || 0) - (b.sort_order || 0)
        );
        setActionFields(sortedFields);
      }
    } catch (err) {
      console.error("Error fetching action fields:", err);
    } finally {
      setIsLoadingActionFields(false);
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

  // Fetch documents for the job seeker
  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);

    try {
      const response = await fetch(`/api/job-seekers/${id}/documents`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
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

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0 && jobSeekerId) {
      handleFileUpload(droppedFiles[0]);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && jobSeekerId) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!jobSeekerId) return;

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size should be less than 10MB");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_name", file.name);
      formData.append("document_type", "General");

      const response = await fetch(
        `/api/job-seekers/${jobSeekerId}/documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload document");
      }

      const data = await response.json();

      // Add the new document to the list
      setDocuments([data.document, ...documents]);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      alert("Document uploaded successfully");
    } catch (err) {
      console.error("Error uploading document:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while uploading the document";
      setUploadError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle delete document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(
        `/api/job-seekers/${jobSeekerId}/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
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

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Function to fetch job seeker data with better error handling
  const fetchJobSeeker = async (id: string) => {
    setIsLoading(true);
    setError(null);

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

      console.log(`API Response status: ${response.status}`);

      // Handle non-JSON responses
      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch (error) {
        // Properly type the error to access the message property
        const parseError = error as Error;
        console.error("Error parsing response:", parseError);
        console.error("Raw response:", responseText.substring(0, 200));
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to fetch job seeker: ${response.status}`
        );
      }

      console.log("Job seeker data received:", data);

      // Validate job seeker data
      if (!data.jobSeeker) {
        throw new Error("No job seeker data received from API");
      }

      // Process the job seeker data
      const jobSeekerData = data.jobSeeker;

      // Create a resume object based on the job seeker's data
      const resume = {
        profile:
          jobSeekerData.resume_text || "No profile information available",
        experience: [], // Would be populated from a formatted resume if available
      };

      // Format the job seeker data with default values for all fields
      const formattedJobSeeker = {
        id: jobSeekerData.id || "Unknown ID",
        firstName: jobSeekerData.first_name || "",
        lastName: jobSeekerData.last_name || "",
        fullName:
          jobSeekerData.full_name ||
          `${jobSeekerData.last_name}, ${jobSeekerData.first_name}`,
        email: jobSeekerData.email || "No email provided",
        phone: jobSeekerData.phone || "No phone provided",
        mobilePhone:
          jobSeekerData.mobile_phone ||
          jobSeekerData.phone ||
          "No phone provided",
        address: jobSeekerData.address || "No address provided",
        city: jobSeekerData.city || "",
        state: jobSeekerData.state || "",
        zip: jobSeekerData.zip || "",
        fullAddress: formatAddress(jobSeekerData),
        status: jobSeekerData.status || "New lead",
        currentOrganization:
          jobSeekerData.current_organization || "Not specified",
        title: jobSeekerData.title || "Not specified",
        dateAdded: jobSeekerData.date_added
          ? formatDate(jobSeekerData.date_added)
          : "Unknown",
        lastContactDate: jobSeekerData.last_contact_date
          ? formatDate(jobSeekerData.last_contact_date)
          : "Never contacted",
        owner: jobSeekerData.owner || "Not assigned",
        skills: jobSeekerData.skills
          ? jobSeekerData.skills.split(",").map((skill: string) => skill.trim())
          : [],
        desiredSalary: jobSeekerData.desired_salary || "Not specified",
        resume: resume,
        customFields: jobSeekerData.custom_fields || {},
      };

      console.log("Formatted job seeker data:", formattedJobSeeker);
      setJobSeeker(formattedJobSeeker);

      // Now fetch notes, history, documents, and tasks
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
      fetchTasks(id);
    } catch (err) {
      console.error("Error fetching job seeker:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching job seeker details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format the complete address
  function formatAddress(data: any): string {
    const addressParts = [];
    if (data.address) addressParts.push(data.address);

    const cityStateParts = [];
    if (data.city) cityStateParts.push(data.city);
    if (data.state) cityStateParts.push(data.state);
    if (cityStateParts.length > 0) addressParts.push(cityStateParts.join(", "));

    if (data.zip) addressParts.push(data.zip);

    return addressParts.length > 0
      ? addressParts.join(", ")
      : "No address provided";
  }

  // Format date function
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  // Fetch notes for the job seeker
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);

    try {
      const response = await fetch(`/api/job-seekers/${id}/notes`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notes");
      }

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Fetch history for the job seeker
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);

    try {
      const response = await fetch(`/api/job-seekers/${id}/history`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch tasks for the job seeker (only non-completed tasks)
  const fetchTasks = async (jobSeekerId: string) => {
    setIsLoadingTasks(true);
    setTasksError(null);

    try {
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
      // 2. Related to this job seeker by task.job_seeker_id == jobSeekerId
      const jobSeekerTasks = (tasksData.tasks || []).filter((task: any) => {
        // Exclude completed tasks
        if (task.is_completed === true || task.status === "Completed") {
          return false;
        }

        // Check if task is related to this job seeker
        const taskJobSeekerId = task.job_seeker_id?.toString();
        return taskJobSeekerId && taskJobSeekerId === jobSeekerId.toString();
      });

      setTasks(jobSeekerTasks);
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

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!noteForm.text.trim() || !jobSeekerId) return;

    try {
      const requestBody = {
        text: noteForm.text,
        note_type: noteForm.action || "General Note", // Map action to note_type for backend
        // Backend only uses text and note_type, but we can send other fields for future use
        action: noteForm.action,
        copy_note: noteForm.copyNote === "Yes",
        replace_general_contact_comments:
          noteForm.replaceGeneralContactComments,
        additional_references: noteForm.additionalReferences,
        schedule_next_action: noteForm.scheduleNextAction,
        email_notification: noteForm.emailNotification,
      };

      console.log("Adding note for job seeker:", jobSeekerId);
      console.log("Request body:", requestBody);

      const response = await fetch(`/api/job-seekers/${jobSeekerId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      // Get response as text first for debugging
      const responseText = await response.text();
      let data;
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        console.error("Raw response:", responseText);
        throw new Error("Invalid response format from server");
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to add note");
      }

      // Add the new note to the list
      // Handle both response structures: { note } or { success: true, note }
      const newNote = data.note || data;
      if (newNote) {
        setNotes([newNote, ...notes]);
      }

      // Clear the form
      setNoteForm({
        text: "",
        action: "",
        about: jobSeeker
          ? `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.fullName}`
          : "",
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: "",
        scheduleNextAction: "None",
        emailNotification: "Internal User",
      });
      setShowAddNote(false);

      // Refresh history and notes
      fetchHistory(jobSeekerId);
      fetchNotes(jobSeekerId);

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
      action: "",
      about: jobSeeker
        ? `${formatRecordId(jobSeeker.id, "jobSeeker")} ${jobSeeker.fullName}`
        : "",
      copyNote: "No",
      replaceGeneralContactComments: false,
      additionalReferences: "",
      scheduleNextAction: "None",
      emailNotification: "Internal User",
    });
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleEdit = () => {
    if (jobSeekerId) {
      router.push(`/dashboard/job-seekers/add?id=${jobSeekerId}`);
    }
  };

  // Check Office 365 connection on mount
  useEffect(() => {
    const checkConnection = () => {
      const connected = isOffice365Authenticated();
      setIsOffice365Connected(connected);
    };
    checkConnection();
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("msal_access_token");
      if (token) setIsOffice365Connected(true);
    }
  }, []);

  // Fetch users for appointment attendees
  const fetchAppointmentUsers = async () => {
    setIsLoadingAppointmentUsers(true);
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
        setAppointmentUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingAppointmentUsers(false);
    }
  };

  const handleActionSelected = async (action: string) => {
    console.log(`Action selected: ${action}`);
    if (action === "edit") {
      handleEdit();
    } else if (action === "delete" && jobSeekerId) {
      handleDelete(jobSeekerId);
    } else if (action === "add-note") {
      setShowAddNote(true);
      setActiveTab("notes");
    } else if (action === "add-task") {
      // Navigate to add task page with job seeker context
      if (jobSeekerId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=job_seeker&relatedEntityId=${jobSeekerId}`
        );
      }
    } else if (action === "email") {
      // Open default email application with mailto link
      if (!jobSeeker?.email || jobSeeker.email === "No email provided") {
        alert("Job seeker email not available");
        return;
      }

      // Use mailto link to open default email application (e.g., Outlook Desktop)
      window.location.href = `mailto:${jobSeeker.email}`;
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else if (action === "add-appointment") {
      setShowAppointmentModal(true);
      // Pre-fill job seeker email if available
      if (jobSeeker?.email && jobSeeker.email !== "No email provided") {
        setAppointmentForm((prev) => ({
          ...prev,
          attendees: [jobSeeker.email],
        }));
      }
    }
  };

  // Handle appointment submission
  const handleAppointmentSubmit = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.type) {
      alert("Please fill in all required fields (Date, Time, Type)");
      return;
    }

    if (!jobSeekerId) {
      alert("Job Seeker ID is missing");
      return;
    }

    setIsSavingAppointment(true);

    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );

      // Create appointment in planner
      const response = await fetch("/api/planner/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: appointmentForm.date,
          time: appointmentForm.time,
          type: appointmentForm.type,
          description: appointmentForm.description,
          location: appointmentForm.location,
          duration: appointmentForm.duration,
          jobSeekerId: jobSeekerId,
          client: jobSeeker?.fullName || jobSeeker?.name || "",
          attendees: appointmentForm.attendees,
          sendInvites: appointmentForm.sendInvites,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create appointment";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `HTTP ${response.status}: ${response.statusText || "Failed to create appointment"}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Send calendar invites if requested
      if (appointmentForm.sendInvites && appointmentForm.attendees.length > 0) {
        try {
          // Combine date and time
          const [hours, minutes] = appointmentForm.time.split(':');
          const appointmentDate = new Date(appointmentForm.date);
          appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          const endDate = new Date(appointmentDate);
          endDate.setMinutes(endDate.getMinutes() + appointmentForm.duration);

          const calendarEvent: CalendarEvent = {
            subject: `${appointmentForm.type} - ${jobSeeker?.fullName || jobSeeker?.name || 'Job Seeker'}`,
            start: {
              dateTime: appointmentDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            body: {
              contentType: 'Text',
              content: appointmentForm.description || `Appointment: ${appointmentForm.type}`,
            },
            location: appointmentForm.location ? {
              displayName: appointmentForm.location,
            } : undefined,
          };

          await sendCalendarInvite(calendarEvent, appointmentForm.attendees);
        } catch (inviteError) {
          console.error("Error sending calendar invites:", inviteError);
          // Don't fail the appointment creation if invites fail
          alert("Appointment created, but calendar invites failed to send. Please send manually.");
        }
      }

      alert("Appointment created successfully!");
      setShowAppointmentModal(false);
      setAppointmentForm({
        date: "",
        time: "",
        type: "",
        description: "",
        location: "",
        duration: 30,
        attendees: [],
        sendInvites: true,
      });
    } catch (err) {
      console.error("Error creating appointment:", err);
      alert(err instanceof Error ? err.message : "Failed to create appointment. Please try again.");
    } finally {
      setIsSavingAppointment(false);
    }
  };

  // Handle tearsheet submission
  const handleTearsheetSubmit = async () => {
    if (!tearsheetForm.name.trim()) {
      alert("Please enter a tearsheet name");
      return;
    }

    if (!jobSeekerId) {
      alert("Job Seeker ID is missing");
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
          job_seeker_id: jobSeekerId,
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

  // Print handler: ensure Summary tab (with Job Seeker Details) is active when printing
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

  // Handle job seeker deletion
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job seeker?")) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/job-seekers/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete job seeker");
      }

      // Redirect to the job seekers list
      router.push("/dashboard/job-seekers");
    } catch (error) {
      console.error("Error deleting job seeker:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while deleting the job seeker"
      );
      setIsLoading(false);
    }
  };

  const actionOptions = [
    { label: "Add Note", action: () => setShowAddNote(true) },
    { label: "Send Email", action: () => handleActionSelected("email") },
    {
      label: "Add Appointment",
      action: () => handleActionSelected("add-appointment"),
    },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
    {
      label: "Add Tearsheet",
      action: () => handleActionSelected("add-tearsheet"),
    },
    {
      label: "Password Reset",
      action: () => handleActionSelected("password-reset"),
    },
    // { label: "Edit", action: () => handleActionSelected("edit") },
    { label: "Transfer", action: () => handleActionSelected("transfer") },
    { label: "Delete", action: () => handleActionSelected("delete") },
  ];

  // Tabs from the image
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "history", label: "History" },
    { id: "notes", label: "Notes" },
    { id: "docs", label: "Docs" },
    { id: "references", label: "References" },
    { id: "applications", label: "Applications" },
    { id: "onboarding", label: "Onboarding" },
  ];

  // Quick action tabs from the image
  const quickTabs = [
    { id: "prescreen", label: "Prescreen" },
    { id: "submissions", label: "Submissions" },
    { id: "sendouts", label: "Sendouts" },
    { id: "interviews", label: "Interviews" },
    { id: "placements", label: "Placements" },
  ];

  // Render notes tab content
  const renderNotesTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          Job Seeker Notes{" "}
          {notes.length > 0 && (
            <span className="text-gray-500 font-normal">({notes.length})</span>
          )}
        </h2>
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
      <h2 className="text-lg font-semibold mb-4">Job Seeker History</h2>

      {isLoadingHistory ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
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
                  actionDisplay = "Job Seeker Created";
                  detailsDisplay = `Created by ${
                    item.performed_by_name || "Unknown"
                  }`;
                  break;
                case "UPDATE":
                  actionDisplay = "Job Seeker Updated";
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

  // Render modify tab to direct to edit form
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Edit Job Seeker</h2>
      <p className="text-gray-600 mb-4">
        Click the button below to edit this job seeker's details.
      </p>
      <button
        onClick={handleEdit}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Edit Job Seeker
      </button>
    </div>
  );

  if (isLoading) {
    return <LoadingScreen message="Loading job seeker details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Job Seekers
        </button>
      </div>
    );
  }

  if (!jobSeeker) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-gray-700 mb-4">Job seeker not found</div>
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
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with job seeker name and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            {/* <Image
              src="/file.svg"
              alt="Job Seeker"
              width={24}
              height={24}
            /> */}
            <FiUsers size={20} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {formatRecordId(jobSeeker.id, "jobSeeker")} {jobSeeker.fullName}
          </h1>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-3 py-2">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          {/* LEFT: dynamic fields */}
          <div className="flex flex-wrap gap-x-10 gap-y-2 flex-1 min-w-0">
            {headerFields.length === 0 ? (
              <span className="text-sm text-gray-500">
                No header fields selected
              </span>
            ) : (
              headerFields.map((key) => (
                  <div key={key} className="min-w-[140px]">
                    <div className="text-xs text-gray-500">
                      {labelForHeaderKey(key)}
                    </div>

                    {/* Special case: email clickable */}
                    {key === "email" && getHeaderValue("email") !== "-" ? (
                      <a
                        href={`mailto:${getHeaderValue("email")}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {getHeaderValue("email")}
                      </a>
                    ) : (
                      <div className="text-sm font-medium text-gray-900">
                        {getHeaderValue(key)}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>

          {/* RIGHT: pencil + existing actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowHeaderFieldModal(true)}
              className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900"
              aria-label="Edit header fields"
              title="Edit header fields"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20h9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
              onClick={() => jobSeekerId && fetchJobSeeker(jobSeekerId)}
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
                handleEdit();
              } else {
                setActiveTab(tab.id);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex bg-gray-300 p-2 space-x-2">
        {quickTabs.map((action) => (
          <button
            key={action.id}
            className={`${
              activeQuickTab === action.id
                ? "bg-white text-blue-600 font-medium"
                : "bg-white text-gray-700 hover:bg-gray-100"
            } px-4 py-1 rounded-full shadow`}
            onClick={() => setActiveQuickTab(action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-4">
          {/* Display content based on active tab */}
          {activeTab === "summary" && (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={panelOrder}
                strategy={verticalListSortingStrategy}
              >
                <div className="col-span-7 space-y-4">
                  {panelOrder.map((panelId) => {
                    if (panelId === "resume") {
                      return (
                        <SortablePanel key={panelId} id={panelId}>
                          <PanelWithHeader
                              title="Resume"
                              onEdit={() => handleEditPanel("resume")}
                            >
                              <div className="space-y-0 border border-gray-200 rounded">
                                {visibleFields.resume.includes("profile") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Profile:
                                    </div>
                                    <div className="flex-1 p-2 text-sm">
                                      {jobSeeker.resume.profile}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.resume.includes("skills") &&
                                  jobSeeker.skills &&
                                  jobSeeker.skills.length > 0 && (
                                    <div className="flex border-b border-gray-200 last:border-b-0">
                                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                        Skills:
                                      </div>
                                      <div className="flex-1 p-2">
                                        <div className="flex flex-wrap gap-2">
                                          {jobSeeker.skills.map(
                                            (skill: string, index: number) => (
                                              <span
                                                key={index}
                                                className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm"
                                              >
                                                {skill}
                                              </span>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                {visibleFields.resume.includes("experience") &&
                                  jobSeeker.resume.experience &&
                                  jobSeeker.resume.experience.length > 0 && (
                                    <div className="flex border-b border-gray-200 last:border-b-0">
                                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                        Work Experience:
                                      </div>
                                      <div className="flex-1 p-2">
                                        {jobSeeker.resume.experience.map(
                                          (exp: any, index: number) => (
                                            <div key={index} className="mb-4 last:mb-0">
                                              <div className="flex justify-between mb-1">
                                                <div className="font-bold text-sm">
                                                  {exp.title} {exp.location}
                                                </div>
                                                <div className="text-sm">{exp.period}</div>
                                              </div>
                                              <ul className="list-disc pl-5 mt-1">
                                                {exp.responsibilities.map(
                                                  (resp: string, respIndex: number) => (
                                                    <li
                                                      key={respIndex}
                                                      className="text-sm mb-1"
                                                    >
                                                      {resp}
                                                    </li>
                                                  )
                                                )}
                                              </ul>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </PanelWithHeader>
                        </SortablePanel>
                      );
                    }

                    if (panelId === "overview") {
                      return (
                        <SortablePanel key={panelId} id={panelId}>
                          <PanelWithHeader
                              title="Overview"
                              onEdit={() => handleEditPanel("overview")}
                            >
                              <div className="space-y-0 border border-gray-200 rounded">
                                {visibleFields.overview.includes("status") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Status:
                                    </div>
                                    <div className="flex-1 p-2">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                        {jobSeeker.status}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {visibleFields.overview.includes("currentOrganization") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Current Organization:
                                    </div>
                                    <div className="flex-1 p-2 text-blue-600">
                                      {jobSeeker.currentOrganization}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.overview.includes("title") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Title:
                                    </div>
                                    <div className="flex-1 p-2">{jobSeeker.title}</div>
                                  </div>
                                )}
                                {visibleFields.overview.includes("email") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Email:
                                    </div>
                                    <div className="flex-1 p-2 text-blue-600">
                                      {jobSeeker.email}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.overview.includes("mobilePhone") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Mobile Phone:
                                    </div>
                                    <div className="flex-1 p-2">
                                      {jobSeeker.mobilePhone}
                                    </div>
                                  </div>
                                )}
                                {/* Display custom fields for overview */}
                                {jobSeeker.customFields &&
                                  Object.keys(jobSeeker.customFields).map((fieldKey) => {
                                    if (visibleFields.overview.includes(fieldKey)) {
                                      const field = availableFields.find(
                                        (f) =>
                                          (f.field_name || f.field_label || f.id) ===
                                          fieldKey
                                      );
                                      const fieldLabel =
                                        field?.field_label || field?.field_name || fieldKey;
                                      const fieldValue = jobSeeker.customFields[fieldKey];
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="flex border-b border-gray-200 last:border-b-0"
                                        >
                                          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
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
                        </SortablePanel>
                      );
                    }

                    if (panelId === "jobSeekerDetails") {
                      return (
                        <SortablePanel key={panelId} id={panelId}>
                          <PanelWithHeader
                              title="Job Seeker Details"
                              onEdit={() => handleEditPanel("jobSeekerDetails")}
                            >
                              <div className="space-y-0 border border-gray-200 rounded">
                                {visibleFields.jobSeekerDetails.includes("status") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Status:
                                    </div>
                                    <div className="flex-1 p-2">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                        {jobSeeker.status}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("currentOrganization") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Current Organization:
                                    </div>
                                    <div className="flex-1 p-2 text-blue-600">
                                      {jobSeeker.currentOrganization}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("title") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Title:
                                    </div>
                                    <div className="flex-1 p-2">{jobSeeker.title}</div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("email") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Email:
                                    </div>
                                    <div className="flex-1 p-2 text-blue-600">
                                      {jobSeeker.email}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("mobilePhone") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Mobile Phone:
                                    </div>
                                    <div className="flex-1 p-2">
                                      {jobSeeker.mobilePhone}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("address") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Address:
                                    </div>
                                    <div className="flex-1 p-2">
                                      {jobSeeker.fullAddress}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("desiredSalary") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Desired Salary:
                                    </div>
                                    <div className="flex-1 p-2">
                                      {jobSeeker.desiredSalary}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("dateAdded") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Date Added:
                                    </div>
                                    <div className="flex-1 p-2">{jobSeeker.dateAdded}</div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("lastContactDate") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      Last Contact:
                                    </div>
                                    <div className="flex-1 p-2">
                                      {jobSeeker.lastContactDate}
                                    </div>
                                  </div>
                                )}
                                {visibleFields.jobSeekerDetails.includes("owner") && (
                                  <div className="flex border-b border-gray-200 last:border-b-0">
                                    <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                                      User Owner:
                                    </div>
                                    <div className="flex-1 p-2">{jobSeeker.owner}</div>
                                  </div>
                                )}
                                {/* Display custom fields */}
                                {jobSeeker.customFields &&
                                  Object.keys(jobSeeker.customFields).map((fieldKey) => {
                                    if (visibleFields.jobSeekerDetails.includes(fieldKey)) {
                                      const field = availableFields.find(
                                        (f) =>
                                          (f.field_name || f.field_label || f.id) ===
                                          fieldKey
                                      );
                                      const fieldLabel =
                                        field?.field_label || field?.field_name || fieldKey;
                                      const fieldValue = jobSeeker.customFields[fieldKey];
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="flex border-b border-gray-200 last:border-b-0"
                                        >
                                          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
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
                        </SortablePanel>
                      );
                    }

                    if (panelId === "recentNotes") {
                      return (
                        <SortablePanel key={panelId} id={panelId}>
                          <PanelWithHeader title="Recent Notes:">
                              <div className="border border-gray-200 rounded">
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
                              </div>
                            </PanelWithHeader>
                        </SortablePanel>
                      );
                    }

                    if (panelId === "openTasks") {
                      return (
                        <SortablePanel key={panelId} id={panelId}>
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
                        </SortablePanel>
                      );
                    }

                    return null;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="col-span-7">{renderNotesTab()}</div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="col-span-7">{renderHistoryTab()}</div>
          )}

          {/* Modify Tab */}
          {activeTab === "modify" && (
            <div className="col-span-7">{renderModifyTab()}</div>
          )}

          {/* Docs Tab */}
          {activeTab === "docs" && (
            <div className="col-span-7">
              <div className="bg-white p-4 rounded shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Documents</h2>
                  <button
                    onClick={triggerFileInput}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center space-x-2"
                  >
                    <FiUpload size={16} />
                    <span>Add Docs</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  />
                </div>

                {/* Drag and Drop Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                      <p className="text-gray-600">Uploading document...</p>
                    </div>
                  ) : (
                    <>
                      <FiUpload className="mx-auto text-4xl text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">
                        Drag and drop files here, or click "Add Docs" button
                        above
                      </p>
                      <p className="text-sm text-gray-500">
                        Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG (Max
                        10MB)
                      </p>
                      {uploadError && (
                        <p className="text-red-500 text-sm mt-2">
                          {uploadError}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Documents List */}
                {isLoadingDocuments ? (
                  <div className="flex justify-center py-4 mt-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : documentError ? (
                  <div className="text-red-500 py-4 mt-4">{documentError}</div>
                ) : documents.length > 0 ? (
                  <div className="mt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100 border-b">
                            <th className="text-left p-3 font-medium">
                              Document Name
                            </th>
                            <th className="text-left p-3 font-medium">Type</th>
                            <th className="text-left p-3 font-medium">Size</th>
                            <th className="text-left p-3 font-medium">
                              Created By
                            </th>
                            <th className="text-left p-3 font-medium">
                              Created At
                            </th>
                            <th className="text-left p-3 font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.map((doc) => (
                            <tr
                              key={doc.id}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="p-3">
                                <div className="flex items-center space-x-2">
                                  <FiFile className="text-gray-400" />
                                  <span className="text-blue-600 hover:underline cursor-pointer">
                                    {doc.document_name ||
                                      doc.name ||
                                      "Untitled Document"}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-gray-600">
                                {doc.document_type || doc.type || "General"}
                              </td>
                              <td className="p-3 text-gray-600">
                                {doc.file_size
                                  ? `${(doc.file_size / 1024).toFixed(2)} KB`
                                  : "-"}
                              </td>
                              <td className="p-3 text-gray-600">
                                {doc.created_by_name || "Unknown"}
                              </td>
                              <td className="p-3 text-gray-600">
                                {doc.created_at
                                  ? new Date(
                                      doc.created_at
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="p-3">
                                <button
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                  title="Delete document"
                                >
                                  <FiX size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 mt-4">
                    <p className="text-gray-500 italic">
                      No documents have been uploaded yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "references" && (
            <div className="col-span-7">
              <div className="bg-white p-4 rounded shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">References</h2>
                  <button
                    onClick={() => setShowReferenceModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Send Reference Form
                  </button>
                </div>
                <p className="text-gray-600">
                  Use the button above to send reference documents to a
                  reference contact via email.
                </p>
              </div>
            </div>
          )}

          {activeTab === "applications" && (
            <div className="col-span-7">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Applications</h2>
                <p className="text-gray-500 italic">No applications found</p>
              </div>
            </div>
          )}

          {activeTab === "onboarding" && (
            <div className="col-span-7">
              <OnboardingTab jobSeeker={jobSeeker} />
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="col-span-7">{renderNotesTab()}</div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="col-span-7">{renderHistoryTab()}</div>
          )}

          {/* Modify Tab */}
          {activeTab === "modify" && (
            <div className="col-span-7">{renderModifyTab()}</div>
          )}

          {/* Docs Tab */}
          {activeTab === "docs" && (
            <div className="col-span-7">
              <div className="bg-white p-4 rounded shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Documents</h2>
                  <button
                    onClick={triggerFileInput}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center space-x-2"
                  >
                    <FiUpload size={16} />
                    <span>Add Docs</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  />
                </div>

                {/* Drag and Drop Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                      <p className="text-gray-600">Uploading document...</p>
                    </div>
                  ) : (
                    <>
                      <FiUpload className="mx-auto text-4xl text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">
                        Drag and drop files here, or click "Add Docs" button
                        above
                      </p>
                      <p className="text-sm text-gray-500">
                        Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG (Max
                        10MB)
                      </p>
                      {uploadError && (
                        <p className="text-red-500 text-sm mt-2">
                          {uploadError}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Documents List */}
                {isLoadingDocuments ? (
                  <div className="flex justify-center py-4 mt-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : documentError ? (
                  <div className="text-red-500 py-4 mt-4">{documentError}</div>
                ) : documents.length > 0 ? (
                  <div className="mt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100 border-b">
                            <th className="text-left p-3 font-medium">
                              Document Name
                            </th>
                            <th className="text-left p-3 font-medium">Type</th>
                            <th className="text-left p-3 font-medium">Size</th>
                            <th className="text-left p-3 font-medium">
                              Created By
                            </th>
                            <th className="text-left p-3 font-medium">
                              Created At
                            </th>
                            <th className="text-left p-3 font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.map((doc) => (
                            <tr
                              key={doc.id}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="p-3">
                                <div className="flex items-center space-x-2">
                                  <FiFile className="text-gray-400" />
                                  <span className="text-blue-600 hover:underline cursor-pointer">
                                    {doc.document_name ||
                                      doc.name ||
                                      "Untitled Document"}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-gray-600">
                                {doc.document_type || doc.type || "General"}
                              </td>
                              <td className="p-3 text-gray-600">
                                {doc.file_size
                                  ? `${(doc.file_size / 1024).toFixed(2)} KB`
                                  : "-"}
                              </td>
                              <td className="p-3 text-gray-600">
                                {doc.created_by_name || "Unknown"}
                              </td>
                              <td className="p-3 text-gray-600">
                                {doc.created_at
                                  ? new Date(
                                      doc.created_at
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="p-3">
                                <button
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                  title="Delete document"
                                >
                                  <FiX size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 mt-4">
                    <p className="text-gray-500 italic">
                      No documents have been uploaded yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "references" && (
            <div className="col-span-7">
              <div className="bg-white p-4 rounded shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">References</h2>
                  <button
                    onClick={() => setShowReferenceModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Send Reference Form
                  </button>
                </div>
                <p className="text-gray-600">
                  Use the button above to send reference documents to a
                  reference contact via email.
                </p>
              </div>
            </div>
          )}

          {activeTab === "applications" && (
            <div className="col-span-7">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Applications</h2>
                <p className="text-gray-500 italic">No applications found</p>
              </div>
            </div>
          )}

          {activeTab === "onboarding" && (
            <div className="col-span-7">
              <OnboardingTab jobSeeker={jobSeeker} />
            </div>
          )}

        </div>
      </div>

      {/* Onboarding Modal */}
      {/* {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                Send Onboarding Documents
              </h3>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => setShowOnboardingModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-700 mb-2">
                Select documents to include as links in the email:
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {onboardingDocs.map((doc) => (
                  <label key={doc.id} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!selectedDocs[doc.id]}
                      onChange={() => toggleDoc(doc.id)}
                    />
                    <span>
                      <span className="font-medium">{doc.name}</span>
                      <div className="text-xs text-gray-500">{doc.url}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="text-sm text-gray-700 mb-4">
              Email will be pre-addressed to{" "}
              <span className="font-medium">{jobSeeker?.email}</span> with
              subject
              <span className="font-medium"> "Onboarding Documents"</span> and
              body:
              <pre className="bg-gray-50 border rounded p-2 mt-1 whitespace-pre-wrap">
                Here are your onboarding documents. Please fill these out and
                return promptly.
              </pre>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 border rounded"
                onClick={() => setShowOnboardingModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSendOnboarding}
              >
                {isOffice365Connected
                  ? "Send via Office 365"
                  : "Open in Outlook"}
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* Reference Form Modal */}
      {showReferenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Send Reference Form</h3>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => {
                  setShowReferenceModal(false);
                  setReferenceEmail("");
                  setSelectedReferenceDocs({});
                }}
              >
                ✕
              </button>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Email Address:
              </label>
              <input
                type="email"
                value={referenceEmail}
                onChange={(e) => setReferenceEmail(e.target.value)}
                placeholder="reference@example.com"
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-700 mb-2">
                Select documents to include as links in the email:
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {referenceDocs.map((doc) => (
                  <label key={doc.id} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!selectedReferenceDocs[doc.id]}
                      onChange={() => toggleReferenceDoc(doc.id)}
                    />
                    <span>
                      <span className="font-medium">{doc.name}</span>
                      <div className="text-xs text-gray-500">{doc.url}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="text-sm text-gray-700 mb-4">
              Email will be pre-addressed to the reference email address with
              subject
              <span className="font-medium"> "Reference Request"</span> and a
              professional message requesting a reference for{" "}
              {jobSeeker?.fullName || "the candidate"}.
            </div>
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 border rounded"
                onClick={() => {
                  setShowReferenceModal(false);
                  setReferenceEmail("");
                  setSelectedReferenceDocs({});
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSendReferenceForm}
              >
                {isOffice365Connected
                  ? "Send via Office 365"
                  : "Open in Outlook"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              {editingPanel === "resume" ? (
                // Resume panel: Show ALL fields (standard + custom) from Field Management
                <div className="mb-4">
                  <h3 className="font-medium mb-3">All Available Fields:</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                    {isLoadingFields ? (
                      <div className="text-center py-4 text-gray-500">
                        Loading fields...
                      </div>
                    ) : (
                      <>
                        {/* All Standard Fields for Resume (using headerFieldDefs which includes all standard + custom) */}
                        {headerFieldDefs.map((field) => {
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
                                {field.type}
                              </span>
                            </div>
                          );
                        })}
                        
                        {/* Also include original resume-specific fields if not already in headerFieldDefs */}
                        {(() => {
                          const resumeSpecificFields = [
                            { key: "profile", label: "Profile" },
                            { key: "skills", label: "Skills" },
                            { key: "experience", label: "Work Experience" },
                          ];
                          const existingKeys = new Set(headerFieldDefs.map(f => f.key));
                          return resumeSpecificFields
                            .filter(f => !existingKeys.has(f.key))
                            .map((field) => {
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
                      </>
                    )}
                  </div>
                </div>
              ) : editingPanel === "overview" ? (
                // Overview panel: Show available fields
                <>
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
                      {[
                        { key: "status", label: "Status" },
                        { key: "currentOrganization", label: "Current Organization" },
                        { key: "title", label: "Title" },
                        { key: "email", label: "Email" },
                        { key: "mobilePhone", label: "Mobile Phone" },
                      ].map((field) => {
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
                      })}
                    </div>
                  </div>
                </>
              ) : (
                // Other panels (jobSeekerDetails): Keep existing behavior
                <>
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
                          jobSeekerDetails: [
                            { key: "status", label: "Status" },
                            {
                              key: "currentOrganization",
                              label: "Current Organization",
                            },
                            { key: "title", label: "Title" },
                            { key: "email", label: "Email" },
                            { key: "mobilePhone", label: "Mobile Phone" },
                            { key: "address", label: "Address" },
                            { key: "desiredSalary", label: "Desired Salary" },
                            { key: "dateAdded", label: "Date Added" },
                            { key: "lastContactDate", label: "Last Contact" },
                            { key: "owner", label: "User Owner" },
                          ],
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
                </>
              )}

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

      {/* Add Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Create Calendar Appointment</h2>
              <button
                onClick={() => {
                  setShowAppointmentModal(false);
                  setAppointmentForm({
                    date: "",
                    time: "",
                    type: "",
                    description: "",
                    location: "",
                    duration: 30,
                    attendees: [],
                    sendInvites: true,
                  });
                }}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={appointmentForm.date}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={appointmentForm.time}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, time: e.target.value }))
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={appointmentForm.duration}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, duration: parseInt(e.target.value) || 30 }))
                  }
                  min="15"
                  step="15"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={appointmentForm.type}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select type</option>
                  <option value="Interview">Interview</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Assessment">Assessment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={appointmentForm.description}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={4}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter appointment description..."
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={appointmentForm.location}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, location: e.target.value }))
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter location or video link..."
                />
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attendees (will receive calendar invite)
                </label>
                {isLoadingAppointmentUsers ? (
                  <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                    Loading users...
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500">
                    <div className="max-h-48 overflow-y-auto p-2">
                      {appointmentUsers.length === 0 ? (
                        <div className="text-gray-500 text-sm p-2">
                          No users available
                        </div>
                      ) : (
                        appointmentUsers.map((user) => (
                          <label
                            key={user.id}
                            className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                          >
                            <input
                              type="checkbox"
                              checked={appointmentForm.attendees.includes(user.email || user.id)}
                              onChange={(e) => {
                                const email = user.email || user.id;
                                if (e.target.checked) {
                                  setAppointmentForm((prev) => ({
                                    ...prev,
                                    attendees: [...prev.attendees, email],
                                  }));
                                } else {
                                  setAppointmentForm((prev) => ({
                                    ...prev,
                                    attendees: prev.attendees.filter((a) => a !== email),
                                  }));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                            />
                            <span className="text-sm text-gray-700">
                              {user.name || user.email || `User #${user.id}`}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    {appointmentForm.attendees.length > 0 && (
                      <div className="border-t border-gray-300 p-2 bg-gray-50">
                        <div className="text-xs text-gray-600 mb-1">
                          Selected: {appointmentForm.attendees.length} attendee(s)
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {appointmentForm.attendees.map((email) => (
                            <span
                              key={email}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              {email}
                              <button
                                type="button"
                                onClick={() => {
                                  setAppointmentForm((prev) => ({
                                    ...prev,
                                    attendees: prev.attendees.filter((a) => a !== email),
                                  }));
                                }}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Send Invites Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={appointmentForm.sendInvites}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, sendInvites: e.target.checked }))
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="text-sm text-gray-700">
                  Send calendar invites to attendees
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 p-4 border-t">
              <button
                onClick={() => {
                  setShowAppointmentModal(false);
                  setAppointmentForm({
                    date: "",
                    time: "",
                    type: "",
                    description: "",
                    location: "",
                    duration: 30,
                    attendees: [],
                    sendInvites: true,
                  });
                }}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                disabled={isSavingAppointment}
              >
                Cancel
              </button>
              <button
                onClick={handleAppointmentSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={
                  isSavingAppointment ||
                  !appointmentForm.date ||
                  !appointmentForm.time ||
                  !appointmentForm.type
                }
              >
                {isSavingAppointment ? "Creating..." : "Create Appointment"}
              </button>
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

                {/* Action Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action
                  </label>
                  {isLoadingActionFields ? (
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                      <span>Loading actions...</span>
                    </div>
                  ) : (
                    <select
                      value={noteForm.action}
                      onChange={(e) =>
                        setNoteForm((prev) => ({ ...prev, action: e.target.value }))
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Action</option>
                      {actionFields.map((field) => (
                        <option
                          key={field.id || field.field_name || field.field_label}
                          value={field.field_label || field.field_name || ""}
                        >
                          {field.field_label || field.field_name || ""}
                        </option>
                      ))}
                    </select>
                  )}
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

                {/* Action Section */}
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action
                  </label>
                  <div className="border border-gray-300 rounded p-3 bg-gray-50">
                    <div className="font-medium mb-3">Copy Note</div>
                    <div className="flex space-x-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setNoteForm(prev => ({ ...prev, copyNote: 'No' }))}
                        className={`px-4 py-2 rounded text-sm ${
                          noteForm.copyNote === 'No'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteForm(prev => ({ ...prev, copyNote: 'Yes' }))}
                        className={`px-4 py-2 rounded text-sm ${
                          noteForm.copyNote === 'Yes'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Yes
                      </button>
                    </div>
                    {noteForm.copyNote === 'Yes' && (
                      <div className="mt-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={noteForm.replaceGeneralContactComments}
                            onChange={(e) => setNoteForm(prev => ({ ...prev, replaceGeneralContactComments: e.target.checked }))}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            Replace the General Contact Comments with this note?
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div> */}

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

                {/* Schedule Next Action Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Next Action
                  </label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((prev) => ({
                          ...prev,
                          scheduleNextAction: "None",
                        }))
                      }
                      className={`px-4 py-2 rounded text-sm ${
                        noteForm.scheduleNextAction === "None"
                          ? "bg-blue-500 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((prev) => ({
                          ...prev,
                          scheduleNextAction: "Appointment",
                        }))
                      }
                      className={`px-4 py-2 rounded text-sm ${
                        noteForm.scheduleNextAction === "Appointment"
                          ? "bg-blue-500 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Appointment
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((prev) => ({
                          ...prev,
                          scheduleNextAction: "Task",
                        }))
                      }
                      className={`px-4 py-2 rounded text-sm ${
                        noteForm.scheduleNextAction === "Task"
                          ? "bg-blue-500 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Task
                    </button>
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
      {/* Header Fields Modal (PENCIL-HEADER-MODAL) */}
      {/* Header Fields Modal (Organization-style UI) */}
      {showHeaderFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Top bar */}
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">
                  Customize Header Fields
                </h2>
                <p className="text-xs text-gray-600">
                  Select fields, reorder them, and it saves per Job Seeker.
                </p>
              </div>

              <button
                onClick={() => setShowHeaderFieldModal(false)}
                className="p-1 rounded hover:bg-gray-200"
                aria-label="Close"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT: Available Fields (checkbox list) */}
              <div>
                <h3 className="font-medium mb-3">Available Fields</h3>

                <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                  {headerFieldDefs.map((d) => {
                    const checked = headerFields.includes(d.key);

                    return (
                      <label
                        key={d.key}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            toggleHeaderField(d.key);
                          }}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-gray-800">{d.label}</div>
                          <div className="text-xs text-gray-500">{d.type}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Header Order (only visible ones) */}
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
                            {labelForHeaderKey(key)}
                          </div>
                          <div className="text-xs text-gray-500">{key}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                            disabled={idx === 0}
                            onClick={() => moveHeaderField(key, "up")}
                            title="Move up"
                          >
                            ↑
                          </button>

                          <button
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                            disabled={idx === headerFields.length - 1}
                            onClick={() => moveHeaderField(key, "down")}
                            title="Move down"
                          >
                            ↓
                          </button>

                          <button
                            className="px-2 py-1 border rounded text-xs hover:bg-red-50 text-red-600"
                            onClick={() => removeHeaderField(key)}
                            title="Remove"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer buttons (Reset + Done) */}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                    onClick={resetHeaderFields}
                  >
                    Reset
                  </button>

                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      const success = await saveHeaderConfig();
                      if (success) {
                        setShowHeaderFieldModal(false);
                      }
                    }}
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
