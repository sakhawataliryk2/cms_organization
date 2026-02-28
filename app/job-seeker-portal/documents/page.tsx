"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import PortalHeader from "../components/PortalHeader";
import DocumentCard from "../components/DocumentCard";
import DocumentViewer, {
  DocumentViewerHandle,
} from "../components/DocumentViewer";

type MappedField = {
  id?: number;
  field_name: string;
  field_label: string;
  field_type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  page_number?: number;
};

type Doc = {
  id: number;
  status: string;
  document_name: string;
  sent_at?: string;
  template_document_id: number;
  file_url: string;
  completed_at?: string | null;
  mapped_fields: MappedField[];
  jobseekerData?: { [key: string]: string };
};

type Profile = {
  first_name: string;
  last_name: string;
};

export default function JobSeekerPortalDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);

  const viewerRef = useRef<DocumentViewerHandle | null>(null);

  // Fetch documents + profile
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        // 1️⃣ Fetch documents
        const docRes = await fetch("/api/job-seeker-portal/documents", {
          cache: "no-store",
        });
        const docData = await docRes.json().catch(() => ({}));

        if (!docRes.ok || !docData?.success) {
          setError(docData?.message || "Failed to load documents");
          return;
        }

        const rows = Array.isArray(docData?.documents)
          ? docData.documents
          : Array.isArray(docData?.data)
          ? docData.data
          : [];

        setDocs(rows);

        // 2️⃣ Fetch profile
        const profileRes = await fetch("/api/job-seeker-portal/profile");
        const profileData = await profileRes.json();

        if (profileData.success) {
          setProfile(profileData.profile);
        } else {
          toast.error(profileData.message || "Failed to load profile");
        }
      } catch (err) {
        toast.error("An error occurred while loading portal data");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const handleViewClick = (doc: Doc) => setSelectedDoc(doc);
  const handleCloseViewer = () => setSelectedDoc(null);

  const userName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "Loading...";

  return (
    <div className="min-h-screen">
      <PortalHeader userName={userName} />

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
            <div className="text-center text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
              
              {/* LEFT SIDE */}
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
                    onAttach={() =>
                      toast.info(`Attach: ${d.document_name}`)
                    }
                    onCreateAndSubmit={() =>
                      toast.info(`Create & Submit: ${d.document_name}`)
                    }
                    onView={() => handleViewClick(d)}
                  />
                ))}
              </div>

              {/* RIGHT SIDE */}
              <div className="bg-white rounded border border-gray-300 min-h-[520px] overflow-hidden flex flex-col">
                
                {/* Header */}
                {selectedDoc && (
                  <div className="p-3 border-b flex items-center justify-end gap-2">
                    <button
                      onClick={() => viewerRef.current?.submit()}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold"
                    >
                      Finalize & Submit
                    </button>

                    <button
                      onClick={handleCloseViewer}
                      className="border px-4 py-2 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Body */}
                {!selectedDoc ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                    Select a document to view.
                  </div>
                ) : (
                  <div className="flex-1">
                    <DocumentViewer
                      ref={viewerRef}
                      doc={selectedDoc}
                      jobseekerData={
                        selectedDoc.jobseekerData || {}
                      }
                      onClose={handleCloseViewer}
                    />
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}