"use client";

import { useState, useMemo } from "react";
import { FiSearch, FiEdit2, FiRefreshCw, FiChevronUp, FiChevronDown, FiFilter } from "react-icons/fi";
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

// Static data matching the screenshot
const STATIC_DOCUMENTS: Document[] = [
  { id: 1, document_name: "1545 Home Health", category: "Healthcare" },
  { id: 2, document_name: "2021-2022 Medical Declination Form", category: "Healthcare" },
  { id: 3, document_name: "2023-2024 Holloway Agency Packet", category: "Onboarding" },
  { id: 4, document_name: "Account Information Set up", category: "Onboarding" },
  { id: 5, document_name: "ACI - Code of conduct", category: "Onboarding" },
  { id: 6, document_name: "ACI - Drug Alcohol Free WP", category: "Onboarding" },
  { id: 7, document_name: "ACI - Fingerprinting BGC Consent", category: "Onboarding" },
  { id: 8, document_name: "ACI - Health Form", category: "Onboarding" },
  { id: 9, document_name: "ACI - Request for Fingerprinting", category: "Onboarding" },
  { id: 10, document_name: "ACI - Staff Exclusion", category: "Onboarding" },
  { id: 11, document_name: "ACI - Statewide Central Register", category: "Onboarding" },
  { id: 12, document_name: "ACKNOWLEDGMENT OF RECEIPT OF POLICIES AND PROCEDURES", category: "Onboarding" },
  { id: 13, document_name: "Addendum C Suicide Risk", category: "Healthcare" },
  { id: 14, document_name: "ADP Authorization Form", category: "Onboarding" },
];

const STATIC_TOTAL = 469; // Total count from screenshot

const DocumentManagementPage = () => {
  const [activeTab, setActiveTab] = useState<"packets" | "documents">("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(250);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: "document_name", order: "ASC" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const [formData, setFormData] = useState({
    document_name: "",
    category: "",
  });

  // Get unique categories from static data
  const categories = useMemo(() => {
    const cats = Array.from(new Set(STATIC_DOCUMENTS.map((d) => d.category)));
    return cats.sort();
  }, []);

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = STATIC_DOCUMENTS;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.document_name.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter((doc) => doc.category === selectedCategory);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortConfig.field].toLowerCase();
      const bValue = b[sortConfig.field].toLowerCase();

      if (sortConfig.order === "ASC") {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    return sorted;
  }, [searchQuery, selectedCategory, sortConfig]);

  const total = STATIC_TOTAL; // Use static total from screenshot
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, total);

  // Get paginated documents (for display, we'll show the filtered ones)
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

  const handleCreate = () => {
    if (!formData.document_name.trim() || !formData.category.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    // Static mode - just close modal
    alert("Document creation is disabled in static mode");
    setShowCreateModal(false);
    setFormData({ document_name: "", category: "" });
  };

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc);
    setFormData({
      document_name: doc.document_name,
      category: doc.category,
    });
    setShowCreateModal(true);
  };

  const handleUpdate = () => {
    if (!editingDoc || !formData.document_name.trim() || !formData.category.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    // Static mode - just close modal
    alert("Document update is disabled in static mode");
    setShowCreateModal(false);
    setEditingDoc(null);
    setFormData({ document_name: "", category: "" });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    // Static mode - just show message
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
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                  pageSize === 100 ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                100
              </button>
              <button
                onClick={() => handlePageSizeChange(250)}
                className={`px-3 py-1 text-sm rounded ${
                  pageSize === 250 ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                250
              </button>
              <button
                onClick={() => handlePageSizeChange(500)}
                className={`px-3 py-1 text-sm rounded ${
                  pageSize === 500 ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
              onClick={() => {
                setEditingDoc(null);
                setFormData({ document_name: "", category: "" });
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
            >
              Create New Doc
            </button>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("");
                setCurrentPage(1);
              }}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50"
              title="Refresh"
            >
              <FiRefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Filter by Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"></th>
                <th
                  scope="col"
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
                  scope="col"
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
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No documents found.
                  </td>
                </tr>
              ) : (
                displayedDocuments.map((doc, index) => (
                  <tr key={doc.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(doc)}
                        className="text-gray-600 hover:text-blue-600"
                        title="Edit"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ActionDropdown label="ACTIONS" options={actionOptions(doc)} />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {editingDoc ? "Edit Document" : "Create New Document"}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingDoc(null);
                  setFormData({ document_name: "", category: "" });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl font-bold">×</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.document_name}
                  onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter document name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter category (e.g., Healthcare, Onboarding)"
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingDoc(null);
                  setFormData({ document_name: "", category: "" });
                }}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingDoc ? handleUpdate : handleCreate}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {editingDoc ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManagementPage;

