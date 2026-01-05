"use client";

import { useMemo, useState } from "react";
import SendOnboardingModal from "./SendOnboardingModal";

type JobSeeker = {
  id: number;
  name?: string;
  email?: string;
};

type OnboardingItem = {
  id: number;
  document_name: string;
  status: "SENT" | "COMPLETED";
};

export default function OnboardingTab({ jobSeeker }: { jobSeeker: JobSeeker }) {
  const [showModal, setShowModal] = useState(false);

  // TODO: Replace with API later
  const [items, setItems] = useState<OnboardingItem[]>([]);

  const pending = useMemo(
    () => items.filter((x) => x.status === "SENT"),
    [items]
  );

  const completed = useMemo(
    () => items.filter((x) => x.status === "COMPLETED"),
    [items]
  );

  function handleAfterSend(newItems: OnboardingItem[]) {
    // Merge/update list after send (temporary until backend provides list)
    setItems((prev) => [...newItems, ...prev]);
    setShowModal(false);
  }

  return (
    <div className="col-span-7">
      <div className="bg-white p-4 rounded shadow-sm">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Send Onboarding
          </button>
        </div>

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
                    SENT →
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
                    COMPLETED
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <SendOnboardingModal
          jobSeeker={jobSeeker}
          onClose={() => setShowModal(false)}
          onSent={handleAfterSend}
        />
      )}
    </div>
  );
}
