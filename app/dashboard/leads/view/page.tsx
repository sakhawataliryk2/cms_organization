"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import PanelWithHeader from "@/components/PanelWithHeader";
import LoadingScreen from "@/components/LoadingScreen";

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

  // Current active tab
  const [activeTab, setActiveTab] = useState("summary");

  // Fetch lead data when component mounts
  useEffect(() => {
    if (leadId) {
      fetchLeadData(leadId);
    }
  }, [leadId]);

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
    { label: "Edit", action: () => handleActionSelected("edit") },
    { label: "Delete", action: () => handleActionSelected("delete") },
    { label: "Add Note", action: () => handleActionSelected("add-note") },
    { label: "Send Email", action: () => handleActionSelected("email") },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
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
            <Image
              src="/file.svg"
              alt="Lead"
              width={24}
              height={24}
            />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {lead.id} {lead.fullName}
          </h1>
        </div>
      </div>

      {/* Phone and Email section */}
      <div className="bg-white border-b border-gray-300 p-3 flex justify-between items-center">
        <div className="flex space-x-8">
          <div>
            <h2 className="text-gray-600">Phone</h2>
            <p className="font-medium">{lead.phone || "Not provided"}</p>
          </div>
          <div>
            <h2 className="text-gray-600">Email</h2>
            <a
              href={`mailto:${lead.email}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {lead.email || "Not provided"}
            </a>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ActionDropdown label="Actions" options={actionOptions} />
          <button className="p-1 hover:bg-gray-200 rounded" aria-label="Print">
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
              <PanelWithHeader title="Lead Contact Info:">
                <div className="space-y-2">
                  <div className="flex">
                    <div className="w-24 font-medium">Name:</div>
                    <div className="flex-1 text-blue-600">
                      {lead.fullName}
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Nickname:</div>
                    <div className="flex-1">
                      {lead.nickname || "-"}
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Title:</div>
                    <div className="flex-1">{lead.title || "-"}</div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Organization:</div>
                    <div className="flex-1 text-blue-600">
                      {lead.organizationName || lead.organizationId || "-"}
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Department:</div>
                    <div className="flex-1">{lead.department || "-"}</div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Phone:</div>
                    <div className="flex-1">{lead.phone || "-"}</div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Mobile:</div>
                    <div className="flex-1">{lead.mobilePhone || "-"}</div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Email:</div>
                    <div className="flex-1 text-blue-600">
                      <a href={`mailto:${lead.email}`}>{lead.email || "-"}</a>
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Email 2:</div>
                    <div className="flex-1 text-blue-600">
                      {lead.email2 ? (
                        <a href={`mailto:${lead.email2}`}>{lead.email2}</a>
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">Address:</div>
                    <div className="flex-1">{lead.fullAddress}</div>
                  </div>
                  <div className="flex">
                    <div className="w-24 font-medium">LinkedIn:</div>
                    <div className="flex-1 text-blue-600">
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
                </div>
              </PanelWithHeader>

              {/* Lead Details */}
              <PanelWithHeader title="Lead Details:">
                <div className="space-y-2">
                  <div className="flex">
                    <div className="w-32 font-medium">Status:</div>
                    <div className="flex-1">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {lead.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-32 font-medium">Owner:</div>
                    <div className="flex-1">{lead.owner || "-"}</div>
                  </div>
                  <div className="flex">
                    <div className="w-32 font-medium">Reports To:</div>
                    <div className="flex-1">{lead.reportsTo || "-"}</div>
                  </div>
                  <div className="flex">
                    <div className="w-32 font-medium">Date Added:</div>
                    <div className="flex-1">{lead.dateAdded || "-"}</div>
                  </div>
                  <div className="flex">
                    <div className="w-32 font-medium">Last Contact:</div>
                    <div className="flex-1">{lead.lastContactDate}</div>
                  </div>
                </div>
              </PanelWithHeader>
            </div>

            {/* Right Column - 3/7 width */}
            <div className="col-span-3 space-y-4">
              {/* Recent Notes */}
              <PanelWithHeader title="Recent Notes:">
                {notes.length > 0 ? (
                  <div>
                    {notes.slice(0, 3).map((note) => (
                      <div
                        key={note.id}
                        className="mb-3 pb-3 border-b last:border-0"
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
              </PanelWithHeader>

              {/* Open Jobs from Website */}
              <PanelWithHeader title="Open Jobs from Website:">
                <p className="text-gray-500 italic">No open jobs found</p>
              </PanelWithHeader>

              {/* Our Open Jobs */}
              <PanelWithHeader title="Our Open Jobs:">
                <p className="text-gray-500 italic">No open jobs</p>
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
    </div>
  );
}
