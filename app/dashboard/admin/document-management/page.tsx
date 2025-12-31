"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiChevronUp,
  FiChevronDown,
  FiFilter,
} from "react-icons/fi";
import ActionDropdown from "@/components/ActionDropdown";

type Document = {
  id: number;
  document_name: string;
  category: string;
  created_at?: string;
  created_by_name?: string;
  file_path?: string | null;
};

type SortConfig = {
  field: "document_name" | "category";
  order: "ASC" | "DESC";
};

type YesNo = "Yes" | "No";

type InternalUser = {
  id: number;
  name: string;
  email: string;
};


const DEFAULT_CATEGORIES = ["General", "Onboarding", "Healthcare", "HR"];

const DocumentManagementPage = () => {
  const [activeTab, setActiveTab] = useState<"packets" | "documents">(
    "documents"
  );

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

const authHeaders = (): HeadersInit => {
  const token =
    typeof document !== "undefined"
      ? document.cookie.replace(
          /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
          "$1"
        )
      : "";

  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

const fetchDocs = async () => {
  setLoading(true);
  try {
    const res = await fetch(`${API}/api/template-documents`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");

    const mapped: Document[] = (data.documents || []).map((d: any) => ({
      id: d.id,
      document_name: d.document_name,
      category: d.category,
      created_at: d.created_at,
      created_by_name: d.created_by_name,
      file_path: d.file_path,
    }));

    setDocs(mapped);
  } catch (e: any) {
    alert(e.message || "Failed to load documents");
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
      // don't block UI
      console.log("internal users load failed:", e.message);
    }
  };

  useEffect(() => {
    fetchDocs();
    fetchInternalUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => DEFAULT_CATEGORIES, []);

  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = docs;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.document_name.toLowerCase().includes(q)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      const aValue = (a[sortConfig.field] || "").toLowerCase();
      const bValue = (b[sortConfig.field] || "").toLowerCase();
      return sortConfig.order === "ASC"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

    return sorted;
  }, [docs, searchQuery, sortConfig]);

  const total = filteredAndSortedDocuments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, total);

  const displayedDocuments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredAndSortedDocuments.slice(start, end);
  }, [filteredAndSortedDocuments, currentPage, pageSize]);

  const handleSort = (field: "document_name" | "category") => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === "ASC" ? "DESC" : "ASC",
    }));
    setCurrentPage(1);
  };

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

  const openEditModal = (doc: Document) => {
    setEditingDoc(doc);
    setFormData({
      document_name: doc.document_name,
      category: doc.category,
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

  const handleCreateOrUpdate = async () => {
    if (!formData.document_name.trim() || !formData.category.trim()) {
      alert("Please fill in Document Name and Category");
      return;
    }
    if (!editingDoc && !formData.file) {
      alert("Please upload a PDF file");
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

     const url = editingDoc
       ? `${API}/api/template-documents/${editingDoc.id}`
       : `${API}/api/template-documents`;

      const res = await fetch(url, {
        method: editingDoc ? "PUT" : "POST",
        headers: {
          ...authHeaders(),
          // ❌ do not set Content-Type for FormData
        },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");

      closeModal();
      await fetchDocs();
    } catch (e: any) {
      alert(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      setLoading(true);
const res = await fetch(`${API}/api/template-documents/${id}`, {
  method: "DELETE",
  headers: { ...authHeaders() },
});
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed");
      await fetchDocs();
    } catch (e: any) {
      alert(e.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const actionOptions = (doc: Document) => [
    { label: "Edit", action: () => openEditModal(doc) },
    { label: "Delete", action: () => handleDelete(doc.id) },
  ];

  const SortIcon = ({ field }: { field: "document_name" | "category" }) => {
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

  return (
    <div className="bg-gray-200 min-h-screen p-4">
      {/* Tabs */}
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveTab("packets")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "packets"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          PACKETS
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "documents"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          DOCUMENTS
        </button>
      </div>

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
        <div className="overflow-x-auto overflow-y-visible">
          <table className="min-w-full divide-y divide-gray-200">
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
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {displayedDocuments.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No documents found.
                  </td>
                </tr>
              ) : (
                displayedDocuments.map((doc, index) => (
                  <tr
                    key={doc.id}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-4 whitespace-nowrap relative overflow-visible">
                      <div className="relative ml-7">
                        <ActionDropdown
                          label="ACTIONS"
                          options={actionOptions(doc)}
                        />
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {doc.document_name}

                      {doc.file_path ? (
                        <>
                          <a
                            className="ml-3 text-xs text-blue-600 underline"
                            href={`${API}${doc.file_path}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View PDF
                          </a>

                          <a
                            className="ml-3 text-xs text-green-600 underline"
                            href={`/dashboard/admin/document-management/${doc.id}/editor`}
                          >
                            Open Editor
                          </a>
                        </>
                      ) : null}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {doc.category}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      Upload PDF Document:
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          file: e.target.files?.[0] ?? null,
                        }))
                      }
                      className="text-sm mb-3"
                    />

                    <div className="flex items-center justify-center gap-2 mb-2">
                      <button
                        onClick={handleCreateOrUpdate}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded disabled:opacity-50"
                        disabled={loading}
                      >
                        {editingDoc ? "Update" : "Upload"}
                      </button>
                      <button
                        onClick={closeModal}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="text-xs text-gray-600 text-center">
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
