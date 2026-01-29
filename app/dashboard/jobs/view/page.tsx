'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';
import PanelWithHeader from '@/components/PanelWithHeader';
import { FiBriefcase } from "react-icons/fi";
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
// Drag and drop imports
import {
  DndContext,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { restrictToWindowEdges, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbGripVertical } from "react-icons/tb";
import { FiLock, FiUnlock, FiArrowUp, FiArrowDown, FiFilter } from "react-icons/fi";
import { BsFillPinAngleFill } from "react-icons/bs";
import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";

// SortablePanel helper
function SortablePanel({ id, children, isOverlay = false }: { id: string; children: React.ReactNode; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
    zIndex: isOverlay ? 1000 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative group ${isOverlay ? 'cursor-grabbing' : ''}`}>
      {!isOverlay && (
        <button
          {...attributes}
          {...listeners}
          className="absolute left-2 top-2 z-10 p-1 bg-gray-100 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <TbGripVertical className="no-print w-5 h-5 text-gray-600" />
        </button>
      )}
      <div className={`${isDragging && !isOverlay ? 'invisible' : ''} pt-0`}>
        {children}
      </div>
      {isDragging && !isOverlay && (
        <div className="absolute inset-0 border-2 border-dashed border-gray-300 rounded bg-gray-50 flex items-center justify-center p-4">
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider italic">
            Moving Panel...
          </div>
        </div>
      )}
    </div>
  );
}

// Droppable Column Container
function DroppableContainer({ id, children, items }: { id: string, children: React.ReactNode, items: string[] }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="flex flex-col gap-4 w-full min-h-[100px]">
        {children}
      </div>
    </SortableContext>
  );
}

// Sortable row for Job Details edit modal (vertical drag + checkbox + label)
function SortableJobDetailsFieldRow({
  id,
  label,
  checked,
  onToggle,
  isOverlay,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 border border-gray-200 rounded bg-white ${isOverlay ? "shadow-lg cursor-grabbing" : "hover:bg-gray-50"} ${isDragging && !isOverlay ? "invisible" : ""}`}
    >
      {!isOverlay && (
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={18} />
        </button>
      )}
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700 flex-1">{label}</span>
    </div>
  );
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

// Sortable Column Header Component for Documents
function SortableColumnHeader({
  id,
  columnKey,
  label,
  sortState,
  filterValue,
  onSort,
  onFilterChange,
  filterType,
  filterOptions,
}: {
  id: string;
  columnKey: string;
  label: string;
  sortState: ColumnSortState;
  filterValue: ColumnFilterState;
  onSort: () => void;
  onFilterChange: (value: string) => void;
  filterType: "text" | "select" | "number";
  filterOptions?: { label: string; value: string }[];
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

  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(`[data-filter-toggle="${id}"]`)
      ) {
        setShowFilter(false);
      }
    };

    if (showFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilter, id]);

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-r border-gray-200 relative group"
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={16} />
        </button>

        {/* Column Label */}
        <span className="flex-1">{label}</span>

        {/* Sort Control */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSort();
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title={sortState === "asc" ? "Sort descending" : "Sort ascending"}
        >
          {sortState === "asc" ? (
            <FiArrowUp size={14} />
          ) : (
            <FiArrowDown size={14} />
          )}
        </button>
        
        {/* Filter Toggle */}
        <button
          data-filter-toggle={id}
          onClick={(e) => {
            e.stopPropagation();
            setShowFilter(!showFilter);
          }}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${filterValue ? "text-blue-600" : ""
            }`}
          title="Filter column"
        >
          <FiFilter size={14} />
        </button>
      </div>

      {/* Filter Dropdown */}
      {showFilter && (
        <div
          ref={filterRef}
          className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 shadow-lg p-2 mt-1 min-w-[150px]"
          onClick={(e) => e.stopPropagation()}
        >
          {filterType === "text" && (
            <input
              type="text"
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}...`}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          )}
          {filterType === "number" && (
            <input
              type="number"
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}...`}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          )}
          {filterType === "select" && filterOptions && (
            <select
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            >
              <option value="">All</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          {filterValue && (
            <button
              onClick={() => {
                onFilterChange("");
                setShowFilter(false);
              }}
              className="mt-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Clear Filter
            </button>
          )}
        </div>
      )}
    </th>
  );
}

// Move DEFAULT_HEADER_FIELDS outside component to ensure stable reference
const DEFAULT_HEADER_FIELDS = ["phone", "website"];

const JOB_DETAILS_DEFAULT_FIELDS = ["title", "description", "benefits", "requiredSkills", "salaryRange"];
const JOB_DETAILS_STORAGE_KEY = "jobsJobDetailsFields";

export default function JobView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("id");
  const [activeTab, setActiveTab] = useState("summary");
  const [activeQuickTab, setActiveQuickTab] = useState("applied");
  const [quickTabCounts, setQuickTabCounts] = useState({
    applied: 0,
    clientSubmissions: 0,
    interviews: 0,
    placements: 0,
  });

  // Helper functions for notes and references
  const parseAboutReferences = (refs: any) => {
    if (!refs) return [];
    if (Array.isArray(refs)) return refs;
    if (typeof refs === "string") {
      try {
        const parsed = JSON.parse(refs);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const navigateToReference = (ref: any) => {
    if (!ref.id || !ref.type) return;

    let path = "";
    switch (ref.type.toLowerCase()) {
      case "job":
        path = `/dashboard/jobs/view?id=${ref.id}`;
        break;
      case "organization":
        path = `/dashboard/organizations/view?id=${ref.id}`;
        break;
      case "job seeker":
      case "jobseeker":
      case "candidate":
        path = `/dashboard/job-seekers/view?id=${ref.id}`;
        break;
      case "lead":
        path = `/dashboard/leads/view?id=${ref.id}`;
        break;
      case "task":
        path = `/dashboard/tasks/view?id=${ref.id}`;
        break;
      case "placement":
        path = `/dashboard/placements/view?id=${ref.id}`;
        break;
      case "hiring manager":
      case "hiringmanager":
      case "contact":
        path = `/dashboard/hiring-managers/view?id=${ref.id}`;
        break;
      default:
        console.warn("Unknown reference type:", ref.type);
        return;
    }

    if (path) {
      router.push(path);
    }
  };

  // Add states for job data
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // Notes and history state
  const [notes, setNotes] = useState<Array<any>>([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>("");

  const [documents, setDocuments] = useState<Array<any>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  // Document table columns state
  const DOCUMENT_DEFAULT_COLUMNS = ["document_name", "document_type", "created_by_name", "created_at"];
  const [documentColumnFields, setDocumentColumnFields] = useState<string[]>(DOCUMENT_DEFAULT_COLUMNS);
  const [documentColumnSorts, setDocumentColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [documentColumnFilters, setDocumentColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newDocumentType, setNewDocumentType] = useState("General");
  const [newDocumentContent, setNewDocumentContent] = useState("");
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileDetailsName, setFileDetailsName] = useState("");
  const [fileDetailsType, setFileDetailsType] = useState("General");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Document editing state
  const [editingDocument, setEditingDocument] = useState<any | null>(null);
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [editDocumentName, setEditDocumentName] = useState("");
  const [editDocumentType, setEditDocumentType] = useState("General");

  // Note sorting & filtering state
  const [noteActionFilter, setNoteActionFilter] = useState<string>("");
  const [noteAuthorFilter, setNoteAuthorFilter] = useState<string>("");
  const [noteSortKey, setNoteSortKey] = useState<"date" | "action" | "author">("date");
  const [noteSortDir, setNoteSortDir] = useState<"asc" | "desc">("desc");

  const sortedFilteredNotes = useMemo(() => {
    let out = [...notes];

    if (noteActionFilter) {
      out = out.filter((n) => (n.action || "") === noteActionFilter);
    }
    if (noteAuthorFilter) {
      out = out.filter(
        (n) => (n.created_by_name || "Unknown User") === noteAuthorFilter
      );
    }

    out.sort((a, b) => {
      let av: any, bv: any;

      switch (noteSortKey) {
        case "action":
          av = a.action || "";
          bv = b.action || "";
          break;
        case "author":
          av = a.created_by_name || "";
          bv = b.created_by_name || "";
          break;
        default:
          av = new Date(a.created_at).getTime();
          bv = new Date(b.created_at).getTime();
          break;
      }

      if (typeof av === "number" && typeof bv === "number") {
        return noteSortDir === "asc" ? av - bv : bv - av;
      }

      const cmp = String(av).localeCompare(String(bv), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return noteSortDir === "asc" ? cmp : -cmp;
    });

    return out;
  }, [notes, noteActionFilter, noteAuthorFilter, noteSortKey, noteSortDir]);

  const authors = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      if (n.created_by_name) set.add(n.created_by_name);
    });
    return Array.from(set).sort();
  }, [notes]);

  useEffect(() => {
    const fetchCounts = async () => {
      if (!jobId) {
        setQuickTabCounts({
          applied: 0,
          clientSubmissions: 0,
          interviews: 0,
          placements: 0,
        });
        return;
      }

      try {
        const token = document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        );

        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const [jobSeekersRes, notesRes, placementsRes] = await Promise.allSettled([
          fetch("/api/job-seekers", { headers }),
          fetch(`/api/jobs/${jobId}/notes`, { headers }),
          fetch("/api/placements", { headers }),
        ]);

        let applied = 0;
        let clientSubmissions = 0;
        let interviews = 0;
        let placements = 0;

        if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
          const data = await jobSeekersRes.value.json();
          const jobSeekers = Array.isArray(data?.jobSeekers) ? data.jobSeekers : [];

          jobSeekers.forEach((js: any) => {
            let customFields: any = js?.custom_fields ?? js?.customFields ?? {};
            if (typeof customFields === "string") {
              try {
                customFields = JSON.parse(customFields || "{}");
              } catch {
                customFields = {};
              }
            }

            const apps = Array.isArray(customFields?.applications)
              ? customFields.applications
              : [];

            apps.forEach((app: any) => {
              if (!app) return;
              if (String(app.job_id ?? "") !== String(jobId)) return;

              const t = String(app.type || "").toLowerCase();
              if (t === "client_submissions") {
                clientSubmissions += 1;
              } else if (t === "web_submissions" || t === "submissions") {
                applied += 1;
              }
            });
          });
        }

        if (notesRes.status === "fulfilled" && notesRes.value.ok) {
          const data = await notesRes.value.json();
          const list = Array.isArray(data?.notes) ? data.notes : [];
          interviews = list.filter((n: any) => {
            const action = String(n?.action || "").toLowerCase();
            const text = String(n?.text || "").toLowerCase();
            return action.includes("interview") || text.includes("interview");
          }).length;
        }

        if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
          const data = await placementsRes.value.json();
          const list = Array.isArray(data?.placements) ? data.placements : [];
          placements = list.filter(
            (p: any) => String(p?.job_id ?? p?.jobId ?? "") === String(jobId)
          ).length;
        }

        setQuickTabCounts({ applied, clientSubmissions, interviews, placements });
      } catch {
        setQuickTabCounts({
          applied: 0,
          clientSubmissions: 0,
          interviews: 0,
          placements: 0,
        });
      }
    };

    fetchCounts();
  }, [jobId]);

  const fetchDocuments = async (id: string) => {
    setIsLoadingDocuments(true);
    setDocumentError(null);
    try {
      const response = await fetch(`/api/jobs/${id}/documents`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      } else {
        setDocumentError("Failed to fetch documents");
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
      setDocumentError("An error occurred while fetching documents");
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setPendingFiles(fileArray);
      if (fileArray.length === 1) {
        setFileDetailsName(fileArray[0].name.split(".")[0]);
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }

    // Allow selecting the same file again to re-trigger onChange
    event.target.value = "";
  };

  const handleDocDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDocDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDocDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setPendingFiles(fileArray);
      if (fileArray.length === 1) {
        setFileDetailsName(fileArray[0].name.split(".")[0]);
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }
  };

  const handleConfirmFileDetails = async () => {
    if (pendingFiles.length === 0 || !jobId) return;

    setShowFileDetailsModal(false);
    const filesToUpload = [...pendingFiles];
    setPendingFiles([]);

    setUploadErrors({});
    const newUploadProgress = { ...uploadProgress };

    for (const file of filesToUpload) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadErrors((prev) => ({
          ...prev,
          [file.name]: "File size exceeds 10MB limit",
        }));
        continue;
      }

      newUploadProgress[file.name] = 0;
      setUploadProgress({ ...newUploadProgress });

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "document_name",
          filesToUpload.length === 1 ? fileDetailsName : file.name.split(".")[0]
        );
        formData.append(
          "document_type",
          filesToUpload.length === 1 ? fileDetailsType : "General"
        );

        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            const current = prev[file.name] || 0;
            if (current >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return { ...prev, [file.name]: current + 10 };
          });
        }, 200);

        const response = await fetch(`/api/jobs/${jobId}/documents/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
          body: formData,
        });

        clearInterval(progressInterval);

        if (response.ok) {
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
          fetchDocuments(jobId);
        } else {
          const data = await response.json();
          setUploadErrors((prev) => ({
            ...prev,
            [file.name]: data.message || "Upload failed",
          }));
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
        }
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        setUploadErrors((prev) => ({
          ...prev,
          [file.name]: "An error occurred during upload",
        }));
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    }
  };

  const handleAddDocument = async () => {
    if (!jobId || !newDocumentName.trim()) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}/documents`, {
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

      if (response.ok) {
        setShowAddDocument(false);
        setNewDocumentName("");
        setNewDocumentType("General");
        setNewDocumentContent("");
        fetchDocuments(jobId);
      } else {
        const data = await response.json();
        alert(data.message || "Failed to add document");
      }
    } catch (err) {
      console.error("Error adding document:", err);
      alert("An error occurred while adding the document");
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    if (!jobId) return;

    try {
      const response = await fetch(
        `/api/jobs/${jobId}/documents/${documentId}`,
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

      if (response.ok) {
        fetchDocuments(jobId);
      } else {
        const data = await response.json();
        alert(data.message || "Failed to delete document");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("An error occurred while deleting the document");
    }
  };

  const handleDownloadDocument = (doc: any) => {
    if (doc.file_path) {
      const path = String(doc.file_path).startsWith("/")
        ? String(doc.file_path)
        : `/${doc.file_path}`;
      window.open(path, "_blank");
      return;
    }

    if (doc.content) {
      const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${doc.document_name || "document"}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert("This document has no file or content to download.");
    }
  };

  const handleEditDocument = (doc: any) => {
    setEditingDocument(doc);
    setEditDocumentName(doc?.document_name || "");
    setEditDocumentType(doc?.document_type || "General");
    setShowEditDocumentModal(true);
  };

  const handleUpdateDocument = async () => {
    if (!editingDocument?.id || !jobId || !editDocumentName.trim()) return;

    try {
      const response = await fetch(
        `/api/jobs/${jobId}/documents/${editingDocument.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            document_name: editDocumentName,
            document_type: editDocumentType,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update document");
      }

      const data = await response.json();

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === editingDocument.id ? data.document : doc))
      );

      setEditingDocument(null);
      setShowEditDocumentModal(false);
      setEditDocumentName("");
      setEditDocumentType("General");

      alert("Document updated successfully");
    } catch (err) {
      console.error("Error updating document:", err);
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while updating the document"
      );
    }
  };

  // Add Note form state
  const [noteForm, setNoteForm] = useState({
    text: "",
    action: "",
    about: job ? `${formatRecordId(job.id, "job")} ${job.title}` : "",
    aboutReferences: job
      ? [
        {
          id: job.id,
          type: "Job",
          display: `${formatRecordId(job.id, "job")} ${job.title}`,
          value: formatRecordId(job.id, "job"),
        },
      ]
      : [],
    copyNote: "No",
    replaceGeneralContactComments: false,
    additionalReferences: "",
    scheduleNextAction: "None",
    emailNotification: [] as string[], // Changed to array for multi-select
  });
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<{
    action?: string;
    about?: string;
  }>({});

  // Action fields state (custom fields from Jobs field management)
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

  // Reference autocomplete state
  const [referenceSuggestions, setReferenceSuggestions] = useState<any[]>([]);
  const [showReferenceDropdown, setShowReferenceDropdown] = useState(false);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>({
    jobDetails: JOB_DETAILS_DEFAULT_FIELDS,
    details: [
      "status",
      "priority",
      "employmentType",
      "startDate",
      "worksite",
      "dateAdded",
      "jobBoardStatus",
      "owner",
    ],
    hiringManager: ["name", "phone", "email"],
    recentNotes: ["notes"],
  });

  // ===== Summary layout state =====
  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["jobDetails"],
    right: ["details", "hiringManager", "recentNotes"],
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // High-performance sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const measuringConfig = useMemo(() => ({
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  }), []);

  const dropAnimationConfig = useMemo(() => ({
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  }), []);

  // Initialize columns from localStorage or default
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jobsSummaryColumns");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.left && Array.isArray(parsed.left) && parsed.right && Array.isArray(parsed.right)) {
            setColumns(parsed);
          }
        } catch (e) {
          console.error("Error loading panel order:", e);
        }
      }
    }
  }, []);

  // Initialize Job Details field order/visibility from localStorage (persists across all job records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(JOB_DETAILS_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setVisibleFields((prev) => ({ ...prev, jobDetails: parsed }));
      }
    } catch (_) {
      /* keep default */
    }
  }, []);

  const prevColumnsRef = useRef<string>("");

  // Save columns to localStorage
  useEffect(() => {
    const colsString = JSON.stringify(columns);
    if (prevColumnsRef.current !== colsString) {
      localStorage.setItem("jobsSummaryColumns", colsString);
      prevColumnsRef.current = colsString;
    }
  }, [columns]);

  const findContainer = useCallback((id: string) => {
    if (id === "left" || id === "right") {
      return id;
    }

    if (columns.left.includes(id)) return "left";
    if (columns.right.includes(id)) return "right";

    return undefined;
  }, [columns]);

  const handlePanelDragStart = useCallback((event: any) => {
    setActiveId(event.active.id);
  }, []);

  const handlePanelDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handlePanelDragOver = useCallback((_event: DragOverEvent) => {
    return;
  }, []);

  const handlePanelDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    setColumns((prev) => {
      const findContainerInState = (id: string) => {
        if (id === "left" || id === "right") return id as "left" | "right";
        if (prev.left.includes(id)) return "left";
        if (prev.right.includes(id)) return "right";
        return undefined;
      };

      const source = findContainerInState(activeId);
      const target = findContainerInState(overId);

      if (!source || !target) return prev;

      // Reorder within the same column
      if (source === target) {
        // Dropped on the container itself (not a panel)
        if (overId === source) return prev;
        const oldIndex = prev[source].indexOf(activeId);
        const newIndex = prev[source].indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        return {
          ...prev,
          [source]: arrayMove(prev[source], oldIndex, newIndex),
        };
      }

      // Move across columns
      const sourceItems = prev[source].filter((id) => id !== activeId);
      const targetItems = [activeId, ...prev[target].filter((id) => id !== activeId)];

      return {
        ...prev,
        [source]: sourceItems,
        [target]: targetItems,
      };
    });

    setActiveId(null);
  }, []);

  const togglePin = () => {
    setIsPinned((p) => !p);
    if (isPinned === false) setIsCollapsed(false);
  };

  const handleTogglePinnedRecord = () => {
    if (!job) return;
    const key = buildPinnedKey("job", job.id);
    const label = job.title || `${formatRecordId(job.id, "job")}`;
    const url = `/dashboard/jobs/view?id=${job.id}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      window.alert("Maximum 10 pinned records reached");
    }
  };

  useEffect(() => {
    const syncPinned = () => {
      if (!job) return;
      const key = buildPinnedKey("job", job.id);
      setIsRecordPinned(isPinnedRecord(key));
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [job]);

  const renderJobDetailsPanel = () => {
    if (!job) return null;
    const customObj = job.customFields || {};
    const customFieldDefs = (availableFields || []).filter((f: any) => {
      const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
      return !isHidden;
    });

    const renderJobDetailsRow = (key: string) => {
      if (key === "title") {
        return (
          <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Title:</div>
            <div className="flex-1 p-2">
              <span className="text-blue-600 font-semibold">{job.title}</span>
              <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">{job.employmentType}</div>
            </div>
          </div>
        );
      }
      if (key === "description") {
        return (
          <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Description:</div>
            <div className="flex-1 p-2 whitespace-pre-line text-gray-700">{job.description}</div>
          </div>
        );
      }
      if (key === "benefits") {
        return (
          <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Benefits:</div>
            <div className="flex-1 p-2">
              {job.benefits?.length > 0 ? (
                <ul className="list-disc pl-5">
                  {job.benefits.map((benefit: string, index: number) => (
                    <li key={index} className="text-gray-700 mb-1">{benefit}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No benefits listed</p>
              )}
            </div>
          </div>
        );
      }
      if (key === "requiredSkills") {
        return (
          <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Required Skills:</div>
            <div className="flex-1 p-2 text-gray-700">{job.requiredSkills || "-"}</div>
          </div>
        );
      }
      if (key === "salaryRange") {
        return (
          <div key={key} className="flex border-b border-gray-200 last:border-b-0">
            <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Salary Range:</div>
            <div className="flex-1 p-2 text-gray-700">{job.salaryRange}</div>
          </div>
        );
      }
      // Custom field
      const field = customFieldDefs.find(
        (f: any) =>
          String(f.field_key || f.api_name || f.field_name || f.id) === String(key) ||
          String(f.field_label || "") === String(key) ||
          String(f.field_name || "") === String(key)
      );
      const value =
        (customObj as any)?.[key] ??
        (field?.field_label ? (customObj as any)?.[field.field_label] : undefined) ??
        (field?.field_name ? (customObj as any)?.[field.field_name] : undefined);
      const label = field?.field_label || field?.field_name || key;
      return (
        <div key={key} className="flex border-b border-gray-200 last:border-b-0">
          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{label}:</div>
          <div className="flex-1 p-2">{value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : "-"}</div>
        </div>
      );
    };

    return (
      <PanelWithHeader
        title="Job Details"
        onEdit={() => handleEditPanel("jobDetails")}
      >
        <div className="space-y-0 border border-gray-200 rounded">
          {(visibleFields.jobDetails || []).map((key) => renderJobDetailsRow(key))}
        </div>
      </PanelWithHeader>
    );
  };

  const renderDetailsPanel = () => {
    if (!job) return null;
    return (
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
              <div className="flex-1 p-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                  {job.status}
                </span>
              </div>
            </div>
          )}
          {visibleFields.details.includes("priority") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Priority:
              </div>
              <div className="flex-1 p-2">{job.priority}</div>
            </div>
          )}
          {visibleFields.details.includes("employmentType") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Employment Type:
              </div>
              <div className="flex-1 p-2">{job.employmentType}</div>
            </div>
          )}
          {visibleFields.details.includes("startDate") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Start Date:
              </div>
              <div className="flex-1 p-2">{job.startDate}</div>
            </div>
          )}
          {visibleFields.details.includes("worksite") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Worksite Location:
              </div>
              <div className="flex-1 p-2">{job.worksite}</div>
            </div>
          )}
          {visibleFields.details.includes("dateAdded") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Date Added:
              </div>
              <div className="flex-1 p-2">{job.dateAdded}</div>
            </div>
          )}
          {visibleFields.details.includes("jobBoardStatus") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Job Board Status:
              </div>
              <div className="flex-1 p-2">{job.jobBoardStatus}</div>
            </div>
          )}
          {visibleFields.details.includes("owner") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                User Owner:
              </div>
              <div className="flex-1 p-2">{job.owner}</div>
            </div>
          )}
        </div>
      </PanelWithHeader>
    );
  };

  const renderHiringManagerPanel = () => {
    if (!job) return null;
    return (
      <PanelWithHeader
        title="Hiring Manager"
        onEdit={() => handleEditPanel("hiringManager")}
      >
        <div className="space-y-0 border border-gray-200 rounded">
          {visibleFields.hiringManager.includes("name") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Name:
              </div>
              <div className="flex-1 p-2 text-blue-600">
                {job.hiringManager.name}
              </div>
            </div>
          )}
          {visibleFields.hiringManager.includes("phone") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Phone:
              </div>
              <div className="flex-1 p-2">
                {job.hiringManager.phone}
              </div>
            </div>
          )}
          {visibleFields.hiringManager.includes("email") && (
            <div className="flex border-b border-gray-200 last:border-b-0">
              <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">
                Email:
              </div>
              <div className="flex-1 p-2 text-blue-600">
                {job.hiringManager.email}
              </div>
            </div>
          )}
        </div>
      </PanelWithHeader>
    );
  };

  const renderRecentNotesPanel = () => {
    if (!job) return null;
    return (
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
                  {notes.slice(0, 2).map((note) => {
                    const aboutRefs = parseAboutReferences(note.about || note.about_references);
                    return (
                      <div
                        key={note.id}
                        className="mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0"
                      >
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">
                            {note.created_by_name || "Unknown User"}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        {aboutRefs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {aboutRefs.map((ref: any, idx: number) => (
                              <span
                                key={`${ref.type}-${ref.id}-${idx}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px]"
                              >
                                <FiBriefcase className="w-2.5 h-2.5" />
                                {ref.display || ref.value}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-sm text-gray-700">
                          {note.text.length > 100
                            ? `${note.text.substring(0, 100)}...`
                            : note.text}
                        </p>
                      </div>
                    );
                  })}
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
    );
  };

  const renderPanel = useCallback((panelId: string, isOverlay = false) => {
    if (panelId === "jobDetails") {
      return (
        <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
          {renderJobDetailsPanel()}
        </SortablePanel>
      );
    }
    if (panelId === "details") {
      return (
        <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
          {renderDetailsPanel()}
        </SortablePanel>
      );
    }
    if (panelId === "hiringManager") {
      return (
        <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
          {renderHiringManagerPanel()}
        </SortablePanel>
      );
    }
    if (panelId === "recentNotes") {
      return (
        <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
          {renderRecentNotesPanel()}
        </SortablePanel>
      );
    }
    return null;
  }, [job, visibleFields, notes, availableFields]); // Dependencies for inner renderers

  // ... (useHeaderConfig hook already exists below)

  const {
    headerFields,
    setHeaderFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    saveHeaderConfig,
  } = useHeaderConfig({
    entityType: "JOB",
    configType: "header",
    defaultFields: DEFAULT_HEADER_FIELDS,
  });


  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  // Job Details edit modal: order and visibility (synced when modal opens)
  const [modalJobDetailsOrder, setModalJobDetailsOrder] = useState<string[]>([]);
  const [modalJobDetailsVisible, setModalJobDetailsVisible] = useState<Record<string, boolean>>({});
  const [jobDetailsDragActiveId, setJobDetailsDragActiveId] = useState<string | null>(null);

  // Add Placement modal state
  const [showAddPlacementModal, setShowAddPlacementModal] = useState(false);
  const [placementForm, setPlacementForm] = useState({
    internalEmailNotification: [] as string[], // Changed to array for multi-select
    candidate: "",
    status: "",
    startDate: "",
    // Permanent Employment Info
    salary: "",
    placementFeePercent: "",
    placementFeeFlat: "",
    daysGuaranteed: "",
    // Contract Employment Info
    hoursPerDay: "",
    hoursOfOperation: "",
    // Pay Rate Information
    payRate: "",
    payRateChecked: false,
    effectiveDate: "",
    effectiveDateChecked: false,
    overtimeExemption: "False",
  });
  const [placementUsers, setPlacementUsers] = useState<any[]>([]);
  const [isLoadingPlacementUsers, setIsLoadingPlacementUsers] = useState(false);
  const [jobSeekers, setJobSeekers] = useState<any[]>([]);
  const [submittedCandidates, setSubmittedCandidates] = useState<any[]>([]);
  const [isLoadingJobSeekers, setIsLoadingJobSeekers] = useState(false);
  const [isLoadingSubmittedCandidates, setIsLoadingSubmittedCandidates] =
    useState(false);
  const [isSavingPlacement, setIsSavingPlacement] = useState(false);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);
  const [filteredCandidates, setFilteredCandidates] = useState<any[]>([]);
  const candidateInputRef = useRef<HTMLInputElement>(null);

  // Tearsheet modal state
  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);
  const [tearsheetForm, setTearsheetForm] = useState({
    name: "",
    visibility: "Existing", // 'New' or 'Existing'
  });
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);

  // Fetch job when component mounts
  useEffect(() => {
    if (jobId) {
      fetchJob(jobId);
    }
  }, [jobId]);

  // Fetch available fields after job is loaded
  useEffect(() => {
    if (job && jobId) {
      fetchAvailableFields();
      // Update note form about field when job is loaded
      setNoteForm((prev) => ({ ...prev, about: `${job.id} ${job.title}` }));
      fetchDocuments(jobId);
    }
  }, [job, jobId]);

  // Fetch users for email notification
  useEffect(() => {
    if (showAddNote) {
      fetchUsers();
      fetchActionFields();
    }
  }, [showAddNote]);

  // Fetch action fields (custom fields from Jobs field management)
  const fetchActionFields = async () => {
    setIsLoadingActionFields(true);
    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      const response = await fetch("/api/admin/field-management/jobs", {
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

  // Close reference dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        referenceInputRef.current &&
        !referenceInputRef.current.contains(event.target as Node)
      ) {
        setShowReferenceDropdown(false);
      }
    };

    if (showReferenceDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showReferenceDropdown]);

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
        // Filter to only internal system users
        const internalUsers = (data.users || []).filter((user: any) => {
          return (
            user.user_type === "internal" ||
            user.role === "admin" ||
            user.role === "user" ||
            (!user.user_type && user.email)
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

  // Search for references (jobs, organizations, job seekers, etc.)
  const searchReferences = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setReferenceSuggestions([]);
      setShowReferenceDropdown(false);
      return;
    }

    setIsLoadingReferences(true);
    setShowReferenceDropdown(true);

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
      ] = await Promise.allSettled([
        fetch("/api/jobs", { headers }),
        fetch("/api/organizations", { headers }),
        fetch("/api/job-seekers", { headers }),
        fetch("/api/leads", { headers }),
        fetch("/api/tasks", { headers }),
        fetch("/api/placements", { headers }),
      ]);

      const suggestions: any[] = [];
      console.log("Job", job)

      // Process jobs
      if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
        const data = await jobsRes.value.json();
        const term = searchTerm.toLowerCase();

        const jobs = (data.jobs || []).filter((job: any) =>
          job.job_title?.toLowerCase().includes(term) ||
          job.id?.toString().includes(term) ||
          ("j" + job.id?.toString()).toLowerCase().includes(term)
        );

        jobs.forEach((job: any) => {
          suggestions.push({
            id: job.id,
            type: "Job",
            display: `${formatRecordId(job.id, "job")} ${job.job_title || "Untitled"
              }`,
            value: formatRecordId(job.id, "job"),
          });
        });
      }

      // Process organizations
      if (orgsRes.status === "fulfilled" && orgsRes.value.ok) {
        const data = await orgsRes.value.json();
        const term = searchTerm.toLowerCase();

        const orgs = (data.organizations || []).filter((org: any) =>
          org.name?.toLowerCase().includes(term) ||
          org.id?.toString().includes(term)
        );

        orgs.forEach((org: any) => {
          suggestions.push({
            id: org.id,
            type: "Organization",
            display: `#${org.id} ${org.name || "Unnamed"}`,
            value: `#${org.id}`,
          });
        });
      }

      // Process job seekers
      if (jobSeekersRes.status === "fulfilled" && jobSeekersRes.value.ok) {
        const data = await jobSeekersRes.value.json();
        const seekers = (data.jobSeekers || []).filter(
          (seeker: any) =>
            seeker.full_name
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            seeker.first_name
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            seeker.last_name
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            seeker.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            seeker.id?.toString().includes(searchTerm)
        );
        seekers.forEach((seeker: any) => {
          const name =
            seeker.full_name ||
            `${seeker.first_name || ""} ${seeker.last_name || ""}`.trim() ||
            "Unnamed";
          suggestions.push({
            id: seeker.id,
            type: "Job Seeker",
            display: `#${seeker.id} ${name}`,
            value: `#${seeker.id}`,
          });
        });
      }

      // Process leads
      if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
        const data = await leadsRes.value.json();
        const leads = (data.leads || []).filter(
          (lead: any) =>
            lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.company_name
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.id?.toString().includes(searchTerm)
        );
        leads.forEach((lead: any) => {
          suggestions.push({
            id: lead.id,
            type: "Lead",
            display: `#${lead.id} ${lead.name || lead.company_name || "Unnamed"
              }`,
            value: `#${lead.id}`,
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
            display: `#${task.id} ${task.title || "Untitled"}`,
            value: `#${task.id}`,
          });
        });
      }

      // Process placements
      if (placementsRes.status === "fulfilled" && placementsRes.value.ok) {
        const data = await placementsRes.value.json();
        const placements = (data.placements || []).filter(
          (placement: any) =>
            placement.jobTitle
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            placement.jobSeekerName
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            placement.id?.toString().includes(searchTerm)
        );
        placements.forEach((placement: any) => {
          suggestions.push({
            id: placement.id,
            type: "Placement",
            display: `#${placement.id} ${placement.jobSeekerName || "Unnamed"
              } - ${placement.jobTitle || "Untitled"}`,
            value: `#${placement.id}`,
          });
        });
      }

      // Limit to top 10 suggestions
      setReferenceSuggestions(suggestions.slice(0, 10));
    } catch (err) {
      console.error("Error searching references:", err);
      setReferenceSuggestions([]);
    } finally {
      setIsLoadingReferences(false);
    }
  };

  // Handle reference input change
  const handleReferenceInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setNoteForm((prev) => ({ ...prev, additionalReferences: value }));
    searchReferences(value);
  };

  // Handle reference selection
  const handleReferenceSelect = (reference: any) => {
    setNoteForm((prev) => ({
      ...prev,
      aboutReferences: [...prev.aboutReferences, reference],
    }));
    setShowReferenceDropdown(false);
    setReferenceSuggestions([]);
    if (referenceInputRef.current) {
      referenceInputRef.current.focus();
    }
  };

  // Remove reference
  const removeReference = (index: number) => {
    setNoteForm((prev) => {
      const newRefs = [...prev.aboutReferences];
      newRefs.splice(index, 1);
      return { ...prev, aboutReferences: newRefs };
    });
  };

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const response = await fetch("/api/admin/field-management/jobs");
      if (response.ok) {
        const data = await response.json();
        console.log("Data", data)
        const fields = data.customFields || [];
        console.log("Fields", fields)
        setAvailableFields(fields);


        // REMOVED: Auto-adding custom fields to visible fields
        // if (job && job.customFields) {
        //   const customFieldKeys = Object.keys(job.customFields);
        //   customFieldKeys.forEach((fieldKey) => {
        //     if (!visibleFields.jobDetails.includes(fieldKey)) {
        //       setVisibleFields((prev) => ({
        //         ...prev,
        //         jobDetails: [...prev.jobDetails, fieldKey],
        //       }));
        //     }
        //   });
        // }
        const visibleCustomFields = fields.filter((f: any) => {
          const isHidden =
            f?.is_hidden === true ||
            f?.hidden === true ||
            f?.isHidden === true;
          return !isHidden;
        });

        const allCustomKeys = visibleCustomFields.map(
          (f: any) => f.field_name || f.field_key || f.id
        );

        console.log("All Custom Keys", allCustomKeys)

        setVisibleFields((prev) => ({
          ...prev,
          jobDetails: Array.from(new Set([...prev.jobDetails, ...allCustomKeys])),
        }));
        console.log("Visible Fields", visibleFields)
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

  // Job Details field catalog: standard + all custom (for edit modal and display order)
  const jobDetailsFieldCatalog = useMemo(() => {
    const standard: { key: string; label: string }[] = [
      { key: "title", label: "Title" },
      { key: "description", label: "Description" },
      { key: "benefits", label: "Benefits" },
      { key: "requiredSkills", label: "Required Skills" },
      { key: "salaryRange", label: "Salary Range" },
    ];
    const customFromDefs = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    const keysFromDefs = new Set(customFromDefs.map((c) => c.key));
    const customFromJob = Object.keys(job?.customFields || {})
      .filter((k) => !keysFromDefs.has(k))
      .map((k) => ({ key: k, label: k }));
    return [...standard, ...customFromDefs, ...customFromJob];
  }, [availableFields, job?.customFields]);

  // Sync Job Details modal state when opening edit for jobDetails
  useEffect(() => {
    if (editingPanel !== "jobDetails") return;
    const current = visibleFields.jobDetails || [];
    const catalogKeys = jobDetailsFieldCatalog.map((f) => f.key);
    const order = [...current.filter((k) => catalogKeys.includes(k))];
    catalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    setModalJobDetailsOrder(order);
    setModalJobDetailsVisible(
      catalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.jobDetails, jobDetailsFieldCatalog]);

  // Header fields list builder (standard + custom)
  const getHeaderFieldOptions = () => {
    const standard = [
      {
        key: "phone",
        label: "Phone",
        getValue: () => job?.organization?.phone,
      },
      {
        key: "website",
        label: "Website",
        getValue: () => job?.organization?.website,
      },
      { key: "status", label: "Status", getValue: () => job?.status },
      {
        key: "employmentType",
        label: "Employment Type",
        getValue: () => job?.employmentType,
      },
      { key: "startDate", label: "Start Date", getValue: () => job?.startDate },
      {
        key: "worksite",
        label: "Worksite Location",
        getValue: () => job?.worksite,
      },
      { key: "owner", label: "Owner", getValue: () => job?.owner },
    ];

    const custom = Object.keys(job?.customFields || {}).map((k) => ({
      key: `custom:${k}`,
      label: k,
      getValue: () => job?.customFields?.[k],
    }));

    return [...standard, ...custom];
  };

  const moveHeaderField = (fromIndex: number, toIndex: number) => {
    setHeaderFields((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const removeHeaderField = (key: string) => {
    setHeaderFields((prev) => prev.filter((k) => k !== key));
  };

  const toggleHeaderField = (key: string, enabled: boolean) => {
    setHeaderFields((prev) => {
      if (enabled && !prev.includes(key)) return [...prev, key];
      if (!enabled) return prev.filter((k) => k !== key);
      return prev;
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

  // Job Details modal: drag end (reorder)
  const handleJobDetailsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setJobDetailsDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalJobDetailsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // Job Details modal: save order/visibility and persist for all job records
  const handleSaveJobDetailsFields = useCallback(() => {
    const newOrder = modalJobDetailsOrder.filter((k) => modalJobDetailsVisible[k]);
    if (typeof window !== "undefined") {
      localStorage.setItem(JOB_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, jobDetails: newOrder }));
    setEditingPanel(null);
  }, [modalJobDetailsOrder, modalJobDetailsVisible]);

  // Function to fetch job data with better error handling
  const fetchJob = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching job data for ID: ${id}`);
      const response = await fetch(`/api/jobs/${id}`, {
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
          data.message || `Failed to fetch job: ${response.status}`
        );
      }

      console.log("Job data received:", data);

      // Validate job data
      if (!data.job) {
        throw new Error("No job data received from API");
      }

      // Format the job data for display with defensive coding
      let customFieldsObj = {};

      // Safely parse custom_fields if it exists
      if (data.job.custom_fields) {
        try {
          // Handle both string and object formats
          if (typeof data.job.custom_fields === "string") {
            customFieldsObj = JSON.parse(data.job.custom_fields);
          } else if (typeof data.job.custom_fields === "object") {
            customFieldsObj = data.job.custom_fields;
          }
        } catch (error) {
          const parseError = error as Error;
          console.error("Error parsing custom fields:", parseError);
          customFieldsObj = {}; // Default to empty object if parsing fails
        }
      }

      // Format the job data with default values for all fields
      const formattedJob = {
        id: data.job.id || "Unknown ID",
        title: data.job.job_title || "Untitled Job",
        jobType: data.job.job_type || "Not specified",
        category: data.job.category || "Uncategorized",
        status: data.job.status || "Unknown",
        priority: data.job.priority || "-",
        employmentType: data.job.employment_type || "Not specified",
        startDate: data.job.start_date
          ? new Date(data.job.start_date).toLocaleDateString()
          : "Not specified",
        worksite: data.job.worksite_location || "Not specified",
        remoteOption: data.job.remote_option || "Not specified",
        dateAdded: data.job.created_at
          ? new Date(data.job.created_at).toLocaleDateString()
          : "Unknown",
        jobBoardStatus: data.job.job_board_status || "Not Posted",
        owner: data.job.owner || "Not assigned",
        organization: {
          name: data.job.organization_name || "Not specified",
          phone: data.job.organization_phone || "Not provided",
          website: data.job.organization_website || "Not provided",
        },
        hiringManager: {
          name: data.job.hiring_manager || "Not specified",
          phone: "Phone not available",
          email: "Email not available",
        },
        description: data.job.job_description || "No description provided",
        benefits: data.job.benefits
          ? data.job.benefits.split("\n").filter(Boolean)
          : [],
        salaryRange:
          data.job.min_salary && data.job.max_salary
            ? `$${parseFloat(
              data.job.min_salary
            ).toLocaleString()} - $${parseFloat(
              data.job.max_salary
            ).toLocaleString()}`
            : "Not specified",
        requiredSkills: data.job.required_skills || "",
        location: data.job.remote_option || "On-site",
        applicants: 0,
        customFields: customFieldsObj, // Use our properly parsed object
      };

      console.log("Formatted job data:", formattedJob);
      setJob(formattedJob);

      // Now fetch notes and history
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
    } catch (err) {
      console.error("Error fetching job:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching job details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Custom fields section with proper type handling
  const renderCustomFields = () => {
    if (!job || !job.customFields) return null;

    const customFieldKeys = Object.keys(job.customFields);
    if (customFieldKeys.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="font-bold text-lg mb-2">Additional Information</h3>
        <ul className="list-inside">
          {Object.entries(job.customFields).map(([key, value]) => (
            <li key={key} className="mb-1 text-gray-700">
              <span className="font-medium">{key}:</span> {String(value || "")}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Fetch notes for the job
  const fetchNotes = async (id: string) => {
    setIsLoadingNotes(true);

    try {
      const response = await fetch(`/api/jobs/${id}/notes`, {
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

  // Fetch history for the job
  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/jobs/${id}/history`, {
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

  // Handle adding a new note with validation
  const handleAddNote = async () => {
    if (!jobId) return;

    // Clear previous validation errors
    setValidationErrors({});

    // Validate required fields
    const errors: { action?: string; about?: string } = {};
    if (!noteForm.action || noteForm.action.trim() === "") {
      errors.action = "Action is required";
    }
    if (!noteForm.aboutReferences || noteForm.aboutReferences.length === 0) {
      errors.about = "At least one About/Reference is required";
    }

    // If validation errors exist, set them and prevent save
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (!noteForm.text.trim()) return;

    try {
      // Format about references as structured data
      const aboutData = noteForm.aboutReferences.map((ref) => ({
        id: ref.id,
        type: ref.type,
        display: ref.display,
        value: ref.value,
      }));

      const response = await fetch(`/api/jobs/${jobId}/notes`, {
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
          about: JSON.stringify(aboutData),
          about_references: aboutData,
          copy_note: noteForm.copyNote === "Yes",
          replace_general_contact_comments:
            noteForm.replaceGeneralContactComments,
          additional_references: noteForm.additionalReferences,
          schedule_next_action: noteForm.scheduleNextAction,
          email_notification: noteForm.emailNotification.join(","),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.errors) {
          const backendErrors: { action?: string; about?: string } = {};
          if (errorData.errors.action) backendErrors.action = errorData.errors.action;
          if (errorData.errors.about) backendErrors.about = errorData.errors.about;
          setValidationErrors(backendErrors);
          return;
        }
        throw new Error(errorData.message || "Failed to add note");
      }

      const data = await response.json();

      // Add the new note to the list
      setNotes([data.note, ...notes]);

      // Clear the form
      const defaultAboutRef = job
        ? [
          {
            id: job.id,
            type: "Job",
            display: `${formatRecordId(job.id, "job")} ${job.title}`,
            value: formatRecordId(job.id, "job"),
          },
        ]
        : [];

      setNoteForm({
        text: "",
        action: "",
        about: job ? `${formatRecordId(job.id, "job")} ${job.title}` : "",
        aboutReferences: defaultAboutRef,
        copyNote: "No",
        replaceGeneralContactComments: false,
        additionalReferences: "",
        scheduleNextAction: "None",
        emailNotification: [],
      });
      setValidationErrors({});
      setShowAddNote(false);

      // Refresh history
      fetchHistory(jobId);
      alert("Note added successfully");
    } catch (err) {
      console.error("Error adding note:", err);
      alert(err instanceof Error ? err.message : "Failed to add note. Please try again.");
    }
  };

  // Close add note modal
  const handleCloseAddNoteModal = () => {
    setShowAddNote(false);
    const defaultAboutRef = job
      ? [
        {
          id: job.id,
          type: "Job",
          display: `${formatRecordId(job.id, "job")} ${job.title}`,
          value: formatRecordId(job.id, "job"),
        },
      ]
      : [];
    setNoteForm({
      text: "",
      action: "",
      about: job ? `${formatRecordId(job.id, "job")} ${job.title}` : "",
      aboutReferences: defaultAboutRef,
      copyNote: "No",
      replaceGeneralContactComments: false,
      additionalReferences: "",
      scheduleNextAction: "None",
      emailNotification: [],
    });
    setValidationErrors({});
  };

  const handleGoBack = () => {
    router.back();
  };

  // Print handler: ensure Summary tab is active when printing
  const handlePrint = () => {
    const printContent = document.getElementById("printable-summary");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tabTitle = activeTab?.toUpperCase() || "Jobs SUMMARY";

    // clone styles
    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          if (sheet.href) {
            return `<link rel="stylesheet" href="${sheet.href}" />`;
          }
          return `<style>${Array.from(sheet.cssRules)
            .map(rule => rule.cssText)
            .join("")}</style>`;
        } catch {
          return "";
        }
      })
      .join("");

    printWindow.document.write(`
    <html>
      <head>
        <title>${tabTitle}</title>
        ${styles}
        <style>
          /* PAGE SETUP */
          @page {
            size: A4;
            margin: 18mm 16mm;
          }

          body {
            font-family: Inter, system-ui, Arial, sans-serif;
            background: #fff;
            color: #111827;
          }

          /* WRAPPER */
          .print-wrapper {
            max-width: 800px;
            margin: auto;
          }

          /* HEADER */
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }

          .print-title {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.03em;
          }

          .print-date {
            font-size: 11px;
            color: #6b7280;
          }

          /* FOOTER */
          .print-footer {
            position: fixed;
            bottom: 10mm;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
          }

          /* CLEANUP */
          .no-print {
            display: none !important;
          }

          table {
            page-break-inside: avoid;
          }

          .panel {
            page-break-inside: avoid;
          }
        </style>
      </head>

      <body>
        <div class="print-wrapper">

          <div class="print-header">
            <div class="print-title">${tabTitle}</div>
            <div class="print-date">
              ${new Date().toLocaleDateString()}
            </div>
          </div>

          ${printContent.innerHTML}

        </div>

        <div class="print-footer">
          Generated by System • Page <span class="pageNumber"></span>
        </div>
      </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 600);
  };

  // FIXED: Update this to work with Modify tab too
  const handleEdit = () => {
    if (jobId) {
      router.push(`/dashboard/jobs/add?id=${jobId}`);
    }
  };

  const handleActionSelected = (action: string) => {
    console.log(`Action selected: ${action}`);
    if (action === "edit") {
      handleEdit();
    } else if (action === "delete" && jobId) {
      handleDelete(jobId);
    } else if (action === "add-task") {
      // Navigate to add task page with job context
      if (jobId) {
        router.push(
          `/dashboard/tasks/add?relatedEntity=job&relatedEntityId=${jobId}`
        );
      }
    } else if (action === "add-placement") {
      setShowAddPlacementModal(true);
      fetchSubmittedCandidates();
      fetchPlacementUsers();
    } else if (action === "add-note") {
      setShowAddNote(true);
      setActiveTab("notes");
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    }
  };

  // Fetch candidates who were submitted to this job
  const fetchSubmittedCandidates = async () => {
    if (!jobId) return;

    setIsLoadingSubmittedCandidates(true);
    try {
      // Try to fetch applications/submissions for this job
      // If API doesn't exist, we'll need to create it or use a different approach
      const response = await fetch(`/api/jobs/${jobId}/applications`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Assuming the API returns applications with job_seeker_id or job_seeker data
        const candidates =
          data.applications
            ?.map((app: any) => ({
              id: app.job_seeker_id || app.job_seeker?.id,
              name:
                app.job_seeker?.full_name ||
                app.job_seeker?.name ||
                `${app.job_seeker?.first_name || ""} ${app.job_seeker?.last_name || ""
                  }`.trim(),
              email: app.job_seeker?.email,
              ...app.job_seeker,
            }))
            .filter((c: any) => c.id) || [];

        setSubmittedCandidates(candidates);
        setFilteredCandidates(candidates);
      } else {
        // If API doesn't exist, fallback to fetching all job seekers
        // In production, this should be replaced with actual submissions API
        console.warn(
          "Applications API not found, fetching all job seekers as fallback"
        );
        const fallbackResponse = await fetch("/api/job-seekers", {
          headers: {
            Authorization: `Bearer ${document.cookie.replace(
              /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
              "$1"
            )}`,
          },
        });
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const allCandidates = (fallbackData.jobSeekers || []).map(
            (js: any) => ({
              id: js.id,
              name:
                js.full_name ||
                `${js.first_name || ""} ${js.last_name || ""}`.trim() ||
                `Job Seeker #${js.id}`,
              email: js.email,
              ...js,
            })
          );
          setSubmittedCandidates(allCandidates);
          setFilteredCandidates(allCandidates);
        }
      }
    } catch (err) {
      console.error("Error fetching submitted candidates:", err);
      // Fallback to empty array
      setSubmittedCandidates([]);
      setFilteredCandidates([]);
    } finally {
      setIsLoadingSubmittedCandidates(false);
    }
  };

  // Filter candidates based on search query
  useEffect(() => {
    if (!candidateSearchQuery.trim()) {
      setFilteredCandidates(submittedCandidates);
    } else {
      const query = candidateSearchQuery.toLowerCase();
      const filtered = submittedCandidates.filter(
        (candidate) =>
          candidate.name?.toLowerCase().includes(query) ||
          candidate.email?.toLowerCase().includes(query) ||
          candidate.id?.toString().includes(query)
      );
      setFilteredCandidates(filtered);
    }
  }, [candidateSearchQuery, submittedCandidates]);

  // Close candidate dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        candidateInputRef.current &&
        !candidateInputRef.current.contains(event.target as Node)
      ) {
        setShowCandidateDropdown(false);
      }
    };

    if (showCandidateDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showCandidateDropdown]);

  // Fetch active users for placement email notification
  const fetchPlacementUsers = async () => {
    setIsLoadingPlacementUsers(true);
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
        setPlacementUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingPlacementUsers(false);
    }
  };

  // Handle placement form submission
  const handlePlacementSubmit = async () => {
    if (
      !placementForm.candidate ||
      !placementForm.status ||
      !placementForm.startDate
    ) {
      alert(
        "Please fill in all required fields (Candidate, Status, Start Date)"
      );
      return;
    }

    setIsSavingPlacement(true);

    try {
      const response = await fetch("/api/placements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          job_id: jobId,
          job_seeker_id: placementForm.candidate,
          status: placementForm.status,
          start_date: placementForm.startDate,
          internal_email_notification: Array.isArray(
            placementForm.internalEmailNotification
          )
            ? placementForm.internalEmailNotification.join(",")
            : placementForm.internalEmailNotification || null,

          salary: placementForm.salary || null,
          placement_fee_percent: placementForm.placementFeePercent || null,
          placement_fee_flat: placementForm.placementFeeFlat || null,
          days_guaranteed: placementForm.daysGuaranteed || null,

          hours_per_day: placementForm.hoursPerDay || null,
          hours_of_operation: placementForm.hoursOfOperation || null,

          pay_rate: placementForm.payRate || null,
          pay_rate_checked: placementForm.payRateChecked,
          effective_date: placementForm.effectiveDate || null,
          effective_date_checked: placementForm.effectiveDateChecked,
          overtime_exemption: placementForm.overtimeExemption === "True",
        }),
      });

      // ✅ Always parse JSON once
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Failed to create placement");
      }

      // ✅ Get placement ID from API response (support multiple shapes)
      const placementId = data?.placement?.id || data?.placement_id || data?.id;

      if (!placementId) {
        // fallback: at least close modal + notify
        alert("Placement created, but missing placement id in response.");
        setShowAddPlacementModal(false);
        return;
      }

      // ✅ Close modal (optional) and redirect to Modify page
      setShowAddPlacementModal(false);

      // IMPORTANT: update this route to your real placement modify page
      router.push(`/dashboard/placements/add?id=${placementId}`);
      // or if your modify route is edit:
      // router.push(`/dashboard/placements/edit?id=${placementId}`);
    } catch (err) {
      console.error("Error creating placement:", err);
      alert(err instanceof Error ? err.message : "Failed to create placement.");
    } finally {
      setIsSavingPlacement(false);
    }
  };

  // Close placement modal
  const handleClosePlacementModal = () => {
    setShowAddPlacementModal(false);
    setPlacementForm({
      internalEmailNotification: [],
      candidate: "",
      status: "",
      startDate: "",
      salary: "",
      placementFeePercent: "",
      placementFeeFlat: "",
      daysGuaranteed: "",
      hoursPerDay: "",
      hoursOfOperation: "",
      payRate: "",
      payRateChecked: false,
      effectiveDate: "",
      effectiveDateChecked: false,
      overtimeExemption: "False",
    });
    setCandidateSearchQuery("");
    setShowCandidateDropdown(false);
  };

  // Handle user selection for placement email notification
  const handleUserSelection = (userId: string) => {
    setPlacementForm((prev) => {
      const currentSelection = prev.internalEmailNotification || [];
      if (currentSelection.includes(userId)) {
        return {
          ...prev,
          internalEmailNotification: currentSelection.filter(
            (id) => id !== userId
          ),
        };
      } else {
        return {
          ...prev,
          internalEmailNotification: [...currentSelection, userId],
        };
      }
    });
  };

  // Handle tearsheet submission
  const handleTearsheetSubmit = async () => {
    if (!tearsheetForm.name.trim()) {
      alert("Please enter a tearsheet name");
      return;
    }

    if (!jobId) {
      alert("Job ID is missing");
      return;
    }

    setIsSavingTearsheet(true);
    try {
      // Create tearsheet via API
      // Note: If tearsheets API doesn't exist yet, this will need to be created
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
          job_id: jobId,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to create tearsheet" }));
        throw new Error(errorData.message || "Failed to create tearsheet");
      }

      // Success - close modal and reset form
      alert("Tearsheet created successfully!");
      setShowAddTearsheetModal(false);
      setTearsheetForm({ name: "", visibility: "Existing" });
    } catch (err) {
      console.error("Error creating tearsheet:", err);
      // If API doesn't exist, show a message but don't fail completely
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

  // Handle job deletion
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job?")) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/jobs/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete job");
      }

      // Redirect to the jobs list
      router.push("/dashboard/jobs");
    } catch (error) {
      console.error("Error deleting job:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while deleting the job"
      );
      setIsLoading(false);
    }
  };

  const actionOptions = [
    { label: "Add Note", action: () => handleActionSelected("add-note") },
    { label: "Add Task", action: () => handleActionSelected("add-task") },
    {
      label: "Add Placement",
      action: () => handleActionSelected("add-placement"),
    },
    {
      label: "Add Tearsheet",
      action: () => handleActionSelected("add-tearsheet"),
    },
    {
      label: "Publish to Job Board",
      action: () => handleActionSelected("publish"),
    },
    { label: "Delete", action: () => handleActionSelected("delete") },
    // { label: 'Edit', action: () => handleActionSelected('edit') },
    // { label: 'Clone', action: () => handleActionSelected('clone') },
    // { label: 'Transfer', action: () => handleActionSelected('transfer') },
  ];

  // Tabs from the image
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "modify", label: "Modify" },
    { id: "history", label: "History" },
    { id: "notes", label: "Notes" },
    { id: "docs", label: "Docs" },
  ];

  // Quick action tabs
  const quickTabs = [
    { id: "applied", label: "Applied", countKey: "applied" as const },
    { id: "client-submissions", label: "Client Submissions", countKey: "clientSubmissions" as const },
    { id: "interviews", label: "Interviews", countKey: "interviews" as const },
    { id: "placements", label: "Placements", countKey: "placements" as const },
  ];

  // Render notes tab content
  const renderNotesTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Job Notes</h2>
        <button
          onClick={() => setShowAddNote(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Note
        </button>
      </div>

      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap gap-4 mb-6 p-3 bg-gray-50 rounded border border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600 uppercase">
            Action:
          </label>
          <select
            value={noteActionFilter}
            onChange={(e) => setNoteActionFilter(e.target.value)}
            className="p-2 bg-white border border-gray-300 rounded text-sm min-w-[150px]"
          >
            <option value="">All Actions</option>
            {actionFields.map((f) => (
              <option key={f.id || f.field_name} value={f.field_label || f.field_name}>
                {f.field_label || f.field_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600 uppercase">
            User:
          </label>
          <select
            value={noteAuthorFilter}
            onChange={(e) => setNoteAuthorFilter(e.target.value)}
            className="p-2 bg-white border border-gray-300 rounded text-sm min-w-[150px]"
          >
            <option value="">All Users</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600 uppercase">
            Sort By:
          </label>
          <select
            value={noteSortKey}
            onChange={(e) => setNoteSortKey(e.target.value as any)}
            className="p-2 bg-white border border-gray-300 rounded text-sm min-w-[120px]"
          >
            <option value="date">Date</option>
            <option value="action">Action</option>
            <option value="author">User</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={() =>
              setNoteSortDir((d) => (d === "asc" ? "desc" : "asc"))
            }
            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs text-black"
            title="Toggle Sort Direction"
          >
            {noteSortDir === "asc" ? "Asc ↑" : "Desc ↓"}
          </button>

          {(noteActionFilter || noteAuthorFilter) && (
            <button
              onClick={() => {
                setNoteActionFilter("");
                setNoteAuthorFilter("");
              }}
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs hover:bg-gray-200"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Notes List */}
      {isLoadingNotes ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : sortedFilteredNotes.length > 0 ? (
        <div className="space-y-4">
          {sortedFilteredNotes.map((note) => {
            const actionLabel = actionFields.find(
              (af) => af.field_name === note.action || af.field_label === note.action
            )?.field_label || note.action || "";

            const aboutRefs = parseAboutReferences(note.about || note.about_references);

            return (
              <div key={note.id} className="p-4 border rounded hover:bg-gray-50 bg-white">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600">
                        {note.created_by_name || "Unknown User"}
                      </span>
                      {actionLabel && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold uppercase tracking-wider">
                          {actionLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {aboutRefs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-100">
                    <span className="text-xs text-gray-500 self-center">About:</span>
                    {aboutRefs.map((ref: any, idx: number) => (
                      <button
                        key={`${ref.type}-${ref.id}-${idx}`}
                        onClick={() => navigateToReference(ref)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs transition-colors"
                      >
                        <FiBriefcase className="w-3 h-3 text-gray-500" />
                        <span>{ref.display || ref.value}</span>
                      </button>
                    ))}
                  </div>
                )}

                {note.additional_references && !note.about && (
                  <div className="mb-2 text-xs text-gray-600 italic">
                    References: {note.additional_references}
                  </div>
                )}

                <p className="text-gray-700 whitespace-pre-wrap text-sm">{note.text}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded border-2 border-dashed border-gray-200">
          <p className="text-gray-500 italic">
            {(noteActionFilter || noteAuthorFilter)
              ? "No notes match your filter criteria."
              : "No notes have been added yet."}
          </p>
        </div>
      )}
    </div>
  );

  // Render history tab content
  const renderHistoryTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Job History</h2>

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
            let detailsDisplay: React.ReactNode = "";

            try {
              const details =
                typeof item.details === "string"
                  ? JSON.parse(item.details)
                  : item.details;

              switch (item.action) {
                case "CREATE":
                  actionDisplay = "Job Created";
                  detailsDisplay = `Created by ${item.performed_by_name || "Unknown"
                    }`;
                  break;
                case "UPDATE":
                  actionDisplay = "Job Updated";
                  if (details && details.before && details.after) {
                    // Create a list of changes
                    const changes: React.ReactNode[] = [];

                    // Helper function to format values
                    const formatValue = (val: any): string => {
                      if (val === null || val === undefined) return "Empty";
                      if (typeof val === "object") return JSON.stringify(val);
                      return String(val);
                    };

                    for (const key in details.after) {
                      // Skip internal fields that might not be relevant to users
                      if (key === "updated_at") continue;

                      const beforeVal = details.before[key];
                      const afterVal = details.after[key];

                      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
                        // Special handling for custom_fields
                        if (key === "custom_fields") {
                          let beforeObj = typeof beforeVal === 'string' ? JSON.parse(beforeVal) : beforeVal;
                          let afterObj = typeof afterVal === 'string' ? JSON.parse(afterVal) : afterVal;

                          // Handle case where custom_fields might be null/undefined
                          beforeObj = beforeObj || {};
                          afterObj = afterObj || {};

                          if (typeof beforeObj === 'object' && typeof afterObj === 'object') {
                            const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));

                            allKeys.forEach(cfKey => {
                              const beforeCfVal = beforeObj[cfKey];
                              const afterCfVal = afterObj[cfKey];

                              if (beforeCfVal !== afterCfVal) {
                                changes.push(
                                  <div key={`cf-${cfKey}`} className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-sm">
                                    <span className="font-semibold text-gray-700 min-w-[120px]">Custom Field ({cfKey}):</span>
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <span className="text-red-600 bg-red-50 px-1 rounded line-through decoration-red-400 opacity-80">
                                        {formatValue(beforeCfVal)}
                                      </span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-green-700 bg-green-50 px-1 rounded font-medium">
                                        {formatValue(afterCfVal)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                            });
                            continue; // Skip the standard field handling for custom_fields
                          }
                        }

                        // Standard fields
                        const fieldName = key.replace(/_/g, " ");
                        changes.push(
                          <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-sm">
                            <span className="font-semibold text-gray-700 capitalize min-w-[120px]">{fieldName}:</span>
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="text-red-600 bg-red-50 px-1 rounded line-through decoration-red-400 opacity-80">
                                {formatValue(beforeVal)}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-700 bg-green-50 px-1 rounded font-medium">
                                {formatValue(afterVal)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    }

                    if (changes.length > 0) {
                      detailsDisplay = (
                        <div className="flex flex-col gap-2 mt-2 bg-gray-50 p-2 rounded border border-gray-100">
                          {changes}
                        </div>
                      );
                    } else {
                      detailsDisplay = <span className="text-gray-500 italic">No visible changes detected</span>;
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

  // FIXED: Modified the Modify tab to directly use handleEdit
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Edit Job</h2>
      <p className="text-gray-600 mb-4">
        Click the button below to edit this job's details.
      </p>
      <button
        onClick={handleEdit}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Edit Job
      </button>
    </div>
  );

  // Document columns catalog
  const documentColumnsCatalog = useMemo(() => {
    return [
      { key: "document_name", label: "Document Name", sortable: true, filterType: "text" as const },
      { key: "document_type", label: "Type", sortable: true, filterType: "select" as const },
      { key: "created_by_name", label: "Created By", sortable: true, filterType: "text" as const },
      { key: "created_at", label: "Created At", sortable: true, filterType: "text" as const },
    ];
  }, []);

  const getDocumentColumnLabel = (key: string) =>
    documentColumnsCatalog.find((c) => c.key === key)?.label || key;

  const getDocumentColumnInfo = (key: string) =>
    documentColumnsCatalog.find((c) => c.key === key);

  const getDocumentColumnValue = (doc: any, key: string) => {
    switch (key) {
      case "document_name":
        return doc.document_name || "N/A";
      case "document_type":
        return doc.document_type || "N/A";
      case "created_by_name":
        return doc.created_by_name || "System";
      case "created_at":
        return doc.created_at ? new Date(doc.created_at).toLocaleString() : "N/A";
      default:
        return "—";
    }
  };

  // Get unique document types for filter dropdown
  const documentTypeOptions = useMemo(() => {
    const types = new Set<string>();
    documents.forEach((doc) => {
      if (doc.document_type) types.add(doc.document_type);
    });
    return Array.from(types).map((t) => ({ label: t, value: t }));
  }, [documents]);

  // Filtered and sorted documents
  const filteredAndSortedDocuments = useMemo(() => {
    let result = [...documents];

    // Apply filters
    Object.entries(documentColumnFilters).forEach(([columnKey, filterValue]) => {
      if (!filterValue || filterValue.trim() === "") return;

      result = result.filter((doc) => {
        let value = getDocumentColumnValue(doc, columnKey);
        const valueStr = String(value).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        // For select filters, do exact match
        const columnInfo = getDocumentColumnInfo(columnKey);
        if (columnInfo?.filterType === "select") {
          return valueStr === filterStr;
        }

        // For text columns, do contains match
        return valueStr.includes(filterStr);
      });
    });

    // Apply sorting
    const activeSorts = Object.entries(documentColumnSorts).filter(([_, dir]) => dir !== null);
    if (activeSorts.length > 0) {
      const [sortKey, sortDir] = activeSorts[0];
      result.sort((a, b) => {
        let aValue: any = getDocumentColumnValue(a, sortKey);
        let bValue: any = getDocumentColumnValue(b, sortKey);

        // Handle dates properly
        if (sortKey === "created_at") {
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
        }

        // Handle numeric values
        const aNum = typeof aValue === "number" ? aValue : Number(aValue);
        const bNum = typeof bValue === "number" ? bValue : Number(bValue);

        let cmp = 0;
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          cmp = aNum - bNum;
        } else {
          cmp = String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }

        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [documents, documentColumnFilters, documentColumnSorts]);

  // Handle document column sort toggle
  const handleDocumentColumnSort = (columnKey: string) => {
    setDocumentColumnSorts((prev) => {
      const current = prev[columnKey];
      if (current === "asc") {
        return { ...prev, [columnKey]: "desc" };
      } else if (current === "desc") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      } else {
        return { ...prev, [columnKey]: "asc" };
      }
    });
  };

  // Handle document column filter change
  const handleDocumentColumnFilter = (columnKey: string, value: string) => {
    setDocumentColumnFilters((prev) => {
      if (!value || value.trim() === "") {
        const updated = { ...prev };
        delete updated[columnKey];
        return updated;
      }
      return { ...prev, [columnKey]: value };
    });
  };

  // Handle document column drag end
  const handleDocumentColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = documentColumnFields.indexOf(active.id as string);
    const newIndex = documentColumnFields.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(documentColumnFields, oldIndex, newIndex);
      setDocumentColumnFields(newOrder);
    }
  };

  const renderDocsTab = () => {
    return (
      <div className="bg-white p-4 rounded shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Job Documents</h2>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Upload Files
            </button>
            <button
              onClick={() => setShowAddDocument(true)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Add Text Document
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
        />

        <div
          onDragEnter={handleDocDragEnter}
          onDragOver={handleDocDragOver}
          onDragLeave={handleDocDragLeave}
          onDrop={handleDocDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }`}
        >
          <div className="flex flex-col items-center">
            <svg
              className="w-12 h-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-600 mb-2">
              Drag and drop files here, or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-500 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-gray-500">
              Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG, GIF (Max 10MB per file)
            </p>
          </div>
        </div>

        {Object.keys(uploadProgress).length > 0 && (
          <div className="mb-4 space-y-2">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="bg-gray-100 rounded p-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {Object.keys(uploadErrors).length > 0 && (
          <div className="mb-4 space-y-2">
            {Object.entries(uploadErrors).map(([fileName, err]) => (
              <div key={fileName} className="bg-red-50 border border-red-200 rounded p-2">
                <p className="text-sm text-red-800">
                  <strong>{fileName}:</strong> {err}
                </p>
              </div>
            ))}
          </div>
        )}

        {showAddDocument && (
          <div className="mb-6 p-4 bg-gray-50 rounded border">
            <h3 className="font-medium mb-2">Add New Document</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Document Name *</label>
                <input
                  type="text"
                  value={newDocumentName}
                  onChange={(e) => setNewDocumentName(e.target.value)}
                  placeholder="Enter document name"
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Document Type</label>
                <select
                  value={newDocumentType}
                  onChange={(e) => setNewDocumentType(e.target.value)}
                  className="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="General">General</option>
                  <option value="Contract">Contract</option>
                  <option value="Agreement">Agreement</option>
                  <option value="Policy">Policy</option>
                  <option value="Welcome">Welcome</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  value={newDocumentContent}
                  onChange={(e) => setNewDocumentContent(e.target.value)}
                  placeholder="Enter document content..."
                  className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {isLoadingDocuments ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : documentError ? (
          <div className="text-red-500 py-2">{documentError}</div>
        ) : filteredAndSortedDocuments.length > 0 ? (
          <div className="overflow-x-auto">
            <DndContext collisionDetection={closestCorners} onDragEnd={handleDocumentColumnDragEnd}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="text-left p-3 font-medium">Actions</th>
                    <SortableContext
                      items={documentColumnFields}
                      strategy={horizontalListSortingStrategy}
                    >
                      {documentColumnFields.map((key) => {
                        const columnInfo = getDocumentColumnInfo(key);
                        if (!columnInfo) return null;

                        return (
                          <SortableColumnHeader
                            key={key}
                            id={key}
                            columnKey={key}
                            label={getDocumentColumnLabel(key)}
                            sortState={documentColumnSorts[key] || null}
                            filterValue={documentColumnFilters[key] || null}
                            onSort={() => handleDocumentColumnSort(key)}
                            onFilterChange={(value) => handleDocumentColumnFilter(key, value)}
                            filterType={columnInfo.filterType}
                            filterOptions={
                              key === "document_type" ? documentTypeOptions : undefined
                            }
                          />
                        );
                      })}
                    </SortableContext>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <ActionDropdown
                          label="Actions"
                          options={[
                            { label: "View", action: () => setSelectedDocument(doc) },
                            { label: "Edit", action: () => handleEditDocument(doc) },
                            { label: "Download", action: () => handleDownloadDocument(doc) },
                            { label: "Delete", action: () => handleDeleteDocument(doc.id) },
                          ]}
                        />
                      </td>
                      {documentColumnFields.map((key) => (
                        <td key={key} className="p-3">
                          {key === "document_name" ? (
                            <button
                              onClick={() => setSelectedDocument(doc)}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {getDocumentColumnValue(doc, key)}
                            </button>
                          ) : (
                            getDocumentColumnValue(doc, key)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DndContext>
          </div>
        ) : (
          <p className="text-gray-500 italic">
            {documents.length === 0
              ? "No documents available"
              : "No documents match the current filters"}
          </p>
        )}

        {/* Edit Document Modal (Name + Type only) */}
        {showEditDocumentModal && editingDocument && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-50">
            <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Edit Document</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Document Name *</label>
                  <input
                    type="text"
                    value={editDocumentName}
                    onChange={(e) => setEditDocumentName(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Document Type *</label>
                  <select
                    value={editDocumentType}
                    onChange={(e) => setEditDocumentType(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Contract">Contract</option>
                    <option value="Invoice">Invoice</option>
                    <option value="Report">Report</option>
                    <option value="ID">ID</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-5">
                <button
                  onClick={() => {
                    setShowEditDocumentModal(false);
                    setEditingDocument(null);
                    setEditDocumentName("");
                    setEditDocumentType("General");
                  }}
                  className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateDocument}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50"
                  disabled={!editDocumentName.trim()}
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedDocument && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center sticky top-0 z-10">
                <h2 className="text-lg font-semibold">{selectedDocument.document_name}</h2>
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
                    Created by {selectedDocument.created_by_name || "System"} on{" "}
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
    );
  };

  if (isLoading) {
    return <LoadingScreen message="Loading job details..." />;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-gray-700 mb-4">Job not found</div>
        <button
          onClick={handleGoBack}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-2">
      {/* Header with job name and buttons */}
      <div className="bg-gray-400 p-2 flex items-center">
        <div className="flex items-center">
          <div className="bg-blue-200 border border-blue-300 p-1 mr-2">
            {/* <Image
                            src="/file.svg"
                            alt="Job"
                            width={24}
                            height={24}
                        /> */}
            <FiBriefcase size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {formatRecordId(job.id, "job")} {job.title}
          </h1>
        </div>
      </div>

      {/* Phone and Website section */}
      <div className="bg-white border-b border-gray-300 p-3">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          {/* LEFT: dynamic fields */}
          <div className="flex flex-wrap gap-x-10 gap-y-2 flex-1 min-w-0">
            {/* Always show Job Type */}
            <div className="min-w-[140px]">
              <div className="text-xs text-gray-500">Job Type</div>
              <div className="capitalize text-sm font-medium text-gray-900">
                {job?.jobType || "Not specified"}
              </div>
            </div>

            {headerFields.length > 0 &&
              headerFields.map((key) => {
                // Skip if the key is "employmentType" since we are showing it explicitly
                if (key === "employmentType") return null;

                const field = getHeaderFieldOptions().find(
                  (f) => f.key === key
                );
                if (!field) return null;

                const value = field.getValue?.();

                if (key === "website") {
                  const url = String(value || "");
                  return (
                    <div key={key} className="min-w-[140px]">
                      <div className="text-xs text-gray-500">{field.label}</div>

                      {url && url !== "Not provided" ? (
                        <a
                          href={url.startsWith("http") ? url : `https://${url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {url}
                        </a>
                      ) : (
                        <div className="text-sm font-medium text-gray-900">
                          Not provided
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={key} className="min-w-[140px]">
                    <div className="text-xs text-gray-500">{field.label}</div>
                    <div className="text-sm font-medium text-gray-900">
                      {value ? String(value) : "Not provided"}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* RIGHT: actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowHeaderFieldModal(true)}
              className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900"
              aria-label="Customize Header Fields"
              title="Customize Header Fields"
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
              onClick={handleTogglePinnedRecord}
              className={`p-1 hover:bg-gray-200 rounded ${isRecordPinned ? "text-yellow-600" : "text-gray-600"}`}
              aria-label={isRecordPinned ? "Unpin" : "Pin"}
              title={isRecordPinned ? "Unpin" : "Pin"}
              disabled={!job}
            >
              <BsFillPinAngleFill size={18} />
            </button>

            <button
              className="p-1 hover:bg-gray-200 rounded"
              aria-label="Reload"
              onClick={() => jobId && fetchJob(jobId)}
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
            className={`px-4 py-2 ${activeTab === tab.id
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
        <div className="flex-1 space-x-2">
          {quickTabs.map((action) => (
            <button
              key={action.id}
              className={`${activeQuickTab === action.id
                ? "bg-white text-blue-600 font-medium"
                : "bg-white text-gray-700 hover:bg-gray-100"
                } px-4 py-1 rounded-full shadow`}
              onClick={() => setActiveQuickTab(action.id)}
            >
              <span className="flex items-center gap-2">
                <span>{action.label}</span>
                <span className="text-xs text-gray-600">({quickTabCounts[action.countKey] ?? 0})</span>
              </span>
            </button>
          ))}
        </div>

        {/* {activeTab === "summary" && (
          <button
            onClick={togglePin}
            className="p-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-50"
            title={isPinned ? "Unpin panel" : "Pin panel"}
          >
            {isPinned ? (
              <FiLock className="w-5 h-5 text-blue-600" />
            ) : (
              <FiUnlock className="w-5 h-5 text-gray-600" />
            )}
          </button>
        )} */}
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-4">
          {/* Display content based on active tab */}
          {activeTab === "summary" && (
            <div className="col-span-7 relative w-full">
              {/* Pinned side drawer */}
              {/* {isPinned && (
                <div className={`mt-12 fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transition-all duration-300 ${isCollapsed ? "w-12" : "w-1/3"} border-l border-gray-300`}>
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-2 border-b bg-gray-50">
                      <h3 className="font-semibold text-sm">Job Summary</h3>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setIsCollapsed(!isCollapsed)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title={isCollapsed ? "Expand" : "Collapse"}
                        >
                          {isCollapsed ? "▶" : "◀"}
                        </button>
                        <button
                          onClick={togglePin}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Unpin panel"
                        >
                          <FiUnlock className="w-4 h-4 text-blue-600" />
                        </button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="flex-1 overflow-y-auto p-4">
                        <div id="printable-summary">
                          <DndContext
                            id="pinned-summary-dnd"
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            measuring={measuringConfig}
                            modifiers={[restrictToWindowEdges]}
                            onDragStart={handlePanelDragStart}
                            onDragOver={handlePanelDragOver}
                            onDragEnd={handlePanelDragEnd}
                            onDragCancel={handlePanelDragCancel}
                          >
                            <div className="flex flex-col gap-4">
                              <DroppableContainer id="left" items={columns.left}>
                                {columns.left.map((id) => renderPanel(id))}
                              </DroppableContainer>
                              <DroppableContainer id="right" items={columns.right}>
                                {columns.right.map((id) => renderPanel(id))}
                              </DroppableContainer>
                            </div>
                            <DragOverlay dropAnimation={dropAnimationConfig}>
                              {activeId ? renderPanel(activeId, true) : null}
                            </DragOverlay>
                          </DndContext>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )} */}

              {/* Regular summary (not pinned) */}
              {!isPinned && (
                <div id="printable-summary" className="p-4">
                  <DndContext
                    id="regular-summary-dnd"
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    measuring={measuringConfig}
                    modifiers={[restrictToWindowEdges]}
                    onDragStart={handlePanelDragStart}
                    onDragOver={handlePanelDragOver}
                    onDragEnd={handlePanelDragEnd}
                    onDragCancel={handlePanelDragCancel}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <DroppableContainer id="left" items={columns.left}>
                          {columns.left.map((id) => renderPanel(id))}
                        </DroppableContainer>
                      </div>
                      <div>
                        <DroppableContainer id="right" items={columns.right}>
                          {columns.right.map((id) => renderPanel(id))}
                        </DroppableContainer>
                      </div>
                    </div>
                    <DragOverlay dropAnimation={dropAnimationConfig}>
                      {activeId ? renderPanel(activeId, true) : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}
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
            <div className="col-span-7">{renderDocsTab()}</div>
          )}
        </div>
      </div>

      {/* Edit Fields Modal */}
      {editingPanel && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Edit Fields - {editingPanel === "jobDetails" ? "Job Details" : editingPanel}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              {editingPanel === "jobDetails" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all job records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setJobDetailsDragActiveId(e.active.id as string)}
                    onDragEnd={handleJobDetailsDragEnd}
                    onDragCancel={() => setJobDetailsDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalJobDetailsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {modalJobDetailsOrder.map((key) => {
                          const entry = jobDetailsFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableJobDetailsFieldRow
                              key={entry.key}
                              id={entry.key}
                              label={entry.label}
                              checked={!!modalJobDetailsVisible[entry.key]}
                              onToggle={() =>
                                setModalJobDetailsVisible((prev) => ({
                                  ...prev,
                                  [entry.key]: !prev[entry.key],
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={dropAnimationConfig}>
                      {jobDetailsDragActiveId ? (() => {
                        const entry = jobDetailsFieldCatalog.find((f) => f.key === jobDetailsDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableJobDetailsFieldRow
                            id={entry.key}
                            label={entry.label}
                            checked={!!modalJobDetailsVisible[entry.key]}
                            onToggle={() => {}}
                            isOverlay
                          />
                        );
                      })() : null}
                    </DragOverlay>
                  </DndContext>
                  <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
                    <button
                      onClick={handleCloseEditModal}
                      className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveJobDetailsFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
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
                          details: [
                            { key: "status", label: "Status" },
                            { key: "priority", label: "Priority" },
                            { key: "employmentType", label: "Employment Type" },
                            { key: "startDate", label: "Start Date" },
                            { key: "worksite", label: "Worksite Location" },
                            { key: "dateAdded", label: "Date Added" },
                            { key: "jobBoardStatus", label: "Job Board Status" },
                            { key: "owner", label: "User Owner" },
                          ],
                          hiringManager: [
                            { key: "name", label: "Name" },
                            { key: "phone", label: "Phone" },
                            { key: "email", label: "Email" },
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Placement Modal */}
      {showAddPlacementModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-lg font-semibold">
                Internal Email Notification
              </h2>
              <button
                onClick={handleClosePlacementModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {/* Internal Email Notification - Multi-select dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Email Notification
                  </label>
                  {isLoadingPlacementUsers ? (
                    <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                      Loading users...
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500">
                      <div className="max-h-48 overflow-y-auto p-2">
                        {placementUsers.length === 0 ? (
                          <div className="text-gray-500 text-sm p-2">
                            No active users available
                          </div>
                        ) : (
                          placementUsers.map((user) => (
                            <label
                              key={user.id}
                              className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                            >
                              <input
                                type="checkbox"
                                checked={placementForm.internalEmailNotification.includes(
                                  user.id.toString()
                                )}
                                onChange={() =>
                                  handleUserSelection(user.id.toString())
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                              />
                              <span className="text-sm text-gray-700">
                                {user.name || user.email || `User #${user.id}`}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      {placementForm.internalEmailNotification.length > 0 && (
                        <div className="border-t border-gray-300 p-2 bg-gray-50">
                          <div className="text-xs text-gray-600 mb-1">
                            Selected:{" "}
                            {placementForm.internalEmailNotification.length}{" "}
                            user(s)
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {placementForm.internalEmailNotification.map(
                              (userId) => {
                                const user = placementUsers.find(
                                  (u) => u.id.toString() === userId
                                );
                                return user ? (
                                  <span
                                    key={userId}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                                  >
                                    {user.name ||
                                      user.email ||
                                      `User #${userId}`}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUserSelection(userId)
                                      }
                                      className="ml-1 text-blue-600 hover:text-blue-800"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ) : null;
                              }
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Candidate - Searchable Text Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Candidate <span className="text-red-500">*</span>
                  </label>
                  <div className="relative" ref={candidateInputRef}>
                    {isLoadingSubmittedCandidates ? (
                      <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                        Loading candidates...
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={candidateSearchQuery}
                          onChange={(e) => {
                            setCandidateSearchQuery(e.target.value);
                            setShowCandidateDropdown(true);
                          }}
                          onFocus={() => {
                            if (submittedCandidates.length > 0) {
                              setShowCandidateDropdown(true);
                            }
                          }}
                          placeholder="Search for a candidate..."
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />

                        {/* Display selected candidate */}
                        {placementForm.candidate && !candidateSearchQuery && (
                          <div className="mt-2">
                            {(() => {
                              const selected = submittedCandidates.find(
                                (c) =>
                                  c.id.toString() === placementForm.candidate
                              );
                              return selected ? (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                                  {selected.name}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPlacementForm((prev) => ({
                                        ...prev,
                                        candidate: "",
                                      }));
                                      setCandidateSearchQuery("");
                                    }}
                                    className="ml-2 text-blue-600 hover:text-blue-800"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}

                        {/* Autocomplete Dropdown */}
                        {showCandidateDropdown &&
                          filteredCandidates.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                              {filteredCandidates.map((candidate) => (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  onClick={() => {
                                    setPlacementForm((prev) => ({
                                      ...prev,
                                      candidate: candidate.id.toString(),
                                    }));
                                    setCandidateSearchQuery(
                                      candidate.name || ""
                                    );
                                    setShowCandidateDropdown(false);
                                  }}
                                  className={`w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 ${placementForm.candidate ===
                                    candidate.id.toString()
                                    ? "bg-blue-50"
                                    : ""
                                    }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {candidate.name ||
                                          `Candidate #${candidate.id}`}
                                      </div>
                                      {candidate.email && (
                                        <div className="text-xs text-gray-500">
                                          {candidate.email}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                        {showCandidateDropdown &&
                          filteredCandidates.length === 0 &&
                          candidateSearchQuery.trim().length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg p-3 text-sm text-gray-500 text-center">
                              No candidates found matching "
                              {candidateSearchQuery}"
                            </div>
                          )}

                        {submittedCandidates.length === 0 &&
                          !isLoadingSubmittedCandidates && (
                            <div className="mt-1 text-sm text-gray-500">
                              No candidates have been submitted to this job yet.
                            </div>
                          )}
                      </>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={placementForm.status}
                    onChange={(e) =>
                      setPlacementForm((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select status</option>
                    <option value="Temp-Placed">Temp-Placed</option>
                    <option value="Perm-Placed">Perm-Placed</option>
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={placementForm.startDate}
                    onChange={(e) =>
                      setPlacementForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Permanent Employment Info Section */}
                <div className="border border-gray-300 rounded p-4 bg-white">
                  <h3 className="text-md font-semibold mb-4 flex items-center">
                    <span className="w-4 h-4 bg-green-500 rounded-full mr-2 flex-shrink-0"></span>
                    Permanent Employment Info
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Salary
                      </label>
                      <input
                        type="number"
                        value={placementForm.salary}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            salary: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Placement Fee (%)
                      </label>
                      <input
                        type="number"
                        value={placementForm.placementFeePercent}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            placementFeePercent: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Placement Fee (Flat)
                      </label>
                      <input
                        type="number"
                        value={placementForm.placementFeeFlat}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            placementFeeFlat: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Days Guaranteed
                      </label>
                      <input
                        type="number"
                        value={placementForm.daysGuaranteed}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            daysGuaranteed: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contract Employment Info Section */}
                <div className="border border-gray-300 rounded p-4 bg-white">
                  <h3 className="text-md font-semibold mb-4 flex items-center">
                    <span className="w-4 h-4 bg-green-500 rounded-full mr-2 flex-shrink-0"></span>
                    Contract Employment Info
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hours Per Day
                      </label>
                      <input
                        type="text"
                        value={placementForm.hoursPerDay}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            hoursPerDay: e.target.value,
                          }))
                        }
                        placeholder=""
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hours of Operation
                      </label>
                      <input
                        type="text"
                        value={placementForm.hoursOfOperation}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            hoursOfOperation: e.target.value,
                          }))
                        }
                        placeholder=""
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Pay Rate Information Section */}
                <div className="border border-gray-300 rounded p-4 bg-white">
                  <h3 className="text-md font-semibold mb-4 flex items-center">
                    <span className="w-4 h-4 bg-green-500 rounded-full mr-2 flex-shrink-0"></span>
                    Pay Rate Information
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={placementForm.payRateChecked}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            payRateChecked: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label className="block text-sm font-medium text-gray-700 flex-1">
                        Pay Rate
                      </label>
                      <input
                        type="number"
                        value={placementForm.payRate}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            payRate: e.target.value,
                          }))
                        }
                        placeholder="70"
                        className="w-32 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={placementForm.effectiveDateChecked}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            effectiveDateChecked: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label className="block text-sm font-medium text-gray-700 flex-1">
                        Effective Date
                      </label>
                      <input
                        type="date"
                        value={placementForm.effectiveDate}
                        onChange={(e) =>
                          setPlacementForm((prev) => ({
                            ...prev,
                            effectiveDate: e.target.value,
                          }))
                        }
                        className="w-40 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Overtime Exemption
                      </label>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="overtimeExemption"
                            value="True"
                            checked={placementForm.overtimeExemption === "True"}
                            onChange={(e) =>
                              setPlacementForm((prev) => ({
                                ...prev,
                                overtimeExemption: e.target.value,
                              }))
                            }
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">True</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="overtimeExemption"
                            value="False"
                            checked={
                              placementForm.overtimeExemption === "False"
                            }
                            onChange={(e) =>
                              setPlacementForm((prev) => ({
                                ...prev,
                                overtimeExemption: e.target.value,
                              }))
                            }
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">False</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                <button
                  onClick={handleClosePlacementModal}
                  className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                  disabled={isSavingPlacement}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlacementSubmit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={
                    isSavingPlacement ||
                    !placementForm.candidate ||
                    !placementForm.status ||
                    !placementForm.startDate
                  }
                >
                  {isSavingPlacement ? "Saving..." : "Create Placement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Tearsheet Modal */}
      {showAddTearsheetModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
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
                <label className="block text-sm font-medium mb-1">
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
                <label className="block text-sm font-medium mb-2">
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
                    className={`px-4 py-2 text-sm font-medium transition-colors ${tearsheetForm.visibility === "New"
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
                    className={`px-4 py-2 text-sm font-medium transition-colors ${tearsheetForm.visibility === "Existing"
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
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
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
                    Note Text{" "}
                    {noteForm.text.length > 0 ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <textarea
                    value={noteForm.text}
                    onChange={(e) =>
                      setNoteForm((prev) => ({ ...prev, text: e.target.value }))
                    }
                    autoFocus
                    placeholder="Enter your note text here. Reference people and distribution lists using @ (e.g. @John Smith). Reference other records using # (e.g. #Project Manager)."
                    className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                  />
                  {noteForm.text.length < 1 &&
                    <span className="text-green-500">Note Text is required</span>
                  }
                </div>

                {/* Action Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action{" "}
                    {noteForm.action ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  {isLoadingActionFields ? (
                    <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50">
                      Loading actions...
                    </div>
                  ) : (
                    <>
                      <select
                        value={noteForm.action}
                        onChange={(e) => {
                          setNoteForm((prev) => ({ ...prev, action: e.target.value }));
                        }}
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 ${validationErrors.action
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                          }`}
                      >
                        <option value="">Select Action</option>
                        {actionFields.map((f) => (
                          <option key={f.id || f.field_name} value={f.field_label || f.field_name}>
                            {f.field_label || f.field_name}
                          </option>
                        ))}
                      </select>
                      {validationErrors.action && (
                        <p className="mt-1 text-sm text-red-500">
                          {validationErrors.action}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* About Section - Required, Multiple References */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    About / Reference{" "}
                    {(noteForm.aboutReferences && noteForm.aboutReferences.length > 0) ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <div className="relative" ref={referenceInputRef}>
                    {/* Selected References Tags */}
                    {noteForm.aboutReferences && noteForm.aboutReferences.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-300 rounded bg-gray-50 min-h-[40px]">
                        {noteForm.aboutReferences.map((ref, index) => (
                          <span
                            key={`${ref.type}-${ref.id}-${index}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                          >
                            <FiBriefcase className="w-4 h-4" />
                            {ref.display}
                            <button
                              type="button"
                              onClick={() => removeReference(index)}
                              className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Search Input for References */}
                    <div className="relative">
                      {noteForm.aboutReferences && noteForm.aboutReferences.length > 0 && (
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Add Additional References
                        </label>
                      )}
                      <input
                        type="text"
                        value={noteForm.additionalReferences}
                        onChange={handleReferenceInputChange}
                        onFocus={() => {
                          if (noteForm.additionalReferences.trim().length >= 2) {
                            searchReferences(noteForm.additionalReferences);
                          }
                        }}
                        placeholder={
                          noteForm.aboutReferences && noteForm.aboutReferences.length === 0
                            ? "Search and select records (e.g., Job, Org, Candidate)..."
                            : "Type to search more references..."
                        }
                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 pr-8 ${validationErrors.about
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                          }`}
                      />
                      <span className="absolute right-2 top-2 text-gray-400 text-sm">
                        Q
                      </span>
                    </div>

                    {/* Validation Error */}
                    {validationErrors.about && (
                      <p className="mt-1 text-sm text-red-500">
                        {validationErrors.about}
                      </p>
                    )}

                    {/* Suggestions Dropdown */}
                    {showReferenceDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                        {isLoadingReferences ? (
                          <div className="p-3 text-sm text-gray-500 text-center">
                            Searching...
                          </div>
                        ) : referenceSuggestions.length > 0 ? (
                          <>
                            {referenceSuggestions.map((ref, index) => (
                              <button
                                key={`${ref.type}-${ref.id}-${index}`}
                                type="button"
                                onClick={() => handleReferenceSelect(ref)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {ref.display}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {ref.type}
                                    </div>
                                  </div>
                                  <span className="text-xs text-blue-600 font-medium">
                                    {ref.value}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </>
                        ) : noteForm.additionalReferences.trim().length >= 2 ? (
                          <div className="p-3 text-sm text-gray-500 text-center">
                            No references found
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Notification Section - Multi-select */}
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
                      <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500 max-h-48 overflow-y-auto p-2 bg-white">
                        {users.length === 0 ? (
                          <div className="text-gray-500 text-sm p-2 text-center">
                            No internal users found
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {users.map((user) => (
                              <label
                                key={user.id}
                                className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded"
                              >
                                <input
                                  type="checkbox"
                                  checked={noteForm.emailNotification.includes(user.email || user.name)}
                                  onChange={() => {
                                    const value = user.email || user.name;
                                    setNoteForm((prev) => {
                                      const current = prev.emailNotification;
                                      if (current.includes(value)) {
                                        return {
                                          ...prev,
                                          emailNotification: current.filter((v) => v !== value),
                                        };
                                      } else {
                                        return {
                                          ...prev,
                                          emailNotification: [...current, value],
                                        };
                                      }
                                    });
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                                />
                                <span className="text-sm text-gray-700">
                                  {user.name || user.email} {user.email && `(${user.email})`}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {noteForm.emailNotification.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {noteForm.emailNotification.map((val) => (
                          <span
                            key={val}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {val}
                            <button
                              type="button"
                              onClick={() => {
                                setNoteForm((prev) => ({
                                  ...prev,
                                  emailNotification: prev.emailNotification.filter((v) => v !== val),
                                }));
                              }}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
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
                  disabled={!noteForm.text.trim() || !noteForm.action}
                  title="Save Note"
                >
                  SAVE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFileDetailsModal && pendingFiles.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 bg-opacity-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm File Details</h3>
            <div className="space-y-4">
              {pendingFiles.length === 1 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">File Name *</label>
                    <input
                      type="text"
                      value={fileDetailsName}
                      onChange={(e) => setFileDetailsName(e.target.value)}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter file name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Document Type</label>
                    <select
                      value={fileDetailsType}
                      onChange={(e) => setFileDetailsType(e.target.value)}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="General">General</option>
                      <option value="Contract">Contract</option>
                      <option value="Agreement">Agreement</option>
                      <option value="Policy">Policy</option>
                      <option value="Welcome">Welcome</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm text-gray-700 font-medium mb-2">
                    You selected {pendingFiles.length} files
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                    {pendingFiles.map((file) => (
                      <li key={file.name} className="truncate">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    Each file will use its filename as the document name and "General" as the type.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowFileDetailsModal(false);
                  setPendingFiles([]);
                }}
                className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFileDetails}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50"
                disabled={pendingFiles.length === 1 && !fileDetailsName.trim()}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {showHeaderFieldModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">Customize Header Fields</h2>
              <button
                onClick={() => setShowHeaderFieldModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">Available Fields</h3>
                <div className="border rounded p-3 max-h-80 overflow-y-auto space-y-2">
                  {getHeaderFieldOptions().map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={headerFields.includes(f.key)}
                        onChange={(e) =>
                          toggleHeaderField(f.key, e.target.checked)
                        }
                        className="w-4 h-4"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">Header Order</h3>
                <div className="border rounded p-3 max-h-80 overflow-y-auto space-y-3">
                  {headerFields.map((key, idx) => {
                    const f = getHeaderFieldOptions().find(
                      (x) => x.key === key
                    );
                    if (!f) return null;

                    return (
                      <div
                        key={key}
                        className="border rounded p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium">{f.label}</div>
                          <div className="text-xs text-gray-500">
                            Value:{" "}
                            {f.getValue?.()
                              ? String(f.getValue?.())
                              : "(Not provided)"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            disabled={idx === 0}
                            onClick={() => moveHeaderField(idx, idx - 1)}
                            className="px-2 py-1 border rounded disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            disabled={idx === headerFields.length - 1}
                            onClick={() => moveHeaderField(idx, idx + 1)}
                            className="px-2 py-1 border rounded disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeHeaderField(key)}
                            className="px-3 py-1 border rounded"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => {
                  setHeaderFields(DEFAULT_HEADER_FIELDS);
                }}
                className="px-4 py-2 border rounded"
              >
                Reset
              </button>
              <button
                onClick={async () => {
                  const success = await saveHeaderConfig();
                  if (success) {
                    setShowHeaderFieldModal(false);
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}