"use client";

import { useEffect, useMemo, useState } from "react";
import SendOnboardingModal from "./SendOnboardingModal";

type JobSeeker = {
  id: number;
  name?: string;
  email?: string;
};

type OnboardingStatus =
  | "SENT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED";

type OnboardingItem = {
  id: number;
  document_name: string;
  status: OnboardingStatus;
};

export default function OnboardingTab({ jobSeeker }: { jobSeeker: JobSeeker }) {
  const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const authHeaders = (): HeadersInit => {
    const token =
      typeof document !== "undefined"
        ? document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            "$1"
          )
        : "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/onboarding/job-seekers/${jobSeeker.id}`,
        { headers: { ...authHeaders() }, cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to load onboarding");
      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (jobSeeker?.id) fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobSeeker?.id]);

  const pending = useMemo(
    () => items.filter((x) => x.status !== "APPROVED"),
    [items]
  );
  const completed = useMemo(
    () => items.filter((x) => x.status === "APPROVED"),
    [items]
  );

  function statusLabel(s: OnboardingStatus) {
    if (s === "SENT") return "SENT →";
    if (s === "IN_PROGRESS") return "IN PROGRESS →";
    if (s === "SUBMITTED") return "SUBMITTED →";
    if (s === "REJECTED") return "REJECTED →";
    return "APPROVED";
  }

  return (
    <div className="col-span-7">
      <div className="bg-white p-4 rounded shadow-sm">
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Send Onboarding
          </button>
        </div>

        {loading && (
          <div className="text-sm text-gray-500 mb-3">Loading...</div>
        )}

        {/* Pending */}
        <div className="mb-4 border rounded">
          <div className="px-3 py-2 bg-gray-50 text-sm font-semibold">
            PENDING
          </div>

          {pending.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              There are currently no pending documents.
            </div>
          ) : (
            <div className="divide-y">
              {pending.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3"
                >
                  <div className="text-sm">{doc.document_name}</div>
                  <div className="text-xs font-semibold text-gray-600">
                    {statusLabel(doc.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed */}
        <div className="border rounded">
          <div className="px-3 py-2 bg-gray-50 text-sm font-semibold">
            COMPLETED
          </div>

          {completed.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              There are currently no completed documents.
            </div>
          ) : (
            <div className="divide-y">
              {completed.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3"
                >
                  <div className="text-sm">{doc.document_name}</div>
                  <div className="text-xs font-semibold text-green-600">
                    APPROVED
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <SendOnboardingModal
          jobSeeker={jobSeeker}
          onClose={() => setShowModal(false)}
          onSent={() => fetchItems()} // ✅ refresh from backend after sending
        />
      )}
    </div>
  );
}
