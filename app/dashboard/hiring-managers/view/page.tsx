'use client'

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';
import PanelWithHeader from '@/components/PanelWithHeader';
import { FiUserCheck } from 'react-icons/fi';
import { formatRecordId } from '@/lib/recordIdFormatter';

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
    about: hiringManager ? `${hiringManager.id} ${hiringManager.fullName}` : "",
    copyNote: "No",
    replaceGeneralContactComments: false,
    additionalReferences: "",
    scheduleNextAction: "None",
    emailNotification: "Internal User",
  });

  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

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
  const DEFAULT_HEADER_FIELDS = ["phone", "email"];

  const [headerFields, setHeaderFields] = useState<string[]>([]);
  const [showHeaderFieldModal, setShowHeaderFieldModal] = useState(false);

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

  // ✅ Load header fields from localStorage (or defaults)
  useEffect(() => {
    if (!hiringManagerId) return;
    const storageKey = `hiringManager_header_fields_${hiringManagerId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHeaderFields(parsed);
          return;
        }
      } catch {}
    }
    // fallback to defaults
    setHeaderFields(DEFAULT_HEADER_FIELDS);
  }, [hiringManagerId]);

  // ✅ Save header fields to localStorage
  useEffect(() => {
    if (!hiringManagerId) return;
    const storageKey = `hiringManager_header_fields_${hiringManagerId}`;
    localStorage.setItem(storageKey, JSON.stringify(headerFields));
  }, [hiringManagerId, headerFields]);

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
  });
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);

 

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

    // ✅ save fields for modal/catalog
    setAvailableFields(fields);

    // ✅ FORCE ALL custom fields to show in Details panel (22/22)
    const allCustomKeys = fields.map(
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

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!noteForm.text.trim() || !hiringManagerId) return;

    try {
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
        throw new Error("Failed to add note");
      }

      const data = await response.json();

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      // Clear the form
      setNoteForm({
        text: "",
        about: hiringManager
          ? `${formatRecordId(hiringManager.id, "hiringManager")} ${
              hiringManager.fullName
            }`
          : "",
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: "",
        scheduleNextAction: "None",
        emailNotification: "Internal User",
      });
      setShowAddNote(false);

      // Refresh history
      fetchHistory(hiringManagerId);
    } catch (err) {
      console.error("Error adding note:", err);
      alert("Failed to add note. Please try again.");
    }
  };

  // Close add note modal
  const handleCloseAddNoteModal = () => {
    setShowAddNote(false);
    setNoteForm({
      text: "",
      about: hiringManager
        ? `${formatRecordId(hiringManager.id, "hiringManager")} ${
            hiringManager.fullName
          }`
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

  // Handle tearsheet submission
  const handleTearsheetSubmit = async () => {
    if (!tearsheetForm.name.trim()) {
      alert("Please enter a tearsheet name");
      return;
    }

    if (!hiringManagerId) {
      alert("Hiring Manager ID is missing");
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

  const handleActionSelected = (action: string) => {
    console.log(`Action selected: ${action}`);
    if (action === "edit") {
      handleEdit();
    } else if (action === "delete" && hiringManagerId) {
      handleDelete(hiringManagerId);
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
      // Handle send email - use Outlook web compose deep link
      if (hiringManager?.email && hiringManager.email !== "(Not provided)") {
        const recipientEmail = hiringManager.email;
        const outlookComposeUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(
          recipientEmail
        )}`;
        window.open(outlookComposeUrl, "_blank");
      } else {
        alert("Hiring manager email not available");
      }
    }
  };

  // Handle hiring manager deletion
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this hiring manager?")) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/hiring-managers/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete hiring manager");
      }

      // Redirect to the hiring managers list
      router.push("/dashboard/hiring-managers");
    } catch (error) {
      console.error("Error deleting hiring manager:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while deleting the hiring manager"
      );
      setIsLoading(false);
    }
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
        {quickActions.map((action) => (
          <button
            key={action.id}
            className="bg-white px-4 py-1 rounded-full shadow text-gray-700 hover:bg-gray-100"
          >
            {action.label}
          </button>
        ))}
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
                  onEdit={() => handleEditPanel("recentNotes")}
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
                          <option key={user.id} value={user.name || user.email}>
                            {user.name || user.email}
                          </option>
                        ))}
                      </select>
                    )}
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
                    onClick={() => setHeaderFields(DEFAULT_HEADER_FIELDS)}
                    className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowHeaderFieldModal(false)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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