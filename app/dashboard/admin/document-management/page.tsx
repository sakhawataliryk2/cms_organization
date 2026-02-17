"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiSearch,
  FiRefreshCw,
  FiChevronUp,
  FiChevronDown,
  FiFilter,
} from "react-icons/fi";
import { createPortal } from "react-dom";

type Document = {
  id: number;
  document_name: string;
  category: string;
  created_at?: string;
  created_by_name?: string;
  file_path?: string | null;
  file_url?: string | null;
  mapped_count?: number;
  archived?: boolean;
};

type SortConfig = {
  field: "document_name" | "category" | "mapped";
  order: "ASC" | "DESC";
};

type YesNo = "Yes" | "No";

type InternalUser = {
  id: number;
  name: string;
  email: string;
};

const DEFAULT_CATEGORIES = ["General", "Onboarding", "Healthcare", "HR"];

type OrgDefaultWelcome = {
  id: number;
  slot: string;
  template_document_id: number | null;
  document_name?: string | null;
  file_url?: string | null;
  file_path?: string | null;
};

const DocumentManagementPage = () => {
  const router = useRouter();
  const params = useSearchParams();
  const showArchived = params.get("archived") === "1";
  const activeTab: "documents" | "organizations" =
    params.get("tab") === "organizations" ? "organizations" : "documents";

  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loading, setLoading] = useState(false);

  const [docs, setDocs] = useState<Document[]>([]);
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(250);
  const [currentPage, setCurrentPage] = useState(1);

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "document_name",
    order: "ASC",
  });

  // ✅ Mapped filter state
  const [mappedFilter, setMappedFilter] = useState<
    "all" | "mapped" | "not_mapped"
  >("all");
  const [mappedMenuOpen, setMappedMenuOpen] = useState(false);

  // ✅ Needed for portal positioning + outside click
  const mappedBtnRef = useRef<HTMLButtonElement | null>(null);
  const mappedMenuRef = useRef<HTMLDivElement | null>(null);

  const [mappedMenuPos, setMappedMenuPos] = useState({
    top: 0,
    left: 0,
    width: 176,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Organizations tab state
  const [welcomeDefault, setWelcomeDefault] = useState<OrgDefaultWelcome | null>(null);
  const [loadingOrgDefaults, setLoadingOrgDefaults] = useState(false);
  const [loadingPush, setLoadingPush] = useState(false);
  const [welcomeSelectOpen, setWelcomeSelectOpen] = useState(false);
  const [orgTemplates, setOrgTemplates] = useState<Document[]>([]);

  // ✅ modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);

  const [formData, setFormData] = useState({
    document_name: "",
    category: "",
    description: "",
    approvalRequired: "No" as YesNo,
    additionalDocsRequired: "No" as YesNo,
    notification_user_ids: [] as number[],
    file: null as File | null,
  });

  const API = process.env.API_BASE_URL || "http://localhost:8080";
  const fileUrl = (path?: string | null) => {
    if (!path) return "";
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${API}${p}`;
  };

  const authHeaders = (): HeadersInit => {
    const token =
      typeof document !== "undefined"
        ? document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )
        : "";

    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  const clampPage = (nextTotal: number, nextPageSize: number) => {
    const pages = Math.max(1, Math.ceil(nextTotal / nextPageSize));
    setCurrentPage((p) => Math.min(p, pages));
  };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/template-documents${showArchived ? "?archived=1" : ""}`,
        { method: "GET", cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");

      const normalized = (data.documents || []).map((d: any) => ({
        id: d.id,
        document_name: d.document_name,
        category: d.category,
        created_at: d.created_at,
        created_by_name: d.created_by_name,
        file_path: d.file_path,
        file_url: d.file_url,
        mapped_count: Number(d.mapped_count || 0),
        archived: Boolean(
          d.archived ??
            d.is_archived ??
            d.isArchived ??
            d.archived_at ??
            d.archivedAt
        ),
        archived_at: d.archived_at ?? d.archivedAt ?? null,
      }));

      setDocs(normalized);
      clampPage(normalized.length, pageSize);
    } catch (e: any) {
      toast.error(e.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const fetchInternalUsers = async () => {
    try {
      const res = await fetch("/api/users", {
        headers: { ...authHeaders() },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      setInternalUsers(data.users || []);
    } catch (e: any) {
      console.log("internal users load failed:", e.message);
    }
  };

  useEffect(() => {
    fetchDocs();
    fetchInternalUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const fetchWelcomeDefault = async () => {
    setLoadingOrgDefaults(true);
    try {
      const res = await fetch("/api/organization-default-documents/welcome", {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && data?.default) {
        setWelcomeDefault(data.default);
      } else {
        setWelcomeDefault(null);
      }
    } catch {
      setWelcomeDefault(null);
    } finally {
      setLoadingOrgDefaults(false);
    }
  };

  useEffect(() => {
    if (activeTab === "organizations") {
      fetchWelcomeDefault();
      fetch("/api/template-documents", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.success && Array.isArray(d.documents)) {
            setOrgTemplates(
              d.documents.map((x: any) => ({
                id: x.id,
                document_name: x.document_name,
                category: x.category,
                file_url: x.file_url,
                file_path: x.file_path,
                archived: x.is_archived ?? x.archived,
              }))
            );
          }
        })
        .catch(() => setOrgTemplates([]));
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!welcomeSelectOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if ((e.target as HTMLElement)?.closest?.("[data-welcome-select]")) return;
      setWelcomeSelectOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [welcomeSelectOpen]);

  const setWelcomeDocument = async (templateId: number) => {
    try {
      const res = await fetch("/api/organization-default-documents/welcome", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_document_id: templateId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success)
        throw new Error(data?.message || "Failed to set Welcome document");
      toast.success("Welcome document set. New organizations will receive this document.");
      setWelcomeSelectOpen(false);
      fetchWelcomeDefault();
    } catch (e: any) {
      toast.error(e.message || "Failed to set Welcome document");
    }
  };

  const pushWelcomeToAll = async () => {
    if (!confirm("Push the current Welcome document to all existing organizations? This will update their Welcome document to match the template."))
      return;
    setLoadingPush(true);
    try {
      const res = await fetch(
        "/api/organization-default-documents/welcome/push-to-all",
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data?.success)
        throw new Error(data?.message || "Failed to push");
      toast.success(data.message || "Pushed to all organizations");
      fetchWelcomeDefault();
    } catch (e: any) {
      toast.error(e.message || "Failed to push");
    } finally {
      setLoadingPush(false);
    }
  };

  const categories = useMemo(() => DEFAULT_CATEGORIES, []);

  // ✅ filter + sort (with mapped)
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = docs;
     filtered = filtered.filter((d) =>
       showArchived ? d.archived : !d.archived
     );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.document_name.toLowerCase().includes(q)
      );
    }

    if (mappedFilter === "mapped") {
      filtered = filtered.filter((d) => (d.mapped_count ?? 0) > 0);
    } else if (mappedFilter === "not_mapped") {
      filtered = filtered.filter((d) => (d.mapped_count ?? 0) === 0);
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortConfig.field === "mapped") {
        const av = Number(a.mapped_count ?? 0);
        const bv = Number(b.mapped_count ?? 0);
        return sortConfig.order === "ASC" ? av - bv : bv - av;
      }

      const aValue = String(a[sortConfig.field] || "").toLowerCase();
      const bValue = String(b[sortConfig.field] || "").toLowerCase();

      return sortConfig.order === "ASC"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

    return sorted;
  }, [docs, searchQuery, sortConfig, mappedFilter]);

  const total = filteredAndSortedDocuments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, total);

  const displayedDocuments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredAndSortedDocuments.slice(start, end);
  }, [filteredAndSortedDocuments, currentPage, pageSize]);

  const handleSort = (field: "document_name" | "category" | "mapped") => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === "ASC" ? "DESC" : "ASC",
    }));
    setCurrentPage(1);
  };

  // ✅ mapped menu position
  const computeMappedMenuPos = () => {
    const btn = mappedBtnRef.current;
    if (!btn) return;

    const r = btn.getBoundingClientRect();
    const gap = 8;

    setMappedMenuPos({
      top: r.bottom + gap,
      left: Math.max(8, r.right - 176), // keep inside screen a bit
      width: 176,
    });
  };

  // ✅ When menu opens, position it + keep it updated
  useEffect(() => {
    if (!mappedMenuOpen) return;

    computeMappedMenuPos();

    const onScroll = () => computeMappedMenuPos();
    const onResize = () => computeMappedMenuPos();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [mappedMenuOpen]);

  // ✅ Outside click to close mapped menu
  useEffect(() => {
    if (!mappedMenuOpen) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (mappedBtnRef.current?.contains(t)) return;
      if (mappedMenuRef.current?.contains(t)) return;
      setMappedMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mappedMenuOpen]);

  const openCreateModal = () => {
    setEditingDoc(null);
    setFormData({
      document_name: "",
      category: "",
      description: "",
      approvalRequired: "No",
      additionalDocsRequired: "No",
      notification_user_ids: [],
      file: null,
    });
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingDoc(null);
    setFormData({
      document_name: "",
      category: "",
      description: "",
      approvalRequired: "No",
      additionalDocsRequired: "No",
      notification_user_ids: [],
      file: null,
    });
  };

  const fetchDocDetails = async (id: number) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/template-documents/${id}`, {
        method: "GET",
        headers: { ...authHeaders() },
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");

      const d = data.document || data.data || data;

      setFormData({
        document_name: d.document_name ?? "",
        category: d.category ?? "",
        description: d.description ?? "",
        approvalRequired: (d.approvalRequired ??
          d.approval_required ??
          "No") as YesNo,
        additionalDocsRequired: (d.additionalDocsRequired ??
          d.additional_docs_required ??
          "No") as YesNo,
        notification_user_ids: (d.notification_user_ids ??
          d.notificationUserIds ??
          []) as number[],
        file: null,
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load document details");
    } finally {
      setLoadingEdit(false);
    }
  };

  const openEditModal = async (doc: Document) => {
    setEditingDoc(doc);
    setShowCreateModal(true);

    setFormData({
      document_name: doc.document_name,
      category: doc.category,
      description: "",
      approvalRequired: "No",
      additionalDocsRequired: "No",
      notification_user_ids: [],
      file: null,
    });

    await fetchDocDetails(doc.id);
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.document_name.trim() || !formData.category.trim()) {
      toast.error("Please fill in Document Name and Category");
      return;
    }
    if (!editingDoc && !formData.file) {
      toast.error("Please upload a PDF file");
      return;
    }

    try {
      setLoading(true);

      const fd = new FormData();
      fd.append("document_name", formData.document_name);
      fd.append("category", formData.category);
      fd.append("description", formData.description);
      fd.append("approvalRequired", formData.approvalRequired);
      fd.append("additionalDocsRequired", formData.additionalDocsRequired);
      fd.append(
        "notification_user_ids",
        JSON.stringify(formData.notification_user_ids)
      );
      if (formData.file) fd.append("file", formData.file);

      const isEdit = !!editingDoc;
      const url = isEdit
        ? `/api/template-documents/${editingDoc!.id}`
        : `/api/template-documents`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");

      const newDocId =
        data?.document?.id ?? data?.id ?? (isEdit ? editingDoc!.id : null);

      closeModal();
      await fetchDocs();

      if (!isEdit && newDocId) {
        router.push(`/dashboard/admin/document-management/${newDocId}/editor`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/template-documents/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      await fetchDocs();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id: number, archive: boolean) => {
    try {
      setLoading(true);

      const res = await fetch(`/api/template-documents/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");

      await fetchDocs();
    } catch (e: any) {
      toast.error(e?.message || "Archive failed");
    } finally {
      setLoading(false);
    }
  };

  const actionOptions = (doc: Document) => {
    const opts: { label: string; action: () => void }[] = [];

    if (doc.file_url) {
      opts.push({
        label: "View PDF",
        action: () =>
          window.open(
            `/dashboard/admin/document-management/${doc.id}/view`,
            "_blank"
          ),
      });

      opts.push({
        label: "Open Editor",
        action: () =>
          router.push(`/dashboard/admin/document-management/${doc.id}/editor`),
      });
    }

    opts.push({ label: "Edit", action: () => openEditModal(doc) });

    if (showArchived) {
      opts.push({
        label: "Unarchive",
        action: () => {
          if (!confirm("Unarchive this document?")) return;
          handleArchive(doc.id, false);
        },
      });
    } else {
      opts.push({
        label: "Archive",
        action: () => {
          if (!confirm("Archive this document?")) return;
          handleArchive(doc.id, true);
        },
      });
    }

    opts.push({ label: "Delete", action: () => handleDelete(doc.id) });
    return opts;
  };

  const SortIcon = ({
    field,
  }: {
    field: "document_name" | "category" | "mapped";
  }) => {
    if (sortConfig.field !== field) {
      return (
        <div className="flex flex-col">
          <FiChevronUp className="w-3 h-3 text-gray-400" />
          <FiChevronDown className="w-3 h-3 text-gray-400 -mt-1" />
        </div>
      );
    }

    return sortConfig.order === "ASC" ? (
      <FiChevronUp className="w-3 h-3 text-blue-600" />
    ) : (
      <FiChevronDown className="w-3 h-3 text-blue-600" />
    );
  };

  const RowActions = ({ doc }: { doc: Document }) => {
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const [open, setOpen] = useState(false);
    const [mountedLocal, setMountedLocal] = useState(false);
    const [pos, setPos] = useState({
      top: 0,
      left: 0,
      width: 180,
      openUp: false,
    });

    useEffect(() => setMountedLocal(true), []);

    const computePos = () => {
      const btn = btnRef.current;
      if (!btn) return;

      const r = btn.getBoundingClientRect();
      const gap = 6;
      const menuHeightGuess = 220;

      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < menuHeightGuess;

      setPos({
        top: openUp ? r.top - gap : r.bottom + gap,
        left: r.left,
        width: Math.max(180, r.width),
        openUp,
      });
    };

    useEffect(() => {
      if (!open) return;

      computePos();

      const onScroll = () => computePos();
      const onResize = () => computePos();

      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onResize);
      };
    }, [open]);

    useEffect(() => {
      const onDown = (e: MouseEvent) => {
        if (!open) return;
        const t = e.target as Node;

        if (btnRef.current?.contains(t)) return;
        if (menuRef.current?.contains(t)) return;

        setOpen(false);
      };

      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const options = actionOptions(doc);

    const menu =
      open && mountedLocal
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[99999] bg-white border border-gray-300 shadow-lg rounded-md overflow-hidden"
              style={{
                left: pos.left,
                top: pos.openUp ? pos.top : pos.top,
                transform: pos.openUp ? "translateY(-100%)" : "translateY(0)",
                minWidth: pos.width,
              }}
            >
              {options.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    opt.action();
                  }}
                  className="block text-left px-2 py-1.5 text-sm hover:bg-gray-50 whitespace-nowrap"
                >
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null;

    return (
      <>
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
        >
          ACTIONS <span className="ml-1">▼</span>
        </button>
        {menu}
      </>
    );
  };

  return (
    <div>
      {activeTab === "organizations" ? (
        /* Organizations tab content */
        <div className="bg-white p-6 rounded shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Organization Default Documents
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            These documents are automatically uploaded when a new organization is
            created. You can update them at any time. Use &quot;Push to All Organizations&quot; to
            distribute the updated version to all organizations that have this document.
          </p>

          {loadingOrgDefaults ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  Welcome Document
                </span>
                {welcomeDefault?.template_document_id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={pushWelcomeToAll}
                      disabled={loadingPush}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loadingPush ? "Pushing..." : "Push to All Organizations"}
                    </button>
                    <button
                      onClick={() =>
                        router.push(
                          `/dashboard/admin/document-management/${welcomeDefault.template_document_id}/editor`
                        )
                      }
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Open Editor
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          `/dashboard/admin/document-management/${welcomeDefault.template_document_id}/view`,
                          "_blank"
                        )
                      }
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      View PDF
                    </button>
                  </div>
                ) : null}
              </div>
              {welcomeDefault?.template_document_id ? (
                <div className="text-sm text-gray-700">
                  Current: <strong>{welcomeDefault.document_name || "Welcome Document"}</strong>
                  {welcomeDefault.file_url && (
                    <span className="ml-2 text-gray-500">
                      (PDF available)
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  No Welcome document configured. New organizations will receive a
                  default text placeholder. Set a template document below to use a
                  custom Welcome PDF.
                </div>
              )}
              <div className="mt-3">
                <div className="relative" data-welcome-select>
                  <button
                    onClick={() => setWelcomeSelectOpen((p) => !p)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
                  >
                    {welcomeDefault?.template_document_id
                      ? "Change Welcome Document"
                      : "Set Welcome Document"}
                  </button>
                  {welcomeSelectOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[240px] max-h-60 overflow-y-auto">
                      {orgTemplates
                        .filter((d) => !d.archived && (d.file_url || d.file_path))
                        .map((d) => (
                          <button
                            key={d.id}
                            onClick={() => setWelcomeDocument(d.id)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            {d.document_name} {d.category ? `(${d.category})` : ""}
                          </button>
                        ))}
                      {orgTemplates.filter((d) => !d.archived && (d.file_url || d.file_path)).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No template documents with PDFs.{" "}
                          <button
                            onClick={() => {
                              setWelcomeSelectOpen(false);
                              router.push("/dashboard/admin/document-management");
                              openCreateModal();
                            }}
                            className="text-blue-600 underline"
                          >
                            Create one in DOCUMENTS tab
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Controls */}
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              {[100, 250, 500].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 text-sm rounded ${
                    pageSize === size
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            <div className="text-sm text-gray-600">
              Displaying {startIndex} - {endIndex} of {total}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                PREVIOUS
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                NEXT
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
              disabled={loading}
            >
              Create New Doc
            </button>

            <button
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
                fetchDocs();
              }}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50"
              title="Refresh"
              disabled={loading}
            >
              <FiRefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {loading && <div className="text-sm text-gray-600">Loading...</div>}
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-sm overflow-visible">
        {/* IMPORTANT: keep scroll only on this wrapper */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 overflow-visible">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 w-24"></th>

                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("document_name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Document</span>
                    <SortIcon field="document_name" />
                    <FiFilter className="w-3 h-3 text-gray-400" />
                  </div>
                </th>

                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("category")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    <SortIcon field="category" />
                    <FiFilter className="w-3 h-3 text-gray-400" />
                  </div>
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    {/* ✅ Sort */}
                    <button
                      type="button"
                      onClick={() => handleSort("mapped")}
                      className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded"
                      title="Sort by mapped count"
                    >
                      <span>Mapped</span>
                      <SortIcon field="mapped" />
                      
                    </button>

                    {/* ✅ Filter */}
                    <div className="relative" data-mapped-filter-root>
                      <button
                        ref={mappedBtnRef}
                        type="button"
                        onClick={() => {
                          setMappedMenuOpen((p) => !p);
                          setTimeout(() => computeMappedMenuPos(), 0);
                        }}
                        className={` rounded ${
                          mappedFilter !== "all"
                           
                        } hover:bg-gray-50`}
                        title="Filter"
                      >
                        <FiFilter className="w-3 h-3 text-gray-600" />
                      </button>

                      {mappedMenuOpen && mounted
                        ? createPortal(
                            <div
                              ref={mappedMenuRef}
                              className="fixed z-[99999] bg-white border border-gray-200 rounded shadow-lg overflow-hidden"
                              style={{
                                top: mappedMenuPos.top,
                                left: mappedMenuPos.left,
                                width: mappedMenuPos.width,
                              }}
                            >
                              {[
                                { key: "all", label: "All" },
                                { key: "mapped", label: "Mapped only" },
                                { key: "not_mapped", label: "Not mapped only" },
                              ].map((opt) => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => {
                                    setMappedFilter(opt.key as any);
                                    setMappedMenuOpen(false);
                                    setCurrentPage(1);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                    mappedFilter === opt.key
                                      ? "bg-blue-50 text-blue-700"
                                      : ""
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>,
                            document.body
                          )
                        : null}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>

            {/* IMPORTANT: allow dropdown to overflow */}
            <tbody className="bg-white divide-y divide-gray-200 overflow-visible">
              {displayedDocuments.length === 0 ? (
                <tr className="overflow-visible">
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No documents found.
                  </td>
                </tr>
              ) : (
                displayedDocuments.map((doc, index) => (
                  <tr
                    key={doc.id}
                    className={`${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } overflow-visible`}
                  >
                    {/* IMPORTANT: this cell must be relative + visible */}
                    <td className="px-6 py-4 whitespace-nowrap relative overflow-visible">
                      <div className="relative ml-7 overflow-visible">
                        <RowActions doc={doc} />
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {doc.document_name}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {doc.category}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(doc.mapped_count ?? 0) > 0 ? (
                        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
                          Mapped ({doc.mapped_count})
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                          Not Mapped
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="min-h-screen w-full flex items-start justify-center p-6 sm:p-10">
            <div className="w-full max-w-4xl bg-white border border-gray-300 shadow-lg max-h-[calc(100vh-80px)] flex flex-col">
              <div className="bg-[#111] text-white px-4 py-2 flex items-center justify-between shrink-0">
                <div className="text-sm font-semibold">
                  {editingDoc ? "Edit Document" : "Create Document"}
                </div>
                <button
                  onClick={closeModal}
                  className="w-7 h-7 grid place-items-center bg-white/10 hover:bg-white/20 rounded"
                  aria-label="Close"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div className="px-6 py-5 overflow-y-auto flex-1">
                <div className="text-sm font-semibold text-gray-800 mb-4">
                  Document Details
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Specify the Document Name:
                    </label>
                    <input
                      type="text"
                      value={formData.document_name}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          document_name: e.target.value,
                        }))
                      }
                      className="w-full h-9 px-3 border border-gray-400 text-sm outline-none focus:border-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Specify the Document Category:
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, category: e.target.value }))
                      }
                      className="w-full h-9 px-3 border border-gray-400 text-sm outline-none focus:border-gray-600 bg-white"
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Specify the Document Description:
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      className="w-full min-h-[160px] px-3 py-2 border border-gray-400 text-sm outline-none focus:border-gray-600 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Approval Required:
                      </label>
                      <select
                        value={formData.approvalRequired}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            approvalRequired: e.target.value as YesNo,
                          }))
                        }
                        className="w-full h-9 px-3 border border-gray-400 text-sm outline-none focus:border-gray-600 bg-white"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Do additional documents need to be attached
                      </label>
                      <select
                        value={formData.additionalDocsRequired}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            additionalDocsRequired: e.target.value as YesNo,
                          }))
                        }
                        className="w-full h-9 px-3 border border-gray-400 text-sm outline-none focus:border-gray-600 bg-white"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      Select Users to receive Completed Notification Email(s):
                    </label>

                    <div className="border border-gray-400 p-2 max-h-40 overflow-y-auto">
                      {internalUsers.length === 0 ? (
                        <div className="text-xs text-gray-500">
                          No users loaded
                        </div>
                      ) : (
                        internalUsers.map((u) => {
                          const checked =
                            formData.notification_user_ids.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 text-sm py-1"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setFormData((p) => {
                                    const exists =
                                      p.notification_user_ids.includes(u.id);
                                    return {
                                      ...p,
                                      notification_user_ids: exists
                                        ? p.notification_user_ids.filter(
                                            (x) => x !== u.id
                                          )
                                        : [...p.notification_user_ids, u.id],
                                    };
                                  });
                                }}
                              />
                              <span>
                                {u.name}{" "}
                                <span className="text-xs text-gray-500">
                                  ({u.email})
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-gray-700">
                        Upload PDF Document:
                      </label>

                      {editingDoc?.file_url ? (
                        <a
                          className="text-xs text-blue-600 underline"
                          href={`/dashboard/admin/document-management/${editingDoc.id}/view`}
                          target="_blank"
                        >
                          View current PDF
                        </a>
                      ) : null}
                    </div>

                    {/* Nice bordered upload UI */}
                    <div className="border border-gray-300 rounded px-3 py-3 bg-white">
                      <div className="flex items-center gap-3">
                        {/* Hidden real input */}
                        <input
                          id="pdf-upload"
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              file: e.target.files?.[0] ?? null,
                            }))
                          }
                        />

                        {/* Custom choose button */}
                        <label
                          htmlFor="pdf-upload"
                          className="px-3 py-2 text-xs border border-gray-400 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer select-none"
                        >
                          Choose File
                        </label>

                        {/* File name */}
                        <div className="flex-1 min-w-0 text-xs text-gray-600 truncate">
                          {formData.file?.name
                            ? formData.file.name
                            : editingDoc?.file_path
                            ? "No new file selected (current PDF will remain)"
                            : "No file chosen"}
                        </div>

                        {/* Clear selection */}
                        {formData.file ? (
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((p) => ({
                                ...p,
                                file: null,
                              }))
                            }
                            className="px-2 py-2 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            title="Remove selected file"
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <button
                        onClick={handleCreateOrUpdate}
                        disabled={loading || loadingEdit}
                        className="px-5 py-2 bg-blue-600 text-white text-xs rounded disabled:opacity-50"
                      >
                        {editingDoc ? "Update" : "Upload"}
                      </button>

                      <button
                        onClick={closeModal}
                        className="px-5 py-2 bg-blue-600 text-white text-xs rounded disabled:opacity-50"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="text-xs text-gray-600 text-center mt-2">
                      When Document is selected and click upload
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManagementPage;
