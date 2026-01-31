"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import Image from "next/image";
import ActionDropdown from "@/components/ActionDropdown";
import PanelWithHeader from "@/components/PanelWithHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { FiTarget } from "react-icons/fi";
import { BsFillPinAngleFill } from "react-icons/bs";
import { useHeaderConfig } from "@/hooks/useHeaderConfig";
// Drag and drop imports
import DocumentViewer from "@/components/DocumentViewer";
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

// Sortable row for Lead Contact Info edit modal (vertical drag + checkbox + label)
function SortableContactInfoFieldRow({
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

// Sortable row for Lead Details edit modal (vertical drag + checkbox + label)
function SortableDetailsFieldRow({
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

import {
  buildPinnedKey,
  isPinnedRecord,
  PINNED_RECORDS_CHANGED_EVENT,
  togglePinnedRecord,
} from "@/lib/pinnedRecords";

// Default header fields for Leads module - defined outside component to ensure stable reference
const LEAD_DEFAULT_HEADER_FIELDS = ["phone", "email"];

// Constants for Lead Contact Info and Details persistence
const LEAD_CONTACT_INFO_DEFAULT_FIELDS = ['fullName', 'nickname', 'title', 'organizationName', 'department', 'phone', 'mobilePhone', 'email', 'email2', 'fullAddress', 'linkedinUrl'];
const LEAD_CONTACT_INFO_STORAGE_KEY = "leadsContactInfoFields";
const LEAD_DETAILS_DEFAULT_FIELDS = ['status', 'owner', 'reportsTo', 'dateAdded', 'lastContactDate'];
const LEAD_DETAILS_STORAGE_KEY = "leadsDetailsFields";

const WEBSITE_JOBS_DEFAULT_FIELDS = ['jobs'];
const WEBSITE_JOBS_STORAGE_KEY = "leadsWebsiteJobsFields";
const OUR_JOBS_DEFAULT_FIELDS = ['jobs'];
const OUR_JOBS_STORAGE_KEY = "leadsOurJobsFields";

export default function LeadView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("id");

  const [lead, setLead] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pinned record (bookmarks bar) state
  const [isRecordPinned, setIsRecordPinned] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileDetailsName, setFileDetailsName] = useState("");
  const [fileDetailsType, setFileDetailsType] = useState("General");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const [editDocumentName, setEditDocumentName] = useState("");
  const [editDocumentType, setEditDocumentType] = useState("General");
  const [isDragging, setIsDragging] = useState(false);

  // Tearsheet modal state
  const [showAddTearsheetModal, setShowAddTearsheetModal] = useState(false);
  const [tearsheetForm, setTearsheetForm] = useState({
    name: '',
    visibility: 'Existing' // 'New' or 'Existing'
  });
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);

  // Current active tab
  const [activeTab, setActiveTab] = useState("summary");

  const handleTogglePinnedRecord = () => {
    if (!lead) return;
    const key = buildPinnedKey("lead", lead.id);
    const label = lead.fullName || String(lead.id);
    const url = `/dashboard/leads/view?id=${lead.id}`;

    const res = togglePinnedRecord({ key, label, url });
    if (res.action === "limit") {
      window.alert("Maximum 10 pinned records reached");
    }
  };

  useEffect(() => {
    const syncPinned = () => {
      if (!lead) return;
      const key = buildPinnedKey("lead", lead.id);
      setIsRecordPinned(isPinnedRecord(key));
    };

    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, [lead]);

  // Field management state
  const [availableFields, setAvailableFields] = useState<any[]>([]);

  // Drag and drop state
  const [columns, setColumns] = useState<{
    left: string[];
    right: string[];
  }>({
    left: ["contactInfo", "details"],
    right: ["recentNotes", "websiteJobs", "ourJobs"],
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
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
      const saved = localStorage.getItem("leadsSummaryColumns");
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

  // Initialize Lead Contact Info field order/visibility from localStorage (persists across all lead records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(LEAD_CONTACT_INFO_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Remove duplicates before setting
        const unique = Array.from(new Set(parsed));
        setVisibleFields((prev) => ({ ...prev, contactInfo: unique }));
      }
    } catch (_) {
      /* keep default */
    }
  }, []);

  // Initialize Lead Details field order/visibility from localStorage (persists across all lead records)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(LEAD_DETAILS_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Remove duplicates before setting
        const unique = Array.from(new Set(parsed));
        setVisibleFields((prev) => ({ ...prev, details: unique }));
      }
    } catch (_) {
      /* keep default */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedW = localStorage.getItem(WEBSITE_JOBS_STORAGE_KEY);
    if (savedW) {
      try {
        const parsed = JSON.parse(savedW);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleFields((prev) => ({ ...prev, websiteJobs: parsed }));
        }
      } catch (_) {}
    }
    const savedO = localStorage.getItem(OUR_JOBS_STORAGE_KEY);
    if (savedO) {
      try {
        const parsed = JSON.parse(savedO);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleFields((prev) => ({ ...prev, ourJobs: parsed }));
        }
      } catch (_) {}
    }
  }, []);

  const prevColumnsRef = useRef<string>("");

  // Save columns to localStorage
  useEffect(() => {
    const colsString = JSON.stringify(columns);
    if (prevColumnsRef.current !== colsString) {
      localStorage.setItem("leadsSummaryColumns", colsString);
      prevColumnsRef.current = colsString;
    }
  }, [columns]);

  const findContainer = (id: string) => {
    if (id === "left" || id === "right") {
      return id;
    }

    if (columns.left.includes(id)) return "left";
    if (columns.right.includes(id)) return "right";

    return undefined;
  };

  const handlePanelDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handlePanelDragCancel = () => {
    setActiveId(null);
  };

  const handlePanelDragOver = (_event: DragOverEvent) => {
    return;
  };

  const handlePanelDragEnd = (event: DragEndEvent) => {
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
  };
  const [visibleFields, setVisibleFields] = useState<Record<string, string[]>>({
    contactInfo: Array.from(new Set(LEAD_CONTACT_INFO_DEFAULT_FIELDS)),
    details: Array.from(new Set(LEAD_DETAILS_DEFAULT_FIELDS)),
    recentNotes: ['notes'],
    websiteJobs: ['jobs'],
    ourJobs: ['jobs']
  });
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  // Lead Contact Info edit modal: order and visibility (synced when modal opens)
  const [modalContactInfoOrder, setModalContactInfoOrder] = useState<string[]>([]);
  const [modalContactInfoVisible, setModalContactInfoVisible] = useState<Record<string, boolean>>({});
  const [contactInfoDragActiveId, setContactInfoDragActiveId] = useState<string | null>(null);
  // Lead Details edit modal: order and visibility (synced when modal opens)
  const [modalDetailsOrder, setModalDetailsOrder] = useState<string[]>([]);
  const [modalDetailsVisible, setModalDetailsVisible] = useState<Record<string, boolean>>({});
  const [detailsDragActiveId, setDetailsDragActiveId] = useState<string | null>(null);

  const [modalWebsiteJobsOrder, setModalWebsiteJobsOrder] = useState<string[]>([]);
  const [modalWebsiteJobsVisible, setModalWebsiteJobsVisible] = useState<Record<string, boolean>>({});
  const [websiteJobsDragActiveId, setWebsiteJobsDragActiveId] = useState<string | null>(null);

  const [modalOurJobsOrder, setModalOurJobsOrder] = useState<string[]>([]);
  const [modalOurJobsVisible, setModalOurJobsVisible] = useState<Record<string, boolean>>({});
  const [ourJobsDragActiveId, setOurJobsDragActiveId] = useState<string | null>(null);

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
    configType: "header",
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
              setVisibleFields(prev => {
                const current = prev.contactInfo || [];
                if (!current.includes(fieldKey)) {
                  return {
                    ...prev,
                    contactInfo: Array.from(new Set([...current, fieldKey]))
                  };
                }
                return prev;
              });
            } else if (fieldKey.toLowerCase().includes('status') || fieldKey.toLowerCase().includes('owner') || fieldKey.toLowerCase().includes('date')) {
              setVisibleFields(prev => {
                const current = prev.details || [];
                if (!current.includes(fieldKey)) {
                  return {
                    ...prev,
                    details: Array.from(new Set([...current, fieldKey]))
                  };
                }
                return prev;
              });
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
      const uniqueFields = Array.from(new Set(panelFields));
      if (uniqueFields.includes(fieldKey)) {
        return {
          ...prev,
          [panelId]: uniqueFields.filter(f => f !== fieldKey)
        };
      } else {
        return {
          ...prev,
          [panelId]: Array.from(new Set([...uniqueFields, fieldKey]))
        };
      }
    });
  };

  // Lead Contact Info field catalog: standard + all custom (for edit modal and display order)
  const contactInfoFieldCatalog = useMemo(() => {
    const standard: { key: string; label: string }[] = [
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
    ];
    const customFromDefs = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    const keysFromDefs = new Set(customFromDefs.map((c) => c.key));
    const standardKeys = new Set(standard.map((s) => s.key));
    const customFromLead = Object.keys(lead?.customFields || {})
      .filter((k) => !keysFromDefs.has(k) && !standardKeys.has(k))
      .map((k) => ({ key: k, label: k }));
    
    // Deduplicate by key property
    const allFields = [...standard, ...customFromDefs, ...customFromLead];
    const seenKeys = new Set<string>();
    return allFields.filter((f) => {
      if (seenKeys.has(f.key)) return false;
      seenKeys.add(f.key);
      return true;
    });
  }, [availableFields, lead?.customFields]);

  // Lead Details field catalog: standard + all custom (for edit modal and display order)
  const detailsFieldCatalog = useMemo(() => {
    const standard: { key: string; label: string }[] = [
      { key: "status", label: "Status" },
      { key: "owner", label: "Owner" },
      { key: "reportsTo", label: "Reports To" },
      { key: "dateAdded", label: "Date Added" },
      { key: "lastContactDate", label: "Last Contact" },
    ];
    const customFromDefs = (availableFields || [])
      .filter((f: any) => !f?.is_hidden && !f?.hidden && !f?.isHidden)
      .map((f: any) => ({
        key: String(f.field_name || f.field_key || f.api_name || f.id),
        label: String(f.field_label || f.field_name || f.field_key || f.id),
      }));
    const keysFromDefs = new Set(customFromDefs.map((c) => c.key));
    const standardKeys = new Set(standard.map((s) => s.key));
    const customFromLead = Object.keys(lead?.customFields || {})
      .filter((k) => !keysFromDefs.has(k) && !standardKeys.has(k))
      .map((k) => ({ key: k, label: k }));
    
    // Deduplicate by key property
    const allFields = [...standard, ...customFromDefs, ...customFromLead];
    const seenKeys = new Set<string>();
    return allFields.filter((f) => {
      if (seenKeys.has(f.key)) return false;
      seenKeys.add(f.key);
      return true;
    });
  }, [availableFields, lead?.customFields]);

  // Sync Lead Contact Info modal state when opening edit for contactInfo
  useEffect(() => {
    if (editingPanel !== "contactInfo") return;
    const current = visibleFields.contactInfo || [];
    const catalogKeys = contactInfoFieldCatalog.map((f) => f.key);
    // Remove duplicates from catalogKeys
    const uniqueCatalogKeys = Array.from(new Set(catalogKeys));
    const order = [...current.filter((k) => uniqueCatalogKeys.includes(k))];
    uniqueCatalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    // Ensure order has no duplicates
    const uniqueOrder = Array.from(new Set(order));
    setModalContactInfoOrder(uniqueOrder);
    setModalContactInfoVisible(
      uniqueCatalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.contactInfo, contactInfoFieldCatalog]);

  // Sync Lead Details modal state when opening edit for details
  useEffect(() => {
    if (editingPanel !== "details") return;
    const current = visibleFields.details || [];
    const catalogKeys = detailsFieldCatalog.map((f) => f.key);
    // Remove duplicates from catalogKeys
    const uniqueCatalogKeys = Array.from(new Set(catalogKeys));
    const order = [...current.filter((k) => uniqueCatalogKeys.includes(k))];
    uniqueCatalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    // Ensure order has no duplicates
    const uniqueOrder = Array.from(new Set(order));
    setModalDetailsOrder(uniqueOrder);
    setModalDetailsVisible(
      uniqueCatalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.details, detailsFieldCatalog]);

  const websiteJobsFieldCatalog = useMemo(() => [{ key: "jobs", label: "Jobs" }], []);
  const ourJobsFieldCatalog = useMemo(() => [{ key: "jobs", label: "Jobs" }], []);

  useEffect(() => {
    if (editingPanel !== "websiteJobs") return;
    const current = visibleFields.websiteJobs || [];
    const catalogKeys = websiteJobsFieldCatalog.map((f) => f.key);
    const order = [...current.filter((k) => catalogKeys.includes(k))];
    catalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    setModalWebsiteJobsOrder(order);
    setModalWebsiteJobsVisible(
      catalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.websiteJobs, websiteJobsFieldCatalog]);

  useEffect(() => {
    if (editingPanel !== "ourJobs") return;
    const current = visibleFields.ourJobs || [];
    const catalogKeys = ourJobsFieldCatalog.map((f) => f.key);
    const order = [...current.filter((k) => catalogKeys.includes(k))];
    catalogKeys.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    setModalOurJobsOrder(order);
    setModalOurJobsVisible(
      catalogKeys.reduce((acc, k) => ({ ...acc, [k]: current.includes(k) }), {} as Record<string, boolean>)
    );
  }, [editingPanel, visibleFields.ourJobs, ourJobsFieldCatalog]);

  // Handle edit panel click
    const renderPanel = (id: string, isOverlay = false) => {
    switch (id) {
      case "contactInfo":
        if (!lead) return null;
        const customObj = lead.customFields || {};
        const customFieldDefs = (availableFields || []).filter((f: any) => {
          const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
          return !isHidden;
        });

        const renderContactInfoRow = (key: string) => {
          // Standard fields
          switch (key) {
            case "fullName":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Name:</div>
                  <div className="flex-1 p-2 text-blue-600">{lead?.fullName}</div>
                </div>
              );
            case "nickname":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Nickname:</div>
                  <div className="flex-1 p-2">{lead?.nickname || "-"}</div>
                </div>
              );
            case "title":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Title:</div>
                  <div className="flex-1 p-2">{lead?.title || "-"}</div>
                </div>
              );
            case "organizationName":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Organization:</div>
                  <div className="flex-1 p-2 text-blue-600">{lead?.organizationName || lead?.organizationId || "-"}</div>
                </div>
              );
            case "department":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Department:</div>
                  <div className="flex-1 p-2">{lead?.department || "-"}</div>
                </div>
              );
            case "phone":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Phone:</div>
                  <div className="flex-1 p-2">{lead?.phone || "-"}</div>
                </div>
              );
            case "mobilePhone":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Mobile:</div>
                  <div className="flex-1 p-2">{lead?.mobilePhone || "-"}</div>
                </div>
              );
            case "email":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Email:</div>
                  <div className="flex-1 p-2 text-blue-600">
                    {lead?.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : "-"}
                  </div>
                </div>
              );
            case "email2":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Email 2:</div>
                  <div className="flex-1 p-2 text-blue-600">
                    {lead?.email2 ? <a href={`mailto:${lead.email2}`}>{lead.email2}</a> : "-"}
                  </div>
                </div>
              );
            case "fullAddress":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Address:</div>
                  <div className="flex-1 p-2">{lead?.fullAddress}</div>
                </div>
              );
            case "linkedinUrl":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">LinkedIn:</div>
                  <div className="flex-1 p-2 text-blue-600">
                    {lead?.linkedinUrl ? (
                      <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer">
                        {lead.linkedinUrl}
                      </a>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              );
            default:
              // Custom field
              const field = customFieldDefs.find(
                (f: any) =>
                  String(f.field_name || f.field_key || f.api_name || f.id) === String(key) ||
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
          }
        };

        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
            <PanelWithHeader
              title="Lead Contact Info:"
              onEdit={() => handleEditPanel("contactInfo")}
            >
              <div className="space-y-0 border border-gray-200 rounded">
                {Array.from(new Set(visibleFields.contactInfo || [])).map((key) => renderContactInfoRow(key))}
              </div>
            </PanelWithHeader>
          </SortablePanel>
        );
      case "details":
        if (!lead) return null;
        const detailsCustomObj = lead.customFields || {};
        const detailsCustomFieldDefs = (availableFields || []).filter((f: any) => {
          const isHidden = f?.is_hidden === true || f?.hidden === true || f?.isHidden === true;
          return !isHidden;
        });

        const renderDetailsRow = (key: string) => {
          // Standard fields
          switch (key) {
            case "status":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Status:</div>
                  <div className="flex-1 p-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{lead?.status}</span>
                  </div>
                </div>
              );
            case "owner":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Owner:</div>
                  <div className="flex-1 p-2">{lead?.owner || "-"}</div>
                </div>
              );
            case "reportsTo":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Reports To:</div>
                  <div className="flex-1 p-2">{lead?.reportsTo || "-"}</div>
                </div>
              );
            case "dateAdded":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Date Added:</div>
                  <div className="flex-1 p-2">{lead?.dateAdded || "-"}</div>
                </div>
              );
            case "lastContactDate":
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">Last Contact Date:</div>
                  <div className="flex-1 p-2">{lead?.lastContactDate || "-"}</div>
                </div>
              );
            default:
              // Custom field
              const field = detailsCustomFieldDefs.find(
                (f: any) =>
                  String(f.field_name || f.field_key || f.api_name || f.id) === String(key) ||
                  String(f.field_label || "") === String(key) ||
                  String(f.field_name || "") === String(key)
              );
              const value =
                (detailsCustomObj as any)?.[key] ??
                (field?.field_label ? (detailsCustomObj as any)?.[field.field_label] : undefined) ??
                (field?.field_name ? (detailsCustomObj as any)?.[field.field_name] : undefined);
              const label = field?.field_label || field?.field_name || key;
              return (
                <div key={key} className="flex border-b border-gray-200 last:border-b-0">
                  <div className="w-32 font-medium p-2 border-r border-gray-200 bg-gray-50">{label}:</div>
                  <div className="flex-1 p-2">{value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : "-"}</div>
                </div>
              );
          }
        };

        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
            <PanelWithHeader
              title="Lead Details"
              onEdit={() => handleEditPanel("details")}
            >
              <div className="space-y-0 border border-gray-200 rounded">
                {Array.from(new Set(visibleFields.details || [])).map((key) => renderDetailsRow(key))}
              </div>
            </PanelWithHeader>
          </SortablePanel>
        );
      case "recentNotes":
        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
            <PanelWithHeader
              title="Recent Notes"
              onEdit={() => handleEditPanel("recentNotes")}
            >
              {isLoadingNotes ? (
                <div className="text-gray-500 text-sm italic p-2">
                  Loading notes...
                </div>
              ) : notes.length === 0 ? (
                <div className="text-gray-500 text-sm italic p-2">
                  No notes found.
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.slice(0, 3).map((note) => (
                    <div
                      key={note.id}
                      className="p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                        <span className="text-xs font-medium text-blue-600">
                          {note.created_by_name}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {note.text}
                      </p>
                    </div>
                  ))}
                  {notes.length > 3 && (
                    <button
                      onClick={() => setActiveTab("notes")}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View all {notes.length} notes
                    </button>
                  )}
                </div>
              )}
            </PanelWithHeader>
          </SortablePanel>
        );
      case "websiteJobs":
        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
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
          </SortablePanel>
        );
      case "ourJobs":
        return (
          <SortablePanel key={id} id={id} isOverlay={isOverlay}>
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
          </SortablePanel>
        );
      default:
        return null;
    }
  };

  const handleEditPanel = (panelId: string) => {
    setEditingPanel(panelId);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingPanel(null);
  };

  // Lead Contact Info modal: drag end (reorder)
  const handleContactInfoDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setContactInfoDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalContactInfoOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // Lead Contact Info modal: save order/visibility and persist for all lead records
  const handleSaveContactInfoFields = useCallback(() => {
    const newOrder = Array.from(new Set(modalContactInfoOrder.filter((k) => modalContactInfoVisible[k])));
    if (typeof window !== "undefined") {
      localStorage.setItem(LEAD_CONTACT_INFO_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, contactInfo: newOrder }));
    setEditingPanel(null);
  }, [modalContactInfoOrder, modalContactInfoVisible]);

  // Lead Details modal: drag end (reorder)
  const handleDetailsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDetailsDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalDetailsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // Lead Details modal: save order/visibility and persist for all lead records
  const handleSaveDetailsFields = useCallback(() => {
    const newOrder = Array.from(new Set(modalDetailsOrder.filter((k) => modalDetailsVisible[k])));
    if (typeof window !== "undefined") {
      localStorage.setItem(LEAD_DETAILS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, details: newOrder }));
    setEditingPanel(null);
  }, [modalDetailsOrder, modalDetailsVisible]);

  const handleWebsiteJobsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setWebsiteJobsDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalWebsiteJobsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleSaveWebsiteJobsFields = useCallback(() => {
    const newOrder = modalWebsiteJobsOrder.filter((k) => modalWebsiteJobsVisible[k]);
    if (typeof window !== "undefined") {
      localStorage.setItem(WEBSITE_JOBS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, websiteJobs: newOrder }));
    setEditingPanel(null);
  }, [modalWebsiteJobsOrder, modalWebsiteJobsVisible]);

  const handleOurJobsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setOurJobsDragActiveId(null);
    if (!over || active.id === over.id) return;
    setModalOurJobsOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleSaveOurJobsFields = useCallback(() => {
    const newOrder = modalOurJobsOrder.filter((k) => modalOurJobsVisible[k]);
    if (typeof window !== "undefined") {
      localStorage.setItem(OUR_JOBS_STORAGE_KEY, JSON.stringify(newOrder));
    }
    setVisibleFields((prev) => ({ ...prev, ourJobs: newOrder }));
    setEditingPanel(null);
  }, [modalOurJobsOrder, modalOurJobsVisible]);

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

  const handleDownloadDocument = (doc: any) => {
    if (doc.file_path) {
      const isAbsoluteUrl = doc.file_path.startsWith("http://") || doc.file_path.startsWith("https://");
      const url = isAbsoluteUrl ? doc.file_path : (doc.file_path.startsWith("/") ? doc.file_path : `/${doc.file_path}`);
      window.open(url, "_blank");
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
    setEditDocumentName(doc.document_name || "");
    setEditDocumentType(doc.document_type || "General");
    setShowEditDocumentModal(true);
  };

  const handleUpdateDocument = async () => {
    if (!editingDocument || !leadId || !editDocumentName.trim()) return;
    try {
      const token = getCookie("token");
      const response = await fetch(`/api/leads/${leadId}/documents/${editingDocument.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ document_name: editDocumentName, document_type: editDocumentType }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update document");
      }
      const data = await response.json();
      setDocuments((prev) => prev.map((d) => (d.id === editingDocument.id ? { ...d, ...data.document } : d)));
      setShowEditDocumentModal(false);
      setEditingDocument(null);
      setEditDocumentName("");
      setEditDocumentType("General");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update document");
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUploads(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUploads(Array.from(files));
    }
    e.target.value = "";
  };

  const handleFileUploads = (files: File[]) => {
    if (!leadId) return;
    const validFiles = files.filter((file) => {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "image/jpeg",
        "image/png",
        "image/gif",
      ];
      const isValidType = allowedTypes.includes(file.type) || file.name.match(/\.(pdf|doc|docx|txt|jpg|jpeg|png|gif)$/i);
      const isValidSize = file.size <= 10 * 1024 * 1024;
      if (!isValidType) setUploadErrors((prev) => ({ ...prev, [file.name]: "Invalid file type. Allowed: PDF, DOC, DOCX, TXT, JPG, PNG, GIF" }));
      if (!isValidSize) setUploadErrors((prev) => ({ ...prev, [file.name]: "File size exceeds 10MB limit" }));
      return isValidType && isValidSize;
    });
    if (validFiles.length === 0) return;
    setPendingFiles(validFiles);
    setFileDetailsName(validFiles[0].name);
    setFileDetailsType("General");
    setShowFileDetailsModal(true);
  };

  const handleConfirmFileDetails = async () => {
    if (pendingFiles.length === 0) return;
    const currentFile = pendingFiles[0];
    await uploadFile(currentFile, fileDetailsName.trim(), fileDetailsType);
    const remaining = pendingFiles.slice(1);
    if (remaining.length > 0) {
      setPendingFiles(remaining);
      setFileDetailsName(remaining[0].name);
      setFileDetailsType("General");
    } else {
      setShowFileDetailsModal(false);
      setPendingFiles([]);
    }
  };

  const uploadFile = async (file: File, documentName: string, documentType: string) => {
    if (!leadId) return;
    const fileName = file.name;
    setUploadProgress((prev) => ({ ...prev, [fileName]: 0 }));
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_name", documentName);
      formData.append("document_type", documentType);
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUploadProgress((prev) => ({ ...prev, [fileName]: (e.loaded / e.total) * 100 }));
      });
      xhr.addEventListener("load", () => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[fileName];
          return next;
        });
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.document) setDocuments((prev) => [data.document, ...prev]);
          } catch (_) {}
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            setUploadErrors((prev) => ({ ...prev, [fileName]: data.message || "Upload failed" }));
          } catch (_) {
            setUploadErrors((prev) => ({ ...prev, [fileName]: "Upload failed" }));
          }
        }
      });
      xhr.addEventListener("error", () => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[fileName];
          return next;
        });
        setUploadErrors((prev) => ({ ...prev, [fileName]: "Network error" }));
      });
      const token = getCookie("token");
      xhr.open("POST", `/api/leads/${leadId}/documents/upload`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (err) {
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[fileName];
        return next;
      });
      setUploadErrors((prev) => ({ ...prev, [fileName]: "Upload failed" }));
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
            let detailsDisplay: React.ReactNode = "";

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
                                    <span className="font-semibold text-gray-700 min-w-[120px]">{cfKey}:</span>
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
              onClick={handleTogglePinnedRecord}
              className={`p-1 hover:bg-gray-200 rounded ${isRecordPinned ? "text-yellow-600" : "text-gray-600"}`}
              aria-label={isRecordPinned ? "Unpin" : "Pin"}
              title={isRecordPinned ? "Unpin" : "Pin"}
              disabled={!lead}
            >
              <BsFillPinAngleFill size={18} />
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handlePanelDragStart}
            onDragCancel={handlePanelDragCancel}
            onDragOver={handlePanelDragOver}
            onDragEnd={handlePanelDragEnd}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
          >
            <div className="grid grid-cols-7 gap-4">
              <div className="col-span-4 space-y-4">
                <DroppableContainer id="left" items={columns.left}>
                  {columns.left.map((id) => renderPanel(id))}
                </DroppableContainer>
              </div>
              <div className="col-span-3 space-y-4">
                <DroppableContainer id="right" items={columns.right}>
                  {columns.right.map((id) => renderPanel(id))}
                </DroppableContainer>
              </div>
            </div>
            <DragOverlay>
              {activeId ? renderPanel(activeId, true) : null}
            </DragOverlay>
          </DndContext>
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

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
            />

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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

            {/* Upload Progress */}
            {Object.keys(uploadProgress).length > 0 && (
              <div className="mb-4 space-y-2">
                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                  <div key={fileName} className="bg-gray-100 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{fileName}</span>
                      <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showFileDetailsModal && pendingFiles.length > 0 && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold mb-4">Confirm File Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">File Name *</label>
                      <input
                        type="text"
                        value={fileDetailsName}
                        onChange={(e) => setFileDetailsName(e.target.value)}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Document Type *</label>
                      <select
                        value={fileDetailsType}
                        onChange={(e) => setFileDetailsType(e.target.value)}
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
                      onClick={() => { setShowFileDetailsModal(false); setPendingFiles([]); }}
                      className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmFileDetails}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50"
                      disabled={!fileDetailsName.trim()}
                    >
                      Save & Upload
                    </button>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(uploadErrors).length > 0 && (
              <div className="mb-4 space-y-2">
                {Object.entries(uploadErrors).map(([fileName, error]) => (
                  <div key={fileName} className="bg-red-50 border border-red-200 rounded p-2">
                    <p className="text-sm text-red-800"><strong>{fileName}:</strong> {error}</p>
                  </div>
                ))}
              </div>
            )}

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
                      <th className="text-left p-3 font-medium">Actions</th>
                      <th className="text-left p-3 font-medium">Document Name</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Auto-Generated</th>
                      <th className="text-left p-3 font-medium">Created By</th>
                      <th className="text-left p-3 font-medium">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
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
                              doc.is_auto_generated ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {doc.is_auto_generated ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="p-3">{doc.created_by_name || "System"}</td>
                        <td className="p-3">{new Date(doc.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic">No documents available</p>
            )}

            {/* Edit Document Modal */}
            {showEditDocumentModal && editingDocument && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
                        <option value="General">General</option>
                        <option value="Contract">Contract</option>
                        <option value="Agreement">Agreement</option>
                        <option value="Policy">Policy</option>
                        <option value="Welcome">Welcome</option>
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

            {/* Document Viewer Modal */}
            {selectedDocument && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] flex flex-col">
                  <div className="bg-gray-100 p-4 border-b flex justify-between items-center shrink-0">
                    <div>
                      <h2 className="text-lg font-semibold">{selectedDocument.document_name}</h2>
                      <p className="text-sm text-gray-600">Type: {selectedDocument.document_type}</p>
                    </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Edit Fields - {editingPanel === "contactInfo" ? "Lead Contact Info" : editingPanel === "details" ? "Lead Details" : editingPanel === "websiteJobs" ? "Website Jobs" : editingPanel === "ourJobs" ? "Our Jobs" : editingPanel}
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="p-1 rounded hover:bg-gray-200"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>
            <div className="p-6">
              {editingPanel === "contactInfo" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setContactInfoDragActiveId(e.active.id as string)}
                    onDragEnd={handleContactInfoDragEnd}
                    onDragCancel={() => setContactInfoDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalContactInfoOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {Array.from(new Set(modalContactInfoOrder)).map((key, index) => {
                          const entry = contactInfoFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableContactInfoFieldRow
                              key={`contactInfo-${entry.key}-${index}`}
                              id={entry.key}
                              label={entry.label}
                              checked={!!modalContactInfoVisible[entry.key]}
                              onToggle={() =>
                                setModalContactInfoVisible((prev) => ({
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
                      {contactInfoDragActiveId ? (() => {
                        const entry = contactInfoFieldCatalog.find((f) => f.key === contactInfoDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableContactInfoFieldRow
                            id={entry.key}
                            label={entry.label}
                            checked={!!modalContactInfoVisible[entry.key]}
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
                      onClick={handleSaveContactInfoFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : editingPanel === "details" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setDetailsDragActiveId(e.active.id as string)}
                    onDragEnd={handleDetailsDragEnd}
                    onDragCancel={() => setDetailsDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalDetailsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {Array.from(new Set(modalDetailsOrder)).map((key, index) => {
                          const entry = detailsFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableDetailsFieldRow
                              key={`details-${entry.key}-${index}`}
                              id={entry.key}
                              label={entry.label}
                              checked={!!modalDetailsVisible[entry.key]}
                              onToggle={() =>
                                setModalDetailsVisible((prev) => ({
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
                      {detailsDragActiveId ? (() => {
                        const entry = detailsFieldCatalog.find((f) => f.key === detailsDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableDetailsFieldRow
                            id={entry.key}
                            label={entry.label}
                            checked={!!modalDetailsVisible[entry.key]}
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
                      onClick={handleSaveDetailsFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : editingPanel === "websiteJobs" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setWebsiteJobsDragActiveId(e.active.id as string)}
                    onDragEnd={handleWebsiteJobsDragEnd}
                    onDragCancel={() => setWebsiteJobsDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalWebsiteJobsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {modalWebsiteJobsOrder.map((key, index) => {
                          const entry = websiteJobsFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableDetailsFieldRow
                              key={`websiteJobs-${entry.key}-${index}`}
                              id={entry.key}
                              label={entry.label}
                              checked={!!modalWebsiteJobsVisible[entry.key]}
                              onToggle={() =>
                                setModalWebsiteJobsVisible((prev) => ({
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
                      {websiteJobsDragActiveId ? (() => {
                        const entry = websiteJobsFieldCatalog.find((f) => f.key === websiteJobsDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableDetailsFieldRow
                            id={entry.key}
                            label={entry.label}
                            checked={!!modalWebsiteJobsVisible[entry.key]}
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
                      onClick={handleSaveWebsiteJobsFields}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : editingPanel === "ourJobs" ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Drag to reorder. Toggle visibility with the checkbox. Changes apply to all lead records.
                  </p>
                  <DndContext
                    collisionDetection={closestCorners}
                    onDragStart={(e) => setOurJobsDragActiveId(e.active.id as string)}
                    onDragEnd={handleOurJobsDragEnd}
                    onDragCancel={() => setOurJobsDragActiveId(null)}
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <SortableContext
                      items={modalOurJobsOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded p-3">
                        {modalOurJobsOrder.map((key, index) => {
                          const entry = ourJobsFieldCatalog.find((f) => f.key === key);
                          if (!entry) return null;
                          return (
                            <SortableDetailsFieldRow
                              key={`ourJobs-${entry.key}-${index}`}
                              id={entry.key}
                              label={entry.label}
                              checked={!!modalOurJobsVisible[entry.key]}
                              onToggle={() =>
                                setModalOurJobsVisible((prev) => ({
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
                      {ourJobsDragActiveId ? (() => {
                        const entry = ourJobsFieldCatalog.find((f) => f.key === ourJobsDragActiveId);
                        if (!entry) return null;
                        return (
                          <SortableDetailsFieldRow
                            id={entry.key}
                            label={entry.label}
                            checked={!!modalOurJobsVisible[entry.key]}
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
                      onClick={handleSaveOurJobsFields}
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
