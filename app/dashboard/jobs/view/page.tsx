'use client'

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ActionDropdown from '@/components/ActionDropdown';
import LoadingScreen from '@/components/LoadingScreen';
import PanelWithHeader from '@/components/PanelWithHeader';
import { FiBriefcase, FiSearch } from "react-icons/fi";
import { HiOutlineUser, HiOutlineOfficeBuilding } from "react-icons/hi";
import { formatRecordId } from '@/lib/recordIdFormatter';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
import RequestActionModal from '@/components/RequestActionModal';
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
import DocumentViewer from "@/components/DocumentViewer";
import HistoryTabFilters, { useHistoryFilters } from "@/components/HistoryTabFilters";
import ConfirmFileDetailsModal from "@/components/ConfirmFileDetailsModal";
import CountdownTimer from "@/components/CountdownTimer";
import { sendCalendarInvite, type CalendarEvent } from "@/lib/office365";
import { toast } from "sonner";
import RecordNameResolver from '@/components/RecordNameResolver';
import FieldValueRenderer from '@/components/FieldValueRenderer';
import AddTearsheetModal from '@/components/AddTearsheetModal';
import SortableFieldsEditModal from '@/components/SortableFieldsEditModal';

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
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const thRef = useRef<HTMLTableCellElement | null>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!showFilter || !filterToggleRef.current || !thRef.current) {
      setFilterPosition(null);
      return;
    }
    const btnRect = filterToggleRef.current.getBoundingClientRect();
    const thRect = thRef.current.getBoundingClientRect();
    setFilterPosition({ top: btnRect.bottom + 4, left: thRect.left, width: Math.max(150, Math.min(250, thRect.width)) });
  }, [showFilter]);

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
      ref={(node) => { thRef.current = node; setNodeRef(node); }}
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
          ref={filterToggleRef}
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

      {/* Filter Dropdown (portal) */}
      {showFilter && filterPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={filterRef}
          className="bg-white border border-gray-300 shadow-lg rounded p-2 z-[100] min-w-[150px]"
          style={{ position: "fixed", top: filterPosition.top, left: filterPosition.left, width: filterPosition.width }}
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
        </div>,
        document.body
      )}
    </th>
  );
}

// Move DEFAULT_HEADER_FIELDS outside component to ensure stable reference
const DEFAULT_HEADER_FIELDS = ["phone", "website"];

// Storage keys for Job Details, Details, Hiring Manager – field lists come from admin (custom field definitions)
const JOB_DETAILS_STORAGE_KEY = "jobsJobDetailsFields";
const DETAILS_STORAGE_KEY = "jobsDetailsFields";
const HIRING_MANAGER_STORAGE_KEY = "jobsHiringManagerFields";

const JOB_VIEW_TAB_IDS = ["summary", "applied", "modify", "history", "notes", "docs"];

// TEMP: Static applications list to simulate XML feed until feed is built
const STATIC_XML_APPLICATIONS = [
  {
    id: 1,
    candidateName: "ONIKA BOYKE",
    dateApplied: "2025-09-06T11:28:00Z",
    status: "Submitted",
    addedBy: "XML Feed",
  },
  {
    id: 2,
    candidateName: "Shahara West",
    dateApplied: "2025-09-15T15:21:00Z",
    status: "Submitted",
    addedBy: "XML Feed",
  },
  {
    id: 3,
    candidateName: "Ajarnie Neil",
    dateApplied: "2025-09-09T16:52:00Z",
    status: "Placed",
    addedBy: "XML Feed",
  },
];

export default function JobView() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const jobId = searchParams.get("id");
  const tabFromUrl = searchParams.get("tab");

  const [activeTab, setActiveTabState] = useState(() =>
    tabFromUrl && JOB_VIEW_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "summary"
  );

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "summary") params.delete("tab");
    else params.set("tab", tabId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (tabFromUrl && JOB_VIEW_TAB_IDS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    } else if (!tabFromUrl && activeTab !== "summary") {
      setActiveTabState("summary");
    }
  }, [tabFromUrl]);
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
  console.log("Job", job)

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

  // Notes and history state
  const [notes, setNotes] = useState<Array<any>>([]);
  const [history, setHistory] = useState<Array<any>>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyFilters = useHistoryFilters(history);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>("");
  // Publish / distribute job (LinkedIn, Job Board) — works without credentials; completes when credentials are added
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTargets, setPublishTargets] = useState<{ linkedin: boolean; job_board: boolean }>({ linkedin: false, job_board: true });
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  // Calendar appointment modal state (used after Add Note → SAVE & Schedule Appointment)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    date: "",
    time: "",
    type: "",
    description: "",
    location: "",
    duration: 30,
    attendees: [] as string[],
    sendInvites: true,
  });
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [appointmentUsers, setAppointmentUsers] = useState<any[]>([]);
  const [isLoadingAppointmentUsers, setIsLoadingAppointmentUsers] = useState(false);

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

  // Delete request state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteFromUrl = searchParams.get("delete");

  // Check for delete parameter in URL to open delete modal
  useEffect(() => {
    if (deleteFromUrl === "true" && !showDeleteModal) {
      setShowDeleteModal(true);
      // Remove the delete parameter from URL after opening modal
      const params = new URLSearchParams(searchParams.toString());
      params.delete("delete");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [deleteFromUrl, showDeleteModal, searchParams, router]);
  const [deleteForm, setDeleteForm] = useState({
    reason: "", // Mandatory reason for deletion
  });
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<any>(null);
  const [isLoadingDeleteRequest, setIsLoadingDeleteRequest] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [unarchiveReason, setUnarchiveReason] = useState('');
  const [isSubmittingUnarchive, setIsSubmittingUnarchive] = useState(false);
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

        // Applied count will ultimately come from XML feed.
        // For now, override with static XML applications to make UI deterministic.
        setQuickTabCounts({
          applied: STATIC_XML_APPLICATIONS.length,
          clientSubmissions,
          interviews,
          placements,
        });
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
        setFileDetailsName(fileArray[0].name.replace(/\.[^/.]+$/, ""));
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
        setFileDetailsName(fileArray[0].name.replace(/\.[^/.]+$/, ""));
        setFileDetailsType("General");
      }
      setShowFileDetailsModal(true);
    }
  };

  // Confirm details and upload the first file in the queue (same pattern as organization)
  const handleConfirmFileDetails = async () => {
    if (pendingFiles.length === 0 || !jobId) return;

    const currentFile = pendingFiles[0];
    await uploadFile(currentFile, fileDetailsName.trim(), fileDetailsType);

    // Move to next file or close modal
    const remaining = pendingFiles.slice(1);
    if (remaining.length > 0) {
      setPendingFiles(remaining);
      // Strip file extension from name
      const fileNameWithoutExt = remaining[0].name.replace(/\.[^/.]+$/, "");
      setFileDetailsName(fileNameWithoutExt);
      setFileDetailsType("General");
    } else {
      setShowFileDetailsModal(false);
      setPendingFiles([]);
    }
  };

  const uploadFile = async (
    file: File,
    documentName: string,
    documentType: string
  ) => {
    if (!jobId) return;

    const fileName = file.name;
    setUploadProgress((prev) => ({ ...prev, [fileName]: 0 }));
    setUploadErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fileName];
      return newErrors;
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_name", documentName);
      formData.append("document_type", documentType);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress((prev) => ({ ...prev, [fileName]: percentComplete }));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200 || xhr.status === 201) {
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
          });
          fetchDocuments(jobId).then(() => toast.success("Document added successfully"));
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setUploadErrors((prev) => ({
            ...prev,
            [fileName]: errorData.message || "Upload failed",
          }));
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
          });
        }
      });

      xhr.addEventListener("error", () => {
        setUploadErrors((prev) => ({
          ...prev,
          [fileName]: "Network error during upload",
        }));
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[fileName];
          return newProgress;
        });
      });

      xhr.open("POST", `/api/jobs/${jobId}/documents/upload`);
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (err) {
      console.error("Error uploading file:", err);
      setUploadErrors((prev) => ({
        ...prev,
        [fileName]: err instanceof Error ? err.message : "Upload failed",
      }));
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        return newProgress;
      });
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
        await fetchDocuments(jobId);
        toast.success("Document added successfully");
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to add document");
      }
    } catch (err) {
      console.error("Error adding document:", err);
      toast.error("An error occurred while adding the document");
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
        toast.error(data.message || "Failed to delete document");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      toast.error("An error occurred while deleting the document");
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    // Check if it's a text file (by mime_type or file extension)
    const isTextFile = doc.mime_type === "text/plain" ||
      doc.file_path?.toLowerCase().endsWith(".txt") ||
      doc.document_name?.toLowerCase().endsWith(".txt");

    // If the document has a stored file path
    if (doc.file_path) {
      // For text files, force download instead of opening in a new tab
      if (isTextFile) {
        try {
          // Check if it's an absolute URL (e.g. from Vercel Blob)
          const isAbsoluteUrl = doc.file_path.startsWith('http://') || doc.file_path.startsWith('https://');

          // Prepend leading slash if missing and not absolute URL
          const url = isAbsoluteUrl
            ? doc.file_path
            : (doc.file_path.startsWith("/") ? doc.file_path : `/${doc.file_path}`);

          // Fetch the file content and create a blob for download
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Failed to fetch file");
          }
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = `${doc.document_name || "document"}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          toast.success("File downloaded successfully");
        } catch (error) {
          console.error("Error downloading text file:", error);
          toast.error("Failed to download file. Opening in new tab instead.");
          // Fallback to opening in new tab if download fails
          const isAbsoluteUrl = doc.file_path.startsWith('http://') || doc.file_path.startsWith('https://');
          const url = isAbsoluteUrl
            ? doc.file_path
            : (doc.file_path.startsWith("/") ? doc.file_path : `/${doc.file_path}`);
          window.open(url, "_blank");
        }
        return;
      }

      // For non-text files, open in a new tab (existing behavior)
      const isAbsoluteUrl = doc.file_path.startsWith('http://') || doc.file_path.startsWith('https://');
      const url = isAbsoluteUrl
        ? doc.file_path
        : (doc.file_path.startsWith("/") ? doc.file_path : `/${doc.file_path}`);
      window.open(url, "_blank");
      return;
    }

    // For text-based documents without a file, trigger a text download
    if (doc.content) {
      const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${doc.document_name || "document"}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("File downloaded successfully");
    } else {
      toast.info("This document has no file or content to download.");
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
    } catch (err) {
      console.error("Error updating document:", err);
      toast.error(
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
    scheduleNextAction: "None",
    emailNotification: [] as string[], // Changed to array for multi-select
  });
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<{
    text?: string;
    action?: string;
    about?: string;
  }>({});

  // Action fields state (custom fields from Jobs field management)
  const [actionFields, setActionFields] = useState<any[]>([]);
  const [isLoadingActionFields, setIsLoadingActionFields] = useState(false);

  // Reference search state for About field
  const [aboutSearchQuery, setAboutSearchQuery] = useState("");
  const [aboutSuggestions, setAboutSuggestions] = useState<any[]>([]);
  const [showAboutDropdown, setShowAboutDropdown] = useState(false);
  const [isLoadingAboutSearch, setIsLoadingAboutSearch] = useState(false);
  const aboutInputRef = useRef<HTMLInputElement>(null);

  // Email notification search state (search-and-add like About/Reference)
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [hiringManagerAvailableFields, setHiringManagerAvailableFields] = useState<any[]>([]);
  const [isLoadingHiringManagerFields, setIsLoadingHiringManagerFields] = useState(false);
  const [jobHiringManager, setJobHiringManager] = useState<any>(null);
  const [isLoadingJobHiringManager, setIsLoadingJobHiringManager] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") {
      return { jobDetails: [], details: [], hiringManager: [], recentNotes: ["notes"] };
    }
    let jobDetails: string[] = [];
    let details: string[] = [];
    let hiringManager: string[] = [];
    try {
      const jd = localStorage.getItem(JOB_DETAILS_STORAGE_KEY);
      if (jd) {
        const parsed = JSON.parse(jd);
        if (Array.isArray(parsed) && parsed.length > 0) jobDetails = Array.from(new Set(parsed));
      }
    } catch (_) { }
    try {
      const d = localStorage.getItem(DETAILS_STORAGE_KEY);
      if (d) {
        const parsed = JSON.parse(d);
        if (Array.isArray(parsed) && parsed.length > 0) details = Array.from(new Set(parsed));
      }
    } catch (_) { }
    try {
      const hm = localStorage.getItem(HIRING_MANAGER_STORAGE_KEY);
      if (hm) {
        const parsed = JSON.parse(hm);
        if (Array.isArray(parsed) && parsed.length > 0) hiringManager = Array.from(new Set(parsed));
      }
    } catch (_) { }
    return { jobDetails, details, hiringManager, recentNotes: ["notes"] };
  });

  // ===== Summary layout state =====
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["jobDetails"],
    right: ["details", "hiringManager", "recentNotes", "openTasks"],
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // High-performance sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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

  // Initialize Details and Hiring Manager field order from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedDetails = localStorage.getItem(DETAILS_STORAGE_KEY);
    if (savedDetails) {
      try {
        const parsed = JSON.parse(savedDetails);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleFields((prev) => ({ ...prev, details: parsed }));
        }
      } catch (_) { }
    }
    const savedHm = localStorage.getItem(HIRING_MANAGER_STORAGE_KEY);
    if (savedHm) {
      try {
        const parsed = JSON.parse(savedHm);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleFields((prev) => ({ ...prev, hiringManager: parsed }));
        }
      } catch (_) { }
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
    let url = `/dashboard/jobs/view?id=${job.id}`;
    if (activeTab && activeTab !== "summary") url += `&tab=${activeTab}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      toast.info("Maximum 10 pinned records reached");
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

  // Fetch users for appointment attendees when appointment modal opens
  useEffect(() => {
    if (showAppointmentModal) {
      fetchAppointmentUsers();
    }
  }, [showAppointmentModal]);

  const renderJobDetailsPanel = () => {
    if (!job) return null;
    const customObj = job.customFields || {};
    const customFieldDefs = (availableFields || []).filter((f: any) => {
      const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
      return !isHidden;
    });

    const renderJobDetailsRow = (key: string) => {
      // if (key === "title") {
      //   return (
      //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
      //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Title:</div>
      //       <div className="flex-1 p-2">
      //         <span className="text-blue-600 font-semibold">{job.title}</span>
      //         <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">{job.employmentType}</div>
      //       </div>
      //     </div>
      //   );
      // }
      // if (key === "description") {
      //   return (
      //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
      //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Description:</div>
      //       <div className="flex-1 p-2 whitespace-pre-line text-gray-700">{job.description}</div>
      //     </div>
      //   );
      // }
      // if (key === "benefits") {
      //   return (
      //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
      //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Benefits:</div>
      //       <div className="flex-1 p-2">
      //         {job.benefits?.length > 0 ? (
      //           <ul className="list-disc pl-5">
      //             {job.benefits.map((benefit: string, index: number) => (
      //               <li key={index} className="text-gray-700 mb-1">{benefit}</li>
      //             ))}
      //           </ul>
      //         ) : (
      //           <p className="text-gray-500 italic">No benefits listed</p>
      //         )}
      //       </div>
      //     </div>
      //   );
      // }
      // if (key === "requiredSkills") {
      //   return (
      //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
      //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Required Skills:</div>
      //       <div className="flex-1 p-2 text-gray-700">{job.requiredSkills || "-"}</div>
      //     </div>
      //   );
      // }
      // if (key === "salaryRange") {
      //   return (
      //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
      //       <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Salary Range:</div>
      //       <div className="flex-1 p-2 text-gray-700">{job.salaryRange}</div>
      //     </div>
      //   );
      // }
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
      const fieldValue = value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : "-";
      const lookupType = (field?.lookup_type || field?.lookupType || "") as any;
      const fieldInfo = { key, label, fieldType: field?.field_type ?? field?.fieldType, lookupType, multiSelectLookupType: field?.multi_select_lookup_type ?? field?.multiSelectLookupType };
      return (
        <div key={key} className="flex border-b border-gray-200 last:border-b-0">
          <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{label}:</div>
          <div className="flex-1 p-2">
            <FieldValueRenderer value={fieldValue} fieldInfo={fieldInfo} />
              </div>
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
    const customFieldDefs = (availableFields || []).filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden);
    const renderDetailsRow = (key: string) => {
      const label = detailsFieldCatalog.find((f) => f.key === key)?.label || key;
      const LabelCell = () => (
        <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{label}:</div>
      );
      switch (key) {
        // case "status":
        //   return (
        //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
        //       <LabelCell />
        //       <div className="flex-1 p-2">
        //         <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{job.status}</span>
        //       </div>
        //     </div>
        //   );
        // case "priority":
        //   return (
        //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
        //       <LabelCell />
        //       <div className="flex-1 p-2">{job.priority ?? "-"}</div>
        //     </div>
        //   );
        // case "employmentType":
        //   return (
        //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
        //       <LabelCell />
        //       <div className="flex-1 p-2">{job.employmentType ?? "-"}</div>
        //     </div>
        //   );
        // case "startDate":
        //   return (
        //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
        //       <LabelCell />
        //       <div className="flex-1 p-2">{job.startDate ?? "-"}</div>
        //     </div>
        //   );
        // case "worksite":
        //   return (
        //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
        //       <LabelCell />
        //       <div className="flex-1 p-2">{job.worksite ?? "-"}</div>
        //     </div>
        //   );
        // case "dateAdded":
        //   return (
        //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
        //       <LabelCell />
        //       <div className="flex-1 p-2">{job.dateAdded ?? "-"}</div>
        //     </div>
        //   );
        // case "jobBoardStatus":
        //   return (
        //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
        //       <LabelCell />
        //       <div className="flex-1 p-2">{job.jobBoardStatus ?? "-"}</div>
        //     </div>
        //   );
        // case "owner":
        //   return (
        //     <div key={key} className="flex border-b border-gray-200 last:border-b-0">
        //       <LabelCell />
        //       <div className="flex-1 p-2">{job.owner ?? "-"}</div>
        //     </div>
        //   );
        default: {
          const field = customFieldDefs.find((f: any) => (f.field_name || f.field_key || f.field_label || f.id) === key);
          const fieldLabel = field?.field_label || field?.field_name || key;
          const fieldValue = job.customFields?.[fieldLabel] ?? job?.custom_fields?.[fieldLabel] ?? "-";
          const fieldInfo = { key, label: fieldLabel, fieldType: field?.field_type ?? field?.fieldType, lookupType: field?.lookup_type ?? field?.lookupType, multiSelectLookupType: field?.multi_select_lookup_type ?? field?.multiSelectLookupType };
          return (
            <div key={key} className="flex border-b border-gray-200 last:border-b-0">
              <LabelCell />
              <div className="flex-1 p-2">
                <FieldValueRenderer value={fieldValue} fieldInfo={fieldInfo as any} />
              </div>
            </div>
          );
        }
      }
    };
    return (
      <PanelWithHeader title="Details" onEdit={() => handleEditPanel("details")}>
        <div className="space-y-0 border border-gray-200 rounded">
          {Array.from(new Set(visibleFields.details || [])).map((key) => renderDetailsRow(key))}
        </div>
      </PanelWithHeader>
    );
  };

  const renderHiringManagerPanel = () => {
    if (!job) return null;
    const hm = jobHiringManager;
    const customObj = hm?.customFields || {};
    const customFieldDefs = (hiringManagerAvailableFields || []).filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden);

    const getHMLabel = (key: string) => hiringManagerFieldCatalog.find((f) => f.key === key)?.label || key;

    const getCustomValue = (rawKey: string) => {
      for (const fieldDef of customFieldDefs) {
        if (String(fieldDef.field_key || fieldDef.api_name || "").toLowerCase() === rawKey.toLowerCase()) {
          const v = customObj[rawKey] ?? customObj[fieldDef.field_name];
          if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
        }
        if (fieldDef.field_name && (customObj[fieldDef.field_name] !== undefined || customObj[rawKey] !== undefined)) {
          const val = customObj[rawKey] ?? customObj[fieldDef.field_name];
          if (val !== undefined && val !== null && String(val).trim() !== "") return String(val);
        }
      }
      return customObj[rawKey] !== undefined && customObj[rawKey] !== null && String(customObj[rawKey]).trim() !== ""
        ? String(customObj[rawKey]) : null;
    };

    const hmKeys = visibleFields.hiringManager || [];
    const effectiveRows: { key: string; label: string }[] = [];
    for (const key of hmKeys) {
      effectiveRows.push({ key, label: getHMLabel(key) });
    }

    const renderHiringManagerDetailsRow = (key: string) => {
      const label = hiringManagerFieldCatalog.find((f) => f.key === key)?.label || key;
      const LabelCell = () => (
        <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{label}:</div>
      );
      if (!hm) return null;
      switch (key) {
        // case "status":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.status || "-"}</div></div>);
        // case "organization":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm text-blue-600">{hm.organization?.name || "-"}</div></div>);
        // case "department":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.department || "-"}</div></div>);
        // case "email":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.email && hm.email !== "(Not provided)" ? <a href={`mailto:${hm.email}`} className="text-blue-600 hover:underline">{hm.email}</a> : "-"}</div></div>);
        // case "email2":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.email2 && hm.email2 !== "(Not provided)" ? <a href={`mailto:${hm.email2}`} className="text-blue-600 hover:underline">{hm.email2}</a> : "-"}</div></div>);
        // case "mobilePhone":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.mobilePhone && hm.mobilePhone !== "(Not provided)" ? <a href={`tel:${hm.mobilePhone}`} className="text-blue-600 hover:underline">{hm.mobilePhone}</a> : "-"}</div></div>);
        // case "directLine":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.directLine && hm.directLine !== "(Not provided)" ? <a href={`tel:${hm.directLine}`} className="text-blue-600 hover:underline">{hm.directLine}</a> : "-"}</div></div>);
        // case "reportsTo":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.reportsTo || "-"}</div></div>);
        // case "linkedinUrl":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.linkedinUrl && hm.linkedinUrl !== "Not provided" ? <a href={hm.linkedinUrl.startsWith("http") ? hm.linkedinUrl : `https://${hm.linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{hm.linkedinUrl}</a> : "-"}</div></div>);
        // case "dateAdded":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.dateAdded || "-"}</div></div>);
        // case "owner":
        //   return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.owner || "-"}</div></div>);
        case "address":
          return (<div key={key} className="flex border-b border-gray-200 last:border-b-0"><LabelCell /><div className="flex-1 p-2 text-sm">{hm.address || "-"}</div></div>);
        default: {
          const cv = getCustomValue(label);
          const val = cv ?? (hm as any)[key];
          const lookupType = (customFieldDefs.find((f: any) => (f.field_name || f.field_key || f.field_label || f.id) === key)?.lookup_type || customFieldDefs.find((f: any) => (f.field_name || f.field_key || f.field_label || f.id) === key)?.lookupType || "") as any;
          const fieldValue = val !== undefined && val !== null && String(val).trim() !== "" ? String(val) : "-";
          console.log("lookupType", lookupType);
          return (
            <div
              key={key}
              className="flex border-b border-gray-200 last:border-b-0"
            >
              <LabelCell />
              <div className="flex-1 p-2 text-sm">
                {
                  /\(\d{3}\)\s\d{3}-\d{4}/.test(fieldValue || "") ? (
                    <a href={`tel:${String(fieldValue)}`} className="text-blue-600 hover:underline">
                      {String(fieldValue)}
                    </a>
                  ) : String(fieldValue)?.includes("@") ? (
                    <a href={`mailto:${String(fieldValue)}`} className="text-blue-600 hover:underline">
                      {String(fieldValue)}
                    </a>
                  ) : String(fieldValue)?.startsWith("http") || String(fieldValue)?.startsWith("https") ? (
                    <a href={String(fieldValue)} className="text-blue-600 hover:underline">
                      {String(fieldValue)}
                    </a>
                  ) : lookupType && fieldValue ? (
                    <RecordNameResolver
                      id={String(fieldValue || "") || null}
                      type={lookupType as any}
                      clickable
                      fallback={String(fieldValue || "") || ""}
                    />
                  ) : (
                    String(fieldValue)
                  )
                }
              </div>
            </div>
          );
        }
      }
    };

    return (
      <PanelWithHeader
        title="Hiring Manager"
        onEdit={() => handleEditPanel("hiringManager")}
      >
        <div className="space-y-0 border border-gray-200 rounded">
          {isLoadingJobHiringManager ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading hiring manager…</div>
          ) : !hm ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {job.hiringManager?.name ? `${job.hiringManager.name} — full details unavailable` : "No hiring manager selected for this job."}
            </div>
          ) : (visibleFields.hiringManager || []).length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No fields visible. Use the edit icon to show fields.</div>
          ) : (
            effectiveRows.map((row) =>
              renderHiringManagerDetailsRow(row.key)
            )
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

  // Hiring Manager panel field catalog: from admin (hiring-managers) field definitions + record customFields only
  const hiringManagerFieldCatalog = useMemo(() => {
    const fromApi = (hiringManagerAvailableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    // const seen = new Set(fromApi.map((f) => f.key));
    // const fromHM = Object.keys(jobHiringManager?.customFields || {})
    //   .filter((k) => !seen.has(k))
    //   .map((k) => ({ key: k, label: k }));
    return [...fromApi];
  }, [hiringManagerAvailableFields]);

  useEffect(() => {
    const keys = hiringManagerFieldCatalog.map((f) => f.key);
    if (keys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.hiringManager || [];
        if (current.length > 0) return prev;
        return { ...prev, hiringManager: keys };
      });
    }
  }, [hiringManagerFieldCatalog]);

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
    if (panelId === "openTasks") {
      return (
        <SortablePanel key={panelId} id={panelId} isOverlay={isOverlay}>
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
                      onClick={() => router.push(`/dashboard/tasks/view?id=${task.id}`)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-medium text-blue-600 hover:underline">{task.title}</h4>
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
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <div className="flex space-x-3">
                          {task.due_date && (
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          )}
                          {task.assigned_to_name && (
                            <span>Assigned to: {task.assigned_to_name}</span>
                          )}
                        </div>
                        {task.status && <span className="text-gray-600">{task.status}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 italic">No open tasks</div>
              )}
            </div>
          </PanelWithHeader>
        </SortablePanel>
      );
    }
    return null;
  }, [job, jobHiringManager, visibleFields, notes, tasks, isLoadingTasks, tasksError, availableFields, hiringManagerFieldCatalog, hiringManagerAvailableFields]); // Dependencies for inner renderers

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
  const [headerFieldsOrder, setHeaderFieldsOrder] = useState<string[]>([]);

  const [modalDetailsOrder, setModalDetailsOrder] = useState<string[]>([]);
  const [modalDetailsVisible, setModalDetailsVisible] = useState<Record<string, boolean>>({});

  const [modalHiringManagerOrder, setModalHiringManagerOrder] = useState<string[]>([]);
  const [modalHiringManagerVisible, setModalHiringManagerVisible] = useState<Record<string, boolean>>({});

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

  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);

  // Fetch job when component mounts
  useEffect(() => {
    if (jobId) {
      fetchJob(jobId);
    }
  }, [jobId]);

  // Fetch hiring manager fields (for Hiring Manager panel - same as Hiring Manager modify page)
  const fetchHiringManagerFields = async () => {
    setIsLoadingHiringManagerFields(true);
    try {
      const response = await fetch("/api/admin/field-management/hiring-managers");
      if (response.ok) {
        const data = await response.json();
        const fields = data.customFields || data.fields || data.data?.fields || [];
        setHiringManagerAvailableFields(Array.isArray(fields) ? fields : []);
      }
    } catch (err) {
      console.error("Error fetching hiring manager fields:", err);
    } finally {
      setIsLoadingHiringManagerFields(false);
    }
  };

  // Resolve hiring manager ID from job (stored in custom_fields via Hiring Manager lookup field)
  const getJobHiringManagerId = (): string | null => {
    if (!job?.customFields || !availableFields.length) return null;
    const hmField = availableFields.find((f: any) => {
      const label = String(f.field_label || "").trim().toLowerCase();
      return label === "hiring manager" || label.includes("hiring manager");
    });
    if (!hmField) return null;
    const key = hmField.field_name || hmField.field_key;
    if (!key) return null;
    const val = job.customFields[key];
    if (val == null || val === "") return null;
    return String(val);
  };

  // Fetch full hiring manager for the job (same data/structure as Hiring Manager view page)
  const fetchJobHiringManager = async (hmId: string) => {
    setIsLoadingJobHiringManager(true);
    setJobHiringManager(null);
    console.log("Fetching!")
    try {
      const response = await fetch(`/api/hiring-managers/${hmId}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (!response.ok) return;
      const data = await response.json();
      const hm = data.hiringManager;
      if (!hm) return;
      const customFields = typeof hm.custom_fields === "string"
        ? (() => { try { return JSON.parse(hm.custom_fields); } catch { return {}; } })()
        : hm.custom_fields || {};
      setJobHiringManager({
        id: hm.id,
        firstName: hm.first_name || "",
        lastName: hm.last_name || "",
        fullName: hm.full_name || `${hm.last_name || ""}, ${hm.first_name || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "—",
        title: hm.title || "Not specified",
        phone: hm.phone || "(Not provided)",
        mobilePhone: hm.mobile_phone || "(Not provided)",
        directLine: hm.direct_line || "(Not provided)",
        email: hm.email || "(Not provided)",
        email2: hm.email2 || "",
        organization: {
          id: hm.organization_id,
          name: hm.organization_name || hm.organization_name_from_org || "Not specified",
        },
        status: hm.status || "Active",
        department: hm.department || "Not specified",
        reportsTo: hm.reports_to || "Not specified",
        owner: hm.owner || "Not assigned",
        linkedinUrl: hm.linkedin_url || "Not provided",
        dateAdded: hm.date_added ? new Date(hm.date_added).toLocaleDateString() : (hm.created_at ? new Date(hm.created_at).toLocaleDateString() : "Unknown"),
        address: hm.address || "No address provided",
        customFields,
      });
    } catch (err) {
      console.error("Error fetching job hiring manager:", err);
    } finally {
      setIsLoadingJobHiringManager(false);
    }
  };

  // Fetch available fields after job is loaded
  useEffect(() => {
    if (job && jobId) {
      fetchAvailableFields();
      fetchHiringManagerFields();
      // Update note form about field when job is loaded
      setNoteForm((prev) => ({ ...prev, about: `${job.id} ${job.title}` }));
      fetchDocuments(jobId);
    }
  }, [job, jobId]);

  // Fetch full hiring manager when job has hiring manager ID (from custom_fields or hiring_manager column)
  useEffect(() => {
    if (!job) return;
    const hmId = (() => {
      // 1) Try custom_fields ( Hiring Manager lookup field )
      if (availableFields.length > 0) {
        const hmField = availableFields.find((f: any) => {
          const label = String(f.field_label || "").trim().toLowerCase();
          return label === "hiring manager" || label.includes("hiring manager");
        });
        if (hmField) {
          const key = hmField.field_name || hmField.field_key;
          const val = job.customFields?.[key];
          if (val != null && val !== "") return String(val);
        }
      }
      // 2) Fallback: job.hiring_manager may store ID (e.g. "21") when backend stores ID instead of name
      const hmRaw = job.hiringManager?.name ?? (job as any).hiring_manager;
      const str = String(hmRaw || "").trim();
      if (/^\d+$/.test(str)) return str;
      return null;
    })();
    if (hmId) {
      fetchJobHiringManager(hmId);
    } else {
      setJobHiringManager(null);
    }
  }, [job, availableFields]);

  // Fetch users for email notification
  useEffect(() => {
    if (showAddNote) {
      fetchUsers();
      fetchActionFields();
    }
  }, [showAddNote]);

  // Fetch action fields: use field500 (field_500/actions/action) when present, else all custom fields
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
        const fields = data.customFields || data.fields || [];
        const fieldNamesToCheck = ['field_500', 'actions', 'action'];
        const field500 = (fields as any[]).find(
          (f: any) =>
            fieldNamesToCheck.includes(f.field_name?.toLowerCase()) ||
            fieldNamesToCheck.includes(f.field_label?.toLowerCase())
        );
        if (field500 && field500.options) {
          let options = field500.options;
          if (typeof options === 'string') {
            try {
              options = JSON.parse(options);
            } catch { }
          }
          if (Array.isArray(options)) {
            setActionFields(
              options.map((opt: any) => ({
                id: opt.value ?? opt,
                field_label: opt.label ?? opt.value ?? opt,
                field_name: opt.value ?? opt,
              }))
            );
          } else if (typeof options === 'object') {
            setActionFields(
              Object.entries(options).map(([key, value]) => ({
                id: key,
                field_label: String(value),
                field_name: key,
              }))
            );
          } else {
            setActionFieldsFromAllFields(fields);
          }
        } else {
          setActionFieldsFromAllFields(fields);
        }
      }
    } catch (err) {
      console.error("Error fetching action fields:", err);
    } finally {
      setIsLoadingActionFields(false);
    }
  };

  const setActionFieldsFromAllFields = (fields: any[]) => {
    const sorted = [...(fields || [])].sort(
      (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
    );
    setActionFields(
      sorted.map((f: any) => ({
        id: f.field_name ?? f.id,
        field_label: f.field_label ?? f.field_name ?? '',
        field_name: f.field_name ?? f.field_label ?? '',
      }))
    );
  };

  // Close About and Email dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        aboutInputRef.current &&
        !aboutInputRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-about-dropdown]')
      ) {
        setShowAboutDropdown(false);
      }
      if (
        emailInputRef.current &&
        !emailInputRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-email-dropdown]')
      ) {
        setShowEmailDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  // Search for references for About field
  const searchAboutReferences = async (query: string) => {
    setIsLoadingAboutSearch(true);
    setShowAboutDropdown(true);

    try {
      const searchTerm = (query || "").trim();
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
      console.log("Job", job)

      // Process jobs
      if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
        const data = await jobsRes.value.json();
        const jobs = searchTerm
          ? (data.jobs || []).filter(
              (job: any) =>
                job.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.id?.toString().includes(searchTerm)
            )
          : (data.jobs || []);

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
        const orgs = searchTerm
          ? (data.organizations || []).filter(
              (org: any) =>
                org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                org.id?.toString().includes(searchTerm)
            )
          : (data.organizations || []);

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
        const seekers = searchTerm
          ? (data.jobSeekers || []).filter(
              (seeker: any) =>
                seeker.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                seeker.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                seeker.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                seeker.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                seeker.id?.toString().includes(searchTerm)
            )
          : (data.jobSeekers || []);
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
        const leads = searchTerm
          ? (data.leads || []).filter(
              (lead: any) =>
                lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.id?.toString().includes(searchTerm)
            )
          : (data.leads || []);
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
        const tasks = searchTerm
          ? (data.tasks || []).filter(
              (task: any) =>
                task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.id?.toString().includes(searchTerm)
            )
          : (data.tasks || []);
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
        const placements = searchTerm
          ? (data.placements || []).filter(
              (placement: any) =>
                placement.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                placement.jobSeekerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                placement.id?.toString().includes(searchTerm)
            )
          : (data.placements || []);
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

      // Process hiring managers
      if (hiringManagersRes.status === "fulfilled" && hiringManagersRes.value.ok) {
        const data = await hiringManagersRes.value.json();
        const hiringManagers = searchTerm
          ? (data.hiringManagers || []).filter(
            (hm: any) => {
              const name =
                hm.full_name ||
                `${hm.first_name || ""} ${hm.last_name || ""}`.trim() ||
                "";
              return (
                name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                hm.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                hm.id?.toString().includes(searchTerm)
              );
            }
          )
          : (data.hiringManagers || []);

        hiringManagers.forEach((hm: any) => {
          const name =
            hm.full_name ||
            `${hm.first_name || ""} ${hm.last_name || ""}`.trim() ||
            "Unnamed";
          suggestions.push({
            id: hm.id,
            type: "Hiring Manager",
            display: `#${hm.id} ${name}`,
            value: `#${hm.id}`,
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

  // Filtered users for email notification dropdown (exclude already selected)
  const emailNotificationSuggestions = useMemo(() => {
    const selected = new Set(noteForm.emailNotification);
    const q = (emailSearchQuery || "").trim().toLowerCase();
    if (!q) return users.filter((u) => !selected.has(u.email || u.name));
    return users.filter((u) => {
      if (selected.has(u.email || u.name)) return false;
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, noteForm.emailNotification, emailSearchQuery]);

  const handleEmailNotificationSelect = (user: any) => {
    const value = user.email || user.name;
    if (!value) return;
    setNoteForm((prev) => {
      if (prev.emailNotification.includes(value)) return prev;
      return { ...prev, emailNotification: [...prev.emailNotification, value] };
    });
    setEmailSearchQuery("");
    setShowEmailDropdown(false);
    if (emailInputRef.current) emailInputRef.current.focus();
  };

  const removeEmailNotification = (value: string) => {
    setNoteForm((prev) => ({
      ...prev,
      emailNotification: prev.emailNotification.filter((v) => v !== value),
    }));
  };

  // Fetch available fields from modify page (custom fields)
  const fetchAvailableFields = async () => {
    setIsLoadingFields(true);
    try {
      const response = await fetch("/api/admin/field-management/jobs");
      if (response.ok) {
        const data = await response.json();
        const fields = data.customFields || [];
        setAvailableFields(fields);
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

  // Job Details field catalog: from admin field definitions + record customFields only (no hardcoded standard)
  const jobDetailsFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    // const seen = new Set(fromApi.map((f) => f.key));
    // const fromJob = Object.keys(job?.customFields || {})
    //   .map((k) => ({ key: k, label: k }));
    return [...fromApi];
  }, [availableFields]);

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

  // Details panel field catalog: from admin field definitions + record customFields only
  const detailsFieldCatalog = useMemo(() => {
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    // const seen = new Set(fromApi.map((f) => f.key));
    // const fromJob = Object.keys(job?.customFields || {})
    //   .filter((k) => !seen.has(k))
    //   .map((k) => ({ key: k, label: k }));
    return [...fromApi];
  }, [availableFields]);

  // When catalog loads, if jobDetails/details/hiringManager visible list is empty, default to all catalog keys
  useEffect(() => {
    const keys = jobDetailsFieldCatalog.map((f) => f.key);
    if (keys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.jobDetails || [];
        if (current.length > 0) return prev;
        return { ...prev, jobDetails: keys };
      });
    }
  }, [jobDetailsFieldCatalog]);

  useEffect(() => {
    const keys = detailsFieldCatalog.map((f) => f.key);
    if (keys.length > 0) {
      setVisibleFields((prev) => {
        const current = prev.details || [];
        if (current.length > 0) return prev;
        return { ...prev, details: keys };
      });
    }
  }, [detailsFieldCatalog]);

  useEffect(() => {
    if (editingPanel !== "details") return;
    const current = visibleFields.details || [];
    const catalogKeys = detailsFieldCatalog.map((f) => f.key);
    const order = [...current.filter((k) => catalogKeys.includes(k))];
    catalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    setModalDetailsOrder(order);
    setModalDetailsVisible(
      catalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.details, detailsFieldCatalog]);

  useEffect(() => {
    if (editingPanel === "hiringManager" && hiringManagerAvailableFields.length === 0) {
      fetchHiringManagerFields();
    }
  }, [editingPanel]);

  useEffect(() => {
    if (editingPanel !== "hiringManager") return;
    const current = visibleFields.hiringManager || [];
    const catalogKeys = hiringManagerFieldCatalog.map((f) => f.key);

    const currentInCatalog = current.filter((k) => catalogKeys.includes(k));
    const rest = catalogKeys.filter((k) => !current.includes(k));
    const order = [...currentInCatalog, ...rest];

    setModalHiringManagerOrder(order);
    setModalHiringManagerVisible(
      catalogKeys.reduce((acc, k) => {
        acc[k] = current.includes(k);
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.hiringManager, hiringManagerFieldCatalog]);

  const buildHeaderFieldCatalog = () => {
    const seen = new Set<string>();
    const fromApi = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => {
        const k = f.field_name || f.field_key || f.field_label || f.id;
        return {
          key: `custom:${String(k)}`,
          label: f.field_label || f.field_name || String(k),
          fieldType: (f.field_type ?? f.fieldType ?? "") as string,
          lookupType: (f.lookup_type ?? f.lookupType ?? "") as string,
          multiSelectLookupType: (f.multi_select_lookup_type ?? f.multiSelectLookupType ?? "") as string,
        };
      })
      .filter((x) => {
        if (seen.has(x.key)) return false;
        seen.add(x.key);
        return true;
      });
    return fromApi;
  };

  const headerFieldCatalog = buildHeaderFieldCatalog();

  // Initialize headerFieldsOrder when headerFields or catalog changes
  useEffect(() => {
    if (headerFieldCatalog.length > 0 && headerFieldsOrder.length === 0) {
      // Initialize order with headerFields, then add remaining catalog fields
      const catalogKeys = headerFieldCatalog.map((f) => f.key);
      const selectedOrder = headerFields.filter((k) => catalogKeys.includes(k));
      const newFields = catalogKeys.filter((k) => !selectedOrder.includes(k));
      setHeaderFieldsOrder([...selectedOrder, ...newFields]);
    }
  }, [headerFieldCatalog.length, headerFields]);

  const getHeaderFieldLabel = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found?.label || key;
  };

  const getHeaderFieldInfo = (key: string) => {
    const found = headerFieldCatalog.find((f) => f.key === key);
    return found as { key: string; label: string; fieldType?: string; lookupType?: string; multiSelectLookupType?: string } | undefined;
  };

  const getHeaderFieldValue = (key: string) => {
    if (!job) return "-";
    const rawKey = key.startsWith("custom:") ? key.replace("custom:", "") : key;
    const j = job as any;
    let v = j[rawKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    if (rawKey === "phone") return String(j?.organization?.phone ?? "(Not provided)");
    if (rawKey === "website") return String(j?.organization?.website ?? "(Not provided)");
    v = j.customFields?.[rawKey];
    if (v !== undefined && v !== null) return String(v);
    const field = headerFieldCatalog.find((f) => f.key === key);
    if (field) v = j.customFields?.[field.label];
    return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : "-";
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
  const handleHeaderFieldsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setHeaderFieldsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    // Also update headerFields order if both are in headerFields
    setHeaderFields((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleJobDetailsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
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

  const handleDetailsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setModalDetailsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleSaveDetailsFields = useCallback(() => {
    const newOrder = modalDetailsOrder.filter((k) => modalDetailsVisible[k]);
    if (typeof window !== "undefined") {
      localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, details: newOrder }));
    setEditingPanel(null);
  }, [modalDetailsOrder, modalDetailsVisible]);

  const handleHiringManagerDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setModalHiringManagerOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleSaveHiringManagerFields = useCallback(() => {
    const newOrder = modalHiringManagerOrder.filter((k) => modalHiringManagerVisible[k] === true);
    if (typeof window !== "undefined") {
      localStorage.setItem(HIRING_MANAGER_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, hiringManager: newOrder }));
    setEditingPanel(null);
  }, [modalHiringManagerOrder, modalHiringManagerVisible]);

  const fetchTasks = async (jobId: string) => {
    setIsLoadingTasks(true);
    setTasksError(null);
    try {
      const response = await fetch(`/api/tasks`, {
        headers: {
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch tasks");
      }
      const tasksData = await response.json();
      const jobTasks = (tasksData.tasks || []).filter((task: any) => {
        if (task.is_completed === true || task.status === "Completed") return false;
        const taskJobId = task.job_id?.toString();
        return taskJobId && taskJobId === jobId.toString();
      });
      setTasks(jobTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasksError(err instanceof Error ? err.message : "An error occurred while fetching tasks");
    } finally {
      setIsLoadingTasks(false);
    }
  };

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
        archived_at: data.job.archived_at
      };
      
      setJob(formattedJob);

      // Now fetch notes, history, documents, and tasks
      fetchNotes(id);
      fetchHistory(id);
      fetchDocuments(id);
      fetchTasks(id);
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
  // afterSave: when 'appointment' or 'task', opens that scheduler after saving the note
  const handleAddNote = async (afterSave?: "appointment" | "task") => {
    if (!jobId) return;

    // Clear previous validation errors
    setValidationErrors({});

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
        scheduleNextAction: "None",
        emailNotification: [],
      });
      setAboutSearchQuery("");
      setEmailSearchQuery("");
      setShowEmailDropdown(false);
      setValidationErrors({});
      fetchNotes(jobId);
      setShowAddNote(false);

      // Refresh history
      fetchHistory(jobId);
      // Open appointment scheduler or task scheduler as requested
      if (afterSave === "appointment") {
        setShowAppointmentModal(true);
      } else if (afterSave === "task") {
        router.push(`/dashboard/tasks/add?relatedEntity=job&relatedEntityId=${jobId}`);
      }
    } catch (err) {
      console.error("Error adding note:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add note. Please try again.");
    }
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
      console.error("Error fetching appointment users:", err);
    } finally {
      setIsLoadingAppointmentUsers(false);
    }
  };

  // Handle appointment submission (from Jobs Add Note flow)
  const handleAppointmentSubmit = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.type) {
      toast.error("Please fill in all required fields (Date, Time, Type)");
      return;
    }

    if (!jobId) {
      toast.error("Job ID is missing");
      return;
    }

    setIsSavingAppointment(true);

    try {
      const token = document.cookie.replace(
        /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );

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
          jobId: jobId,
          job: job?.title || `${formatRecordId(job?.id, "job")} ${job?.title || ""}`.trim(),
          client: job?.organization_name || job?.client || "",
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
          errorMessage = `HTTP ${response.status}: ${response.statusText || "Failed to create appointment"}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Send calendar invites if requested
      if (appointmentForm.sendInvites && appointmentForm.attendees.length > 0) {
        try {
          const [hours, minutes] = appointmentForm.time.split(":");
          const appointmentDate = new Date(appointmentForm.date);
          appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          const endDate = new Date(appointmentDate);
          endDate.setMinutes(endDate.getMinutes() + appointmentForm.duration);

          const calendarEvent: CalendarEvent = {
            subject: `${appointmentForm.type} - ${job?.title || `Job ${jobId}`}`,
            start: {
              dateTime: appointmentDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            body: {
              contentType: "Text",
              content: appointmentForm.description || `Appointment: ${appointmentForm.type}`,
            },
            location: appointmentForm.location ? { displayName: appointmentForm.location } : undefined,
          };

          await sendCalendarInvite(calendarEvent, appointmentForm.attendees);
        } catch (inviteError) {
          console.error("Error sending calendar invites:", inviteError);
          toast.warning("Appointment created, but calendar invites failed to send. Please send manually.");
        }
      }

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
      toast.error(err instanceof Error ? err.message : "Failed to create appointment. Please try again.");
    } finally {
      setIsSavingAppointment(false);
    }
  };

  // Publish / distribute job (LinkedIn, Job Board) — works without credentials; completes when credentials are added
  const handlePublishSubmit = async () => {
    if (!jobId) return;
    const targets: string[] = [];
    if (publishTargets.linkedin) targets.push("linkedin");
    if (publishTargets.job_board) targets.push("job_board");
    if (targets.length === 0) {
      setPublishMessage("Select at least one destination.");
      return;
    }
    setIsPublishing(true);
    setPublishMessage(null);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const res = await fetch(`/api/jobs/${jobId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targets }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPublishMessage(data.message || "Failed to publish.");
        return;
      }
      setPublishMessage(data.message || "Request sent.");
      if (data.success && data.jobBoardStatus != null) setJob((prev: any) => (prev ? { ...prev, jobBoardStatus: data.jobBoardStatus } : prev));
      setTimeout(() => {
        setShowPublishModal(false);
        setPublishMessage(null);
      }, 2500);
    } catch (e) {
      setPublishMessage(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClosePublishModal = () => {
    setShowPublishModal(false);
    setPublishMessage(null);
    setPublishTargets({ linkedin: false, job_board: true });
  };

  // Close Add Note modal handler
  const handleCloseAddNoteModal = () => {
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
    setShowAddNote(false);
    setValidationErrors({});
    setAboutSearchQuery("");
    setEmailSearchQuery("");
    setShowEmailDropdown(false);
    setShowAboutDropdown(false);
    setNoteForm({
      text: "",
      action: "",
      about: job ? `${formatRecordId(job.id, "job")} ${job.title}` : "",
      aboutReferences: defaultAboutRef,
      copyNote: "No",
      replaceGeneralContactComments: false,
      scheduleNextAction: "None",
      emailNotification: [],
    });
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

  // FIXED: Update this to work with Modify tab too - route to correct add page by job type
  const handleEdit = () => {
    if (jobId) {
      const type = String(job?.jobType || "").toLowerCase().replace(/\s+/g, "-");
      const addPath =
        type === "direct-hire" ? "/dashboard/jobs/add/direct-hire" :
        type === "executive-search" ? "/dashboard/jobs/add/executive-search" :
        "/dashboard/jobs/add/contract";
      router.push(`${addPath}?id=${jobId}`);
    }
  };

  const handleClone = () => {
    if (!jobId) return;
    const type = String(job?.jobType || "").toLowerCase().replace(/\s+/g, "-");
    const addPath =
      type === "direct-hire" ? "/dashboard/jobs/add/direct-hire" :
      type === "executive-search" ? "/dashboard/jobs/add/executive-search" :
      "/dashboard/jobs/add/contract";
    router.push(`${addPath}?cloneFrom=${jobId}`);
  };

  const handleActionSelected = (action: string) => {
    console.log(`Action selected: ${action}`);
    if (action === "edit") {
      handleEdit();
    } else if (action === "clone") {
      handleClone();
    } else if (action === "delete" && jobId) {
      checkPendingDeleteRequest();
      setShowDeleteModal(true);
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
      // setActiveTab("notes");
    } else if (action === "add-tearsheet") {
      setShowAddTearsheetModal(true);
    } else if (action === "publish") {
      setShowPublishModal(true);
      setPublishMessage(null);
      setPublishTargets({ linkedin: false, job_board: true });
    } else if (action === "add-client-submission") {  
      // setShowAddClientSubmissionModal(true);
      toast.info("Coming soon");
      return;
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
      toast.error(
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
        toast.warning("Placement created, but missing placement id in response.");
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
      toast.error(err instanceof Error ? err.message : "Failed to create placement.");
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

  // Handle job deletion (kept for backward compatibility, but now shows modal)
  const handleDelete = async (id: string) => {
    checkPendingDeleteRequest();
    setShowDeleteModal(true);
  };

  // Check for pending delete request
  const checkPendingDeleteRequest = async () => {
    if (!jobId) return;

    setIsLoadingDeleteRequest(true);
    try {
      const response = await fetch(
        `/api/jobs/${jobId}/delete-request?record_type=job`,
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
        setPendingDeleteRequest(data.deleteRequest || null);
      } else {
        setPendingDeleteRequest(null);
      }
    } catch (error) {
      console.error("Error checking delete request:", error);
      setPendingDeleteRequest(null);
    } finally {
      setIsLoadingDeleteRequest(false);
    }
  };

  // Handle delete request submission
  const handleDeleteRequestSubmit = async () => {
    if (!deleteForm.reason.trim()) {
      toast.error("Please enter a reason for deletion");
      return;
    }

    if (!jobId) {
      toast.error("Job ID is missing");
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
        } catch (e) {
          console.error("Error parsing user cookie:", e);
        }
      }

      // Step 1: Add "Delete requested" note to job
      const noteResponse = await fetch(`/api/jobs/${jobId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )}`,
        },
        body: JSON.stringify({
          text: `Delete requested by ${currentUser?.name || "Unknown User"} – Pending payroll approval`,
          action: "Delete Request",
        }),
      });

      if (!noteResponse.ok) {
        console.error("Failed to add delete note");
      }

      // Step 2: Create delete request
      const deleteRequestResponse = await fetch(
        `/api/jobs/${jobId}/delete-request`,
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
            record_type: "job",
            record_number: formatRecordId(job?.id, "job"),
            requested_by: currentUser?.id || currentUser?.name || "Unknown",
            requested_by_email: currentUser?.email || "",
          }),
        }
      );

      if (!deleteRequestResponse.ok) {
        const errorData = await deleteRequestResponse
          .json()
          .catch(() => ({ message: "Failed to create delete request" }));
        throw new Error(
          errorData.message || "Failed to create delete request"
        );
      }

      const deleteRequestData = await deleteRequestResponse.json();

      toast.success(
        "Delete request submitted successfully. Payroll will be notified via email."
      );

      // Refresh notes and delete request status
      if (jobId) {
        fetchNotes(jobId);
        checkPendingDeleteRequest();
      }

      setShowDeleteModal(false);
      setDeleteForm({ reason: "" });
    } catch (err) {
      console.error("Error submitting delete request:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to submit delete request. Please try again."
      );
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handleUnarchiveSubmit = async () => {
    if (!unarchiveReason.trim() || !jobId) {
      toast.error("Please enter a reason for unarchiving.");
      return;
    }
    setIsSubmittingUnarchive(true);
    try {
      const userCookie = document.cookie.replace(
        /(?:(?:^|.*;\s*)user\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      );
      let currentUser: { name?: string; email?: string } = {};
      if (userCookie) {
        try {
          currentUser = JSON.parse(decodeURIComponent(userCookie));
        } catch (e) {
          console.error("Error parsing user cookie:", e);
        }
      }
      const recordDisplay = job
        ? `${formatRecordId(job.id, "job")} ${job.title || ""}`.trim()
        : formatRecordId(jobId, "job");
      const res = await fetch(`/api/jobs/${jobId}/unarchive-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: unarchiveReason.trim(),
          record_number: recordDisplay,
          requested_by: currentUser?.name || "Unknown",
          requested_by_email: currentUser?.email || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send unarchive request");
      toast.success("Unarchive request sent. Payroll will be notified via email.");
      setShowUnarchiveModal(false);
      setUnarchiveReason("");
    } catch (err) {
      console.error("Error submitting unarchive request:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to send unarchive request. Please try again."
      );
    } finally {
      setIsSubmittingUnarchive(false);
    }
  };

  // Check for pending delete request on mount
  useEffect(() => {
    if (jobId) {
      checkPendingDeleteRequest();
    }
  }, [jobId]);

  const isArchived = !!job?.archived_at;

  const actionOptions = isArchived
    ? [{ label: "Unarchive", action: () => setShowUnarchiveModal(true) }]
    : [
        { label: "Add Note", action: () => handleActionSelected("add-note") },
        { label: "Add Task", action: () => handleActionSelected("add-task") },
        { label: "Add Placement", action: () => handleActionSelected("add-placement") },
        { label: "Add Tearsheet", action: () => handleActionSelected("add-tearsheet") },
        { label: "Publish to Job Board", action: () => handleActionSelected("publish") },
        { label: "Add Client Submission", action: () => handleActionSelected("add-client-submission") },
        { label: "Clone", action: () => handleActionSelected("clone") },
        { label: "Delete", action: () => handleActionSelected("delete") },
      ];

  // Tabs from the image
  const tabs = [
    { id: "summary", label: "Summary" },
    // { id: "applied", label: "Applied" },
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
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Add Note
        </button>
      </div>

      {/* Filters & Sort Controls (match Organization Notes) */}
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
          <select
            value={noteActionFilter}
            onChange={(e) => setNoteActionFilter(e.target.value)}
            className="p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All Actions</option>
            {actionFields.map((f) => (
              <option key={f.id || f.field_name} value={f.field_label || f.field_name}>
                {f.field_label || f.field_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Author</label>
          <select
            value={noteAuthorFilter}
            onChange={(e) => setNoteAuthorFilter(e.target.value)}
            className="p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All Authors</option>
            {authors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
          <select
            value={noteSortKey}
            onChange={(e) => setNoteSortKey(e.target.value as any)}
            className="p-2 border border-gray-300 rounded text-sm"
          >
            <option value="date">Date</option>
            <option value="action">Action</option>
            <option value="author">Author</option>
          </select>
        </div>
        <div>
          <button
            onClick={() => setNoteSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs text-black"
            title="Toggle Sort Direction"
          >
            {noteSortDir === "asc" ? "Asc ↑" : "Desc ↓"}
          </button>
        </div>
        {(noteActionFilter || noteAuthorFilter) && (
          <button
            onClick={() => { setNoteActionFilter(""); setNoteAuthorFilter(""); }}
            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-xs"
          >
            Clear Filters
          </button>
        )}
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
            )?.field_label || note.action || "General Note";
            const aboutRefs = parseAboutReferences(note.about || note.about_references);

            return (
              <div id={`note-${note.id}`} key={note.id} className="p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
                <div className="border-b border-gray-200 pb-3 mb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-blue-600">
                          {note.created_by_name || "Unknown User"}
                        </span>
                        {actionLabel && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                            {actionLabel}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded border">
                          Job
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(note.created_at).toLocaleString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const el = document.getElementById(`note-${note.id}`);
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.classList.add("ring-2", "ring-blue-500");
                            setTimeout(() => el.classList.remove("ring-2", "ring-blue-500"), 2000);
                          }
                        }}
                        className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="View"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
                {aboutRefs.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide min-w-[80px]">
                        References:
                      </span>
                      <div className="flex flex-wrap gap-2 flex-1">
                        {aboutRefs.map((ref: any, idx: number) => {
                          const displayText = typeof ref === "string" ? ref : ref.display || ref.value || `${ref.type} #${ref.id}`;
                          const refType = typeof ref === "string" ? null : (ref.type || "").toLowerCase().replace(/\s+/g, "");
                          const refId = typeof ref === "string" ? null : ref.id;
                          const isClickable = !!(refId && refType);
                          return (
                            <button
                              key={`${ref.type}-${ref.id}-${idx}`}
                              onClick={() => isClickable && navigateToReference(ref)}
                              disabled={!isClickable}
                              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition-all ${isClickable ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer" : "bg-gray-100 text-gray-700 border-gray-200 cursor-default"}`}
                              title={isClickable ? `View ${refType}` : "Reference not available"}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              {displayText}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {note.additional_references && !note.about && !aboutRefs.length && (
                  <div className="mb-3 pb-3 border-b border-gray-100 text-xs text-gray-600">
                    References: {note.additional_references}
                  </div>
                )}
                <div className="mt-2">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 italic">
          {(noteActionFilter || noteAuthorFilter) ? "No notes match your filters." : "No notes have been added yet."}
        </p>
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
        <>
          <HistoryTabFilters
            sortOrder={historyFilters.sortOrder}
            onSortOrderChange={historyFilters.setSortOrder}
            userFilter={historyFilters.userFilter}
            onUserFilterChange={historyFilters.setUserFilter}
            uniqueUsers={historyFilters.uniqueUsers}
            disabled={isLoadingHistory}
          />
          <div className="space-y-4">
            {historyFilters.filteredAndSorted.map((item) => {
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
                    detailsDisplay = `Created by ${
                      item.performed_by_name || "Unknown"
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

                        if (
                          JSON.stringify(beforeVal) !== JSON.stringify(afterVal)
                        ) {
                          // Special handling for custom_fields
                          if (key === "custom_fields") {
                            let beforeObj =
                              typeof beforeVal === "string"
                                ? JSON.parse(beforeVal)
                                : beforeVal;
                            let afterObj =
                              typeof afterVal === "string"
                                ? JSON.parse(afterVal)
                                : afterVal;

                            // Handle case where custom_fields might be null/undefined
                            beforeObj = beforeObj || {};
                            afterObj = afterObj || {};

                            if (
                              typeof beforeObj === "object" &&
                              typeof afterObj === "object"
                            ) {
                              const allKeys = Array.from(
                                new Set([
                                  ...Object.keys(beforeObj),
                                  ...Object.keys(afterObj),
                                ])
                              );

                              allKeys.forEach((cfKey) => {
                                const beforeCfVal = beforeObj[cfKey];
                                const afterCfVal = afterObj[cfKey];

                                if (beforeCfVal !== afterCfVal) {
                                  changes.push(
                                    <div
                                      key={`cf-${cfKey}`}
                                      className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-sm"
                                    >
                                      <span className="font-semibold text-gray-700 min-w-[120px]">
                                        {cfKey}:
                                      </span>
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
                        }
                      }

                      if (changes.length > 0) {
                        detailsDisplay = (
                          <div className="flex flex-col gap-2 mt-2 bg-gray-50 p-2 rounded border border-gray-100">
                            {changes}
                          </div>
                        );
                      } else {
                        detailsDisplay = (
                          <span className="text-gray-500 italic">
                            No visible changes detected
                          </span>
                        );
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
        </>
      ) : (
        <p className="text-gray-500 italic">No history records available</p>
      )}
    </div>
  );

  // Applied tab content – currently backed by static XML-style applications
  const renderAppliedTab = () => {
    return (
      <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-gray-800">Applied</h2>
            <span className="text-sm text-gray-500">
              ({STATIC_XML_APPLICATIONS.length})
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Last Activity{" "}
            {STATIC_XML_APPLICATIONS.length > 0
              ? new Date(
                  STATIC_XML_APPLICATIONS.reduce((latest, app) => {
                    const t = new Date(app.dateApplied).getTime();
                    return t > latest ? t : latest;
                  }, 0)
                ).toLocaleDateString()
              : "—"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold uppercase text-gray-500">
                <th className="px-3 py-2 text-left w-10">
                  <input type="checkbox" className="w-4 h-4" disabled />
                </th>
                <th className="px-3 py-2 text-left">Candidate</th>
                <th className="px-3 py-2 text-left">Date Applied</th>
                <th className="px-3 py-2 text-left">Date Last Modified</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Added By</th>
              </tr>
            </thead>
            <tbody>
              {STATIC_XML_APPLICATIONS.map((app) => {
                const appliedDate = new Date(app.dateApplied);
                const formattedDate = `${appliedDate.toLocaleDateString()} ${appliedDate.toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" }
                )}`;
                return (
                  <tr
                    key={app.id}
                    className="border-t border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">
                      <input type="checkbox" className="w-4 h-4" />
                    </td>
                    <td className="px-3 py-2 text-blue-600 font-medium cursor-pointer">
                      {app.candidateName}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formattedDate}</td>
                    <td className="px-3 py-2 text-gray-700">{formattedDate}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">
                        {app.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{app.addedBy}</td>
                  </tr>
                );
              })}
              {STATIC_XML_APPLICATIONS.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-gray-500"
                  >
                    No applications have been received yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // FIXED: Modified the Modify tab to directly use handleEdit
  const renderModifyTab = () => (
    <div className="bg-white p-4 rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Edit Job</h2>
      <p className="text-gray-600 mb-4">
        {isArchived
          ? "Archived records cannot be edited."
          : "Click the button below to edit this job's details."}
      </p>
      <button
        onClick={handleEdit}
        disabled={isArchived}
        className={`px-4 py-2 rounded ${isArchived ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
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
            <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] flex flex-col">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center shrink-0">
                <h2 className="text-lg font-semibold">{selectedDocument.document_name}</h2>
                <button onClick={() => setSelectedDocument(null)} className="p-1 rounded hover:bg-gray-200">
                  <span className="text-2xl font-bold">×</span>
                </button>
              </div>
              <div className="p-4 flex-1 min-h-0 flex flex-col">
                <div className="mb-2">
                  <p className="text-sm text-gray-600">
                    Created by {selectedDocument.created_by_name || "System"} on{" "}
                    {new Date(selectedDocument.created_at).toLocaleString()}
                  </p>
                </div>
                {selectedDocument.file_path ? (
                  <div className="overflow-y-auto flex-1 min-h-[60vh] flex flex-col">
                    <DocumentViewer
                      filePath={selectedDocument.file_path}
                      mimeType={selectedDocument.mime_type}
                      documentName={selectedDocument.document_name}
                      className="flex-1"
                      onOpenInNewTab={() =>
                        window.open(selectedDocument.file_path, "_blank")
                      }
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded border whitespace-pre-wrap overflow-y-auto">
                    {selectedDocument.content || "No content available"}
                  </div>
                )}
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
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
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
      <div className="bg-white p-6 rounded-lg mt-10 shadow-md">
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
            <FiBriefcase size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-700">
            {formatRecordId(job.id, "job")} {job.title}
          </h1>
          {job.archived_at && (
            <div className="ml-3">
              <CountdownTimer archivedAt={job.archived_at} />
            </div>
          )}
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

            {headerFields.length === 0 ? (
              <span className="text-sm text-gray-500">
                No header fields selected
              </span>
            ) : (
              headerFields.map((fk) => {
                const info = getHeaderFieldInfo(fk);
                return (
                  <div key={fk} className="min-w-[140px]">
                    <div className="text-xs text-gray-500">
                      {getHeaderFieldLabel(fk)}
                    </div>
                    <FieldValueRenderer
                      value={getHeaderFieldValue(fk)}
                      fieldInfo={info ? { key: info.key, label: info.label, fieldType: info.fieldType, lookupType: info.lookupType, multiSelectLookupType: info.multiSelectLookupType } : { key: fk, label: getHeaderFieldLabel(fk) }}
                      emptyPlaceholder="-"
                      clickable
                    />
                  </div>
                );
              })
            )}
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
        {tabs.map((tab) => {
          const isModifyTab = tab.id === "modify";
          const tabDisabled = isModifyTab && isArchived;
          return (
            <button
              key={tab.id}
              className={`px-4 py-2 ${activeTab === tab.id
                ? "bg-gray-200 rounded-t border-t border-r border-l border-gray-400 font-medium"
                : "text-gray-700 hover:bg-gray-200"
                } ${tabDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={tabDisabled}
              onClick={() => {
                if (tabDisabled) return;
                if (isModifyTab) {
                  handleEdit();
                } else {
                  setActiveTab(tab.id);
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
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
              onClick={() => action.id === "applied" ? setActiveTab("applied") : setActiveQuickTab(action.id)}
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
                    <div className="grid grid-cols-[1fr_1fr] gap-4">
                      <div className="min-w-0">
                        <DroppableContainer id="left" items={columns.left}>
                          {columns.left.map((id) => renderPanel(id))}
                        </DroppableContainer>
                      </div>
                      <div className="min-w-0">
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

          {/* Applied Tab */}
          {activeTab === "applied" && (
            <div className="col-span-7">{renderAppliedTab()}</div>
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

      {/* Edit Fields Modal - jobDetails/details/hiringManager use SortableFieldsEditModal */}
      {editingPanel === "jobDetails" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Job Details"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all job records."
          order={modalJobDetailsOrder}
          visible={modalJobDetailsVisible}
          fieldCatalog={jobDetailsFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={(key) => setModalJobDetailsVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
          onDragEnd={handleJobDetailsDragEnd}
          onSave={handleSaveJobDetailsFields}
          saveButtonText="Save"
          isSaveDisabled={modalJobDetailsOrder.filter((k) => modalJobDetailsVisible[k]).length === 0}
        />
      )}
      {editingPanel === "details" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Details"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all job records."
          order={modalDetailsOrder}
          visible={modalDetailsVisible}
          fieldCatalog={detailsFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={(key) => setModalDetailsVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
          onDragEnd={handleDetailsDragEnd}
          onSave={handleSaveDetailsFields}
          saveButtonText="Save"
          isSaveDisabled={modalDetailsOrder.filter((k) => modalDetailsVisible[k]).length === 0}
        />
      )}
      {editingPanel === "hiringManager" && (
        <SortableFieldsEditModal
          open={true}
          onClose={handleCloseEditModal}
          title="Edit Fields - Hiring Manager"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all job records."
          order={modalHiringManagerOrder}
          visible={modalHiringManagerVisible}
          fieldCatalog={hiringManagerFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={(key) => setModalHiringManagerVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
          onDragEnd={handleHiringManagerDragEnd}
          onSave={handleSaveHiringManagerFields}
          isLoading={isLoadingHiringManagerFields}
          saveButtonText="Save"
          isSaveDisabled={modalHiringManagerOrder.filter((k) => modalHiringManagerVisible[k]).length === 0}
        />
      )}
      {editingPanel && editingPanel !== "jobDetails" && editingPanel !== "details" && editingPanel !== "hiringManager" && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
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
                            { key: "address", label: "Address" },
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
                    <span className="w-4 h-4 bg-green-500 rounded-full mr-2 shrink-0"></span>
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
                    <span className="w-4 h-4 bg-green-500 rounded-full mr-2 shrink-0"></span>
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
                    <span className="w-4 h-4 bg-green-500 rounded-full mr-2 shrink-0"></span>
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

      <AddTearsheetModal
        open={showAddTearsheetModal}
        onClose={() => setShowAddTearsheetModal(false)}
        entityType="job"
        entityId={jobId || ""}
      />

      {/* Add Note Modal */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                    onChange={(e) => {
                      setNoteForm((prev) => ({ ...prev, text: e.target.value }));
                      // Clear error when user starts typing
                      if (validationErrors.text) {
                        setValidationErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.text;
                          return newErrors;
                        });
                      }
                    }}
                    autoFocus
                    placeholder="Enter your note text here. Reference people and distribution lists using @ (e.g. @John Smith). Reference other records using # (e.g. #Project Manager)."
                    className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${validationErrors.text
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                      }`}
                    rows={6}
                  />
                  {validationErrors.text && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.text}</p>
                  )}
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
                  <div className="relative" ref={aboutInputRef}>
                    <div
                      className={`min-h-[42px] flex flex-wrap items-center gap-2 p-2 border rounded focus-within:ring-2 focus-within:outline-none pr-8 ${
                        validationErrors.about
                          ? "border-red-500 focus-within:ring-red-500"
                          : "border-gray-300 focus-within:ring-blue-500"
                      }`}
                    >
                      {/* Selected References Tags - Inside the input container */}
                      {noteForm.aboutReferences.map((ref, index) => (
                        <span
                          key={`${ref.type}-${ref.id}-${index}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-sm"
                        >
                          <HiOutlineOfficeBuilding className="w-4 h-4" />
                          {ref.display}
                          <button
                            type="button"
                            onClick={() => removeAboutReference(index)}
                            className="hover:text-blue-600 font-bold leading-none"
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      {/* Search Input for References - Same field to add more */}
                      <input
                        type="text"
                        value={aboutSearchQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAboutSearchQuery(value);
                          searchAboutReferences(value);
                          setShowAboutDropdown(true);
                        }}
                        onFocus={() => {
                          setShowAboutDropdown(true);
                          if (!aboutSearchQuery.trim()) {
                            searchAboutReferences("");
                          }
                        }}
                        placeholder={
                          noteForm.aboutReferences.length === 0
                            ? "Search and select records (e.g., Job, Lead, Placement)..."
                            : "Add more..."
                        }
                        className="flex-1 min-w-[120px] border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                        <FiSearch className="w-4 h-4" />
                      </span>
                    </div>

                    {/* Validation Error */}
                    {validationErrors.about && (
                      <p className="mt-1 text-sm text-red-500">
                        {validationErrors.about}
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
                              <HiOutlineOfficeBuilding className="w-4 h-4 text-gray-500 shrink-0" />
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
                        ) : aboutSearchQuery.trim().length > 0 ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No results found
                          </div>
                        ) : (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            Type to search or select from list
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Notification Section - Search and add (matches About/Reference design) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Notification
                  </label>
                  <div className="relative" ref={emailInputRef}>
                    {isLoadingUsers ? (
                      <div className="w-full p-2 border border-gray-300 rounded text-gray-500 bg-gray-50 min-h-[42px]">
                        Loading users...
                      </div>
                    ) : (
                      <div className="min-h-[42px] flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded focus-within:ring-2 focus-within:outline-none focus-within:ring-blue-500 pr-8">
                        {/* Selected Users Tags - Inside the input container */}
                        {noteForm.emailNotification.map((val, index) => (
                          <span
                            key={val}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-sm"
                          >
                            <HiOutlineUser className="w-4 h-4 shrink-0" />
                            {val}
                            <button
                              type="button"
                              onClick={() => removeEmailNotification(val)}
                              className="hover:text-blue-600 font-bold leading-none"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        {/* Search Input for Users - Same field to add more */}
                        <input
                          type="text"
                          value={emailSearchQuery}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEmailSearchQuery(value);
                            setShowEmailDropdown(true);
                          }}
                          onFocus={() => setShowEmailDropdown(true)}
                          placeholder={
                            noteForm.emailNotification.length === 0
                              ? "Search and add users to notify..."
                              : "Add more..."
                          }
                          className="flex-1 min-w-[120px] border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                          <FiSearch className="w-4 h-4" />
                        </span>
                      </div>
                    )}
                    {showEmailDropdown && !isLoadingUsers && (
                      <div
                        data-email-dropdown
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                      >
                        {emailNotificationSuggestions.length > 0 ? (
                          emailNotificationSuggestions.slice(0, 10).map((user, idx) => (
                            <button
                              key={user.id ?? idx}
                              type="button"
                              onClick={() => handleEmailNotificationSelect(user)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                            >
                              <HiOutlineUser className="w-4 h-4 text-gray-500 shrink-0" />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {user.name || user.email}
                                </div>
                                {user.email && user.name && (
                                  <div className="text-xs text-gray-500">{user.email}</div>
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            {emailSearchQuery.trim().length >= 1
                              ? "No matching users found"
                              : "Type to search internal users"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex flex-wrap justify-end gap-2 mt-6 pt-4 border-t">
                <button
                  onClick={handleCloseAddNoteModal}
                  className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 font-medium"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => handleAddNote()}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!noteForm.text.trim() || !noteForm.action || noteForm.aboutReferences.length === 0}
                  title="Save Note"
                >
                  SAVE
                </button>
                {/* <button
                  onClick={() => handleAddNote("appointment")}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!noteForm.text.trim() || !noteForm.action || noteForm.aboutReferences.length === 0}
                  title="Save Note and open Appointment Scheduler"
                >
                  SAVE & Schedule Appointment
                </button>
                <button
                  onClick={() => handleAddNote("task")}
                  className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!noteForm.text.trim() || !noteForm.action || noteForm.aboutReferences.length === 0}
                  title="Save Note and open Task Scheduler"
                >
                  SAVE & Add Task
                </button> */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Appointment Modal (opens after SAVE & Schedule Appointment from Add Note) */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={appointmentForm.duration}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({
                      ...prev,
                      duration: parseInt(e.target.value) || 30,
                    }))
                  }
                  min={15}
                  step={15}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
                  <option value="zoom">Zoom Meeting</option>
                  <option value="Interview">Interview</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Assessment">Assessment</option>
                  <option value="Other">Other</option>
                </select>
              </div>
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
                        <div className="text-gray-500 text-sm p-2">No users available</div>
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
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="send-invites-job"
                  checked={appointmentForm.sendInvites}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({ ...prev, sendInvites: e.target.checked }))
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="send-invites-job" className="text-sm text-gray-700">
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
                disabled={isSavingAppointment}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:opacity-50"
              >
                {isSavingAppointment ? "Saving…" : "Save Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Distribute job modal (LinkedIn, Job Board) — works without credentials; completes when credentials are added */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Distribute job</h2>
              <button
                onClick={handleClosePublishModal}
                className="p-1 rounded hover:bg-gray-200"
                type="button"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Choose where to post this job. When credentials are added in Settings, posting will be enabled and the same action will complete distribution.
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishTargets.linkedin}
                    onChange={(e) => setPublishTargets((p) => ({ ...p, linkedin: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">LinkedIn</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishTargets.job_board}
                    onChange={(e) => setPublishTargets((p) => ({ ...p, job_board: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">Job Board(s)</span>
                </label>
              </div>
              {publishMessage && (
                <p className="mt-4 text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                  {publishMessage}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={handleClosePublishModal}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 font-medium"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishSubmit}
                disabled={isPublishing || (!publishTargets.linkedin && !publishTargets.job_board)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                type="button"
              >
                {isPublishing ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmFileDetailsModal
        isOpen={showFileDetailsModal && pendingFiles.length > 0}
        onClose={() => { setShowFileDetailsModal(false); setPendingFiles([]); }}
        onConfirm={() => handleConfirmFileDetails()}
        fileName={fileDetailsName}
        fileType={fileDetailsType}
        onFileNameChange={setFileDetailsName}
        onFileTypeChange={setFileDetailsType}
        pendingFiles={pendingFiles}
        documentTypeOptions={[
          { value: "General", label: "General" },
          { value: "Contract", label: "Contract" },
          { value: "Agreement", label: "Agreement" },
          { value: "Policy", label: "Policy" },
          { value: "Welcome", label: "Welcome" },
        ]}
        confirmButtonText="Upload"
        zIndex={100}
      />

      {showHeaderFieldModal && (
        <SortableFieldsEditModal
          open={true}
          onClose={() => setShowHeaderFieldModal(false)}
          title="Customize Header Fields"
          description="Drag to reorder. Toggle visibility with the checkbox. Changes apply to all job records."
          order={headerFieldsOrder.length > 0 ? headerFieldsOrder : headerFieldCatalog.map((f) => f.key)}
          visible={Object.fromEntries(headerFieldCatalog.map((f) => [f.key, headerFields.includes(f.key)]))}
          fieldCatalog={headerFieldCatalog.map((f) => ({ key: f.key, label: f.label }))}
          onToggle={(key) => {
            if (headerFields.includes(key)) {
              setHeaderFields((prev) => prev.filter((x) => x !== key));
            } else {
              setHeaderFields((prev) => [...prev, key]);
              if (!headerFieldsOrder.includes(key)) {
                setHeaderFieldsOrder((prev) => [...prev, key]);
              }
            }
          }}
          onDragEnd={handleHeaderFieldsDragEnd}
          onSave={async () => {
            const success = await saveHeaderConfig();
            if (success) setShowHeaderFieldModal(false);
          }}
          saveButtonText="Done"
          isSaveDisabled={headerFields.length === 0}
          onReset={() => {
            setHeaderFields(DEFAULT_HEADER_FIELDS);
            setHeaderFieldsOrder(DEFAULT_HEADER_FIELDS);
          }}
          resetButtonText="Reset"
        />
      )}

      {/* Unarchive Request Modal */}
      <RequestActionModal
        open={showUnarchiveModal}
        onClose={() => {
          setShowUnarchiveModal(false);
          setUnarchiveReason("");
        }}
        modelType="unarchive"
        entityLabel="Job"
        recordDisplay={
          job ? `${formatRecordId(job.id, "job")} ${job.title || ""}`.trim() : "N/A"
        }
        reason={unarchiveReason}
        onReasonChange={setUnarchiveReason}
        onSubmit={handleUnarchiveSubmit}
        isSubmitting={isSubmittingUnarchive}
      />

      {/* Delete Request Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
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
              {/* Job Info */}
              <div className="bg-gray-50 p-4 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job to Delete
                </label>
                <p className="text-sm text-gray-900 font-medium">
                  {job
                    ? `${formatRecordId(job.id, "job")} ${job.job_title || "N/A"}`
                    : "N/A"}
                </p>
              </div>

              {/* Pending Request Warning */}
              {pendingDeleteRequest && pendingDeleteRequest.status === "pending" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Pending Request:</strong> A delete request is already pending payroll approval.
                  </p>
                </div>
              )}

              {/* Denied Request Info */}
              {pendingDeleteRequest && pendingDeleteRequest.status === "denied" && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-sm text-red-800">
                    <strong>Previous Request Denied:</strong> {pendingDeleteRequest.denial_reason || "No reason provided"}
                  </p>
                </div>
              )}

              {/* Reason Field - Required */}
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
                  placeholder="Please provide a detailed reason for deleting this job..."
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
                disabled={
                  isSubmittingDelete ||
                  !deleteForm.reason.trim() ||
                  (pendingDeleteRequest && pendingDeleteRequest.status === "pending")
                }
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}