"use client";

import { useMemo, useState } from "react";
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
};

type SortConfig = {
  field: "document_name" | "category";
  order: "ASC" | "DESC";
};

type YesNo = "Yes" | "No";

// Static data matching the screenshot
const STATIC_DOCUMENTS: Document[] = [
  { id: 1, document_name: "1545 Home Health", category: "Healthcare" },
  {
    id: 2,
    document_name: "2021-2022 Medical Declination Form",
    category: "Healthcare",
  },
  {
    id: 3,
    document_name: "2023-2024 Holloway Agency Packet",
    category: "Onboarding",
  },
  {
    id: 4,
    document_name: "Account Information Set up",
    category: "Onboarding",
  },
  { id: 5, document_name: "ACI - Code of conduct", category: "Onboarding" },
  {
    id: 6,
    document_name: "ACI - Drug Alcohol Free WP",
    category: "Onboarding",
  },
  {
    id: 7,
    document_name: "ACI - Fingerprinting BGC Consent",
    category: "Onboarding",
  },
  { id: 8, document_name: "ACI - Health Form", category: "Onboarding" },
  {
    id: 9,
    document_name: "ACI - Request for Fingerprinting",
    category: "Onboarding",
  },
  { id: 10, document_name: "ACI - Staff Exclusion", category: "Onboarding" },
  {
    id: 11,
    document_name: "ACI - Statewide Central Register",
    category: "Onboarding",
  },
  {
    id: 12,
    document_name: "ACKNOWLEDGMENT OF RECEIPT OF POLICIES AND PROCEDURES",
    category: "Onboarding",
  },
  { id: 13, document_name: "Addendum C Suicide Risk", category: "Healthcare" },
  { id: 14, document_name: "ADP Authorization Form", category: "Onboarding" },
];

const STATIC_TOTAL = 469; // Total count from screenshot

const DocumentManagementPage = () => {
  const [activeTab, setActiveTab] = useState<"packets" | "documents">(
    "documents"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(250);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "document_name",
    order: "ASC",
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);

  // ✅ client wants category filter removed -> keep it commented out
  // const [selectedCategory, setSelectedCategory] = useState<string>("");

  const [formData, setFormData] = useState({
    document_name: "",
    category: "",
    description: "",
    approvalRequired: "No" as YesNo,
    additionalDocsRequired: "No" as YesNo,
    emails: "",
    file: null as File | null,
  });

  // Keep categories only for modal dropdown (not for filtering table)
  const categories = useMemo(() => {
    const cats = Array.from(new Set(STATIC_DOCUMENTS.map((d) => d.category)));
    return cats.sort();
  }, []);

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = STATIC_DOCUMENTS;

    // ✅ search by name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.document_name.toLowerCase().includes(query)
      );
    }

    // ❌ category filter removed
    // if (selectedCategory) {
    //   filtered = filtered.filter((doc) => doc.category === selectedCategory);
    // }

    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortConfig.field].toLowerCase();
      const bValue = b[sortConfig.field].toLowerCase();
      return sortConfig.order === "ASC"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

    return sorted;
  }, [searchQuery, sortConfig]);

  const total = STATIC_TOTAL;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
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

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
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
      emails: "",
      file: null,
    });
    setShowCreateModal(true);
  };

  const handleCreate = () => {
    if (!formData.document_name.trim() || !formData.category.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    // Static mode
    alert("Document creation is disabled in static mode");
    setShowCreateModal(false);
    setFormData({
      document_name: "",
      category: "",
      description: "",
      approvalRequired: "No",
      additionalDocsRequired: "No",
      emails: "",
      file: null,
    });
  };

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc);
    setFormData({
      document_name: doc.document_name,
      category: doc.category,
      description: "",
      approvalRequired: "No",
      additionalDocsRequired: "No",
      emails: "",
      file: null,
    });
    setShowCreateModal(true);
  };

  const handleUpdate = () => {
    if (
      !editingDoc ||
      !formData.document_name.trim() ||
      !formData.category.trim()
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Static mode
    alert("Document update is disabled in static mode");
    setShowCreateModal(false);
    setEditingDoc(null);
    setFormData({
      document_name: "",
      category: "",
      description: "",
      approvalRequired: "No",
      additionalDocsRequired: "No",
      emails: "",
      file: null,
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    // Static mode
    alert("Document deletion is disabled in static mode");
  };

  const actionOptions = (doc: Document) => [
    { label: "Edit", action: () => handleEdit(doc) },
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

      {/* Search and Controls */}
      <div className="bg-white p-4 rounded shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Page Size Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageSizeChange(100)}
                className={`px-3 py-1 text-sm rounded ${
                  pageSize === 100
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                100
              </button>
              <button
                onClick={() => handlePageSizeChange(250)}
                className={`px-3 py-1 text-sm rounded ${
                  pageSize === 250
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                250
              </button>
              <button
                onClick={() => handlePageSizeChange(500)}
                className={`px-3 py-1 text-sm rounded ${
                  pageSize === 500
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                500
              </button>
            </div>

            {/* Display Info */}
            <div className="text-sm text-gray-600">
              Displaying {startIndex} - {endIndex} of {total}
            </div>

            {/* Pagination */}
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

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
            >
              Create New Doc
            </button>

            <button
              onClick={() => {
                setSearchQuery("");
                // setSelectedCategory(""); // removed
                setCurrentPage(1);
              }}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50"
              title="Refresh"
            >
              <FiRefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Category Filter removed by client request */}
        {/*
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Filter by Category:</span>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            ...
          </select>
        </div>
        */}
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-sm overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* empty column removed (pencil) */}
                {/* <th className="px-6 py-3 w-12"></th> */}

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"></th>

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
                    {/* ✅ ACTIONS - fixed overflow */}
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

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="min-h-screen w-full flex items-start justify-center p-6 sm:p-10">
            <div className="w-full max-w-4xl bg-white border border-gray-300 shadow-lg max-h-[calc(100vh-80px)] flex flex-col">
              <div className="bg-[#111] text-white px-4 py-2 flex items-center justify-between shrink-0">
                <div className="text-sm font-semibold">
                  {editingDoc ? "Edit Document" : "Create Document"}
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingDoc(null);
                    setFormData({
                      document_name: "",
                      category: "",
                      description: "",
                      approvalRequired: "No",
                      additionalDocsRequired: "No",
                      emails: "",
                      file: null,
                    });
                  }}
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Users to receive Completed Notification Email(s):
                    </label>
                    <input
                      type="text"
                      value={formData.emails}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, emails: e.target.value }))
                      }
                      className="w-full h-9 px-3 border border-gray-400 text-sm outline-none focus:border-gray-600"
                      placeholder="Email(s)"
                    />
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
                        onClick={editingDoc ? handleUpdate : handleCreate}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded"
                      >
                        Upload
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateModal(false);
                          setEditingDoc(null);
                          setFormData({
                            document_name: "",
                            category: "",
                            description: "",
                            approvalRequired: "No",
                            additionalDocsRequired: "No",
                            emails: "",
                            file: null,
                          });
                        }}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded"
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
