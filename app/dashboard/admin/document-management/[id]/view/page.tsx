"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";

// PDF worker setup
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export default function DocumentViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [numPages, setNumPages] = useState<number>(1);
  const [mappedFields, setMappedFields] = useState<any[]>([]); // Mapped fields state
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Fetch PDF document and mapped fields
  const fetchDoc = async () => {
    setLoadingPdf(true);
    try {
      setPdfUrl(`/api/template-documents/${id}/file`);
      const response = await fetch(`/api/template-documents/${id}/mappings`);
      const data = await response.json();
      console.log("Mapped Fields Data:", data); // Debug: Log fetched fields
      if (data.success) {
        setMappedFields(data.fields || []); // Set the mapped fields
      }
    } catch (error) {
      console.error("Error fetching document or mappings:", error);
    } finally {
      setLoadingPdf(false);
    }
  };

  useEffect(() => {
    fetchDoc();
  }, [id]);

  // Render mapped fields dynamically
  const renderMappedFields = () => {
    return mappedFields.map((field, index) => {
      console.log(`Field ${index}:`, field); // Debug: Log field properties

      // Ensure we have valid field coordinates
      if (
        field.x === null ||
        field.x === undefined ||
        field.y === null ||
        field.y === undefined ||
        !field.w ||
        !field.h
      ) {
        console.warn(`Field ${field.field_label} is missing coordinates or size.`);
        return null; // Skip rendering if coordinates are missing
      }

      // Calculate scale factor based on actual page dimensions
      const scaleX = pageSize.width > 0 ? pageSize.width / 612 : 1; // Standard PDF width
      const scaleY = pageSize.height > 0 ? pageSize.height / 792 : 1; // Standard PDF height

      return (
        <div
          key={index}
          style={{
            position: "absolute",
            top: field.y * scaleY,
            left: field.x * scaleX,
            width: field.w * scaleX,
            height: field.h * scaleY,
            border: "2px dashed #007bff", // Use dashed border for placeholder
            backgroundColor: "rgba(0, 0, 0, 0.1)", // Semi-transparent background
            pointerEvents: "auto", // Allow interaction
            textAlign: "center", // Center the label text
            color: "black",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999, // Ensure fields are on top of PDF
          }}
        >
          {field.source_field_label}
        </div>
      );
    });
  };

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
          {loadingPdf ? (
            <div>Loading PDF...</div>
          ) : (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Document
                file={pdfUrl}
                onLoadSuccess={(pdf) => {
                  setNumPages(pdf.numPages);
                  const page = pdf.getPage(1); // Get the first page
                  page.then((page) => {
                    const { width, height } = page.getViewport({ scale: 1 });
                    setPageSize({ width, height }); // Set the actual page size
                  });
                }}
                loading={<div>Loading...</div>}
                error={<div>Error loading document</div>}
              >
                <Page
                  pageNumber={1}
                  scale={1}
                  renderAnnotationLayer={false} // Optional: Disable annotation layer
                  renderTextLayer={false} // Optional: Disable text layer
                />
                {/* Render mapped fields dynamically */}
                {renderMappedFields()}
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}