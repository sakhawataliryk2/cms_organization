"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export type TearsheetEntityType =
  | "organization"
  | "job"
  | "job_seeker"
  | "hiring_manager"
  | "lead"
  | "task";

const ENTITY_LABELS: Record<TearsheetEntityType, string> = {
  organization: "organization",
  job: "job",
  job_seeker: "job seeker",
  hiring_manager: "hiring manager",
  lead: "lead",
  task: "task",
};

const LINKED_API_PATH: Record<TearsheetEntityType, string> = {
  organization: "organization",
  job: "job",
  job_seeker: "job-seeker",
  hiring_manager: "hiring-manager",
  lead: "lead",
  task: "task",
};

function getAssociateBody(
  entityType: TearsheetEntityType,
  entityId: string
): Record<string, number> {
  const id = parseInt(entityId, 10);
  if (Number.isNaN(id)) return {};
  switch (entityType) {
    case "organization":
      return { organization_id: id };
    case "job":
      return { job_id: id };
    case "job_seeker":
      return { job_seeker_id: id };
    case "hiring_manager":
      return { hiring_manager_id: id };
    case "lead":
      return { lead_id: id };
    case "task":
      return { task_id: id };
    default:
      return {};
  }
}

export interface AddTearsheetModalProps {
  open: boolean;
  onClose: () => void;
  entityType: TearsheetEntityType;
  entityId: string;
  onSuccess?: () => void;
}

export default function AddTearsheetModal({
  open,
  onClose,
  entityType,
  entityId,
  onSuccess,
}: AddTearsheetModalProps) {
  const [tearsheetForm, setTearsheetForm] = useState({
    name: "",
    visibility: "Existing" as "New" | "Existing",
    selectedTearsheetId: "",
  });
  const [existingTearsheets, setExistingTearsheets] = useState<any[]>([]);
  const [linkedTearsheets, setLinkedTearsheets] = useState<number[]>([]);
  const [isLoadingTearsheets, setIsLoadingTearsheets] = useState(false);
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);
  const [tearsheetSearchQuery, setTearsheetSearchQuery] = useState("");
  const [showTearsheetDropdown, setShowTearsheetDropdown] = useState(false);
  const tearsheetSearchRef = useRef<HTMLDivElement>(null);

  const entityLabel = ENTITY_LABELS[entityType];

  const getAuthHeaders = () => {
    const token = document.cookie.replace(
      /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    );
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchExistingTearsheets = async () => {
    setIsLoadingTearsheets(true);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const authHeaders = { Authorization: `Bearer ${token}` };

      const response = await fetch("/api/tearsheets", { headers: authHeaders });
      if (response.ok) {
        const data = await response.json();
        setExistingTearsheets(data.tearsheets || []);
      } else {
        setExistingTearsheets([]);
      }

      if (entityId) {
        const path = LINKED_API_PATH[entityType];
        try {
          const linkedResponse = await fetch(
            `/api/tearsheets/${path}/${entityId}`,
            { headers: authHeaders }
          );
          if (linkedResponse.ok) {
            const linkedData = await linkedResponse.json();
            const linkedIds = (linkedData.tearsheets || []).map((ts: any) => ts.id);
            setLinkedTearsheets(linkedIds);
          }
        } catch {
          setLinkedTearsheets([]);
        }
      }
    } catch {
      setExistingTearsheets([]);
    } finally {
      setIsLoadingTearsheets(false);
    }
  };

  const filteredTearsheets =
    tearsheetSearchQuery.trim() === ""
      ? existingTearsheets
      : existingTearsheets.filter((ts: any) =>
          ts.name.toLowerCase().includes(tearsheetSearchQuery.toLowerCase())
        );

  const handleTearsheetSelect = (tearsheet: any) => {
    setTearsheetForm((prev) => ({
      ...prev,
      selectedTearsheetId: tearsheet.id.toString(),
    }));
    setTearsheetSearchQuery(tearsheet.name);
    setShowTearsheetDropdown(false);
  };

  useEffect(() => {
    if (open) {
      fetchExistingTearsheets();
    }
  }, [open, entityType, entityId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tearsheetSearchRef.current &&
        !tearsheetSearchRef.current.contains(event.target as Node)
      ) {
        setShowTearsheetDropdown(false);
      }
    };
    if (showTearsheetDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTearsheetDropdown]);

  const resetForm = () => {
    setTearsheetForm({
      name: "",
      visibility: "Existing",
      selectedTearsheetId: "",
    });
    setTearsheetSearchQuery("");
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const handleSubmit = async () => {
    if (!entityId) {
      toast.error("Entity ID is missing");
      return;
    }

    const authHeaders = getAuthHeaders();
    const associateBody = getAssociateBody(entityType, entityId);

    if (tearsheetForm.visibility === "New") {
      if (!tearsheetForm.name.trim()) {
        toast.error("Please enter a tearsheet name");
        return;
      }
      setIsSavingTearsheet(true);
      try {
        const createRes = await fetch("/api/tearsheets", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: tearsheetForm.name.trim(),
            visibility: "Existing",
          }),
        });
        if (!createRes.ok) {
          const errorData = await createRes.json().catch(() => ({ message: "Failed to create tearsheet" }));
          throw new Error(errorData.message || "Failed to create tearsheet");
        }
        const createData = await createRes.json();
        const tearsheetId = createData.tearsheet?.id;
        if (!tearsheetId) throw new Error("Tearsheet created but ID missing");

        const assocRes = await fetch(`/api/tearsheets/${tearsheetId}/associate`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(associateBody),
        });
        if (!assocRes.ok) {
          const errData = await assocRes.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Failed to add to tearsheet");
        }

        toast.success(`Tearsheet created and ${entityLabel} added.`);
        handleClose();
        onSuccess?.();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create tearsheet. Please try again."
        );
      } finally {
        setIsSavingTearsheet(false);
      }
    } else {
      if (!tearsheetForm.selectedTearsheetId) {
        toast.error("Please select a tearsheet");
        return;
      }
      const selectedTearsheet = existingTearsheets.find(
        (ts: any) => ts.id.toString() === tearsheetForm.selectedTearsheetId
      );
      if (!selectedTearsheet) {
        toast.error("Selected tearsheet not found");
        return;
      }

      setIsSavingTearsheet(true);
      try {
        const res = await fetch(
          `/api/tearsheets/${tearsheetForm.selectedTearsheetId}/associate`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(associateBody),
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Failed to add to tearsheet");
        }

        toast.success(
          `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} has been added to tearsheet "${selectedTearsheet.name}".`
        );
        handleClose();
        onSuccess?.();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to associate tearsheet. Please try again."
        );
      } finally {
        setIsSavingTearsheet(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Add to Tearsheet</h2>
          <button
            onClick={handleClose}
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
              ) : (
                <div className="relative" ref={tearsheetSearchRef}>
                  <input
                    type="text"
                    value={tearsheetSearchQuery}
                    onChange={(e) => {
                      setTearsheetSearchQuery(e.target.value);
                      setShowTearsheetDropdown(true);
                    }}
                    onFocus={() => setShowTearsheetDropdown(true)}
                    onClick={() => setShowTearsheetDropdown(true)}
                    placeholder="Search for a tearsheet..."
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showTearsheetDropdown &&
                    (tearsheetSearchQuery || existingTearsheets.length > 0) && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                        {filteredTearsheets.length > 0 ? (
                          filteredTearsheets.map((ts: any) => {
                            const isLinked = linkedTearsheets.includes(ts.id);
                            return (
                              <button
                                key={ts.id}
                                onClick={() => handleTearsheetSelect(ts)}
                                className={`w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex flex-col ${
                                  isLinked ? "bg-green-50" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">
                                    {ts.name}
                                  </span>
                                  {isLinked && (
                                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                                      Linked
                                    </span>
                                  )}
                                </div>
                                {ts.owner_name && (
                                  <span className="text-xs text-gray-500">
                                    Owner: {ts.owner_name}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No matching tearsheets found
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Search and select an existing tearsheet to add this {entityLabel}{" "}
                to it.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSavingTearsheet}
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            disabled={
              isSavingTearsheet ||
              (tearsheetForm.visibility === "New" &&
                !tearsheetForm.name.trim()) ||
              (tearsheetForm.visibility === "Existing" &&
                !tearsheetForm.selectedTearsheetId)
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
  );
}
