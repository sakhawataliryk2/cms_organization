"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import PanelWithHeader from "@/components/PanelWithHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { FiTarget } from "react-icons/fi";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";

// Default header fields for Leads module - defined outside component to ensure stable reference
const LEAD_DEFAULT_HEADER_FIELDS = ["phone", "email"];

export default function LeadView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("id");

  const [lead, setLead] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes and history state
  const [notes, setNotes] = useState<
    Array<{
      id: string;
      text: string;
      created_at: string;
      created_by_name: string;
      note_type?: string;
    }>
  >([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("General Note");

  // Documents state
  const [documents, setDocuments] = useState<Array<any>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newDocumentType, setNewDocumentType] = useState("General");
  const [newDocumentContent, setNewDocumentContent] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  // Tearsheet modal state
  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);
  const [tearsheetForm, setTearsheetForm] = useState({
    name: '',
    visibility: 'Existing' // 'New' or 'Existing'
  });
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);

  // Current active tab
  const [activeTab, setActiveTab] = useState("summary");

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>({
    contactInfo: ['fullName', 'nickname', 'title', 'organizationName', 'department', 'phone', 'mobilePhone', 'email', 'email2', 'fullAddress', 'linkedinUrl'],
    details: ['status', 'owner', 'reportsTo', 'dateAdded', 'lastContactDate'],
    recentNotes: ['notes'],
    websiteJobs: ['jobs'],
    ourJobs: ['jobs']
  });
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
    // =========================
  // PENCIL-HEADER-MODAL (Lead Header Fields Row)
  // =========================
 
  const {
    headerFields,
    setHeaderFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    saveHeaderConfig,
  } = useHeaderConfig({
    entityType: "LEAD",
    defaultFields: LEAD_DEFAULT_HEADER_FIELDS,
  });

  // Standard fields allowed in header row
  const standardHeaderFieldDefs: Array<{
    key: string;
    label: string;
    getValue: (l: any) => any;
    type?: "text" | "email" | "phone" | "badge" | "link";
  }> = [
    { key: "phone", label: "Phone", type: "phone", getValue: (l) => l?.phone },
    { key: "mobilePhone", label: "Mobile", type: "phone", getValue: (l) => l?.mobilePhone },
    { key: "email", label: "Email", type: "email", getValue: (l) => l?.email },
    { key: "email2", label: "Email 2", type: "email", getValue: (l) => l?.email2 },
    { key: "status", label: "Status", type: "badge", getValue: (l) => l?.status },
    { key: "owner", label: "Owner", type: "text", getValue: (l) => l?.owner },
    { key: "title", label: "Title", type: "text", getValue: (l) => l?.title },
    { key: "organizationName", label: "Organization", type: "text", getValue: (l) => l?.organizationName || l?.organizationId },
    { key: "department", label: "Department", type: "text", getValue: (l) => l?.department },
    { key: "linkedinUrl", label: "LinkedIn", type: "link", getValue: (l) => l?.linkedinUrl },
    { key: "lastContactDate", label: "Last Contact", type: "text", getValue: (l) => l?.lastContactDate },
  ];

  // Custom fields (from lead.customFields) as header-eligible definitions
  const customHeaderFieldDefs = (lead?.customFields ? Object.keys(lead.customFields) : []).map((fieldKey) => {
    const meta = availableFields.find(
      (f) => (f.field_name || f.field_label || f.id) === fieldKey
    );
    return {
      key: fieldKey,
      label: meta?.field_label || meta?.field_name || fieldKey,
      type: "text" as const,
      getValue: (l: any) => l?.customFields?.[fieldKey],
    };
  });

  // Combined field defs for modal + rendering
  const allHeaderFieldDefs = [...standardHeaderFieldDefs, ...customHeaderFieldDefs];

  const getHeaderDef = (key: string) => allHeaderFieldDefs.find((d) => d.key === key);

  const formatHeaderValue = (def: any, value: any) => {
    const v = value ?? "";
    if (!v) return "-";

    if (def?.type === "email") {
      return (
        <a href={`mailto:${v}`} className="text-blue-600 hover:underline">
          {v}
        </a>
      );
    }
    if (def?.type === "phone") {
      return <span className="font-medium">{v}</span>;
    }
    if (def?.type === "badge") {
      return (
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
          {String(v)}
        </span>
      );
    }
    if (def?.type === "link") {
      return (
        <a href={String(v)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
          {String(v)}
        </a>
      );
    }
    return <span className="font-medium">{String(v)}</span>;
  };

  const toggleHeaderField = (fieldKey: string) => {
    setHeaderFields((prev) => {
      if (prev.includes(fieldKey)) {
        return prev.filter((k) => k !== fieldKey);
      }
      return [...prev, fieldKey];
    });
  };

  const moveHeaderField = (fieldKey: string, dir: "up" | "down") => {
    setHeaderFields((prev) => {
      const idx = prev.indexOf(fieldKey);
      if (idx === -1) return prev;

      const targetIdx = dir === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  // Fetch lead data when component mounts
  useEffect(() => {
    if (leadId) {
      fetchLeadData(leadId);
    }
  }, [leadId]);

  // Fetch available fields after lead is loaded
  useEffect(() => {
    if (lead && leadId) {
      fetchAvailableFields();
    }
  }, [lead, leadId]);

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const response = await fetch('/api/admin/field-management/leads');
      if (response.ok) {
        const data = await response.json();
        const fields = data.customFields || [];
        setAvailableFields(fields);
        
        // Add custom fields to visible fields if they have values
        if (lead && lead.customFields) {
          const customFieldKeys = Object.keys(lead.customFields);
          customFieldKeys.forEach(fieldKey => {
            // Add to appropriate panel based on field name
            if (fieldKey.toLowerCase().includes('contact') || fieldKey.toLowerCase().includes('phone') || fieldKey.toLowerCase().includes('address') || fieldKey.toLowerCase().includes('email')) {
              if (!visibleFields.contactInfo.includes(fieldKey)) {
                setVisibleFields(prev => ({
                  ...prev,
                  contactInfo: [...prev.contactInfo, fieldKey]
                }));
              }
            } else if (fieldKey.toLowerCase().includes('status') || fieldKey.toLowerCase().includes('owner') || fieldKey.toLowerCase().includes('date')) {
              if (!visibleFields.details.includes(fieldKey)) {
                setVisibleFields(prev => ({
                  ...prev,
                  details: [...prev.details, fieldKey]
                }));
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('Error fetching available fields:', err);
    } finally {
      setIsLoadingFields(false);
    }
  };

  // Toggle field visibility
  const toggleFieldVisibility = (panelId: string, fieldKey: string) => {
    setVisibleFields(prev => {
      const panelFields = prev[panelId] || [];
      if (panelFields.includes(fieldKey)) {
        return {
          ...prev,
          [panelId]: panelFields.filter(f => f !== fieldKey)
        };
      } else {
        return {
          ...prev,
          [panelId]: [...panelFields, fieldKey]
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

  const fetchLeadData = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching lead data for ID: ${id}`);
      const response = await fetch(`/api/leads/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      console.log(
        `API Response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        let errorMessage = `Failed to fetch lead: ${response.status} ${response.statusText}`;
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
      console.log("Lead data received:", data);

      // Format the lead data
      const formattedLead = {
        id: data.lead.id,
        firstName: data.lead.first_name || "",
        lastName: data.lead.last_name || "",
        fullName: data.lead.full_name || `${data.lead.last_name || ""}, ${data.lead.first_name || ""}`,
        status: data.lead.status || "New Lead",
        nickname: data.lead.nickname || "",
        title: data.lead.title || "",
        organizationId: data.lead.organization_id || "",
        organizationName: data.lead.organization_name_from_org || "",
        department: data.lead.department || "",
        reportsTo: data.lead.reports_to || "",
        owner: data.lead.owner || "",
        secondaryOwners: data.lead.secondary_owners || "",
        email: data.lead.email || "",
        email2: data.lead.email2 || "",
        phone: data.lead.phone || "",
        mobilePhone: data.lead.mobile_phone || "",
        directLine: data.lead.direct_line || "",
        linkedinUrl: data.lead.linkedin_url || "",
        address: data.lead.address || "",
        city: data.lead.city || "",
        state: data.lead.state || "",
        zip: data.lead.zip || "",
        fullAddress: formatAddress(data.lead),
        dateAdded: data.lead.created_at
          ? formatDate(data.lead.created_at)
          : "",
        lastContactDate: data.lead.last_contact_date
          ? formatDate(data.lead.last_contact_date)
          : "Never contacted",
        createdBy: data.lead.created_by_name || "Unknown",
        customFields: data.lead.custom_fields || {},
      };

      console.log("Formatted lead:", formattedLead);
      setLead(formattedLead);

      // After loading lead data, fetch notes, history, and documents
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
    } catch (err) {
      console.error("Error fetching lead:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching lead details"
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

  // Fetch notes for lead
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);
    setNoteError(null);

    try {
      const response = await fetch(`/api/leads/${id}/notes`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

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

  // Fetch history for lead
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/leads/${id}/history`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

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

  // Fetch documents for lead
  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);

    try {
      const response = await fetch(`/api/leads/${id}/documents`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

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

  // Handle adding a new document
  const handleAddDocument = async () => {
    if (!newDocumentName.trim() || !leadId) return;

    try {
      const response = await fetch(`/api/leads/${leadId}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          document_name: newDocumentName,
          document_type: newDocumentType,
          content: newDocumentContent,
        }),
      });

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
        `/api/leads/${leadId}/documents/${documentId}`,
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

  const handleGoBack = () => {
    router.push("/dashboard/leads");
  };

  // Handle tearsheet submission
  const handleTearsheetSubmit = async () => {
    if (!tearsheetForm.name.trim()) {
      alert('Please enter a tearsheet name');
      return;
    }

    if (!leadId) {
      alert('Lead ID is missing');
      return;
    }

    setIsSavingTearsheet(true);
    try {
      const response = await fetch('/api/tearsheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
        },
        body: JSON.stringify({
          name: tearsheetForm.name,
          visibility: tearsheetForm.visibility,
          lead_id: leadId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create tearsheet' }));
        throw new Error(errorData.message || 'Failed to create tearsheet');
      }

      alert('Tearsheet created successfully!');
      setShowAddTearsheetModal(false);
      setTearsheetForm({ name: '', visibility: 'Existing' });
    } catch (err) {
      console.error('Error creating tearsheet:', err);
      if (err instanceof Error && err.message.includes('Failed to fetch')) {
        alert('Tearsheet creation feature is being set up. The tearsheet will be created once the API is ready.');
        setShowAddTearsheetModal(false);
        setTearsheetForm({ name: '', visibility: 'Existing' });
      } else {
        alert(err instanceof Error ? err.message : 'Failed to create tearsheet. Please try again.');
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

  const handleActionSelected = (action: string) => {
    if (action === "edit" && leadId) {
      router.push(`/dashboard/leads/add?id=${leadId}`);
    } else if (action === "delete" && leadId) {
      // Confirm before deleting
      if (confirm("Are you sure you want to delete this lead?")) {
        deleteLead(leadId);
      }
    } else if (action === "add-note") {
      setShowAddNote(true);
      setActiveTab("notes");
    } else if (action === "add-task") {
      // Navigate to add task page with lead context
      if (leadId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=lead&relatedEntityId=${leadId}`
        );
      }
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else if (action === "convert" && leadId) {
      // Convert lead -> create a job
      router.push(`/dashboard/jobs/add?leadId=${leadId}`);
    } else if (action === "email") {
      // Handle send email
      if (lead?.email) {
        window.location.href = `mailto:${lead.email}`;
      } else {
        alert("Lead email not available");
      }
    } else {
      console.log(`Action selected: ${action}`);
    }
  };

  // Function to delete a lead
  const deleteLead = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete lead");
      }

      // Redirect to leads list after successful deletion
      router.push("/dashboard/leads");
    } catch (err) {
      console.error("Error deleting lead:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting the lead"
      );
      setIsLoading(false);
    }
  };

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!newNote.trim() || !leadId) return;

    try {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({ 
          text: newNote,
          note_type: noteType 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add note");
      }

      const data = await response.json();

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      // Clear the form
      setNewNote("");
      setNoteType("General Note");
      setShowAddNote(false);

      // Refresh history to show the note addition
      fetchHistory(leadId);

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

  // Update the actionOptions
  const actionOptions = [
    { label: "Add Note", action: () => handleActionSelected("add-note") },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
    { label: "Add Tearsheet", action: () => handleActionSelected("add-tearsheet") },
    { label: "Convert", action: () => handleActionSelected("convert") },
    { label: "Delete", action: () => handleActionSelected("delete") },
    // { label: "Edit", action: () => handleActionSelected("edit") },
    // { label: "Send Email", action: () => handleActionSelected("email") },
    // { label: "Transfer", action: () => handleActionSelected("transfer") },
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

  // Update the renderModifyTab function to forward to the add page instead of showing inline form
  const renderModifyTab = () => {
    // If we have a lead ID, redirect to the add page with that ID
    if (leadId) {
      router.push(`/dashboard/leads/add?id=${leadId}`);
      return null;
    }

    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-4">
          Loading lead editor...
        </h2>
      </div>
    );
  };

  // Render notes tab content
  const renderNotesTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Lead Notes</h2>
        <button
          onClick={() => setShowAddNote(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Add Note
        </button>
      </div>

      {/* Add Note Form */}
      {showAddNote && (
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <h3 className="font-medium mb-2">Add New Note</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note Type <span className="text-red-500">*</span>
            </label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="General Note">General Note</option>
              <option value="Phone Call">Phone Call</option>
              <option value="Email">Email</option>
              <option value="Interview">Interview</option>
            </select>
          </div>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter your note here..."
            className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setShowAddNote(false);
                setNewNote("");
                setNoteType("General Note");
              }}
              className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNote}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              disabled={!newNote.trim()}
            >
              Save Note
            </button>
          </div>
        </div>
      )}

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
              {note.note_type && (
                <div className="text-xs text-gray-500 mb-1">
                  Type: {note.note_type}
                </div>
              )}
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
      <h2 className="text-lg font-semibold mb-4">Lead History</h2>

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
                  actionDisplay = "Lead Created";
                  detailsDisplay = `Created by ${
                    item.performed_by_name || "Unknown"
                  }`;
                  break;
                case "UPDATE":
                  actionDisplay = "Lead Updated";
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
    return <LoadingScreen message="Loading lead details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-gray-700 mb-4">Lead not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with lead name and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            {/* <Image
              src="/file.svg"
              alt="Lead"
              width={24}
              height={24}
            /> */}
            <FiTarget size={20} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {lead.id} {lead.fullName}
          </h1>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 p-3">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          {/* LEFT: dynamic fields */}
          <div className="flex flex-wrap gap-x-10 gap-y-2 flex-1 min-w-0">
            {headerFields.length === 0 ? (
              <span className="text-sm text-gray-500">
                No header fields selected
              </span>
            ) : (
              headerFields.map((key) => {
                const def = getHeaderDef(key);
                const value = def
                  ? def.getValue(lead)
                  : lead?.customFields?.[key];

                return (
                  <div key={key} className="min-w-[140px]">
                    <div className="text-xs text-gray-500">
                      {def?.label || key}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatHeaderValue(def, value)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT: existing actions */}
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
              onClick={() => leadId && fetchLeadData(leadId)}
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
            onClick={() => setActiveTab(tab.id)}
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
            className="bg-white px-4 py-1 rounded-full shadow"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        {/* Display content based on active tab */}
        {activeTab === "summary" && (
          <div className="grid grid-cols-7 gap-4">
            {/* Left Column - 4/7 width */}
            <div className="col-span-4 space-y-4">
              {/* Lead Contact Info */}
              <PanelWithHeader
                title="Lead Contact Info:"
                onEdit={() => handleEditPanel("contactInfo")}
              >
                <div className="space-y-0 border border-gray-200 rounded">
                  {visibleFields.contactInfo.includes("fullName") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Name:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        {lead.fullName}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("nickname") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Nickname:
                      </div>
                      <div className="flex-1 p-2">{lead.nickname || "-"}</div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("title") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Title:
                      </div>
                      <div className="flex-1 p-2">{lead.title || "-"}</div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("organizationName") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Organization:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        {lead.organizationName || lead.organizationId || "-"}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("department") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Department:
                      </div>
                      <div className="flex-1 p-2">{lead.department || "-"}</div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("phone") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Phone:
                      </div>
                      <div className="flex-1 p-2">{lead.phone || "-"}</div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("mobilePhone") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Mobile:
                      </div>
                      <div className="flex-1 p-2">
                        {lead.mobilePhone || "-"}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("email") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Email:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`}>{lead.email}</a>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("email2") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Email 2:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        {lead.email2 ? (
                          <a href={`mailto:${lead.email2}`}>{lead.email2}</a>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("fullAddress") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Address:
                      </div>
                      <div className="flex-1 p-2">{lead.fullAddress}</div>
                    </div>
                  )}
                  {visibleFields.contactInfo.includes("linkedinUrl") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        LinkedIn:
                      </div>
                      <div className="flex-1 p-2 text-blue-600">
                        {lead.linkedinUrl ? (
                          <a
                            href={lead.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {lead.linkedinUrl}
                          </a>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>
                  )}
                  {/* Display custom fields */}
                  {lead.customFields &&
                    Object.keys(lead.customFields).map((fieldKey) => {
                      if (visibleFields.contactInfo.includes(fieldKey)) {
                        const field = availableFields.find(
                          (f) =>
                            (f.field_name || f.field_label || f.id) === fieldKey
                        );
                        const fieldLabel =
                          field?.field_label || field?.field_name || fieldKey;
                        const fieldValue = lead.customFields[fieldKey];
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

              {/* Lead Details */}
              <PanelWithHeader
                title="Lead Details:"
                onEdit={() => handleEditPanel("details")}
              >
                <div className="space-y-0 border border-gray-200 rounded">
                  {visibleFields.details.includes("status") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Status:
                      </div>
                      <div className="flex-1 p-2">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {lead.status}
                        </span>
                      </div>
                    </div>
                  )}
                  {visibleFields.details.includes("owner") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Owner:
                      </div>
                      <div className="flex-1 p-2">{lead.owner || "-"}</div>
                    </div>
                  )}
                  {visibleFields.details.includes("reportsTo") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Reports To:
                      </div>
                      <div className="flex-1 p-2">{lead.reportsTo || "-"}</div>
                    </div>
                  )}
                  {visibleFields.details.includes("dateAdded") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Date Added:
                      </div>
                      <div className="flex-1 p-2">{lead.dateAdded || "-"}</div>
                    </div>
                  )}
                  {visibleFields.details.includes("lastContactDate") && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                        Last Contact:
                      </div>
                      <div className="flex-1 p-2">{lead.lastContactDate}</div>
                    </div>
                  )}
                  {/* Display custom fields */}
                  {lead.customFields &&
                    Object.keys(lead.customFields).map((fieldKey) => {
                      if (visibleFields.details.includes(fieldKey)) {
                        const field = availableFields.find(
                          (f) =>
                            (f.field_name || f.field_label || f.id) === fieldKey
                        );
                        const fieldLabel =
                          field?.field_label || field?.field_name || fieldKey;
                        const fieldValue = lead.customFields[fieldKey];
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
            </div>

            {/* Right Column - 3/7 width */}
            <div className="col-span-3 space-y-4">
              {/* Recent Notes */}
              <PanelWithHeader
                title="Recent Notes:"
                onEdit={() => handleEditPanel("recentNotes")}
              >
                <div className="border border-gray-200 rounded">
                  {visibleFields.recentNotes.includes("notes") && (
                    <div className="p-2">
                      {notes.length > 0 ? (
                        <div>
                          {notes.slice(0, 3).map((note) => (
                            <div
                              key={note.id}
                              className="mb-3 pb-3 border-b border-gray-200 last:border-0"
                            >
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">
                                  {note.created_by_name || "Unknown User"}
                                </span>
                                <span className="text-gray-500">
                                  {new Date(note.created_at).toLocaleString()}
                                </span>
                              </div>
                              {note.note_type && (
                                <div className="text-xs text-gray-500 mb-1">
                                  Type: {note.note_type}
                                </div>
                              )}
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
              >
                <div className="border border-gray-200 rounded">
                  <div className="p-2">
                    <p className="text-gray-500 italic">No open jobs found</p>
                  </div>
                </div>
              </PanelWithHeader>

              {/* Our Open Jobs */}
              <PanelWithHeader
                title="Our Open Jobs:"
                onEdit={() => handleEditPanel("ourJobs")}
              >
                <div className="border border-gray-200 rounded">
                  <div className="p-2">
                    <p className="text-gray-500 italic">No open jobs</p>
                  </div>
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
            <h2 className="text-lg font-semibold mb-4">Lead Contacts</h2>
            <p className="text-gray-500 italic">No contacts available</p>
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

        {activeTab === "opportunities" && (
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Opportunities</h2>
            <p className="text-gray-500 italic">No opportunities available</p>
          </div>
        )}
      </div>

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
              <div>
                <h3 className="font-medium mb-3">Available Fields</h3>
                <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                  {allHeaderFieldDefs.map((f) => {
                    const checked = headerFields.includes(f.key);
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
                        <span className="text-sm text-gray-800">{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">Header Order</h3>
                <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                  {headerFields.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">
                      No fields selected
                    </div>
                  ) : (
                    headerFields.map((key, idx) => {
                      const def = getHeaderDef(key);
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {def?.label || key}
                            </div>
                            <div className="text-xs text-gray-500">{key}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                              disabled={idx === 0}
                              onClick={() => moveHeaderField(key, "up")}
                            >
                              ↑
                            </button>
                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                              disabled={idx === headerFields.length - 1}
                              onClick={() => moveHeaderField(key, "down")}
                            >
                              ↓
                            </button>
                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 text-red-600"
                              onClick={() => toggleHeaderField(key)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                    onClick={() => setHeaderFields(LEAD_DEFAULT_HEADER_FIELDS)}
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
                        { key: "fullName", label: "Name" },
                        { key: "nickname", label: "Nickname" },
                        { key: "title", label: "Title" },
                        { key: "organizationName", label: "Organization" },
                        { key: "department", label: "Department" },
                        { key: "phone", label: "Phone" },
                        { key: "mobilePhone", label: "Mobile" },
                        { key: "email", label: "Email" },
                        { key: "email2", label: "Email 2" },
                        { key: "fullAddress", label: "Address" },
                        { key: "linkedinUrl", label: "LinkedIn" },
                      ],
                      details: [
                        { key: "status", label: "Status" },
                        { key: "owner", label: "Owner" },
                        { key: "reportsTo", label: "Reports To" },
                        { key: "dateAdded", label: "Date Added" },
                        { key: "lastContactDate", label: "Last Contact" },
                      ],
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
    </div>
  );
}
