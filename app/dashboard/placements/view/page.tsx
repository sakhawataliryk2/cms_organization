"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import PanelWithHeader from "@/components/PanelWithHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { FiBriefcase } from "react-icons/fi";

export default function PlacementView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placementId = searchParams.get("id");

  const [placement, setPlacement] = useState<any>(null);
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
  const [newNote, setNewNote] = useState("");

  // Current active tab
  const [activeTab, setActiveTab] = useState("summary");

  // Editable fields in Modify tab
  const [editableFields, setEditableFields] = useState<any>({});

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>({
    placementDetails: ['candidate', 'job', 'status', 'startDate', 'endDate', 'salary'],
    details: ['owner', 'dateAdded', 'lastContactDate'],
    recentNotes: ['notes']
  });
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Fetch placement data when component mounts
  useEffect(() => {
    if (placementId) {
      fetchPlacementData(placementId);
    }
  }, [placementId]);

  // Fetch available fields after placement is loaded
  useEffect(() => {
    if (placement && placementId) {
      fetchAvailableFields();
    }
  }, [placement, placementId]);

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const response = await fetch('/api/admin/field-management/placements');
      if (response.ok) {
        const data = await response.json();
        const fields = data.customFields || [];
        setAvailableFields(fields);
        
        // Add custom fields to visible fields if they have values
        if (placement && placement.customFields) {
          const customFieldKeys = Object.keys(placement.customFields);
          customFieldKeys.forEach(fieldKey => {
            // Add to appropriate panel based on field name
            if (fieldKey.toLowerCase().includes('candidate') || fieldKey.toLowerCase().includes('job') || fieldKey.toLowerCase().includes('status')) {
              if (!visibleFields.placementDetails.includes(fieldKey)) {
                setVisibleFields(prev => ({
                  ...prev,
                  placementDetails: [...prev.placementDetails, fieldKey]
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

  // Initialize editable fields when placement data is loaded
  useEffect(() => {
    if (placement) {
      // Flatten placement data for editing
      const flattenedData = {
        candidate: placement.candidateName || '',
        job: placement.jobTitle || '',
        status: placement.status || '',
        startDate: placement.startDate || '',
        endDate: placement.endDate || '',
        salary: placement.salary || '',
        owner: placement.owner || '',
      };
      setEditableFields(flattenedData);
      setOriginalData(flattenedData);
    }
  }, [placement]);

  // Function to fetch placement data
  const fetchPlacementData = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching placement data for ID: ${id}`);
      const response = await fetch(`/api/placements/${id}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      console.log(`API Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorMessage = `Failed to fetch placement: ${response.status} ${response.statusText}`;
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
      console.log("Placement data received:", data);

      // Format the placement data
      let customFieldsObj = {};
      if (data.placement) {
        try {
          if (typeof data.placement.custom_fields === 'string') {
            customFieldsObj = JSON.parse(data.placement.custom_fields);
          } else if (typeof data.placement.custom_fields === 'object') {
            customFieldsObj = data.placement.custom_fields;
          }
        } catch (e) {
          console.error('Error parsing custom fields:', e);
        }
      }

      const formattedPlacement = {
        id: data.placement.id,
        candidateId: data.placement.candidate_id || data.placement.job_seeker_id || '',
        candidateName: data.placement.candidate_name || data.placement.job_seeker_name || 'Unknown Candidate',
        jobId: data.placement.job_id || '',
        jobTitle: data.placement.job_title || data.placement.job_name || 'Unknown Job',
        status: data.placement.status || 'Active',
        startDate: data.placement.start_date ? new Date(data.placement.start_date).toLocaleDateString() : '',
        endDate: data.placement.end_date ? new Date(data.placement.end_date).toLocaleDateString() : '',
        salary: data.placement.salary || '',
        owner: data.placement.owner || data.placement.owner_name || '',
        dateAdded: data.placement.created_at ? new Date(data.placement.created_at).toLocaleDateString() : '',
        lastContactDate: data.placement.last_contact_date ? new Date(data.placement.last_contact_date).toLocaleDateString() : 'Never contacted',
        createdBy: data.placement.created_by_name || 'Unknown',
        customFields: customFieldsObj,
      };

      console.log("Formatted placement:", formattedPlacement);
      setPlacement(formattedPlacement);

      // After loading placement data, fetch notes and history
      fetchNotes(id);
      fetchHistory(id);
    } catch (err) {
      console.error("Error fetching placement:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching placement details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch notes for placement
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);
    setNoteError(null);

    try {
      const response = await fetch(`/api/placements/${id}/notes`);

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

  // Fetch history for placement
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/placements/${id}/history`);

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

  const handleGoBack = () => {
    router.push("/dashboard/placements");
  };

  const handleActionSelected = (action: string) => {
    if (action === "edit" && placementId) {
      router.push(`/dashboard/placements/add?id=${placementId}`);
    } else if (action === "delete" && placementId) {
      handleDelete(placementId);
    } else if (action === "add-note") {
      setShowAddNote(true);
      setActiveTab("notes");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this placement?")) return;

    try {
      const response = await fetch(`/api/placements/${id}`, {
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
        throw new Error(errorData.message || "Failed to delete placement");
      }

      router.push("/dashboard/placements");
    } catch (err) {
      console.error("Error deleting placement:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting the placement"
      );
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !placementId) return;

    try {
      const response = await fetch(`/api/placements/${placementId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: newNote,
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
      setShowAddNote(false);

      // Refresh history
      fetchHistory(placementId);
    } catch (err) {
      console.error("Error adding note:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while adding a note"
      );
    }
  };

  // Render modify tab content
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Modify Placement</h2>
      <div className="space-y-4">
        <div className="flex items-center">
          <label className="w-48 font-medium">Candidate:</label>
          <input
            type="text"
            value={editableFields.candidate || ''}
            onChange={(e) => setEditableFields({ ...editableFields, candidate: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="Candidate name"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Job:</label>
          <input
            type="text"
            value={editableFields.job || ''}
            onChange={(e) => setEditableFields({ ...editableFields, job: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="Job title"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Status:</label>
          <select
            value={editableFields.status || ''}
            onChange={(e) => setEditableFields({ ...editableFields, status: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="Pending">Pending</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Terminated">Terminated</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Start Date:</label>
          <input
            type="date"
            value={editableFields.startDate || ''}
            onChange={(e) => setEditableFields({ ...editableFields, startDate: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">End Date:</label>
          <input
            type="date"
            value={editableFields.endDate || ''}
            onChange={(e) => setEditableFields({ ...editableFields, endDate: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Salary:</label>
          <input
            type="text"
            value={editableFields.salary || ''}
            onChange={(e) => setEditableFields({ ...editableFields, salary: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="Salary"
          />
        </div>
        <div className="flex items-center">
          <label className="w-48 font-medium">Owner:</label>
          <input
            type="text"
            value={editableFields.owner || ''}
            onChange={(e) => setEditableFields({ ...editableFields, owner: e.target.value })}
            className="flex-1 p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="Owner"
          />
        </div>
        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={() => {
              setEditableFields(originalData);
            }}
            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setIsSaving(true);
              try {
                const response = await fetch(`/api/placements/${placementId}`, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(editableFields),
                });

                if (!response.ok) {
                  throw new Error("Failed to update placement");
                }

                await fetchPlacementData(placementId!);
                alert("Placement updated successfully");
              } catch (err) {
                console.error("Error updating placement:", err);
                alert("Failed to update placement");
              } finally {
                setIsSaving(false);
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );

  // Render notes tab content
  const renderNotesTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Placement Notes</h2>
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
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter your note here..."
            className="w-full p-2 border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowAddNote(false)}
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
      <h2 className="text-lg font-semibold mb-4">Placement History</h2>

      {isLoadingHistory ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : historyError ? (
        <div className="text-red-500 py-2">{historyError}</div>
      ) : history.length > 0 ? (
        <div className="space-y-4">
          {history.map((item, index) => {
            // Format the history entry based on action type
            let actionDisplay = "";
            let detailsDisplay = "";

            try {
              const details =
                typeof item.details === "string"
                  ? JSON.parse(item.details)
                  : item.details;

              switch (item.action || item.action_type) {
                case "CREATE":
                  actionDisplay = "Placement Created";
                  detailsDisplay = `Created by ${
                    item.performed_by_name || item.created_by_name || "Unknown"
                  }`;
                  break;
                case "UPDATE":
                  actionDisplay = "Placement Updated";
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
                  actionDisplay = item.action || item.action_type || "Unknown Action";
                  detailsDisplay = JSON.stringify(details);
              }
            } catch (e) {
              console.error("Error parsing history details:", e);
              detailsDisplay = "Error displaying details";
            }

            return (
              <div
                key={item.id || index}
                className="p-3 border rounded hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-blue-600">
                    {actionDisplay}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(item.performed_at || item.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mb-2">{detailsDisplay}</div>
                <div className="text-sm text-gray-600">
                  By: {item.performed_by_name || item.created_by_name || "Unknown"}
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

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "notes", label: "Notes" },
    { id: "history", label: "History" },
  ];

  const actionOptions = [
    { label: "Edit", action: () => handleActionSelected("edit") },
    { label: "Delete", action: () => handleActionSelected("delete") },
    { label: "Add Note", action: () => handleActionSelected("add-note") },
  ];

  if (isLoading) {
    return <LoadingScreen message="Loading placement details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Placements
        </button>
      </div>
    );
  }

  if (!placement) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-gray-700 mb-4">Placement not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Placements
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with placement info and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            <FiBriefcase size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {placement.id} {placement.candidateName} - {placement.jobTitle}
          </h1>
        </div>
        <div className="ml-auto flex items-center space-x-2">
          <ActionDropdown label="Actions" options={actionOptions} />
          <button className="p-1 hover:bg-gray-200 rounded" aria-label="Print">
            <Image src="/print.svg" alt="Print" width={20} height={20} />
          </button>
          <button
            className="p-1 hover:bg-gray-200 rounded"
            aria-label="Reload"
            onClick={() => placementId && fetchPlacementData(placementId)}
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

      {/* Status and Owner section */}
      <div className="bg-white border-b border-gray-300 p-3 flex justify-between items-center">
        <div className="flex space-x-8">
          <div>
            <h2 className="text-gray-600">Status</h2>
            <p className="font-medium">{placement.status}</p>
          </div>
          <div>
            <h2 className="text-gray-600">Owner</h2>
            <p className="font-medium">{placement.owner || 'Unassigned'}</p>
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

      {/* Main Content Area */}
      <div className="p-4">
        {/* Display content based on active tab */}
        {activeTab === "summary" && (
          <div className="grid grid-cols-7 gap-4">
            {/* Left Column - 4/7 width */}
            <div className="col-span-4 space-y-4">
              {/* Placement Details */}
              <PanelWithHeader
                title="Placement Details:"
                onEdit={() => handleEditPanel('placementDetails')}
              >
                <div className="space-y-0 border border-gray-200 rounded">
                  {visibleFields.placementDetails.includes('candidate') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Candidate:</div>
                      <div className="flex-1 p-2 text-blue-600">
                        {placement.candidateName}
                      </div>
                    </div>
                  )}
                  {visibleFields.placementDetails.includes('job') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Job:</div>
                      <div className="flex-1 p-2 text-blue-600">
                        {placement.jobTitle}
                      </div>
                    </div>
                  )}
                  {visibleFields.placementDetails.includes('status') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Status:</div>
                      <div className="flex-1 p-2">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {placement.status}
                        </span>
                      </div>
                    </div>
                  )}
                  {visibleFields.placementDetails.includes('startDate') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Start Date:</div>
                      <div className="flex-1 p-2">{placement.startDate || "-"}</div>
                    </div>
                  )}
                  {visibleFields.placementDetails.includes('endDate') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">End Date:</div>
                      <div className="flex-1 p-2">{placement.endDate || "-"}</div>
                    </div>
                  )}
                  {visibleFields.placementDetails.includes('salary') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Salary:</div>
                      <div className="flex-1 p-2">{placement.salary || "-"}</div>
                    </div>
                  )}
                  {/* Display custom fields */}
                  {placement.customFields && Object.keys(placement.customFields).map((fieldKey) => {
                    if (visibleFields.placementDetails.includes(fieldKey)) {
                      const field = availableFields.find(f => (f.field_name || f.field_label || f.id) === fieldKey);
                      const fieldLabel = field?.field_label || field?.field_name || fieldKey;
                      const fieldValue = placement.customFields[fieldKey];
                      return (
                        <div key={fieldKey} className="flex border-b border-gray-200 last:border-b-0">
                          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{fieldLabel}:</div>
                          <div className="flex-1 p-2">{String(fieldValue || "-")}</div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </PanelWithHeader>

              {/* Details */}
              <PanelWithHeader
                title="Details:"
                onEdit={() => handleEditPanel('details')}
              >
                <div className="space-y-0 border border-gray-200 rounded">
                  {visibleFields.details.includes('owner') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Owner:</div>
                      <div className="flex-1 p-2">{placement.owner || "-"}</div>
                    </div>
                  )}
                  {visibleFields.details.includes('dateAdded') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Date Added:</div>
                      <div className="flex-1 p-2">{placement.dateAdded || "-"}</div>
                    </div>
                  )}
                  {visibleFields.details.includes('lastContactDate') && (
                    <div className="flex border-b border-gray-200 last:border-b-0">
                      <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Last Contact:</div>
                      <div className="flex-1 p-2">{placement.lastContactDate}</div>
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
                onEdit={() => handleEditPanel('recentNotes')}
              >
                <div className="border border-gray-200 rounded">
                  {visibleFields.recentNotes.includes('notes') && (
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
            </div>
          </div>
        )}

        {/* Modify Tab */}
        {activeTab === "modify" && renderModifyTab()}

        {/* Notes Tab */}
        {activeTab === "notes" && renderNotesTab()}

        {/* History Tab */}
        {activeTab === "history" && renderHistoryTab()}
      </div>

      {/* Edit Fields Modal */}
      {editingPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Edit Fields - {editingPanel}</h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-medium mb-3">Available Fields from Modify Page:</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                  {isLoadingFields ? (
                    <div className="text-center py-4 text-gray-500">Loading fields...</div>
                  ) : availableFields.length > 0 ? (
                    availableFields.map((field) => {
                      const fieldKey = field.field_name || field.field_label || field.id;
                      const isVisible = visibleFields[editingPanel]?.includes(fieldKey) || false;
                      return (
                        <div key={field.id || fieldKey} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => toggleFieldVisibility(editingPanel, fieldKey)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm text-gray-700">
                              {field.field_label || field.field_name || fieldKey}
                            </label>
                          </div>
                          <span className="text-xs text-gray-500">{field.field_type || 'text'}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>No custom fields available</p>
                      <p className="text-xs mt-1">Fields from the modify page will appear here</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="font-medium mb-3">Standard Fields:</h3>
                <div className="space-y-2 border border-gray-200 rounded p-3">
                  {(() => {
                    const standardFieldsMap: Record<string, Array<{ key: string; label: string }>> = {
                      placementDetails: [
                        { key: 'candidate', label: 'Candidate' },
                        { key: 'job', label: 'Job' },
                        { key: 'status', label: 'Status' },
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'endDate', label: 'End Date' },
                        { key: 'salary', label: 'Salary' }
                      ],
                      details: [
                        { key: 'owner', label: 'Owner' },
                        { key: 'dateAdded', label: 'Date Added' },
                        { key: 'lastContactDate', label: 'Last Contact' }
                      ],
                      recentNotes: [
                        { key: 'notes', label: 'Notes' }
                      ]
                    };
                    
                    const fields = standardFieldsMap[editingPanel] || [];
                    return fields.map((field) => {
                      const isVisible = visibleFields[editingPanel]?.includes(field.key) || false;
                      return (
                        <div key={field.key} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => toggleFieldVisibility(editingPanel, field.key)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm text-gray-700">{field.label}</label>
                          </div>
                          <span className="text-xs text-gray-500">standard</span>
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

