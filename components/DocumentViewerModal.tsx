"use client";

import DocumentViewer from "@/components/DocumentViewer";

export type DocumentViewerModalDocument = {
  document_name?: string | null;
  name?: string | null;
  document_type?: string | null;
  created_by_name?: string | null;
  created_at?: string | Date | null;
  file_path?: string | null;
  mime_type?: string | null;
  content?: string | null;
};

type DocumentViewerModalProps = {
  document: DocumentViewerModalDocument;
  onClose: () => void;
  /** Show "Type: …" under the title (orgs / HMs / leads). */
  showType?: boolean;
  zIndexClassName?: string;
};

/**
 * Shared document preview overlay used across entity view pages.
 * Single scroll owner, no stacked min-h-[60vh] that caused empty space + double scrollbars.
 */
export default function DocumentViewerModal({
  document: doc,
  onClose,
  showType = false,
  zIndexClassName = "z-50",
}: DocumentViewerModalProps) {
  const title =
    doc.document_name || doc.name || "Untitled Document";
  const createdAt = doc.created_at
    ? new Date(doc.created_at).toLocaleString()
    : null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center p-4 ${zIndexClassName}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-start gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{title}</h2>
            {showType && doc.document_type ? (
              <p className="text-sm text-gray-600">Type: {doc.document_type}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 shrink-0 leading-none"
            aria-label="Close"
          >
            <span className="text-2xl font-bold">×</span>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2 overflow-hidden min-h-0">
          {createdAt ? (
            <p className="text-sm text-gray-600 shrink-0">
              Created by {doc.created_by_name || "System"} on {createdAt}
            </p>
          ) : null}

          {doc.file_path ? (
            <div className="min-h-0 overflow-hidden flex flex-col">
              <DocumentViewer
                filePath={doc.file_path}
                mimeType={doc.mime_type || undefined}
                documentName={title}
                onOpenInNewTab={() =>
                  window.open(doc.file_path as string, "_blank")
                }
              />
            </div>
          ) : (
            <div className="max-h-[calc(90vh-11rem)] overflow-y-auto bg-gray-50 p-4 rounded border whitespace-pre-wrap">
              {doc.content || "No content available"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
