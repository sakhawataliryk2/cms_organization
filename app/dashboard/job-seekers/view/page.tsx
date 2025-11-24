"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import LoadingScreen from "@/components/LoadingScreen";
import PanelWithHeader from "@/components/PanelWithHeader";
import { FaLinkedin, FaFacebookSquare } from "react-icons/fa";
import { sendEmailViaOffice365, isOffice365Authenticated, initializeOffice365Auth, type EmailMessage } from "@/lib/office365";

export default function JobSeekerView() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("General Note");
  const [isOffice365Connected, setIsOffice365Connected] = useState(false);

  // Onboarding send modal state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Record<string, boolean>>({});
  const onboardingDocs = [
    { id: "w4", name: "W-4 (Employee's Withholding Certificate)", url: "/docs/onboarding/W-4.pdf" },
    { id: "i9", name: "I-9 (Employment Eligibility Verification)", url: "/docs/onboarding/I-9.pdf" },
    { id: "dd", name: "Direct Deposit Authorization", url: "/docs/onboarding/Direct-Deposit.pdf" },
    { id: "policy", name: "Company Policies Acknowledgement", url: "/docs/onboarding/Policies.pdf" }
  ];

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendOnboarding = async () => {
    if (!jobSeeker?.email) {
      alert("Job seeker email is missing");
      return;
    }
    
    const chosen = onboardingDocs.filter(d => selectedDocs[d.id]);
    const subject = "Onboarding Documents";
    const links = chosen.length > 0
      ? "\n\nDocuments:\n" + chosen.map(d => `- ${d.name}: ${window.location.origin}${d.url}`).join("\n")
      : "";
    const body = "Here are your onboarding documents. Please fill these out and return promptly." + links;

    // Use Office 365 if connected, otherwise use mailto
    if (isOffice365Connected) {
      try {
        const emailMessage: EmailMessage = {
          to: [jobSeeker.email],
          subject: subject,
          body: body,
          bodyType: 'text',
        };
        await sendEmailViaOffice365(emailMessage);
        alert('Onboarding documents sent successfully via Office 365!');
        setShowOnboardingModal(false);
        setSelectedDocs({});
      } catch (error: any) {
        alert(`Failed to send via Office 365: ${error.message}. Falling back to mailto.`);
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
  const [selectedReferenceDocs, setSelectedReferenceDocs] = useState<Record<string, boolean>>({});
  const [referenceEmail, setReferenceEmail] = useState("");
  const referenceDocs = [
    { id: "reference-form", name: "Reference Request Form", url: "/docs/references/Reference-Form.pdf" },
    { id: "background-check", name: "Background Check Authorization", url: "/docs/references/Background-Check.pdf" },
    { id: "employment-verification", name: "Employment Verification Form", url: "/docs/references/Employment-Verification.pdf" }
  ];

  const toggleReferenceDoc = (id: string) => {
    setSelectedReferenceDocs(prev => ({ ...prev, [id]: !prev[id] }));
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

    const chosen = referenceDocs.filter(d => selectedReferenceDocs[d.id]);
    const subject = "Reference Request";
    const links = chosen.length > 0
      ? "\n\nPlease review and complete the following documents:\n" + chosen.map(d => `- ${d.name}: ${window.location.origin}${d.url}`).join("\n")
      : "";
    const body = `Dear Reference,

We are requesting a reference for ${jobSeeker?.fullName || "a candidate"}. Please review and complete the attached reference documents at your earliest convenience.${links}

Thank you for your time and assistance.

Best regards`;

    // Use Office 365 if connected, otherwise use mailto
    if (isOffice365Connected) {
      try {
        const emailMessage: EmailMessage = {
          to: [referenceEmail.trim()],
          subject: subject,
          body: body,
          bodyType: 'text',
        };
        await sendEmailViaOffice365(emailMessage);
        alert('Reference form sent successfully via Office 365!');
        setShowReferenceModal(false);
        setReferenceEmail("");
        setSelectedReferenceDocs({});
      } catch (error: any) {
        alert(`Failed to send via Office 365: ${error.message}. Falling back to mailto.`);
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

  const jobSeekerId = searchParams.get("id");

  // Fetch job seeker when component mounts
  useEffect(() => {
    if (jobSeekerId) {
      fetchJobSeeker(jobSeekerId);
    }
  }, [jobSeekerId]);

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

      // Now fetch notes and history
      fetchNotes(id);
      fetchHistory(id);
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

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!newNote.trim() || !jobSeekerId) return;

    try {
      const response = await fetch(`/api/job-seekers/${jobSeekerId}/notes`, {
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
        throw new Error("Failed to add note");
      }

      const data = await response.json();

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      // Clear the form
      setNewNote("");
      setNoteType("General Note");
      setShowAddNote(false);

      // Refresh history
      fetchHistory(jobSeekerId);
    } catch (err) {
      console.error("Error adding note:", err);
      alert("Failed to add note. Please try again.");
    }
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
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('msal_access_token');
      if (token) setIsOffice365Connected(true);
    }
  }, []);

  const handleActionSelected = async (action: string) => {
    console.log(`Action selected: ${action}`);
    if (action === "edit") {
      handleEdit();
    } else if (action === "delete" && jobSeekerId) {
      handleDelete(jobSeekerId);
    } else if (action === "add-task") {
      // Navigate to add task page with job seeker context
      if (jobSeekerId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=job_seeker&relatedEntityId=${jobSeekerId}`
        );
      }
    } else if (action === "email") {
      // Handle send email - use Office 365 if connected, otherwise use mailto
      if (isOffice365Connected && jobSeeker?.email) {
        try {
          const emailMessage: EmailMessage = {
            to: [jobSeeker.email],
            subject: `Regarding ${jobSeeker.fullName}`,
            body: `Hello ${jobSeeker.fullName},\n\nI wanted to reach out regarding your application.\n\nBest regards`,
            bodyType: 'text',
          };
          await sendEmailViaOffice365(emailMessage);
          alert('Email sent successfully via Office 365!');
        } catch (error: any) {
          alert(`Failed to send via Office 365: ${error.message}. Falling back to mailto.`);
          window.location.href = `mailto:${jobSeeker.email}`;
        }
      } else if (jobSeeker?.email) {
        window.location.href = `mailto:${jobSeeker.email}`;
      } else {
        alert('Job seeker email not available');
      }
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
    { label: "Edit", action: () => handleActionSelected("edit") },
    { label: "Delete", action: () => handleActionSelected("delete") },
    { label: "Add Note", action: () => setShowAddNote(true) },
    { label: "Send Email", action: () => handleActionSelected("email") },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
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
      {/* <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Job Seeker Notes</h2>
        <button
          onClick={() => setShowAddNote(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Add Note
        </button>
      </div> */}

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
    <>
      {/* <div className="bg-white p-4 rounded shadow-sm">
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
      </div> */}
      {/* Skills/Software Section */}
      <div className="bg-white rounded-lg shadow mt-4">
        <div className="border-b border-gray-300 p-2 font-medium">
          Skills/Software
        </div>
        <div className="p-4">
          <div className="flex justify-end mb-3">
            <button className="text-sm text-blue-600 hover:underline">
              Add Skill
            </button>
          </div>

          {/* Skills content */}
          {jobSeeker.skills && jobSeeker.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {jobSeeker.skills.map((skill: string, index: number) => (
                <span
                  key={index}
                  className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 p-4">
              No skills or software entries have been added yet.
            </div>
          )}
        </div>
      </div>
    </>
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
    <div className="bg-gray-200 min-h-screen">
      {/* Header with name */}
      <div className="bg-orange-200 p-2 flex items-center">
        <div className="flex items-center">
          <Image
            src="/file.svg"
            alt="Job Seeker"
            width={24}
            height={24}
            className="mr-2"
          />
          <h1 className="text-xl text-gray-700">Job Seekers</h1>
        </div>
      </div>

      {/* Sub-header with ID and name */}
      {/* <div className="bg-white border-b border-gray-300 p-2">
                <div className="text-lg font-semibold">{jobSeeker.id}</div>
                <div className="text-lg">{jobSeeker.fullName}</div>
            </div> */}

      {/* Social media icons row */}
      {/* <div className="bg-white border-b border-gray-300 p-3 flex justify-between items-center">
        <div className="flex space-x-3">
          
          <a
            href={`https://google.com/search?q=${encodeURIComponent(
              jobSeeker.fullName
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="text-3xl text-blue-500 font-bold">G</span>
          </a>
          
          <a
            href={`https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(
              jobSeeker.fullName
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="text-3xl text-blue-700">
              <FaLinkedin />
            </span>
          </a>
         
          <a
            href={`https://facebook.com/search?q=${encodeURIComponent(
              jobSeeker.fullName
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="text-3xl text-blue-900">
              <FaFacebookSquare />
            </span>
          </a>
        </div>

        
        <div className="flex items-center space-x-2 no-print">
          <ActionDropdown label="ACTIONS" options={actionOptions} />
          <button onClick={handlePrint} className="p-1 hover:bg-gray-200 rounded">
            <Image src="/print.svg" alt="Print" width={20} height={20} />
          </button>
          <button className="p-1 hover:bg-gray-200 rounded">
            <Image src="/reload.svg" alt="Reload" width={20} height={20} />
          </button>
          <button
            onClick={handleGoBack}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <Image src="/x.svg" alt="Close" width={20} height={20} />
          </button>
        </div>
      </div> */}

      {/* Information row */}
      <div className="bg-white border-b border-gray-300 p-2 grid grid-cols-6 gap-4">
        <div>
          {/* <div className="text-gray-600 text-sm">ID</div> */}
          <div className="text-lg font-semibold">{jobSeeker.id}</div>
          <div className="text-lg">{jobSeeker.fullName.toUpperCase()}</div>
          {/* <div>{jobSeeker.id}</div> */}
        </div>
        {/* <div>
                    <div className="text-gray-600 text-sm">First Name</div>
                    <div>{jobSeeker.firstName}</div>
                </div> */}
        <div>
          <div className="text-gray-600 text-sm">Primary Phone</div>
          <div>{jobSeeker.phone}</div>
        </div>
        <div>
          <div className="text-gray-600 text-sm">Primary Email</div>
          <div className="text-blue-600 truncate">
            <a href={`mailto:${jobSeeker.email}`}>{jobSeeker.email}</a>
          </div>
        </div>
        <div className="bg-white p-3 flex justify-between items-center">
          <div className="flex space-x-3">
            {/* Google icon */}
            <a
              href={`https://google.com/search?q=${encodeURIComponent(
                jobSeeker.fullName
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-3xl text-blue-500 font-bold">G</span>
            </a>
            {/* LinkedIn icon */}
            <a
              href={`https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                jobSeeker.fullName
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-3xl text-blue-700">
                <FaLinkedin />
              </span>
            </a>
            {/* Facebook icon */}
            <a
              href={`https://facebook.com/search?q=${encodeURIComponent(
                jobSeeker.fullName
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-3xl text-blue-900">
                <FaFacebookSquare />
              </span>
            </a>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex items-center justify-end space-x-2 col-span-2 no-print">
          <ActionDropdown label="ACTIONS" options={actionOptions} />
          <button
            onClick={handlePrint}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <Image src="/print.svg" alt="Print" width={20} height={20} />
          </button>
          <button className="p-1 hover:bg-gray-200 rounded">
            <Image src="/reload.svg" alt="Reload" width={20} height={20} />
          </button>
          <button
            onClick={handleGoBack}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <Image src="/x.svg" alt="Close" width={20} height={20} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-white border-b border-gray-300 overflow-x-auto no-print">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 ${
              activeTab === tab.id
                ? "border-b-2 border-blue-500 font-medium text-blue-600"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick Action Tabs */}
      <div className="flex bg-gray-300 p-2 space-x-2 no-print">
        {quickTabs.map((tab) => (
          <button
            key={tab.id}
            className={`${
              activeQuickTab === tab.id
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            } px-6 py-1 rounded-full shadow`}
            onClick={() => setActiveQuickTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-7 gap-4 p-4">
        {/* Display content based on active tab */}
        {activeTab === "summary" && (
          <>
            {/* Left Column - Resume Section (4/7 width) */}
            <div className="col-span-4">
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-300 p-2 font-medium">
                  Resume
                </div>
                <div className="p-4">
                  <div className="text-center mb-4">
                    {/* <h2 className="text-xl font-bold">
                      {jobSeeker.fullName.toUpperCase()}
                    </h2>
                    <div className="flex justify-center items-center text-gray-600 space-x-2 mt-1 flex-wrap">
                      <a
                        href={`mailto:${jobSeeker.email}`}
                        className="text-blue-600"
                      >
                        {jobSeeker.email}
                      </a>
                      <span>/</span>
                      <span>{jobSeeker.phone}</span>
                      <span>/</span>
                      <span>{jobSeeker.fullAddress}</span>
                    </div> */}
                  </div>

                  {/* Profile Section */}
                  <div className="mb-6">
                    <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">
                      PROFILE
                    </h3>
                    <p className="text-sm">{jobSeeker.resume.profile}</p>
                  </div>

                  {/* Skills Section */}
                  {jobSeeker.skills && jobSeeker.skills.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">
                        SKILLS
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
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
                  )}

                  {/* Work Experience Section - only shown if there are experiences */}
                  {jobSeeker.resume.experience &&
                    jobSeeker.resume.experience.length > 0 && (
                      <div className="mb-6">
                        <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">
                          WORK EXPERIENCE
                        </h3>
                        {jobSeeker.resume.experience.map(
                          (exp: any, index: number) => (
                            <div key={index} className="mb-4">
                              <div className="flex justify-between">
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
                    )}
                </div>
              </div>
            </div>

            {/* Right Column - Job Seeker Details */}
            <div className="col-span-3">
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-300 p-2 font-medium">
                  Job Seeker Details
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    <div className="flex">
                      <div className="w-32 text-gray-600">Status:</div>
                      <div className="flex-1">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {jobSeeker.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">
                        Current Organization:
                      </div>
                      <div className="flex-1 text-blue-600">
                        {jobSeeker.currentOrganization}
                      </div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">Title:</div>
                      <div className="flex-1">{jobSeeker.title}</div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">Email:</div>
                      <div className="flex-1 text-blue-600">
                        {jobSeeker.email}
                      </div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">Mobile Phone:</div>
                      <div className="flex-1">{jobSeeker.mobilePhone}</div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">Address:</div>
                      <div className="flex-1">{jobSeeker.fullAddress}</div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">Desired Salary:</div>
                      <div className="flex-1">{jobSeeker.desiredSalary}</div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">Date Added:</div>
                      <div className="flex-1">{jobSeeker.dateAdded}</div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">Last Contact:</div>
                      <div className="flex-1">{jobSeeker.lastContactDate}</div>
                    </div>

                    <div className="flex">
                      <div className="w-32 text-gray-600">User Owner:</div>
                      <div className="flex-1">{jobSeeker.owner}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Notes Section */}
              <div className="bg-white rounded-lg shadow mt-4">
                <div className="border-b border-gray-300 p-2 font-medium">
                  Recent Notes
                </div>
                <div className="p-4">
                  <div className="flex justify-end mb-3">
                    <button
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => setShowAddNote(true)}
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

                  {/* Show add note form if button was clicked */}
                  {showAddNote && (
                    <div className="mt-4 p-3 bg-gray-50 rounded border">
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
                        rows={3}
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
                </div>
              </div>
            </div>
          </>
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

        {/* Placeholder for other tabs */}
        {activeTab === "docs" && (
          <div className="col-span-7">
            <div className="bg-white p-4 rounded shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Documents</h2>
              <p className="text-gray-500 italic">No documents available</p>
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
                Use the button above to send reference documents to a reference contact via email.
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
            <div className="bg-white p-4 rounded shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Onboarding</h2>
                <button
                  onClick={() => setShowOnboardingModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Send Onboarding
                </button>
              </div>
              <p className="text-gray-600">
                Use the button above to send onboarding documents to the job seeker via Outlook.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Modal */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Send Onboarding Documents</h3>
              <button className="text-gray-600 hover:text-gray-900" onClick={() => setShowOnboardingModal(false)}>✕</button>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-700 mb-2">Select documents to include as links in the email:</div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {onboardingDocs.map(doc => (
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
              Email will be pre-addressed to <span className="font-medium">{jobSeeker?.email}</span> with subject
              <span className="font-medium"> "Onboarding Documents"</span> and body:
              <pre className="bg-gray-50 border rounded p-2 mt-1 whitespace-pre-wrap">Here are your onboarding documents. Please fill these out and return promptly.</pre>
            </div>
            <div className="flex justify-end space-x-2">
              <button className="px-3 py-1 border rounded" onClick={() => setShowOnboardingModal(false)}>Cancel</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={handleSendOnboarding}>
                {isOffice365Connected ? 'Send via Office 365' : 'Open in Outlook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reference Form Modal */}
      {showReferenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Send Reference Form</h3>
              <button className="text-gray-600 hover:text-gray-900" onClick={() => {
                setShowReferenceModal(false);
                setReferenceEmail("");
                setSelectedReferenceDocs({});
              }}>✕</button>
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
              <div className="text-sm text-gray-700 mb-2">Select documents to include as links in the email:</div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {referenceDocs.map(doc => (
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
              Email will be pre-addressed to the reference email address with subject
              <span className="font-medium"> "Reference Request"</span> and a professional message requesting a reference for {jobSeeker?.fullName || "the candidate"}.
            </div>
            <div className="flex justify-end space-x-2">
              <button className="px-3 py-1 border rounded" onClick={() => {
                setShowReferenceModal(false);
                setReferenceEmail("");
                setSelectedReferenceDocs({});
              }}>Cancel</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={handleSendReferenceForm}>
                {isOffice365Connected ? 'Send via Office 365' : 'Open in Outlook'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}
