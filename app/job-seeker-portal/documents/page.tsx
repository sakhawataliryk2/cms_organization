"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import PortalHeader from "../components/PortalHeader";
import DocumentCard from "../components/DocumentCard";

type Doc = {
  id: number;
  status: string;
  document_name: string;
  sent_at?: string;
  completed_at?: string | null;
};


export default function JobSeekerPortalDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
  (async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/job-seeker-portal/documents", {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        setError(data?.message || "Failed to load documents");
        return;
      }

      const rows = Array.isArray(data?.documents)
        ? data.documents
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setDocs(rows);
    } catch {
      setError("Server error while loading documents");
    } finally {
      setLoading(false);
    }
  })();
}, []);

  return (
    <div className="min-h-screen">
      <PortalHeader userName="User,Test" />

      <div className="bg-[#f3f3f3] min-h-[calc(100vh-56px)] text-black">
        <div className="max-w-[1200px] mx-auto px-4 py-6">
          <div className="text-center mb-5">
            <h2 className="text-lg font-semibold text-gray-700">Documents</h2>
          </div>

          {loading && (
            <div className="text-center text-sm text-gray-600">
              Loading...
            </div>
          )}

          {error && (
            <div className="text-center text-sm text-red-600">{error}</div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
              <div className="space-y-4">
                {docs.length === 0 && (
                  <div className="text-sm text-gray-600 bg-white border border-gray-300 rounded p-4">
                    No onboarding documents found for this account.
                  </div>
                )}

                {docs.map((d) => (
                  <DocumentCard
                    key={d.id}
                    status={d.status}
                    title={d.document_name}
                    attachments={0}
                    onAttach={() => toast.info(`Attach: ${d.document_name}`)}
                    onCreateAndSubmit={() =>
                      toast.info(`Create & Submit: ${d.document_name}`)
                    }
                    onView={() => toast.info(`View: ${d.document_name}`)}
                  />
                ))}
              </div>

              <div className="bg-white rounded border border-gray-300 min-h-[520px]">
                <div className="p-4 border-b border-gray-200 text-sm font-semibold text-gray-700">
                  Information
                </div>
                <div className="p-4 text-sm text-gray-500">
                  Select a document to view details.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
