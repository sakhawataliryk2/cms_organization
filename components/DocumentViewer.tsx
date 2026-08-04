"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { renderAsync } from "docx-preview";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set PDF.js worker via CDN to avoid Next.js ESM bundling issues with pdf.worker.min.mjs
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

type DocumentViewerProps = {
  filePath: string;
  mimeType?: string;
  documentName?: string;
  className?: string;
  onOpenInNewTab?: () => void;
};

function getProxyUrl(filePath: string): string {
  return `/api/documents/proxy?url=${encodeURIComponent(filePath)}`;
}

function getGoogleDocsViewerUrl(filePath: string): string {
  return `https://docs.google.com/gview?url=${encodeURIComponent(filePath)}&embedded=true`;
}

function isPdf(mime: string, name: string): boolean {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  return m === "application/pdf" || n.endsWith(".pdf");
}

function isDocx(mime: string, name: string): boolean {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  return (
    m.includes("wordprocessingml") ||
    m === "application/msword" ||
    n.endsWith(".docx") ||
    n.endsWith(".doc")
  );
}

function isImage(mime: string, name: string = ""): boolean {
  if (mime.toLowerCase().startsWith("image/")) return true;
  const n = name.toLowerCase();
  return (
    n.endsWith(".jpg") ||
    n.endsWith(".jpeg") ||
    n.endsWith(".png") ||
    n.endsWith(".gif") ||
    n.endsWith(".webp") ||
    n.endsWith(".bmp") ||
    n.endsWith(".svg")
  );
}

const LOAD_TIMEOUT_MS = 3000;

/** Preview pane: one scroll owner; height capped so the modal stays within the viewport. */
const previewPaneClass =
  "min-h-0 overflow-auto bg-gray-100 rounded border max-h-[calc(90vh-11rem)]";
const previewPaneFillClass =
  "h-[calc(90vh-11rem)] min-h-0 overflow-auto bg-gray-100 rounded border";

export default function DocumentViewer({
  filePath,
  mimeType = "",
  documentName = "",
  className = "",
  onOpenInNewTab,
}: DocumentViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [useFallback, setUseFallback] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const pdfTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mime = mimeType || "";
  const name = documentName || "";
  const isAbsoluteUrl =
    filePath.startsWith("http://") || filePath.startsWith("https://");
  const proxyUrl = isAbsoluteUrl ? getProxyUrl(filePath) : filePath;
  const googleViewerUrl = isAbsoluteUrl ? getGoogleDocsViewerUrl(filePath) : "";

  const pdf = isPdf(mime, name) && isAbsoluteUrl;
  const docx = isDocx(mime, name) && isAbsoluteUrl;
  const image = isImage(mime, name) && isAbsoluteUrl;
  const useIframe = !pdf && !docx && !image;

  const fileProp = useMemo(
    () =>
      pdf
        ? {
            url: proxyUrl,
            withCredentials: true as const,
          }
        : undefined,
    [pdf, proxyUrl]
  );

  useEffect(() => {
    if (!pdf || useFallback) return;
    pdfTimeoutRef.current = setTimeout(() => setUseFallback(true), LOAD_TIMEOUT_MS);
    return () => {
      if (pdfTimeoutRef.current) {
        clearTimeout(pdfTimeoutRef.current);
        pdfTimeoutRef.current = null;
      }
    };
  }, [pdf, useFallback]);

  const ActionBar = () =>
    onOpenInNewTab ? (
      <div className="p-2 bg-gray-50 border-t flex justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenInNewTab}
          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
        >
          Open in new tab
        </button>
      </div>
    ) : null;

  useEffect(() => {
    if (!docx || !docxContainerRef.current || useFallback) return;
    const el = docxContainerRef.current;
    el.innerHTML = "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);

    fetch(proxyUrl, { credentials: "include", signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch document");
        return r.blob();
      })
      .then((blob) => renderAsync(blob, el))
      .then(() => {
        clearTimeout(timeoutId);
        setStatus("ready");
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setUseFallback(true);
      });
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [docx, proxyUrl, useFallback]);

  const rootClass = `flex flex-col min-h-0 ${className}`.trim();

  if (pdf) {
    if (useFallback) {
      return (
        <div className={rootClass}>
          <div className={`${previewPaneFillClass} overflow-hidden`}>
            <iframe
              src={googleViewerUrl}
              title={documentName || "Document"}
              className="w-full h-full border-0"
            />
          </div>
          <ActionBar />
        </div>
      );
    }

    return (
      <div className={rootClass}>
        <div className={previewPaneFillClass}>
          {fileProp && (
            <Document
              file={fileProp}
              onLoadSuccess={({ numPages: n }) => {
                if (pdfTimeoutRef.current) {
                  clearTimeout(pdfTimeoutRef.current);
                  pdfTimeoutRef.current = null;
                }
                setNumPages(n);
                setStatus("ready");
              }}
              onLoadError={() => setUseFallback(true)}
              loading={
                <div className="flex items-center justify-center p-8">
                  <span className="animate-pulse text-gray-500">
                    Loading PDF…
                  </span>
                </div>
              }
              error={
                <div className="flex items-center justify-center p-8">
                  <span className="text-gray-500">
                    Loading failed. Trying Google Viewer…
                  </span>
                </div>
              }
              className="flex justify-center"
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i + 1}
                  pageNumber={i + 1}
                  width={Math.min(
                    800,
                    typeof window !== "undefined" ? window.innerWidth - 80 : 800
                  )}
                />
              ))}
            </Document>
          )}
        </div>
        <ActionBar />
      </div>
    );
  }

  if (docx) {
    if (useFallback) {
      return (
        <div className={rootClass}>
          <div className={`${previewPaneFillClass} overflow-hidden`}>
            <iframe
              src={googleViewerUrl}
              title={documentName || "Document"}
              className="w-full h-full border-0"
            />
          </div>
          <ActionBar />
        </div>
      );
    }

    return (
      <div className={rootClass}>
        {status === "loading" && (
          <div className="flex items-center justify-center p-8">
            <span className="animate-pulse text-gray-500">
              Loading document…
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="p-4 text-red-600 text-center">{errorMsg}</div>
        )}
        <div
          ref={docxContainerRef}
          className={`${previewPaneFillClass} bg-white p-4 docx-wrapper ${
            status === "loading" ? "hidden" : ""
          }`}
        />
        <ActionBar />
      </div>
    );
  }

  if (image) {
    return (
      <div className={rootClass}>
        <div
          className={`${previewPaneClass} flex items-center justify-center p-4`}
        >
          {status === "error" ? (
            <span className="text-red-600 text-sm">
              {errorMsg || "Failed to load image"}
            </span>
          ) : (
            <img
              src={proxyUrl}
              alt={documentName || "Document"}
              className="max-w-full max-h-[calc(90vh-12rem)] w-auto h-auto object-contain"
              onLoad={() => setStatus("ready")}
              onError={() => {
                setErrorMsg("Failed to load image");
                setStatus("error");
              }}
            />
          )}
        </div>
        <ActionBar />
      </div>
    );
  }

  if (useIframe) {
    const src = isAbsoluteUrl ? proxyUrl : filePath;
    return (
      <div className={rootClass}>
        <div className={`${previewPaneFillClass} overflow-hidden`}>
          <iframe
            src={src}
            title={documentName || "Document"}
            className="w-full h-full border-0"
          />
        </div>
        <ActionBar />
      </div>
    );
  }

  return null;
}
