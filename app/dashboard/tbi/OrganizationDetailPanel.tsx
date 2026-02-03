"use client";

import { useState } from "react";

type OrganizationRecord = {
  id: number;
  name?: string;
  state?: string;
  contact_phone?: string;
  address?: string;
  address2?: string;
  city?: string;
  zip_code?: string;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
};

type TabId = "edit" | "placements" | "audit" | "billing";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getCf(org: OrganizationRecord, key: string): string {
  const cf = org.custom_fields as Record<string, string> | undefined;
  if (!cf) return "";
  return (cf[key] ?? (org as Record<string, string>)[key] ?? "") as string;
}

type Props = {
  organization: OrganizationRecord;
  onClose: () => void;
  onSave?: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
};

export default function OrganizationDetailPanel({ organization, onClose, onSave, onDelete }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("edit");

  const companyName = organization.name ?? "";
  const phone = organization.contact_phone ?? getCf(organization, "Phone") ?? "";
  const integrationId = getCf(organization, "Integration ID") || String(organization.id ?? "");
  const contractTermsNet = getCf(organization, "Contract TERMS NET") || "30";
  const permTermsNet = getCf(organization, "Perm TERMS NET") || "30";
  const address = organization.address ?? getCf(organization, "Address") ?? "";
  const address2 = organization.address2 ?? getCf(organization, "Address 2") ?? "";
  const city = organization.city ?? getCf(organization, "City") ?? "";
  const stateProvince = organization.state ?? getCf(organization, "State") ?? "";
  const zipPostal = organization.zip_code ?? getCf(organization, "ZIP") ?? "";
  const country = getCf(organization, "Country") || "United States";
  const startDayOfWeek = getCf(organization, "Start Day of Week") || "Monday";
  const iasisKey = getCf(organization, "Oasis Key") ?? getCf(organization, "IASIS KEY") ?? "";

  const [form, setForm] = useState({
    companyName,
    phone,
    integrationId,
    contractTermsNet,
    permTermsNet,
    address,
    address2,
    city,
    stateProvince,
    zipPostal,
    country,
    startDayOfWeek,
    iasisKey,
  });

  const tabItems: { id: TabId; label: string }[] = [
    { id: "edit", label: "EDIT" },
    { id: "placements", label: "PLACEMENTS" },
    { id: "audit", label: "AUDIT TRAIL" },
    { id: "billing", label: "BILLING CONTACT" },
  ];

  const handleSave = () => {
    onSave?.(form as unknown as Record<string, unknown>);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header – blue bar */}
        <div className="shrink-0 bg-[#2563eb] text-white flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-white/90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <h2 className="text-xl font-semibold">{form.companyName || "Organization"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded border border-white/80 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs – dark grey bar, EDIT active */}
        <div className="shrink-0 bg-gray-600 flex">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium uppercase tracking-wide transition-colors ${
                activeTab === tab.id
                  ? "bg-gray-500 text-white border-b-2 border-blue-400"
                  : "text-white/90 hover:bg-gray-500/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content – scrollable form (only EDIT tab content for now) */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          {activeTab === "edit" && (
            <div className="px-6 py-6 space-y-6">
              {/* General Information */}
              <section>
                <div className="flex items-center gap-2 mb-4 py-2 px-3 -mx-3 bg-gray-100 rounded-sm">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Section options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    General Information
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Company Name
                    </label>
                    <div className="flex-1 flex items-center gap-2 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                        className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                      <span className="text-green-600 shrink-0" aria-hidden>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Phone
                    </label>
                    <div className="flex-1 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Integration ID
                    </label>
                    <div className="flex-1 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={form.integrationId}
                        onChange={(e) => setForm((p) => ({ ...p, integrationId: e.target.value }))}
                        className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Invoice Information */}
              <section>
                <div className="flex items-center gap-2 mb-4 py-2 px-3 -mx-3 bg-gray-100 rounded-sm">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Section options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Invoice Information
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Contract TERMS NET
                    </label>
                    <div className="flex-1 flex items-center gap-2 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={form.contractTermsNet}
                        onChange={(e) => setForm((p) => ({ ...p, contractTermsNet: e.target.value }))}
                        className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                      <span className="text-green-600 shrink-0" aria-hidden>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Perm TERMS NET
                    </label>
                    <div className="flex-1 flex items-center gap-2 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={form.permTermsNet}
                        onChange={(e) => setForm((p) => ({ ...p, permTermsNet: e.target.value }))}
                        className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                      <span className="text-green-600 shrink-0" aria-hidden>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Billing */}
              <section>
                <div className="flex items-center gap-2 mb-4 py-2 px-3 -mx-3 bg-gray-100 rounded-sm">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Section options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Billing
                  </h3>
                </div>
                <div className="space-y-4">
                  {[
                    { key: "address" as const, label: "Address", value: form.address },
                    { key: "address2" as const, label: "Address 2", value: form.address2 },
                    { key: "city" as const, label: "City", value: form.city },
                    { key: "stateProvince" as const, label: "State/Province", value: form.stateProvince },
                    { key: "zipPostal" as const, label: "ZIP/Postal Code", value: form.zipPostal },
                    { key: "country" as const, label: "Country", value: form.country },
                  ].map(({ key, label, value }) => (
                    <div key={key} className="flex items-center gap-4">
                      <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {label}
                      </label>
                      <div className="flex-1 border-b border-gray-300 pb-1">
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                          className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Timesheets */}
              <section>
                <div className="flex items-center gap-2 mb-4 py-2 px-3 -mx-3 bg-gray-100 rounded-sm">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    aria-label="Section options"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Timesheets
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Start Day of Week
                    </label>
                    <div className="flex-1 border-b border-gray-300 pb-1 flex items-center gap-1 relative">
                      <select
                        value={form.startDayOfWeek}
                        onChange={(e) => setForm((p) => ({ ...p, startDayOfWeek: e.target.value }))}
                        className="flex-1 min-w-0 border-none outline-none text-gray-900 text-sm py-0.5 appearance-none cursor-pointer pr-7 bg-transparent"
                      >
                        {DAYS_OF_WEEK.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="w-5 h-5 text-gray-500 pointer-events-none absolute right-0 top-1/2 -translate-y-1/2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      IASIS Key
                    </label>
                    <div className="flex-1 border-b border-gray-300 pb-1">
                      <input
                        type="text"
                        value={form.iasisKey}
                        onChange={(e) => setForm((p) => ({ ...p, iasisKey: e.target.value }))}
                        className="w-full bg-transparent border-none outline-none text-gray-900 text-sm py-0.5"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-6 pb-4">
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-sm uppercase tracking-wide rounded shadow-sm transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-sm uppercase tracking-wide rounded shadow-sm transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save
                </button>
              </div>
            </div>
          )}

          {activeTab !== "edit" && (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">
              {activeTab === "placements" && "Placements content — coming soon."}
              {activeTab === "audit" && "Audit trail — coming soon."}
              {activeTab === "billing" && "Billing contact — coming soon."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
