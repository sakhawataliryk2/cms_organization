"use client";

import { useParams, useRouter } from "next/navigation";

export default function DocumentViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  return (
    <div className="bg-gray-200 min-h-screen p-4">
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">Document Viewer</div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 text-sm border rounded"
              onClick={() => router.back()}
            >
              Back
            </button>
          </div>
        </div>

        <div style={{ height: "calc(100vh - 140px)" }}>
          <iframe
            src={`/api/template-documents/${id}/file`}
            title="PDF Viewer"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
