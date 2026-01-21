"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiX, FiEdit2, FiTrash2 } from "react-icons/fi";

interface EmailTemplate {
  id: number;
  template_name: string;
  subject: string;
  body: string;
  type: string;
}

type FormData = Omit<EmailTemplate, "id">;

const TYPE_OPTIONS = [
  { value: "ONBOARDING_INTERNAL_SENT", label: "Onboarding - Internal Notification" },
  { value: "ONBOARDING_JOBSEEKER_FIRST_TIME", label: "Onboarding - Job Seeker (First Time Credentials Sent)" },
  { value: "ONBOARDING_JOBSEEKER_REPEAT", label: "Onboarding - Job Seeker (Repeat)" },
];

const PLACEHOLDERS: Record<string, string[]> = {
  ONBOARDING_INTERNAL_SENT: ["{{jobSeekerName}}", "{{sentBy}}", "{{docsList}}"],
  ONBOARDING_JOBSEEKER_FIRST_TIME: ["{{portalUrl}}", "{{username}}", "{{tempPassword}}"],
  ONBOARDING_JOBSEEKER_REPEAT: ["{{portalUrl}}"],
};

const REQUIRED: Record<string, string[]> = {
  ONBOARDING_INTERNAL_SENT: ["{{jobSeekerName}}", "{{sentBy}}", "{{docsList}}"],
  ONBOARDING_JOBSEEKER_FIRST_TIME: ["{{portalUrl}}", "{{username}}", "{{tempPassword}}"],
  ONBOARDING_JOBSEEKER_REPEAT: ["{{portalUrl}}"],
};

const DEFAULTS: Record<string, { template_name: string; subject: string; body: string }> = {
  ONBOARDING_INTERNAL_SENT: {
    template_name: "Onboarding Internal Notification",
    subject: "Documents Sent for {{jobSeekerName}}",
    body:
      `<div>` +
      `<p>Hello</p>` +
      `<p>The documents for <b>Job Seeker {{jobSeekerName}}</b> have been sent for onboarding.</p>` +
      `<p><b>Documents:</b></p>` +
      `<ul>{{docsList}}</ul>` +
      `<p>These were sent by <b>{{sentBy}}</b>.</p>` +
      `</div>`,
  },
  ONBOARDING_JOBSEEKER_FIRST_TIME: {
    template_name: "Onboarding Job Seeker - First Time",
    subject: "Onboarding Documents - Portal Access",
    body:
      `<div>` +
      `<p>Hello,</p>` +
      `<p>You have onboarding documents that are awaiting your submission.</p>` +
      `<p><b>Portal:</b> <a href="{{portalUrl}}">WEBSITE</a></p>` +
      `<p><b>Username:</b> {{username}}</p>` +
      `<p><b>Temporary Password:</b> {{tempPassword}}</p>` +
      `<p>Please log in and complete your documents.</p>` +
      `<p>` +
      `Best Regards,<br/>` +
      `Complete Staffing Solutions, Inc.<br/><br/>` +
      `<a href="https://www.completestaffingsolutions.com">www.completestaffingsolutions.com</a>` +
      `</p>` +
      `</div>`,
  },
  ONBOARDING_JOBSEEKER_REPEAT: {
    template_name: "Onboarding Job Seeker - Repeat",
    subject: "Onboarding Documents",
    body:
      `<div>` +
      `<p>Hello,</p>` +
      `<p>You have onboarding documents that are awaiting your submission.</p>` +
      `<p>` +
      `Please log into <a href="{{portalUrl}}">WEBSITE</a> to complete your documents.` +
      ` Your username is the email address you received this email to.` +
      ` If you forgot your password, please use the forgot password link.` +
      `</p>` +
      `<p>` +
      `Best Regards,<br/>` +
      `Complete Staffing Solutions, Inc.<br/><br/>` +
      `<a href="https://www.completestaffingsolutions.com">www.completestaffingsolutions.com</a>` +
      `</p>` +
      `</div>`,
  },
};

const EmailManagementPage: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    template_name: "",
    subject: "",
    body: "",
    type: "ONBOARDING_INTERNAL_SENT",
  });

  useEffect(() => {
    fetch("/api/admin/email-management")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch((err) => console.error("Error fetching templates:", err));
  }, []);

  const apiRequest = async (url: string, method: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setFormData({ template_name: "", subject: "", body: "", type: "ONBOARDING_INTERNAL_SENT" });
    setShowModal(true);
  };

  const openEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      subject: template.subject,
      body: template.body,
      type: template.type,
    });
    setShowModal(true);
  };

  const insertAtCursor = (text: string) => {
    const el = document.getElementById("bodyField") as HTMLTextAreaElement | null;
    if (!el) return;

    const start = el.selectionStart ?? formData.body.length;
    const end = el.selectionEnd ?? formData.body.length;

    const next = formData.body.slice(0, start) + text + formData.body.slice(end);
    setFormData((p) => ({ ...p, body: next }));

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const loadDefault = () => {
    const d = DEFAULTS[formData.type];
    if (!d) return;
    setFormData((p) => ({
      ...p,
      template_name: p.template_name || d.template_name,
      subject: p.subject || d.subject,
      body: p.body || d.body,
    }));
  };

  const missing = useMemo(() => {
    const req = REQUIRED[formData.type] || [];
    const combined = `${formData.subject}\n${formData.body}`;
    return req.filter((ph) => !combined.includes(ph));
  }, [formData.type, formData.subject, formData.body]);

  const handleDelete = async (id: number) => {
    await apiRequest(`/api/admin/email-management/${id}`, "DELETE");
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Email Management</h2>
        <button
          className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
          onClick={openCreate}
        >
          Create New Template
        </button>
      </div>

      <table className="min-w-full table-auto border-collapse border border-gray-300 shadow-sm rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="px-4 py-2 border text-left">Template Name</th>
            <th className="px-4 py-2 border text-left">Subject</th>
            <th className="px-4 py-2 border text-left">Type</th>
            <th className="px-4 py-2 border text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id} className="bg-white hover:bg-gray-50 transition">
              <td className="px-4 py-2 border">{template.template_name}</td>
              <td className="px-4 py-2 border">{template.subject}</td>
              <td className="px-4 py-2 border">{template.type}</td>
              <td className="px-4 py-2 border">
                <div className="flex gap-3">
                  <button
                    className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition"
                    onClick={() => openEdit(template)}
                    type="button"
                  >
                    <FiEdit2 className="w-4 h-4" />
                    <span className="sr-only">Edit</span>
                  </button>

                  <button
                    className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition"
                    onClick={() => handleDelete(template.id)}
                    type="button"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    <span className="sr-only">Delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {templates.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={4}>
                No templates found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-gray-800/60 flex justify-center items-center px-4 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-[900px] max-w-full relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
              type="button"
            >
              <FiX className="w-6 h-6" />
            </button>

            <div className="flex items-center justify-between gap-3 mb-6 pr-10">
              <h3 className="text-2xl font-semibold text-gray-800">
                {editingTemplate ? "Edit Template" : "Create Email Template"}
              </h3>

              <button
                type="button"
                className="text-sm px-3 py-2 border rounded hover:bg-gray-50"
                onClick={loadDefault}
              >
                Load Default
              </button>
            </div>

            {missing.length > 0 && (
              <div className="mb-5 p-3 rounded border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
                Missing placeholders: {missing.join(", ")}. Email may send without dynamic data.
              </div>
            )}

            <div className="mb-5">
              <label className="block text-sm font-medium mb-2 text-gray-700">Type</label>
              <select
                className="p-3 border rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.type}
                onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <div className="mt-2 text-xs text-gray-600">
                This template is used automatically when onboarding is sent.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Template Name</label>
                <input
                  type="text"
                  className="p-3 border rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.template_name}
                  onChange={(e) => setFormData((p) => ({ ...p, template_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Subject</label>
                <input
                  type="text"
                  className="p-3 border rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.subject}
                  onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700">Body</label>
              <textarea
                id="bodyField"
                className="p-3 border rounded w-full h-[220px] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Write your email content here..."
                value={formData.body}
                onChange={(e) => setFormData((p) => ({ ...p, body: e.target.value }))}
              />
            </div>

            <div className="mb-6 text-xs text-gray-600">
              <div className="font-semibold mb-2">Quick insert:</div>
              <div className="flex flex-wrap gap-2">
                {(PLACEHOLDERS[formData.type] || []).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100"
                    onClick={() => insertAtCursor(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="bg-gray-500 text-white px-5 py-2 rounded-lg hover:bg-gray-600 transition"
                onClick={() => setShowModal(false)}
                type="button"
                disabled={saving}
              >
                Close
              </button>
              <button
                className={`text-white px-5 py-2 rounded-lg shadow transition ${
                  saving ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={handleSave}
                type="button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailManagementPage;
