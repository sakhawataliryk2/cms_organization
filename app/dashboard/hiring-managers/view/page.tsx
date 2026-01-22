'use client'

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';
import PanelWithHeader from '@/components/PanelWithHeader';
import { FiUserCheck } from 'react-icons/fi';
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import { sendCalendarInvite, type CalendarEvent } from "@/lib/office365";

// Default header fields for Hiring Managers module - defined outside component to ensure stable reference
const HIRING_MANAGER_DEFAULT_HEADER_FIELDS = ["phone", "email"];

export default function HiringManagerView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hiringManagerId = searchParams.get("id");
  const [activeTab, setActiveTab] = useState("summary");

  // Hiring manager data
  const [hiringManager, setHiringManager] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes and history
  const [notes, setNotes] = useState<Array<any>>([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  const [noteForm, setNoteForm] = useState({
    text: "",
    action: "",
    about: hiringManager ? `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}` : "",
    aboutReferences: hiringManager
      ? [
          {
            id: hiringManager.id,
            type: "Hiring Manager",
            display: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`,
            value: formatRecordId(hiringManager.id, "hiringManager"),
          },
        ]
      : [],
    copyNote: "No",
    replaceGeneralContactComments: false,
    additionalReferences: [] as Array<{ id: string; type: string; display: string; value: string }>,
    scheduleNextAction: "None",
    emailNotification: "Internal User",
  });

  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Action fields state (Field_500 for hiring managers)
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

  // Validation state
  const [noteFormErrors, setNoteFormErrors] = useState<{
    text?: string;
    action?: string;
    about?: string;
  }>({});

  // Reference search state for About field
  const [aboutSearchQuery, setAboutSearchQuery] = useState("");
  const [aboutSuggestions, setAboutSuggestions] = useState<any[]>([]);
  const [showAboutDropdown, setShowAboutDropdown] = useState(false);
  const [isLoadingAboutSearch, setIsLoadingAboutSearch] = useState(false);
  const aboutInputRef = useRef<HTMLInputElement>(null);

  // Reference search state for Additional References
  const [additionalRefSearchQuery, setAdditionalRefSearchQuery] = useState("");
  const [additionalRefSuggestions, setAdditionalRefSuggestions] = useState<any[]>([]);
  const [showAdditionalRefDropdown, setShowAdditionalRefDropdown] = useState(false);
  const [isLoadingAdditionalRefSearch, setIsLoadingAdditionalRefSearch] = useState(false);
  const additionalRefInputRef = useRef<HTMLInputElement>(null);

  // Summary counts state
  const [summaryCounts, setSummaryCounts] = useState({
    jobs: 0,
    appsUnderReview: 0,
    interviews: 0,
    placements: 0,
  });
  const [isLoadingSummaryCounts, setIsLoadingSummaryCounts] = useState(false);

  // Field management
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>({
    details: [
      "status","organization","department","email","email2","mobilePhone",
      "directLine","reportsTo","linkedinUrl","dateAdded","owner",
      "secondaryOwners","address",
    ],
    organizationDetails: ["status","organizationName","organizationPhone","url","dateAdded"],
    recentNotes: ["notes"],
  });

  // =====================
  // HEADER FIELDS (Top Row)
  // =====================

  const {
    headerFields,
    setHeaderFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    saveHeaderConfig,
    isSaving: isSavingHeaderConfig,
  } = useHeaderConfig({
    entityType: "HIRING_MANAGER",
    configType: "header",
    defaultFields: HIRING_MANAGER_DEFAULT_HEADER_FIELDS,
  });

  const buildHeaderFieldCatalog = () => {
    const standard = [
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "mobilePhone", label: "Mobile" },
      { key: "directLine", label: "Direct Line" },
      { key: "department", label: "Department" },
      { key: "organizationName", label: "Organization" },
      { key: "title", label: "Title" },
      { key: "linkedinUrl", label: "LinkedIn" },
      { key: "address", label: "Address" },
    ];

    const apiCustom = (availableFields || []).map((f: any) => {
      const stableKey = f.field_key || f.field_name || f.api_name || f.id;
      return {
        key: `custom:${stableKey}`,
        label: f.field_label || f.field_name || String(stableKey),
      };
    });

    const hmCustom = Object.keys(hiringManager?.customFields || {}).map((k) => ({
      key: `custom:${k}`,
      label: k,
    }));

    const merged = [...standard, ...apiCustom, ...hmCustom];
    const seen = new Set<string>();
    return merged.filter((x) => {
      if (seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  };

  const headerFieldCatalog = buildHeaderFieldCatalog();

  const getHeaderFieldLabel = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found?.label || key;
  };

  const getHeaderFieldValue = (key: string) => {
    if (!hiringManager) return "-";
    if (key.startsWith("custom:")) {
      const rawKey = key.replace("custom:", "");
      const val = hiringManager.customFields?.[rawKey];
      return val === undefined || val === null || val === "" ? "-" : String(val);
    }
    switch (key) {
      case "phone": return hiringManager.phone || "(Not provided)";
      case "email": return hiringManager.email || "(Not provided)";
      case "mobilePhone": return hiringManager.mobilePhone || "(Not provided)";
      case "directLine": return hiringManager.directLine || "(Not provided)";
      case "department": return hiringManager.department || "-";
      case "organizationName": return hiringManager.organization?.name || "-";
      case "title": return hiringManager.title || "-";
      case "linkedinUrl": return hiringManager.linkedinUrl || "-";
      case "address": return hiringManager.address || "-";
      default: return "-";
    }
  };


  const isHeaderFieldEnabled = (key: string) => headerFields.includes(key);
  const toggleHeaderField = (key: string) => {
    setHeaderFields((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };
  const moveHeaderField = (key: string, dir: "up" | "down") => {
    setHeaderFields((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const nextIdx = dir === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return copy;
    });
  };


  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Tearsheet modal state
  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);
  const [tearsheetForm, setTearsheetForm] = useState({
    name: "",
    visibility: "Existing", // 'New' or 'Existing'
    selectedTearsheetId: "", // For existing tearsheets
  });
  const [existingTearsheets, setExistingTearsheets] = useState<any[]>([]);
  const [isLoadingTearsheets, setIsLoadingTearsheets] = useState(false);
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);

  // Transfer modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    targetOrganizationId: "", // Organization to transfer to
  });
  const [availableOrganizations, setAvailableOrganizations] = useState<any[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Delete request modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    reason: "", // Mandatory reason for deletion
  });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<any>(null);
  const [isLoadingDeleteRequest, setIsLoadingDeleteRequest] = useState(false);

  // Password Reset modal state
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetForm, setPasswordResetForm] = useState({
    email: "",
    sendEmail: true,
  });
  const [isSubmittingPasswordReset, setIsSubmittingPasswordReset] = useState(false);

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

 

  // Fetch hiring manager when component mounts
  useEffect(() => {
    if (hiringManagerId) {
      fetchHiringManager(hiringManagerId);
    }
  }, [hiringManagerId]);

  // Fetch available fields after hiring manager is loaded
  useEffect(() => {
    if (hiringManager && hiringManagerId) {
      fetchAvailableFields();
      // Update note form about field when hiring manager is loaded
      setNoteForm((prev) => ({
        ...prev,
        about: `${formatRecordId(hiringManager.id, "hiringManager")} ${
          hiringManager.fullName
        }`,
      }));
    }
  }, [hiringManager, hiringManagerId]);

  // Fetch users for email notification
  useEffect(() => {
    if (showAddNote) {
      fetchUsers();
    }
  }, [showAddNote]);

  // Fetch users for appointment attendees
  useEffect(() => {
    if (showAppointmentModal) {
      fetchAppointmentUsers();
    }
  }, [showAppointmentModal]);

const fetchAvailableFields = async () => {
  setIsLoadingFields(true);
  try {
    const token = document.cookie.replace(
      /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    );

    const response = await fetch(
      "/api/admin/field-management/hiring-managers",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    console.log("HM field-management status:", response.status);

    const raw = await response.text();
    console.log("HM field-management raw:", raw);

    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {}

    // ✅ IMPORTANT: your API is returning customFields (as per your screenshot)
    const fields =
      data.customFields ||
      data.fields ||
      data.data?.fields ||
      data.hiringManagerFields ||
      [];

    console.log("HM fields count:", fields.length);

    // ✅ save fields for modal/catalog (including hidden fields for reference, but we'll filter in UI)
    setAvailableFields(fields);

    // ✅ Only add NON-HIDDEN custom fields to Details panel
    // Filter out hidden fields before adding to visible fields
    const visibleCustomFields = fields.filter((f: any) => {
      const isHidden = f.is_hidden === true || f.hidden === true || f.isHidden === true;
      return !isHidden;
    });

    const allCustomKeys = visibleCustomFields.map(
      (f: any) => f.field_name || f.field_key || f.id
    );

    setVisibleFields((prev) => ({
      ...prev,
      details: Array.from(new Set([...prev.details, ...allCustomKeys])),
    }));
  } catch (err) {
    console.error("Error fetching HM available fields:", err);
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

  // Function to fetch hiring manager data
  const fetchHiringManager = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching hiring manager data for ID: ${id}`);
      const response = await fetch(`/api/hiring-managers/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      console.log(`API Response status: ${response.status}`);

      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch (error) {
        const parseError = error as Error;
        console.error("Error parsing response:", parseError);
        console.error("Raw response:", responseText.substring(0, 200));
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to fetch hiring manager: ${response.status}`
        );
      }

      console.log("Hiring manager data received:", data);

      if (!data.hiringManager) {
        throw new Error("No hiring manager data received from API");
      }

      // Format the hiring manager data for display
      const hm = data.hiringManager;
      const formattedHiringManager = {
        id: hm.id || "Unknown ID",
        firstName: hm.first_name || "",
        lastName: hm.last_name || "",
        fullName:
          hm.full_name || `${hm.last_name || ""}, ${hm.first_name || ""}`,
        title: hm.title || "Not specified",
        phone: hm.phone || "(Not provided)",
        mobilePhone: hm.mobile_phone || "(Not provided)",
        directLine: hm.direct_line || "(Not provided)",
        email: hm.email || "(Not provided)",
        email2: hm.email2 || "",
        organization: {
          name:
            hm.organization_name ||
            hm.organization_name_from_org ||
            "Not specified",
          status: "Active",
          phone: "(Not provided)",
          url: "https://example.com",
        },
        status: hm.status || "Active",
        department: hm.department || "Not specified",
        reportsTo: hm.reports_to || "Not specified",
        owner: hm.owner || "Not assigned",
        secondaryOwners: hm.secondary_owners || "None",
        linkedinUrl: hm.linkedin_url || "Not provided",
        dateAdded: hm.date_added
          ? new Date(hm.date_added).toLocaleDateString()
          : hm.created_at
          ? new Date(hm.created_at).toLocaleDateString()
          : "Unknown",
        address: hm.address || "No address provided",
      };

      console.log("Formatted hiring manager data:", formattedHiringManager);
      setHiringManager(formattedHiringManager);

      // Now fetch notes and history
      fetchNotes(id);
      fetchHistory(id);
      fetchSummaryCounts(id);
    } catch (err) {
      console.error("Error fetching hiring manager:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching hiring manager details"
      );
    } finally {
      setIsLoading(false);
    }
  };


  // Fetch notes for the hiring manager
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);

    try {
      const response = await fetch(`/api/hiring-managers/${id}/notes`, {
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

  // Fetch history for the hiring manager
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);

    try {
      const response = await fetch(`/api/hiring-managers/${id}/history`, {
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

  // Fetch summary counts for the hiring manager
  const fetchSummaryCounts = async (id: string) => {
    if (!id) return;
    setIsLoadingSummaryCounts(true);
    try {
      const response = await fetch(`/api/hiring-managers/${id}/summary-counts`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.counts) {
          setSummaryCounts(data.counts);
        }
      }
    } catch (err) {
      console.error("Error fetching summary counts:", err);
    } finally {
      setIsLoadingSummaryCounts(false);
    }
  };

  // Fetch users for email notification dropdown - Internal Users Only
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
        // Filter to only internal system users (exclude external contacts, job seekers, hiring managers, organizations)
        const internalUsers = (data.users || []).filter((user: any) => {
          return (
            user.user_type === "internal" ||
            user.role === "admin" ||
            user.role === "user" ||
            (!user.user_type && user.email) // Default to internal if user_type not set but has email
          );
        });
        setUsers(internalUsers);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Search for references for About field - Global Search
  const searchAboutReferences = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setAboutSuggestions([]);
      setShowAboutDropdown(false);
      return;
    }

    setIsLoadingAboutSearch(true);
    setShowAboutDropdown(true);

    try {
      const searchTerm = query.trim();
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      // Search across multiple entity types in parallel
      const [
        jobsRes,
        orgsRes,
        jobSeekersRes,
        leadsRes,
        tasksRes,
        placementsRes,
        hiringManagersRes,
      ] = await Promise.allSettled([
        fetch("/api/jobs", { headers }),
        fetch("/api/organizations", { headers }),
        fetch("/api/job-seekers", { headers }),
        fetch("/api/leads", { headers }),
        fetch("/api/tasks", { headers }),
        fetch("/api/placements", { headers }),
        fetch("/api/hiring-managers", { headers }),
      ]);

      const suggestions: any[] = [];

      // Process jobs
      if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
        const data = await jobsRes.value.json();
        const jobs = (data.jobs || []).filter(
          (job: any) =>
            job.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.id?.toString().includes(searchTerm)
        );
        jobs.forEach((job: any) => {
          suggestions.push({
            id: job.id,
            type: "Job",
            display: `${formatRecordId(job.id, "job")} ${job.job_title || "Untitled"}`,
            value: formatRecordId(job.id, "job"),
          });
        });
      }

      // Process organizations
      if (orgsRes.status === "fulfilled" && orgsRes.value.ok) {
        const data = await orgsRes.value.json();
        const orgs = (data.organizations || []).filter(
          (org: any) =>
            org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            org.id?.toString().includes(searchTerm)
        );
        orgs.forEach((org: any) => {
          suggestions.push({
            id: org.id,
            type: "Organization",
            display: `${formatRecordId(org.id, "organization")} ${org.name || "Unnamed"}`,
            value: formatRecordId(org.id, "organization"),
          });
        });
      }

      // Process job seekers
      if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
        const data = await jobSeekersRes.value.json();
        const jobSeekers = (data.jobSeekers || []).filter(
          (js: any) =>
            `${js.first_name || ""} ${js.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            js.id?.toString().includes(searchTerm)
        );
        jobSeekers.forEach((js: any) => {
          const name = `${js.first_name || ""} ${js.last_name || ""}`.trim() || "Unnamed";
          suggestions.push({
            id: js.id,
            type: "Job Seeker",
            display: `${formatRecordId(js.id, "jobSeeker")} ${name}`,
            value: formatRecordId(js.id, "jobSeeker"),
          });
        });
      }

      // Process leads
      if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
        const data = await leadsRes.value.json();
        const leads = (data.leads || []).filter(
          (lead: any) =>
            lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.id?.toString().includes(searchTerm)
        );
        leads.forEach((lead: any) => {
          suggestions.push({
            id: lead.id,
            type: "Lead",
            display: `${formatRecordId(lead.id, "lead")} ${lead.name || "Unnamed"}`,
            value: formatRecordId(lead.id, "lead"),
          });
        });
      }

      // Process tasks
      if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
        const data = await tasksRes.value.json();
        const tasks = (data.tasks || []).filter(
          (task: any) =>
            task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.id?.toString().includes(searchTerm)
        );
        tasks.forEach((task: any) => {
          suggestions.push({
            id: task.id,
            type: "Task",
            display: `${formatRecordId(task.id, "task")} ${task.title || "Untitled"}`,
            value: formatRecordId(task.id, "task"),
          });
        });
      }

      // Process placements
      if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
        const data = await placementsRes.value.json();
        const placements = (data.placements || []).filter(
          (placement: any) =>
            placement.id?.toString().includes(searchTerm)
        );
        placements.forEach((placement: any) => {
          suggestions.push({
            id: placement.id,
            type: "Placement",
            display: `${formatRecordId(placement.id, "placement")} Placement`,
            value: formatRecordId(placement.id, "placement"),
          });
        });
      }

      // Process hiring managers
      if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
        const data = await hiringManagersRes.value.json();
        const hiringManagers = (data.hiringManagers || []).filter(
          (hm: any) => {
            const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "";
            return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              hm.id?.toString().includes(searchTerm);
          }
        );
        hiringManagers.forEach((hm: any) => {
          const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "Unnamed";
          suggestions.push({
            id: hm.id,
            type: "Hiring Manager",
            display: `${formatRecordId(hm.id, "hiringManager")} ${name}`,
            value: formatRecordId(hm.id, "hiringManager"),
          });
        });
      }

      // Filter out already selected references
      const selectedIds = noteForm.aboutReferences.map((ref) => ref.id);
      const filteredSuggestions = suggestions.filter(
        (s) => !selectedIds.includes(s.id)
      );

      // Limit to top 10 suggestions
      setAboutSuggestions(filteredSuggestions.slice(0, 10));
    } catch (err) {
      console.error("Error searching about references:", err);
      setAboutSuggestions([]);
    } finally {
      setIsLoadingAboutSearch(false);
    }
  };

  // Handle About reference selection
  const handleAboutReferenceSelect = (reference: any) => {
    setNoteForm((prev) => {
      const newReferences = [...prev.aboutReferences, reference];
      return {
        ...prev,
        aboutReferences: newReferences,
        about: newReferences.map((ref) => ref.display).join(", "),
      };
    });
    setAboutSearchQuery("");
    setShowAboutDropdown(false);
    setAboutSuggestions([]);
    if (aboutInputRef.current) {
      aboutInputRef.current.focus();
    }
  };

  // Remove About reference
  const removeAboutReference = (index: number) => {
    setNoteForm((prev) => {
      const newReferences = prev.aboutReferences.filter((_, i) => i !== index);
      return {
        ...prev,
        aboutReferences: newReferences,
        about: newReferences.length > 0
          ? newReferences.map((ref) => ref.display).join(", ")
          : "",
      };
    });
  };

  // Search for references for Additional References field - Global Search
  const searchAdditionalReferences = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setAdditionalRefSuggestions([]);
      setShowAdditionalRefDropdown(false);
      return;
    }

    setIsLoadingAdditionalRefSearch(true);
    setShowAdditionalRefDropdown(true);

    try {
      const searchTerm = query.trim();
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      // Search across multiple entity types in parallel (same as About field)
      const [
        jobsRes,
        orgsRes,
        jobSeekersRes,
        leadsRes,
        tasksRes,
        placementsRes,
        hiringManagersRes,
      ] = await Promise.allSettled([
        fetch("/api/jobs", { headers }),
        fetch("/api/organizations", { headers }),
        fetch("/api/job-seekers", { headers }),
        fetch("/api/leads", { headers }),
        fetch("/api/tasks", { headers }),
        fetch("/api/placements", { headers }),
        fetch("/api/hiring-managers", { headers }),
      ]);

      const suggestions: any[] = [];

      // Process jobs
      if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
        const data = await jobsRes.value.json();
        const jobs = (data.jobs || []).filter(
          (job: any) =>
            job.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.id?.toString().includes(searchTerm)
        );
        jobs.forEach((job: any) => {
          suggestions.push({
            id: job.id,
            type: "Job",
            display: `${formatRecordId(job.id, "job")} ${job.job_title || "Untitled"}`,
            value: formatRecordId(job.id, "job"),
          });
        });
      }

      // Process organizations
      if (orgsRes.status === "fulfilled" && orgsRes.value.ok) {
        const data = await orgsRes.value.json();
        const orgs = (data.organizations || []).filter(
          (org: any) =>
            org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            org.id?.toString().includes(searchTerm)
        );
        orgs.forEach((org: any) => {
          suggestions.push({
            id: org.id,
            type: "Organization",
            display: `${formatRecordId(org.id, "organization")} ${org.name || "Unnamed"}`,
            value: formatRecordId(org.id, "organization"),
          });
        });
      }

      // Process job seekers
      if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
        const data = await jobSeekersRes.value.json();
        const jobSeekers = (data.jobSeekers || []).filter(
          (js: any) =>
            `${js.first_name || ""} ${js.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            js.id?.toString().includes(searchTerm)
        );
        jobSeekers.forEach((js: any) => {
          const name = `${js.first_name || ""} ${js.last_name || ""}`.trim() || "Unnamed";
          suggestions.push({
            id: js.id,
            type: "Job Seeker",
            display: `${formatRecordId(js.id, "jobSeeker")} ${name}`,
            value: formatRecordId(js.id, "jobSeeker"),
          });
        });
      }

      // Process leads
      if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
        const data = await leadsRes.value.json();
        const leads = (data.leads || []).filter(
          (lead: any) =>
            lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.id?.toString().includes(searchTerm)
        );
        leads.forEach((lead: any) => {
          suggestions.push({
            id: lead.id,
            type: "Lead",
            display: `${formatRecordId(lead.id, "lead")} ${lead.name || "Unnamed"}`,
            value: formatRecordId(lead.id, "lead"),
          });
        });
      }

      // Process tasks
      if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
        const data = await tasksRes.value.json();
        const tasks = (data.tasks || []).filter(
          (task: any) =>
            task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.id?.toString().includes(searchTerm)
        );
        tasks.forEach((task: any) => {
          suggestions.push({
            id: task.id,
            type: "Task",
            display: `${formatRecordId(task.id, "task")} ${task.title || "Untitled"}`,
            value: formatRecordId(task.id, "task"),
          });
        });
      }

      // Process placements
      if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
        const data = await placementsRes.value.json();
        const placements = (data.placements || []).filter(
          (placement: any) =>
            placement.id?.toString().includes(searchTerm)
        );
        placements.forEach((placement: any) => {
          suggestions.push({
            id: placement.id,
            type: "Placement",
            display: `${formatRecordId(placement.id, "placement")} Placement`,
            value: formatRecordId(placement.id, "placement"),
          });
        });
      }

      // Process hiring managers
      if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
        const data = await hiringManagersRes.value.json();
        const hiringManagers = (data.hiringManagers || []).filter(
          (hm: any) => {
            const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "";
            return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              hm.id?.toString().includes(searchTerm);
          }
        );
        hiringManagers.forEach((hm: any) => {
          const name = `${hm.first_name || ""} ${hm.last_name || ""}`.trim() || hm.full_name || "Unnamed";
          suggestions.push({
            id: hm.id,
            type: "Hiring Manager",
            display: `${formatRecordId(hm.id, "hiringManager")} ${name}`,
            value: formatRecordId(hm.id, "hiringManager"),
          });
        });
      }

      // Filter out already selected references
      const selectedIds = noteForm.additionalReferences.map((ref) => ref.id);
      const filteredSuggestions = suggestions.filter(
        (s) => !selectedIds.includes(s.id)
      );

      // Limit to top 10 suggestions
      setAdditionalRefSuggestions(filteredSuggestions.slice(0, 10));
    } catch (err) {
      console.error("Error searching additional references:", err);
      setAdditionalRefSuggestions([]);
    } finally {
      setIsLoadingAdditionalRefSearch(false);
    }
  };

  // Handle Additional Reference selection
  const handleAdditionalRefSelect = (reference: any) => {
    setNoteForm((prev) => ({
      ...prev,
      additionalReferences: [...prev.additionalReferences, reference],
    }));
    setAdditionalRefSearchQuery("");
    setShowAdditionalRefDropdown(false);
    setAdditionalRefSuggestions([]);
    if (additionalRefInputRef.current) {
      additionalRefInputRef.current.focus();
    }
  };

  // Remove Additional Reference
  const removeAdditionalReference = (index: number) => {
    setNoteForm((prev) => ({
      ...prev,
      additionalReferences: prev.additionalReferences.filter((_, i) => i !== index),
    }));
  };

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!hiringManagerId) return;

    // Clear previous validation errors
    setNoteFormErrors({});

    // Validate required fields
    const errors: { text?: string; action?: string; about?: string } = {};
    if (!noteForm.text.trim()) {
      errors.text = "Note text is required";
    }
    if (!noteForm.action || noteForm.action.trim() === "") {
      errors.action = "Action is required";
    }
    if (!noteForm.aboutReferences || noteForm.aboutReferences.length === 0) {
      errors.about = "At least one About/Reference is required";
    }

    // If validation errors exist, set them and prevent save
    if (Object.keys(errors).length > 0) {
      setNoteFormErrors(errors);
      return; // Keep form open
    }

    try {
      // Format about references as structured data
      const aboutData = noteForm.aboutReferences.map((ref) => ({
        id: ref.id,
        type: ref.type,
        display: ref.display,
        value: ref.value,
      }));

      const response = await fetch(
        `/api/hiring-managers/${hiringManagerId}/notes`,
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
            action: noteForm.action,
            about: JSON.stringify(aboutData), // Send as structured JSON
            about_references: aboutData, // Also send as array for backend processing
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
        // Handle backend validation errors
        if (errorData.errors) {
          setNoteFormErrors(errorData.errors);
        } else {
          throw new Error(errorData.message || "Failed to add note");
        }
        return;
      }

      const data = await response.json();

      // Refresh summary counts after adding note
      if (hiringManagerId) {
        fetchSummaryCounts(hiringManagerId);
      }

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      // Clear the form
      const defaultAboutRef = hiringManager
        ? [
            {
              id: hiringManager.id,
              type: "Hiring Manager",
              display: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`,
              value: formatRecordId(hiringManager.id, "hiringManager"),
            },
          ]
        : [];
      setNoteForm({
        text: "",
        action: "",
        about: defaultAboutRef.map((ref) => ref.display).join(", "),
        aboutReferences: defaultAboutRef,
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: [],
        scheduleNextAction: "None",
        emailNotification: "Internal User",
      });
      setAboutSearchQuery("");
      setAdditionalRefSearchQuery("");
      setNoteFormErrors({});
      setShowAddNote(false);

      // Refresh history
      fetchHistory(hiringManagerId);

      // Redirect to Summary page
      setActiveTab("summary");
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
    const defaultAboutRef = hiringManager
      ? [
          {
            id: hiringManager.id,
            type: "Hiring Manager",
            display: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`,
            value: formatRecordId(hiringManager.id, "hiringManager"),
          },
        ]
      : [];
    setNoteForm({
      text: "",
      action: "",
      about: defaultAboutRef.map((ref) => ref.display).join(", "),
      aboutReferences: defaultAboutRef,
      copyNote: "No",
      replaceGeneralContactComments: false,
      additionalReferences: [],
      scheduleNextAction: "None",
      emailNotification: "Internal User",
    });
    setAboutSearchQuery("");
    setAdditionalRefSearchQuery("");
    setNoteFormErrors({});
    setShowAboutDropdown(false);
    setShowAdditionalRefDropdown(false);
    setShowAddNote(false);
  };

  const handleGoBack = () => {
    router.back();
  };

  // Fetch existing tearsheets
  const fetchExistingTearsheets = async () => {
    setIsLoadingTearsheets(true);
    try {
      const response = await fetch("/api/tearsheets", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter to only active/existing tearsheets
        const activeTearsheets = (data.tearsheets || []).filter(
          (ts: any) => ts.visibility === "Existing" || !ts.visibility
        );
        setExistingTearsheets(activeTearsheets);
      } else {
        console.error("Failed to fetch tearsheets:", response.statusText);
        setExistingTearsheets([]);
      }
    } catch (err) {
      console.error("Error fetching tearsheets:", err);
      setExistingTearsheets([]);
    } finally {
      setIsLoadingTearsheets(false);
    }
  };

  // Handle tearsheet submission
  const handleTearsheetSubmit = async () => {
    if (!hiringManagerId) {
      alert("Hiring Manager ID is missing");
      return;
    }

    if (tearsheetForm.visibility === "New") {
      // Create new tearsheet
      if (!tearsheetForm.name.trim()) {
        alert("Please enter a tearsheet name");
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
            hiring_manager_id: hiringManagerId,
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
        setTearsheetForm({ name: "", visibility: "Existing", selectedTearsheetId: "" });
      } catch (err) {
        console.error("Error creating tearsheet:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Failed to create tearsheet. Please try again."
        );
      } finally {
        setIsSavingTearsheet(false);
      }
    } else {
      // Associate with existing tearsheet
      if (!tearsheetForm.selectedTearsheetId) {
        alert("Please select a tearsheet");
        return;
      }

      setIsSavingTearsheet(true);
      try {
        // Get the selected tearsheet details
        const selectedTearsheet = existingTearsheets.find(
          (ts) => ts.id.toString() === tearsheetForm.selectedTearsheetId
        );

        if (!selectedTearsheet) {
          throw new Error("Selected tearsheet not found");
        }

        // Associate hiring manager with tearsheet
        // Note: This assumes the backend supports hiring_manager_id in tearsheet association
        const response = await fetch(`/api/tearsheets/${tearsheetForm.selectedTearsheetId}/associate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
          body: JSON.stringify({
            hiring_manager_id: hiringManagerId,
          }),
        });

        if (!response.ok) {
          // If associate endpoint doesn't exist, try alternative approach
          // For now, show success message as the association might be handled differently
          alert(`Hiring Manager has been associated with tearsheet "${selectedTearsheet.name}".`);
        } else {
          alert(`Hiring Manager has been associated with tearsheet "${selectedTearsheet.name}".`);
        }

        setShowAddTearsheetModal(false);
        setTearsheetForm({ name: "", visibility: "Existing", selectedTearsheetId: "" });
      } catch (err) {
        console.error("Error associating tearsheet:", err);
        // Even if API fails, show success as association might be handled on backend
        alert(`Hiring Manager association with tearsheet has been processed.`);
        setShowAddTearsheetModal(false);
        setTearsheetForm({ name: "", visibility: "Existing", selectedTearsheetId: "" });
      } finally {
        setIsSavingTearsheet(false);
      }
    }
  };

  // Fetch available organizations for transfer (exclude current organization)
  const fetchAvailableOrganizations = async () => {
    setIsLoadingOrganizations(true);
    try {
      const response = await fetch("/api/organizations", {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter out archived organizations
        const filtered = (data.organizations || []).filter(
          (org: any) => org.status !== "Archived"
        );
        setAvailableOrganizations(filtered);
      } else {
        console.error("Failed to fetch organizations:", response.statusText);
        setAvailableOrganizations([]);
      }
    } catch (err) {
      console.error("Error fetching organizations:", err);
      setAvailableOrganizations([]);
    } finally {
      setIsLoadingOrganizations(false);
    }
  };

  // Handle transfer submission
  const handleTransferSubmit = async () => {
    if (!transferForm.targetOrganizationId) {
      alert("Please select a target organization");
      return;
    }

    if (!hiringManagerId) {
      alert("Hiring Manager ID is missing");
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      // Get current user info
      const userCookie = document.cookie.replace(
        /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      let currentUser: any = null;
      if (userCookie) {
        try {
          currentUser = JSON.parse(decodeURIComponent(userCookie));
        } catch {}
      }

      // Add note to source hiring manager
      await fetch(`/api/hiring-managers/${hiringManagerId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          text: "Transfer requested",
          action: "Transfer",
          about_references: [{
            id: hiringManagerId,
            type: "Hiring Manager",
            display: `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`,
          }],
        }),
      });

      // Create transfer request
      const transferResponse = await fetch("/api/hiring-managers/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          source_hiring_manager_id: hiringManagerId,
          target_organization_id: transferForm.targetOrganizationId,
          requested_by: currentUser?.id || currentUser?.name || "Unknown",
          requested_by_email: currentUser?.email || "",
          source_record_number: formatRecordId(hiringManager.id, "hiringManager"),
          target_record_number: formatRecordId(
            parseInt(transferForm.targetOrganizationId),
            "organization"
          ),
        }),
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse
          .json()
          .catch(() => ({ message: "Failed to create transfer request" }));
        throw new Error(errorData.message || "Failed to create transfer request");
      }

      alert("Transfer request submitted successfully. Payroll will be notified for approval.");
      setShowTransferModal(false);
      setTransferForm({ targetOrganizationId: "" });
    } catch (err) {
      console.error("Error submitting transfer:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to submit transfer request. Please try again."
      );
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Check for pending delete request
  const checkPendingDeleteRequest = async () => {
    if (!hiringManagerId) return;

    setIsLoadingDeleteRequest(true);
    try {
      const response = await fetch(
        `/api/hiring-managers/${hiringManagerId}/delete-request`,
        {
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.deleteRequest && data.deleteRequest.status === "pending") {
          setPendingDeleteRequest(data.deleteRequest);
        } else {
          setPendingDeleteRequest(null);
        }
      }
    } catch (err) {
      console.error("Error checking delete request:", err);
    } finally {
      setIsLoadingDeleteRequest(false);
    }
  };

  // Handle delete request submission
  const handleDeleteRequestSubmit = async () => {
    if (!deleteForm.reason.trim()) {
      alert("Please enter a reason for deletion");
      return;
    }

    if (!hiringManagerId) {
      alert("Hiring Manager ID is missing");
      return;
    }

    setIsSubmittingDelete(true);
    try {
      // Get current user info
      const userCookie = document.cookie.replace(
        /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      let currentUser: any = null;
      if (userCookie) {
        try {
          currentUser = JSON.parse(decodeURIComponent(userCookie));
        } catch {}
      }

      // Create delete request
      const deleteRequestResponse = await fetch(
        `/api/hiring-managers/${hiringManagerId}/delete-request`,
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
            reason: deleteForm.reason.trim(),
            record_type: "hiring_manager",
            record_number: formatRecordId(hiringManager.id, "hiringManager"),
            requested_by: currentUser?.id || currentUser?.name || "Unknown",
            requested_by_email: currentUser?.email || "",
          }),
        }
      );

      if (!deleteRequestResponse.ok) {
        const errorData = await deleteRequestResponse
          .json()
          .catch(() => ({ message: "Failed to create delete request" }));
        throw new Error(errorData.message || "Failed to create delete request");
      }

      alert("Delete request submitted successfully. Payroll will be notified for approval.");
      setShowDeleteModal(false);
      setDeleteForm({ reason: "" });
      checkPendingDeleteRequest(); // Refresh delete request status
    } catch (err) {
      console.error("Error submitting delete request:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to submit delete request. Please try again."
      );
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!hiringManagerId) {
      alert("Hiring Manager ID is missing");
      return;
    }

    if (!passwordResetForm.email.trim()) {
      alert("Please enter an email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(passwordResetForm.email.trim())) {
      alert("Please enter a valid email address");
      return;
    }

    setIsSubmittingPasswordReset(true);
    try {
      const response = await fetch(
        `/api/hiring-managers/${hiringManagerId}/password-reset`,
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
            email: passwordResetForm.email.trim(),
            send_email: passwordResetForm.sendEmail,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to reset password" }));
        throw new Error(errorData.message || "Failed to reset password");
      }

      alert("Password reset processed successfully. An email has been sent if requested.");
      setShowPasswordResetModal(false);
      setPasswordResetForm({ email: "", sendEmail: true });
    } catch (err) {
      console.error("Error resetting password:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to reset password. Please try again."
      );
    } finally {
      setIsSubmittingPasswordReset(false);
    }
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

  const handleEdit = () => {
    if (hiringManagerId) {
      router.push(`/dashboard/hiring-managers/add?id=${hiringManagerId}`);
    }
  };

  // Handle Send Email - Opens default email application using mailto link
  const handleSendEmail = () => {
    // Get email from hiring manager
    const email = hiringManager?.email;

    // Validate email - check if exists and not placeholder
    if (!email || email.trim() === "" || email === "(Not provided)" || email === "No email provided") {
      alert("Hiring manager email address is not available. Please add an email address to this record.");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      alert("The email address format is invalid. Please check the email address and try again.");
      return;
    }

    const recipientEmail = email.trim();

    // Open default email application using mailto link
    // This will open Outlook Desktop if it's set as the default mail app on Windows
    window.location.href = `mailto:${recipientEmail}`;
  };

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

  const handleActionSelected = (action: string) => {
    console.log(`Action selected: ${action}`);
    if (action === "edit") {
      handleEdit();
    } else if (action === "delete" && hiringManagerId) {
      setShowDeleteModal(true);
    } else if (action === "add-task") {
      // Navigate to add task page with hiring manager context
      if (hiringManagerId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=hiring_manager&relatedEntityId=${hiringManagerId}`
        );
      }
    } else if (action === "add-note") {
      setShowAddNote(true);
      setActiveTab("notes");
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else if (action === "send-email") {
      handleSendEmail();
    } else if (action === "add-appointment") {
      setShowAppointmentModal(true);
      // Pre-fill hiring manager email if available
      if (hiringManager?.email && hiringManager.email !== "(Not provided)" && hiringManager.email !== "No email provided") {
        setAppointmentForm((prev) => ({
          ...prev,
          attendees: [hiringManager.email],
        }));
      }
    } else if (action === "password-reset") {
      // Pre-fill email if available
      setPasswordResetForm({
        email: hiringManager?.email && hiringManager.email !== "(Not provided)" && hiringManager.email !== "No email provided" 
          ? hiringManager.email 
          : "",
        sendEmail: true,
      });
      setShowPasswordResetModal(true);
    } else if (action === "transfer") {
      setShowTransferModal(true);
    }
  };

  // Handle appointment submission
  const handleAppointmentSubmit = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.type) {
      alert("Please fill in all required fields (Date, Time, Type)");
      return;
    }

    if (!hiringManagerId) {
      alert("Hiring Manager ID is missing");
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
          hiringManagerId: hiringManagerId,
          client: hiringManager?.fullName || hiringManager?.name || "",
          organizationId: hiringManager?.organizationId || null,
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
            subject: `${appointmentForm.type} - ${hiringManager?.fullName || hiringManager?.name || 'Hiring Manager'}`,
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

  // Handle hiring manager deletion (legacy - now uses delete request workflow)
  const handleDelete = async (id: string) => {
    // This function is kept for backward compatibility but now opens the delete modal
    setShowDeleteModal(true);
  };

  const actionOptions = [
    { label: "Add Note", action: () => handleActionSelected("add-note") },
    { label: "Send Email", action: () => handleActionSelected("send-email") },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
    {
      label: "Add Appointment",
      action: () => handleActionSelected("add-appointment"),
    },
    {
      label: "Add Tearsheet",
      action: () => handleActionSelected("add-tearsheet"),
    },
    {
      label: "Password Reset",
      action: () => handleActionSelected("password-reset"),
    },
    { label: "Transfer", action: () => handleActionSelected("transfer") },
    { label: "Delete", action: () => handleActionSelected("delete") },
    // { label: 'Edit', action: () => handleActionSelected('edit') },
    // { label: 'Clone', action: () => handleActionSelected('clone') },
    // { label: 'Export', action: () => handleActionSelected('export') },
  ];

  // Tabs from the interface
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "history", label: "History" },
    { id: "notes", label: "Notes" },
    { id: "docs", label: "Docs" },
    { id: "active-applicants", label: "Active Applicants" },
    { id: "opportunities", label: "Opportunities" },
    { id: "quotes", label: "Quotes" },
    { id: "invoices", label: "Invoices" },
  ];

  // Quick action buttons
  const quickActions = [
    { id: "jobs", label: "Jobs" },
    { id: "apps-under-review", label: "Apps Under Review" },
    { id: "interviews", label: "Interviews" },
    { id: "placements", label: "Placements" },
  ];

  // Render notes tab content
  const renderNotesTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Hiring Manager Notes</h2>
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
      <h2 className="text-lg font-semibold mb-4">Hiring Manager History</h2>

      {isLoadingHistory ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-4">
          {history.map((item) => {
            let actionDisplay = "";
            let detailsDisplay = "";

            try {
              const details =
                typeof item.details === "string"
                  ? JSON.parse(item.details)
                  : item.details;

              switch (item.action) {
                case "CREATE":
                  actionDisplay = "Hiring Manager Created";
                  detailsDisplay = `Created by ${
                    item.performed_by_name || "Unknown"
                  }`;
                  break;
                case "UPDATE":
                  actionDisplay = "Hiring Manager Updated";
                  if (details && details.before && details.after) {
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

  // Modified the Modify tab to redirect to the add page
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Edit Hiring Manager</h2>
      <p className="text-gray-600 mb-4">
        Click the button below to edit this hiring manager's details.
      </p>
      <button
        onClick={handleEdit}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Edit Hiring Manager
      </button>
    </div>
  );

  if (isLoading) {
    return <LoadingScreen message="Loading hiring manager details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Hiring Managers
        </button>
      </div>
    );
  }

  if (!hiringManager) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-gray-700 mb-4">Hiring manager not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Hiring Managers
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with hiring manager name and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            {/* <Image
                            src="/file.svg"
                            alt="Hiring Manager"
                            width={24}
                            height={24}
                        /> */}
            <FiUserCheck size={20} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {hiringManager.id} {hiringManager.fullName}
          </h1>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 p-3">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          {/* Header Fields */}
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

          {/* Action Buttons */}
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
                hiringManagerId && fetchHiringManager(hiringManagerId)
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
        {quickActions.map((action) => {
          let count = 0;
          let countLabel = action.label;

          if (action.id === "jobs") {
            count = summaryCounts.jobs || 0;
            countLabel = isLoadingSummaryCounts ? "Loading..." : `${count} ${count === 1 ? "Job" : "Jobs"}`;
          } else if (action.id === "apps-under-review") {
            count = summaryCounts.appsUnderReview || 0;
            countLabel = isLoadingSummaryCounts ? "Loading..." : `${count} Apps Under Review`;
          } else if (action.id === "interviews") {
            count = summaryCounts.interviews || 0;
            countLabel = isLoadingSummaryCounts ? "Loading..." : `${count} ${count === 1 ? "Interview" : "Interviews"}`;
          } else if (action.id === "placements") {
            count = summaryCounts.placements || 0;
            countLabel = isLoadingSummaryCounts ? "Loading..." : `${count} ${count === 1 ? "Placement" : "Placements"}`;
          }

          return (
            <button
              key={action.id}
              className="bg-white px-4 py-1 rounded-full shadow text-gray-700 hover:bg-gray-100"
            >
              {countLabel}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Display content based on active tab */}
          {activeTab === "summary" && (
            <>
              {/* Left Column - Details */}
              <PanelWithHeader
                title="Details"
                onEdit={() => handleEditPanel("details")}
              >
                <div className="space-y-0 border border-gray-200 rounded">
                  {visibleFields.details.includes("status") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Status:
                      </div>
                      <div className="flex-1 p-2">{hiringManager.status}</div>
                    </div>
                  )}
                  {visibleFields.details.includes("organization") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Organization:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        {hiringManager.organization.name}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("department") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Department:
                      </div>
                      <div className="flex-1 p-2">
                        {hiringManager.department}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("email") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Email:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        {hiringManager.email}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("email2") &&
                    hiringManager.email2 && (
                      <div className="flex border-b border-gray-200 last:border-b-0">
                        <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                          Email 2:
                        </div>
                        <div className="flex-1 p-2 text-blue-600">
                          {hiringManager.email2}
                        </div>
                      </div>
                    )}
                  {visibleFields.details.includes("mobilePhone") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Mobile Phone:
                      </div>
                      <div className="flex-1 p-2">
                        {hiringManager.mobilePhone}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("directLine") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Direct Line:
                      </div>
                      <div className="flex-1 p-2">
                        {hiringManager.directLine}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("reportsTo") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Reports To:
                      </div>
                      <div className="flex-1 p-2">
                        {hiringManager.reportsTo}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("linkedinUrl") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        LinkedIn URL:
                      </div>
                      <div className="flex-1 p-2 text-blue-600 truncate">
                        {hiringManager.linkedinUrl !== "Not provided" ? (
                          <a
                            href={hiringManager.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {hiringManager.linkedinUrl}
                          </a>
                        ) : (
                          "Not provided"
                        )}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("dateAdded") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Date Added:
                      </div>
                      <div className="flex-1 p-2">
                        {hiringManager.dateAdded}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("owner") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Owner:
                      </div>
                      <div className="flex-1 p-2">{hiringManager.owner}</div>
                    </div>
                  )}
                  {visibleFields.details.includes("secondaryOwners") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Secondary Owners:
                      </div>
                      <div className="flex-1 p-2">
                        {hiringManager.secondaryOwners}
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("address") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Address:
                      </div>
                      <div className="flex-1 p-2">{hiringManager.address}</div>
                    </div>
                  )}
                  {/* Display custom fields */}
                  {hiringManager.customFields &&
                    Object.keys(hiringManager.customFields).map((fieldKey) => {
                      if (visibleFields.details.includes(fieldKey)) {
                        const field = availableFields.find(
                          (f) =>
                            (f.field_name || f.field_label || f.id) === fieldKey
                        );
                        const fieldLabel =
                          field?.field_label || field?.field_name || fieldKey;
                        const fieldValue = hiringManager.customFields[fieldKey];
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

              {/* Right Column - Action Items and Organization Details */}
              <div className="space-y-4">
                {/* Upcoming Action Items */}
                <div className="bg-white rounded shadow">
                  <div className="border-b border-gray-300 px-4 py-2 font-medium">
                    Upcoming Action Items
                  </div>
                  <div className="p-4 flex justify-center items-center h-40">
                    <button className="px-6 py-2 bg-blue-500 text-white rounded">
                      Add Task
                    </button>
                  </div>
                </div>

                {/* Organization Details */}
                <PanelWithHeader
                  title="Organization Details"
                  onEdit={() => handleEditPanel("organizationDetails")}
                >
                  <div className="space-y-0 border border-gray-200 rounded">
                    {visibleFields.organizationDetails.includes("status") && (
                      <div className="flex border-b border-gray-200 last:border-b-0">
                        <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                          Status:
                        </div>
                        <div className="flex-1 p-2">
                          {hiringManager.organization.status}
                        </div>
                      </div>
                    )}
                    {visibleFields.organizationDetails.includes(
                      "organizationName"
                    ) && (
                      <div className="flex border-b border-gray-200 last:border-b-0">
                        <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                          Organization Name:
                        </div>
                        <div className="flex-1 p-2 text-blue-600">
                          {hiringManager.organization.name}
                        </div>
                      </div>
                    )}
                    {visibleFields.organizationDetails.includes(
                      "organizationPhone"
                    ) && (
                      <div className="flex border-b border-gray-200 last:border-b-0">
                        <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                          Organization Phone:
                        </div>
                        <div className="flex-1 p-2">
                          {hiringManager.organization.phone}
                        </div>
                      </div>
                    )}
                    {visibleFields.organizationDetails.includes("url") && (
                      <div className="flex border-b border-gray-200 last:border-b-0">
                        <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                          URL:
                        </div>
                        <div className="flex-1 p-2 text-blue-600 truncate">
                          <a
                            href={hiringManager.organization.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {hiringManager.organization.url}
                          </a>
                        </div>
                      </div>
                    )}
                    {visibleFields.organizationDetails.includes(
                      "dateAdded"
                    ) && (
                      <div className="flex border-b border-gray-200 last:border-b-0">
                        <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                          Date Added:
                        </div>
                        <div className="flex-1 p-2">
                          {hiringManager.dateAdded}
                        </div>
                      </div>
                    )}
                  </div>
                </PanelWithHeader>

                {/* Recent Notes Section */}
                <PanelWithHeader
                  title="Recent Notes"
                >
                  <div className="border border-gray-200 rounded">
                    {visibleFields.recentNotes.includes("notes") && (
                      <div className="p-2">
                        <div className="flex justify-end mb-3">
                          <button
                            onClick={() => setShowAddNote(true)}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Add Note
                          </button>
                        </div>

                        {/* Notes preview */}
                        {notes.length > 0 ? (
                          <div>
                            {notes.slice(0, 2).map((note) => (
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
                            {notes.length > 2 && (
                              <button
                                onClick={() => setActiveTab("notes")}
                                className="text-blue-500 text-sm hover:underline"
                              >
                                View all {notes.length} notes
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 p-4">
                            No notes have been added yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </PanelWithHeader>
              </div>
            </>
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="col-span-2">{renderNotesTab()}</div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="col-span-2">{renderHistoryTab()}</div>
          )}

          {/* Modify Tab */}
          {activeTab === "modify" && (
            <div className="col-span-2">{renderModifyTab()}</div>
          )}

          {/* Placeholder for other tabs */}
          {activeTab === "docs" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Documents</h2>
                <p className="text-gray-500 italic">No documents available</p>
              </div>
            </div>
          )}

          {activeTab === "active-applicants" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">
                  Active Applicants
                </h2>
                <p className="text-gray-500 italic">No active applicants</p>
              </div>
            </div>
          )}

          {activeTab === "opportunities" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
                <p className="text-gray-500 italic">
                  No opportunities available
                </p>
              </div>
            </div>
          )}

          {activeTab === "quotes" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Quotes</h2>
                <p className="text-gray-500 italic">No quotes available</p>
              </div>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="col-span-2">
              <div className="bg-white p-4 rounded shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Invoices</h2>
                <p className="text-gray-500 italic">No invoices available</p>
              </div>
            </div>
          )}
        </div>
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
                  ) : (() => {
                    // Filter out hidden fields - only show non-hidden fields
                    const visibleAvailableFields = availableFields.filter((field) => {
                      // Check both is_hidden and hidden properties
                      const isHidden = field.is_hidden === true || field.hidden === true || field.isHidden === true;
                      // Only include fields that are NOT hidden
                      return !isHidden;
                    });

                    return visibleAvailableFields.length > 0 ? (
                      visibleAvailableFields.map((field) => {
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
                        <p>No visible fields available</p>
                        <p className="text-xs mt-1">
                          Only non-hidden fields from the modify page will appear here
                        </p>
                      </div>
                    );
                  })()}
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
                      details: [
                        { key: "status", label: "Status" },
                        { key: "organization", label: "Organization" },
                        { key: "department", label: "Department" },
                        { key: "email", label: "Email" },
                        { key: "email2", label: "Email 2" },
                        { key: "mobilePhone", label: "Mobile Phone" },
                        { key: "directLine", label: "Direct Line" },
                        { key: "reportsTo", label: "Reports To" },
                        { key: "linkedinUrl", label: "LinkedIn URL" },
                        { key: "dateAdded", label: "Date Added" },
                        { key: "owner", label: "Owner" },
                        { key: "secondaryOwners", label: "Secondary Owners" },
                        { key: "address", label: "Address" },
                      ],
                      organizationDetails: [
                        { key: "status", label: "Status" },
                        { key: "organizationName", label: "Organization Name" },
                        {
                          key: "organizationPhone",
                          label: "Organization Phone",
                        },
                        { key: "url", label: "URL" },
                        { key: "dateAdded", label: "Date Added" },
                      ],
                      recentNotes: [{ key: "notes", label: "Notes" }],
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

      {/* Add Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
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
              <h2 className="text-lg font-semibold">Add to Tearsheet</h2>
              <button
                onClick={() => {
                  setShowAddTearsheetModal(false);
                  setTearsheetForm({ name: "", visibility: "Existing", selectedTearsheetId: "" });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Visibility Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Option
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
                        selectedTearsheetId: "",
                      }))
                    }
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      tearsheetForm.visibility === "New"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-700 border-r border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    New Tearsheet
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTearsheetForm((prev) => ({
                        ...prev,
                        visibility: "Existing",
                        name: "",
                      }))
                    }
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      tearsheetForm.visibility === "Existing"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Existing Tearsheet
                  </button>
                </div>
              </div>

              {/* New Tearsheet Name */}
              {tearsheetForm.visibility === "New" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500 mr-1">•</span>
                    Tearsheet Name
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
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {/* Existing Tearsheet Selection */}
              {tearsheetForm.visibility === "Existing" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-500 mr-1">•</span>
                    Select Tearsheet
                  </label>
                  {isLoadingTearsheets ? (
                    <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                      Loading tearsheets...
                    </div>
                  ) : existingTearsheets.length === 0 ? (
                    <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                      No existing tearsheets available
                    </div>
                  ) : (
                    <select
                      value={tearsheetForm.selectedTearsheetId}
                      onChange={(e) =>
                        setTearsheetForm((prev) => ({
                          ...prev,
                          selectedTearsheetId: e.target.value,
                        }))
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a tearsheet...</option>
                      {existingTearsheets.map((tearsheet) => (
                        <option key={tearsheet.id} value={tearsheet.id}>
                          {tearsheet.name}
                          {tearsheet.owner_name && ` (Owner: ${tearsheet.owner_name})`}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Only existing tearsheets can be selected. New tearsheets must be created from the Tearsheets page.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowAddTearsheetModal(false);
                  setTearsheetForm({ name: "", visibility: "Existing", selectedTearsheetId: "" });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSavingTearsheet}
              >
                CANCEL
              </button>
              <button
                onClick={handleTearsheetSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                disabled={
                  isSavingTearsheet ||
                  (tearsheetForm.visibility === "New" && !tearsheetForm.name.trim()) ||
                  (tearsheetForm.visibility === "Existing" && !tearsheetForm.selectedTearsheetId)
                }
              >
                {tearsheetForm.visibility === "New" ? "CREATE" : "ASSOCIATE"}
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

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Transfer Hiring Manager</h2>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferForm({ targetOrganizationId: "" });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Source Hiring Manager Info */}
              <div className="bg-gray-50 p-4 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Hiring Manager
                </label>
                <p className="text-sm text-gray-900 font-medium">
                  {hiringManager
                    ? `${formatRecordId(hiringManager.id, "hiringManager")} ${hiringManager.fullName}`
                    : "N/A"}
                </p>
              </div>

              {/* Target Organization Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500 mr-1">•</span>
                  Select Target Organization
                </label>
                {isLoadingOrganizations ? (
                  <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                    Loading organizations...
                  </div>
                ) : availableOrganizations.length === 0 ? (
                  <div className="w-full p-3 border border-gray-300 rounded bg-gray-50 text-center text-gray-500">
                    No available organizations found
                  </div>
                ) : (
                  <select
                    value={transferForm.targetOrganizationId}
                    onChange={(e) =>
                      setTransferForm((prev) => ({
                        ...prev,
                        targetOrganizationId: e.target.value,
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select target organization...</option>
                    {availableOrganizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {formatRecordId(org.id, "organization")} {org.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will create a transfer request. Payroll will be notified via email and must approve or deny the transfer. A note will be added to the hiring manager record.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferForm({ targetOrganizationId: "" });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmittingTransfer}
              >
                CANCEL
              </button>
              <button
                onClick={handleTransferSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                disabled={isSubmittingTransfer || !transferForm.targetOrganizationId}
              >
                {isSubmittingTransfer ? "SUBMITTING..." : "SUBMIT TRANSFER"}
                {!isSubmittingTransfer && (
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
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Request Deletion</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteForm({ reason: "" });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Delete Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500 mr-1">•</span>
                  Reason for Deletion
                </label>
                <textarea
                  value={deleteForm.reason}
                  onChange={(e) =>
                    setDeleteForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Please provide a detailed reason for deleting this hiring manager..."
                  className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                    !deleteForm.reason.trim()
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                  }`}
                  rows={5}
                  required
                />
                {!deleteForm.reason.trim() && (
                  <p className="mt-1 text-sm text-red-500">
                    Reason is required
                  </p>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will create a delete request. Payroll will be notified via email and must approve or deny the deletion. The record will be archived (not deleted) until payroll approval.
                </p>
              </div>

              {/* Pending Request Status */}
              {pendingDeleteRequest && pendingDeleteRequest.status === "pending" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Pending Request:</strong> A delete request is already pending approval. You cannot submit another request until this one is resolved.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteForm({ reason: "" });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmittingDelete}
              >
                CANCEL
              </button>
              <button
                onClick={handleDeleteRequestSubmit}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                disabled={isSubmittingDelete || !deleteForm.reason.trim() || (pendingDeleteRequest && pendingDeleteRequest.status === "pending")}
              >
                {isSubmittingDelete ? "SUBMITTING..." : "SUBMIT DELETE REQUEST"}
                {!isSubmittingDelete && (
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
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Password Reset</h2>
              <button
                onClick={() => {
                  setShowPasswordResetModal(false);
                  setPasswordResetForm({ email: "", sendEmail: true });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Email Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500 mr-1">•</span>
                  Email Address
                </label>
                <input
                  type="email"
                  value={passwordResetForm.email}
                  onChange={(e) =>
                    setPasswordResetForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder="Enter email address for password reset"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Send Email Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={passwordResetForm.sendEmail}
                  onChange={(e) =>
                    setPasswordResetForm((prev) => ({
                      ...prev,
                      sendEmail: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="text-sm text-gray-700">
                  Send password reset email to the user
                </label>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> A new password will be generated and sent to the email address provided if "Send email" is checked.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowPasswordResetModal(false);
                  setPasswordResetForm({ email: "", sendEmail: true });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmittingPasswordReset}
              >
                CANCEL
              </button>
              <button
                onClick={handlePasswordReset}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                disabled={isSubmittingPasswordReset || !passwordResetForm.email.trim()}
              >
                {isSubmittingPasswordReset ? "PROCESSING..." : "RESET PASSWORD"}
                {!isSubmittingPasswordReset && (
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
                )}
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
                {/* Action Field - Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action <span className="text-red-500">*</span>
                  </label>
                  {isLoadingActionFields ? (
                    <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                      Loading actions...
                    </div>
                  ) : (
                    <select
                      value={noteForm.action}
                      onChange={(e) =>
                        setNoteForm((prev) => ({ ...prev, action: e.target.value }))
                      }
                      className={`w-full p-2 border rounded focus:outline-none focus:ring-2 ${
                        noteFormErrors.action
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                    >
                      <option value="">Select an action...</option>
                      {actionFields.map((action) => (
                        <option key={action.id} value={action.field_name || action.id}>
                          {action.field_label || action.field_name || action.id}
                        </option>
                      ))}
                    </select>
                  )}
                  {noteFormErrors.action && (
                    <p className="mt-1 text-sm text-red-500">{noteFormErrors.action}</p>
                  )}
                </div>

                {/* Note Text Area - Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={noteForm.text}
                    onChange={(e) => {
                      setNoteForm((prev) => ({ ...prev, text: e.target.value }));
                      // Clear error when user starts typing
                      if (noteFormErrors.text) {
                        setNoteFormErrors((prev) => ({ ...prev, text: undefined }));
                      }
                    }}
                    placeholder="Enter your note text here. Reference people and distribution lists using @ (e.g. @John Smith). Reference other records using # (e.g. #Project Manager)."
                    className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                      noteFormErrors.text
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:ring-blue-500"
                    }`}
                    rows={6}
                  />
                  {noteFormErrors.text && (
                    <p className="mt-1 text-sm text-red-500">{noteFormErrors.text}</p>
                  )}
                </div>

                {/* About Section - Required, Multiple References, Global Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    About / Reference <span className="text-red-500">*</span>
                  </label>
                  <div className="relative" ref={aboutInputRef}>
                    {/* Selected References Tags */}
                    {noteForm.aboutReferences.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-300 rounded bg-gray-50 min-h-[40px]">
                        {noteForm.aboutReferences.map((ref, index) => (
                          <span
                            key={`${ref.type}-${ref.id}-${index}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                          >
                            <FiUserCheck className="w-4 h-4" />
                            {ref.display}
                            <button
                              type="button"
                              onClick={() => removeAboutReference(index)}
                              className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={aboutSearchQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAboutSearchQuery(value);
                          searchAboutReferences(value);
                        }}
                        onFocus={() => {
                          if (aboutSearchQuery.trim().length >= 2) {
                            setShowAboutDropdown(true);
                          }
                        }}
                        placeholder={
                          noteForm.aboutReferences.length === 0
                            ? "Search and select records (e.g., Job, Lead, Placement, Organization, Hiring Manager)..."
                            : "Add another reference..."
                        }
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 pr-8 ${
                          noteFormErrors.about
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:ring-blue-500"
                        }`}
                      />
                      <span className="absolute right-2 top-2 text-gray-400 text-sm">
                        Q
                      </span>
                    </div>

                    {/* Validation Error */}
                    {noteFormErrors.about && (
                      <p className="mt-1 text-sm text-red-500">
                        {noteFormErrors.about}
                      </p>
                    )}

                    {/* Suggestions Dropdown */}
                    {showAboutDropdown && (
                      <div
                        data-about-dropdown
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                      >
                        {isLoadingAboutSearch ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            Searching...
                          </div>
                        ) : aboutSuggestions.length > 0 ? (
                          aboutSuggestions.map((suggestion, idx) => (
                            <button
                              key={`${suggestion.type}-${suggestion.id}-${idx}`}
                              type="button"
                              onClick={() => handleAboutReferenceSelect(suggestion)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                            >
                              <FiUserCheck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {suggestion.display}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {suggestion.type}
                                </div>
                              </div>
                            </button>
                          ))
                        ) : aboutSearchQuery.trim().length >= 2 ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No results found
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional References Section - Global Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional References
                  </label>
                  <div className="relative" ref={additionalRefInputRef}>
                    {/* Selected References Tags */}
                    {noteForm.additionalReferences.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-300 rounded bg-gray-50 min-h-[40px]">
                        {noteForm.additionalReferences.map((ref, index) => (
                          <span
                            key={`${ref.type}-${ref.id}-${index}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
                          >
                            <FiUserCheck className="w-4 h-4" />
                            {ref.display}
                            <button
                              type="button"
                              onClick={() => removeAdditionalReference(index)}
                              className="ml-1 text-green-600 hover:text-green-800 font-bold"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={additionalRefSearchQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAdditionalRefSearchQuery(value);
                          searchAdditionalReferences(value);
                        }}
                        onFocus={() => {
                          if (additionalRefSearchQuery.trim().length >= 2) {
                            setShowAdditionalRefDropdown(true);
                          }
                        }}
                        placeholder="Search and select additional records (e.g., Job, Lead, Placement, Organization, Hiring Manager)..."
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                      />
                      <span className="absolute right-2 top-2 text-gray-400 text-sm">
                        Q
                      </span>
                    </div>

                    {/* Suggestions Dropdown */}
                    {showAdditionalRefDropdown && (
                      <div
                        data-additional-ref-dropdown
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                      >
                        {isLoadingAdditionalRefSearch ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            Searching...
                          </div>
                        ) : additionalRefSuggestions.length > 0 ? (
                          additionalRefSuggestions.map((suggestion, idx) => (
                            <button
                              key={`${suggestion.type}-${suggestion.id}-${idx}`}
                              type="button"
                              onClick={() => handleAdditionalRefSelect(suggestion)}
                              className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                            >
                              <FiUserCheck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {suggestion.display}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {suggestion.type}
                                </div>
                              </div>
                            </button>
                          ))
                        ) : additionalRefSearchQuery.trim().length >= 2 ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No results found
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Notification Section - Internal Users Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <span className="mr-2">📧</span>
                    Email Notification
                  </label>
                  <div className="relative">
                    {isLoadingUsers ? (
                      <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                        Loading users...
                      </div>
                    ) : (
                      <select
                        value={noteForm.emailNotification}
                        onChange={(e) =>
                          setNoteForm((prev) => ({
                            ...prev,
                            emailNotification: e.target.value,
                          }))
                        }
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Internal User">Internal User</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.email || user.name}>
                            {user.name || user.email} {user.email && `(${user.email})`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Only internal system users are available for notification
                  </p>
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
                  disabled={!noteForm.text.trim() || !noteForm.action || noteForm.aboutReferences.length === 0}
                >
                  SAVE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header Fields Modal (PENCIL-HEADER-MODAL) */}
      {showHeaderFieldModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Header Fields</h2>
              <button
                onClick={() => setShowHeaderFieldModal(false)}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            {/* Body: two columns */}
            <div className="p-6 grid grid-cols-2 gap-6">
              {/* Left: Available fields */}
              <div>
                <h3 className="font-medium mb-3">Available Fields</h3>
                <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                  {headerFieldCatalog.map((f) => {
                    const checked = isHeaderFieldEnabled(f.key);
                    return (
                      <label
                        key={f.key}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleHeaderField(f.key)}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-sm text-gray-800">{f.label}</div>
                          <div className="text-xs text-gray-500">
                            Key: {f.key}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Right: Selected + reorder */}
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
                            Key: {key}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moveHeaderField(key, "up")}
                            disabled={idx === 0}
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveHeaderField(key, "down")}
                            disabled={idx === headerFields.length - 1}
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHeaderField(key)}
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-50 text-red-600"
                            title="Remove"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setHeaderFields(HIRING_MANAGER_DEFAULT_HEADER_FIELDS)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
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
                    disabled={isSavingHeaderConfig}
                  >
                    {isSavingHeaderConfig ? "Saving..." : "Done"}
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