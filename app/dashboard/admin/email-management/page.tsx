"use client";

import React, { useState, useEffect } from "react";
import { FiSearch, FiChevronDown, FiX, FiChevronLeft, FiChevronRight, FiCheckSquare, FiPlus, FiClock, FiCalendar, FiEdit2, FiUpload, FiFile, FiMessageSquare, FiTrash2 } from 'react-icons/fi';
interface EmailTemplate {
  id: number;
  template_name: string;
  subject: string;
  body: string;
  type: string;
}

const EmailManagementPage: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const [formData, setFormData] = useState<Omit<EmailTemplate, "id">>({
    template_name: "",
    subject: "",
    body: "",
    type: "internal",
  });

  // Fetch templates
  useEffect(() => {
    fetch("/api/admin/email-management")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch((err) => console.error("Error fetching templates:", err));
  }, []);

  // Generic fetch helper
  const apiRequest = async (url: string, method: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setFormData({ template_name: "", subject: "", body: "", type: "internal" });
    setShowModal(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      subject: template.subject,
      body: template.body,
      type: template.type,
    });
    setShowModal(true);
  };

  const handleDeleteTemplate = async (id: number) => {
    await apiRequest(`/api/admin/email-management/${id}`, "DELETE");
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveTemplate = async () => {
    const url = editingTemplate
      ? `/api/admin/email-management/${editingTemplate.id}`
      : "/api/admin/email-management";

    const method = editingTemplate ? "PUT" : "POST";
    const data = await apiRequest(url, method, formData);

    setTemplates((prev) =>
      editingTemplate
        ? prev.map((t) => (t.id === data.template.id ? data.template : t))
        : [...prev, data.template]
    );

    setShowModal(false);
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Email Management</h2>
      <button
        className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition mb-6"
        onClick={handleCreateTemplate}
      >
        Create New Template
      </button>

      <table className="min-w-full table-auto border-collapse border border-gray-300 shadow-sm rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="px-4 py-2 border">Template Name</th>
            <th className="px-4 py-2 border">Subject</th>
            <th className="px-4 py-2 border">Type</th>
            <th className="px-4 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
  {templates.map((template) => (
    <tr
      key={template.id}
      className="bg-white hover:bg-gray-50 transition"
    >
      <td className="px-4 py-2">{template.template_name}</td>
      <td className="px-4 py-2">{template.subject}</td>
      <td className="px-4 py-2">{template.type}</td>
      <td className="px-4 py-2 flex gap-2">
        {/* Edit button with pencil icon */}
        <button
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition"
          onClick={() => handleEditTemplate(template)}
        >
          <FiEdit2 className="w-4 h-4" />
          <span className="sr-only">Edit</span>
        </button>

        {/* Delete button with trash icon */}
        <button
          className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition"
          onClick={() => handleDeleteTemplate(template.id)}
        >
          <FiTrash2 className="w-4 h-4" />
          <span className="sr-only">Delete</span>
        </button>
      </td>
    </tr>
  ))}
</tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center px-4">
          <div className="bg-white p-8 rounded-lg shadow-lg w-[800px] max-w-full relative">
            {/* Close button in top right corner */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <FiX className="w-6 h-6" />
            </button>
            
            <h3 className="text-2xl font-semibold mb-6 text-gray-800 pr-8">
              {editingTemplate ? "Edit Template" : "➕ Create EmailTemplate"}
            </h3>

            {/* Input fields */}
            {["template_name", "subject"].map((field) => (
              <div className="mb-4" key={field}>
                <label className="block text-sm font-medium mb-2 capitalize text-gray-700">
                  {field.replace("_", " ")}
                </label>
                <input
                  type="text"
                  className="p-3 border rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData[field as keyof typeof formData]}
                  onChange={(e) =>
                    setFormData({ ...formData, [field]: e.target.value })
                  }
                />
              </div>
            ))}

            {/* Body input */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">Body</label>
              <textarea
                className="p-3 border rounded w-full h-[200px] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Write your email content here..."
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
              />
            </div>

            {/* Type select */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">Type</label>
              <select
                className="p-3 border rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
              >
                <option value="internal">Internal</option>
                <option value="job_seeker">Job Seeker</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-4">
              <button
                className="bg-gray-500 text-white px-5 py-2 rounded-lg hover:bg-gray-600 transition"
                onClick={() => setShowModal(false)}
              >
                ✖ Close
              </button>
              <button
                className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
                onClick={handleSaveTemplate}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailManagementPage;
