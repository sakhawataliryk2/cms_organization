"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import SendOnboardingModal from "./SendOnboardingModal";

// ✅ PDF overlay viewer
import DocumentViewer, {
  DocumentViewerHandle,
} from "./../../../../job-seeker-portal/components/DocumentViewer";

type JobSeeker = {
  id: number;
  name?: string;
  email?: string;
};

type OnboardingStatus =
  | "SENT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "PENDING_ADMIN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED";

type OnboardingItem = {
  id: number;
  document_name: string;
  status: OnboardingStatus;
};

export default function OnboardingTab({ jobSeeker }: { jobSeeker: JobSeeker }) {
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [loading, setLoading] = useState(false);

  // reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [activeItemId, setActiveItemId] = useState<number | null>(null);

  // view modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<any>(null);

  // viewer ref (optional)
  const viewerRef = useRef<DocumentViewerHandle | null>(null);

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

  async function fetchItems() {
    if (!jobSeeker?.id) return;

    setLoading(true);
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...authHeaders(),
      };

      const res = await fetch(`/api/onboarding/job-seekers/${jobSeeker.id}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Failed to load onboarding");

      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleView(itemId: number) {
    try {
      setViewOpen(true);
      setViewLoading(true);
      setViewError(null);
      setViewItem(null);

      const res = await fetch(`/api/onboarding/items/${itemId}`, {
        method: "GET",
        headers: { ...authHeaders() },
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Failed to load item");

      // backend format: { success:true, documents:[doc] }
      setViewItem(json?.documents?.[0] || null);
      setActiveItemId(itemId);
    } catch (e: any) {
      setViewError(e?.message || "Failed to load item");
    } finally {
      setViewLoading(false);
    }
  }

  async function approveItem(itemId: number) {
    try {
      const res = await fetch(`/api/onboarding/items/${itemId}/admin-approve`, {
        method: "POST",
        headers: { ...authHeaders() },
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Approve failed");

      // close view + refresh
      setViewOpen(false);
      setViewItem(null);
      setActiveItemId(null);

      await fetchItems();
    } catch (e) {
      console.error(e);
    }
  }

  async function rejectItem() {
    if (!activeItemId) return;

    try {
      const res = await fetch(`/api/onboarding/items/${activeItemId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason: rejectReason }),
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Reject failed");

      // close modals + refresh
      setRejectOpen(false);
      setRejectReason("");

      setViewOpen(false);
      setViewItem(null);

      setActiveItemId(null);

      await fetchItems();
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobSeeker?.id]);

  const completed = useMemo(
    () => items.filter((x) => x.status === "APPROVED" || x.status === "COMPLETED"),
    [items]
  );

  const pending = useMemo(
    () => items.filter((x) => !(x.status === "APPROVED" || x.status === "COMPLETED")),
    [items]
  );

  function statusLabel(s: OnboardingStatus) {
    if (s === "SENT") return "SENT →";
    if (s === "IN_PROGRESS") return "IN PROGRESS →";
    if (s === "SUBMITTED") return "SUBMITTED →";
    if (s === "REJECTED") return "REJECTED →";
    if (s === "PENDING_ADMIN_REVIEW") return "PENDING ADMIN REVIEW →";
    return "APPROVED";
  }

  const canReview = (status?: OnboardingStatus) =>
    status === "SUBMITTED" || status === "PENDING_ADMIN_REVIEW";

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

        {loading && <div className="text-sm text-gray-500 mb-3">Loading...</div>}

        {/* Pending */}
        <div className="mb-4 border rounded">
          <div className="px-3 py-2 bg-gray-50 text-sm font-semibold">PENDING</div>

          {pending.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              There are currently no pending documents.
            </div>
          ) : (
            <div className="divide-y">
              {/* Header */}
              <div className="flex items-center justify-between p-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <div>Document Name</div>
                <div className="flex items-center gap-4">
                  <div>Packet Status</div>
                  <div className="w-[70px] text-right">Action</div>
                </div>
              </div>

              {/* Rows */}
              {pending.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3">
                  <div className="text-sm">{doc.document_name}</div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-gray-600">
                      {statusLabel(doc.status)}
                    </span>

                    {/* ✅ Only VIEW here (no approve/reject in list) */}
                    {canReview(doc.status) ? (
                      <button
                        onClick={() => handleView(doc.id)}
                        className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 w-[70px] text-right">
                        —
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed */}
        <div className="border rounded">
          <div className="px-3 py-2 bg-gray-50 text-sm font-semibold">COMPLETED</div>

          {completed.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              There are currently no completed documents.
            </div>
          ) : (
            <div className="divide-y">
              {/* Header */}
              <div className="flex items-center justify-between p-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <div>Document Name</div>
                <div>Packet Status</div>
              </div>

              {/* Rows */}
              {completed.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3">
                  <div className="text-sm">{doc.document_name}</div>
                  <div className="text-xs font-semibold text-green-600">
                    {doc.status === "COMPLETED" ? "COMPLETED" : "APPROVED"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Send Modal */}
      {showModal && (
        <SendOnboardingModal
          jobSeeker={jobSeeker}
          onClose={() => setShowModal(false)}
          onSent={() => fetchItems()}
        />
      )}

      {/* Reject Modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="bg-white rounded shadow-lg w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Reject Document</h3>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => setRejectOpen(false)}
              >
                ✕
              </button>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason..."
              className="w-full border rounded px-3 py-2 min-h-[110px]"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 border rounded"
                onClick={() => setRejectOpen(false)}
              >
                Cancel
              </button>

              <button
                disabled={!rejectReason.trim()}
                className={`px-4 py-2 rounded text-white ${
                  rejectReason.trim()
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-red-300 cursor-not-allowed"
                }`}
                onClick={rejectItem}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="bg-white rounded shadow-lg w-full max-w-6xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Submitted Document</h3>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => {
                  setViewOpen(false);
                  setViewItem(null);
                  setViewError(null);
                }}
              >
                ✕
              </button>
            </div>

            {viewLoading && <div className="text-sm text-gray-500">Loading...</div>}
            {viewError && <div className="text-sm text-red-600">{viewError}</div>}

            {!viewLoading && !viewError && (
              <div className="space-y-3">
                <div className="text-sm">
                  <b>Document:</b> {viewItem?.document_name || "-"}
                </div>

                {/* ✅ PDF + mapped fields overlay */}
                {viewItem?.file_url ? (
                  <div className="border rounded overflow-hidden" style={{ height: "70vh" }}>
                    <DocumentViewer
                      ref={viewerRef}
                      doc={{
                        id: viewItem.id,
                        document_name: viewItem.document_name,
                        file_url: viewItem.file_url,
                        mapped_fields: Array.isArray(viewItem?.mapped_fields)
                          ? viewItem.mapped_fields
                          : [],
                      }}
                      jobseekerData={viewItem?.jobseekerData || {}}
                      jobSeekerId={viewItem?.jobSeekerId || viewItem?.job_seeker_id || viewItem?.jobSeekerId}
                      onClose={() => {
                        setViewOpen(false);
                        setViewItem(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No file_url found.</div>
                )}

                {/* ✅ Only ONE set of buttons (here) */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="px-4 py-2 border rounded"
                    onClick={() => {
                      setViewOpen(false);
                      setViewItem(null);
                      setViewError(null);
                    }}
                  >
                    Close
                  </button>

                  <button
                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      if (!activeItemId) return;
                      setRejectReason("");
                      setViewOpen(false); // ✅ close view first
                      setRejectOpen(true);
                    }}
                  >
                    Reject
                  </button>

                  <button
                    className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                    onClick={async () => {
                      if (!activeItemId) return;
                      await approveItem(activeItemId);
                    }}
                  >
                    Approve
                  </button>

                  {/* Optional: if admin ever needs to submit/edit inside viewer */}
                  {/* 
                  <button
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                    onClick={async () => {
                      await viewerRef.current?.submit();
                    }}
                  >
                    Finalize & Submit
                  </button> 
                  */}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}